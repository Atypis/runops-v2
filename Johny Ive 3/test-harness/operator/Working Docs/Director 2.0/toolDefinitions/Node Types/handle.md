# HANDLE Node - Error Boundaries and Recovery Patterns

> ⚠️ **DEPRECATION NOTICE**: The HANDLE node has been temporarily deprecated as of January 2025. It has been removed from toolDefinitionsV2.js and directorPromptV3.js. The implementation code remains in the codebase for potential future reactivation. This documentation is preserved for reference purposes.

## Overview

The HANDLE node was a control flow primitive that provided error boundaries with recovery strategies in workflows. It implemented a try/catch/finally pattern that enabled robust error handling, recovery attempts, and cleanup operations - essential for building resilient automations that can gracefully handle UI failures and unexpected states.

## Core Concept

Think of HANDLE nodes as safety nets around risky operations. They allow workflows to:
- Attempt operations that might fail
- Define recovery strategies when failures occur
- Ensure cleanup runs regardless of success or failure
- Escalate intelligently from deterministic to AI-powered recovery

## Configuration Structure

```javascript
{
  type: "handle",
  config: {
    try: [nodeIds] | nodeId,      // Node(s) to attempt
    catch: [nodeIds] | nodeId,    // Recovery node(s) if try fails (optional)
    finally: [nodeIds] | nodeId   // Cleanup node(s) that always run (optional)
  },
  alias: "error_handler",
  description: "Handle login errors with recovery"
}
```

### Required Fields
- `type`: Must be "handle"
- `config`: Configuration object
  - `try`: The node(s) to attempt (can be single node ID or array)
- `alias`: Unique identifier for the node

### Optional Fields
- `config.catch`: Node(s) to execute if try block fails
- `config.finally`: Node(s) to execute regardless of success/failure
- `description`: Human-readable description
- `store_variable`: Boolean to store error details (default: false)

## Execution Flow

1. **Try Block**: Executes the specified node(s)
2. **On Success**: Skips catch block, executes finally block if present
3. **On Failure**: 
   - Stores error details in workflow state
   - Executes catch block if present
   - Executes finally block if present
   - Re-throws error if no successful recovery

## Error State Management

When an error occurs in the try block, the handle node automatically stores error information:

```javascript
{
  lastError: {
    message: "Element not found: #submit-button",
    stack: "Error stack trace...",
    timestamp: "2024-01-15T10:30:00.000Z"
  }
}
```

This error state is accessible in catch blocks via `{{lastError}}`.

## Common Patterns

### 1. Basic Error Recovery

```javascript
{
  type: "handle",
  config: {
    try: "click_submit",
    catch: "click_alternate_submit"
  },
  alias: "submit_with_fallback"
}
```

### 2. UI State Recovery Pattern

The most powerful pattern combines setup, verification, and cleanup with intelligent fallback:

```javascript
{
  type: "handle",
  config: {
    try: ["apply_filter", "verify_filter_active"],
    catch: [
      "reset_filters",              // Clean slate
      "apply_filter",               // Retry deterministically
      "verify_filter_active",       // Check again
      "agent_recovery"              // AI-powered fallback
    ],
    finally: "cleanup_filter_state"
  },
  alias: "resilient_filter_operation"
}
```

### 3. Multi-Step Operations with Cleanup

```javascript
{
  type: "handle",
  config: {
    try: [
      "open_modal",
      "fill_form_fields", 
      "submit_form",
      "wait_for_success"
    ],
    catch: "log_form_error",
    finally: ["close_modal", "clear_form_state"]
  },
  alias: "safe_form_submission"
}
```

### 4. Nested Error Boundaries

```javascript
{
  type: "handle",
  config: {
    try: [
      "navigate_to_page",
      {
        type: "handle",
        config: {
          try: "complex_interaction",
          catch: "simple_fallback"
        }
      }
    ],
    catch: "return_to_home",
    finally: "log_attempt"
  },
  alias: "nested_error_handling"
}
```

