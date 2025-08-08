# Frontend-Backend Connection Issues

## Problem Description
Intermittent communication failures between frontend and backend:
- Sometimes messages are sent but no response is received
- WebSocket connections are unstable (multiple disconnects/reconnects)
- SSE streams are closing unexpectedly
- Works sometimes after page refresh + server restart

## Root Causes Identified

1. **Race Conditions**: Multiple EventSource/WebSocket connections are created when switching workflows or refreshing quickly
2. **No Proper Cleanup**: Old connections may not be properly closed before new ones are created
3. **Connection Timing**: The ReasoningStream WebSocket tries to reconnect every 2 seconds, which may interfere with other connections

## Symptoms in Logs
```
[WebSocket] Client disconnected
[WebSocket] New connection
[SSE] Tool call stream closed for workflow: [old-id]
[SSE] Browser state stream closed for workflow: [old-id]
[ReasoningStream] Attempting to reconnect...
```

## Potential Solutions

1. **Add Connection Debouncing**: Wait for old connections to close before opening new ones
2. **Single Connection Manager**: Create a connection manager that ensures only one set of connections per workflow
3. **Add Connection State Tracking**: Track connection state to prevent duplicate connections
4. **Implement Exponential Backoff**: For WebSocket reconnection attempts

## Quick Fix to Try

1. Clear browser cache/local storage
2. Ensure only one browser tab is open
3. Wait a few seconds after page load before sending messages
4. Check browser console for any CORS or network errors

## Long-term Fix Needed

Implement a proper connection lifecycle management system that:
- Ensures old connections are closed before new ones open
- Prevents duplicate connections to the same workflow
- Handles reconnection with exponential backoff
- Provides clear connection status to the user