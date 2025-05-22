'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Controls,
  MiniMap,
  ReactFlowProvider,
  Node as FlowNode,
  Edge as FlowEdge,
  Position,
  useNodesState,
  useEdgesState,
  EdgeTypes,
  MarkerType,
  ConnectionLineType,
  getBezierPath,
  EdgeProps,
  EdgeMarker,
  NodeChange
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { css } from '@emotion/css';

import { SOPDocument, SOPNode, SOPNode as AppSOPNode } from '@/lib/types/sop';
import { transformSopToFlowData } from '@/lib/sop-utils';
import TriggerNode from './TriggerNode';
import StepNode from './StepNode';
import EndNode from './EndNode';
import DecisionNode from './DecisionNode';
import LoopNode from './LoopNode';
import ExpandedNodeEditor from './ExpandedNodeEditor';
import { 
  getConnectionType, 
  transformCoordinates, 
  getPathParams,
  ConnectionType,
  getOptimalHandles
} from './utils/edgeUtils';
import CompoundNodeMarker from './utils/CompoundNodeMarker';

// Debug utility to track edge processing pipeline
const debugEdgeProcessing = (stage: string, edges: FlowEdge[], showFullEdge: boolean = false) => {
  // All debug logging is now disabled
  return;
};

// Add a custom CSS class to disable React Flow's default selection styling and add our own
const reactFlowCustomStyles = css`
  .react-flow__node {
    transition: all 0.2s;
  }
  
  .react-flow__node.selected {
    /* Override React Flow's default selection styling */
    box-shadow: none !important;
    border-color: transparent !important;
  }
  
  .react-flow__node.selected::after {
    display: none !important;
  }
  
  /* Custom selection styling - more subtle than before */
  .node-selected-highlight {
    position: absolute;
    left: 0;
    top: 0;
    right: 0;
    bottom: 0;
    border: 1.5px solid;
    border-radius: 8px;
    pointer-events: none;
    z-index: 5;
    opacity: 0.8;
  }
  
  /* Type-specific highlighting */
  .node-selected-highlight.trigger {
    border-color: #f59e0b;
    box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.4);
  }
  
  .node-selected-highlight.decision {
    border-color: #eab308;
    box-shadow: 0 0 0 1px rgba(234, 179, 8, 0.4);
  }
  
  .node-selected-highlight.loop {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.4);
  }
  
  .node-selected-highlight.end {
    border-color: #3b82f6;
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.4);
  }
  
  .node-selected-highlight.step {
    border-color: #0ea5e9;
    box-shadow: 0 0 0 1px rgba(14, 165, 233, 0.4);
  }
  
  /* Expand button styling - now integrated within the node */
  .node-expand-button {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 24px;
    height: 24px;
    background-color: rgba(255, 255, 255, 0.9);
    color: #64748b; /* slate-500 for a subtle look */
    border: 1px solid #e2e8f0; /* slate-200 */
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 10;
    transition: all 0.2s;
  }
  
  .node-expand-button:hover {
    background-color: #f8fafc; /* slate-50 */
    color: #0f172a; /* slate-900 */
    transform: scale(1.05);
  }
`;

// Define nodeTypes outside the component to prevent re-creation on every render
const nodeTypesConfig = {
  trigger: TriggerNode,
  step: StepNode,
  end: EndNode,
  decision: DecisionNode,
  loop: LoopNode,
};

