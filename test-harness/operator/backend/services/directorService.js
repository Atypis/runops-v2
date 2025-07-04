import OpenAI from 'openai';
import { Stagehand } from '@browserbasehq/stagehand';
import { DIRECTOR_SYSTEM_PROMPT } from '../prompts/directorPrompt.js';
import { createToolDefinitions } from '../tools/toolDefinitions.js';
import { NodeExecutor } from './nodeExecutor.js';
import { PlanService } from './planService.js';
import { VariableManagementService } from './variableManagementService.js';
import { TokenCounterService } from './tokenCounterService.js';
import { supabase } from '../config/supabase.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DirectorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.nodeExecutor = new NodeExecutor();
    this.planService = new PlanService();
    this.variableManagementService = new VariableManagementService();
    this.tokenCounter = new TokenCounterService();
    this.supabase = supabase;
  }

  async processMessage({ message, workflowId, conversationHistory = [], mockMode = false }) {
    try {
      // Check for mock mode
      if (mockMode || process.env.MOCK_DIRECTOR_MODE === 'true') {
        console.log('\n[MOCK DIRECTOR] Received message:', message);
        console.log('[MOCK DIRECTOR] Workflow ID:', workflowId);
        console.log('[MOCK DIRECTOR] Reading response from mock-director/response.json\n');
        
        try {
          const mockResponsePath = path.join(__dirname, '../../mock-director/response.json');
          const mockResponseData = await fs.readFile(mockResponsePath, 'utf-8');
          const mockResponse = JSON.parse(mockResponseData);
          
          // Process group definitions if present
          if (mockResponse.groupDefinitions) {
            console.log('[MOCK DIRECTOR] Processing group definitions');
            for (const [groupId, definition] of Object.entries(mockResponse.groupDefinitions)) {
              await this.storeGroupDefinition(groupId, definition, workflowId);
              // Also set in memory for immediate use
              this.nodeExecutor.setGroupDefinition(groupId, definition);
            }
          }
          
          // If there are tool calls in the mock response, process them
          if (mockResponse.toolCalls) {
            const processedToolCalls = await this.processToolCalls(
              mockResponse.toolCalls.map(tc => ({
                id: tc.toolCallId || `mock_${Date.now()}`,
                function: {
                  name: tc.toolName,
                  arguments: JSON.stringify(tc.result || {})
                }
              })),
              workflowId
            );
            
            return {
              message: mockResponse.message || 'Mock operator response',
              toolCalls: processedToolCalls,
              workflowId,
              mockMode: true
            };
          }
          
          return {
            message: mockResponse.message || 'Mock operator response',
            workflowId,
            mockMode: true
          };
        } catch (error) {
          console.error('[MOCK OPERATOR] Error reading mock response:', error);
          return {
            message: 'Mock operator error: Please check mock-operator/response.json',
            workflowId,
            mockMode: true,
            error: error.message
          };
        }
      }

      // Normal operation - Build Director 2.0 context if workflowId provided
      let director2Context = '';
      if (workflowId) {
        director2Context = await this.buildDirector2Context(workflowId);
      }

      // Clean conversation history to only include essential fields for AI
      // This prevents exponential token growth from debug_input and other UI-only fields
      const cleanHistory = conversationHistory.map((msg, idx) => {
        // Log if we find director2Context in historical messages
        if (msg.content && msg.content.includes('(2) CURRENT PLAN')) {
          console.log(`[🔍 CONTEXT_STRIP] Found director2Context in history at index ${idx} (${msg.role}), stripping it...`);
          console.log(`[🔍 CONTEXT_STRIP] Original length: ${msg.content.length}, After strip: ${msg.content.split('\n\n(2) CURRENT PLAN')[0].trim().length}`);
        }
        
        return {
          role: msg.role,
          // CRITICAL: Strip any existing director2Context from historical messages to prevent duplication
          content: msg.content ? msg.content.split('\n\n(2) CURRENT PLAN')[0].trim() : msg.content
          // Intentionally exclude: toolCalls, reasoning, tokenUsage, debug_input
        };
      }).filter(msg => msg.content !== null && msg.content !== undefined);

      // Check if the current message already has director2Context
      if (message && message.includes('(2) CURRENT PLAN')) {
        console.log(`[🔍 CURRENT_MESSAGE_WARNING] Current message ALREADY contains director2Context!`);
        console.log(`[🔍 CURRENT_MESSAGE_WARNING] This should not happen - frontend may be sending modified messages`);
      }
      
      // Build messages array with cleaned history
      const messages = [
        { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
        ...cleanHistory,
        { role: 'user', content: message }
      ];

      // Add Director 2.0 context to the latest message if available
      if (director2Context) {
        console.log(`[🔍 DIRECTOR_CONTEXT_DEBUG] Adding director2Context of length ${director2Context.length} to message at index ${messages.length - 1}`);
        console.log(`[🔍 DIRECTOR_CONTEXT_DEBUG] Historical messages have been stripped of any previous director2Context`);
        messages[messages.length - 1].content += `\n\n${director2Context}`;
      }
      
      // Add available environment variables for Gmail
      if (message.toLowerCase().includes('gmail') || message.toLowerCase().includes('google')) {
        messages[messages.length - 1].content += `\n\nAvailable credentials:\nGMAIL_EMAIL: ${process.env.GMAIL_EMAIL}\nGMAIL_PASSWORD: ${process.env.GMAIL_PASSWORD}`;
      }

      // Get model for this workflow - default to o4-mini for reasoning capabilities
      const model = process.env.DIRECTOR_MODEL || 'o4-mini';
      
      // 🔍 INTERCEPTOR: Log exact OpenAI input for debugging
      const debugInput = {
        messages: messages,
        model: model,
        total_chars: JSON.stringify(messages).length,
        total_messages: messages.length,
        message_breakdown: messages.map((m, i) => ({
          index: i,
          role: m.role,
          content_length: m.content ? m.content.length : 0,
          content_preview: m.content ? m.content.substring(0, 200) + (m.content.length > 200 ? '...' : '') : 'null'
        })),
        timestamp: new Date().toISOString()
      };
      
      console.log('[🔍 OPENAI_INTERCEPTOR] Exact input being sent:');
      console.log('[🔍 OPENAI_INTERCEPTOR] Model:', model);
      console.log('[🔍 OPENAI_INTERCEPTOR] Message count:', messages.length);
      console.log('[🔍 OPENAI_INTERCEPTOR] Total characters:', JSON.stringify(messages).length);
      console.log('[🔍 OPENAI_INTERCEPTOR] Message breakdown:');
      debugInput.message_breakdown.forEach(m => {
        console.log(`  [${m.index}] ${m.role}: ${m.content_length} chars - "${m.content_preview}"`);
      });
      
      // Route to appropriate API based on model type
      let completion;
      if (this.isReasoningModel(model)) {
        console.log(`[DIRECTOR] Using Responses API for reasoning model: ${model}`);
        completion = await this.processWithResponsesAPI(model, messages, workflowId);
      } else {
        console.log(`[DIRECTOR] Using Chat Completions API for model: ${model}`);
        completion = await this.openai.chat.completions.create({
          model,
          messages,
          tools: createToolDefinitions(),
          tool_choice: 'auto',
          temperature: 1
        });
      }

      const responseMessage = completion.choices[0].message;
      
      // Record token usage for this conversation
      // NOTE: For reasoning models with tool execution, this only records the INITIAL message tokens
      // not the accumulated tokens from recursive tool execution calls
      if (workflowId && completion.usage) {
        this.tokenCounter.recordUserMessage(workflowId, message);
        this.tokenCounter.recordTokenUsage(workflowId, completion.usage, 'assistant');
        console.log('[DIRECTOR] Token usage recorded for initial message (excludes internal tool execution tokens)');
      }
      
      // Check if this is a reasoning model response (has reasoning token usage)
      const isReasoningResponse = completion.usage && completion.usage.reasoning_tokens > 0;
      
      // Process any tool calls from traditional Chat Completions API
      if (responseMessage.tool_calls) {
        const toolResults = await this.processToolCalls(responseMessage.tool_calls, workflowId);
        
        return {
          message: responseMessage.content || '',  // Default to empty string if null
          toolCalls: toolResults,
          workflowId,
          input_tokens: completion.usage?.input_tokens || 0,
          output_tokens: completion.usage?.output_tokens || 0,
          debug_input: debugInput
        };
      }
      
      // Handle tools executed during reasoning (from Responses API)
      if (completion.executedTools && completion.executedTools.length > 0) {
        console.log(`[DIRECTOR] Reasoning model executed ${completion.executedTools.length} tools`);
        
        // Convert executed tools to the expected format for consistent response
        const toolResults = completion.executedTools.map(tool => ({
          toolName: tool.name,
          result: tool.result || { error: tool.error },
          success: !tool.error
        }));
        
        // Enhance the message with tool execution details if content is generic
        let finalMessage = responseMessage.content;
        if (!finalMessage || finalMessage.includes("completed the necessary actions")) {
          const toolNames = completion.executedTools.map(t => t.name).join(', ');
          finalMessage = `I've executed the following tools during reasoning: ${toolNames}. ` + 
                        (responseMessage.content || "Check the workflow for updates.");
        }
        
        return {
          message: finalMessage,
          toolCalls: toolResults,
          workflowId,
          reasoning_summary: completion.reasoning_summary,
          input_tokens: completion.usage?.input_tokens || 0,
          output_tokens: completion.usage?.output_tokens || 0,
          debug_input: debugInput
        };
      }

      // For reasoning models, provide better feedback when no visible content
      let finalMessage = responseMessage.content;
      if (!finalMessage) {
        if (isReasoningResponse) {
          finalMessage = "I've analyzed the request and completed the necessary actions. Check the workflow for any new nodes or updates.";
        } else {
          finalMessage = "I've completed the requested actions.";
        }
      }

      return {
        message: finalMessage,
        workflowId,
        reasoning_summary: completion.reasoning_summary,
        input_tokens: completion.usage?.input_tokens || 0,
        output_tokens: completion.usage?.output_tokens || 0,
        debug_input: debugInput
      };
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  async processToolCalls(toolCalls, workflowId) {
    const results = [];
    
    for (const toolCall of toolCalls) {
      const { name: toolName, arguments: toolArgs } = toolCall.function;
      const args = JSON.parse(toolArgs);
      
      try {
        let result;
        
        switch (toolName) {
          case 'create_workflow_sequence':
            result = await this.createWorkflowSequence(args, workflowId);
            break;
          case 'create_node':
            result = await this.createNode(args, workflowId);
            break;
          case 'update_node':
            result = await this.updateNode(args);
            break;
          case 'update_nodes':
            result = await this.updateNodes(args);
            break;
          case 'delete_node':
            result = await this.deleteNode(args);
            break;
          case 'delete_nodes':
            result = await this.deleteNodes(args);
            break;
          case 'connect_nodes':
            result = await this.connectNodes(args);
            break;
          case 'execute_workflow':
            result = await this.executeWorkflow(workflowId);
            break;
          case 'test_node':
            result = await this.testNode(args);
            break;
          case 'execute_nodes':
            result = await this.executeNodes(args, workflowId);
            break;
          case 'define_group':
            result = await this.defineGroup(args, workflowId);
            break;
          case 'use_group':
            result = await this.useGroup(args, workflowId);
            break;
          case 'list_groups':
            result = await this.listGroups(workflowId);
            break;
          case 'update_plan':
            result = await this.updatePlan(args, workflowId);
            break;
          case 'get_workflow_variable':
            result = await this.getWorkflowVariable(args, workflowId);
            break;
          case 'set_variable':
            result = await this.setVariable(args, workflowId);
            break;
          case 'clear_variable':
            result = await this.clearVariable(args, workflowId);
            break;
          case 'clear_all_variables':
            result = await this.clearAllVariables(args, workflowId);
            break;
          default:
            result = { error: `Unknown tool: ${toolName}` };
        }
        
        results.push({
          toolCallId: toolCall.id,
          toolName,
          result
        });
        console.log('Tool call result:', { toolName, result });
      } catch (error) {
        console.error(`Tool ${toolName} failed:`, error);
        results.push({
          toolCallId: toolCall.id,
          toolName,
          error: error.message
        });
        
        // If it's a config error, add a helpful message
        if (error.message.includes('requires configuration parameters')) {
          results.push({
            toolCallId: 'system',
            toolName: 'system_message',
            result: `Please retry with proper config parameters. Each node needs specific config fields. For example: memory nodes need {"operation": "set", "key": "name", "value": "data"}`
          });
        }
      }
    }
    
    return results;
  }

  async createWorkflowSequence({ nodes }, workflowId) {
    console.log('Creating workflow sequence with nodes:', JSON.stringify(nodes, null, 2));
    
    // Flatten the node structure to include nested nodes
    const flattenedNodes = [];
    let currentPosition = 1;
    
    // Get the current max position in this workflow
    const { data: maxPositionNode } = await supabase
      .from('nodes')
      .select('position')
      .eq('workflow_id', workflowId)
      .order('position', { ascending: false })
      .limit(1)
      .single();
    
    if (maxPositionNode?.position) {
      currentPosition = maxPositionNode.position + 1;
    }
    
    // Helper function to extract and flatten nested nodes
    const extractNestedNodes = async (node, parentPosition) => {
      // Create a copy of the node to avoid modifying the original
      const nodeToCreate = { ...node };
      nodeToCreate.position = currentPosition++;
      nodeToCreate.parent_position = parentPosition; // Track parent for UI filtering
      
      // If it's a route, extract nodes from paths
      if (node.type === 'route' && node.config?.paths) {
        const updatedPaths = {};
        
        for (const [pathName, pathNodes] of Object.entries(node.config.paths)) {
          const pathNodePositions = [];
          
          if (Array.isArray(pathNodes)) {
            for (const nestedNode of pathNodes) {
              const nestedPosition = currentPosition;
              pathNodePositions.push(nestedPosition);
              await extractNestedNodes(nestedNode, nodeToCreate.position);
            }
          }
          
          // Store the positions of nodes in this path for the route to reference
          updatedPaths[pathName] = pathNodePositions;
        }
        
        // Update the node config to reference positions instead of inline nodes
        nodeToCreate.config = { ...nodeToCreate.config, paths: updatedPaths };
      }
      
      // If it's an iterate, extract nodes from body
      if (node.type === 'iterate' && node.config?.body) {
        if (Array.isArray(node.config.body)) {
          const bodyNodePositions = [];
          for (const nestedNode of node.config.body) {
            const nestedPosition = currentPosition;
            bodyNodePositions.push(nestedPosition);
            await extractNestedNodes(nestedNode, nodeToCreate.position);
          }
          // Update iterate to reference positions
          nodeToCreate.config = { ...nodeToCreate.config, body: bodyNodePositions };
        } else if (node.config.body && typeof node.config.body === 'object') {
          const nestedPosition = currentPosition;
          await extractNestedNodes(node.config.body, nodeToCreate.position);
          nodeToCreate.config = { ...nodeToCreate.config, body: nestedPosition };
        }
      }
      
      
      flattenedNodes.push(nodeToCreate);
    };
    
    // Process all top-level nodes
    for (const node of nodes) {
      await extractNestedNodes(node, null);
    }
    
    console.log(`Flattened ${nodes.length} nodes into ${flattenedNodes.length} nodes`);
    
    const createdNodes = [];
    
    // Create each flattened node in the database
    for (const nodeData of flattenedNodes) {
      try {
        const node = await this.createNode({
          type: nodeData.type,
          config: nodeData.config,
          position: nodeData.position,
          description: nodeData.description,
          parent_position: nodeData.parent_position,
          group_id: nodeData.group_id,
          group_position: nodeData.group_position
        }, workflowId);
        createdNodes.push(node);
      } catch (error) {
        console.error('Failed to create node:', nodeData, error);
        throw error;
      }
    }
    
    return {
      message: `Created ${createdNodes.length} nodes`,
      nodes: createdNodes
    };
  }

  async createNode({ type, config, position, description, parent_position }, workflowId) {
    // Validate config based on node type
    if (!config || Object.keys(config).length === 0) {
      console.error(`Empty config provided for ${type} node`);
      throw new Error(`Node type '${type}' requires configuration parameters. See system prompt for examples.`);
    }
    
    // Type-specific validation
    switch (type) {
      case 'browser_action':
        if (!config.action) throw new Error('browser_action requires "action" field');
        break;
      case 'browser_query':
        if (!config.method || !config.instruction) throw new Error('browser_query requires "method" and "instruction" fields');
        break;
      case 'memory':
        if (!config.operation || !config.key) throw new Error('memory requires "operation" and "key" fields');
        break;
      case 'group':
        if (!config.nodeRange) throw new Error('group requires "nodeRange" field (e.g., "1-25" or [1, 25])');
        break;
    }
    
    // If position is provided, use it; otherwise get the next available position
    let nodePosition = position;
    
    if (!nodePosition) {
      // Get the max position for this workflow
      const { data: maxPositionNode } = await supabase
        .from('nodes')
        .select('position')
        .eq('workflow_id', workflowId)
        .order('position', { ascending: false })
        .limit(1)
        .single();
      
      nodePosition = (maxPositionNode?.position || 0) + 1;
    }
    
    const nodeData = {
      workflow_id: workflowId,
      position: nodePosition,
      type,
      params: config || {},  // Ensure params is never null
      description: description || `${type} node`,
      status: 'pending'
    };
    
    // Add parent_position to params if provided (since we don't have a DB column for it)
    // Exception: Group nodes should always be top-level
    if (parent_position !== undefined && parent_position !== null && type !== 'group') {
      nodeData.params._parent_position = parent_position;
    }
    
    const { data: node, error } = await supabase
      .from('nodes')
      .insert(nodeData)
      .select()
      .single();
      
    if (error) throw error;
    return node;
  }

  async updateNode({ nodeId, updates }) {
    console.log(`[UPDATE_NODE] Called with:`, JSON.stringify({ nodeId, updates }, null, 2));
    
    // Validate inputs
    if (!nodeId) {
      throw new Error('nodeId is required for update_node');
    }
    
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      console.error('[UPDATE_NODE] Invalid updates object:', updates);
      throw new Error('updates must be a non-empty object');
    }
    
    // Map 'config' to 'params' to match database schema
    const mappedUpdates = { ...updates };
    if ('config' in mappedUpdates) {
      mappedUpdates.params = mappedUpdates.config;
      delete mappedUpdates.config;
      console.log('[UPDATE_NODE] Mapped "config" to "params" for database compatibility');
    }
    
    // Validate that only valid fields are being updated
    const validFields = ['type', 'params', 'description', 'status', 'result', 'position'];
    const updateFields = Object.keys(mappedUpdates);
    const invalidFields = updateFields.filter(field => !validFields.includes(field));
    
    if (invalidFields.length > 0) {
      console.error('[UPDATE_NODE] Invalid fields detected:', invalidFields);
      console.log('[UPDATE_NODE] Valid fields are:', validFields);
      throw new Error(`Invalid update fields: ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`);
    }
    
    // Log what we're trying to update
    console.log('[UPDATE_NODE] Attempting to update node:', nodeId);
    console.log('[UPDATE_NODE] Mapped update payload:', JSON.stringify(mappedUpdates, null, 2));
    
    const { data: node, error } = await supabase
      .from('nodes')
      .update(mappedUpdates)
      .eq('id', nodeId)
      .select()
      .single();
      
    if (error) {
      console.error('[UPDATE_NODE] Supabase error:', error);
      throw error;
    }
    
    console.log('[UPDATE_NODE] Successfully updated node:', JSON.stringify(node, null, 2));
    return node;
  }

  async deleteNode({ nodeId }) {
    const { error } = await supabase
      .from('nodes')
      .delete()
      .eq('id', nodeId);
      
    if (error) throw error;
    return { success: true };
  }

  async deleteNodes({ nodeIds }) {
    // Delete multiple nodes in a single operation
    const { error } = await supabase
      .from('nodes')
      .delete()
      .in('id', nodeIds);
      
    if (error) throw error;
    return { success: true, deletedCount: nodeIds.length };
  }

  async updateNodes({ updates }) {
    console.log(`[UPDATE_NODES] Called with:`, JSON.stringify({ updates }, null, 2));
    
    // Validate inputs
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      throw new Error('updates must be a non-empty array of {nodeId, updates} objects');
    }
    
    const results = [];
    const errors = [];
    
    // Process each update
    for (const update of updates) {
      if (!update.nodeId) {
        errors.push({ error: 'Missing nodeId in update object', update });
        continue;
      }
      
      try {
        const result = await this.updateNode({
          nodeId: update.nodeId,
          updates: update.updates
        });
        results.push({ nodeId: update.nodeId, success: true, node: result });
      } catch (error) {
        console.error(`[UPDATE_NODES] Failed to update node ${update.nodeId}:`, error);
        errors.push({ nodeId: update.nodeId, error: error.message });
      }
    }
    
    return {
      success: errors.length === 0,
      updated: results.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  async connectNodes({ sourceNodeId, targetNodeId }) {
    // In the current schema, connections are implicit through position ordering
    // This function can be a no-op or we can track connections separately
    return { 
      success: true, 
      message: 'Nodes are connected by position order' 
    };
  }

  async executeNode(nodeId, workflowId) {
    return await this.nodeExecutor.execute(nodeId, workflowId);
  }

  async executeIteration(nodeId, workflowId, iterationIndex, iterationData) {
    return await this.nodeExecutor.executeIteration(nodeId, workflowId, iterationIndex, iterationData);
  }

  async executeWorkflow(workflowId) {
    // Get all nodes in the workflow
    const { data: nodes, error } = await supabase
      .from('nodes')
      .select('*, node_connections!source_node_id(*)')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    // Find starting nodes (nodes with no incoming connections)
    const startingNodes = nodes.filter(node => {
      const hasIncoming = nodes.some(n => 
        n.node_connections?.some(conn => conn.target_node_id === node.id)
      );
      return !hasIncoming;
    });
    
    // Execute from starting nodes
    const results = [];
    for (const startNode of startingNodes) {
      const result = await this.executeNodeChain(startNode, nodes);
      results.push(result);
    }
    
    return results;
  }

  async executeNodeChain(node, allNodes) {
    // Execute current node
    const result = await this.nodeExecutor.execute(node.id, node.workflow_id);
    
    // Find connected nodes
    const connectedNodes = node.node_connections?.map(conn => 
      allNodes.find(n => n.id === conn.target_node_id)
    ).filter(Boolean) || [];
    
    // Execute connected nodes
    const childResults = [];
    for (const childNode of connectedNodes) {
      const childResult = await this.executeNodeChain(childNode, allNodes);
      childResults.push(childResult);
    }
    
    return {
      nodeId: node.id,
      result,
      children: childResults
    };
  }

  async testNode({ nodeId }) {
    // Quick test execution for a single node
    const { data: node, error } = await supabase
      .from('nodes')
      .select('*')
      .eq('id', nodeId)
      .single();
      
    if (error) throw error;
    
    return await this.nodeExecutor.execute(nodeId, node.workflow_id, { testMode: true });
  }

  async getWorkflowContext(workflowId) {
    const { data: workflow } = await supabase
      .from('workflows')
      .select(`
        *,
        nodes (*)
      `)
      .eq('id', workflowId)
      .single();
      
    // Sort nodes by position
    if (workflow?.nodes) {
      workflow.nodes.sort((a, b) => a.position - b.position);
    }
      
    return workflow;
  }

  async defineGroup({ groupId, name, description, parameters, nodes }, workflowId) {
    console.log(`[DEFINE_GROUP] Defining group: ${groupId}`);
    
    const definition = {
      groupId,
      name,
      description,
      parameters: parameters || [],
      nodes: nodes || []
    };
    
    // Store in database
    await this.storeGroupDefinition(groupId, definition, workflowId);
    
    // Also set in memory for immediate use
    this.nodeExecutor.setGroupDefinition(groupId, definition);
    
    return {
      message: `Group '${name}' defined successfully`,
      groupId,
      nodeCount: nodes.length
    };
  }

  async useGroup({ groupId, params, description }, workflowId) {
    console.log(`[USE_GROUP] Creating group node for: ${groupId}`);
    
    // Create a group node
    const node = await this.createNode({
      type: 'group',
      config: {
        groupId,
        params: params || {}
      },
      description: description || `Use group: ${groupId}`
    }, workflowId);
    
    return {
      message: `Group node created`,
      node
    };
  }

  async listGroups(workflowId) {
    // Get all group definitions from workflow memory
    const { data: groups } = await supabase
      .from('workflow_memory')
      .select('key, value')
      .eq('workflow_id', workflowId)
      .like('key', 'group_def_%');
      
    const groupList = [];
    if (groups) {
      for (const group of groups) {
        const def = group.value;
        groupList.push({
          groupId: def.groupId,
          name: def.name,
          description: def.description,
          parameters: def.parameters,
          nodeCount: def.nodes.length
        });
      }
    }
    
    // Also include in-memory definitions
    for (const [groupId, def] of this.nodeExecutor.groupDefinitions) {
      if (!groupList.find(g => g.groupId === groupId)) {
        groupList.push({
          groupId: def.groupId,
          name: def.name,
          description: def.description,
          parameters: def.parameters,
          nodeCount: def.nodes.length
        });
      }
    }
    
    return {
      groups: groupList,
      count: groupList.length
    };
  }

  async storeGroupDefinition(groupId, definition, workflowId) {
    await supabase
      .from('workflow_memory')
      .upsert({
        workflow_id: workflowId,
        key: `group_def_${groupId}`,
        value: definition
      });
    console.log(`[GROUP] Stored group definition: ${groupId}`);
  }

  async getGroupDefinition(groupId, workflowId) {
    // Check in-memory definitions first
    if (this.nodeExecutor.groupDefinitions.has(groupId)) {
      return this.nodeExecutor.groupDefinitions.get(groupId);
    }
    
    // Check workflow memory
    const { data: groupData } = await supabase
      .from('workflow_memory')
      .select('value')
      .eq('workflow_id', workflowId)
      .eq('key', `group_def_${groupId}`)
      .single();
      
    if (groupData?.value) {
      this.nodeExecutor.groupDefinitions.set(groupId, groupData.value);
      return groupData.value;
    }
    
    return null;
  }

  async substituteGroupParams(node, params) {
    // Deep clone the node to avoid mutations
    const substitutedNode = JSON.parse(JSON.stringify(node));
    
    // Recursively substitute {{param.xxx}} in the node
    const substitute = (obj) => {
      if (typeof obj === 'string') {
        return obj.replace(/\{\{param\.([^}]+)\}\}/g, (match, paramName) => {
          return params[paramName] !== undefined ? params[paramName] : match;
        });
      } else if (Array.isArray(obj)) {
        return obj.map(item => substitute(item));
      } else if (obj && typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = substitute(value);
        }
        return result;
      }
      return obj;
    };
    
    substitutedNode.config = substitute(substitutedNode.config);
    if (substitutedNode.description) {
      substitutedNode.description = substitute(substitutedNode.description);
    }
    
    return substitutedNode;
  }

  /**
   * Director 2.0: Build 6-part context structure
   */
  async buildDirector2Context(workflowId) {
    const parts = [];
    
    try {
      // Part 1: System Prompt - already included in messages, skip here
      
      // Part 2: Current Plan
      const currentPlan = await this.planService.getCurrentPlan(workflowId);
      if (currentPlan) {
        parts.push(`(2) CURRENT PLAN\n${this.planService.getPlanSummary(currentPlan.plan_data)}`);
      } else {
        parts.push(`(2) CURRENT PLAN\nNo plan created yet. Use update_plan tool to create structured plan.`);
      }
      
      // Part 3: Workflow Snapshot
      const workflowContext = await this.getWorkflowContext(workflowId);
      if (workflowContext && workflowContext.nodes && workflowContext.nodes.length > 0) {
        const nodesSummary = workflowContext.nodes.map(node => 
          `  ${node.position}. ${node.type} - ${node.description || 'No description'} (${node.status})`
        ).join('\n');
        parts.push(`(3) WORKFLOW SNAPSHOT\nWorkflow: ${workflowContext.goal}\nNodes:\n${nodesSummary}`);
      } else {
        parts.push(`(3) WORKFLOW SNAPSHOT\nNo nodes created yet.`);
      }
      
      // Part 4: Workflow Variables
      const variableDisplay = await this.variableManagementService.getFormattedVariables(workflowId);
      parts.push(`(4) WORKFLOW VARIABLES\n${variableDisplay}`);
      
      // Part 5: Browser State & Context Metrics
      let browserAndMetrics = '[Coming in Phase 2: Browser State Service]';
      
      // Add reasoning token metrics if available
      try {
        const { data: latestContext } = await this.supabase
          .from('reasoning_context')
          .select('token_counts, created_at')
          .eq('workflow_id', workflowId)
          .order('conversation_turn', { ascending: false })
          .limit(1);
        
        if (latestContext?.[0]?.token_counts) {
          const tokens = latestContext[0].token_counts;
          const timestamp = new Date(latestContext[0].created_at).toLocaleString();
          browserAndMetrics += `\n\nREASONING TOKEN USAGE (Latest Turn - ${timestamp}):\n`;
          browserAndMetrics += `- Input Tokens: ${tokens.input_tokens?.toLocaleString() || 0}\n`;
          browserAndMetrics += `- Output Tokens: ${tokens.output_tokens?.toLocaleString() || 0}\n`;
          browserAndMetrics += `- Reasoning Tokens: ${tokens.reasoning_tokens?.toLocaleString() || 0}\n`;
          browserAndMetrics += `- Total Tokens: ${tokens.total_tokens?.toLocaleString() || 0}`;
          
          if (tokens.reasoning_tokens > 0) {
            const reasoningPercentage = ((tokens.reasoning_tokens / tokens.total_tokens) * 100).toFixed(1);
            browserAndMetrics += `\n- Reasoning %: ${reasoningPercentage}%`;
          }
        }
      } catch (error) {
        console.error('Error fetching reasoning context metrics:', error);
      }
      
      parts.push(`(5) BROWSER STATE & CONTEXT METRICS\n${browserAndMetrics}`);
      
      // Part 6: Conversation History - already filtered in main flow, skip here
      
      return parts.join('\n\n');
      
    } catch (error) {
      console.error('Error building Director 2.0 context:', error);
      return `Director 2.0 Context Error: ${error.message}`;
    }
  }

  /**
   * Handle update_plan tool calls
   */
  async updatePlan(args, workflowId) {
    try {
      const { plan, reason } = args;
      
      if (!plan) {
        throw new Error('Plan data is required');
      }
      
      if (!workflowId) {
        throw new Error('Workflow ID is required for plan updates');
      }
      
      // Update plan through PlanService
      const updatedPlan = await this.planService.updatePlan(workflowId, plan, reason);
      
      return {
        success: true,
        message: `Plan updated successfully (version ${updatedPlan.plan_version})`,
        plan_id: updatedPlan.id,
        version: updatedPlan.plan_version,
        updated_at: updatedPlan.updated_at
      };
      
    } catch (error) {
      console.error('Failed to update plan:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Variable Management Tool Handlers
   */
  
  async getWorkflowVariable(args, workflowId) {
    try {
      const { variableName, nodeId } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }

      let result;
      
      if (nodeId) {
        // Get all variables for a specific node
        result = await this.variableManagementService.getNodeVariables(workflowId, nodeId);
        return {
          success: true,
          nodeId,
          variables: result
        };
      } else if (variableName) {
        // Get specific variable or all variables
        result = await this.variableManagementService.getVariable(workflowId, variableName);
        
        if (variableName === 'all') {
          return {
            success: true,
            allVariables: result
          };
        } else {
          return {
            success: true,
            variableName,
            value: result
          };
        }
      } else {
        throw new Error('Either variableName or nodeId is required');
      }
      
    } catch (error) {
      console.error('Failed to get workflow variable:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async setVariable(args, workflowId) {
    try {
      const { variableName, value, reason, schema } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      if (!variableName || value === undefined) {
        throw new Error('variableName and value are required');
      }

      const result = await this.variableManagementService.setVariable(
        workflowId, 
        variableName, 
        value, 
        schema, 
        reason
      );
      
      return {
        success: true,
        message: `Variable '${variableName}' set successfully`,
        variable: variableName,
        value,
        reason: reason || 'No reason provided'
      };
      
    } catch (error) {
      console.error('Failed to set variable:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async clearVariable(args, workflowId) {
    try {
      const { variableName, reason } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      if (!variableName) {
        throw new Error('variableName is required');
      }

      const result = await this.variableManagementService.deleteVariable(workflowId, variableName);
      
      return {
        success: true,
        message: `Variable '${variableName}' cleared successfully`,
        variable: variableName,
        reason: reason || 'No reason provided'
      };
      
    } catch (error) {
      console.error('Failed to clear variable:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async clearAllVariables(args, workflowId) {
    try {
      const { reason } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }

      const result = await this.variableManagementService.clearAllVariables(workflowId);
      
      return {
        success: true,
        message: `All variables cleared successfully (${result.deletedCount} variables)`,
        deletedCount: result.deletedCount,
        deletedVariables: result.deletedKeys,
        reason: reason || 'No reason provided'
      };
      
    } catch (error) {
      console.error('Failed to clear all variables:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse node selection string into array of positions
   * Supports: "5", "3-5", "1-3,10,15-17,25", "all"
   */
  async parseNodeSelection(selectionString, workflowId) {
    if (selectionString === 'all') {
      // Get all node positions for this workflow
      const { data: nodes } = await this.supabase
        .from('nodes')
        .select('position')
        .eq('workflow_id', workflowId)
        .order('position');
      
      return nodes ? nodes.map(n => n.position) : [];
    }
    
    const positions = [];
    const parts = selectionString.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      
      if (trimmed.includes('-')) {
        // Handle range: "3-5" → [3,4,5]
        const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
        
        if (isNaN(start) || isNaN(end) || start > end) {
          throw new Error(`Invalid range: "${trimmed}". Range should be like "3-5"`);
        }
        
        for (let i = start; i <= end; i++) {
          positions.push(i);
        }
      } else {
        // Handle individual: "20" → [20]
        const position = parseInt(trimmed);
        
        if (isNaN(position)) {
          throw new Error(`Invalid position: "${trimmed}". Position should be a number`);
        }
        
        positions.push(position);
      }
    }
    
    // Remove duplicates and sort by position to maintain workflow order
    return [...new Set(positions)].sort((a, b) => a - b);
  }

  /**
   * Execute specific nodes by position selection
   * This gives Director the same execution capability as the frontend UI
   */
  async executeNodes(args, workflowId) {
    try {
      const { nodeSelection, resetBrowserFirst = false } = args;
      
      console.log(`[EXECUTE_NODES] Starting execution of: ${nodeSelection}`);
      console.log(`[EXECUTE_NODES] Reset browser first: ${resetBrowserFirst}`);
      
      // Parse node selection string into positions array
      const positions = await this.parseNodeSelection(nodeSelection, workflowId);
      console.log(`[EXECUTE_NODES] Parsed positions: [${positions.join(', ')}]`);
      
      if (positions.length === 0) {
        return {
          execution_results: [],
          summary: {
            total_requested: 0,
            successfully_executed: 0,
            failed: 0,
            execution_time: '0s'
          },
          message: 'No nodes to execute'
        };
      }
      
      // Get nodes for the specified positions
      const { data: availableNodes, error: nodesError } = await this.supabase
        .from('nodes')
        .select('id, position, type, description')
        .eq('workflow_id', workflowId)
        .in('position', positions)
        .order('position');
      
      if (nodesError) {
        throw new Error(`Failed to fetch nodes: ${nodesError.message}`);
      }
      
      console.log(`[EXECUTE_NODES] Found ${availableNodes.length} nodes out of ${positions.length} requested positions`);
      
      // Check for missing positions
      const foundPositions = availableNodes.map(n => n.position);
      const missingPositions = positions.filter(p => !foundPositions.includes(p));
      
      if (missingPositions.length > 0) {
        console.warn(`[EXECUTE_NODES] Missing positions: [${missingPositions.join(', ')}]`);
      }
      
      // Reset browser if requested
      if (resetBrowserFirst) {
        console.log(`[EXECUTE_NODES] Resetting browser session`);
        await this.nodeExecutor.cleanup();
        await this.nodeExecutor.getStagehand(); // This will create a fresh browser
      }
      
      // Execute each node
      const results = [];
      const startTime = Date.now();
      
      for (const node of availableNodes) {
        const nodeStartTime = Date.now();
        console.log(`[EXECUTE_NODES] Executing node ${node.position}: ${node.type} - ${node.description}`);
        
        try {
          const result = await this.nodeExecutor.execute(node.id, workflowId);
          
          results.push({
            node_position: node.position,
            node_id: node.id,
            status: 'success',
            result: result.data,
            execution_time: `${((Date.now() - nodeStartTime) / 1000).toFixed(1)}s`
          });
          
          console.log(`[EXECUTE_NODES] ✅ Node ${node.position} executed successfully`);
        } catch (error) {
          console.error(`[EXECUTE_NODES] ❌ Node ${node.position} failed:`, error.message);
          
          results.push({
            node_position: node.position,
            node_id: node.id,
            status: 'error',
            error_details: error.message,
            execution_time: `${((Date.now() - nodeStartTime) / 1000).toFixed(1)}s`
          });
        }
      }
      
      // Add results for missing positions
      for (const missingPos of missingPositions) {
        results.push({
          node_position: missingPos,
          node_id: null,
          status: 'error',
          error_details: 'Node not found at this position',
          execution_time: '0s'
        });
      }
      
      // Sort results by position
      results.sort((a, b) => a.node_position - b.node_position);
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.filter(r => r.status === 'error').length;
      
      console.log(`[EXECUTE_NODES] Execution complete: ${successCount} success, ${failCount} failed, ${totalTime}s total`);
      
      return {
        execution_results: results,
        summary: {
          total_requested: positions.length,
          successfully_executed: successCount,
          failed: failCount,
          execution_time: `${totalTime}s`
        }
      };
      
    } catch (error) {
      console.error('Failed to execute nodes:', error);
      return {
        execution_results: [],
        summary: {
          total_requested: 0,
          successfully_executed: 0,
          failed: 1,
          execution_time: '0s'
        },
        error: error.message
      };
    }
  }

  /**
   * Check if a model is a reasoning model that requires Responses API
   */
  isReasoningModel(model) {
    const reasoningModels = ['o4-mini', 'o3', 'o4-mini-2025-04-16', 'o3-2025-04-16'];
    return reasoningModels.includes(model);
  }

  /**
   * Broadcast reasoning updates to WebSocket clients via API (with fallback)
   */
  async broadcastReasoningUpdate(workflowId, data) {
    try {
      // Try multiple possible ports for the frontend server
      const ports = [3000, 3003, 3001];
      let success = false;
      
      for (const port of ports) {
        try {
          const response = await fetch(`http://localhost:${port}/api/reasoning/broadcast`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              executionId: workflowId,
              data
            })
          });

          if (response.ok) {
            console.log(`[DIRECTOR] Successfully broadcast reasoning update on port ${port}`);
            success = true;
            break;
          }
        } catch (portError) {
          // Try next port
          continue;
        }
      }
      
      if (!success) {
        console.log(`[DIRECTOR] Frontend API not available, reasoning update logged locally: ${data.type} - ${data.text || ''}`);
      }
    } catch (error) {
      console.error('[DIRECTOR] Error broadcasting reasoning update:', error);
    }
  }

  /**
   * Convert tool definitions from Chat Completions format to Responses API format
   * Chat Completions: { type: 'function', function: { name, description, parameters } }
   * Responses API: { type: 'function', name, description, parameters }
   */
  convertToolsForResponsesAPI(chatTools) {
    return chatTools.map(tool => {
      if (tool.type === 'function' && tool.function) {
        return {
          type: 'function',
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        };
      }
      return tool; // Return as-is if already in correct format
    });
  }

  /**
   * Process message using OpenAI Responses API for reasoning models with full control loop
   */
  async processWithResponsesAPI(model, messages, workflowId) {
    try {
      // Load previous encrypted reasoning context
      const encryptedContext = await this.loadReasoningContext(workflowId);
      console.log(`[🔍 ENCRYPTED_CONTEXT] Loaded ${encryptedContext.length} encrypted reasoning blobs from previous turns`);
      
      // Convert messages to Responses API format
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
      
      // Build initial input array
      const initialInput = [
        ...encryptedContext,
        ...userMessages.map(msg => ({
          type: 'message',
          role: msg.role,
          content: msg.content
        }))
      ];

      // Enhanced logging for debugging token counts
      console.log('[🔍 RESPONSES_API_DEBUG] Initial input details:');
      console.log(`  - Encrypted context items: ${encryptedContext.length}`);
      console.log(`  - User/Assistant messages: ${userMessages.length}`);
      console.log(`  - Total input array length: ${initialInput.length}`);
      console.log(`  - Input stringified size: ${JSON.stringify(initialInput).length} characters`);
      console.log(`  - System prompt size: ${systemMessage?.content?.length || 0} characters`);
      
      // Log the actual content being sent (first 500 chars of each message)
      initialInput.forEach((item, idx) => {
        if (item.type === 'message') {
          const preview = item.content ? item.content.substring(0, 500) : 'null';
          console.log(`  - Input[${idx}] (${item.role}): ${preview}${item.content?.length > 500 ? '...' : ''}`);
          
          // Check for director2Context patterns in each message
          if (item.content && item.role === 'user') {
            const contextOccurrences = (item.content.match(/CURRENT PLAN/g) || []).length;
            if (contextOccurrences > 0) {
              console.log(`    [🔍 CONTEXT COUNT] This user message contains ${contextOccurrences} director2Context occurrence(s)`);
              console.log(`    [🔍 MESSAGE LENGTH] ${item.content.length} characters`);
            }
          }
        }
      });

      // Run the full control loop
      return await this.runDirectorControlLoop(model, systemMessage?.content || DIRECTOR_SYSTEM_PROMPT, initialInput, workflowId);

    } catch (error) {
      console.error('[RESPONSES_API] Error:', error);
      throw error;
    }
  }

  /**
   * Simplified non-streaming control loop for reasoning models with tool calling
   * Radically simplified approach - single blocking call per step with accurate token counts
   */
  async runDirectorControlLoop(model, instructions, initialInput, workflowId, recursionDepth = 0) {
    // Prevent infinite recursion
    if (recursionDepth > 10) {
      throw new Error('Maximum recursion depth reached in Director control loop');
    }

    console.log(`[CONTROL_LOOP] Starting blocking loop (depth ${recursionDepth}) with ${initialInput.length} input items`);
    
    // Convert tools from Chat Completions format to Responses API format
    const chatTools = createToolDefinitions();
    const responsesTools = this.convertToolsForResponsesAPI(chatTools);

    // Make blocking request - no streaming!
    const response = await this.openai.responses.create({
      model,
      instructions,
      input: initialInput,
      tools: responsesTools,
      reasoning: { 
        effort: 'medium', 
        summary: 'detailed'
      },
      include: ['reasoning.encrypted_content'],
      store: false,  // Fine - usage is still complete without streaming
      stream: false  // KEY CHANGE: No streaming = accurate token counts immediately
    });

    console.log(`[CONTROL_LOOP] Blocking response received. Processing...`);
    
    // Debug: Log response output types
    const outputTypes = response.output.map(item => item.type);
    console.log(`[RESPONSE_DEBUG] Output types in response:`, outputTypes);
    console.log(`[RESPONSE_DEBUG] Total output items:`, response.output.length);

    // Extract data from blocking response
    const assistantMessages = response.output.filter(item => item.type === 'message' && item.role === 'assistant');
    const functionCalls = response.output.filter(item => item.type === 'function_call');
    const encryptedBlobs = response.output.filter(item => item.type === 'reasoning' && item.encrypted_content);
    
    console.log(`[ENCRYPTED_BLOBS] Found ${encryptedBlobs.length} encrypted reasoning blobs in response`);
    if (encryptedBlobs.length > 0) {
      console.log(`[ENCRYPTED_BLOBS] First blob preview:`, JSON.stringify(encryptedBlobs[0]).substring(0, 200) + '...');
    }
    
    // Get assistant content
    const assistantContent = assistantMessages
      .flatMap(msg => msg.content || [])
      .map(content => content.text || '')
      .join('');
    
    // Extract reasoning summary from reasoning output items (available immediately with blocking response)
    const reasoningItems = response.output.filter(item => item.type === 'reasoning' && item.summary);
    const reasoningSummary = reasoningItems.length > 0 ? 
      reasoningItems.map(item => item.summary.map(s => s.text).join('\n')).join('\n\n') : 
      null;

    // Get accurate token usage immediately (no streaming = no retrieval needed!)
    const tokenUsage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.total_tokens,
      output_tokens_details: {
        reasoning_tokens: response.usage.output_tokens_details?.reasoning_tokens || 0
      }
    };
    
    console.log('[RESPONSES_API] Accurate token usage (no streaming):', tokenUsage);

    // Handle tool calls if present
    if (functionCalls.length > 0) {
      console.log(`[CONTROL_LOOP] ${functionCalls.length} function calls detected`);
      
      const executedTools = [];
      const followUps = [];
      
      // Execute all tool calls
      for (const call of functionCalls) {
        try {
          console.log(`[CONTROL_LOOP] Executing tool: ${call.name}`);
          const toolResult = await this.executeToolCall(call, workflowId);
          
          executedTools.push({
            name: call.name,
            arguments: call.arguments,
            result: toolResult,
            call_id: call.call_id
          });
          
          // Add to follow-up input
          followUps.push(call);
          followUps.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify(toolResult)
          });
          
        } catch (toolError) {
          console.error(`[CONTROL_LOOP] Tool execution failed:`, toolError);
          
          executedTools.push({
            name: call.name,
            arguments: call.arguments,
            error: toolError.message || 'Tool execution failed',
            call_id: call.call_id
          });
          
          // Add error to follow-up input
          followUps.push(call);
          followUps.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({ error: true, message: toolError.message || 'Tool execution failed' })
          });
        }
      }
      
      // Continue the chain recursively with tool results
      const recursiveResult = await this.runDirectorControlLoop(
        model, 
        instructions, 
        initialInput.concat(followUps), 
        workflowId, 
        recursionDepth + 1
      );
      
      // Merge executed tools from recursive call
      if (recursiveResult.executedTools) {
        executedTools.push(...recursiveResult.executedTools);
      }
      
      // IMPORTANT: For user-facing token counts, only return the INITIAL call's tokens
      // The recursive calls are internal implementation details
      const userFacingUsage = recursionDepth === 0 ? tokenUsage : recursiveResult.usage;
      
      // Log the actual total for debugging if needed
      if (recursionDepth === 0) {
        const totalUsage = this.mergeTokenUsage(tokenUsage, recursiveResult.usage);
        console.log(`[TOKEN_DEBUG] Initial message tokens: ${tokenUsage.input_tokens} in, ${tokenUsage.output_tokens} out`);
        console.log(`[TOKEN_DEBUG] Total with ${executedTools.length} tool executions: ${totalUsage.input_tokens} in, ${totalUsage.output_tokens} out`);
      }
      
      return {
        ...recursiveResult,
        executedTools,
        usage: userFacingUsage, // Only show the initial message tokens to user
        reasoning_summary: reasoningSummary || recursiveResult.reasoning_summary // Preserve reasoning summary
      };
    }
    
    // Store encrypted reasoning context
    if (encryptedBlobs.length > 0 && tokenUsage) {
      await this.storeReasoningContextFromBlobs(workflowId, encryptedBlobs, tokenUsage);
    }

    console.log(`[CONTROL_LOOP] Completed (depth ${recursionDepth}). Final response ready.`);

    // Return in format compatible with existing code
    return {
      choices: [{
        message: {
          content: assistantContent,
          tool_calls: null, // Tools were executed in the loop
          role: 'assistant',
          reasoning_summary: reasoningSummary // Include reasoning summary for immediate display
        }
      }],
      usage: tokenUsage,
      executedTools: [], // No tools executed at this level
      reasoning_summary: reasoningSummary // Also include at top level for compatibility
    };
  }

  /**
   * Merge token usage from multiple API calls (e.g., recursive calls)
   */
  mergeTokenUsage(usage1, usage2) {
    if (!usage1) return usage2;
    if (!usage2) return usage1;
    
    return {
      input_tokens: (usage1.input_tokens || 0) + (usage2.input_tokens || 0),
      output_tokens: (usage1.output_tokens || 0) + (usage2.output_tokens || 0),
      total_tokens: (usage1.total_tokens || 0) + (usage2.total_tokens || 0),
      output_tokens_details: {
        reasoning_tokens: 
          (usage1.output_tokens_details?.reasoning_tokens || 0) + 
          (usage2.output_tokens_details?.reasoning_tokens || 0)
      }
    };
  }

  /**
   * Execute a single tool call during the control loop
   */
  async executeToolCall(toolCallItem, workflowId) {
    const { name: toolName, arguments: toolArgs, call_id } = toolCallItem;
    
    console.log(`[TOOL_EXECUTION] Executing ${toolName} with call_id ${call_id}`);
    
    try {
      const args = JSON.parse(toolArgs);
      let result;
      
      // Route to appropriate tool handler (same as existing processToolCalls)
      switch (toolName) {
        case 'create_workflow_sequence':
          result = await this.createWorkflowSequence(args, workflowId);
          break;
        case 'create_node':
          result = await this.createNode(args, workflowId);
          break;
        case 'update_node':
          result = await this.updateNode(args, workflowId);
          break;
        case 'update_plan':
          result = await this.updatePlan(args, workflowId);
          break;
        case 'execute_nodes':
          result = await this.executeNodes(args, workflowId);
          break;
        case 'get_workflow_variable':
          result = await this.getWorkflowVariable(args, workflowId);
          break;
        case 'set_variable':
          result = await this.setVariable(args, workflowId);
          break;
        case 'clear_variable':
          result = await this.clearVariable(args, workflowId);
          break;
        case 'clear_all_variables':
          result = await this.clearAllVariables(args, workflowId);
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      
      console.log(`[TOOL_EXECUTION] ${toolName} completed successfully`);
      console.log(`[TOOL_EXECUTION] Result:`, JSON.stringify(result, null, 2));
      return result;
      
    } catch (error) {
      console.error(`[TOOL_EXECUTION] ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Store encrypted reasoning context from blobs (used in control loop)
   */
  async storeReasoningContextFromBlobs(workflowId, encryptedBlobs, tokenUsage) {
    try {
      if (encryptedBlobs.length === 0) {
        console.log('[REASONING_CONTEXT] No encrypted reasoning blobs to store');
        return;
      }

      // Get next conversation turn number
      const { data: lastTurn } = await this.supabase
        .from('reasoning_context')
        .select('conversation_turn')
        .eq('workflow_id', workflowId)
        .order('conversation_turn', { ascending: false })
        .limit(1);

      const nextTurn = (lastTurn?.[0]?.conversation_turn || 0) + 1;

      // Store the context
      const { error } = await this.supabase
        .from('reasoning_context')
        .insert({
          workflow_id: workflowId,
          conversation_turn: nextTurn,
          encrypted_items: encryptedBlobs,
          token_counts: tokenUsage
        });

      if (error) {
        console.error('[REASONING_CONTEXT] Error storing context:', error);
      } else {
        console.log(`[REASONING_CONTEXT] Stored ${encryptedBlobs.length} encrypted blobs for turn ${nextTurn}`);
        console.log('[RESPONSES_API] Token usage:', tokenUsage);
      }

    } catch (error) {
      console.error('[REASONING_CONTEXT] Error storing context from blobs:', error);
    }
  }

  /**
   * Load encrypted reasoning context for a workflow
   */
  async loadReasoningContext(workflowId) {
    try {
      const { data: contexts, error } = await this.supabase
        .from('reasoning_context')
        .select('encrypted_items')
        .eq('workflow_id', workflowId)
        .order('conversation_turn', { ascending: false })
        .limit(5); // Load last 5 turns to maintain reasonable context

      if (error) {
        console.error('[REASONING_CONTEXT] Error loading context:', error);
        return [];
      }

      // Flatten all encrypted items from recent turns
      const allEncryptedItems = [];
      for (const context of contexts || []) {
        if (context.encrypted_items && Array.isArray(context.encrypted_items)) {
          allEncryptedItems.push(...context.encrypted_items);
        }
      }

      console.log(`[REASONING_CONTEXT] Loaded ${allEncryptedItems.length} encrypted items`);
      
      // Debug: Log size of encrypted context
      const contextSize = JSON.stringify(allEncryptedItems).length;
      console.log(`[REASONING_CONTEXT] Encrypted context size: ${contextSize} chars (~${Math.round(contextSize/4)} tokens)`);
      
      return allEncryptedItems;

    } catch (error) {
      console.error('[REASONING_CONTEXT] Error loading context:', error);
      return [];
    }
  }

  /**
   * Store encrypted reasoning context after API response
   */
  async storeReasoningContext(workflowId, response, tokenUsage) {
    try {
      // Extract encrypted reasoning items from response
      const encryptedItems = response.output?.filter(item => 
        item.type === 'reasoning' && item.encrypted_content
      ) || [];

      if (encryptedItems.length === 0) {
        console.log('[REASONING_CONTEXT] No encrypted reasoning items to store');
        return;
      }

      // Get next conversation turn number
      const { data: lastTurn } = await this.supabase
        .from('reasoning_context')
        .select('conversation_turn')
        .eq('workflow_id', workflowId)
        .order('conversation_turn', { ascending: false })
        .limit(1);

      const nextTurn = (lastTurn?.[0]?.conversation_turn || 0) + 1;

      // Store the context
      const { error } = await this.supabase
        .from('reasoning_context')
        .insert({
          workflow_id: workflowId,
          conversation_turn: nextTurn,
          encrypted_items: encryptedItems,
          token_counts: tokenUsage
        });

      if (error) {
        console.error('[REASONING_CONTEXT] Error storing context:', error);
      } else {
        console.log(`[REASONING_CONTEXT] Stored ${encryptedItems.length} encrypted items for turn ${nextTurn}`);
      }

    } catch (error) {
      console.error('[REASONING_CONTEXT] Error storing context:', error);
    }
  }

  /**
   * Extract tool calls from Responses API response
   */
  extractToolCallsFromResponse(response) {
    const toolCalls = [];
    
    for (const item of response.output || []) {
      if (item.type === 'function_call') {
        toolCalls.push({
          id: item.call_id,
          type: 'function',
          function: {
            name: item.name,
            arguments: item.arguments
          }
        });
      }
    }

    return toolCalls.length > 0 ? toolCalls : null;
  }

  /**
   * Extract assistant message content from Responses API response
   */
  extractAssistantContent(response) {
    for (const item of response.output || []) {
      if (item.type === 'message' && item.role === 'assistant') {
        return item.content?.[0]?.text || '';
      }
    }
    return '';
  }
}