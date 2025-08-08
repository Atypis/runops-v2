# Director MCP Server

This MCP (Model Context Protocol) server enables Claude Code to directly access and use Director 2.0 tools, creating a seamless workflow automation development experience.

## Overview

The Director MCP Server provides:
- Direct access to all Director 2.0 tools (node creation, browser actions, DOM exploration)
- Workflow context management
- Browser screenshot capabilities
- Tool usage analytics
- Frontend synchronization (optional)

## Installation

1. Install dependencies:
```bash
cd test-harness/operator/backend/mcp
npm install
```

2. Configure Claude Code settings:

Add to your Claude Code settings JSON:
```json
{
  "mcpServers": {
    "director": {
      "command": "node",
      "args": ["/Users/a1984/runops-v2/Johny Ive 3/test-harness/operator/backend/mcp/server.js"],
      "env": {
        "NODE_ENV": "development"
      }
    }
  }
}
```

## Usage

### 1. Set Workflow Context

Before using any Director tools, set the workflow context:

```javascript
mcp_set_workflow_context({
  workflow_id: "my-workflow-id",
  create_if_missing: true
})
```

### 2. Use Director Tools

Once context is set, use any Director tool directly:

```javascript
// Explore a page
dom_overview({
  filters: {
    interactives: true,
    headings: true
  }
})

// Add nodes to workflow
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "browser_action",
    config: {
      action: "navigate",
      url: "https://example.com"
    },
    alias: "go_to_example"
  }]
})

// Execute nodes
execute_nodes({
  nodeSelection: "all",
  mode: "flow"
})
```

### 3. MCP-Specific Tools

The server adds several MCP-specific tools:

- `mcp_set_workflow_context` - Set the current workflow
- `mcp_get_current_context` - Get comprehensive workflow state
- `mcp_list_workflows` - List available workflows
- `mcp_browser_screenshot` - Take screenshots
- `mcp_get_tool_usage_stats` - See which tools you've used
- `mcp_sync_with_frontend` - Sync with running frontend (if available)

## Architecture

```
Claude Code <--MCP--> Director MCP Server <--> Director Service
                                           |
                                           ├── Browser/Stagehand
                                           ├── Workflow State (Supabase)
                                           └── DOM Tools
```

## Development Workflow

1. **Set Context**: Start by setting your workflow context
2. **Explore**: Use DOM tools to understand the application
3. **Build**: Create nodes based on your exploration
4. **Test**: Execute nodes to verify they work
5. **Iterate**: Refine based on results

## Environment Variables

The server respects these environment variables:
- `OPENAI_API_KEY` - For AI-powered tools
- `OPENROUTER_API_KEY` - For KIMI model support
- `DEFAULT_USER_ID` - Default user ID if not specified
- `NODE_ENV` - Development/production mode

## Troubleshooting

### "No workflow selected" Error
Run `mcp_set_workflow_context` first.

### Browser not starting
Ensure Docker is running if using containerized browser.

### Frontend sync not working
The frontend API endpoint is optional. Use manual workflow selection if not implemented.

## Future Enhancements

- [ ] Real-time frontend synchronization
- [ ] Multi-workflow management
- [ ] Tool modification capabilities
- [ ] Workflow templates
- [ ] Export/import workflows