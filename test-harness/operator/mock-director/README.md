# Mock Operator

This directory contains the mock operator response system that allows Claude Code to act as the operator.

## How it works:

1. When mock mode is enabled, the operator reads from `response.json` instead of calling OpenAI
2. Claude Code edits `response.json` to craft operator responses
3. The frontend sees nodes appear just like with the real operator

## Response Format:

```json
{
  "message": "Human-readable response to show in chat",
  "toolCalls": [
    {
      "toolCallId": "mock_1",
      "toolName": "create_node",
      "result": {
        "type": "browser_action",
        "config": { ... },
        "description": "Node description"
      }
    }
  ]
}
```

## Available Tool Names:
- create_node
- create_workflow_sequence
- update_node
- delete_node
- connect_nodes
- execute_workflow
- test_node