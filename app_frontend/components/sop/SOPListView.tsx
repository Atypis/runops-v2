'use client'; // This component will fetch data and manage state

import React, { useEffect, useState } from 'react';
import { SOPDocument, SOPNode, SOPTrigger, SOPPublicData } from '@/lib/types/sop';
import { processSopData, getRootNodes } from '@/lib/sop-utils';
import HeaderCard from './HeaderCard';
import AccessCard, { mockAccessItems } from './AccessCard'; // Using mockAccessItems for now
import TriggerBlockDisplay from './TriggerBlockDisplay';
import StepCardDisplay from './StepCardDisplay';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// Helper type for DND item data
interface DndItemData {
  id: string;
  parentId?: string | null;
}

const SOPListView: React.FC = () => {
  const [sopData, setSopData] = useState<SOPDocument | null>(null);
  const [processedSopData, setProcessedSopData] = useState<SOPDocument | null>(null);
  const [rootNodes, setRootNodes] = useState<SOPNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    const fetchSopData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // In a real app, this would be an API call: /api/sop/:sopId
        // For now, fetching from the public directory
        const response = await fetch('/mocksop.json');
        if (!response.ok) {
          throw new Error(`Failed to fetch SOP data: ${response.statusText}`);
        }
        const data: SOPDocument = await response.json();
        setSopData(data);
        const processed = processSopData(data);
        setProcessedSopData(processed);
        if (processed && processed.public) {
          const currentRootNodes = getRootNodes(processed.public);
          setRootNodes(currentRootNodes);
          console.log('Current Root Nodes:', currentRootNodes);
        } else {
          setRootNodes([]);
          console.log('Current Root Nodes: [] (processed or public data missing)');
        }
      } catch (err: any) {
        setError(err.message || 'An unknown error occurred');
        console.error("Error fetching SOP data:", err);
        setRootNodes([]);
        console.log('Current Root Nodes: [] (error during fetch)');
      }
      setIsLoading(false);
    };

    fetchSopData();
  }, []);

  // Helper function to recursively find and update a node
  const updateNodeRecursively = (nodesList: SOPNode[], nodeId: string, updatedProperties: Partial<SOPNode>): SOPNode[] => {
    return nodesList.map(node => {
      if (node.id === nodeId) {
        return { ...node, ...updatedProperties };
      }
      if (node.childNodes && node.childNodes.length > 0) {
        // Recursively update within childNodes as well, if the structure is nested there
        // This assumes childNodes are part of the same flat list structure initially or handled by processSopData
        // If childNodes are exclusively populated by processSopData and point to nodes in the main list,
        // then just updating the node in the main list is sufficient.
        // Given processSopData likely resolves these, we primarily target the main list.
        // However, if childNodes themselves are independent SOPNode arrays that need direct update:
        return { ...node, childNodes: updateNodeRecursively(node.childNodes, nodeId, updatedProperties) };
      }
      return node;
    });
  };

  const handleUpdateNode = (nodeId: string, updatedProperties: Partial<SOPNode>) => {
    if (!processedSopData || !processedSopData.public || !processedSopData.public.nodes) {
      console.warn("Cannot update node: processedSopData or its public nodes are not available.");
      return;
    }

    const updatedNodes = updateNodeRecursively(
      processedSopData.public.nodes,
      nodeId,
      updatedProperties
    );

    const newPublicSop: SOPPublicData = {
      ...processedSopData.public,
      nodes: updatedNodes
    };

    const newProcessedData: SOPDocument = {
      ...processedSopData,
      meta: processedSopData.meta,
      public: newPublicSop
    };

    setProcessedSopData(newProcessedData);
    setRootNodes(getRootNodes(newProcessedData.public));
  };

  // Helper function to recursively collect all child IDs of a given node
  const getAllChildIds = (node: SOPNode, allNodes: SOPNode[]): string[] => {
    let childIds: string[] = [];
    if (node.childNodes && node.childNodes.length > 0) {
      for (const child of node.childNodes) {
        childIds.push(child.id);
        // Find the full child node object from the flat list to recurse
        const fullChildNode = allNodes.find(n => n.id === child.id);
        if (fullChildNode) {
          childIds = childIds.concat(getAllChildIds(fullChildNode, allNodes));
        }
      }
    }
    return childIds;
  };

  // Helper function to filter out nodes by IDs
  const filterNodesRecursively = (nodesList: SOPNode[], idsToRemove: Set<string>): SOPNode[] => {
    return nodesList
      .filter(node => !idsToRemove.has(node.id))
      .map(node => {
        if (node.childNodes && node.childNodes.length > 0) {
          return { ...node, childNodes: filterNodesRecursively(node.childNodes, idsToRemove) };
        }
        return node;
      });
  };

  const handleDeleteNode = (nodeIdToDelete: string) => {
    if (!processedSopData || !processedSopData.public || !processedSopData.public.nodes || !sopData) {
      console.warn("Cannot delete node: data prerequisites not met.");
      return;
    }

    const allNodes = processedSopData.public.nodes;
    const nodeToDelete = allNodes.find(node => node.id === nodeIdToDelete);
    if (!nodeToDelete) {
      console.warn(`Cannot delete node: Node with id ${nodeIdToDelete} not found.`);
      return;
    }

    const idsToRemove = new Set<string>([nodeIdToDelete]);
    // Use the flat list (allNodes) for collecting all descendant IDs accurately
    const descendantIds = getAllChildIds(nodeToDelete, allNodes);
    descendantIds.forEach(id => idsToRemove.add(id));

    // Filter the main flat list of nodes
    const updatedNodes = allNodes.filter(node => !idsToRemove.has(node.id));

    // After filtering the main list, we need to ensure childNodes arrays within remaining nodes are also cleaned up.
    // This is tricky if childNodes are just references. The `processSopData` rebuilds this structure.
    // For simplicity, we'll rely on processSopData to reconstruct relations correctly after node removal from the flat list.
    // Or, we can manually clean up childNodes references here.
    // Let's try a more direct approach: re-process the SOP after removing nodes from the *original* flat list
    // that `processSopData` expects (which is sopData.public.nodes)

    if (!sopData) return; // Should not happen if processedSopData exists

    const originalPublicNodes = sopData.public.nodes;
    const filteredOriginalNodes = originalPublicNodes.filter(node => !idsToRemove.has(node.id));
    
    const tempSopDocument: SOPDocument = {
      ...sopData,
      public: {
        ...sopData.public,
        nodes: filteredOriginalNodes,
        // Edges might also need cleanup if they reference deleted nodes. 
        // For now, assuming edges are rebuilt by processSopData or handled later.
        edges: sopData.public.edges.filter(edge => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target))
      }
    };

    // Re-process the entire SOP data to correctly rebuild hierarchies and root nodes
    const newProcessedData = processSopData(tempSopDocument);
    setProcessedSopData(newProcessedData);
    if (newProcessedData && newProcessedData.public) {
      setRootNodes(getRootNodes(newProcessedData.public));
    } else {
      setRootNodes([]);
    }
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) {
      return; // Dragged to a non-droppable area
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeNodeData = active.data.current as DndItemData | undefined;
    const overNodeData = over.data.current as DndItemData | undefined;

    if (activeId === overId) {
      return; // No movement
    }

    if (!processedSopData || !processedSopData.public || !processedSopData.public.nodes) {
      console.warn("DragEnd: SOP data not available");
      return;
    }

    // Scenario 1: Reordering root nodes
    if (activeNodeData?.parentId == null && overNodeData?.parentId == null) {
      // Ensure both are indeed root nodes according to our rootNodes state array
      const activeIsInRoots = rootNodes.some(n => n.id === activeId);
      const overIsInRoots = rootNodes.some(n => n.id === overId);

      if (activeIsInRoots && overIsInRoots) {
        setRootNodes((items) => {
          const oldIndex = items.findIndex((item) => item.id === activeId);
          const newIndex = items.findIndex((item) => item.id === overId);
          const newRootNodesOrder = arrayMove(items, oldIndex, newIndex);

          // Update the main processedSopData.public.nodes array to reflect root order
          if (processedSopData && processedSopData.public && processedSopData.public.nodes) {
            const rootNodeOrderMap = new Map(newRootNodesOrder.map((node, index) => [node.id, index]));
            const sortedAllNodes = [...processedSopData.public.nodes].sort((a, b) => {
              const aIsRoot = rootNodeOrderMap.has(a.id);
              const bIsRoot = rootNodeOrderMap.has(b.id);
              if (aIsRoot && bIsRoot) return (rootNodeOrderMap.get(a.id) ?? 0) - (rootNodeOrderMap.get(b.id) ?? 0);
              if (aIsRoot) return -1;
              if (bIsRoot) return 1;
              // For non-root nodes, maintain their relative order or use other criteria if needed
              // This simple sort might need improvement if children's absolute order in the flat list matters beyond parentage.
              return 0; 
            });
            
            const newPublicSopData = { ...processedSopData.public, nodes: sortedAllNodes };
            const newProcessedData = { ...processedSopData, public: newPublicSopData };
            setProcessedSopData(newProcessedData); // This updates the source for getRootNodes
          }
          return newRootNodesOrder; // This updates the immediate visual list of roots
        });
      } else {
        console.warn("Attempted to reorder root nodes, but one item was not found in current rootNodes state.");
      }
      return;
    }

    // Scenario 2: Reordering child nodes within the same parent
    if (activeNodeData?.parentId != null && activeNodeData.parentId === overNodeData?.parentId) {
      const parentId = activeNodeData.parentId;
      
      // Find the parent node in the processed data
      // We need a recursive way to find any node, not just root ones.
      let parentNode: SOPNode | null = null;
      const findNodeRecursive = (nodes: SOPNode[], id: string): SOPNode | null => {
        for (const node of nodes) {
          if (node.id === id) return node;
          if (node.childNodes) {
            const foundChild = findNodeRecursive(node.childNodes, id);
            if (foundChild) return foundChild;
          }
        }
        return null;
      };
      // Search within the entire processed data structure to find the parent
      parentNode = findNodeRecursive(processedSopData.public.nodes, parentId);
      // Note: For simplicity, assuming parentId directly points to a node in the flat list processedSopData.public.nodes
      // If our processSopData correctly makes childNodes refer to items from the main list, this is fine.
      // More robust: use a map of all nodes if performance is an issue or structure is complex.
      // Let's try finding parent in the flat list first, as childNodes should be references.
      parentNode = processedSopData.public.nodes.find(n => n.id === parentId) || null;

      if (parentNode && parentNode.childNodes) {
        const oldIndex = parentNode.childNodes.findIndex(child => child.id === activeId);
        const newIndex = parentNode.childNodes.findIndex(child => child.id === overId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedChildren = arrayMove(parentNode.childNodes, oldIndex, newIndex);
          // Directly mutate the childNodes array of the parentNode in processedSopData
          // This relies on childNodes being mutable and this mutation being picked up.
          parentNode.childNodes = reorderedChildren;

          // Trigger re-render by creating new objects for state
          const newProcessedData = { 
            ...processedSopData, 
            public: { 
              ...processedSopData.public, 
              nodes: [...processedSopData.public.nodes] // Create new array for nodes
            } 
          };
          setProcessedSopData(newProcessedData);
          // Refresh rootNodes to ensure UI updates, as child order change might affect display if not directly re-rendering parent
          setRootNodes(getRootNodes(newProcessedData.public)); 

        } else {
          console.warn("Child reorder: active or over ID not found in parent's childNodes.");
        }
      } else {
        console.warn("Child reorder: Parent node or its childNodes not found.", parentId);
      }
      return;
    }

    // If none of the above, it might be a drag between different parents or to/from root - ignore for now.
    console.log("DragEnd: Unhandled drag scenario or dragging between different contexts. Active:", activeNodeData, "Over:", overNodeData);
  }

  function handleDragCancel() {
    console.log("Drag operation cancelled. Active Draggable:", rootNodes); // Log something to see if this fires
    // Potential actions to consider if this state persists:
    // - Force a re-render of some part of the DndContext or sortable items.
    // - Manually reset sensor states if @dnd-kit API allows (less common to need this).
  }

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Loading SOP data...</p>
        {/* Add a spinner component here later if desired */}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        <p>Error loading SOP: {error}</p>
      </div>
    );
  }

  if (!processedSopData || !processedSopData.meta || !processedSopData.public) {
    return <div className="p-6 text-center">No SOP data available.</div>;
  }

  // Assuming there's at least one trigger, or you have a way to select/display multiple.
  // For now, just taking the first trigger if it exists.
  const primaryTrigger: SOPTrigger | undefined = processedSopData.public.triggers?.[0];
  const rootNodeIds = rootNodes.map(node => node.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full overflow-y-auto">
        <HeaderCard meta={processedSopData.meta} />
        
        {/* Layout for AccessCard and Trigger (can be adjusted, e.g. AccessCard in a sidebar area) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="md:col-span-2">
            {primaryTrigger && <TriggerBlockDisplay trigger={primaryTrigger} />}
          </div>
          <div className="md:col-span-1">
            {/* Using mockAccessItems for now. Replace with actual data when available */}
            <AccessCard accessItems={mockAccessItems} /> 
          </div>
        </div>

        <SortableContext items={rootNodeIds} strategy={verticalListSortingStrategy}>
          {rootNodes.map((node) => (
            <StepCardDisplay
              key={node.id}
              node={node}
              level={0}
              onUpdateNode={handleUpdateNode}
              onDeleteNode={handleDeleteNode}
            />
          ))}
        </SortableContext>

        {rootNodes.length === 0 && !isLoading && (
          <p className="text-muted-foreground p-4">No steps found in this SOP.</p>
        )}
      </div>
    </DndContext>
  );
};

export default SOPListView; 