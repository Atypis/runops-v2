import { SOPDocument, SOPNode, SOPPublicData } from "./types/sop";
import { Node as FlowNode, Edge as FlowEdge } from 'reactflow'; // Alias to avoid name collision with SOPNode
import { SOPEdge as AppSOPEdge, SOPNode as AppSOPNode } from "./types/sop"; // Explicitly import our types

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

export const transformSopToFlowData = (
  sopDocument: SOPDocument
): { flowNodes: FlowNode[]; flowEdges: FlowEdge[] } => {
  if (!sopDocument || !sopDocument.public) {
    return { flowNodes: [], flowEdges: [] };
  }

  const { triggers, nodes: sopNodesFromDoc, edges: sopEdgesFromDoc } = sopDocument.public;
  let flowNodes: FlowNode[] = [];
  let reactFlowEdges: FlowEdge[] = [];

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
  sopNodesFromDoc.forEach(node => {
    let nodeType = 'step'; // Default type
    if (node.type === 'end') {
      nodeType = 'end';
    } else if (node.type === 'decision') {
      nodeType = 'decision';
    }
    // Add more type mappings here if needed (e.g., for 'loop')

    flowNodes.push({
      id: node.id,
      type: nodeType,
      data: { ...node, label: node.label, title: node.label, description: node.intent || node.context }, 
      position: { x: 0, y: 0 }, 
    });
  });

  // 3. Create ReactFlow edges from sopDocument.public.edges (SOPEdge[])
  sopEdgesFromDoc.forEach((edge, index) => {
    reactFlowEdges.push({
      id: edge.id || `e-${edge.source}-${edge.target}-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.condition, 
      type: 'smoothstep', 
      animated: edge.animated || false,
    });
  });

  // 4. Create edges from Trigger FlowNodes to actual start SOPNodes
  // Use the new getFlowStartNodeIds function
  const actualStartNodeIds = getFlowStartNodeIds(sopNodesFromDoc, sopEdgesFromDoc);
  
  flowNodes.filter(fn => fn.type === 'trigger').forEach(triggerNode => {
    actualStartNodeIds.forEach(startNodeId => {
      reactFlowEdges.push({
        id: `e-${triggerNode.id}-to-${startNodeId}`,
        source: triggerNode.id,
        target: startNodeId,
        type: 'smoothstep',
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
        reactFlowEdges.push({
          id: `e-parent-${sopNode.parentId}-to-${sopNode.id}`,
          source: sopNode.parentId,
          target: sopNode.id,
          type: 'smoothstep', // Or your default edge type
        });
        // Add to currentTargetNodeIds if we were to loop again, but not strictly necessary here
        // currentTargetNodeIds.add(sopNode.id);
      }
    }
  });

  return { flowNodes, flowEdges: reactFlowEdges };
}; 