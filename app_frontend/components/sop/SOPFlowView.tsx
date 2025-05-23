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
  
  /* CRITICAL FIX: Elevate edges above container backgrounds */
  .react-flow__edge {
    z-index: 4 !important; /* Above container backgrounds (z-index: 1) but below node content */
  }
  
  /* Extra elevation for edges involving child nodes */
  .react-flow__edge[data-involves-child="true"] {
    z-index: 6 !important; /* Even higher for nested child edges */
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
  const strokeColor = isYesPath ? '#059669' :   // Darker green for "yes" paths (was #15803d)
                     isNoPath ? '#dc2626' :    // Darker red for "no" paths (was #b91c1c)
                     isNextPath ? '#0369a1' :  // Darker blue for "next" paths (was #0284c7)
                     isTriggerPath ? '#d97706' : // Darker orange for trigger paths (was #f59e0b)
                     isParentChildPath ? '#4f46e5' : // Darker indigo for parent-child relationships (was #6366f1)
                     data?.condition ? '#6b21a8' : // Darker purple for other conditions (was #7c3aed)
                     '#475569'; // Darker gray for standard flow (unchanged)
  
  // Line styles based on path type
  const strokeWidth = isYesPath || isNoPath ? 3 : // Increased from 2 for better visibility
                     isNextPath ? 2.5 : // Increased from 1.7 for better visibility
                     isParentChildPath ? 2 : // Increased from 1.3 for better visibility
                     data?.condition ? 2.5 : // Increased from 1.8 for better visibility
                     2; // Increased from 1.5 for better visibility (default)
                     
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
        data-involves-child={data?.involvesChild ? 'true' : 'false'}
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

// Initialize dagre graph instance (globally or outside component if preferred for stability)
// const dagreGraph = new dagre.graphlib.Graph({ compound: true }); // Keep this commented or remove
// dagreGraph.setDefaultEdgeLabel(() => ({})); // Keep this commented or remove

// Add the port selection helper function
const pickOptimalPorts = (
  nodes: FlowNode[],  
  edges: FlowEdge[]
): FlowEdge[] => {
  // Use the implementation from edgeUtils.ts
  const optimizedEdges = getOptimalHandles(nodes, edges);
  return optimizedEdges;
};

/**
 * Calculate dynamic header height based on parent node type and content data
 * This replaces DOM-based measurements with data-driven calculations to avoid timing issues
 */
const calculateDynamicHeaderHeight = (
  children: FlowNode[],
  currentDepth: number,
  parentWidthRatio: number,
  parentNodeId?: string  // Add optional parent node ID to look up node data
): number => {
  console.log(`[HEADER-HEIGHT-CALC] Starting calculation for ${parentNodeId || 'unknown'}`);
  console.log(`  - Current depth: ${currentDepth}`);
  console.log(`  - Parent width ratio: ${parentWidthRatio}`);
  console.log(`  - Children count: ${children.length}`);
  
  // For root level containers (loops), calculate height from data instead of DOM measurements
  if (currentDepth === 1 && parentNodeId) {
    console.log(`  - Root level container, calculating from data...`);
    
    // More accurate estimation based on actual LoopNode structure:
    // - Header row: ~45px (px-3 py-2.5 with icon and buttons)
    // - Intent/context section: ~60px (px-4 py-3 with text content)
    // - Metrics section: ~35px (mt-3 with icons and text)
    // - Child container paddingTop: ~20px (not containerPadding of 50px!)
    
    let estimatedHeaderHeight: number;
    
    if (children.length > 0) {
      // Loop with children: header + intent/context + metrics + actual padding
      estimatedHeaderHeight = 45 + 60 + 35 + 20; // = 160px
    } else {
      // Loop without children: header + intent/context + padding (no metrics)
      estimatedHeaderHeight = 45 + 60 + 20; // = 125px
    }
    
    console.log(`  - Estimated content height: ${estimatedHeaderHeight}px (based on children: ${children.length > 0})`);
    return estimatedHeaderHeight;
  } else {
    console.log(`  - Nested container (StepNode), using fixed height`);
    // For nested containers (StepNodes acting as containers)
    // StepNode header is smaller: ~80px total including padding
    const nestedHeight = 80;
    console.log(`  - Nested height: ${nestedHeight}px`);
    return nestedHeight;
  }
};

/**
 * Calculate the actual required height for a container based on its positioned children
 */
const calculateActualContainerHeight = (
  positionedChildren: FlowNode[],
  headerHeight: number,
  containerPadding: number
): number => {
  if (!positionedChildren || positionedChildren.length === 0) {
    return headerHeight + (containerPadding * 2) + 60; // Minimum height
  }
  
  // Find the bottom-most child (Y position is relative to container top)
  let maxChildBottom = 0;
  
  positionedChildren.forEach(child => {
    const childY = child.position.y;
    const childHeight = child.data?.calculatedHeight || 100; // Default node height
    const childBottom = childY + childHeight;
    
    maxChildBottom = Math.max(maxChildBottom, childBottom);
  });
  
  // Total height = bottom-most child position + generous bottom padding
  // Add extra padding to ensure no overlap with subsequent nodes
  const extraBottomPadding = 40; // Increased from 20 to 40 for more clearance
  const totalHeight = maxChildBottom + containerPadding + extraBottomPadding;
  
  console.log(`[HEIGHT] Container height: ${totalHeight}px (max child bottom: ${maxChildBottom}px + ${containerPadding + extraBottomPadding}px padding)`);
  
  // Ensure minimum reasonable height
  const minimumHeight = headerHeight + 150; // Increased minimum height
  return Math.max(totalHeight, minimumHeight);
};

/**
 * Calculate child container width based on parent width and depth
 */
const calculateChildContainerWidth = (
  parentWidth: number, 
  currentDepth: number, 
  maxDepth: number
): number => {
  const calculatedWidth = Math.floor(parentWidth * 0.8);
  return Math.max(1, calculatedWidth);
};

/**
 * Simplified layout algorithm for flattened containers (tier 1 only)
 * No nested container logic needed
 */
const layoutChildrenSimple = (
  children: FlowNode[], 
  containerWidth: number,
  parentPosition: {x: number, y: number},
  actualParentPixelWidth: number,
  parentNodeId: string
): FlowNode[] => {
  console.log(`[LAYOUT-SIMPLE] Starting layout for ${parentNodeId} with ${children.length} children`);
  
  if (!children || children.length === 0) {
    return [];
  }
  
  // Grid layout constants - must match sop-utils.ts calculations
  const childNodeWidth = 200;
  const childNodeHeight = 100; // Match actual node height  
  const gridSpacingX = 60;
  const gridSpacingY = 15; // Match actual grid spacing
  const containerPadding = 20; // Inner container padding
  
  // Calculate how many columns we can fit
  const availableWidth = actualParentPixelWidth - (containerPadding * 2);
  const maxItemsPerRow = Math.max(1, Math.floor((availableWidth + gridSpacingX) / (childNodeWidth + gridSpacingX)));
  
  // Calculate header height
  const headerHeight = calculateDynamicHeaderHeight(children, 1, containerWidth, parentNodeId);
  
  // Position children in a simple grid (no container-in-container logic)
  const positioned: FlowNode[] = [];
  let currentX = containerPadding;
  let currentY = headerHeight + containerPadding;
  let itemsInCurrentRow = 0;
  
  children.forEach((child, index) => {
    // All children are treated as regular nodes now (no special container handling)
    positioned.push({
      ...child,
      position: {
        x: currentX,
        y: currentY
      }
    });
    
    console.log(`[LAYOUT-SIMPLE] Positioned ${child.id} at (${currentX}, ${currentY})`);
    
    // Move to next position
    currentX += childNodeWidth + gridSpacingX;
    itemsInCurrentRow++;
    
    // Check if we need to move to next row
    if (itemsInCurrentRow >= maxItemsPerRow) {
      currentX = containerPadding;
      currentY += childNodeHeight + gridSpacingY;
      itemsInCurrentRow = 0;
    }
  });
  
  return positioned;
};

/**
 * Recursive layout algorithm implementing the full-width container strategy from README.md
 * - Regular nodes: Follow normal grid layout (2-N per row based on container width)  
 * - Container nodes: Always span full parent width and force a new row
 * - Width inheritance: Child containers get floor(parent * 0.8) with minimum of 1
 */
const layoutChildrenWithContainers = (
  children: FlowNode[], 
  parentWidthRatio: number, // This is the container width (number of columns)
  parentPosition: {x: number, y: number}, // Not used for child positioning, just for reference
  currentDepth: number,
  maxDepth: number,
  actualParentPixelWidth?: number, // Actual pixel width of parent container
  parentNodeId?: string // Parent node ID for measuring header height
): FlowNode[] => {
  console.log(`[LAYOUT-CHILDREN] Starting layout for ${parentNodeId || 'unknown'}`);
  console.log(`  - Children count: ${children.length}`);
  console.log(`  - Parent width ratio: ${parentWidthRatio}`);
  console.log(`  - Current depth: ${currentDepth}/${maxDepth}`);
  console.log(`  - Actual parent pixel width: ${actualParentPixelWidth}`);
  console.log(`  - Parent position: ${JSON.stringify(parentPosition)}`);
  
  if (!children || children.length === 0) {
    console.log(`  - No children to layout, returning empty array`);
    return [];
  }
  
  // Grid layout constants
  const childNodeWidth = 200;
  const childNodeHeight = 100;
  const gridSpacingX = 60;
  const gridSpacingY = 15;
  const containerPadding = 20;
  
  // Use actual pixel width if provided, otherwise estimate from ratio
  const actualPixelWidth = actualParentPixelWidth || Math.max(450, parentWidthRatio * 250);
  
  // Calculate how many columns we can fit based on actual pixel width
  const availableWidth = actualPixelWidth - (containerPadding * 2);
  const maxItemsPerRow = Math.max(1, Math.floor((availableWidth + gridSpacingX) / (childNodeWidth + gridSpacingX)));
  
  // Calculate proper header height based on parent node type and content
  // LoopNode structure: header (48px) + intent/context (variable, ~40-80px) + container padding (20px)
  // CRITICAL FIX: Use currentDepth - 1 because currentDepth is the depth of children, 
  // but we need to calculate header height for the parent container
  const headerHeight = calculateDynamicHeaderHeight(children, currentDepth - 1, parentWidthRatio, parentNodeId);
  
  console.log(`[LAYOUT-CHILDREN] Header height calculated: ${headerHeight}px for ${parentNodeId}`);
  
  console.log(`[GRID] Row-based layout for ${children.length} children, max ${maxItemsPerRow} per row (width: ${actualPixelWidth}px), header: ${headerHeight}px`);
  
  // Build rows using full-width container strategy
  let currentRow: FlowNode[] = [];
  let rows: FlowNode[][] = [];
  
  children.forEach((child, index) => {
    const isContainer = child.data?.childSopNodeIds?.length > 0;
    
    if (isContainer) {
      // Container nodes force a new row
      
      // First, finish current row if it has items
      if (currentRow.length > 0) {
        rows.push([...currentRow]);
        currentRow = [];
        console.log(`[GRID] Finished row with ${currentRow.length} items before container ${child.id}`);
      }
      
      // Container gets its own full-width row
      rows.push([child]);
      console.log(`[GRID] Container ${child.id} gets full-width row`);
    } else {
      // Regular node - add to current row
      currentRow.push(child);
      
      // Check if current row is full
      if (currentRow.length >= maxItemsPerRow) {
        rows.push([...currentRow]);
        console.log(`[GRID] Completed row with ${currentRow.length} items`);
        currentRow = [];
      }
    }
  });
  
  // Don't forget the last row if it has items
  if (currentRow.length > 0) {
    rows.push(currentRow);
    console.log(`[GRID] Final row with ${currentRow.length} items`);
  }
  
  console.log(`[GRID] Created ${rows.length} rows total`);
  
  // Position all rows with proper spacing
  const positionedWithLayout = positionRowsWithVariableWidths(rows, maxItemsPerRow, actualPixelWidth, headerHeight, containerPadding, childNodeWidth, childNodeHeight, gridSpacingX, gridSpacingY, currentDepth, maxDepth);
  
  console.log(`[LAYOUT-DEBUG] Parent: ${parentNodeId}`);
  console.log(`  - Header height: ${headerHeight}px`);
  console.log(`  - Container padding: ${containerPadding}px`);
  console.log(`  - First child Y start: ${headerHeight + containerPadding}px`);
  console.log(`  - Actual first child Y: ${positionedWithLayout[0]?.position?.y || 'none'}px`);
  
  // Calculate actual required height for this container based on positioned children
  const actualContainerHeight = calculateActualContainerHeight(positionedWithLayout, headerHeight, containerPadding);
  console.log(`[GRID] Calculated actual container height: ${actualContainerHeight}px for ${children.length} children in ${rows.length} rows`);
  
  return positionedWithLayout;
};

/**
 * Position rows of nodes with variable widths (regular rows vs full-width container rows)
 */
const positionRowsWithVariableWidths = (
  rows: FlowNode[][], 
  maxItemsPerRow: number,
  containerWidth: number,
  headerHeight: number,
  containerPadding: number,
  childNodeWidth: number,
  childNodeHeight: number,
  gridSpacingX: number,
  gridSpacingY: number,
  currentDepth: number,
  maxDepth: number
): FlowNode[] => {
  const positioned: FlowNode[] = [];
  let currentY = headerHeight + containerPadding;
  
  rows.forEach((row, rowIndex) => {
    const isContainerRow = row.length === 1 && row[0].data?.childSopNodeIds?.length > 0;
    
    if (isContainerRow) {
      // Add extra spacing before container rows (except the first one)
      if (rowIndex > 0) {
        currentY += gridSpacingY; // Additional spacing before containers
      }
      
      // Full-width container row
      const container = row[0];
      
      // Set container to span full parent width
      const fullWidth = containerWidth - (containerPadding * 2);
      
      positioned.push({
        ...container,
        position: {
          x: containerPadding, // Align to left edge with padding
          y: currentY
        },
        style: {
          ...container.style,
          width: fullWidth, // Force full width spanning
          minWidth: fullWidth
        },
        data: {
          ...container.data,
          calculatedWidth: fullWidth // CRITICAL: Update data.calculatedWidth so StepNode uses correct width
        }
      });
      
      console.log(`[GRID] Positioned full-width container ${container.id} at (${containerPadding}, ${currentY}) with width ${fullWidth}px`);
      console.log(`[GRID] Set calculatedWidth to ${fullWidth}px for container ${container.id} (${container.data?.label || 'unlabeled'})`);
      
      // For containers, recursively layout their children
      if (container.data?.childSopNodeIds?.length > 0) {
        const childContainerWidth = calculateChildContainerWidth(maxItemsPerRow, currentDepth, maxDepth);
        console.log(`[GRID] Container ${container.id} will have child width: ${childContainerWidth}`);
      }
      
      // Container height is larger, use its calculated height or default
      const containerHeight = container.data?.calculatedHeight || 300; // Increased default for better spacing
      currentY += containerHeight + (gridSpacingY * 2); // Double spacing after containers
    } else {
      // Regular grid row
      let currentX = containerPadding;
      
      row.forEach((node, nodeIndex) => {
        positioned.push({
          ...node,
          position: {
            x: currentX,
            y: currentY
          }
        });
        
        console.log(`[GRID] Positioned regular node ${node.id} at (${currentX}, ${currentY})`);
        currentX += childNodeWidth + gridSpacingX;
      });
      
      currentY += childNodeHeight + gridSpacingY;
    }
  });
  
  return positioned;
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
    // Debug specific edge
    if (edge.source === 'T0_open_gmail' && edge.target === 'L1_process_emails') {
      console.log(`[EDGE-DEBUG] T0_open_gmail -> L1_process_emails:`);
      console.log(`  - source in childNodeIds: ${childNodeIds.has(edge.source)}`);
      console.log(`  - target in childNodeIds: ${childNodeIds.has(edge.target)}`);
      console.log(`  - source in nodeIds: ${nodeIds.has(edge.source)}`);
      console.log(`  - target in nodeIds: ${nodeIds.has(edge.target)}`);
    }
    
    // Only add edges between nodes that are both in the Dagre graph (non-children)
    if (edge.source && edge.target && 
        !childNodeIds.has(edge.source) && 
        !childNodeIds.has(edge.target) &&
        nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
      dagreGraphInstance.setEdge(edge.source, edge.target);
      layoutEdges.push(edge);
      
      // Debug specific edge
      if (edge.source === 'T0_open_gmail' && edge.target === 'L1_process_emails') {
        console.log(`[EDGE-DEBUG] Added T0_open_gmail -> L1_process_emails to Dagre`);
      }
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
    
    if (!sourceNode || !targetNode) {
      return edge;
    }
    
    // Debug container edges
    const sourceIsContainer = sourceNode.data?.childSopNodeIds?.length > 0;
    const targetIsContainer = targetNode.data?.childSopNodeIds?.length > 0;
    
    if (sourceIsContainer || targetIsContainer) {
      console.log(`[CONTAINER-EDGE] ${edge.source} -> ${edge.target}:`);
      console.log(`  - Source is container: ${sourceIsContainer} (${sourceNode.data?.label})`);
      console.log(`  - Target is container: ${targetIsContainer} (${targetNode.data?.label})`);
      console.log(`  - Edge label: ${edge.label || 'none'}`);
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
        // Add flag for CSS targeting
        involvesChild: isSourceChildNode || isTargetChildNode,
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

  // Get depth information from first node with container data, or use default
  const maxDepth = nodes.find(n => n.data?.maxDepth)?.data?.maxDepth || 1; // Always 1 now
  const rootContainerWidth = nodes.find(n => n.data?.containerWidth && !n.parentNode)?.data?.containerWidth || 3;
  
  // Build a map that includes all positioned nodes (will be updated as we position children)
  const allPositionedNodes = new Map<string, FlowNode>();
  layoutedNodes.forEach(node => {
    if (node.id) allPositionedNodes.set(node.id, node);
  });
  
  // Initialize array to collect all layouted nodes (including children)
  const allLayoutedNodes = [...layoutedNodes];
  
  // SIMPLIFIED: Process only tier 1 containers (no recursion needed)
  const processSimpleContainer = (parentNodeId: string): void => {
    const children = childNodesByParent[parentNodeId];
    if (!children || children.length === 0) return;
    
    const parentNode = allPositionedNodes.get(parentNodeId);
    if (!parentNode || !parentNode.position) {
      console.warn(`Parent node ${parentNodeId} not found or has no position`);
      return;
    }
    
    const containerWidth = parentNode.data?.containerWidth || rootContainerWidth;
    
    console.log(`[LAYOUT] Processing simple container ${parentNodeId} with ${children.length} children, width=${containerWidth}`);
    
    // Get the actual pixel width from the parent node's calculated dimensions
    const actualPixelWidth = parentNode.data?.calculatedWidth || 450;
    
    // Use simplified layout algorithm (no nested container logic)
    const layoutedChildren = layoutChildrenSimple(
      children,
      containerWidth,
      parentNode.position,
      actualPixelWidth,
      parentNodeId
    );
    
    // Calculate header height for this container
    const containerHeaderHeight = calculateDynamicHeaderHeight(children, 1, containerWidth, parentNodeId); // Always depth 1
    const containerPaddingValue = 50;
    
    // Apply proper positioning and parent relationships to all children
    layoutedChildren.forEach((child: FlowNode) => {
      child.parentNode = parentNodeId;
      child.targetPosition = direction === 'LR' ? Position.Left : Position.Top;
      child.sourcePosition = direction === 'LR' ? Position.Right : Position.Bottom;
      child.style = {
        ...child.style,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
        borderRadius: '8px',
      };
      
      // Add to our positioned nodes map
      if (child.id) {
        allPositionedNodes.set(child.id, child);
      }
      
      allLayoutedNodes.push(child);
    });
    
    // Update parent container height based on actual children layout
    if (layoutedChildren.length > 0) {
      const calculatedHeight = calculateActualContainerHeight(
        layoutedChildren, 
        containerHeaderHeight,
        containerPaddingValue
      );
      
      // Update the parent node with the correct height
      const updatedParent = allPositionedNodes.get(parentNodeId);
      if (updatedParent) {
        const originalHeight = updatedParent.data?.calculatedHeight;
        
        updatedParent.data = {
          ...updatedParent.data,
          calculatedHeight: calculatedHeight
        };
        updatedParent.style = {
          ...updatedParent.style,
          height: calculatedHeight
        };
        allPositionedNodes.set(parentNodeId, updatedParent);
        
        console.log(`[HEIGHT] Updated container ${parentNodeId} height: ${originalHeight}px -> ${calculatedHeight}px`);
      }
    }
  };
  
  // Process all tier 1 containers (containers that are not children themselves)
  Object.keys(childNodesByParent).forEach(parentNodeId => {
    // Only process if parent is a tier 1 container (not a child of another container)
    const parentNode = nodes.find((n: FlowNode) => n.id === parentNodeId);
    if (parentNode && !parentNode.parentNode) {
      processSimpleContainer(parentNodeId);
    }
  });

  // Apply slight horizontal variance for visual variety (non-container nodes only)
  const nodesWithVariance = allLayoutedNodes.map((node: FlowNode) => {
    if (!node.parentNode && node.type !== 'decision' && node.type !== 'trigger' && node.type !== 'end' && !node.data?.isCollapsible) {
      const randomHorizontalOffset = Math.random() * 40 - 20;
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
  
  // No height adjustments needed since we don't have nested containers
  const finalAdjustedNodes = nodesWithVariance;
  
  // Optimize edge port selection
  const optimizedEdges = pickOptimalPorts(finalAdjustedNodes, enhancedEdges);
  
  console.log(`[FINAL-EDGES] Total edges for rendering: ${optimizedEdges.length}`);
  
  // Debug specific edges
  const gmailToLoopEdge = optimizedEdges.find(e => e.source === 'T0_open_gmail' && e.target === 'L1_process_emails');
  const containerEdges = optimizedEdges.filter(e => {
    const sourceNode = finalAdjustedNodes.find(n => n.id === e.source);
    const targetNode = finalAdjustedNodes.find(n => n.id === e.target);
    return (sourceNode?.data?.childSopNodeIds?.length > 0) || (targetNode?.data?.childSopNodeIds?.length > 0);
  });
  
  console.log(`[FINAL-EDGES] Gmail to Loop edge exists: ${!!gmailToLoopEdge}`);
  console.log(`[FINAL-EDGES] Container-related edges: ${containerEdges.length}`);
  
  // Simplified logging - just confirm handles are correct now
  if (gmailToLoopEdge) {
    console.log(`[EDGE-FIX] Gmail->Loop handles: ${gmailToLoopEdge.sourceHandle} -> ${gmailToLoopEdge.targetHandle}`);
  }

  return { 
    nodes: finalAdjustedNodes, 
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
 * Enhanced to support multi-level nesting.
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
 * Enhanced to support universal container types.
 */
const getHeaderHeights = (nodes: FlowNode[]): Record<string, number> => {
  const headerHeights: Record<string, number> = {};
  
  nodes.forEach(node => {
    // Check for any node with children (universal container support)
    if (node.data?.childNodes?.length || node.data?.childSopNodeIds?.length) {
      // Default header height
      let headerHeight = 60;
      
      // Adjust based on node type
      switch (node.type) {
        case 'loop':
          // For loop nodes, header height depends on display state
          if (node.data?.isExpanded === false) {
            // Collapsed state - just the header
            headerHeight = 45;
          } else {
            // Expanded state - header + content area (varies based on content)
            const hasIntent = !!node.data?.intent;
            const hasContext = !!node.data?.context;
            
            // Base header (45px) + content area based on content
            headerHeight = 45 + (hasIntent || hasContext ? 75 : 30);
          }
          break;
          
        case 'decision':
          headerHeight = 70; // Decision nodes have taller headers
          break;
          
        case 'step':
          // Step nodes acting as containers need appropriate header space
          headerHeight = node.data?.isExpanded === false ? 50 : 90;
          break;
          
        default:
          headerHeight = 60; // Default for other node types
      }
      
      headerHeights[node.id] = headerHeight;
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
              case 'decision':
                headerHeight = 70; // Decision nodes have taller headers
                break;
              default:
                headerHeight = 60; // Default for other types
            }
          }
          
          // Ensure y position is at least the header height
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
      
      // DISABLED: Apply header offset since children are now positioned relative to parent containers
      // const offsettedNodes = withHeaderOffset(layoutedNodes, headerHeights);
      
      setNodes(layoutedNodes); // Use layoutedNodes directly without additional header offset
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