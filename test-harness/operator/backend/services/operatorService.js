import OpenAI from 'openai';
import { Stagehand } from '@browserbasehq/stagehand';
import { OPERATOR_SYSTEM_PROMPT } from '../prompts/operatorPrompt.js';
import { createToolDefinitions } from '../tools/toolDefinitions.js';
import { NodeExecutor } from './nodeExecutor.js';
import { supabase } from '../config/supabase.js';

export class OperatorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.nodeExecutor = new NodeExecutor();
  }

  async processMessage({ message, workflowId, conversationHistory = [] }) {
    try {
      // Get current workflow state if workflowId provided
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
        model: 'o3', // OpenAI o3 reasoning model
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
          case 'delete_node':
            result = await this.deleteNode(args);
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
    const createdNodes = [];
    
    console.log('Creating workflow sequence with nodes:', JSON.stringify(nodes, null, 2));
    
    for (const nodeData of nodes) {
      try {
        const node = await this.createNode(nodeData, workflowId);
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

  async createNode({ type, config, position, description }, workflowId) {
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
    
    // Get the max position for this workflow
    const { data: maxPositionNode } = await supabase
      .from('nodes')
      .select('position')
      .eq('workflow_id', workflowId)
      .order('position', { ascending: false })
      .limit(1)
      .single();
    
    const nextPosition = (maxPositionNode?.position || 0) + 1;
    
    const { data: node, error } = await supabase
      .from('nodes')
      .insert({
        workflow_id: workflowId,
        position: nextPosition,
        type,
        params: config || {},  // Ensure params is never null
        description: description || `${type} node`,
        status: 'pending'
      })
      .select()
      .single();
      
    if (error) throw error;
    return node;
  }

  async updateNode({ nodeId, updates }) {
    const { data: node, error } = await supabase
      .from('nodes')
      .update(updates)
      .eq('id', nodeId)
      .select()
      .single();
      
    if (error) throw error;
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