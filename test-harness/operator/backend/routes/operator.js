import express from 'express';
import { OperatorService } from '../services/operatorService.js';
import { WorkflowService } from '../services/workflowService.js';

const router = express.Router();
const operatorService = new OperatorService();
const workflowService = new WorkflowService();

// Chat endpoint - main conversation with operator
router.post('/chat', async (req, res, next) => {
  try {
    const { message, workflowId, conversationHistory, mockMode } = req.body;
    
    const response = await operatorService.processMessage({
      message,
      workflowId,
      conversationHistory,
      mockMode
    });
    
    console.log('Operator response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Upload mock nodes to Supabase
router.post('/upload-mock-nodes', async (req, res, next) => {
  try {
    const { workflowId, nodes } = req.body;
    
    if (!workflowId || !nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'Missing workflowId or nodes array' });
    }
    
    // Flatten the node structure to include nested nodes
    const flattenedNodes = [];
    let currentPosition = 1;
    
    // Helper function to extract nested nodes from routes/iterates
    const extractNestedNodes = (node, parentPosition) => {
      // Add the parent node
      flattenedNodes.push({
        ...node,
        position: currentPosition++,
        parent_position: parentPosition
      });
      
      // If it's a route, extract nodes from paths
      if (node.type === 'route' && node.config?.paths) {
        const routePosition = currentPosition - 1;
        const updatedPaths = {};
        
        for (const [pathName, pathNodes] of Object.entries(node.config.paths)) {
          const pathNodePositions = [];
          
          if (Array.isArray(pathNodes)) {
            for (const nestedNode of pathNodes) {
              const nestedPosition = currentPosition;
              pathNodePositions.push(nestedPosition);
              extractNestedNodes(nestedNode, routePosition);
            }
          }
          
          // Store the positions of nodes in this path for the route to reference
          updatedPaths[pathName] = pathNodePositions;
        }
        
        // Update the route config to reference node positions instead of inline nodes
        flattenedNodes[routePosition - 1].config.paths = updatedPaths;
      }
      
      // If it's an iterate, extract nodes from body
      if (node.type === 'iterate' && node.config?.body) {
        const iteratePosition = currentPosition - 1;
        
        if (Array.isArray(node.config.body)) {
          const bodyNodePositions = [];
          for (const nestedNode of node.config.body) {
            const nestedPosition = currentPosition;
            bodyNodePositions.push(nestedPosition);
            extractNestedNodes(nestedNode, iteratePosition);
          }
          // Update iterate to reference positions
          flattenedNodes[iteratePosition - 1].config.body = bodyNodePositions;
        } else if (node.config.body && typeof node.config.body === 'object') {
          const nestedPosition = currentPosition;
          extractNestedNodes(node.config.body, iteratePosition);
          flattenedNodes[iteratePosition - 1].config.body = nestedPosition;
        }
      }
    };
    
    // Process all top-level nodes
    for (const node of nodes) {
      extractNestedNodes(node, null);
    }
    
    console.log(`Flattened ${nodes.length} nodes into ${flattenedNodes.length} nodes`);
    
    const createdNodes = [];
    
    // Create each flattened node in the database
    for (const nodeData of flattenedNodes) {
      try {
        const node = await operatorService.createNode({
          type: nodeData.type,
          config: nodeData.config || nodeData.params,
          position: nodeData.position,
          description: nodeData.description,
          parent_position: nodeData.parent_position
        }, workflowId);
        createdNodes.push(node);
      } catch (error) {
        console.error('Failed to create node:', nodeData, error);
        throw error;
      }
    }
    
    res.json({
      success: true,
      nodes: createdNodes,
      message: `Created ${createdNodes.length} nodes in workflow ${workflowId}`
    });
  } catch (error) {
    next(error);
  }
});

// Execute a specific node
router.post('/execute-node', async (req, res, next) => {
  try {
    const { nodeId, workflowId } = req.body;
    console.log('Execute node request:', { nodeId, workflowId, nodeIdType: typeof nodeId });
    
    // Check if it's a mock node that hasn't been uploaded
    if (nodeId && typeof nodeId === 'string' && nodeId.startsWith('mock_')) {
      return res.status(400).json({ 
        error: 'Mock nodes must be uploaded to Supabase before execution. Click "Upload to Supabase" first.' 
      });
    }
    
    // Ensure nodeId is provided
    if (!nodeId) {
      return res.status(400).json({ 
        error: 'nodeId is required' 
      });
    }
    
    // Normal node execution
    const result = await operatorService.executeNode(nodeId, workflowId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Workflow management endpoints
router.get('/workflows', async (req, res, next) => {
  try {
    const workflows = await workflowService.listWorkflows();
    res.json(workflows);
  } catch (error) {
    next(error);
  }
});

router.get('/workflows/:id', async (req, res, next) => {
  try {
    const workflow = await workflowService.getWorkflow(req.params.id);
    res.json(workflow);
  } catch (error) {
    next(error);
  }
});

router.post('/workflows', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const workflow = await workflowService.createWorkflow({ name, description });
    res.json(workflow);
  } catch (error) {
    next(error);
  }
});

export default router;