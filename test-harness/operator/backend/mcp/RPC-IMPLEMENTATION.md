# RPC Implementation for MCP Server

## Problem Solved
Previously, any changes to the Director backend required restarting Claude Code, which broke context and was highly disruptive.

## Solution
Implemented an RPC (Remote Procedure Call) architecture where:
1. The MCP server is now a thin proxy that forwards calls to the backend
2. All Director logic remains in the main backend (port 3003)
3. Changes to the backend take effect immediately without restarting Claude Code

## Architecture

```
Claude Code 
    ↓
MCP Server (thin proxy)
    ↓ (RPC via HTTP)
Backend Server (port 3003)
    ↓
Director Service (all logic here)
```

## What Changed

### 1. MCP Server (`mcp/server.js`)
- Removed `DirectorService` import and instantiation
- Replaced `getDirectorInstance()` with RPC proxy that forwards calls
- Added `callBackendRPC()` method for HTTP communication

### 2. Backend Routes (`routes/director.js`)
- Added RPC endpoints:
  - `/api/director/initialize`
  - `/api/director/handleToolCall`
  - `/api/director/getWorkflowNodes`
  - `/api/director/getWorkflowVariables`
  - `/api/director/getBrowserState`

## Usage

1. **One-time setup**: Restart Claude Code to load the updated MCP server
2. **After that**: Changes to Director logic take effect immediately
3. **Backend can be restarted** without affecting Claude Code connection

## Testing

Run the test script to verify RPC is working:
```bash
node mcp/test-rpc.js
```

## Benefits

- ✅ No more Claude Code restarts for backend changes
- ✅ Backend can be developed/debugged independently
- ✅ Shared state across all connections
- ✅ Better error handling and logging
- ✅ Can use nodemon for backend auto-reload

## Future Improvements

1. Add WebSocket support for real-time updates
2. Implement connection pooling for better performance
3. Add retry logic for network failures
4. Cache frequently accessed data in MCP server