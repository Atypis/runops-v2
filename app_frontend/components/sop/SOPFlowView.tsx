'use client';

import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  ReactFlowProvider,
  Node as FlowNode, // Alias to avoid conflict with SOPNode
  Edge as FlowEdge, // Alias for clarity
  Position,
  useNodesState,
  useEdgesState,
  EdgeTypes,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

import { SOPDocument, SOPNode as AppSOPNode } from '@/lib/types/sop';
import { transformSopToFlowData } from '@/lib/sop-utils';
import TriggerNode from './TriggerNode';
import StepNode from './StepNode';
import EndNode from './EndNode';
import DecisionNode from './DecisionNode';
import LoopNode from './LoopNode';

// Define nodeTypes outside the component to prevent re-creation on every render
const nodeTypesConfig = {
  trigger: TriggerNode,
  step: StepNode,
  end: EndNode,
  decision: DecisionNode,
  loop: LoopNode,
};

// Define custom edge types
const edgeTypesConfig: EdgeTypes = {
  // You can add custom edge components here if needed
};

// Default edge styling options for all edges
const defaultEdgeOptions = {
  style: { strokeWidth: 2, stroke: '#64748b' },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 18,
    height: 18,
    color: '#64748b',
  },
  animated: false,
};

// Constants for compound node layout - can be tuned
const COMPOUND_NODE_PADDING_X_VIEW = 50; // Increased from 40 for more space
const COMPOUND_NODE_PADDING_Y_VIEW = 50; // Increased from 40 for more space
const AVG_RANKSEP_VIEW = 100; // Increased from 80 for more vertical separation
const AVG_NODESEP_VIEW = 80;  // Increased from 60 for more horizontal separation

// Initialize dagre graph instance (globally or outside component if preferred for stability)
// const dagreGraph = new dagre.graphlib.Graph({ compound: true }); // Keep this commented or remove
// dagreGraph.setDefaultEdgeLabel(() => ({})); // Keep this commented or remove

