import express from 'express';
import { DirectorService } from '../services/directorService.js';
import { WorkflowService } from '../services/workflowService.js';
import { PlanService } from '../services/planService.js';

const router = express.Router();
const directorService = new DirectorService();
const workflowService = new WorkflowService();
const planService = new PlanService();

// Chat endpoint - main conversation with director
router.post('/chat', async (req, res, next) => {
  try {
    const { message, workflowId, conversationHistory, mockMode } = req.body;
    
    const response = await directorService.processMessage({
      message,
      workflowId,
      conversationHistory,
      mockMode
    });
    
    console.log('Director response:', JSON.stringify(response, null, 2));
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
        const node = await directorService.createNode({
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
    const result = await directorService.executeNode(nodeId, workflowId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Execute a specific iteration of an iterate node
router.post('/execute-iteration', async (req, res, next) => {
  try {
    const { nodeId, workflowId, iterationIndex, iterationData } = req.body;
    console.log('Execute iteration request:', { nodeId, workflowId, iterationIndex });
    
    if (!nodeId || !workflowId || iterationIndex === undefined) {
      return res.status(400).json({ 
        error: 'nodeId, workflowId, and iterationIndex are required' 
      });
    }
    
    const result = await directorService.executeIteration(nodeId, workflowId, iterationIndex, iterationData);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Execute a single step within an iteration context
router.post('/execute-iteration-step', async (req, res, next) => {
  try {
    const { nodeId, workflowId, iterationIndex, iterationData, variable, parentNodeId } = req.body;
    console.log('Execute iteration step request:', { nodeId, iterationIndex, variable });
    
    if (!nodeId || !workflowId || iterationIndex === undefined || !variable || !parentNodeId) {
      return res.status(400).json({ 
        error: 'nodeId, workflowId, iterationIndex, variable, and parentNodeId are required' 
      });
    }
    
    // Get parent node position
    const { data: parentNode } = await directorService.supabase
      .from('nodes')
      .select('position')
      .eq('id', parentNodeId)
      .single();
    
    if (!parentNode) {
      return res.status(404).json({ error: 'Parent node not found' });
    }
    
    // Use the nodeExecutor to set up iteration context and execute the step
    const executor = directorService.nodeExecutor;
    
    // Push iteration context with parent node position
    executor.pushIterationContext(parentNode.position, iterationIndex, variable, 1);
    
    try {
      // Store the iteration variable in memory
      const varKey = executor.getStorageKey(variable);
      await directorService.supabase
        .from('workflow_memory')
        .upsert({
          workflow_id: workflowId,
          key: varKey,
          value: iterationData
        });
      
      // Execute the node with iteration context
      const result = await executor.execute(nodeId, workflowId, { previewOnly: false });
      
      res.json({
        success: true,
        result,
        iterationIndex,
        nodeId
      });
    } finally {
      // Always pop the iteration context
      executor.popIterationContext();
    }
  } catch (error) {
    console.error('Failed to execute iteration step:', error);
    next(error);
  }
});

// Get iteration preview data for an iterate node
router.get('/nodes/:nodeId/iteration-preview', async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    console.log(`[ITERATION PREVIEW] Fetching preview for node ${nodeId}`);
    
    // Fetch the node
    const { data: node, error } = await directorService.supabase
      .from('nodes')
      .select('*')
      .eq('id', nodeId)
      .single();
      
    if (error || !node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    
    if (node.type !== 'iterate') {
      return res.status(400).json({ error: 'Node is not an iterate type' });
    }
    
    // Get the collection to iterate over
    const executor = directorService.nodeExecutor;
    const collection = await executor.getStateValue(
      node.params.over.replace('state.', ''), 
      node.workflow_id
    );
    
    if (!Array.isArray(collection)) {
      return res.json({ 
        items: [],
        message: 'Collection not found or not an array'
      });
    }
    
    // Get body node information
    let bodyNodes = [];
    if (Array.isArray(node.params.body) && node.params.body.length > 0 && typeof node.params.body[0] === 'number') {
      const { data: nodes } = await directorService.supabase
        .from('nodes')
        .select('*')
        .eq('workflow_id', node.workflow_id)
        .in('position', node.params.body)
        .order('position');
      
      bodyNodes = nodes || [];
    }
    
    // Create preview structure similar to executeIterate preview mode
    const preview = {
      iterationCount: collection.length,
      items: collection.map((item, idx) => ({
        index: idx,
        data: item,
        status: 'pending',
        results: []
      })),
      variable: node.params.variable || 'item',
      bodyNodePositions: node.params.body,
      bodyNodes: bodyNodes,
      status: 'preview',
      processed: 0,
      total: collection.length
    };
    
    res.json(preview);
  } catch (error) {
    console.error('Failed to get iteration preview:', error);
    next(error);
  }
});

// Get recent node values for display
router.get('/node-values/:workflowId', async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    
    // Get node values from the node executor
    const nodeValues = directorService.nodeExecutor.getRecentNodeValues();
    
    // Also fetch from database for persistence
    const { data: storedValues } = await directorService.supabase
      .from('workflow_memory')
      .select('key, value')
      .eq('workflow_id', workflowId)
      .like('key', 'node%');
    
    // Merge stored values with recent values
    const allValues = {};
    
    // Process stored values
    if (storedValues) {
      for (const item of storedValues) {
        const match = item.key.match(/^node(\d+)(?:@iter:(.+))?$/);
        if (match) {
          const position = match[1];
          const iterContext = match[2];
          allValues[item.key] = {
            position: parseInt(position),
            value: directorService.nodeExecutor.simplifyValue(item.value),
            storageKey: item.key,
            fromDb: true
          };
        }
      }
    }
    
    // Override with recent values (fresher)
    for (const [nodeId, data] of Object.entries(nodeValues)) {
      allValues[data.storageKey] = {
        ...data,
        nodeId,
        fromDb: false
      };
    }
    
    res.json(allValues);
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

// Browser session management endpoints
router.post('/browser/restart', async (req, res, next) => {
  try {
    const result = await directorService.nodeExecutor.restartBrowser();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/browser/sessions', async (req, res, next) => {
  try {
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Session name is required' });
    }
    
    const session = await directorService.nodeExecutor.saveBrowserSession(name, description);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.get('/browser/sessions', async (req, res, next) => {
  try {
    const sessions = await directorService.nodeExecutor.listBrowserSessions();
    res.json(sessions);
  } catch (error) {
    next(error);
  }
});

router.post('/browser/sessions/:name/load', async (req, res, next) => {
  try {
    const { name } = req.params;
    const session = await directorService.nodeExecutor.loadBrowserSession(name);
    res.json(session);
  } catch (error) {
    next(error);
  }
});

router.delete('/browser/sessions/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    await directorService.nodeExecutor.deleteBrowserSession(name);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Plan management endpoints
router.get('/workflows/:id/plan', async (req, res, next) => {
  try {
    const plan = await planService.getCurrentPlan(req.params.id);
    res.json(plan || { message: 'No plan found' });
  } catch (error) {
    next(error);
  }
});

router.get('/workflows/:id/plan/history', async (req, res, next) => {
  try {
    const history = await planService.getPlanHistory(req.params.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Variable management endpoints
router.get('/workflows/:id/variables', async (req, res, next) => {
  try {
    const variables = await directorService.variableManagementService.getAllVariables(req.params.id);
    res.json(variables);
  } catch (error) {
    next(error);
  }
});

router.get('/workflows/:id/variables/formatted', async (req, res, next) => {
  try {
    const formattedVariables = await directorService.variableManagementService.getFormattedVariables(req.params.id);
    res.json({ formattedDisplay: formattedVariables });
  } catch (error) {
    next(error);
  }
});

// Reasoning token metrics endpoint
router.get('/workflows/:id/reasoning-metrics', async (req, res, next) => {
  try {
    const { id: workflowId } = req.params;
    const { limit = 10 } = req.query;

    const { data: metrics, error } = await directorService.supabase
      .from('reasoning_context')
      .select('conversation_turn, token_counts, created_at')
      .eq('workflow_id', workflowId)
      .order('conversation_turn', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // Calculate totals and trends
    let totalTokens = 0;
    let totalReasoningTokens = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    const formattedMetrics = (metrics || []).map(metric => {
      const tokens = metric.token_counts;
      totalTokens += tokens.total_tokens || 0;
      totalReasoningTokens += tokens.reasoning_tokens || 0;
      totalInputTokens += tokens.input_tokens || 0;
      totalOutputTokens += tokens.output_tokens || 0;

      return {
        turn: metric.conversation_turn,
        timestamp: metric.created_at,
        tokens: {
          input: tokens.input_tokens || 0,
          output: tokens.output_tokens || 0,
          reasoning: tokens.reasoning_tokens || 0,
          total: tokens.total_tokens || 0,
          reasoning_percentage: tokens.reasoning_tokens > 0 
            ? ((tokens.reasoning_tokens / tokens.total_tokens) * 100).toFixed(1) 
            : 0
        }
      };
    });

    const summary = {
      total_conversations: metrics?.length || 0,
      cumulative_tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        reasoning: totalReasoningTokens,
        total: totalTokens,
        average_reasoning_percentage: totalTokens > 0 
          ? ((totalReasoningTokens / totalTokens) * 100).toFixed(1) 
          : 0
      },
      latest_turn: formattedMetrics[0] || null
    };

    res.json({
      summary,
      metrics: formattedMetrics
    });
  } catch (error) {
    next(error);
  }
});

// SSE endpoint for real-time reasoning thinking
router.get('/workflows/:workflowId/thinking', (req, res) => {
  const { workflowId } = req.params;
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Send initial connection confirmation
  res.write(`data: ${JSON.stringify({ type: 'connected', workflowId })}\n\n`);

  // Store this connection for broadcasting thinking events
  // We'll implement the broadcasting in the director service
  const connectionId = `${workflowId}_${Date.now()}`;
  
  // Clean up on client disconnect
  req.on('close', () => {
    console.log(`[SSE] Client disconnected from thinking stream: ${connectionId}`);
  });

  // Keep connection alive with periodic heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// Token statistics endpoint
router.get('/workflows/:id/token-stats', async (req, res, next) => {
  try {
    const { id: workflowId } = req.params;
    
    if (!workflowId) {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    const tokenStats = directorService.tokenCounter.getTokenStats(workflowId);
    
    res.json({
      success: true,
      workflowId,
      tokenStats
    });
  } catch (error) {
    console.error('[API] Error getting token stats:', error);
    next(error);
  }
});

export default router;