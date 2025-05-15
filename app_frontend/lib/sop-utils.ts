import { SOPDocument, SOPNode, SOPPublicData } from "./types/sop";
import { Node as FlowNode, Edge as FlowEdge, Position } from 'reactflow'; // Alias to avoid name collision with SOPNode
import { SOPEdge as AppSOPEdge, SOPNode as AppSOPNode } from "./types/sop"; // Explicitly import our types
// Import ELK types for layout options
import { ElkNode, ElkExtendedEdge } from 'elkjs';
import { CustomElkNode, CustomElkEdge, CustomElkNodeData } from './types/sop'; // ADDED Custom types

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

export const getElkLayoutOptions = (
  verticalNodeSpacing: number = 40, // Corresponds to 'elk.layered.spacing.nodeNodeBetweenLayers' for DOWN direction
  horizontalBranchSpacing: number = 40, // Corresponds to 'elk.layered.spacing.nodeNodeBetweenLayers' for RIGHT direction
  siblingInBranchSpacing: number = 30   // Corresponds to 'elk.spacing.nodeNode' for RIGHT direction
) => {
  const rootLayout: ElkNode['layoutOptions'] = {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.alignment': 'CENTER',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(verticalNodeSpacing),
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.layered.edgeRouting': 'ORTHOGONAL',
  };

  const branchLayout: ElkNode['layoutOptions'] = {
    'elk.direction': 'RIGHT',
    'elk.layered.spacing.nodeNodeBetweenLayers': String(horizontalBranchSpacing), // Parent to first child in branch
    'elk.spacing.nodeNode': String(siblingInBranchSpacing), // Between sibling children in branch
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 
    'elk.layered.edgeRouting': 'ORTHOGONAL',
  };

  return { rootLayout, branchLayout };
};

export const transformSopToElkInput = (
  sopDocument: SOPDocument,
  layoutOptionsConfig: { rootLayout: ElkNode['layoutOptions'], branchLayout: ElkNode['layoutOptions'] }
): { elkNodes: CustomElkNode[], elkEdges: CustomElkEdge[] } => {
  if (!sopDocument?.public) {
    return { elkNodes: [], elkEdges: [] };
  }

  const { triggers, nodes: sopNodesFromDoc, edges: sopEdgesFromDoc } = sopDocument.public;
  const elkNodes: CustomElkNode[] = [];
  const elkEdges: CustomElkEdge[] = [];

  // 1. Create ELK nodes from sopDocument.public.triggers
  triggers.forEach((trigger, index) => {
    const triggerData: CustomElkNodeData = {
      ...trigger, 
      label: trigger.description || trigger.type, 
      isTrigger: true, 
      type: 'trigger' // Essential for ReactFlow nodeTypes mapping
    };
    elkNodes.push({
      id: `trigger-${trigger.type}-${index}`,
      width: 208, 
      height: 112,
      data: triggerData, // ASSIGN CustomElkNodeData
      layoutOptions: { ...layoutOptionsConfig.rootLayout }, 
    });
  });

  // 2. Create ELK nodes from sopDocument.public.nodes (AppSOPNode[])
  sopNodesFromDoc.forEach(appNode => {
    let nodeWidth = 240; 
    let nodeHeight = 80;  

    if (appNode.type === 'end') {
      nodeWidth = 208; nodeHeight = 112;
    } else if (appNode.type === 'decision') {
      nodeWidth = 208; nodeHeight = 104;
    }
    
    // Ensure all necessary fields for CustomElkNodeData are present
    const nodeData: CustomElkNodeData = {
        ...appNode, // Spreads all AppSOPNode properties
        // type is already in appNode, label is appNode.label
        // title and description can be mapped if needed for display consistency
        title: appNode.label, 
        description: appNode.intent || appNode.context,
        // isTrigger, isExpanded, onToggleCollapse will be added in SOPFlowView if needed before passing to ReactFlow
    };

    elkNodes.push({
      id: appNode.id,
      width: nodeWidth,
      height: nodeHeight,
      data: nodeData, // ASSIGN CustomElkNodeData
      layoutOptions: appNode.isBranchRoot ? { ...layoutOptionsConfig.branchLayout } : { ...layoutOptionsConfig.rootLayout },
    });
  });

  // 3. Create ELK edges from sopDocument.public.edges (SOPEdge[])
  sopEdgesFromDoc.forEach((edge, index) => {
    elkEdges.push({
      id: edge.id || `e-${edge.source}-${edge.target}-${index}`,
      sources: [edge.source],
      targets: [edge.target],
      data: { label: edge.condition, animated: edge.animated }, 
    });
  });

  // 4. Create edges from Trigger nodes to actual start SOPNodes
  const actualStartNodeIds = getFlowStartNodeIds(sopNodesFromDoc, sopEdgesFromDoc);
  elkNodes.filter(en => en.data?.isTrigger).forEach(triggerElkNode => {
    actualStartNodeIds.forEach(startNodeId => {
      elkEdges.push({
        id: `e-${triggerElkNode.id!}-to-${startNodeId}`,
        sources: [triggerElkNode.id!], 
        targets: [startNodeId],
        // No specific data for these edges unless needed
      });
    });
  });

  // 5. Connect SOPNodes with parentId if not covered 
  const elkTargetNodeIds = new Set(elkEdges.flatMap(edge => edge.targets));
  sopNodesFromDoc.forEach(sopNode => {
    if (sopNode.parentId && !elkTargetNodeIds.has(sopNode.id)) {
      const edgeAlreadyExists = elkEdges.some(
        edge => edge.sources.includes(sopNode.parentId!) && edge.targets.includes(sopNode.id)
      );
      if (!edgeAlreadyExists) {
        elkEdges.push({
          id: `e-parent-${sopNode.parentId}-to-${sopNode.id}`,
          sources: [sopNode.parentId!],
          targets: [sopNode.id],
          // No specific data for these edges unless needed
        });
      }
    }
  });
  return { elkNodes, elkEdges };
};

// Remove or comment out the old transformSopToFlowData function
/*
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
*/ 