// Custom edge component to improve edge appearance and routing
const CustomEdge: React.FC<EdgeProps> = ({ 
  id, 
  source, 
  target, 
  sourceX, 
  sourceY, 
  targetX, 
  targetY, 
  sourcePosition, 
  targetPosition, 
  style = {}, 
  markerEnd,
  data,
  sourceHandleId,
  targetHandleId
}) => {
  // Determine connection type and path properties
  const connectionType = data?.connectionType || ConnectionType.STANDARD;
  
  // Get path styling based on type
  const isYesPath = data?.condition && (data?.label?.toLowerCase() === 'yes' || data?.label?.toLowerCase() === 'true');
  const isNoPath = data?.condition && (data?.label?.toLowerCase() === 'no' || data?.label?.toLowerCase() === 'false');
  const isNextPath = data?.label?.toLowerCase() === 'next';
  const isTriggerPath = data?.sourceType === 'trigger';
  const isParentChildPath = connectionType === ConnectionType.PARENT_TO_CHILD || 
                           connectionType === ConnectionType.CHILD_TO_PARENT;
  
  // Check if target or source are inside compound nodes
  const isTargetChildNode = data?.isTargetChildNode;
  const isSourceChildNode = data?.isSourceChildNode;
  const sourceParentNode = data?.sourceParentNode;
  const targetParentNode = data?.targetParentNode;
  
  // Get decision path information for labels
  const sourceIdPath = data?.sourceIdPath;
  const decisionPath = data?.decisionPath;
  
  // Create decision path label if applicable
  let labelText = data?.label || '';
  if (sourceIdPath && isYesPath && decisionPath) {
    labelText = `${sourceIdPath}Y`;
  } else if (sourceIdPath && isNoPath && decisionPath) {
    labelText = `${sourceIdPath}N`;
  }
  
  // Color scheme based on path type
  const strokeColor = isYesPath ? '#15803d' :   // Green for "yes" paths
                     isNoPath ? '#b91c1c' :    // Red for "no" paths
                     isNextPath ? '#0284c7' :  // Blue for "next" paths
                     isTriggerPath ? '#f59e0b' : // Orange for trigger paths
                     isParentChildPath ? '#6366f1' : // Indigo for parent-child relationships
                     data?.condition ? '#7c3aed' : // Purple for other conditions
                     '#64748b'; // Default gray for standard flow
  
  // Line styles based on path type
  const strokeWidth = isYesPath || isNoPath ? 2 : 
                     isNextPath ? 1.7 : 
                     isParentChildPath ? 1.3 :
                     data?.condition ? 1.8 : 1.5;
                     
  const dashArray = isNoPath ? '5,5' : 
                   isParentChildPath ? '3,3' : 
                   undefined; // Dashed lines for specific path types
  
  // Transform coordinates based on connection type
  const { 
    adjustedSourceX, 
    adjustedSourceY, 
    adjustedTargetX, 
    adjustedTargetY 
  } = transformCoordinates(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    connectionType,
    sourceHandleId || null,
    targetHandleId || null,
    sourcePosition,
    targetPosition,
    sourceParentNode || null,
    targetParentNode || null
  );
  
  // Get path parameters based on connection type
  const { curvature, offsetX } = getPathParams(
    connectionType,
    adjustedSourceX,
    adjustedSourceY,
    adjustedTargetX,
    adjustedTargetY,
    sourcePosition,
    targetPosition,
    data
  );
  
  // Generate edge path using getBezierPath with our transformed coordinates
  const [edgePath] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    sourcePosition,
    targetX: adjustedTargetX, // No offsetX: keep endpoint centered for decision paths
    targetY: adjustedTargetY,
    targetPosition,
    curvature,
  });
  
  // Calculate optimal label position in the middle of the path
  const labelX = (adjustedSourceX + adjustedTargetX) / 2; // No offsetX
  const labelY = (adjustedSourceY + adjustedTargetY) / 2 - 10;
  
  // Determine label text color and style based on path type
  const textColor = isYesPath ? '#15803d' : 
                   isNoPath ? '#b91c1c' : 
                   isNextPath ? '#0284c7' :
                   isTriggerPath ? '#ca8a04' :
                   connectionType === ConnectionType.DECISION_PATH ? '#7c3aed' : '#475569';
  
  const textFontWeight = (isYesPath || isNoPath) ? 600 : 
                        isNextPath ? 500 :
                        connectionType === ConnectionType.DECISION_PATH ? 500 : 400;
  
  // Visual emphasis for important paths
  const textTransform = (isYesPath || isNoPath) ? 'uppercase' : 'none';
  
  // Calculate marker positions for source and target
  const sourceMarkerX = sourcePosition === Position.Left ? adjustedSourceX + 3 : 
                       sourcePosition === Position.Right ? adjustedSourceX - 3 : 
                       adjustedSourceX;
  
  const sourceMarkerY = sourcePosition === Position.Top ? adjustedSourceY + 3 : 
                       sourcePosition === Position.Bottom ? adjustedSourceY - 3 : 
                       adjustedSourceY;
  
  const targetMarkerX = targetPosition === Position.Left ? adjustedTargetX + 3 : 
                       targetPosition === Position.Right ? adjustedTargetX - 3 : 
                       adjustedTargetX;
  
  const targetMarkerY = targetPosition === Position.Top ? adjustedTargetY + 3 : 
                       targetPosition === Position.Bottom ? adjustedTargetY - 3 : 
                       adjustedTargetY;
                       
  return (
    <>
      {/* The actual edge path */}
      <path
        id={id}
        style={{
          ...style,
          stroke: strokeColor,
          strokeWidth,
          strokeDasharray: dashArray,
          transition: 'stroke-width 0.2s, opacity 0.2s',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      
      {/* Source marker */}
      {isSourceChildNode && (
        <CompoundNodeMarker
          cx={sourceMarkerX}
          cy={sourceMarkerY}
          connectionType={connectionType}
          isSource={true}
          isChildNode={isSourceChildNode}
          position={sourcePosition}
          color={isSourceChildNode ? "#ef4444" : strokeColor}
        />
      )}
      
      {/* Target marker - always render for better visibility */}
      <CompoundNodeMarker
        cx={targetMarkerX}
        cy={targetMarkerY}
        connectionType={connectionType}
        isSource={false}
        isChildNode={isTargetChildNode}
        position={targetPosition}
        color={isTargetChildNode ? "#ef4444" : strokeColor}
      />
      
      {/* Text label */}
      {labelText && (
        <text
          x={labelX}
          y={labelY}
          style={{
            fontSize: '11px',
            fill: textColor,
            fontWeight: textFontWeight,
            textShadow: '0 0 3px white, 0 0 3px white, 0 0 3px white, 0 0 3px white',
            userSelect: 'none',
            textTransform,
          }}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {labelText}
        </text>
      )}
    </>
  );
};

// Define custom edge types
const edgeTypesConfig: EdgeTypes = {
  'custom-edge': CustomEdge,
};

// Default edge styling options for all edges
const defaultEdgeOptions = {
  type: 'custom-edge',
  animated: false,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    // Do not set color here - we'll use CSS to match the edge color
  },
  // Make sure we don't overwrite the handle selections
  updatable: false,
};

