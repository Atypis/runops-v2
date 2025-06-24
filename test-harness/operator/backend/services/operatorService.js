import OpenAI from 'openai';
import { Stagehand } from '@browserbasehq/stagehand';
import { OPERATOR_SYSTEM_PROMPT } from '../prompts/operatorPrompt.js';
import { createToolDefinitions } from '../tools/toolDefinitions.js';
import { NodeExecutor } from './nodeExecutor.js';
import { supabase } from '../config/supabase.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OperatorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.nodeExecutor = new NodeExecutor();
    this.supabase = supabase;
  }

  async processMessage({ message, workflowId, conversationHistory = [], mockMode = false }) {
    try {
      // Check for mock mode
      if (mockMode || process.env.MOCK_OPERATOR_MODE === 'true') {
        console.log('\n[MOCK OPERATOR] Received message:', message);
        console.log('[MOCK OPERATOR] Workflow ID:', workflowId);
        console.log('[MOCK OPERATOR] Reading response from mock-operator/response.json\n');
        
        try {
          const mockResponsePath = path.join(__dirname, '../../mock-operator/response.json');
          const mockResponseData = await fs.readFile(mockResponsePath, 'utf-8');
          const mockResponse = JSON.parse(mockResponseData);
          
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

      // Normal operation - Get current workflow state if workflowId provided
      let workflowContext = null;
      if (workflowId) {
        workflowContext = await this.getWorkflowContext(workflowId);
      }

      // Build messages array, filtering out any null content
      const messages = [
        { role: 'system', content: OPERATOR_SYSTEM_PROMPT },
        ...conversationHistory.filter(msg => msg.content !== null && msg.content !== undefined),
        { role: 'user', content: message }
      ];

      // Add workflow context to the latest message if available
      if (workflowContext) {
        messages[messages.length - 1].content += `\n\nCurrent workflow state:\n${JSON.stringify(workflowContext, null, 2)}`;
      }
      
      // Add available environment variables for Gmail
      if (message.toLowerCase().includes('gmail') || message.toLowerCase().includes('google')) {
        messages[messages.length - 1].content += `\n\nAvailable credentials:\nGMAIL_EMAIL: ${process.env.GMAIL_EMAIL}\nGMAIL_PASSWORD: ${process.env.GMAIL_PASSWORD}`;
      }

      // Call OpenAI with tool functions
      const completion = await this.openai.chat.completions.create({
        model: 'o4-mini-2025-04-16', // OpenAI o4-mini model
        messages,
        tools: createToolDefinitions(),
        tool_choice: 'auto',
        temperature: 1
      });

      const responseMessage = completion.choices[0].message;
      
      // Process any tool calls
      if (responseMessage.tool_calls) {
        const toolResults = await this.processToolCalls(responseMessage.tool_calls, workflowId);
        
        return {
          message: responseMessage.content || '',  // Default to empty string if null
          toolCalls: toolResults,
          workflowId
        };
      }

      return {
        message: responseMessage.content || "I've completed the requested actions.",
        workflowId
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
          parent_position: nodeData.parent_position
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
    if (parent_position !== undefined && parent_position !== null) {
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
}