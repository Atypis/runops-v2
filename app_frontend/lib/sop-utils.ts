import { SOPDocument, SOPNode, SOPPublicData } from "./types/sop";
import { Node as FlowNode, Edge as FlowEdge, Position } from 'reactflow'; // Alias to avoid name collision with SOPNode
import { SOPEdge as AppSOPEdge, SOPNode as AppSOPNode } from "./types/sop"; // Explicitly import our types
// Import ELK types for layout options
import { ElkNode, ElkExtendedEdge } from 'elkjs';
import { CustomElkNode, CustomElkEdge, CustomElkNodeData } from './types/sop'; // ADDED Custom types

const COMPOUND_NODE_PADDING_X = 50;
const COMPOUND_NODE_PADDING_Y = 50;
const AVG_CHILD_NODE_WIDTH = 200;
const AVG_CHILD_NODE_HEIGHT = 80;
const AVG_NODESEP = 60;
const AVG_RANKSEP = 80;
const MAX_CHILDREN_PER_ROW_ESTIMATE = 2;
// Revert to more moderate minimums, actual size driven by children + padding
const MIN_COMPOUND_WIDTH = 450; 
const MIN_COMPOUND_HEIGHT = 250;

/**
 * Calculate the maximum nesting depth in the SOP data
 */
function calculateMaxNestingDepth(sopData: SOPDocument): number {
  if (!sopData?.public?.nodes) return 0;
  
  let maxDepth = 0;
  
  function traverse(nodeId: string, currentDepth: number, visited: Set<string> = new Set()) {
    // Prevent infinite loops with circular references
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    
    maxDepth = Math.max(maxDepth, currentDepth);
    const node = sopData.public.nodes.find(n => n.id === nodeId);
    if (node?.children && node.children.length > 0) {
      node.children.forEach(childId => traverse(childId, currentDepth + 1, new Set(visited)));
    }
  }
  
  // Start from root nodes (nodes without parentId)
  sopData.public.nodes
    .filter(n => !n.parentId)
    .forEach(root => traverse(root.id, 1));
    
  return maxDepth;
}

/**
 * Calculate minimum container width based on maximum depth
 */
function calculateMinimumContainerWidth(maxDepth: number): number {
  // Allow for more columns to accommodate larger numbers of children
  // For level 1 containers, allow up to 4-5 columns for better compactness
  return Math.max(4, Math.min(5, maxDepth + 2)); // Allow 4-5 columns for better layout
}

/**
 * Calculate child container width based on parent width and depth
 */
function calculateChildContainerWidth(
  parentWidth: number, 
  currentDepth: number, 
  maxDepth: number
): number {
  const calculatedWidth = Math.floor(parentWidth * 0.8);
  return Math.max(1, calculatedWidth);
}

/**
 * Calculate the depth of a specific node in the hierarchy
 */
function calculateNodeDepth(nodeId: string, nodes: AppSOPNode[]): number {
  const nodeMap = new Map<string, AppSOPNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));
  
  function getDepth(id: string, visited: Set<string> = new Set()): number {
    if (visited.has(id)) return 0; // Prevent cycles
    visited.add(id);
    
    const node = nodeMap.get(id);
    if (!node || !node.parentId) return 1; // Root level
    
    return 1 + getDepth(node.parentId, new Set(visited));
  }
  
  return getDepth(nodeId);
}

/**
 * Processes the raw SOP data to resolve child node references and ensure parentIds are set.
 * It iterates through each node and if a node has a 'children' array (of IDs),
 * it finds the actual child node objects and populates the 'childNodes' property.
 * It also assigns a 'parentId' to these childNodes if not already present.
 */
