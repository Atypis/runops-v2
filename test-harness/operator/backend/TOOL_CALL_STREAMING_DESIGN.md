# Tool Call Live Streaming Design

## Overview
Implement Server-Sent Events (SSE) to stream tool call execution in real-time to the frontend, similar to how browser state updates are streamed.

## Implementation Plan

### 1. Backend Changes

#### A. Add SSE Management to DirectorService
```javascript
// In DirectorService constructor
this.toolCallSSEConnections = new Map(); // workflowId -> [response objects]

// Methods to add
addToolCallSSEConnection(workflowId, res) { ... }
removeToolCallSSEConnection(workflowId, res) { ... }
emitToolCallEvent(workflowId, event) { ... }
```

#### B. Add SSE Endpoint in director.js
```javascript
router.get('/workflows/:id/tool-calls/stream', (req, res) => {
  // Set SSE headers
  // Register connection
  // Handle disconnect
  // Send heartbeat
});
```

#### C. Modify executeToolCall to Emit Events
```javascript
async executeToolCall(toolCallItem, workflowId) {
  const { name: toolName, arguments: toolArgs, call_id } = toolCallItem;
  
  // Emit "start" event
  await this.emitToolCallEvent(workflowId, {
    type: 'tool_call_start',
    callId: call_id,
    toolName,
    timestamp: new Date().toISOString()
  });
  
  try {
    // Execute tool...
    const result = await this.executeTool(...);
    
    // Emit "complete" event
    await this.emitToolCallEvent(workflowId, {
      type: 'tool_call_complete',
      callId: call_id,
      toolName,
      result,
      success: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Emit "error" event
    await this.emitToolCallEvent(workflowId, {
      type: 'tool_call_error',
      callId: call_id,
      toolName,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
```

### 2. Frontend Changes

#### A. Add SSE Connection Management
```javascript
// State for tool call events
const [liveToolCalls, setLiveToolCalls] = useState({});
const toolCallEventSourceRef = useRef(null);

// Connect to SSE when workflow changes
useEffect(() => {
  if (!currentWorkflow?.id) return;
  
  const eventSource = new EventSource(`${API_BASE}/workflows/${currentWorkflow.id}/tool-calls/stream`);
  
  eventSource.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    if (data.type === 'tool_call_start') {
      setLiveToolCalls(prev => ({
        ...prev,
        [data.callId]: {
          toolName: data.toolName,
          status: 'running',
          startTime: data.timestamp
        }
      }));
    } else if (data.type === 'tool_call_complete') {
      setLiveToolCalls(prev => ({
        ...prev,
        [data.callId]: {
          ...prev[data.callId],
          status: 'complete',
          result: data.result,
          endTime: data.timestamp
        }
      }));
    } else if (data.type === 'tool_call_error') {
      setLiveToolCalls(prev => ({
        ...prev,
        [data.callId]: {
          ...prev[data.callId],
          status: 'error',
          error: data.error,
          endTime: data.timestamp
        }
      }));
    }
  };
  
  toolCallEventSourceRef.current = eventSource;
  
  return () => {
    eventSource.close();
  };
}, [currentWorkflow]);
```

#### B. Display Live Tool Calls
```javascript
// Component to show live tool calls
const LiveToolCallIndicator = ({ liveToolCalls }) => {
  const activeCalls = Object.entries(liveToolCalls)
    .filter(([_, call]) => call.status === 'running');
  
  if (activeCalls.length === 0) return null;
  
  return (
    <div className="fixed bottom-20 right-4 bg-white shadow-lg rounded-lg p-4 max-w-sm">
      <div className="text-sm font-semibold mb-2">Executing Tools...</div>
      {activeCalls.map(([callId, call]) => (
        <div key={callId} className="flex items-center space-x-2 mb-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span className="text-sm">{call.toolName}</span>
        </div>
      ))}
    </div>
  );
};
```

#### C. Integrate Live Updates with Message Display
When tool calls complete via SSE, update the assistant message to show them immediately:

```javascript
// In the SSE handler for tool_call_complete
if (data.type === 'tool_call_complete') {
  // Update the latest assistant message if it's still temporary
  setMessages(prev => {
    const updated = [...prev];
    const lastMsg = updated[updated.length - 1];
    
    if (lastMsg?.role === 'assistant' && lastMsg?.isTemporary) {
      // Add the completed tool call to the message
      lastMsg.toolCalls = lastMsg.toolCalls || [];
      lastMsg.toolCalls.push({
        toolName: data.toolName,
        result: data.result,
        success: true
      });
    }
    
    return updated;
  });
}
```

### 3. Benefits

1. **Real-time Visibility**: Users see tools executing as they happen
2. **Better UX**: No more waiting without feedback
3. **Debugging**: Easier to see which tool is taking time
4. **Progress Tracking**: Can add progress for long-running tools
5. **Error Visibility**: Immediate feedback when tools fail

### 4. Optional Enhancements

1. **Tool Progress**: For tools like `execute_nodes`, emit progress events
2. **Execution Time**: Show how long each tool has been running
3. **Tool Queue**: Show upcoming tools if multiple are queued
4. **Sound Effects**: Optional audio feedback for tool completion
5. **Tool Filtering**: Allow users to filter which tools they want to see

### 5. Implementation Order

1. Backend SSE endpoint and connection management
2. Emit events from executeToolCall  
3. Frontend SSE connection
4. Basic live tool call display
5. Integration with message updates
6. Polish and enhancements