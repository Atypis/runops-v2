#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  ListToolsRequestSchema, 
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { DirectorService } from '../services/directorService.js';
import { createToolDefinitions } from '../tools/toolDefinitionsV2.js';
import { supabase } from '../config/supabase.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

class DirectorMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'director',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          resources: {}
        }
      }
    );
    
    this.directorInstances = new Map();
    this.currentWorkflowId = null;
    this.currentUserId = null;
    this.toolCallStats = new Map();
  }

  async initialize() {
    console.error('Initializing Director MCP Server...');
    
    try {
      // Get all tool definitions from Director
      const toolDefs = createToolDefinitions();
      
      // Add MCP-specific context tools
      const mcpTools = this.createMCPTools();
      const allTools = [...toolDefs, ...mcpTools];
      
      // Convert Director tool format to MCP format
      const mcpFormattedTools = allTools.map(tool => ({
        name: tool.function.name,
        description: tool.function.description,
        inputSchema: tool.function.parameters
      }));

      // Register tool handler
      this.server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.error(`Listing ${mcpFormattedTools.length} tools`);
        return { tools: mcpFormattedTools };
      });

      // Register tool call handler
      this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        console.error(`Tool call: ${name}`, args);
        
        try {
          // Track tool usage
          this.toolCallStats.set(name, (this.toolCallStats.get(name) || 0) + 1);
          
          // Handle MCP-specific tools
          if (name.startsWith('mcp_')) {
            return await this.handleMCPTool(name, args);
          }
          
          // Get or create Director instance
          const director = await this.getDirectorInstance();
          
          // Call the tool through Director
          const result = await director.handleToolCall(name, args);
          
          return {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          console.error(`Error in tool ${name}:`, error);
          return {
            content: [{
              type: 'text',
              text: `Error: ${error.message}`
            }],
            isError: true
          };
        }
      });

      // Register resource handlers for workflow inspection
      this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
        const resources = [];
        
        if (this.currentWorkflowId) {
          resources.push({
            uri: `workflow://${this.currentWorkflowId}/nodes`,
            name: 'Current Workflow Nodes',
            description: 'View all nodes in the current workflow',
            mimeType: 'application/json'
          });
          
          resources.push({
            uri: `workflow://${this.currentWorkflowId}/variables`,
            name: 'Current Workflow Variables',
            description: 'View all variables in the current workflow',
            mimeType: 'application/json'
          });
        }
        
        return { resources };
      });

      this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        const { uri } = request.params;
        const director = await this.getDirectorInstance();
        
        if (uri.includes('/nodes')) {
          const nodes = await director.getWorkflowNodes();
          return {
            contents: [{
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(nodes, null, 2)
            }]
          };
        }
        
        if (uri.includes('/variables')) {
          const variables = await director.getWorkflowVariables('all');
          return {
            contents: [{
              uri,
              mimeType: 'application/json', 
              text: JSON.stringify(variables, null, 2)
            }]
          };
        }
        
        throw new Error(`Unknown resource: ${uri}`);
      });

      console.error('Director MCP Server initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Director MCP Server:', error);
      throw error;
    }
  }

  createMCPTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'mcp_set_workflow_context',
          description: 'Set the current workflow to work on. Required before using other Director tools.',
          parameters: {
            type: 'object',
            properties: {
              workflow_id: { 
                type: 'string',
                description: 'The workflow ID to work on'
              },
              user_id: {
                type: 'string',
                description: 'Optional user ID (will use default if not provided)'
              },
              create_if_missing: { 
                type: 'boolean', 
                default: false,
                description: 'Create a new workflow if the ID does not exist'
              }
            },
            required: ['workflow_id'],
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'mcp_get_current_context',
          description: 'Get comprehensive context about the current workflow including nodes, variables, browser state, plan, and description',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'mcp_list_workflows',
          description: 'List all available workflows for the current user',
          parameters: {
            type: 'object',
            properties: {
              limit: {
                type: 'number',
                default: 10,
                description: 'Maximum number of workflows to return'
              }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'mcp_browser_screenshot',
          description: 'Take a screenshot of the current browser state and save it locally',
          parameters: {
            type: 'object',
            properties: {
              format: { 
                type: 'string', 
                enum: ['png', 'jpeg'], 
                default: 'png' 
              },
              fullPage: { 
                type: 'boolean', 
                default: false 
              },
              tabName: {
                type: 'string',
                description: 'Specific tab to screenshot (default: active tab)'
              }
            },
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'mcp_get_tool_usage_stats',
          description: 'Get statistics on tool usage during this session',
          parameters: {
            type: 'object',
            properties: {},
            additionalProperties: false
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'mcp_sync_with_frontend',
          description: 'Check if frontend is running and get current workflow from it',
          parameters: {
            type: 'object',
            properties: {
              frontend_url: {
                type: 'string',
                default: 'http://localhost:5173',
                description: 'Frontend URL to check'
              }
            },
            additionalProperties: false
          }
        }
      }
    ];
  }

  async handleMCPTool(name, args) {
    switch (name) {
      case 'mcp_set_workflow_context':
        return await this.setWorkflowContext(args);
      
      case 'mcp_get_current_context':
        return await this.getCurrentContext();
      
      case 'mcp_list_workflows':
        return await this.listWorkflows(args);
      
      case 'mcp_browser_screenshot':
        return await this.getBrowserScreenshot(args);
      
      case 'mcp_get_tool_usage_stats':
        return await this.getToolUsageStats();
      
      case 'mcp_sync_with_frontend':
        return await this.syncWithFrontend(args);
      
      default:
        throw new Error(`Unknown MCP tool: ${name}`);
    }
  }

  async setWorkflowContext(args) {
    const { workflow_id, user_id, create_if_missing } = args;
    
    // Set user ID (use default if not provided)
    this.currentUserId = user_id || process.env.DEFAULT_USER_ID || 'default-user';
    
    // Check if workflow exists
    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflow_id)
      .single();
    
    if (error && error.code !== 'PGRST116') { // Not found error
      throw new Error(`Failed to check workflow: ${error.message}`);
    }
    
    if (!workflow && !create_if_missing) {
      throw new Error(`Workflow ${workflow_id} not found. Set create_if_missing: true to create it.`);
    }
    
    if (!workflow && create_if_missing) {
      // Create new workflow
      const { data: newWorkflow, error: createError } = await supabase
        .from('workflows')
        .insert({
          id: workflow_id,
          goal: `Workflow ${workflow_id}`,
          status: 'draft',
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        throw new Error(`Failed to create workflow: ${createError.message}`);
      }
    }
    
    this.currentWorkflowId = workflow_id;
    
    // Clear existing Director instance to force reload
    if (this.directorInstances.has(workflow_id)) {
      const oldDirector = this.directorInstances.get(workflow_id);
      // Clean up browser sessions if needed
      if (oldDirector.nodeExecutor && oldDirector.nodeExecutor.cleanup) {
        await oldDirector.nodeExecutor.cleanup();
      }
      this.directorInstances.delete(workflow_id);
    }
    
    return {
      content: [{
        type: 'text',
        text: `Workflow context set to: ${workflow_id} (user: ${this.currentUserId})`
      }]
    };
  }

  async getCurrentContext() {
    if (!this.currentWorkflowId) {
      return {
        content: [{
          type: 'text',
          text: 'No workflow selected. Use mcp_set_workflow_context first.'
        }]
      };
    }
    
    try {
      const director = await this.getDirectorInstance();
      
      const context = {
        workflow_id: this.currentWorkflowId,
        user_id: this.currentUserId,
        nodes: await director.getWorkflowNodes(),
        variables: await director.getWorkflowVariables('all'),
        browser_state: await director.getBrowserState(),
        plan: await director.getCurrentPlan(),
        description: await director.getWorkflowDescription()
      };
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(context, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error getting context: ${error.message}`
        }],
        isError: true
      };
    }
  }

  async listWorkflows(args) {
    const { limit = 10 } = args;
    
    const { data: workflows, error } = await supabase
      .from('workflows')
      .select('id, goal, status, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      throw new Error(`Failed to list workflows: ${error.message}`);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(workflows, null, 2)
      }]
    };
  }

  async getBrowserScreenshot(args) {
    const director = await this.getDirectorInstance();
    const { format = 'png', fullPage = false, tabName } = args;
    
    // Take screenshot through browser_action
    const timestamp = Date.now();
    const filename = `mcp_screenshot_${timestamp}.${format}`;
    const filepath = path.join(__dirname, '../../temp/screenshots', filename);
    
    // Ensure directory exists
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    
    // Use browser_action to take screenshot
    const screenshotArgs = {
      action: 'screenshot',
      config: {
        path: filepath,
        fullPage: fullPage,
        ...(tabName && { tabName })
      },
      reason: 'MCP screenshot request'
    };
    
    try {
      await director.handleToolCall('browser_action', screenshotArgs);
      
      return {
        content: [{
          type: 'text',
          text: `Screenshot saved to: ${filepath}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to take screenshot: ${error.message}`
        }],
        isError: true
      };
    }
  }

  async getToolUsageStats() {
    const stats = Array.from(this.toolCallStats.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tool, count]) => ({ tool, count }));
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          total_calls: stats.reduce((sum, s) => sum + s.count, 0),
          by_tool: stats
        }, null, 2)
      }]
    };
  }

  async syncWithFrontend(args) {
    const { frontend_url = 'http://localhost:5173' } = args;
    
    try {
      // Try to fetch current context from frontend API
      const response = await fetch(`${frontend_url}/api/current-context`);
      
      if (!response.ok) {
        return {
          content: [{
            type: 'text',
            text: 'Frontend not available or API endpoint not implemented yet. Use mcp_set_workflow_context manually.'
          }]
        };
      }
      
      const context = await response.json();
      
      if (context.workflow_id) {
        await this.setWorkflowContext({
          workflow_id: context.workflow_id,
          user_id: context.user_id
        });
        
        return {
          content: [{
            type: 'text',
            text: `Synced with frontend. Current workflow: ${context.workflow_id}`
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: 'Frontend has no active workflow'
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Could not sync with frontend: ${error.message}. Use mcp_set_workflow_context manually.`
        }]
      };
    }
  }

  async getDirectorInstance() {
    if (!this.currentWorkflowId) {
      throw new Error('No workflow selected. Use mcp_set_workflow_context first.');
    }
    
    if (!this.directorInstances.has(this.currentWorkflowId)) {
      console.error(`Creating new Director instance for workflow ${this.currentWorkflowId}`);
      
      const director = new DirectorService();
      await director.initialize(this.currentWorkflowId, this.currentUserId);
      
      this.directorInstances.set(this.currentWorkflowId, director);
    }
    
    return this.directorInstances.get(this.currentWorkflowId);
  }

  async cleanup() {
    // Clean up all Director instances
    for (const [workflowId, director] of this.directorInstances) {
      console.error(`Cleaning up Director instance for workflow ${workflowId}`);
      if (director.nodeExecutor && director.nodeExecutor.cleanup) {
        await director.nodeExecutor.cleanup();
      }
    }
    this.directorInstances.clear();
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.error('Shutting down Director MCP Server...');
      await this.cleanup();
      process.exit(0);
    });
    
    console.error('Director MCP Server running on stdio transport');
  }
}

// Main execution
async function main() {
  try {
    const server = new DirectorMCPServer();
    await server.initialize();
    await server.run();
  } catch (error) {
    console.error('Failed to start Director MCP Server:', error);
    process.exit(1);
  }
}

main();