# Director 3.0 System Prompt Design Document

This file is for documenting the design process of the Director 3.0 system prompt.

## Current Status

The Director 3.0 system prompt has been implemented in `directorPromptV3.js` and includes:

1. **Core Philosophy**: Deterministic Navigation, Intelligent Processing
2. **Workflow Loop**: Plan � Scout � Build � Execute � Validate � Update � Repeat
3. **Context Model**: Clean Context 2.0 with on-demand retrieval tools
4. **Tool Definitions**: All tools properly defined including the context retrieval tools

## Clean Context 2.0 Tools (Fixed)

The following context retrieval tools have been fixed and added to the executeToolCall method:

- `get_current_plan` - Get the current workflow plan with phases, tasks, and progress
- `get_workflow_nodes` - Get detailed information about workflow nodes  
- `get_workflow_variables` - Get current state data (use "all" for complete dump)
- `get_workflow_description` - Get full requirements and business rules
- `get_browser_state` - Get current browser tabs

These tools were previously only implemented in the legacy processToolCalls method but were missing from the executeToolCall method used by the Responses API control loop. This has now been fixed.

## Recent Improvements

### Tab Name Requirement (2025-07-15)

The `openNewTab` action now **requires** a `name` parameter. This ensures:
- All tabs can be tracked in browser state
- Tabs can be referenced by name in `switchTab` actions
- The `get_browser_state` tool shows all open tabs

Example:
```javascript
// Correct - with name
{action: "openNewTab", url: "https://facebook.com", name: "facebook"}

// Will throw error - missing name
{action: "openNewTab", url: "https://facebook.com"}
```

Error message guides users: "openNewTab requires a 'name' parameter. Example: {action: 'openNewTab', url: 'https://example.com', name: 'example'}. This name is used to reference the tab in switchTab actions and browser state tracking."

## Next Steps

The Clean Context 2.0 system is now fully operational with all context retrieval tools working properly.