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

/**
 * Flattens nested container hierarchies to only keep tier 1 containers.
 * All nested containers become regular nodes, and their children are moved 
 * up to the tier 1 parent.
 */
function flattenNestedContainers(sopNodesFromDoc: AppSOPNode[]): AppSOPNode[] {
  console.log(`[FLATTEN] Starting container flattening for ${sopNodesFromDoc.length} nodes`);
  
  // Create a deep copy to avoid mutating original data
  const result = sopNodesFromDoc.map(node => JSON.parse(JSON.stringify(node)));
  
  // Create a map for quick lookup
  const nodeMap = new Map<string, AppSOPNode>();
  result.forEach(node => nodeMap.set(node.id, node));
  
  // Helper function to collect all descendants recursively
  const collectAllDescendants = (parent: AppSOPNode): AppSOPNode[] => {
    const descendants: AppSOPNode[] = [];
    
    if (!parent.childNodes || parent.childNodes.length === 0) {
      return descendants;
    }
    
    parent.childNodes.forEach(child => {
      descendants.push(child);
      
      // If this child also has children, flatten them too
      if (child.childNodes && child.childNodes.length > 0) {
        descendants.push(...collectAllDescendants(child));
        
        // Remove container properties from this nested container
        child.childNodes = [];
        delete child.children;
        console.log(`[FLATTEN] Removed container properties from nested container: ${child.id}`);
      }
    });
    
    return descendants;
  };
  
  // Process each node
  result.forEach(node => {
    if (node.childNodes && node.childNodes.length > 0) {
      // If this is a tier 1 container (no parentId)
      if (!node.parentId) {
        console.log(`[FLATTEN] Processing tier 1 container: ${node.id} with ${node.childNodes.length} direct children`);
        
        // Collect ALL descendants, not just direct children
        const allDescendants = collectAllDescendants(node);
        
        console.log(`[FLATTEN] Flattened ${node.childNodes.length} direct children into ${allDescendants.length} total descendants for ${node.id}`);
        
        // Replace childNodes with flattened list
        node.childNodes = allDescendants;
        
        // Update children array to match (for consistency)
        node.children = allDescendants.map(d => d.id);
        
        // Update parentId for all descendants to point to this tier 1 container
        allDescendants.forEach(descendant => {
          const originalParent = descendant.parentId;
          descendant.parentId = node.id;
          console.log(`[FLATTEN] Updated parentId for ${descendant.id}: ${originalParent} -> ${node.id}`);
        });
      } else {
        // This is a nested container - remove its container properties
        console.log(`[FLATTEN] Removing container properties from nested container: ${node.id} (was parent to ${node.childNodes.length} children)`);
        node.childNodes = [];
        delete node.children;
      }
    }
  });
  
  console.log(`[FLATTEN] Flattening complete. Processed ${result.length} nodes.`);
  return result;
}

