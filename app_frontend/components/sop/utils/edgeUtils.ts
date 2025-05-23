import { Position, Node as FlowNode, Edge as FlowEdge } from 'reactflow';

/**
 * Connection types based on node relationships
 */
export enum ConnectionType {
  STANDARD = 'standard',          // Regular node to regular node
  PARENT_TO_CHILD = 'parentToChild', // From parent node to a child inside another parent
  CHILD_TO_PARENT = 'childToParent', // From child node to a parent node
  CHILD_TO_CHILD_SAME = 'childToChildSame', // Between children in the same parent
  CHILD_TO_CHILD_DIFF = 'childToChildDiff', // Between children in different parents
  DECISION_PATH = 'decisionPath',  // Special case for decision paths
}

/**
 * Determines the type of connection between two nodes
 */
export const getConnectionType = (
  sourceNode: FlowNode | undefined,
  targetNode: FlowNode | undefined,
  edge: FlowEdge,
): ConnectionType => {
  if (!sourceNode || !targetNode) {
    return ConnectionType.STANDARD;
  }
  
  // Check if this is a decision edge
  const isDecisionEdge = sourceNode.type === 'decision' || 
                        (edge.data?.condition && (
                          edge.data?.label?.toLowerCase() === 'yes' || 
                          edge.data?.label?.toLowerCase() === 'no'
                        ));
  
  if (isDecisionEdge) {
    return ConnectionType.DECISION_PATH;
  }
  
  const sourceParentId = sourceNode.parentNode;
  const targetParentId = targetNode.parentNode;
  
  if (sourceParentId && targetParentId) {
    // Both nodes have parents
    return sourceParentId === targetParentId 
      ? ConnectionType.CHILD_TO_CHILD_SAME 
      : ConnectionType.CHILD_TO_CHILD_DIFF;
  } else if (sourceParentId && !targetParentId) {
    // Only source has a parent
    return ConnectionType.CHILD_TO_PARENT;
  } else if (!sourceParentId && targetParentId) {
    // Only target has a parent
    return ConnectionType.PARENT_TO_CHILD;
  }
  
  // Default case
  return ConnectionType.STANDARD;
};

/**
 * Transforms coordinates for compound nodes
 */
export const transformCoordinates = (
  sourcePos: { x: number, y: number },
  targetPos: { x: number, y: number },
  connectionType: ConnectionType,
  sourceHandle: string | null,
  targetHandle: string | null,
  sourcePosition: Position,
  targetPosition: Position,
  sourceParentNode?: string | null,
  targetParentNode?: string | null
) => {
  // Base adjustments all connections need
  let adjustedSourceX = sourcePos.x;
  let adjustedSourceY = sourcePos.y;
  let adjustedTargetX = targetPos.x;
  let adjustedTargetY = targetPos.y;
  
  // Standard offsets for handle connection points
  const handleOffset = 3;
  const childHandleOffset = 6;
  
  // Apply standard handle adjustments
  if (sourcePosition === Position.Left) {
    adjustedSourceX += handleOffset;
  } else if (sourcePosition === Position.Right) {
    adjustedSourceX -= handleOffset;
  } else if (sourcePosition === Position.Top) {
    adjustedSourceY += handleOffset;
  } else if (sourcePosition === Position.Bottom) {
    adjustedSourceY -= handleOffset;
  }
  
  if (targetPosition === Position.Left) {
    adjustedTargetX += handleOffset;
  } else if (targetPosition === Position.Right) {
    adjustedTargetX -= handleOffset;
  } else if (targetPosition === Position.Top) {
    adjustedTargetY += handleOffset;
  } else if (targetPosition === Position.Bottom) {
    adjustedTargetY -= handleOffset;
  }
  
  // Apply additional adjustments based on connection type
  switch (connectionType) {
    case ConnectionType.PARENT_TO_CHILD:
      // Connections from regular nodes to child nodes inside a parent
      if (targetPosition === Position.Top) {
        adjustedTargetY += childHandleOffset;
      } else if (targetPosition === Position.Bottom) {
        adjustedTargetY -= childHandleOffset;
      } else if (targetPosition === Position.Left) {
        adjustedTargetX += childHandleOffset;
      } else if (targetPosition === Position.Right) {
        adjustedTargetX -= childHandleOffset;
      }
      break;
      
    case ConnectionType.CHILD_TO_PARENT:
      // Connections from child nodes to regular nodes outside
      if (sourcePosition === Position.Top) {
        adjustedSourceY += childHandleOffset;
      } else if (sourcePosition === Position.Bottom) {
        adjustedSourceY -= childHandleOffset;
      } else if (sourcePosition === Position.Left) {
        adjustedSourceX += childHandleOffset;
      } else if (sourcePosition === Position.Right) {
        adjustedSourceX -= childHandleOffset;
      }
      break;
      
    case ConnectionType.CHILD_TO_CHILD_SAME:
      // Connections between children in the same parent
      const sameParentOffset = childHandleOffset / 2;
      
      if (sourcePosition === Position.Top) {
        adjustedSourceY += sameParentOffset;
      } else if (sourcePosition === Position.Bottom) {
        adjustedSourceY -= sameParentOffset;
      } else if (sourcePosition === Position.Left) {
        adjustedSourceX += sameParentOffset;
      } else if (sourcePosition === Position.Right) {
        adjustedSourceX -= sameParentOffset;
      }
      
      if (targetPosition === Position.Top) {
        adjustedTargetY += sameParentOffset;
      } else if (targetPosition === Position.Bottom) {
        adjustedTargetY -= sameParentOffset;
      } else if (targetPosition === Position.Left) {
        adjustedTargetX += sameParentOffset;
      } else if (targetPosition === Position.Right) {
        adjustedTargetX -= sameParentOffset;
      }
      break;
  }
  
  return { 
    adjustedSourceX, 
    adjustedSourceY, 
    adjustedTargetX, 
    adjustedTargetY 
  };
};