## Best Practices

### 1. Keep Try Blocks Small
- Limit try blocks to closely related operations
- Makes it easier to identify what failed
- Enables more targeted recovery strategies

### 2. Progressive Enhancement
Start with deterministic recovery, escalate to AI when needed:
```javascript
catch: [
  "deterministic_fix",     // Fast, predictable
  "validate_fix_worked",   // Verify
  "ai_powered_recovery"    // Last resort
]
```

### 3. Always Clean Up
Use finally blocks for:
- Closing modals/popups
- Clearing temporary state
- Resetting UI to neutral state
- Releasing resources

### 4. Meaningful Error Messages
Store context in catch blocks:
```javascript
{
  type: "context",
  config: {
    operation: "set",
    key: "last_operation_error",
    value: {
      operation: "filter_application",
      attempted_at: "{{timestamp}}",
      error: "{{lastError.message}}",
      recovery_attempted: true
    }
  }
}
```

### 5. Avoid Deep Nesting
Instead of deeply nested handle nodes, use sequential handle blocks:
```javascript
// Good - Sequential handling
[
  { type: "handle", config: { try: "risky_op_1", catch: "fix_1" } },
  { type: "handle", config: { try: "risky_op_2", catch: "fix_2" } }
]

// Avoid - Deep nesting
{
  type: "handle",
  config: {
    try: {
      type: "handle",
      config: {
        try: { type: "handle", ... }  // Too deep!
      }
    }
  }
}
```

## Integration with Other Nodes

### With Agent Nodes
Use handle to provide structure around agent exploration:
```javascript
{
  type: "handle",
  config: {
    try: "deterministic_navigation",
    catch: {
      type: "agent",
      config: {
        goal: "Find and click the submit button",
        maxSteps: 10
      }
    }
  }
}
```

### With Iterate Nodes
Wrap iterations in handle for per-item error recovery:
```javascript
{
  type: "iterate",
  config: {
    over: "{{items}}",
    variable: "item",
    body: {
      type: "handle",
      config: {
        try: "process_item",
        catch: "mark_item_failed"
      }
    },
    continueOnError: true
  }
}
```

### With Route Nodes
Use handle to ensure consistent state before routing:
```javascript
{
  type: "handle",
  config: {
    try: "check_login_state",
    catch: "attempt_auto_login",
    finally: {
      type: "route",
      config: {
        value: "{{isLoggedIn}}",
        paths: {
          "true": "continue_workflow",
          "false": "show_login_required"
        }
      }
    }
  }
}
```

## Variable Storage

When `store_variable` is true, the handle node stores:
```javascript
{
  success: boolean,        // Whether try block succeeded
  error: {                // Only if error occurred
    message: string,
    stack: string,
    timestamp: string
  },
  recovered: boolean      // Whether catch block succeeded
}
```

Access via: `{{error_handler.success}}`, `{{error_handler.error.message}}`

## Common Pitfalls

### 1. Empty Catch Blocks
Don't use empty catch blocks - they hide errors:
```javascript
// Bad
{ catch: [] }  

// Good - At least log the error
{ catch: "log_error_node" }
```

### 2. Infinite Retry Loops
Avoid catch blocks that could trigger the same error:
```javascript
// Bad - Could loop forever
{
  try: "click_button",
  catch: "click_button"  // Same operation!
}

// Good - Different approach
{
  try: "click_button",
  catch: "click_button_by_text"
}
```

### 3. Missing Finally Cleanup
Always clean up UI state changes:
```javascript
// Bad - Modal might stay open
{
  try: ["open_modal", "submit_form"],
  catch: "handle_error"
  // No finally to close modal!
}

// Good
{
  try: ["open_modal", "submit_form"],
  catch: "handle_error",
  finally: "close_modal"
}
```

## Performance Considerations