export function processSopData(sopData: SOPDocument): SOPDocument {
  if (!sopData || !sopData.public || !sopData.public.nodes) {
    return sopData; // Return original data if structure is not as expected
  }

  const nodesMap = new Map<string, SOPNode>();
  // Create a deep copy of nodes to ensure mutability for adding parentId
  sopData.public.nodes.forEach(node => {
    nodesMap.set(node.id, JSON.parse(JSON.stringify(node)));
  });

  // First pass: build childNodes arrays and assign parentIds
  nodesMap.forEach(populatedNode => {
    // Check original node's children array from the input sopData, not the copy
    const originalNode = sopData.public.nodes.find(n => n.id === populatedNode.id);
    if (originalNode && originalNode.children && originalNode.children.length > 0) {
      const childNodesFromMap = originalNode.children
        .map(childId => nodesMap.get(childId))
        .filter(childNode => childNode !== undefined) as SOPNode[];
      
      populatedNode.childNodes = childNodesFromMap;
      
      // Assign parentId to these childNodes
      childNodesFromMap.forEach(childNodeInMap => {
        if (childNodeInMap && !childNodeInMap.parentId) { // Check if parentId is not already set
          childNodeInMap.parentId = populatedNode.id;
        }
      });
    }
  });

  // Second pass: ensure parentId is also set for nodes that might have it in original data 
  // but were not part of a children array (e.g. L1_C9_A1_set_last_interaction_date)
  // This is already handled by the deep copy and direct parentId in JSON.
  // The main goal here was to add parentId for those in `children` arrays.

  const processedNodes = Array.from(nodesMap.values());

  return {
    ...sopData,
    public: {
      ...sopData.public,
      nodes: processedNodes,
    },
  };
}

/**
 * Utility function to find the root nodes of the SOP for hierarchical list display.
 * A node is considered a root if it does not have an explicit 'parentId' 
 * AND it is not listed as an ID in another node's 'children' array.
 */
export function getRootNodes(publicData: SOPPublicData): SOPNode[] {
  if (!publicData || !publicData.nodes) return [];

  const allNodes = publicData.nodes;

  return allNodes.filter(node => {
    // Condition 1: Does it have a parentId? If so, it's not a root.
    if (node.parentId) {
      return false;
    }

    // Condition 2: Is it listed in another node's 'children' array?
    // If so, processSopData would have made it a childNode of that other node.
    const isChildInAnotherNodesArray = allNodes.some(potentialParent =>
      potentialParent.id !== node.id && // Cannot be its own parent
      potentialParent.children?.includes(node.id)
    );

    if (isChildInAnotherNodesArray) {
      return false;
    }

    // If it passes both conditions, it's a root node for our display.
    return true;
  });
}

// Function to identify actual start nodes for the flow diagram based on 3 conditions:
// 1. Not a target in any sopDocument.public.edges.
// 2. Does not have a parentId attribute.
// 3. Is not listed in any other node's children array.
const getFlowStartNodeIds = (sopNodes: AppSOPNode[], sopEdges: AppSOPEdge[]): string[] => {
  const targetNodeIdsInEdges = new Set(sopEdges.map(edge => edge.target));
  
  const nodeIsChildInAnotherArray = (nodeId: string, allNodes: AppSOPNode[]): boolean => {
    return allNodes.some(potentialParent =>
      potentialParent.id !== nodeId &&
      potentialParent.children?.includes(nodeId)
    );
  };

  return sopNodes
    .filter(node => 
      !targetNodeIdsInEdges.has(node.id) &&         // Condition 1
      !node.parentId &&                             // Condition 2
      !nodeIsChildInAnotherArray(node.id, sopNodes) // Condition 3
    )
    .map(node => node.id);
};

// Helper function to check if a specific known problematic edge exists
// This is a temporary solution for mocksop.json specifically
const hasProblematicCrossEdge = (sopEdgesFromDoc: AppSOPEdge[]): boolean => {
  const problematicEdges = [
    { source: 'L1_C9_A1_set_last_interaction_date', target: 'L1_process_emails' },
    // Add other known problematic edges here
  ];
  
  return problematicEdges.some(problematicEdge => 
    sopEdgesFromDoc.some(edge => 
      edge.source === problematicEdge.source && edge.target === problematicEdge.target
    )
  );
};

