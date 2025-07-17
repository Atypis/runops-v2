import express from 'express';
import { DirectorService } from '../services/directorService.js';
import { WorkflowService } from '../services/workflowService.js';
import { PlanService } from '../services/planService.js';
import { WorkflowDescriptionService } from '../services/workflowDescriptionService.js';
import { ConversationService } from '../services/conversationService.js';
import { VariableManagementService } from '../services/variableManagementService.js';

const router = express.Router();
const directorService = new DirectorService();
const workflowService = new WorkflowService();
const planService = new PlanService();
const workflowDescriptionService = new WorkflowDescriptionService();
const conversationService = new ConversationService();

// Chat endpoint - main conversation with director
router.post('/chat', async (req, res, next) => {
  try {
    const { message, workflowId, conversationHistory, mockMode, selectedModel } = req.body;
    
    // Log incoming request details
    console.log('[DIRECTOR ROUTE] Incoming chat request:');
    console.log(`[DIRECTOR ROUTE] Workflow: ${workflowId}`);
    console.log(`[DIRECTOR ROUTE] Mock Mode: ${mockMode}`);
    console.log(`[DIRECTOR ROUTE] Selected Model: ${selectedModel || 'not specified'}`);
    
    const response = await directorService.processMessage({
      message,
      workflowId,
      conversationHistory,
      mockMode,
      selectedModel
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
    
    // Set workflow ID for browser state tracking
    directorService.nodeExecutor.setWorkflowId(workflowId);
    
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
      const { data, error } = await directorService.supabase
        .from('workflow_memory')
        .upsert({
          workflow_id: workflowId,
          key: varKey,
          value: iterationData
        }, { onConflict: 'workflow_id,key' })
        .select();
        
      if (error) {
        console.error(`[ITERATION STEP] Failed to store iteration variable:`, error);
        throw error;
      }
      
      console.log(`[ITERATION STEP] Stored iteration variable '${varKey}' = ${JSON.stringify(iterationData)}`);
      
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
  const ms = Date.now();
  const timestamp = new Date().toISOString();
  const { nodeId } = req.params;
  
  try {
    
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
    
    // Clear any previous error state on the node
    if (node.status === 'failed') {
      console.log(`[ITERATION PREVIEW] Clearing error state for node ${nodeId}`);
      await directorService.supabase
        .from('nodes')
        .update({ 
          status: 'pending',
          result: null 
        })
        .eq('id', nodeId);
    }
    
    // Use the unified executeIterate method with preview mode
    const executor = directorService.nodeExecutor;
    
    // First resolve the node parameters using the same logic as execution
    const resolveStart = Date.now();
    const resolvedParams = await executor.resolveNodeParams(node.params, node.workflow_id);
    
    // Call executeIterate with preview mode (previewOnly defaults to true)
    const executeStart = Date.now();
    const preview = await executor.executeIterate(
      resolvedParams, 
      node.workflow_id, 
      node.position, 
      { previewOnly: true }
    );
    const executeDuration = Date.now() - executeStart;
    
    const totalDuration = Date.now() - ms;
    console.log(`Preview for node ${nodeId} completed - items: ${preview.iterationCount}, duration: ${totalDuration}ms`);
    res.json(preview);
  } catch (error) {
    console.error(`Error getting preview for node ${nodeId}:`, error.message);
    res.status(500).json({ 
      error: { 
        message: error.message, 
        status: 500 
      } 
    });
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

// Workflow description endpoints
router.get('/workflows/:id/description', async (req, res, next) => {
  try {
    const description = await workflowDescriptionService.getCurrentDescription(req.params.id);
    if (!description) {
      return res.status(404).json({ message: 'No description found' });
    }
    res.json(description);
  } catch (error) {
    next(error);
  }
});

router.get('/workflows/:id/description/history', async (req, res, next) => {
  try {
    const history = await workflowDescriptionService.getDescriptionHistory(req.params.id);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Variable management endpoints
router.get('/workflows/:id/variables', async (req, res, next) => {
  const ms = Date.now();
  const workflowId = req.params.id;
  try {
    const variables = await directorService.variableManagementService.getAllVariables(workflowId);
    res.json(variables);
  } catch (error) {
    console.error(`[API_VARS ${ms}] ERROR - ${error.message}`);
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

// Browser state endpoint
router.get('/workflows/:id/browser-state', async (req, res, next) => {
  try {
    const browserStateContext = await directorService.browserStateService.getBrowserStateContext(req.params.id);
    const rawBrowserState = await directorService.browserStateService.getBrowserState(req.params.id);
    res.json({ 
      formattedDisplay: browserStateContext,
      rawState: rawBrowserState 
    });
  } catch (error) {
    next(error);
  }
});

// Real-time browser state updates via Server-Sent Events
router.get('/workflows/:id/browser-state/stream', (req, res, next) => {
  try {
    const workflowId = req.params.id;
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];
    
    console.log(`[SSE] New browser state connection for workflow: ${workflowId}`);
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
      'X-Accel-Buffering': 'no' // Disable proxy buffering
    });

    // Send initial browser state
    const sendInitialState = async () => {
      try {
        const browserStateContext = await directorService.browserStateService.getBrowserStateContext(workflowId);
        const rawBrowserState = await directorService.browserStateService.getBrowserState(workflowId);
        
        const data = JSON.stringify({
          type: 'browserStateUpdate',
          formattedDisplay: browserStateContext,
          rawState: rawBrowserState,
          timestamp: new Date().toISOString()
        });
        
        console.log(`[SSE] Writing initial state to response stream...`);
        res.write(`data: ${data}\n\n`);
        console.log(`[SSE] Successfully sent initial browser state for workflow: ${workflowId}`);
      } catch (error) {
        console.error(`[SSE] ERROR sending initial browser state:`, error);
        console.error(`[SSE] Error stack:`, error.stack);
      }
    };

    sendInitialState();

    // Register this connection with the browser state service for updates
    directorService.browserStateService.addSSEConnection(workflowId, res);

    // Keep connection alive with heartbeat
    let heartbeatCount = 0;
    const heartbeat = setInterval(() => {
      try {
        heartbeatCount++;
        const heartbeatMsg = `: heartbeat #${heartbeatCount} at ${new Date().toISOString()}\n\n`;
        res.write(heartbeatMsg);
        console.log(`[SSE] Heartbeat #${heartbeatCount} sent for workflow ${workflowId}`);
      } catch (error) {
        console.error(`[SSE] Heartbeat failed for workflow ${workflowId}:`, error.message);
        clearInterval(heartbeat);
        directorService.browserStateService.removeSSEConnection(workflowId, res, 'heartbeat_failed');
      }
    }, 30000); // Every 30 seconds

    // Handle client disconnect
    req.on('close', () => {
      console.log(`[SSE] Browser state stream closed for workflow: ${workflowId}`);
      clearInterval(heartbeat);
      directorService.browserStateService.removeSSEConnection(workflowId, res, 'client_closed');
    });

    // Handle errors
    req.on('error', (error) => {
      console.error(`[SSE] Request error for workflow ${workflowId}:`, error.message);
      clearInterval(heartbeat);
      directorService.browserStateService.removeSSEConnection(workflowId, res, `request_error: ${error.message}`);
    });

  } catch (error) {
    next(error);
  }
});

// Real-time tool call updates via Server-Sent Events
router.get('/workflows/:id/tool-calls/stream', async (req, res, next) => {
  try {
    const workflowId = req.params.id;
    console.log(`[SSE] New tool call stream connection for workflow: ${workflowId}`);
    
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });
    
    // Send initial connected event
    res.write(`data: ${JSON.stringify({ type: 'connected', workflowId })}\n\n`);
    
    // Register this connection with the director service for tool call updates
    directorService.addToolCallSSEConnection(workflowId, res);
    
    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch (error) {
        clearInterval(heartbeat);
      }
    }, 30000);
    
    // Handle client disconnect
    req.on('close', () => {
      console.log(`[SSE] Tool call stream closed for workflow: ${workflowId}`);
      clearInterval(heartbeat);
      directorService.removeToolCallSSEConnection(workflowId, res);
    });

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

// Conversation history endpoints
router.get('/workflows/:id/conversations', async (req, res, next) => {
  try {
    const { id: workflowId } = req.params;
    const { limit = 100 } = req.query;
    
    const history = await conversationService.getConversationHistory(workflowId, parseInt(limit));
    const formatted = conversationService.formatMessagesForDisplay(history);
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

router.get('/workflows/:id/conversations/recent', async (req, res, next) => {
  try {
    const { id: workflowId } = req.params;
    const { count = 10 } = req.query;
    
    const messages = await conversationService.getRecentMessages(workflowId, parseInt(count));
    const formatted = conversationService.formatMessagesForDisplay(messages);
    
    res.json(formatted);
  } catch (error) {
    next(error);
  }
});

router.delete('/workflows/:id/conversations', async (req, res, next) => {
  try {
    const { id: workflowId } = req.params;
    
    const result = await conversationService.clearConversationHistory(workflowId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Compress context endpoint
router.post('/compress-context', async (req, res, next) => {
  try {
    const { workflowId, messageCount } = req.body;
    
    if (!workflowId) {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }
    
    // Get only non-archived messages (messages since last compression)
    const { data: conversationHistory, error: historyError } = await directorService.supabase
      .from('conversations')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('is_archived', false)
      .order('timestamp', { ascending: true });
    
    if (historyError) {
      console.error('Failed to load conversation history:', historyError);
      return res.status(500).json({ error: 'Failed to load conversation history' });
    }
    
    // Check if there's anything to compress
    if (!conversationHistory || conversationHistory.length === 0) {
      return res.status(400).json({ 
        error: 'No new messages to compress. All messages are already archived.' 
      });
    }
    
    // Get the last compressed context to include in the prompt for continuity
    const { data: lastCompression } = await directorService.supabase
      .from('compressed_contexts')
      .select('summary, created_at')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    // Build compression context
    const compressionContext = await directorService.buildCompressionContext(workflowId);
    
    // Create compression prompt
    const compressionPrompt = `You are the Director, an AI Workflow Automation Engineer who has been working with the user to build browser automations. 

You've been asked to compress the recent conversation history to manage token usage while preserving continuity. A future instance of yourself will take over from here.

${lastCompression ? `PREVIOUS COMPRESSION SUMMARY (for context):
================================================================================
${lastCompression.summary}
================================================================================

` : ''}
YOUR CRITICAL TASK:
1. **READ THE CONVERSATION HISTORY BELOW (messages since last compression)**
2. **CREATE A UNIFIED SUMMARY** that combines the previous summary with new developments
3. Create a comprehensive summary that captures:
   - What the user originally asked for
   - What has been built/attempted so far
   - Key decisions and their rationale
   - Problems encountered and solutions found
   - The current state of the work
   - What remains to be done

IMPORTANT: The following context will persist and be shown to the next Director (so DON'T repeat these):
1. System Prompt (your core instructions)
2. Workflow Description (the requirements)
3. Current Plan (implementation roadmap)  
4. Workflow Snapshot (all created nodes)
5. Workflow Variables (current state)
6. Browser State (active tabs)

WHAT TO EXTRACT FROM THE CONVERSATION:
- The user's initial request and how it evolved
- Attempted approaches that failed and why
- UI quirks or discoveries not reflected in nodes
- User preferences or clarifications about requirements
- Debugging insights or patterns discovered
- Context about WHY certain decisions were made
- Any promises or commitments made to the user
- Unresolved questions or next steps
- Key technical details discovered during implementation

Write your summary as if briefing your replacement who needs to understand the FULL context of what transpired. Be comprehensive but concise.

================================================================================
RECENT CONVERSATION HISTORY TO COMPRESS (${conversationHistory.length} messages since last compression):
================================================================================

${conversationService.formatMessagesForDisplay(conversationHistory).map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join('\n\n')}

================================================================================
PERSISTENT CONTEXT (FYI - this will remain available):
================================================================================

${compressionContext}`;
    
    // Process with Director
    const compressionResponse = await directorService.processMessage({
      message: compressionPrompt,
      workflowId,
      conversationHistory: [],
      isCompressionRequest: true
    });
    
    // Save compressed context to database
    console.log('Attempting to save compressed context for workflow:', workflowId);
    console.log('Summary length:', compressionResponse.message?.length);
    
    const insertData = {
      workflow_id: workflowId,
      summary: compressionResponse.message || 'No summary generated',
      original_message_count: messageCount || conversationHistory.length,
      compression_ratio: conversationHistory.length > 0 
        ? (compressionResponse.message.length / JSON.stringify(conversationHistory).length) 
        : 0,
      created_by: 'manual'
    };
    
    console.log('Insert data:', insertData);
    
    const { data: compressedContext, error: saveError } = await directorService.supabase
      .from('compressed_contexts')
      .insert(insertData)
      .select()
      .single();
    
    if (saveError) {
      console.error('Failed to save compressed context:', saveError);
      console.error('Save error details:', JSON.stringify(saveError, null, 2));
      throw new Error(`Database error: ${saveError.message || saveError.code || 'Unknown error'}`);
    }
    
    // Mark only the compressed messages as archived (not ALL messages)
    const messageIds = conversationHistory.map(msg => msg.id);
    if (messageIds.length > 0) {
      await directorService.supabase
        .from('conversations')
        .update({ is_archived: true })
        .in('id', messageIds);
    }
    
    // Save the compressed summary as a special message
    await conversationService.saveMessage(
      workflowId,
      'system',
      compressionResponse.message,
      {
        isCompressed: true,
        compressionStats: {
          originalMessageCount: messageCount || conversationHistory.length,
          compressionRatio: compressedContext.compression_ratio
        }
      }
    );
    
    res.json({
      success: true,
      summary: compressionResponse.message,
      originalMessageCount: messageCount || conversationHistory.length,
      compressionRatio: compressedContext.compression_ratio,
      compressedContextId: compressedContext.id
    });
  } catch (error) {
    console.error('Failed to compress context:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      workflowId,
      messageCount
    });
    res.status(500).json({ 
      error: error.message || 'Failed to compress context',
      details: error.toString() 
    });
  }
});

// List all group nodes in a workflow
router.get('/groups/:workflowId', async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    console.log(`[ROUTE /groups/:workflowId] Fetching group nodes for workflow: ${workflowId}`);
    
    // Get all nodes of type 'group' from the workflow
    const { data: nodes, error } = await directorService.supabase
      .from('nodes')
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('type', 'group')
      .order('position');
    
    if (error) {
      throw error;
    }
    
    const result = {
      groups: nodes || [],
      count: nodes?.length || 0
    };
    
    console.log(`[ROUTE /groups/:workflowId] Returning ${result.count} group nodes`);
    res.json(result);
  } catch (error) {
    console.error(`[ROUTE /groups/:workflowId] Error:`, error);
    next(error);
  }
});

// Execute nodes by selection range
router.post('/execute-range', async (req, res, next) => {
  try {
    const { workflowId, nodeSelection, resetBrowserFirst = false } = req.body;
    
    if (!workflowId || !nodeSelection) {
      return res.status(400).json({ 
        error: 'workflowId and nodeSelection are required' 
      });
    }
    
    console.log(`[EXECUTE_RANGE] Request to execute nodes: ${nodeSelection} for workflow: ${workflowId}`);
    
    // Set workflow ID for browser state tracking
    directorService.nodeExecutor.setWorkflowId(workflowId);
    
    // Use existing executeNodes function from directorService
    const result = await directorService.executeNodes(
      { nodeSelection, resetBrowserFirst },
      workflowId
    );
    
    res.json(result);
  } catch (error) {
    console.error('[EXECUTE_RANGE] Error:', error);
    next(error);
  }
});

// Save a named group
router.post('/workflows/:workflowId/groups', async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    const { name, nodeSelection, description } = req.body;
    
    if (!name || !nodeSelection) {
      return res.status(400).json({ 
        error: 'name and nodeSelection are required' 
      });
    }
    
    console.log(`[SAVE_GROUP] Saving group "${name}" with selection "${nodeSelection}" for workflow ${workflowId}`);
    
    // Store in workflow memory
    const { error } = await directorService.supabase
      .from('workflow_memory')
      .upsert({
        workflow_id: workflowId,
        key: `saved_group_${name.toLowerCase().replace(/\s+/g, '_')}`,
        value: {
          name,
          nodeSelection,
          description: description || '',
          createdAt: new Date().toISOString()
        }
      });
    
    if (error) throw error;
    
    res.json({ success: true, message: `Group "${name}" saved successfully` });
  } catch (error) {
    console.error('[SAVE_GROUP] Error:', error);
    next(error);
  }
});

// Get all saved groups for a workflow
router.get('/workflows/:workflowId/saved-groups', async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    
    console.log(`[GET_GROUPS] Fetching saved groups for workflow ${workflowId}`);
    
    const { data, error } = await directorService.supabase
      .from('workflow_memory')
      .select('key, value')
      .eq('workflow_id', workflowId)
      .like('key', 'saved_group_%')
      .order('value->createdAt', { ascending: false });
    
    if (error) throw error;
    
    // Transform the data to a cleaner format
    const groups = (data || []).map(item => ({
      id: item.key.replace('saved_group_', ''),
      ...item.value
    }));
    
    res.json({ groups });
  } catch (error) {
    console.error('[GET_GROUPS] Error:', error);
    next(error);
  }
});

// Delete a saved group
router.delete('/workflows/:workflowId/groups/:groupId', async (req, res, next) => {
  try {
    const { workflowId, groupId } = req.params;
    
    console.log(`[DELETE_GROUP] Deleting group "${groupId}" for workflow ${workflowId}`);
    
    const { error } = await directorService.supabase
      .from('workflow_memory')
      .delete()
      .eq('workflow_id', workflowId)
      .eq('key', `saved_group_${groupId}`);
    
    if (error) throw error;
    
    res.json({ success: true, message: `Group "${groupId}" deleted successfully` });
  } catch (error) {
    console.error('[DELETE_GROUP] Error:', error);
    next(error);
  }
});

// Old group endpoints removed - group functionality is now handled by the 'group' node type

// Debug endpoint to manually trigger iteration variable cleanup
router.post('/workflows/:workflowId/cleanup-iteration-vars', async (req, res, next) => {
  try {
    const { workflowId } = req.params;
    const { nodePositions } = req.body;
    
    console.log(`[ROUTE /cleanup-iteration-vars] Manual cleanup requested for workflow ${workflowId}`);
    
    const variableService = new VariableManagementService();
    
    if (nodePositions && Array.isArray(nodePositions)) {
      // Clean up specific node positions
      await variableService.cleanupIterationVariables(workflowId, nodePositions);
      res.json({ 
        success: true, 
        message: `Cleaned up iteration variables for nodes: ${nodePositions.join(', ')}` 
      });
    } else {
      // Clean up all iteration variables
      const result = await variableService.cleanupAllIterationVariables(workflowId);
      res.json({ 
        success: true, 
        message: `Cleaned up all iteration variables`,
        ...result
      });
    }
  } catch (error) {
    console.error(`[ROUTE /cleanup-iteration-vars] Error:`, error);
    next(error);
  }
});

export default router;