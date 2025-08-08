# Mock Operator Mode

## Overview

Mock Operator Mode allows Claude Code to act as the operator by editing JSON files directly, bypassing the OpenAI API while maintaining full system compatibility.

## Architecture

```
User (Frontend) 
    ↓
Operator API 
    ↓
[Mock Mode Check]
    ├─ Normal Mode → OpenAI API
    └─ Mock Mode → Read mock-operator/response.json
    ↓
Process Tool Calls
    ↓
Update Database
    ↓
Frontend Updates
```

## Implementation

### 1. Backend Changes (operatorService.js)

When `MOCK_OPERATOR_MODE=true`, the operator service:
- Skips OpenAI API call
- Reads from `/mock-operator/response.json`
- Processes the response exactly like a real operator response

### 2. Frontend Toggle

Add a toggle button that:
- Sets a flag in localStorage or session
- Includes `mockMode: true` in API requests
- Shows an indicator when in mock mode

### 3. File Structure

```
operator/
├── mock-operator/
│   ├── response.json      # Claude Code edits this
│   ├── README.md         # Instructions
│   └── examples/         # Example responses
```

## Usage Flow

1. **User enables mock mode** in frontend
2. **User sends message** via chat interface
3. **Backend logs the message** for Claude Code to see
4. **Claude Code**:
   - Sees the message in logs
   - Edits `response.json` with appropriate tool calls
   - Saves the file
5. **User clicks "Send" again** (or auto-refresh)
6. **Backend reads the file** and processes tool calls
7. **Frontend updates** with new nodes

## Response Format

```json
{
  "message": "I'll help you build that workflow. Let me create the nodes.",
  "toolCalls": [
    {
      "toolCallId": "mock_1",
      "toolName": "create_workflow_sequence",
      "result": {
        "nodes": [
          {
            "type": "browser_action",
            "config": {
              "action": "navigate",
              "url": "https://example.com"
            },
            "description": "Navigate to site"
          },
          {
            "type": "browser_query",
            "config": {
              "method": "extract",
              "instruction": "Check if logged in",
              "schema": {"isLoggedIn": "boolean"}
            },
            "description": "Check login status"
          }
        ]
      }
    }
  ]
}
```

## Benefits

1. **No API costs** - Bypasses OpenAI
2. **Full control** - Claude Code crafts exact responses
3. **Debugging** - See exactly what operator is doing
4. **Learning** - Understand operator internals
5. **Speed** - No API latency

## Implementation Checklist

- [ ] Add MOCK_OPERATOR_MODE check in operatorService.js
- [ ] Create file watcher for response.json
- [ ] Add frontend toggle button
- [ ] Add mock mode indicator in UI
- [ ] Test with simple workflow
- [ ] Document common response patterns

## Example Workflows

### Simple Navigation
```json
{
  "message": "Navigating to the website.",
  "toolCalls": [{
    "toolCallId": "nav_1",
    "toolName": "create_node",
    "result": {
      "type": "browser_action",
      "config": {"action": "navigate", "url": "https://example.com"}
    }
  }]
}
```

### Complex Login Flow
```json
{
  "message": "I'll create a login flow with email and password.",
  "toolCalls": [{
    "toolCallId": "seq_1",
    "toolName": "create_workflow_sequence",
    "result": {
      "nodes": [
        {
          "type": "browser_action",
          "config": {"action": "type", "selector": "#email", "text": "{{email}}"}
        },
        {
          "type": "browser_action",
          "config": {"action": "type", "selector": "#password", "text": "{{password}}"}
        },
        {
          "type": "browser_action",
          "config": {"action": "click", "selector": "button[type='submit']"}
        }
      ]
    }
  }]
}
```

## Notes

- The system remains 100% compatible with normal operation
- Tool calls are validated exactly like real operator responses
- All existing operator features work (update, delete, etc.)
- Frontend doesn't know the difference between mock and real