const getLayoutedElements = (nodes: FlowNode[], edges: FlowEdge[], direction = 'TB') => {
  // Create a new Dagre graph instance for each layout to ensure a clean state
  const dagreGraphInstance = new dagre.graphlib.Graph();  // REMOVE compound: true to avoid Dagre errors
  dagreGraphInstance.setDefaultEdgeLabel(() => ({}));

  // Reset graph by removing all nodes and edges before new layout
  // dagreGraph.nodes().forEach(nodeId => dagreGraph.removeNode(nodeId)); // No longer needed with new instance

  dagreGraphInstance.setGraph({ 
    rankdir: direction, 
    ranksep: AVG_RANKSEP_VIEW, 
    nodesep: AVG_NODESEP_VIEW, 
    marginx: COMPOUND_NODE_PADDING_X_VIEW / 2, 
    marginy: COMPOUND_NODE_PADDING_Y_VIEW / 2
    // REMOVED: compound: true,
  });

  const nodeIds = new Set(nodes.map(node => node.id));
  
  // Extract parent and child nodes for manual positioning later
  const parentNodes = nodes.filter(node => !node.parentNode && nodes.some(n => n.parentNode === node.id));
  const childNodesByParent: Record<string, FlowNode[]> = {};
  
  nodes.forEach(node => {
    if (node.parentNode) {
      if (!childNodesByParent[node.parentNode]) {
        childNodesByParent[node.parentNode] = [];
      }
      childNodesByParent[node.parentNode].push(node);
    }
  });

  // Create a mapping of all child node IDs for edge handling
  const childNodeIds = new Set(
    Object.values(childNodesByParent).flatMap(children => children.map(child => child.id))
  );

  // First pass: add only non-child nodes to Dagre - we'll position children manually
  const nonChildNodes = nodes.filter(node => !node.parentNode);
  nonChildNodes.forEach((node) => {
    let width = 208;
    let height = 112;

    if (node.data?.calculatedWidth && node.data?.calculatedHeight) {
      width = node.data.calculatedWidth;
      height = node.data.calculatedHeight;
    } else {
      if (node.type === 'trigger') { width = 208; height = 112; }
      else if (node.type === 'step') { width = 240; height = 80; }
      else if (node.type === 'end') { width = 208; height = 112; }
      else if (node.type === 'decision') { width = 208; height = 104; }
      else if (node.type === 'loop') { width = 240; height = 80; }
    }

    if (node.id) {
      dagreGraphInstance.setNode(node.id, { width, height, label: node.data?.label || node.id }); 
    }
  });

  // REMOVED: Second pass for setting parent relationships - no longer using Dagre's compound layout

  // Add edges between non-child nodes only for Dagre layout
  // BUT keep all edges for rendering
  const layoutEdges: FlowEdge[] = [];
  edges.forEach((edge) => {
    // Only add edges between nodes that are both in the Dagre graph (non-children)
    if (edge.source && edge.target && 
        !childNodeIds.has(edge.source) && 
        !childNodeIds.has(edge.target) &&
        nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      dagreGraphInstance.setEdge(edge.source, edge.target);
      layoutEdges.push(edge);
    }
  });

  // Run the layout for non-child nodes
  try {
    dagre.layout(dagreGraphInstance);
  } catch (error) {
    console.error('Dagre layout error:', error);
    return { nodes, edges }; // Return nodes/edges without layout if error occurs
  }

  // Position the non-child nodes based on Dagre layout
  const layoutedNodes = nonChildNodes.map((node): FlowNode => {
    if (!node.id || !dagreGraphInstance.hasNode(node.id)) {
      return { ...node, position: node.position || { x: 0, y: 0 } };
    }
    const nodeWithPosition = dagreGraphInstance.node(node.id);
    if (!nodeWithPosition || typeof nodeWithPosition.x !== 'number' || typeof nodeWithPosition.y !== 'number') {
      console.warn(`Node ${node.id} missing position after layout, using default.`);
      return { ...node, position: node.position || { x: Math.random() * 200, y: Math.random() * 200 } };
    }

    const isHorizontal = direction === 'LR';
    const nodeSpecificWidth = nodeWithPosition.width || 240;
    const nodeSpecificHeight = nodeWithPosition.height || 80;

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeSpecificWidth / 2, 
        y: nodeWithPosition.y - nodeSpecificHeight / 2,
      },
    };
  });

  // Create a map of positioned nodes by ID for lookup
  const positionedNodesById = layoutedNodes.reduce<Record<string, FlowNode>>((acc, node) => {
    if (node.id) acc[node.id] = node;
    return acc;
  }, {});

  // Now handle child nodes with fixed positions relative to their parents
  const childNodes: FlowNode[] = [];
  
  Object.entries(childNodesByParent).forEach(([parentNodeId, children]) => {
    const parentNode = positionedNodesById[parentNodeId];
    
    if (!parentNode || !parentNode.position) {
      console.warn(`Parent node ${parentNodeId} not found or has no position, using fallback positioning`);
      // If parent not found in positioned nodes, use fallback positioning
      children.forEach((childNode, index) => {
        const layoutedChildNode: FlowNode = {
          ...childNode,
          // Keep parentNode reference for ReactFlow
          position: {
            x: 300 + (index * 150),  // Horizontal fallback layout
            y: 400,
          }
        };
        childNodes.push(layoutedChildNode);
      });
      return;
    }
    
    const parentPosition = parentNode.position;
    const childCount = children.length;
    
    // Define sizes for child nodes - increased for better readability
    const childWidth = 220; // Increased from 200
    const childHeight = 100; // Increased from 90
    const horizontalSpacing = 80; // Increased from 60
    const verticalSpacing = 90; // Increased from 70
    
    // Determine optimal layout based on number of children and their types
    let maxChildrenPerRow = 2; // Default to 2 for most cases
    
    // For many nodes, determine optimal layout - more columns for more children
    if (childCount > 14) {
      maxChildrenPerRow = 4; // Use 4 columns for very large parents
    } else if (childCount > 8) {
      maxChildrenPerRow = 3; // Use 3 columns for large parents
    } else if (childCount <= 3) {
      maxChildrenPerRow = childCount; // For 1-3 nodes, use one row
    }
    
    // Check if there are decision nodes which need more space horizontally
    const hasDecisionNodes = children.some(node => node.type === 'decision');
    if (hasDecisionNodes && maxChildrenPerRow > 2 && childCount <= 6) {
      // Only reduce columns for smaller sets with decision nodes
      maxChildrenPerRow = Math.max(2, maxChildrenPerRow - 1);
    }
    
    // For very large child counts, ensure we don't create unnecessarily tall containers
    if (childCount > 16 && maxChildrenPerRow < 4) {
      maxChildrenPerRow = 4;
    }
    
    const rows = Math.ceil(childCount / maxChildrenPerRow);
    
    // Calculate total width and height needed for all children
    const totalChildWidth = (maxChildrenPerRow * childWidth) + ((maxChildrenPerRow - 1) * horizontalSpacing);
    const totalChildHeight = (rows * childHeight) + ((rows - 1) * verticalSpacing);
    
    console.log(`Layout for parent ${parentNodeId}: childCount=${childCount}, cols=${maxChildrenPerRow}, rows=${rows}, totalWidth=${totalChildWidth}, totalHeight=${totalChildHeight}`);
    
    // Position each child node
    children.forEach((childNode, index) => {
      const row = Math.floor(index / maxChildrenPerRow);
      const col = index % maxChildrenPerRow;

      // Calculate the initial offset to center the child nodes
      const initialXOffset = (parentNode.type === 'loop') ? 80 : 60;
      const initialYOffset = (parentNode.type === 'loop') ? 100 : 80;
      
      // For decision nodes, adjust position to account for diamond shape
      let xPosition = (col * (childWidth + horizontalSpacing)) + initialXOffset;
      let yPosition = (row * (childHeight + verticalSpacing)) + initialYOffset;
      
      // Center the nodes if there's extra space in the last row
      const nodesInLastRow = childCount % maxChildrenPerRow || maxChildrenPerRow;
      if (row === rows - 1 && nodesInLastRow < maxChildrenPerRow) {
        // Center the last row if it's not full
        const lastRowWidth = (nodesInLastRow * childWidth) + ((nodesInLastRow - 1) * horizontalSpacing);
        const extraSpace = totalChildWidth - lastRowWidth;
        if (extraSpace > 0 && row === rows - 1) {
          xPosition += extraSpace / 2;
        }
      }
      
      // Adjust position based on node type
      if (childNode.type === 'decision') {
        xPosition += 20; // Give decision nodes a bit more horizontal room
        yPosition += 10; // And vertical room
      }
      
      // Create positioned child node with parent reference intact
      const layoutedChildNode: FlowNode = {
        ...childNode,
        parentNode: parentNodeId, // Explicitly maintain the parent-child relationship
        extent: 'parent', // Make child stay within parent boundaries
        targetPosition: direction === 'LR' ? Position.Left : Position.Top,
        sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
        position: {
          x: xPosition,
          y: yPosition,
        },
        style: { 
          ...childNode.style, 
          backgroundColor: 'rgba(255, 255, 255, 0.95)', // More opaque background
          border: '1px solid #bbb',
          padding: '8px',
          borderRadius: '6px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)', // Add subtle shadow for depth
        }
      };
      
      console.log(`Manual positioning: Child ${childNode.id} at row ${row}, col ${col} -> x: ${layoutedChildNode.position.x}, y: ${layoutedChildNode.position.y}, parent: ${childNode.parentNode}`);
      
      childNodes.push(layoutedChildNode);
    });
    
    // Increase parent node size to accommodate children if needed
    if (parentNode.type === 'loop') {
      // Use the same initialXOffset and initialYOffset as defined above
      const parentInitialXOffset = (parentNode.type === 'loop') ? 80 : 60;
      const parentInitialYOffset = (parentNode.type === 'loop') ? 100 : 80;
      
      // Add extra padding based on child count 
      const extraPadding = childCount > 12 ? 80 : (childCount > 8 ? 60 : 40);
      const requiredWidth = totalChildWidth + (parentInitialXOffset * 2) + extraPadding;
      const requiredHeight = totalChildHeight + (parentInitialYOffset * 2) + extraPadding;
      
      // Always ensure the parent node has data.calculatedWidth and data.calculatedHeight
      if (!parentNode.data) {
        parentNode.data = {};
      }
      
      if (!parentNode.data.calculatedWidth) {
        parentNode.data.calculatedWidth = 0;
      }
      
      if (!parentNode.data.calculatedHeight) {
        parentNode.data.calculatedHeight = 0;
      }
      
      // Force the size to be large enough regardless of previous calculations
      parentNode.data.calculatedWidth = Math.max(requiredWidth, parentNode.data.calculatedWidth);
      parentNode.data.calculatedHeight = Math.max(requiredHeight, parentNode.data.calculatedHeight);
      
      console.log(`Resizing parent ${parentNodeId}: width=${parentNode.data.calculatedWidth}, height=${parentNode.data.calculatedHeight}, childCount=${childCount}, rows=${rows}, cols=${maxChildrenPerRow}`);
      
      // Update the node in the positionedNodesById map
      positionedNodesById[parentNodeId] = parentNode;
    }
  });

  // Combine the layout results
  const allLayoutedNodes = [...layoutedNodes, ...childNodes];

  console.log(`Final node count: ${allLayoutedNodes.length}`);
  allLayoutedNodes.forEach(node => {
    if (node.parentNode) {
      console.log(`Node ${node.id} has parent ${node.parentNode}, position: x=${node.position.x}, y=${node.position.y}`);
    }
  });

  return { nodes: allLayoutedNodes, edges };
};

