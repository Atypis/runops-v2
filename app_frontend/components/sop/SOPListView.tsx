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

interface SOPListViewProps {
  initialProcessedSopData: SOPDocument;
  initialRootNodes: SOPNode[];
  onUpdate: (updatedProcessedData: SOPDocument) => void;
}

const SOPListView: React.FC<SOPListViewProps> = ({ initialProcessedSopData, initialRootNodes, onUpdate }) => {
  const [processedSopData, setProcessedSopData] = useState<SOPDocument | null>(initialProcessedSopData);
  const [rootNodes, setRootNodes] = useState<SOPNode[]>(initialRootNodes);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    setProcessedSopData(initialProcessedSopData);
    setRootNodes(initialRootNodes);
  }, [initialProcessedSopData, initialRootNodes]);

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

  const handleUpdateNode = async (nodeId: string, updatedProperties: Partial<SOPNode>) => {
    if (!processedSopData || !processedSopData.public || !processedSopData.public.nodes) {
      console.warn("Cannot update node: processedSopData or its public nodes are not available.");
      return;
    }

    try {
      // Get the sopId from the URL
      const pathname = window.location.pathname;
      const sopId = pathname.split('/').pop();

      if (!sopId) {
        console.error("Failed to extract SOP ID from URL");
        return;
      }

      // Call the PATCH endpoint
      const response = await fetch(`/api/sop/${sopId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'update',
          nodeId,
          updates: updatedProperties,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update SOP node');
      }

      // Get the updated SOP data from the response
      const updatedSopData = await response.json();

      // Update the local state
      const newProcessedData = processSopData(updatedSopData.data);
      setProcessedSopData(newProcessedData);
      const newRoots = getRootNodes(newProcessedData.public);
      setRootNodes(newRoots);
      onUpdate(newProcessedData); // Call the callback
    } catch (error) {
      console.error('Error updating node:', error);
      // Still update the UI locally even if the API call fails
      // This provides a better user experience while still trying to sync with the server
      // Create a deep copy of the nodes array from the current state to avoid direct mutation
      const currentNodesCopy = JSON.parse(JSON.stringify(processedSopData.public.nodes)) as SOPNode[];

      const updatedNodes = updateNodeRecursively(
        currentNodesCopy,
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
        public: newPublicSop,
        private: processedSopData.private 
      };
      
      setProcessedSopData(newProcessedData);
      const newRoots = getRootNodes(newProcessedData.public);
      setRootNodes(newRoots);
      onUpdate(newProcessedData);
    }
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

  const handleDeleteNode = async (nodeIdToDelete: string) => {
    if (!processedSopData || !processedSopData.public || !processedSopData.public.nodes) {
      console.warn("Cannot delete node: data prerequisites not met.");
      return;
    }

    try {
      // Get the sopId from the URL
      const pathname = window.location.pathname;
      const sopId = pathname.split('/').pop();

      if (!sopId) {
        console.error("Failed to extract SOP ID from URL");
        return;
      }

      // Call the PATCH endpoint for deletion
      const response = await fetch(`/api/sop/${sopId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'delete',
          nodeId: nodeIdToDelete,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete SOP node');
      }

      // Get the updated SOP data from the response
      const updatedSopData = await response.json();

      // Update the local state
      const newProcessedData = processSopData(updatedSopData.data);
      setProcessedSopData(newProcessedData);
      const newRoots = getRootNodes(newProcessedData.public);
      setRootNodes(newRoots);
      onUpdate(newProcessedData); // Call the callback
    } catch (error) {
      console.error('Error deleting node:', error);
      // Still update the UI locally if the API call fails for better UX
      const allCurrentNodes = processedSopData.public.nodes;
      const nodeToDelete = allCurrentNodes.find(node => node.id === nodeIdToDelete);

      if (!nodeToDelete) {
        console.warn(`Cannot delete node: Node with id ${nodeIdToDelete} not found in current processed data.`);
        return;
      }

      const idsToRemove = new Set<string>([nodeIdToDelete]);
      const descendantIds = getAllChildIds(nodeToDelete, allCurrentNodes);
      descendantIds.forEach(id => idsToRemove.add(id));

      const updatedNodes = allCurrentNodes.filter(node => !idsToRemove.has(node.id));
      const updatedEdges = processedSopData.public.edges.filter(edge => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target));

      const tempSopDocumentForReprocessing: SOPDocument = {
        ...initialProcessedSopData,
        public: {
          ...initialProcessedSopData.public,
          nodes: updatedNodes.map(n => {
            const { childNodes, parentId, ...rest } = n;
            const originalNodeFromInitial = initialProcessedSopData.public.nodes.find(on => on.id === rest.id);
            return { ...rest, parentId: originalNodeFromInitial?.parentId }; 
          }),
          edges: updatedEdges
        }
      };
      
      const newProcessedData = processSopData(tempSopDocumentForReprocessing);
      setProcessedSopData(newProcessedData);
      const newRoots = getRootNodes(newProcessedData.public);
      setRootNodes(newRoots);
      onUpdate(newProcessedData);
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

    let newProcessedDataResult: SOPDocument | null = null;

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
              if (aIsRoot) return -1; // Roots come first
              if (bIsRoot) return 1;  // Roots come first
              return 0; // Maintain original order for non-roots relative to each other
            });
            
            newProcessedDataResult = {
              ...processedSopData,
              public: {
                ...processedSopData.public,
                nodes: sortedAllNodes,
              },
            };
          }
          return newRootNodesOrder; // This updates the immediate visual list of roots
        });
      } else {
        console.warn("Attempted to reorder root nodes, but one item was not found in current rootNodes state.");
      }
    }

    // Scenario 2: Reordering child nodes within the same parent
    else if (activeNodeData?.parentId != null && activeNodeData.parentId === overNodeData?.parentId) {
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
        const oldIndex = parentNode.childNodes.findIndex((item) => item.id === activeId);
        const newIndex = parentNode.childNodes.findIndex((item) => item.id === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedChildNodes = arrayMove(parentNode.childNodes, oldIndex, newIndex);
          
          const updateParentNodeChildren = (nodes: SOPNode[], parentId: string, newChildren: SOPNode[]): SOPNode[] => {
            return nodes.map(node => {
              if (node.id === parentId) {
                return { ...node, childNodes: newChildren };
              }
              // if (node.childNodes) { // Not needed if childNodes are references to top-level array
              //   return { ...node, childNodes: updateParentNodeChildren(node.childNodes, parentId, newChildren) };
              // }
              return node;
            });
          };

          const updatedAllNodes = updateParentNodeChildren(
            processedSopData.public.nodes,
            activeNodeData.parentId,
            reorderedChildNodes
          );
          
          newProcessedDataResult = {
            ...processedSopData,
            public: {
              ...processedSopData.public,
              nodes: updatedAllNodes,
            },
          };
        }
      }
    } else {
      console.log("Drag unhandled: ", { activeId, overId, activeNodeData, overNodeData });
    }
    
    if (newProcessedDataResult) {
      setProcessedSopData(newProcessedDataResult);
      setRootNodes(getRootNodes(newProcessedDataResult.public)); // Update rootNodes state
      onUpdate(newProcessedDataResult); // Call the callback
    }
  }

  function handleDragCancel() {
    console.log("Drag operation cancelled. Active Draggable:", rootNodes); // Log something to see if this fires
    // Potential actions to consider if this state persists:
    // - Force a re-render of some part of the DndContext or sortable items.
    // - Manually reset sensor states if @dnd-kit API allows (less common to need this).
  }

  if (!processedSopData || !processedSopData.public || !processedSopData.public.nodes) {
    // This message might appear briefly if initial props are null before parent finishes loading
    return <div className="p-4"><p className="text-muted-foreground">Loading SOP data or data is not available...</p></div>;
  }

  const { meta, public: publicData } = processedSopData;

  // Assuming there's at least one trigger, or you have a way to select/display multiple.
  // For now, just taking the first trigger if it exists.
  const primaryTrigger: SOPTrigger | undefined = publicData.triggers?.[0];
  const rootNodeIds = rootNodes.map(node => node.id);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="h-full overflow-y-auto">
        <HeaderCard meta={meta} />
        
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

        {rootNodes.length === 0 && (
          <p className="text-muted-foreground p-4">No steps found in this SOP.</p>
        )}
      </div>
    </DndContext>
  );
};

export default SOPListView; 