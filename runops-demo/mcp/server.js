#!/usr/bin/env node

// Director MCP Server (Cursor-compatible)
// Uses the consolidated Director implementation under runops-demo/lib/director

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env (support project-level .env)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config();

// Import Director pieces via relative paths (no Next.js alias resolution here)
// Tool definitions
import { createToolDefinitions } from '../lib/director/tools/toolDefinitionsV2.js';
// Supabase client (used by MCP context tools)
import { supabase } from '../lib/director/config/supabase.js';
// Director service (core backend)
import { DirectorService } from '../lib/director/services/directorService.js';

class DirectorMCPServer {
  constructor() {
    this.server = new Server(
      { name: 'director', version: '2.0.0' },
      { capabilities: { tools: {}, resources: {} } },
    );

    this.workflowId = null;
    this.userId = null;
    this.toolCallStats = new Map();
    this.directorInstances = new Map(); // workflowId -> DirectorService
  }

  async initialize() {
    console.error('[MCP] Initializing Director MCP Server...');

    // Compose tool list (Director tools + MCP context tools)
    const directorTools = createToolDefinitions();
    const mcpTools = this._createMcpTools();
    const allTools = [...directorTools, ...mcpTools];

    // Per MCP spec, the field is `input_schema` (snake_case)
    const mcpFormattedTools = allTools.map((tool) => ({
      name: tool.function.name,
      description: tool.function.description,
      input_schema: tool.function.parameters,
    }));

    // List tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: mcpFormattedTools };
    });

    // Call tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;
      try {
        this.toolCallStats.set(name, (this.toolCallStats.get(name) || 0) + 1);

        if (name.startsWith('mcp_')) {
          const result = await this._handleMcpTool(name, args);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        const director = await this._getDirector();
        const result = await director.handleToolCall(name, args);
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text', text: `Error: ${error?.message || String(error)}` }],
          isError: true,
        };
      }
    });

    // Resource listing (current workflow quick-inspect)
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = [];
      if (this.workflowId) {
        resources.push({
          uri: `workflow://${this.workflowId}/nodes`,
          name: 'Current Workflow Nodes',
          description: 'View all nodes in the current workflow',
          mimeType: 'application/json',
        });
        resources.push({
          uri: `workflow://${this.workflowId}/variables`,
          name: 'Current Workflow Variables',
          description: 'View all variables in the current workflow',
          mimeType: 'application/json',
        });
      }
      return { resources };
    });

    // Read resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      const director = await this._getDirector();

      if (uri.includes('/nodes')) {
        const nodes = await director.getWorkflowNodes();
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(nodes, null, 2) }] };
      }
      if (uri.includes('/variables')) {
        const vars = await director.getWorkflowVariables('all');
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(vars, null, 2) }] };
      }
      throw new Error(`Unknown resource: ${uri}`);
    });

    console.error('[MCP] Director MCP Server initialized');
  }

  _createMcpTools() {
    return [
      {
        type: 'function',
        function: {
          name: 'mcp_set_workflow_context',
          description: 'Set current workflow context (required before other tools).',
          parameters: {
            type: 'object',
            properties: {
              workflow_id: { type: 'string', description: 'Workflow ID' },
              user_id: { type: 'string', description: 'Optional user ID' },
              create_if_missing: { type: 'boolean', default: false },
            },
            required: ['workflow_id'],
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'mcp_get_current_context',
          description: 'Return nodes, variables, browser state, plan, and description for current workflow.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
      {
        type: 'function',
        function: {
          name: 'mcp_list_workflows',
          description: 'List recent workflows.',
          parameters: {
            type: 'object',
            properties: { limit: { type: 'number', default: 10 } },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'mcp_browser_screenshot',
          description: 'Take a screenshot via browser_action and save to temp folder.',
          parameters: {
            type: 'object',
            properties: {
              format: { type: 'string', enum: ['png', 'jpeg'], default: 'png' },
              fullPage: { type: 'boolean', default: false },
              tabName: { type: 'string' },
            },
            additionalProperties: false,
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'mcp_get_tool_usage_stats',
          description: 'Tool usage stats for this session.',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
        },
      },
    ];
  }

  async _handleMcpTool(name, args) {
    switch (name) {
      case 'mcp_set_workflow_context':
        return await this._setWorkflowContext(args);
      case 'mcp_get_current_context':
        return await this._getCurrentContext();
      case 'mcp_list_workflows':
        return await this._listWorkflows(args);
      case 'mcp_browser_screenshot':
        return await this._browserScreenshot(args);
      case 'mcp_get_tool_usage_stats':
        return await this._getToolUsageStats();
      default:
        throw new Error(`Unknown MCP tool: ${name}`);
    }
  }

  async _getDirector() {
    if (!this.workflowId) throw new Error('No workflow selected. Use mcp_set_workflow_context first.');
    if (!this.directorInstances.has(this.workflowId)) {
      const director = new DirectorService();
      await director.initialize(this.workflowId, this.userId);
      this.directorInstances.set(this.workflowId, director);
    }
    return this.directorInstances.get(this.workflowId);
  }

  async _setWorkflowContext(args) {
    const { workflow_id, user_id, create_if_missing = false } = args;
    this.userId = user_id || process.env.DEFAULT_USER_ID || 'default-user';

    // Ensure workflow exists if requested
    if (create_if_missing) {
      const { data: existing, error } = await supabase
        .from('workflows')
        .select('id')
        .eq('id', workflow_id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw new Error(`Workflow check failed: ${error.message}`);
      if (!existing) {
        const { error: createErr } = await supabase.from('workflows').insert({
          id: workflow_id,
          goal: `Workflow ${workflow_id}`,
          status: 'draft',
          created_at: new Date().toISOString(),
        });
        if (createErr) throw new Error(`Failed to create workflow: ${createErr.message}`);
      }
    }

    this.workflowId = workflow_id;
    // Reset instance to force re-init on next _getDirector
    this.directorInstances.delete(workflow_id);

    return { message: `Context set: workflow=${workflow_id} user=${this.userId}` };
  }

  async _getCurrentContext() {
    if (!this.workflowId) return { error: 'No workflow selected. Use mcp_set_workflow_context first.' };
    const director = await this._getDirector();
    const context = {
      workflow_id: this.workflowId,
      user_id: this.userId,
      nodes: await director.getWorkflowNodes(),
      variables: await director.getWorkflowVariables('all'),
      browser_state: await director.getBrowserState(),
      plan: await director.getCurrentPlan?.(),
      description: await director.getWorkflowDescription?.(),
    };
    return context;
  }

  async _listWorkflows(args) {
    const { limit = 10 } = args || {};
    const { data, error } = await supabase
      .from('workflows')
      .select('id, goal, status, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to list workflows: ${error.message}`);
    return data;
  }

  async _browserScreenshot(args) {
    const director = await this._getDirector();
    const { format = 'png', fullPage = false, tabName } = args || {};
    const timestamp = Date.now();
    const filename = `mcp_screenshot_${timestamp}.${format}`;
    const filepath = path.join(__dirname, '../temp/screenshots', filename);
    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await director.handleToolCall('browser_action', {
      action: 'screenshot',
      config: { path: filepath, fullPage, ...(tabName ? { tabName } : {}) },
      reason: 'MCP screenshot request',
    });
    return { path: filepath };
  }

  async _getToolUsageStats() {
    const stats = Array.from(this.toolCallStats.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tool, count]) => ({ tool, count }));
    return { total_calls: stats.reduce((s, x) => s + x.count, 0), by_tool: stats };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[MCP] Director MCP Server running (stdio)');
    process.on('SIGINT', () => process.exit(0));
  }
}

async function main() {
  const server = new DirectorMCPServer();
  await server.initialize();
  await server.run();
}

main().catch((err) => {
  console.error('Failed to start Director MCP Server:', err);
  process.exit(1);
});