/**
 * Select optimal ports (handles) based on the relative positions
 * and types of nodes being connected
 */
export const getOptimalHandles = (
  nodes: FlowNode[],
  edges: FlowEdge[]
): FlowEdge[] => {
  // Create lookup maps for faster access
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  const parentNodeMap = new Map();
  
  // Build parent node lookup map
  nodes.forEach(node => {
    if (node.parentNode) {
      parentNodeMap.set(node.id, node.parentNode);
    }
  });
  
  return edges.map(edge => {
    const sourceNode = nodeMap.get(edge.source);
    const targetNode = nodeMap.get(edge.target);
    
    if (!sourceNode || !targetNode) {
      return edge;
    }
    
    // Get positions for calculating direction
    const sourcePos = sourceNode.position;
    const targetPos = targetNode.position;
    
    // Calculate deltas
    const dx = targetPos.x - sourcePos.x;
    const dy = targetPos.y - sourcePos.y;
    
    // Determine whether arrangement is more horizontal or vertical
    const isHorizontal = Math.abs(dx) > Math.abs(dy);
    
    // Gather relationship information
    const isSourceChildNode = !!sourceNode.parentNode;
    const isTargetChildNode = !!targetNode.parentNode;
    const connectionType = getConnectionType(sourceNode, targetNode, edge);
    
    // Special cases for different node types
    const isDecisionEdge = connectionType === ConnectionType.DECISION_PATH ||
                          sourceNode.type === 'decision';
    const isYesPath = edge.data?.condition && (
                      edge.data?.label?.toLowerCase() === 'yes' || 
                      edge.data?.label?.toLowerCase() === 'true');
    const isNoPath = edge.data?.condition && (
                     edge.data?.label?.toLowerCase() === 'no' || 
                     edge.data?.label?.toLowerCase() === 'false');
    
    // CRITICAL FIX: Force vertical connections for container nodes
    const isSourceContainer = sourceNode.type === 'loop' || (sourceNode.data as any)?.childSopNodeIds?.length > 0;
    const isTargetContainer = targetNode.type === 'loop' || (targetNode.data as any)?.childSopNodeIds?.length > 0;
    const involvesContainer = isSourceContainer || isTargetContainer;
    
    let sourceHandle, targetHandle, sourcePosition, targetPosition;
    
    switch (connectionType) {
      case ConnectionType.DECISION_PATH:
        // Decision paths (yes/no) always prefer vertical connections
        sourceHandle = 'bottom';
        targetHandle = 'top';
        sourcePosition = Position.Bottom;
        targetPosition = Position.Top;
        break;
        
      case ConnectionType.PARENT_TO_CHILD:
        // From outside to child node inside a parent - prefer top connection
        sourceHandle = 'bottom';
        targetHandle = 'top';
        sourcePosition = Position.Bottom;
        targetPosition = Position.Top;
        break;
        
      case ConnectionType.CHILD_TO_PARENT:
        // From child node to outside - prefer bottom connection
        sourceHandle = 'bottom';
        targetHandle = 'top';
        sourcePosition = Position.Bottom;
        targetPosition = Position.Top;
        break;
        
      case ConnectionType.CHILD_TO_CHILD_SAME:
        // Between children in same parent - adaptable based on arrangement
        if (Math.abs(dx) < 50) {
          // Nearly vertical alignment
          if (dy > 0) {
            sourceHandle = 'bottom';
            targetHandle = 'top';
            sourcePosition = Position.Bottom;
            targetPosition = Position.Top;
          } else {
            sourceHandle = 'top';
            targetHandle = 'bottom';
            sourcePosition = Position.Top;
            targetPosition = Position.Bottom;
          }
        } else {
          // Horizontal arrangement
          if (dx > 0) {
            sourceHandle = 'right';
            targetHandle = 'left';
            sourcePosition = Position.Right;
            targetPosition = Position.Left;
          } else {
            sourceHandle = 'left';
            targetHandle = 'right';
            sourcePosition = Position.Left;
            targetPosition = Position.Right;
          }
        }
        break;
        
      default:
        // CRITICAL FIX: Container edges always use vertical connections
        if (involvesContainer) {
          // Force vertical connection for any edge involving a container
          if (dy > 0) {
            sourceHandle = 'bottom';
            targetHandle = 'top';
            sourcePosition = Position.Bottom;
            targetPosition = Position.Top;
          } else {
            sourceHandle = 'top';
            targetHandle = 'bottom';
            sourcePosition = Position.Top;
            targetPosition = Position.Bottom;
          }
        } else {
          // Standard connection logic for most cases
          if (isHorizontal) {
            // For horizontal arrangements, use left/right handles
            if (dx > 0) {
              sourceHandle = 'right';
              targetHandle = 'left';
              sourcePosition = Position.Right;
              targetPosition = Position.Left;
            } else {
              sourceHandle = 'left';
              targetHandle = 'right';
              sourcePosition = Position.Left;
              targetPosition = Position.Right;
            }
          } else {
            // For vertical arrangements, use top/bottom handles
            if (dy > 0) {
              sourceHandle = 'bottom';
              targetHandle = 'top';
              sourcePosition = Position.Bottom;
              targetPosition = Position.Top;
            } else {
              sourceHandle = 'top';
              targetHandle = 'bottom';
              sourcePosition = Position.Top;
              targetPosition = Position.Bottom;
            }
          }
        }
    }
    
    // Return the updated edge with optimal handle settings
    return {
      ...edge,
      sourceHandle,
      targetHandle,
      sourcePosition,
      targetPosition,
      data: {
        ...edge.data,
        connectionType,
        isSourceChildNode,
        isTargetChildNode,
        sourceParentNode: sourceNode.parentNode,
        targetParentNode: targetNode.parentNode,
      }
    };
  });
};