// Constants for compound node layout - can be tuned
const COMPOUND_NODE_PADDING_X_VIEW = 50; // Increased from 40 for more space
const COMPOUND_NODE_PADDING_Y_VIEW = 50; // Increased from 40 for more space
const AVG_RANKSEP_VIEW = 100; // Increased from 80 for more vertical separation
const AVG_NODESEP_VIEW = 120;  // Increased from 80 for more horizontal separation

// Add the port selection helper function
const pickOptimalPorts = (
  nodes: FlowNode[],  
  edges: FlowEdge[]
): FlowEdge[] => {
  // Use the implementation from edgeUtils.ts
  const optimizedEdges = getOptimalHandles(nodes, edges);
  return optimizedEdges;
};

const getLayoutedElements = (nodes: FlowNode[], edges: FlowEdge[], direction = 'TB') => {
  // Create a new Dagre graph instance for each layout to ensure a clean state
  // Enable compound mode for Dagre to potentially handle top-level parent layouts
  const dagreGraphInstance = new dagre.graphlib.Graph({ compound: true }); 
  dagreGraphInstance.setDefaultEdgeLabel(() => ({}));

  // Increase nodesep to encourage more horizontal spacing between nodes
  dagreGraphInstance.setGraph({ 
    rankdir: direction, 
    ranksep: AVG_RANKSEP_VIEW, 
    nodesep: AVG_NODESEP_VIEW, 
    marginx: COMPOUND_NODE_PADDING_X_VIEW, 
    marginy: COMPOUND_NODE_PADDING_Y_VIEW / 2,
    compound: true, // Ensure compound is enabled in graph settings
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
    let width = 208; // Default width
    let height = 112; // Default height

    // Use calculated dimensions for parent containers, otherwise use type-specific defaults
    if (node.data?.isParentContainer && node.data?.calculatedWidth && node.data?.calculatedHeight) {
      width = node.data.calculatedWidth;
      height = node.data.calculatedHeight;
    } else {
      // Type-specific default sizes for non-parent nodes or parents without pre-calculated sizes
      if (node.type === 'trigger') { width = 208; height = 112; }
      else if (node.type === 'step') { width = 240; height = 80; } // StepNode default
      else if (node.type === 'end') { width = 208; height = 112; }
      else if (node.type === 'decision') { width = 208; height = 104; }
      else if (node.type === 'loop') { width = 240; height = 80; } // LoopNode default
    }

    if (node.id) {
      dagreGraphInstance.setNode(node.id, { width, height, label: node.data?.label || node.id });
    }
  });
  
  // Inform Dagre about parent-child relationships among non-child nodes (top-level parents)
  nonChildNodes.forEach((node) => {
    if (node.parentNode && dagreGraphInstance.hasNode(node.parentNode) && dagreGraphInstance.hasNode(node.id)) {
      // Ensure the parent is also a non-child node (i.e., part of Dagre's layout scope)
      // This condition is implicitly met as we are iterating over nonChildNodes
      // and checking if node.parentNode is in dagreGraphInstance (which only contains nonChildNodes).
      dagreGraphInstance.setParent(node.id, node.parentNode);
    }
  });

  // Add edges for Dagre layout.
  // Edges involving manually positioned children (childNodeIds) are excluded from Dagre's layout.
  // Dagre will only layout edges between nodes it directly manages (nonChildNodes).
  edges.forEach((edge) => {
    if (edge.source && edge.target &&
        dagreGraphInstance.hasNode(edge.source) && // Source is a Dagre-managed node
        dagreGraphInstance.hasNode(edge.target) && // Target is a Dagre-managed node
        !childNodeIds.has(edge.source) &&          // Source is not a manually positioned child
        !childNodeIds.has(edge.target)             // Target is not a manually positioned child
    ) {
      dagreGraphInstance.setEdge(edge.source, edge.target);
      // layoutEdges.push(edge); // Not strictly needed if we use all 'enhancedEdges' later
    }
  });

  // Run the Dagre layout
  try {
    dagre.layout(dagreGraphInstance);
  } catch (error) {
    console.error('Dagre layout error:', error);
    return { nodes, edges }; // Return nodes/edges without layout if error occurs
  }

  // Enhance edges with additional metadata for better visualization
  const enhancedEdges = edges.map(edge => {
    // Find source and target nodes to determine relationship type
    const sourceNode = nodes.find(node => node.id === edge.source);
    const targetNode = nodes.find(node => node.id === edge.target);
    
    if (!sourceNode || !targetNode) {
      return edge;
    }
    
    // Add metadata based on node types and edge properties
    const isFromDecision = sourceNode?.type === 'decision';
    const isToDecision = targetNode?.type === 'decision';
    const isConditionEdge = !!edge.label || isFromDecision;
    
    // Check for parent-child relationships
    const isSourceChildNode = !!sourceNode?.parentNode;
    const isTargetChildNode = !!targetNode?.parentNode;
    
    // Explicitly determine connection type early
    const connectionType = getConnectionType(sourceNode, targetNode, edge);
    
    // Get edge type based on the flow semantics
    let edgeType: string = edge.type || 'custom-edge';
    
    // Add additional data for the custom edge renderer
    return {
      ...edge,
      type: edgeType,
      data: {
        ...edge.data,
        connectionType, // Explicitly set connection type
        fromDecision: isFromDecision,
        toDecision: isToDecision,
        condition: isConditionEdge,
        sourceType: sourceNode?.type,
        targetType: targetNode?.type,
        label: edge.label,
        // Add parent-child relationship data
        isSourceChildNode,
        isTargetChildNode,
        sourceParentNode: sourceNode?.parentNode,
        targetParentNode: targetNode?.parentNode,
      },
    };
  });

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
    
    // Define sizes for child nodes - ensure exact match with StepNode component
    const childWidth = 220; // Must match the width defined in StepNode.tsx
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
    
    // Position each child node
    children.forEach((childNode, index) => {
      const row = Math.floor(index / maxChildrenPerRow);
      const col = index % maxChildrenPerRow;

      // Calculate the initial offset to center the child nodes within the parent
      // Use a default offset for all parent container types
      const initialXOffset = (parentNode.data.isParentContainer) ? 60 : 0;
      const initialYOffset = (parentNode.data.isParentContainer) ? 80 : 0;
      
      // For decision nodes, adjust position to account for diamond shape (already handled below)
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
          boxShadow: '0 2px 6px rgba(0,0,0,0.1)', // Add subtle shadow for depth
          borderRadius: '8px', // Match the parent container's rounded corners
        }
      };
      
      childNodes.push(layoutedChildNode);
    });
    
    // Increase parent node size to accommodate children if needed, for all parent container types
    if (parentNode.data.isParentContainer) {
      // Use generalized initial offsets for parent resizing calculations
      const parentInitialXOffset = (parentNode.data.isParentContainer) ? 60 : 0;
      const parentInitialYOffset = (parentNode.data.isParentContainer) ? 80 : 0;
      
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
      
      // Update the node in the positionedNodesById map
      positionedNodesById[parentNodeId] = parentNode;
    }
  });

  // Combine the layout results
  const allLayoutedNodes = [...layoutedNodes, ...childNodes];

  // When applying the layout, adjust position to encourage more horizontal spacing
  const nodesWithHorizontalVariance = allLayoutedNodes.map(node => {
    // For non-special nodes, slightly adjust position to add horizontal variance
    if (!node.parentNode && node.type !== 'decision' && node.type !== 'trigger' && node.type !== 'end') {
      const randomHorizontalOffset = Math.random() * 40 - 20; // -20 to +20 pixels
      return {
        ...node,
        position: {
          x: node.position.x + randomHorizontalOffset,
          y: node.position.y
        }
      };
    }
    return node;
  });
  
  // Optimize edge port selection using helper function
  const optimizedEdges = pickOptimalPorts(nodesWithHorizontalVariance, enhancedEdges);

  return { 
    nodes: nodesWithHorizontalVariance, 
    edges: optimizedEdges
  };
};