1. **Finally Always Runs**: Even if catch succeeds, finally executes
2. **Error Propagation**: Unhandled errors bubble up to parent nodes
3. **State Isolation**: Each handle node gets fresh error state
4. **Execution Order**: try → catch (on error) → finally (always)

## Real-World Example: Resilient Form Submission

```javascript
{
  type: "handle",
  config: {
    try: [
      {
        type: "browser_action",
        config: { action: "click", selector: "#open-form-button" },
        alias: "open_form"
      },
      {
        type: "browser_query",
        config: { 
          method: "validate",
          rules: [{ type: "element_exists", selector: ".form-modal" }]
        },
        alias: "verify_form_open"
      },
      {
        type: "browser_ai_action",
        config: { 
          action: "type",
          instruction: "Fill in the email field",
          text: "{{user.email}}"
        },
        alias: "fill_email"
      },
      {
        type: "browser_action",
        config: { action: "click", selector: "button[type='submit']" },
        alias: "submit_form"
      }
    ],
    catch: [
      {
        type: "context",
        config: {
          operation: "set",
          key: "form_error",
          value: {
            error: "{{lastError.message}}",
            attempted_at: "{{timestamp}}"
          }
        },
        alias: "log_error"
      },
      {
        type: "browser_action",
        config: { action: "refresh" },
        alias: "refresh_page"
      },
      {
        type: "agent",
        config: {
          goal: "Find and submit the contact form with email {{user.email}}",
          maxSteps: 15
        },
        alias: "ai_form_submission"
      }
    ],
    finally: [
      {
        type: "browser_query",
        config: {
          method: "validate",
          rules: [{ type: "element_exists", selector: ".form-modal" }],
          onFailure: "continue_with_error"
        },
        alias: "check_modal_exists"
      },
      {
        type: "browser_action",
        config: { action: "keypress", key: "Escape" },
        alias: "close_any_modal"
      }
    ]
  },
  alias: "resilient_form_submission",
  description: "Submit form with automatic recovery and cleanup"
}
```

This example demonstrates:
- Structured try block with validation
- Progressive error recovery (log → refresh → AI agent)
- Guaranteed cleanup (close modal with Escape key)
- Error context preservation for debugging

## Summary

The HANDLE node was essential for building production-ready workflows that could gracefully handle the unpredictable nature of web UIs. By combining deterministic recovery attempts with AI-powered fallbacks and guaranteed cleanup, it enabled workflows to be both fast and resilient.

## Deprecation Status

### Why Deprecated
The HANDLE node has been temporarily deprecated to simplify the node type system and reduce complexity while the Director 2.0 system stabilizes. The decision was made to focus on core functionality before reintroducing advanced error handling patterns.

### Current Alternatives
While the HANDLE node is deprecated, you can achieve similar error handling patterns using:

1. **Sequential Validation**: Use browser_query nodes with validation rules after risky operations
2. **Route-Based Recovery**: Use route nodes to check operation success and branch to recovery logic
3. **Iterate with continueOnError**: For batch operations, use iterate nodes with `continueOnError: true`
4. **Manual State Tracking**: Use context nodes to track operation status and implement recovery logic

### Implementation Status
- **Tool Definitions**: Removed from `toolDefinitionsV2.js` enum
- **System Prompt**: Removed from `directorPromptV3.js` node types list
- **Execution Code**: Still present in:
  - `/test-harness/operator/backend/services/nodeExecutor.js` (case not implemented)
  - `/test-harness/workflows/executor/primitives/handle.js` (full implementation)
  - `/workflows/executor/primitives.js` (executeHandle method)

### Future Considerations
The HANDLE node may be reintroduced once:
- Core node types are fully stabilized
- Clear patterns emerge for error handling needs
- User feedback indicates strong need for try/catch/finally patterns in workflows

For now, focus on building robust workflows using validation nodes and conditional routing to handle error cases explicitly.