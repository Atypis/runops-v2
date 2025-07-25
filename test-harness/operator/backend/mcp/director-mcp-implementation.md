# Director MCP Implementation

## Overview

This document describes the implementation of the Director MCP (Model Context Protocol) server, which enables Claude Code to directly access and use Director 2.0 tools, creating a seamless workflow automation development experience.

## Background & Motivation

### The Problem: Friction in the Development Loop

The user observed a pattern while working with Director:
1. Director encounters limitations or needs new features while building workflows
2. Director specifies the problem and potential solution
3. User copy-pastes specification to coding assistant (Claude Code)
4. Coding assistant implements features and creates testing plan
5. User copy-pastes back to Director for testing
6. Director provides test results
7. Repeat...

This ping-pong process, while effective, involved significant manual copy-pasting and context switching.

### The Vision: "The Machine that Builds the Machine"

Key insight: The Director is constantly using the tools and exposed to their limitations in real-world scenarios, unlike developers who work in abstract terms. This led to the question:

> "Can I just give YOU (Claude Code) the tools that the director has been using and MAKE YOU the director?"

The goal: Enable Claude Code to directly use Director tools, dogfood the system, and rapidly iterate on the software stack based on actual usage.

## Implementation Approach

### MCP Server Architecture

We chose MCP (Model Context Protocol) as the integration method because:
1. **Persistent Context**: Maintains Director instance, browser state, and workflow context
2. **Full Tool Access**: Direct access to all Director tools
3. **Bidirectional Flow**: Can both use and modify tools in real-time
4. **Clean Separation**: Director system remains independent but accessible

### Key Design Decisions

1. **Shared State via Database**
   - MCP server and Director both use the same Supabase instance
   - Ensures consistency across different access methods

2. **Workflow Context Management**
   - Explicit workflow selection via `mcp_set_workflow_context`
   - Support for creating workflows on-the-fly
   - Context persists across tool calls

3. **Browser Session Reuse**
   - Director instances are cached per workflow
   - Browser sessions maintained across calls
   - Cleanup handled on server shutdown

4. **MCP-Specific Tools**
   - Added convenience tools for MCP usage patterns
   - Screenshot capabilities for debugging
   - Tool usage statistics for optimization

## Implementation Details

### File Structure
```
backend/mcp/
├── server.js              # Main MCP server implementation
├── package.json           # Dependencies (MCP SDK)
├── README.md             # Usage documentation
├── example-usage.md      # Practical examples
├── claude-code-config.json # Configuration template
└── setup.sh              # Setup instructions
```

### Core Components

#### 1. MCP Server (`server.js`)
- Exposes all Director tools via MCP protocol
- Manages Director instances per workflow
- Handles tool call routing and error handling
- Provides SSE-style event streaming

#### 2. DirectorService Extensions
- Added `initialize(workflowId, userId)` method
- Added `handleToolCall(toolName, args)` for direct execution
- Added convenience methods for common operations

#### 3. MCP-Specific Tools
- `mcp_set_workflow_context` - Set current workflow
- `mcp_get_current_context` - Get comprehensive state
- `mcp_list_workflows` - List available workflows
- `mcp_browser_screenshot` - Take screenshots
- `mcp_get_tool_usage_stats` - Usage analytics
- `mcp_sync_with_frontend` - Frontend synchronization (optional)

### Configuration

The server is configured in Claude Code's settings:
```json
{
  "mcpServers": {
    "director": {
      "command": "node",
      "args": ["/path/to/mcp/server.js"],
      "env": {
        "NODE_ENV": "development",
        "DEFAULT_USER_ID": "default-user"
      }
    }
  }
}
```

## Usage Patterns

### Basic Workflow
1. Set workflow context
2. Explore application with DOM tools
3. Build nodes based on exploration
4. Execute and test nodes
5. Iterate based on results

### Advanced Patterns
- Parallel tool execution for performance
- State inspection for debugging
- Screenshot capture for visual validation
- Tool usage analysis for optimization

## Benefits Achieved

1. **Zero Friction Development**
   - No copy-pasting between interfaces
   - Direct access to all Director tools
   - Immediate feedback loop

2. **True Dogfooding**
   - Developer experiences tools exactly as Director does
   - Pain points immediately apparent
   - Solutions driven by actual usage

3. **Rapid Iteration**
   - Test changes instantly
   - Modify tools based on real needs
   - Build features while using them

4. **Unified Context**
   - Same workflow state across all tools
   - Browser sessions persist
   - Variables and nodes accessible

## Future Enhancements

1. **Real-time Frontend Sync**
   - WebSocket connection to frontend
   - Live node visualization
   - Bidirectional state updates

2. **Meta-Capabilities**
   - Tool modification from within MCP
   - Dynamic tool generation
   - Self-improving workflows

3. **Multi-Workflow Management**
   - Switch between workflows seamlessly
   - Workflow templates
   - Import/export capabilities

## Technical Notes

### Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- Existing Director backend services
- Supabase for state persistence

### Environment Variables
- `OPENAI_API_KEY` - For AI-powered tools
- `OPENROUTER_API_KEY` - For KIMI model support
- `DEFAULT_USER_ID` - Default user if not specified
- Standard Supabase configuration

### Error Handling
- Tool calls wrapped in try-catch
- Errors returned as structured responses
- Browser cleanup on failure
- Graceful degradation for missing features

## Conclusion

The Director MCP server successfully creates "the machine that builds the machine" - a development environment where the tools can be improved while being used, creating a tight feedback loop that produces exactly what's needed for real-world workflow automation.