/**
 * Calculate path parameters based on connection type
 */
export const getPathParams = (
  connectionType: ConnectionType,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  edgeData: any
) => {
  // Base curvature for different types of connections
  let curvature = 0.2;
  let offsetX = 0;
  
  // Calculate direct distance for dynamic adjustments
  const distance = Math.sqrt(
    Math.pow(targetX - sourceX, 2) + 
    Math.pow(targetY - sourceY, 2)
  );
  
  const isLongPath = distance > 300;
  const isHorizontal = 
    sourcePosition === Position.Left || 
    sourcePosition === Position.Right;
  
  // Adjust curvature and offsets based on connection type
  switch (connectionType) {
    case ConnectionType.DECISION_PATH:
      // Decision paths need more pronounced curves but keep endpoints aligned
      curvature = edgeData?.label?.toLowerCase() === 'yes' ? 0.3 : 0.5;
      // Maintain centered endpoints for perfect alignment with markers
      offsetX = 0;
      break;
      
    case ConnectionType.PARENT_TO_CHILD:
      // Connections to child nodes need subtle curves
      curvature = 0.1;
      break;
      
    case ConnectionType.CHILD_TO_PARENT:
      // Connections from child nodes to outside
      curvature = 0.15;
      break;
      
    case ConnectionType.CHILD_TO_CHILD_SAME:
      // Between children in same parent - very subtle curves
      curvature = 0.1;
      break;
      
    case ConnectionType.CHILD_TO_CHILD_DIFF:
      // Between children in different parents - more pronounced
      curvature = 0.3;
      break;
      
    default:
      // Adjust based on distance for standard connections
      curvature = isLongPath ? 0.3 : 0.2;
  }
  
  // Use lower curvature for horizontal connections
  if (isHorizontal) {
    curvature = Math.min(curvature, 0.15);
  }
  
  return {
    curvature,
    offsetX,
  };
};

/**
 * Get marker styling based on node & connection type
 */
export const getMarkerStyles = (
  connectionType: ConnectionType,
  isSource: boolean,
  edgeData: any
) => {
  const isTargetChildNode = edgeData?.isTargetChildNode;
  const isSourceChildNode = edgeData?.isSourceChildNode;
  
  // Base styling that varies by connection point
  if (isSource) {
    return {
      radius: isSourceChildNode ? 6 : 4,
      fillOpacity: 0.85,
      fill: isSourceChildNode ? "#ef4444" : "#555",
    };
  } else {
    return {
      radius: isTargetChildNode ? 6 : 4,
      fillOpacity: 0.85,
      fill: isTargetChildNode ? "#ef4444" : "#555",
    };
  }
}; 