const getAllDescendantIds = (nodeId: string, allNodes: FlowNode<AppSOPNode>[]): string[] => {
  const descendants: string[] = [];
  
  const nodeToCheck = allNodes.find(n => n.id === nodeId);
  if (!nodeToCheck) return descendants;
  
  const childNodes = allNodes.filter(n => n.parentNode === nodeId);
  
  childNodes.forEach(child => {
    descendants.push(child.id);
    // Recursively add descendants of this child
    descendants.push(...getAllDescendantIds(child.id, allNodes));
  });
  
  return descendants;
};

/**
 * Shifts child nodes vertically to account for parent node headers
 * and prevents them from being positioned in the header area.
 * 
 * @param nodes The array of nodes to process
 * @param headerHeights Optional map of parent node IDs to their header heights
 * @returns A new array of nodes with adjusted positions
 */
const withHeaderOffset = (
  nodes: FlowNode[], 
  headerHeights: Record<string, number> = {}
): FlowNode[] => {
  // Default header height if not specified for a particular parent
  const DEFAULT_HEADER_HEIGHT = 60;
  
  return nodes.map(node => {
    // Only process child nodes
    if (!node.parentNode) return node;
    
    // Get the header height for this node's parent
    const headerHeight = headerHeights[node.parentNode] || DEFAULT_HEADER_HEIGHT;
    
    // Create a new node with adjusted position and extent
    return {
      ...node,
      position: {
        ...node.position,
        y: Math.max(node.position.y, 0) + headerHeight
      },
      // Set extent to prevent dragging into the header area
      extent: [
        [0, headerHeight], 
        [Infinity, Infinity]
      ]
    };
  });
};