export const transformSopToFlowData = (
  sopDocument: SOPDocument
): { flowNodes: FlowNode[]; flowEdges: FlowEdge[] } => {
  if (!sopDocument || !sopDocument.public) {
    return { flowNodes: [], flowEdges: [] };
  }

  const { triggers, nodes: originalSopNodes, edges: sopEdgesFromDoc } = sopDocument.public;

  // Create a deep copy for modification for this test
  let sopNodesFromDoc: AppSOPNode[] = JSON.parse(JSON.stringify(originalSopNodes));

  // Check if this is a known problematic SOP (like mocksop.json)
  const hasComplexStructure = hasProblematicCrossEdge(sopEdgesFromDoc);
  
  // TEMPORARILY DISABLE FLATTENING FOR TICKET 1 TESTING
  console.log(`[SOP-UTILS] Complex structure detected: ${hasComplexStructure}`);
  console.log(`[SOP-UTILS] Original nodes with children:`, sopNodesFromDoc.filter(n => n.children && n.children.length > 0).map(n => ({id: n.id, children: n.children})));
  
  /*
  // For mocksop.json and similar complex SOPs, apply a more aggressive flattening
  if (hasComplexStructure) {
    console.log("[SOP-UTILS] Detected complex SOP with cross-boundary edges. Using flattened layout.");
    
    // Find and remove problematic parent-child relationships
    sopNodesFromDoc.forEach(node => {
      // For live SOP, temporarily remove all nested children
      if (node.children && node.children.length > 0) {
        console.log(`[SOP-UTILS] Temporarily flattening children for node ${node.id} in complex SOP`);
        node.children = [];
        node.childNodes = [];
      }
    });
  } else {
    // For test cases, just handle the known L1_C9_conditional_routing issue
    const l1c9NodeIndex = sopNodesFromDoc.findIndex(node => node.id === 'L1_C9_conditional_routing');
    if (l1c9NodeIndex > -1) {
      console.log("[SOP-UTILS-DEBUG] Temporarily removing children from L1_C9_conditional_routing for Dagre safety test.");
      sopNodesFromDoc[l1c9NodeIndex].children = []; // Remove references in 'children' array
      sopNodesFromDoc[l1c9NodeIndex].childNodes = []; // Clear actual childNodes objects
    }
    
    // Also, ensure L1_C9_A1_set_last_interaction_date (if it exists as a top-level node after reparenting) 
    // doesn't incorrectly get L1_process_emails as a parent if its original parent L1_C9_conditional_routing is altered.
    const l1ProcessEmailsNodeIndex = sopNodesFromDoc.findIndex(node => node.id === 'L1_process_emails');
    if (l1ProcessEmailsNodeIndex > -1 && sopNodesFromDoc[l1ProcessEmailsNodeIndex].childNodes) {
        sopNodesFromDoc[l1ProcessEmailsNodeIndex].childNodes = sopNodesFromDoc[l1ProcessEmailsNodeIndex].childNodes?.filter(
            child => child.id !== 'L1_C9_A1_set_last_interaction_date'
        );
        if (sopNodesFromDoc[l1ProcessEmailsNodeIndex].children) {
          sopNodesFromDoc[l1ProcessEmailsNodeIndex].children = sopNodesFromDoc[l1ProcessEmailsNodeIndex].children?.filter(
              childId => childId !== 'L1_C9_A1_set_last_interaction_date'
          );
        }
    }
  }
  */

  let flowNodes: FlowNode[] = [];
  let reactFlowEdges: FlowEdge[] = [];

  const sopNodeMap = new Map<string, AppSOPNode>();
  sopNodesFromDoc.forEach(node => sopNodeMap.set(node.id, node));

  // Build an index of edges for quick lookup: "sourceId|targetId"
  const edgeIndex = new Set<string>();
  sopEdgesFromDoc.forEach(edge => {
    edgeIndex.add(`${edge.source}|${edge.target}`);
    edgeIndex.add(`${edge.target}|${edge.source}`); // For checking both directions
  });

  const compoundParentData = new Map<string, { width: number; height: number; isSafeToRenderAsCompound: boolean }>();

  // First pass: Identify potential compound parents, calculate their dimensions,
  // and determine if it's safe to render them as compound.
  sopNodesFromDoc.forEach(appNode => {
    if (appNode.childNodes && appNode.childNodes.length > 0) {
      const childCount = appNode.childNodes.length;
      let estimatedWidth = COMPOUND_NODE_PADDING_X * 2; // Start with padding
      let estimatedHeight = COMPOUND_NODE_PADDING_Y * 2;

      if (childCount > 0) {
        const rows = Math.ceil(childCount / MAX_CHILDREN_PER_ROW_ESTIMATE);
        const cols = Math.min(childCount, MAX_CHILDREN_PER_ROW_ESTIMATE);
        
        estimatedWidth += cols * AVG_CHILD_NODE_WIDTH + (cols > 1 ? (cols - 1) * AVG_NODESEP : 0);
        estimatedHeight += rows * AVG_CHILD_NODE_HEIGHT + (rows > 1 ? (rows - 1) * AVG_RANKSEP : 0);
      }
      // Ensure minimum dimensions
      estimatedWidth = Math.max(estimatedWidth, MIN_COMPOUND_WIDTH);
      estimatedHeight = Math.max(estimatedHeight, MIN_COMPOUND_HEIGHT);

      // Enhanced safety check: 
      // 1. Check for direct edges between parent and direct children
      // 2. Check for edges from any descendant back to this ancestor
      let isSafe = true;

      // Create an array of all descendant node IDs recursively
      const getAllDescendantIds = (node: AppSOPNode): string[] => {
        if (!node.childNodes || node.childNodes.length === 0) return [];
        
        return node.childNodes.reduce((ids: string[], childNode) => {
          return [...ids, childNode.id, ...getAllDescendantIds(childNode)];
        }, []);
      };

      const allDescendantIds = getAllDescendantIds(appNode);
      
      // First check: Direct edges between parent and immediate children
      for (const childSopNode of appNode.childNodes) {
        if (edgeIndex.has(`${appNode.id}|${childSopNode.id}`) || edgeIndex.has(`${childSopNode.id}|${appNode.id}`)) {
          isSafe = false;
          console.warn(`[SOP-UTILS] Unsafe compound parent: ${appNode.id} has direct edge to/from child ${childSopNode.id}. Will not render as compound.`);
          break;
        }
      }

      // Second check: Check if any descendant has an edge to this parent
      if (isSafe) {
        for (const descendantId of allDescendantIds) {
          if (edgeIndex.has(`${descendantId}|${appNode.id}`)) {
            isSafe = false;
            console.warn(`[SOP-UTILS] Unsafe compound parent: ${appNode.id} has edge from descendant ${descendantId}. Will not render as compound.`);
            break;
          }
        }
      }

      // Special case known problematic node
      if (appNode.id === 'L1_process_emails') {
        if (!isSafe) {
          console.warn(`[SOP-UTILS] L1_process_emails detected as unsafe for compound rendering. Using regular layout.`);
        } else {
          console.log(`[SOP-UTILS] L1_process_emails is safe for compound rendering.`);
        }
      }

      compoundParentData.set(appNode.id, { width: estimatedWidth, height: estimatedHeight, isSafeToRenderAsCompound: isSafe });
    }
  });

  // 1. Create ReactFlow nodes from sopDocument.public.triggers
  triggers.forEach((trigger, index) => {
    flowNodes.push({
      id: `trigger-${trigger.type}-${index}`,
      type: 'trigger',
      data: { ...trigger, label: trigger.description || trigger.type },
      position: { x: 0, y: 0 },
    });
  });

  // Calculate max depth for depth-aware container sizing
  const maxDepth = calculateMaxNestingDepth(sopDocument);
  const rootContainerWidth = calculateMinimumContainerWidth(maxDepth);
  console.log(`[SOP-UTILS] Max nesting depth: ${maxDepth}, Root container width: ${rootContainerWidth}`);

  // 2. Create ReactFlow nodes from sopDocument.public.nodes (SOPNode[])
  sopNodesFromDoc.forEach(appNode => {
    let nodeType = 'step'; 
    if (appNode.type === 'end') {
      nodeType = 'end';
    } else if (appNode.type === 'decision') {
      nodeType = 'decision';
    } else if (appNode.type === 'loop') {
      nodeType = 'loop'; 
    }

    // Create flow node data
    const flowNodeData: any = { 
      ...appNode, 
      title: appNode.label, 
      description: appNode.intent || appNode.context,
    };

    // Universal container support - ANY node type with children can be a container
    if (appNode.childNodes && appNode.childNodes.length > 0) {
      const childCount = appNode.childNodes.length;
      
      // Mark as collapsible container
      flowNodeData.isCollapsible = true;
      flowNodeData.childSopNodeIds = appNode.childNodes.map(cn => cn.id);
      
      // Calculate depth-aware container dimensions
      const currentDepth = calculateNodeDepth(appNode.id, sopNodesFromDoc);
      
      // Dynamic container width based on children count for better layouts
      let containerWidth = currentDepth === 1 ? rootContainerWidth : 
        calculateChildContainerWidth(rootContainerWidth, currentDepth, maxDepth);
      
      // Override with children-count-based width for better packing
      if (childCount <= 3) {
        containerWidth = Math.min(3, childCount); // Small containers stay compact
      } else if (childCount <= 8) {
        containerWidth = 4; // Medium containers get 4 columns
      } else if (childCount <= 15) {
        containerWidth = 5; // Large containers get 5 columns
      } else {
        containerWidth = 6; // Very large containers get 6 columns
      }
      
      // Calculate container height based on children count and type
      let estimatedHeight = COMPOUND_NODE_PADDING_Y * 2;
      if (childCount > 0) {
        const rows = Math.ceil(childCount / containerWidth);
        estimatedHeight += rows * AVG_CHILD_NODE_HEIGHT + (rows > 1 ? (rows - 1) * AVG_RANKSEP : 0);
      }
      estimatedHeight = Math.max(estimatedHeight, MIN_COMPOUND_HEIGHT);
      
      // Set calculated dimensions
      let estimatedWidth = containerWidth * AVG_CHILD_NODE_WIDTH + ((containerWidth - 1) * AVG_NODESEP) + (COMPOUND_NODE_PADDING_X * 2);
      estimatedWidth = Math.max(estimatedWidth, MIN_COMPOUND_WIDTH);
      
      flowNodeData.calculatedWidth = estimatedWidth;
      flowNodeData.calculatedHeight = estimatedHeight;
      flowNodeData.containerWidth = containerWidth; // Store for layout algorithm
      flowNodeData.maxDepth = maxDepth; // Store for layout algorithm
      flowNodeData.currentDepth = currentDepth; // Store for layout algorithm
      
      console.log(`[SOP-UTILS] Container node ${appNode.id} (${nodeType}): ${childCount} children, width=${containerWidth}, depth=${currentDepth}/${maxDepth}, estimated size: ${estimatedWidth}x${estimatedHeight}`);
    }
    
    const flowNode: FlowNode = {
      id: appNode.id,
      type: nodeType,
      data: flowNodeData,
      position: { x: 0, y: 0 }, 
    };

    // Set parentNode for ReactFlow layout relationships
    if (appNode.parentId) {
        const parentAppNode = sopNodeMap.get(appNode.parentId);
        
        if (parentAppNode) {
            flowNode.parentNode = appNode.parentId;
            console.log(`[SOP-UTILS] Setting parentNode: ${appNode.id} -> ${appNode.parentId}`);
        }
        
        // Special handling for known test SOPs
        if (parentAppNode && (appNode.parentId === 'L1_loop' || appNode.id.startsWith('C'))) {
            flowNode.parentNode = appNode.parentId;
            console.log(`[TEST-COMPOUND] Forcing parent for test: ${appNode.id} -> ${appNode.parentId}`);
        }
        
        if (parentAppNode && sopDocument.meta.id === 'mocksop-compound-fixed') {
            flowNode.parentNode = appNode.parentId;
            console.log(`[COMPOUND-FIXED] Forcing parent for fixed SOP: ${appNode.id} -> ${appNode.parentId}`);
        }
        
        if (parentAppNode && sopDocument.meta.id === 'mocksop-original-structure') {
            flowNode.parentNode = appNode.parentId;
            console.log(`[ORIGINAL-STRUCTURE] Forcing parent for original structure SOP: ${appNode.id} -> ${appNode.parentId}`);
        }
    }
    
    flowNodes.push(flowNode);
  });

  // 3. Create ReactFlow edges from sopDocument.public.edges (SOPEdge[])
  sopEdgesFromDoc.forEach((edge, index) => {
    const sourceNode = sopNodesFromDoc.find(n => n.id === edge.source);
    const targetNode = sopNodesFromDoc.find(n => n.id === edge.target);
    
    // Determine if this is a decision-related edge
    const isFromDecision = sourceNode?.type === 'decision';
    
    // Normalize common condition values for better visualization
    let edgeLabel = edge.condition;
    if (edgeLabel) {
      // Standardize yes/no variants
      if (/^(yes|true|y|1)$/i.test(edgeLabel)) {
        edgeLabel = 'yes';
      } else if (/^(no|false|n|0)$/i.test(edgeLabel)) {
        edgeLabel = 'no';
      } else if (/^next$/i.test(edgeLabel)) {
        edgeLabel = 'next';
      }
    }
    
    // Add decision path suffix for decision nodes with ID paths
    if (isFromDecision && sourceNode?.id_path && edge.decision_path) {
      // Include source node ID path in the edge label, e.g., "2.3Y"
      edgeLabel = edgeLabel?.toUpperCase() || '';
    }
    
    // Special case for decision path edges to display ID path in label
    const edgeLabelWithPath = (isFromDecision && sourceNode?.id_path && edgeLabel) ? 
      `${edgeLabel}` : 
      edgeLabel;
    
    reactFlowEdges.push({
      id: edge.id || `e-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      label: edgeLabelWithPath, 
      type: 'custom-edge', 
      animated: edge.animated || false,
      data: {
        condition: !!edgeLabel || isFromDecision,
        fromDecision: isFromDecision,
        sourceType: sourceNode?.type,
        targetType: targetNode?.type,
        sourceIdPath: sourceNode?.id_path,
        decisionPath: edge.decision_path
      }
    });
  });

  // 4. Create edges from Trigger FlowNodes to actual start SOPNodes
  // Use the new getFlowStartNodeIds function
  const actualStartNodeIds = getFlowStartNodeIds(sopNodesFromDoc, sopEdgesFromDoc);
  
  flowNodes.filter(fn => fn.type === 'trigger').forEach(triggerNode => {
    actualStartNodeIds.forEach(startNodeId => {
      const targetNode = sopNodesFromDoc.find(n => n.id === startNodeId);
      
      reactFlowEdges.push({
        id: `e-${triggerNode.id}-to-${startNodeId}`,
        source: triggerNode.id,
        target: startNodeId,
        type: 'custom-edge',
        data: {
          sourceType: 'trigger',
          targetType: targetNode?.type,
        }
      });
    });
  });

  // 5. Connect SOPNodes that have a parentId but are not yet targeted by an existing edge.
  // This ensures that explicit parent-child relationships (like atomic actions)
  // are represented if not already covered by the main `edges` array.
  const currentTargetNodeIds = new Set(reactFlowEdges.map(edge => edge.target));

  sopNodesFromDoc.forEach(sopNode => {
    if (sopNode.parentId && !currentTargetNodeIds.has(sopNode.id)) {
      // Check if an edge from this parentId to this sopNode.id already exists to be super safe,
      // though !currentTargetNodeIds.has(sopNode.id) should mostly cover it.
      const edgeAlreadyExists = reactFlowEdges.some(
        edge => edge.source === sopNode.parentId && edge.target === sopNode.id
      );

      if (!edgeAlreadyExists) {
        const parentNode = sopNodesFromDoc.find(n => n.id === sopNode.parentId);
        
        reactFlowEdges.push({
          id: `e-parent-${sopNode.parentId}-to-${sopNode.id}`,
          source: sopNode.parentId,
          target: sopNode.id,
          type: 'custom-edge',
          data: {
            sourceType: parentNode?.type,
            targetType: sopNode.type,
            isParentChild: true
          }
        });
        // Add to currentTargetNodeIds if we were to loop again, but not strictly necessary here
        // currentTargetNodeIds.add(sopNode.id);
      }
    }
  });

  return { flowNodes, flowEdges: reactFlowEdges };
}; 