# execute_nodes Function Documentation

## Overview

The `execute_nodes` function is the primary tool for testing and validating workflow nodes during development. It provides two execution modes to handle different testing scenarios:

1. **isolated mode** (default) - Executes all nodes in selection sequentially, ignoring control flow
2. **flow mode** - Respects route decisions and skips nodes in unexecuted branches

## Function Signature

```javascript
execute_nodes({
  nodeSelection: string,    // Required: "5", "3-5", "1-3,10,15-17", or "all"
  mode?: string,           // Optional: "isolated" (default) or "flow"
  resetBrowserFirst?: boolean // Optional: Reset browser before execution (default: false)
})
```

## Parameters

### nodeSelection (required)
Specifies which nodes to execute:
- **Single node**: `"5"` - Executes only node at position 5
- **Range**: `"3-5"` - Executes nodes 3, 4, and 5
- **Multiple**: `"1-3,10,15-17"` - Executes specified nodes and ranges
- **All**: `"all"` - Executes every node in the workflow

### mode (optional)
Controls execution behavior:
- **"isolated"** (default): Execute all nodes in selection sequentially, ignoring route decisions
- **"flow"**: Respect route decisions and skip nodes in unexecuted branches

### resetBrowserFirst (optional)
Boolean flag to reset browser state before execution (default: false)

## Execution Modes Explained

### Isolated Mode (Default)
**Purpose**: Direct node-by-node execution for debugging individual nodes

**Behavior**:
- Executes ALL nodes in the selection sequentially by position
- Ignores route decisions completely
- No iteration context setup
- Every node in the range executes regardless of control flow

**Use Cases**:
- Testing specific node configurations
- Debugging individual node behavior
- Validating node parameters work correctly
- When you need to force execution of specific nodes

**Example**:
```javascript
// Test login form nodes even if already authenticated
execute_nodes({
  nodeSelection: "4-6",  // email, password, submit
  mode: "isolated"       // Forces execution of all three nodes
})
```

### Flow Mode
**Purpose**: Execute nodes while respecting workflow logic and control flow

**Behavior**:
- Tracks route decisions and skips nodes in unexecuted branches
- Respects iteration contexts
- Skips nested nodes (those with `_parent_position`)
- Mimics real workflow execution within the selection

**Use Cases**:
- Testing workflows with conditional logic
- Validating route branches work correctly
- Testing complete workflow sections
- When you need realistic execution behavior

**Example**:
```javascript
// Test auth flow that branches based on login status
execute_nodes({
  nodeSelection: "1-10",
  mode: "flow"         // Will skip login nodes if already authenticated
})
```

## Implementation Details

### Location
`test-harness/operator/backend/services/directorService.js`

### Flow Control Implementation
In flow mode, the function uses a `skippedNodes` Set to track nodes that should not execute:

1. **After route execution**: Analyzes which branch was taken
2. **Marks unexecuted branches**: Adds all node positions from non-taken branches to skippedNodes
3. **Skips marked nodes**: Before executing each node, checks if it's in the skippedNodes Set
4. **Handles nested nodes**: Skips nodes with `_parent_position` (executed by their parent)

### Route Format Support
The function handles both route formats for backward compatibility:
- **New format**: `params` array with branch objects
- **Old format**: `params.paths` object (legacy)

## Return Structure

```javascript
{
  execution_results: [
    {
      node_position: number,
      node_id: string,
      status: 'success' | 'error' | 'skipped',  // 'skipped' only in flow mode
      result?: any,                             // For successful executions
      error_details?: string,                   // For errors
      message?: string,                         // For skipped nodes
      execution_time: string,                   // e.g., "1.2s"
      page_observation?: string                 // Optional UI state
    }
  ],
  summary: {
    total_requested: number,
    successfully_executed: number,
    failed: number,
    skipped: number,        // Only present when nodes are skipped
    execution_time: string
  },
  error?: string           // Only present on complete failure
}
```

## Tool Definition

```javascript
{
  type: 'function',
  function: {
    name: 'execute_nodes',
    description: 'Execute specific workflow nodes with optional control flow awareness. Use mode="isolated" to test nodes individually, or mode="flow" to respect route decisions and iteration contexts.',
    parameters: {
      type: 'object',
      properties: {
        nodeSelection: {
          type: 'string',
          description: 'Nodes to execute. Formats: single node "5", range "3-5", multiple "1-3,10,15-17", or "all" for entire workflow',
          pattern: '^(all|\\d+(-\\d+)?(,\\d+(-\\d+)?)*)$'
        },
        mode: {
          type: 'string',
          enum: ['isolated', 'flow'],
          default: 'isolated',
          description: 'Execution mode. isolated: execute all nodes in sequence ignoring control flow (default). flow: respect route decisions and skip nodes in unexecuted branches.'
        },
        resetBrowserFirst: {
          type: 'boolean',
          default: false,
          description: 'Reset browser state before execution. Useful for clean test runs.'
        }
      },
      required: ['nodeSelection'],
      additionalProperties: false
    },
    strict: true
  }
}
```

## Usage in Director Workflow Loop

The Director uses execute_nodes as part of its core development loop:

1. **Scout** - Understand the UI
2. **Build** - Create/modify nodes
3. **Execute** - Test with appropriate mode:
   - Use `isolated` for debugging specific nodes
   - Use `flow` for testing complete workflow sections
4. **Validate** - Analyze results
5. **Refine** - Adjust based on outcomes

## Common Patterns

### Testing Individual Nodes
```javascript
// Force execution of specific nodes regardless of routes
execute_nodes({
  nodeSelection: "5-7",
  mode: "isolated"
})
```

### Testing Conditional Workflows
```javascript
// Test auth flow that branches based on login status
execute_nodes({
  nodeSelection: "1-20",
  mode: "flow"  // Respects route decisions
})
```

### Full Workflow Testing
```javascript
// Execute entire workflow with proper branching
execute_nodes({
  nodeSelection: "all",
  mode: "flow",
  resetBrowserFirst: true  // Clean slate
})
```

## Key Differences from execute_workflow

- **execute_workflow** was never fully implemented and is being removed
- **execute_nodes with mode="flow"** provides the same capability
- More flexible as it allows testing specific sections with flow control
- Single tool for all execution needs reduces complexity

## Edge Cases and Considerations

### Route Node Behavior
When a route node executes in flow mode:
- The function tracks which branch was taken via the `path` property
- All node positions in non-taken branches are added to skippedNodes
- These nodes will show status: 'skipped' in the results

### Nested Routes
- Only immediate branch nodes are tracked for skipping
- Deeply nested routes are handled when their parent route executes
- This matches the behavior of the group node executor

### Missing Nodes
- If a requested position doesn't exist, it appears in results with error status
- Execution continues with remaining nodes
- Missing positions don't affect flow control logic

### Error Handling
- Execution stops on first error (fail-fast approach)
- In flow mode, subsequent nodes that would be skipped still appear as skipped
- Error details are included in the results for debugging

## Known Issues and Solutions

### Cognition Node Result Wrapping
**Issue**: Some cognition nodes return wrapped primitives like `{result: true}` instead of just `true`, causing route conditions to fail.

**Root Cause**: When the AI responds to boolean/string/number schemas, it sometimes wraps the value in an object.

**Solution**: The system now automatically unwraps these values:
- Detects when cognition results are wrapped: `{result: primitive}`
- Unwraps before storing in workflow_memory
- Route conditions like `{{check_header}}` now correctly evaluate to `true/false`

**Note**: If you encounter this issue with existing variables:
1. Re-run the cognition node to store the unwrapped value
2. Or update route conditions to use `{{variable.result}}` temporarily