/**
 * Helper function to get header heights based on node type and display state.
 * Can be extended to handle more complex logic as needed.
 */
const getHeaderHeights = (nodes: FlowNode[]): Record<string, number> => {
  const headerHeights: Record<string, number> = {};
  
  nodes.forEach(node => {
    if (node.data?.childNodes?.length || node.data?.childSopNodeIds?.length) {
      // Default header height
      let headerHeight = 60;
      
      // Adjust based on node type
      if (node.data.isParentContainer) { // Ensure we only assign header heights to parent containers
        let determinedHeaderHeight = 60; // Default parent header height
        switch (node.type) {
          case 'loop':
            // For loop nodes, header height depends on display state
            if (node.data?.isExpanded === false) {
              // Collapsed state - just the header
              determinedHeaderHeight = 45;
            } else {
              // Expanded state - header + content area (varies based on content)
              const hasIntent = !!node.data?.intent;
              const hasContext = !!node.data?.context;
              // Base header (45px) + content area based on content
              determinedHeaderHeight = 45 + (hasIntent || hasContext ? 75 : 30);
            }
            break;
          case 'step': // New case for StepNode as parent
            // Assuming StepNode parents have a fixed header height for now
            determinedHeaderHeight = 60; // Or any other specific value, e.g., 70
            break;
          case 'decision':
            determinedHeaderHeight = 70; // Decision nodes have taller headers
            break;
          default:
            determinedHeaderHeight = 60; // Default for other parent node types
        }
        headerHeights[node.id] = determinedHeaderHeight;
      }
    }
  });
  
  return headerHeights;
};