export const transformSopToFlowData = (
  sopDocument: SOPDocument
): { flowNodes: FlowNode[]; flowEdges: FlowEdge[] } => {
  if (!sopDocument || !sopDocument.public) {
    return { flowNodes: [], flowEdges: [] };
  }

  const { triggers, nodes: originalSopNodes, edges: sopEdgesFromDoc } = sopDocument.public;

  // Create a deep copy for modification
  let sopNodesFromDoc: AppSOPNode[] = JSON.parse(JSON.stringify(originalSopNodes));

  // RADICAL SIMPLIFICATION: Flatten all nested containers to only keep tier 1 containers
  console.log(`[SOP-UTILS] RADICAL SIMPLIFICATION: Flattening nested containers`);
  sopNodesFromDoc = flattenNestedContainers(sopNodesFromDoc);
  
  // Log the flattening results
  const tier1Containers = sopNodesFromDoc.filter(n => n.childNodes && n.childNodes.length > 0 && !n.parentId);
  const childNodes = sopNodesFromDoc.filter(n => n.parentId);
  const rootNodes = sopNodesFromDoc.filter(n => !n.parentId && (!n.childNodes || n.childNodes.length === 0));
  
  console.log(`[SOP-UTILS] After flattening:`);
  console.log(`  - Tier 1 containers: ${tier1Containers.length} (${tier1Containers.map(n => n.id).join(', ')})`);
  console.log(`  - Child nodes: ${childNodes.length}`);
  console.log(`  - Root nodes (non-containers): ${rootNodes.length}`);

  let flowNodes: FlowNode[] = [];
  let reactFlowEdges: FlowEdge[] = [];

  const sopNodeMap = new Map<string, AppSOPNode>();
  sopNodesFromDoc.forEach(node => sopNodeMap.set(node.id, node));

  // 1. Create ReactFlow nodes from sopDocument.public.triggers
  triggers.forEach((trigger, index) => {
    flowNodes.push({
      id: `trigger-${trigger.type}-${index}`,
      type: 'trigger',
      data: { ...trigger, label: trigger.description || trigger.type },
      position: { x: 0, y: 0 },
    });
  });

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

    // SIMPLIFIED: Only tier 1 containers (no parentId) can be containers
    if (appNode.childNodes && appNode.childNodes.length > 0 && !appNode.parentId) {
      const childCount = appNode.childNodes.length;
      
      console.log(`[SOP-UTILS] Tier 1 container ${appNode.id} (${nodeType}) has ${childCount} flattened children`);
      
      // Mark as collapsible container
      flowNodeData.isCollapsible = true;
      flowNodeData.childSopNodeIds = appNode.childNodes.map(cn => cn.id);
      
      // Simplified container sizing (no depth calculations needed) - REDUCED for better readability
      let containerWidth;
      if (childCount <= 2) {
        containerWidth = Math.max(2, childCount); // Small containers, 2 wide max
      } else if (childCount <= 6) {
        containerWidth = 3; // Medium containers get 3 columns (reduced from 4)
      } else if (childCount <= 12) {
        containerWidth = 4; // Large containers get 4 columns (reduced from 5)
      } else {
        containerWidth = 4; // Very large containers get 4 columns (reduced from 6)
      }
      
      // Calculate container height based on children count - IMPROVED for accuracy
      const HEADER_HEIGHT = 160; // Realistic header height for Loop nodes with content
      const CONTAINER_PADDING = 40; // More realistic padding (20px top + 20px bottom)
      const CHILD_HEIGHT = 100; // Match actual child node height
      const ROW_SPACING = 15; // Match actual grid spacing
      const BOTTOM_CLEARANCE = 40; // Extra space to prevent overlap with subsequent nodes
      
      const rows = Math.ceil(childCount / containerWidth);
      const contentHeight = (rows * CHILD_HEIGHT) + ((rows - 1) * ROW_SPACING);
      const estimatedHeight = HEADER_HEIGHT + CONTAINER_PADDING + contentHeight + BOTTOM_CLEARANCE;
      
      // Calculate container width
      const CHILD_WIDTH = 200;
      const COL_SPACING = 60;
      const estimatedWidth = (containerWidth * CHILD_WIDTH) + ((containerWidth - 1) * COL_SPACING) + 100; // 100px total padding
      
      flowNodeData.calculatedWidth = Math.max(estimatedWidth, 450);
      flowNodeData.calculatedHeight = Math.max(estimatedHeight, 300); // Increased minimum height
      flowNodeData.containerWidth = containerWidth;
      flowNodeData.currentDepth = 1; // Always depth 1 now
      flowNodeData.maxDepth = 1; // Always max depth 1 now
      
      console.log(`[SOP-UTILS] Container ${appNode.id}: ${childCount} children, ${containerWidth}-wide (${rows} rows), size: ${flowNodeData.calculatedWidth}x${flowNodeData.calculatedHeight}`);
    }
    
    const flowNode: FlowNode = {
      id: appNode.id,
      type: nodeType,
      data: flowNodeData,
      position: { x: 0, y: 0 }, 
    };

    // Set parentNode for ReactFlow layout relationships (simplified)
    if (appNode.parentId) {
      const parentAppNode = sopNodeMap.get(appNode.parentId);
      
      if (parentAppNode) {
        flowNode.parentNode = appNode.parentId;
        console.log(`[SOP-UTILS] Setting parentNode: ${appNode.id} -> ${appNode.parentId}`);
      }
    }
    
    flowNodes.push(flowNode);
  });

  // 3. Create ReactFlow edges from sopDocument.public.edges (SOPEdge[]) - no changes needed
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

  // 5. Connect SOPNodes that have a parentId but are not yet targeted by an existing edge
  const currentTargetNodeIds = new Set(reactFlowEdges.map(edge => edge.target));

  sopNodesFromDoc.forEach(sopNode => {
    if (sopNode.parentId && !currentTargetNodeIds.has(sopNode.id)) {
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
      }
    }
  });

  console.log(`[SOP-UTILS] Created ${flowNodes.length} flow nodes and ${reactFlowEdges.length} flow edges`);
  return { flowNodes, flowEdges: reactFlowEdges };
}; 