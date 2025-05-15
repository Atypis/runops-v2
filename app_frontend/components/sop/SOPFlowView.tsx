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
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';

import { SOPDocument, SOPNode as AppSOPNode } from '@/lib/types/sop';
import { transformSopToFlowData } from '@/lib/sop-utils';
import TriggerNode from './TriggerNode';
import StepNode from './StepNode';
import EndNode from './EndNode';
import DecisionNode from './DecisionNode';

interface SOPFlowViewProps {
  sopData: SOPDocument; // This will be the processedSopData from the page
}

const nodeTypes = {
  trigger: TriggerNode,
  step: StepNode,
  end: EndNode,
  decision: DecisionNode,
};

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

// Approximate dimensions for layout calculation
const NODE_WIDTH = 260; // Average width (TriggerNode w-64 (256px), StepNode w-60 (240px))
const NODE_HEIGHT = 90;  // Average height (TriggerNode min-h-60, StepNode min-h-80)

const getLayoutedElements = (nodes: FlowNode[], edges: FlowEdge[], direction = 'TB') => {
  dagreGraph.setGraph({ rankdir: direction, ranksep: 70, nodesep: 50 });

  nodes.forEach((node) => {
    let width = 208; // Default to new Trigger/End/Decision width
    let height = 112; // Default to new Trigger/End height (Decision might be slightly shorter)
    
    if (node.type === 'trigger') {
        width = 208;
        height = 112;
    } else if (node.type === 'step') {
        width = 240; 
        height = 80; 
    } else if (node.type === 'end') {
        width = 208;
        height = 112;
    } else if (node.type === 'decision') {
        width = 208; // Based on w-52 text box
        height = 104; // Estimated height for diamond above text box
    }
    dagreGraph.setNode(node.id, { width, height });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node): FlowNode => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const isHorizontal = direction === 'LR';
    
    // Get the specific dimensions used by dagre for this node
    const { width: nodeSpecificWidth, height: nodeSpecificHeight } = dagreGraph.node(node.id);

    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeSpecificWidth / 2, 
        y: nodeWithPosition.y - nodeSpecificHeight / 2, 
      },
      // Pass the actual width and height to the node for its own styling if needed
      // style: { width: nodeSpecificWidth, height: nodeSpecificHeight } // Optional
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Helper to get all child node IDs recursively (needed for filtering)
const getAllDescendantIds = (nodeId: string, allNodes: FlowNode<AppSOPNode>[]): string[] => {
  let descendantIds: string[] = [];
  const directChildren = allNodes.find(n => n.id === nodeId)?.data?.childNodes?.map(child => child.id) || [];
  
  directChildren.forEach(childId => {
    descendantIds.push(childId);
    const grandChildren = getAllDescendantIds(childId, allNodes); // Pass the original allNodes for lookup
    descendantIds = descendantIds.concat(grandChildren);
  });
  return descendantIds;
};

const SOPFlowView: React.FC<SOPFlowViewProps> = ({ sopData }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);

  useEffect(() => {
    if (sopData && sopData.public) {
      const { flowNodes: initialFlowNodes, flowEdges: initialFlowEdges } = transformSopToFlowData(sopData);

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
              isExpanded: expandedNodes[node.id] === undefined ? true : expandedNodes[node.id], // Default to true if not set
              onToggleCollapse: handleToggleCollapse,
            },
          };
        }
        return node;
      });
      
      // TODO: Implement filtering of nodes and edges based on expandedNodes state
      // For now, just layout all nodes with the new props.
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodesWithCollapseProps, // Use nodes with props
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
  }, [sopData, handleToggleCollapse]); // expandedNodes will be a dependency later when filtering is active

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
    <div style={{ height: '100%', width: '100%', minHeight: '500px' }} data-testid="sop-flow-view"> {/* Ensure parent gives height */}
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          className="bg-neutral-100"
        >
          <Controls />
          <MiniMap nodeStrokeWidth={3} zoomable pannable />
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default SOPFlowView; 