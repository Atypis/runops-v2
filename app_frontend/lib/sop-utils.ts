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

  // Create a deep copy for modification
  let sopNodesFromDoc: AppSOPNode[] = JSON.parse(JSON.stringify(originalSopNodes));

  // console.log("[SOP-UTILS] Initial sopNodesFromDoc:", JSON.stringify(sopNodesFromDoc, null, 2));

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

  // Stores data for all nodes that are parents in ReactFlow (have children)
  // and also includes Dagre-specific safety flag.
  const parentNodeInfo = new Map<string, { 
    width: number; 
    height: number; 
    isSafeForDagreCompound: boolean; // For Dagre's compound layout
    isReactFlowParent: boolean;      // True if it has children, for ReactFlow
  }>();

  // First pass: Identify all potential parent containers, calculate their dimensions,
  // and determine Dagre safety.
  sopNodesFromDoc.forEach(appNode => {
    const isReactFlowParent = appNode.childNodes && appNode.childNodes.length > 0;
    let estimatedWidth = MIN_COMPOUND_WIDTH;
    let estimatedHeight = MIN_COMPOUND_HEIGHT;
    let isSafeForDagre = true; // Default to true, assess below

    if (isReactFlowParent) {
      const childCount = appNode.childNodes.length;
      let calculatedWidth = COMPOUND_NODE_PADDING_X * 2; // Start with padding
      let calculatedHeight = COMPOUND_NODE_PADDING_Y * 2;

      if (childCount > 0) {
        const rows = Math.ceil(childCount / MAX_CHILDREN_PER_ROW_ESTIMATE);
        const cols = Math.min(childCount, MAX_CHILDREN_PER_ROW_ESTIMATE);
        
        calculatedWidth += cols * AVG_CHILD_NODE_WIDTH + (cols > 1 ? (cols - 1) * AVG_NODESEP : 0);
        calculatedHeight += rows * AVG_CHILD_NODE_HEIGHT + (rows > 1 ? (rows - 1) * AVG_RANKSEP : 0);
      }
      // Ensure minimum dimensions
      estimatedWidth = Math.max(calculatedWidth, MIN_COMPOUND_WIDTH);
      estimatedHeight = Math.max(calculatedHeight, MIN_COMPOUND_HEIGHT);

      // Dagre-specific safety check (existing logic)
      // Create an array of all descendant node IDs recursively
      const getAllDescendantIds = (node: AppSOPNode): string[] => {
        if (!node.childNodes || node.childNodes.length === 0) return [];
        return node.childNodes.reduce((ids: string[], childNode) => {
          return [...ids, childNode.id, ...getAllDescendantIds(childNode)];
        }, []);
      };
      const allDescendantIds = getAllDescendantIds(appNode);
      
      for (const childSopNode of appNode.childNodes) {
        if (edgeIndex.has(`${appNode.id}|${childSopNode.id}`) || edgeIndex.has(`${childSopNode.id}|${appNode.id}`)) {
          isSafeForDagre = false;
          // console.warn(`[SOP-UTILS] Dagre unsafe: ${appNode.id} has direct edge to/from child ${childSopNode.id}.`);
          break;
        }
      }
      if (isSafeForDagre) {
        for (const descendantId of allDescendantIds) {
          if (edgeIndex.has(`${descendantId}|${appNode.id}`)) {
            isSafeForDagre = false;
            // console.warn(`[SOP-UTILS] Dagre unsafe: ${appNode.id} has edge from descendant ${descendantId}.`);
            break;
          }
        }
      }
    }
    
    // Store info if it's a ReactFlow parent, along with dimensions and Dagre safety
    if (isReactFlowParent) {
      parentNodeInfo.set(appNode.id, { 
        width: estimatedWidth, 
        height: estimatedHeight, 
        isSafeForDagreCompound: isSafeForDagre,
        isReactFlowParent: true 
      });
    } else {
      // Even if not a parent, store with default/minimums if needed elsewhere,
      // or simply don't store. For now, only store parent data.
      // parentNodeInfo.set(appNode.id, { width: estimatedWidth, height: estimatedHeight, isSafeForDagreCompound: false, isReactFlowParent: false });
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

    // Create a formatted label with ID path if available - REMOVE THIS
    // Let the node components handle the formatting instead
    const flowNodeData: any = { 
      ...appNode, 
      title: appNode.label, 
      description: appNode.intent || appNode.context,
    };

    const currentParentInfo = parentNodeInfo.get(appNode.id);

    if (currentParentInfo?.isReactFlowParent) {
      flowNodeData.isParentContainer = true;
      flowNodeData.isCollapsible = true; // Standard for parent containers
      flowNodeData.childSopNodeIds = appNode.childNodes ? appNode.childNodes.map(cn => cn.id) : [];
      flowNodeData.calculatedWidth = currentParentInfo.width;
      flowNodeData.calculatedHeight = currentParentInfo.height;
      // console.log(`[SOP-UTILS] Node ${appNode.id} is a Parent Container. Dimensions: ${currentParentInfo.width}x${currentParentInfo.height}`);
    }
    // No 'else if' here, a node can be a parent and also have specific types like 'loop'
    // The specific type styling (like for 'loop') will be handled by the node component.
    // If a loop also has children, it gets parent container properties above.
    // If it's a loop without children, it just gets loop styling.
    
    const flowNode: FlowNode = {
      id: appNode.id,
      type: nodeType,
      data: flowNodeData,
      position: { x: 0, y: 0 }, // ELK will set this
    };

    // Set parentNode and extent for ReactFlow parent-child relationships
    if (appNode.parentId) {
      const parentExistsInMap = sopNodeMap.has(appNode.parentId);
      // Ensure the parent is also intended to be a ReactFlow parent container
      const parentIsReactFlowParentContainer = parentNodeInfo.get(appNode.parentId)?.isReactFlowParent || false;

      if (parentExistsInMap && parentIsReactFlowParentContainer) {
        flowNode.parentNode = appNode.parentId;
        flowNode.extent = 'parent';
        // console.log(`[SOP-UTILS] Child Node ${appNode.id} assigned to Parent ${appNode.parentId}`);
      } else if (parentExistsInMap && !parentIsReactFlowParentContainer) {
        // This case might happen if a node has a parentId but that parent has no childNodes array
        // or was filtered out. This could be a data inconsistency.
        // console.warn(`[SOP-UTILS] Node ${appNode.id} has parentId ${appNode.parentId}, but parent is not a ReactFlow container.`);
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