interface SOPFlowViewProps {
  sopData: SOPDocument; // This will be the processedSopData from the page
}

const SOPFlowView: React.FC<SOPFlowViewProps> = ({ sopData }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState<any[]>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  // Add detection of complex SOPs
  const [isComplexSOP, setIsComplexSOP] = useState<boolean>(false);
  // Add state for layout direction
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');
  // Add state for node selection and editing
  const [selectedNode, setSelectedNode] = useState<FlowNode<SOPNode> | null>(null);
  const [showNodeEditor, setShowNodeEditor] = useState<boolean>(false);
  const [isAdvancedMode, setIsAdvancedMode] = useState<boolean>(false);
  // Add ref for the ReactFlow wrapper
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);

  // Create a safe onNodesChange handler that maintains the header offset
  const safeOnNodesChange = useCallback((changes: NodeChange[]) => {
    // Process position changes to ensure children don't go into parent headers
    const safeChanges = changes.map(change => {
      // Check if this is a position change for a child node
      if (change.type === 'position' && change.position) {
        // Find the node being moved to check if it has a parent
        const nodeBeingMoved = nodes.find(node => node.id === change.id);
        if (nodeBeingMoved?.parentNode) {
          // Get the header height for this node's parent - dynamic calculation
          const parentNode = nodes.find(n => n.id === nodeBeingMoved.parentNode);
          
          // Default header height if parent not found
          let headerHeight = 60;
          
          if (parentNode) {
            // Determine header height based on parent node type and state
            if (parentNode.data.isParentContainer) { // Check if the parent is indeed a container
              switch (parentNode.type) {
                case 'loop':
                  // For loop nodes, header depends on state
                  if (parentNode.data && typeof parentNode.data === 'object' && 'isExpanded' in parentNode.data && parentNode.data.isExpanded === false) {
                    headerHeight = 45; // Collapsed - just header
                  } else {
                    // Expanded - header + content
                    const hasIntent = parentNode.data && typeof parentNode.data === 'object' && 'intent' in parentNode.data && !!parentNode.data.intent;
                    const hasContext = parentNode.data && typeof parentNode.data === 'object' && 'context' in parentNode.data && !!parentNode.data.context;
                    headerHeight = 45 + (hasIntent || hasContext ? 75 : 30);
                  }
                  break;
                case 'step': // New case for StepNode as parent
                  headerHeight = 60; // Consistent with getHeaderHeights
                  break;
                case 'decision':
                  headerHeight = 70; // Decision nodes have taller headers
                  break;
                default:
                  headerHeight = 60; // Default for other parent types
              }
            }
          }
          
          // Ensure y position is at least the header height if it's a child of a parent container
          return {
            ...change,
            position: {
              ...change.position,
              y: Math.max(change.position.y, headerHeight)
            }
          };
        }
      }
      return change;
    });
    
    // Apply the safe changes
    onNodesChange(safeChanges);
  }, [onNodesChange, nodes]);

  // Add handler for toggling layout direction
  const toggleLayoutDirection = useCallback(() => {
    setLayoutDirection(prev => prev === 'TB' ? 'LR' : 'TB');
  }, []);
  
  // Modified handler for node selection
  const handleNodeClick = useCallback((event: React.MouseEvent, node: FlowNode) => {
    // Check if this is an open-immediately click from our Edit button in StepNode
    const shouldOpenEditor = event.currentTarget.getAttribute('data-open-editor') === 'true';
    
    // Clear previous selection highlights
    const prevHighlights = document.querySelectorAll('.node-selected-highlight');
    prevHighlights.forEach(el => el.remove());
    
    const prevButtons = document.querySelectorAll('.node-expand-button');
    prevButtons.forEach(el => el.remove());
    
    // Set the selected node in state
    setSelectedNode(node);
    
    // If we should open the editor immediately, do so
    if (shouldOpenEditor) {
      setShowNodeEditor(true);
      return; // Skip adding highlight and expand button
    } else {
      setShowNodeEditor(false);
    }
    
    // Find the DOM element for the clicked node
    const nodeElement = document.querySelector(`[data-id="${node.id}"]`);
    if (!nodeElement) return;
    
    // Create and add highlight element with type-specific class
    const highlight = document.createElement('div');
    highlight.className = `node-selected-highlight ${node.type || 'step'}`;
    nodeElement.appendChild(highlight);
    
    // Create and add expand button
    const expandButton = document.createElement('button');
    expandButton.className = 'node-expand-button';
    expandButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5 5L10 10M19 19L14 14M5 5H10M5 5V10M19 19H14M19 19V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    expandButton.addEventListener('click', (e) => {
      e.stopPropagation();
      handleOpenNodeEditor();
    });
    nodeElement.appendChild(expandButton);
  }, []);
  
  // Handler for opening the node editor
  const handleOpenNodeEditor = useCallback(() => {
    setShowNodeEditor(true);
  }, []);
  
  // Handler for closing the editor
  const handleCloseEditor = useCallback(() => {
    setShowNodeEditor(false);
  }, []);
  
  // Handler for deselecting node
  const handleDeselectNode = useCallback(() => {
    // Clear any selection highlights
    const highlights = document.querySelectorAll('.node-selected-highlight');
    highlights.forEach(el => el.remove());
    
    const buttons = document.querySelectorAll('.node-expand-button');
    buttons.forEach(el => el.remove());
    
    setSelectedNode(null);
    setShowNodeEditor(false);
  }, []);
  
  // Handler for toggling advanced mode
  const toggleAdvancedMode = useCallback(() => {
    setIsAdvancedMode(prev => !prev);
  }, []);
  
  // Handler for saving edited node data
  const handleSaveNodeData = useCallback((nodeId: string, updatedData: Partial<SOPNode>) => {
    // Update the node in the local state
    setNodes(currentNodes => 
      currentNodes.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...updatedData
            }
          };
        }
        return node;
      })
    );
    
    // In a real implementation, we would update the sopData state via an API call
    // and then re-fetch or update the parent component's state
  }, [setNodes]);

  useEffect(() => {
    if (sopData && sopData.public) {
      // Check if this is a complex SOP (like mocksop.json)
      const hasComplexStructure = sopData.public.edges?.some(edge => 
        edge.source === 'L1_C9_A1_set_last_interaction_date' && edge.target === 'L1_process_emails'
      );
      
      setIsComplexSOP(hasComplexStructure);

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
        layoutDirection // Use the current layout direction
      );
      
      // Get dynamic header heights based on node types and states
      const headerHeights = getHeaderHeights(layoutedNodes);
      
      // Apply header offset to prevent child nodes from overlapping with parent headers
      const offsettedNodes = withHeaderOffset(layoutedNodes, headerHeights);
      
      setNodes(offsettedNodes);
      setEdges(layoutedEdges);
    } else {
      setNodes([]);
      setEdges([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopData, handleToggleCollapse, layoutDirection]); // Add layoutDirection as dependency

  if (!sopData) {
    return <div className="flex items-center justify-center h-full"><p className="text-muted-foreground">Loading diagram data...</p></div>;
  }

  return (
    <div style={{ height: '100%', width: '100%', minHeight: '500px' }} data-testid="sop-flow-view" ref={reactFlowWrapper}> 
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
          onNodesChange={safeOnNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypesConfig}
          edgeTypes={edgeTypesConfig}
          defaultEdgeOptions={defaultEdgeOptions}
          elementsSelectable={true}
          connectionLineType={ConnectionLineType.SmoothStep}
          onNodeClick={handleNodeClick}
          onPaneClick={handleDeselectNode}
          onInit={setReactFlowInstance}
          fitView
          fitViewOptions={{ 
            padding: 0.2,
            minZoom: 0.4,
            maxZoom: 1.6
          }}
          minZoom={0.2}
          maxZoom={2}
          defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
          className={`bg-neutral-100 ${reactFlowCustomStyles}`}
          onEdgeMouseEnter={(event, edge) => {
            // Highlight edge on hover
            const edgeElement = document.querySelector(`[data-testid="rf__edge-${edge.id}"] path`);
            if (edgeElement) {
              edgeElement.setAttribute('stroke-width', '3');
            }
          }}
          onEdgeMouseLeave={(event, edge) => {
            // Restore normal edge width on mouse leave
            const edgeElement = document.querySelector(`[data-testid="rf__edge-${edge.id}"] path`);
            if (edgeElement) {
              const originalWidth = edge.data?.condition ? '2' : '1.5';
              edgeElement.setAttribute('stroke-width', originalWidth);
            }
          }}
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
            showZoom={true}
            showFitView={true}
            fitViewOptions={{ padding: 0.2 }}
          />
          
          {/* Layout direction control */}
          <button 
            onClick={toggleLayoutDirection}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              cursor: 'pointer',
              zIndex: 10,
            }}
          >
            {layoutDirection === 'TB' ? 'Switch to Horizontal Layout' : 'Switch to Vertical Layout'}
          </button>
          
          {/* Path type legend */}
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px',
              display: 'flex',
              gap: '10px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              zIndex: 5,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '2px', background: '#15803d' }}></div>
              <span>Yes</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '2px', background: '#b91c1c', borderTop: '1px dashed #b91c1c' }}></div>
              <span>No</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div style={{ width: '12px', height: '2px', background: '#0284c7' }}></div>
              <span>Next</span>
            </div>
          </div>
          
          {/* ID system explanation - move when in horizontal layout */}
          <div
            style={{
              position: 'absolute',
              top: layoutDirection === 'TB' ? '10px' : '60px',
              right: '10px',
              padding: '8px 12px',
              background: 'rgba(255, 255, 255, 0.9)',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px',
              boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
              zIndex: 5,
              maxWidth: '250px',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>ID Reference</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div>[2] Main Process</div>
              <div>[2.1] First Step</div>
              <div>[2.3Y] Yes Path from Decision</div>
              <div>[2.3N] No Path from Decision</div>
            </div>
          </div>
          
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
          
          {/* Only show the editor when explicitly opened */}
          {selectedNode && showNodeEditor && (
            <ExpandedNodeEditor
              selectedNode={selectedNode}
              isAdvancedMode={isAdvancedMode}
              onClose={handleCloseEditor}
              onSave={handleSaveNodeData}
            />
          )}
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export default SOPFlowView; 