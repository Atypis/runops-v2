'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  ConnectionLineType,
  getBezierPath,
  EdgeProps,
  EdgeMarker
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
  data
}) => {
  // Determine edge path type and color based on connection
  const isYesPath = data?.condition && (data?.label?.toLowerCase() === 'yes' || data?.label?.toLowerCase() === 'true');
  const isNoPath = data?.condition && (data?.label?.toLowerCase() === 'no' || data?.label?.toLowerCase() === 'false');
  const isNextPath = data?.label?.toLowerCase() === 'next';
  const isTriggerPath = data?.sourceType === 'trigger';
  const isParentChildPath = data?.isParentChild === true;
  
  // Get decision path information
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
  
  // Set line styles based on path type
  const strokeWidth = isYesPath || isNoPath ? 2 : 
                     isNextPath ? 1.7 : 
                     isParentChildPath ? 1.3 :
                     data?.condition ? 1.8 : 1.5;
                     
  const dashArray = isNoPath ? '5,5' : 
                   isParentChildPath ? '3,3' : 
                   undefined; // Dashed lines for specific path types
  
  const isDecisionEdge = data?.fromDecision || source.includes('decision') || source.includes('Airtable_Record_Exists');
  const isLongPath = Math.abs(targetX - sourceX) > 300 || Math.abs(targetY - sourceY) > 300;
  
  // Calculate curvature based on edge type
  const curvature = isLongPath ? 0.3 : 
                   isYesPath ? 0.3 : 
                   isNoPath ? 0.5 : 
                   isNextPath ? 0.2 :
                   isParentChildPath ? 0.1 :
                   isDecisionEdge ? 0.4 : 0.2;
  
  // Use a lower curvature for side connections (horizontal)
  const isSideConnection = sourcePosition === Position.Left || sourcePosition === Position.Right;
  const effectiveCurvature = isSideConnection ? 0.1 : curvature;
  
  // Adjust source and target points to better connect to the handles
  let adjustedSourceX = sourceX;
  let adjustedSourceY = sourceY;
  let adjustedTargetX = targetX;
  let adjustedTargetY = targetY;
  
  // Offset the source and target points to start/end at the edge of the handle
  // This makes arrows connect visually to the handle edge
  if (sourcePosition === Position.Left) {
    adjustedSourceX += 3;
  } else if (sourcePosition === Position.Right) {
    adjustedSourceX -= 3;
  } else if (sourcePosition === Position.Top) {
    adjustedSourceY += 3;
  } else if (sourcePosition === Position.Bottom) {
    adjustedSourceY -= 3;
  }
  
  if (targetPosition === Position.Left) {
    adjustedTargetX += 3;
  } else if (targetPosition === Position.Right) {
    adjustedTargetX -= 3;
  } else if (targetPosition === Position.Top) {
    adjustedTargetY += 3;
  } else if (targetPosition === Position.Bottom) {
    adjustedTargetY -= 3;
  }
  
  // Add horizontal offset to separate parallel paths if they're going vertically
  let offsetX = 0;
  if (!isSideConnection) {
    const offsetDirection = (sourceX < targetX) ? 1 : -1;
    
    if (isDecisionEdge) {
      offsetX = offsetDirection * 25;
    } else if (isYesPath) {
      offsetX = offsetDirection * 15;
    } else if (isNoPath) {
      offsetX = offsetDirection * 30;
    } else if (isNextPath) {
      offsetX = offsetDirection * 8;
    }
  }
  
  // Generate edge path using getBezierPath
  const [edgePath] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    sourcePosition,
    targetX: adjustedTargetX - offsetX,
    targetY: adjustedTargetY,
    targetPosition,
    curvature: effectiveCurvature,
  });

  // Calculate optimal label position
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2 - 10;
  
  // Log handle usage in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log(`Edge ${id}: source=${source}, target=${target}, sourcePos=${sourcePosition}, targetPos=${targetPosition}`);
  }
  
  // Determine label text color and style based on path type
  const textColor = isYesPath ? '#15803d' : 
                   isNoPath ? '#b91c1c' : 
                   isNextPath ? '#0284c7' :
                   isTriggerPath ? '#ca8a04' :
                   isDecisionEdge ? '#7c3aed' : '#475569';
  
  const textFontWeight = (isYesPath || isNoPath) ? 600 : 
                        isNextPath ? 500 :
                        isDecisionEdge ? 500 : 400;
  
  // Add visual emphasis for important paths
  const textTransform = (isYesPath || isNoPath) ? 'uppercase' : 'none';
  
  return (
    <>
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
      
      {/* CSS trick - add a mask/shadow element that overlaps where arrow meets handle */}
      <circle
        cx={targetPosition === Position.Left ? targetX + 2 : 
            targetPosition === Position.Right ? targetX - 2 : 
            targetX}
        cy={targetPosition === Position.Top ? targetY + 2 : 
            targetPosition === Position.Bottom ? targetY - 2 : 
            targetY}
        r={4}
        fill="white"
        opacity={0.85}
        style={{ pointerEvents: 'none' }}
      />
      
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

// Initialize dagre graph instance (globally or outside component if preferred for stability)
// const dagreGraph = new dagre.graphlib.Graph({ compound: true }); // Keep this commented or remove
// dagreGraph.setDefaultEdgeLabel(() => ({})); // Keep this commented or remove

// Add the port selection helper function
const pickOptimalPorts = (
  nodes: FlowNode[],  
  edges: FlowEdge[]
): FlowEdge[] => {
  // Create a lookup map of node positions by ID
  const nodePositions = new Map(nodes.map(node => [node.id, node.position]));
  
  // For each edge, determine the optimal source and target handles
  return edges.map(edge => {
    const sourcePos = nodePositions.get(edge.source);
    const targetPos = nodePositions.get(edge.target);
    
    // Skip if we don't have positions for both nodes
    if (!sourcePos || !targetPos) {
      return edge;
    }
    
    // Calculate the delta between nodes
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    
    // Determine whether the arrangement is more horizontal or vertical
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    
    let sourceHandle, targetHandle;
    let sourcePosition, targetPosition;
    
    // Special case for decision edges - they always go top/bottom
    const isDecisionEdge = edge.data?.fromDecision || 
                          edge.source.includes('decision') || 
                          edge.source.includes('Airtable_Record_Exists');
    const isYesPath = edge.data?.condition && (edge.data?.label?.toLowerCase() === 'yes' || edge.data?.label?.toLowerCase() === 'true');
    const isNoPath = edge.data?.condition && (edge.data?.label?.toLowerCase() === 'no' || edge.data?.label?.toLowerCase() === 'false');
                          
    // Decision node Yes/No paths always use top/bottom to maintain the yes/no pattern
    if (isDecisionEdge && (isYesPath || isNoPath)) {
      // From decision nodes, we'll use bottom to target's top
      sourceHandle = 'bottom';
      targetHandle = 'top';
      sourcePosition = Position.Bottom;
      targetPosition = Position.Top;
    } else if (isHorizontal) {
      // For horizontal arrangements, use the left/right handles
      if (dx > 0) {
        // Target is to the right of source
        sourceHandle = 'right';
        targetHandle = 'left';
        sourcePosition = Position.Right;
        targetPosition = Position.Left;
      } else {
        // Target is to the left of source
        sourceHandle = 'left';
        targetHandle = 'right';
        sourcePosition = Position.Left;
        targetPosition = Position.Right;
      }
    } else {
      // For vertical arrangements, use the top/bottom handles
      if (dy > 0) {
        // Target is below source
        sourceHandle = 'bottom';
        targetHandle = 'top';
        sourcePosition = Position.Bottom;
        targetPosition = Position.Top;
      } else {
        // Target is above source
        sourceHandle = 'top';
        targetHandle = 'bottom';
        sourcePosition = Position.Top;
        targetPosition = Position.Bottom;
      }
    }
    
    // Return the updated edge with optimal handle settings
    return {
      ...edge,
      sourceHandle,
      targetHandle,
      sourcePosition,
      targetPosition
    };
  });
};

const getLayoutedElements = (nodes: FlowNode[], edges: FlowEdge[], direction = 'TB') => {
  // Create a new Dagre graph instance for each layout to ensure a clean state
  const dagreGraphInstance = new dagre.graphlib.Graph();  // REMOVE compound: true to avoid Dagre errors
  dagreGraphInstance.setDefaultEdgeLabel(() => ({}));

  // Reset graph by removing all nodes and edges before new layout
  // dagreGraph.nodes().forEach(nodeId => dagreGraph.removeNode(nodeId)); // No longer needed with new instance

  // Increase nodesep to encourage more horizontal spacing between nodes
  dagreGraphInstance.setGraph({ 
    rankdir: direction, 
    ranksep: AVG_RANKSEP_VIEW, 
    nodesep: AVG_NODESEP_VIEW, 
    marginx: COMPOUND_NODE_PADDING_X_VIEW, // Increased for more horizontal space 
    marginy: COMPOUND_NODE_PADDING_Y_VIEW / 2,
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

  // Enhance edges with additional metadata for better visualization
  const enhancedEdges = edges.map(edge => {
    // Find source and target nodes to determine relationship type
    const sourceNode = nodes.find(node => node.id === edge.source);
    const targetNode = nodes.find(node => node.id === edge.target);
    
    // Add metadata based on node types and edge properties
    const isFromDecision = sourceNode?.type === 'decision';
    const isToDecision = targetNode?.type === 'decision';
    const isConditionEdge = !!edge.label || isFromDecision;
    
    // Get edge type based on the flow semantics
    let edgeType: string = edge.type || 'custom-edge';
    
    // Add additional data for the custom edge renderer
    return {
      ...edge,
      type: edgeType,
      data: {
        ...edge.data,
        fromDecision: isFromDecision,
        toDecision: isToDecision,
        condition: isConditionEdge,
        sourceType: sourceNode?.type,
        targetType: targetNode?.type,
        label: edge.label,
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
  
  // Apply the port selection helper to optimize handle choices
  const optimizedEdges = pickOptimalPorts(nodesWithHorizontalVariance, enhancedEdges);
  
  return { 
    nodes: nodesWithHorizontalVariance, 
    edges: optimizedEdges
  };
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

  // Add handler for toggling layout direction
  const toggleLayoutDirection = useCallback(() => {
    setLayoutDirection(prev => prev === 'TB' ? 'LR' : 'TB');
  }, []);
  
  // Modified handler for node selection
  const handleNodeClick = useCallback((event: React.MouseEvent, node: FlowNode) => {
    // Clear previous selection highlights
    const prevHighlights = document.querySelectorAll('.node-selected-highlight');
    prevHighlights.forEach(el => el.remove());
    
    const prevButtons = document.querySelectorAll('.node-expand-button');
    prevButtons.forEach(el => el.remove());
    
    // Set the selected node in state
    setSelectedNode(node);
    setShowNodeEditor(false);
    
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
    console.log('Saving node data:', nodeId, updatedData);
    
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
    
    // Mock API call - in a real implementation, this would call an API
    console.log('Mock API call to save node data:', {
      id: nodeId,
      updates: updatedData
    });
    
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
        layoutDirection // Use the current layout direction
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);

    } else {
      setNodes([]);
      setEdges([]);
      setExpandedNodes({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sopData, handleToggleCollapse, layoutDirection]); // Add layoutDirection as dependency

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
        layoutDirection // Use the current layout direction
      );
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }
  }, [sopData, expandedNodes, handleToggleCollapse, setNodes, setEdges, layoutDirection]); // Add layoutDirection as dependency

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
          onNodesChange={onNodesChange}
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