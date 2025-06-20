import express from 'express';
import { OperatorService } from '../services/operatorService.js';
import { WorkflowService } from '../services/workflowService.js';

const router = express.Router();
const operatorService = new OperatorService();
const workflowService = new WorkflowService();

// Chat endpoint - main conversation with operator
router.post('/chat', async (req, res, next) => {
  try {
    const { message, workflowId, conversationHistory } = req.body;
    
    const response = await operatorService.processMessage({
      message,
      workflowId,
      conversationHistory
    });
    
    console.log('Operator response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    next(error);
  }
});

// Execute a specific node
router.post('/execute-node', async (req, res, next) => {
  try {
    const { nodeId, workflowId } = req.body;
    
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