// Helper to get all child node IDs recursively (needed for filtering)
const getAllDescendantIds = (nodeId: string, allNodes: FlowNode<AppSOPNode>[]): string[] => {
  let descendantIds: string[] = [];
  const currentNode = allNodes.find(n => n.id === nodeId);

  // Use childSopNodeIds if available (populated for compound parents in transformSopToFlowData)
  // Cast currentNode.data to any to access dynamically added childSopNodeIds
  const directChildrenIds = (currentNode?.data as any)?.childSopNodeIds || 
                            currentNode?.data?.childNodes?.map(child => child.id) || [];
  
  directChildrenIds.forEach((childId: string) => { // Explicitly type childId
    descendantIds.push(childId);
    const grandChildren = getAllDescendantIds(childId, allNodes);
    descendantIds = descendantIds.concat(grandChildren);
  });
  return descendantIds;
};

interface SOPFlowViewProps {
  sopData: SOPDocument; // This will be the processedSopData from the page
}

const SOPFlowView: React.FC<SOPFlowViewProps> = ({ sopData }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  // Add detection of complex SOPs
  const [isComplexSOP, setIsComplexSOP] = useState<boolean>(false);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);

  useEffect(() => {
    if (sopData && sopData.public) {
      // Check if this is a complex SOP (like mocksop.json)
      const hasComplexStructure = sopData.public.edges?.some(edge => 
        edge.source === 'L1_C9_A1_set_last_interaction_date' && edge.target === 'L1_process_emails'
      );
      
      setIsComplexSOP(hasComplexStructure);
      console.log(`SOP complexity detection: ${hasComplexStructure ? 'Complex' : 'Simple'} SOP`);

      const { flowNodes: initialFlowNodes, flowEdges: initialFlowEdges } = transformSopToFlowData(sopData);

      // Debugging: Check for parent/child relationships
      console.log("Initial flow nodes:", initialFlowNodes);
      const parentNodes = initialFlowNodes.filter(node => node.type === 'loop');
      const childNodes = initialFlowNodes.filter(node => node.parentNode);
      console.log("Parent nodes:", parentNodes);
      console.log("Child nodes:", childNodes);
      
      // Log detailed parent-child relationships for debugging
      childNodes.forEach(child => {
        console.log(`Child node ${child.id} has parent ${child.parentNode}`);
      });
      
      // Initialize expanded state: all parent nodes are expanded by default
      const initialExpandedState: Record<string, boolean> = {};
      initialFlowNodes.forEach(node => {
        const appNode = node.data as AppSOPNode; // Cast to access childNodes
        if (appNode.childNodes && appNode.childNodes.length > 0) {
          initialExpandedState[node.id] = true; // Default to expanded
        }
      });
      setExpandedNodes(initialExpandedState);
      
      // Attach toggle handler and expansion state to node data
      const nodesWithCollapseProps = initialFlowNodes.map(node => {
        const appNode = node.data as AppSOPNode;
        if (appNode.childNodes && appNode.childNodes.length > 0) {
          return {
            ...node,
            data: {
              ...node.data,
              isExpanded: true, // Always initialize as expanded for first render
              onToggleCollapse: handleToggleCollapse,
            },
          };
        }
        return node;
      });
      
      // Use the nodesWithCollapseProps for the initial layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodesWithCollapseProps,
        initialFlowEdges,
        'TB'
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

    } else {
      setNodes([]);
      setEdges([]);
      setExpandedNodes({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopData, handleToggleCollapse]);

  // Effect to re-filter and re-layout when expandedNodes changes
  useEffect(() => {
    if (sopData && sopData.public) {
      const { flowNodes: allFlowNodes, flowEdges: allFlowEdges } = transformSopToFlowData(sopData);
      
      // Attach toggle handler and expansion state to node data
      let processedNodes = allFlowNodes.map(node => {
        const appNode = node.data as AppSOPNode;
        if (appNode.childNodes && appNode.childNodes.length > 0) {
          return {
            ...node,
            data: {
              ...node.data,
              isExpanded: expandedNodes[node.id] === undefined ? true : expandedNodes[node.id],
              onToggleCollapse: handleToggleCollapse,
            },
          };
        }
        return node;
      });

      // Filtering logic
      let visibleNodes = processedNodes;
      let visibleEdges = allFlowEdges;

      processedNodes.forEach(node => {
        if (node.data.isExpanded === false) { // Node is collapsed
          const appNode = node.data as AppSOPNode;
          if (appNode.childNodes && appNode.childNodes.length > 0) {
            const descendantsToHide = getAllDescendantIds(node.id, processedNodes);
            visibleNodes = visibleNodes.filter(n => !descendantsToHide.includes(n.id));
            visibleEdges = visibleEdges.filter(edge => 
              !descendantsToHide.includes(edge.source) && 
              !descendantsToHide.includes(edge.target)
            );
          }
        }
      });

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        visibleNodes,
        visibleEdges,
        'TB'
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [sopData, expandedNodes, handleToggleCollapse, setNodes, setEdges]);

  if (!sopData) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading diagram data...</p></div>;
  }

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '500px' }} data-testid="sop-flow-view"> 
      {isComplexSOP && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 1000,
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #d1d5db',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '13px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
        }}>
          Complex SOP detected: Nested compound nodes temporarily disabled
        </div>
      )}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypesConfig}
          edgeTypes={edgeTypesConfig}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ 
            padding: 0.2,
            minZoom: 0.4,
            maxZoom: 1.6
          }}
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          className="bg-neutral-100"
        >
          <Controls 
            showInteractive={true}
            position="bottom-right"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              padding: '6px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
          />
          <MiniMap 
            nodeStrokeWidth={3} 
            zoomable 
            pannable 
            style={{
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
            }}
            nodeColor={(node: FlowNode) => {
              // Color nodes based on type for better minimap visibility
              if (node.type === 'loop') return '#7c3aed';
              if (node.type === 'decision') return '#3b82f6';
              if (node.type === 'trigger') return '#22c55e';
              if (node.type === 'end') return '#ef4444';
              return '#94a3b8'; // Default for step nodes
            }}
          />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default SOPFlowView; 