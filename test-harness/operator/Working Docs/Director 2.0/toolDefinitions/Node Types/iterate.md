# Iterate Node - Complete Documentation

## Overview

The iterate node is a control flow node that enables looping over arrays in workflows. It processes each item in a collection sequentially, executing a set of body nodes for each iteration. This is essential for automating repetitive tasks like processing multiple emails, handling lists of data, or performing batch operations.

### Key Features
- Sequential execution (not parallel) to maintain order and prevent race conditions
- Automatic variable scoping with iteration context
- Support for nested iterations
- Built-in error handling with `continueOnError` option
- Real-time preview of iteration data in the UI

## Implementation Architecture

### Core Files

1. **Backend Execution**
   - `/test-harness/operator/backend/services/nodeExecutor.js` - `executeIterate()` method handles the main iteration logic
   - `/test-harness/operator/backend/services/variableManagementService.js` - Manages iteration variable storage and cleanup

2. **Frontend Components**
   - `/test-harness/operator/frontend/app.js` - `NodeCard` component renders iterate nodes with expandable preview
   - `SimpleIterationList` component displays individual iterations

3. **API Endpoints**
   - `/nodes/:nodeId/iteration-preview` - Provides preview data for UI without executing

### Node Configuration

```javascript
{
  type: 'iterate',
  alias: 'process_items',
  config: {
    over: '{{extracted_data.items}}',  // Array to iterate over
    variable: 'current_item',          // Variable name for current item
    body: [25, 26, 27],               // Node positions to execute per iteration
    continueOnError: true,            // Continue if one iteration fails
    limit: 10                         // Optional: limit iterations for testing
  }
}
```

## Variable Management and Data Flow

### Iteration Variables

The iterate node creates three automatic variables for each iteration:
- `{{current_item}}` - The current array element
- `{{current_itemIndex}}` - Zero-based index (0, 1, 2...)
- `{{current_itemTotal}}` - Total number of items in array

### Storage Keys with Context

Variables are stored with iteration context to prevent conflicts:
```
current_item@iter:4:0    // First iteration of node at position 4
current_item@iter:4:1    // Second iteration
current_item@iter:4:2    // Third iteration
```

### The Stale Variable Problem (Fixed)

**Problem**: Iteration variables from previous workflow runs persisted in the database, causing iterate nodes to use old data even when the source array was updated.

**Example**:
1. First run: `animals = ["dog", "cat", "bird"]`
2. Variables stored: `animal@iter:4:0 = "dog"`, etc.
3. Second run: `animals = ["lion", "tiger", "bear"]`
4. Iterate node would still find old "dog" value in database

**Solution**: Implemented pre-iteration cleanup that removes all iteration variables for a specific iterate node before starting new execution:

```javascript
// In variableManagementService.js
async cleanupIterationVariables(workflowId, iterateNodePosition) {
  const cleanupPattern = `%@iter:${iterateNodePosition}:%`;
  await supabase
    .from('workflow_memory')
    .delete()
    .eq('workflow_id', workflowId)
    .like('key', cleanupPattern);
}
```

## Smart Variable Update System

### Automatic Cleanup on Source Changes

When a variable that an iterate node depends on changes (e.g., `define_animals`), the system:
1. Detects which iterate nodes reference this variable
2. Automatically cleans up their stale iteration variables
3. Ensures previews show fresh data without requiring execution

### SSE Integration

Variable updates trigger Server-Sent Events (SSE) to notify the frontend:
1. Backend stores new variable value
2. SSE emits `variableUpdate` event
3. Frontend iterate nodes listening for their source variable refresh their preview
4. Users see updated data in real-time

## Frontend Preview System

### Preview Behavior

1. **On Expand**: Fetches fresh preview data from backend
2. **On Variable Update**: Automatically refreshes if source data changes
3. **On Collapse**: Clears preview data and resets fetch flag

### Key Frontend Fix

The frontend was incorrectly using cached `node.result` data instead of fetching fresh previews. Fixed by:
- Removing initialization from `node.result.items`
- Always fetching fresh data via preview API
- Adding proper state reset on collapse/expand

## Best Practices

### 1. Use Meaningful Variable Names
```javascript
// Good
{ variable: 'email', over: '{{emails}}' }

// Less clear
{ variable: 'item', over: '{{data}}' }
```

### 2. Handle Errors Gracefully
```javascript
{
  continueOnError: true,  // Don't stop workflow if one item fails
  body: [
    // Include error handling nodes
  ]
}
```

### 3. Test with Limits
```javascript
{
  limit: 5,  // Test with first 5 items before full run
  over: '{{large_dataset}}'
}
```

### 4. Store Results
Enable `store_variable: true` on the iterate node to access results:
```javascript
// After execution, access:
{{iterate_emails.results}}    // Array of all iteration results
{{iterate_emails.errors}}     // Any errors that occurred
{{iterate_emails.processed}}  // Number processed
```

## Common Patterns

### Email Processing
```javascript
{
  type: 'iterate',
  alias: 'process_emails',
  config: {
    over: '{{gmail_query.emails}}',
    variable: 'email',
    body: [
      // Nodes to: read email, classify, take action
    ]
  }
}
```

### Data Transformation
```javascript
{
  type: 'iterate',
  alias: 'transform_records',
  config: {
    over: '{{raw_data.records}}',
    variable: 'record',
    body: [
      // Nodes to: validate, transform, store
    ]
  }
}
```

## Troubleshooting

### Preview Shows Old Data
- Check if source variable has `store_variable: true`
- Verify SSE connection is active (check browser console)
- Try collapsing and re-expanding the iterate node

### Execution Uses Stale Values
- Ensure you're using the latest version with iteration cleanup
- Check for old iteration variables in workflow_memory table
- Verify template syntax: `{{variable.property}}` not `{{variable}}.property`

### Variables Not Found
- Iteration variables only exist during execution
- Use the correct context: `{{email}}` not `{{current_email}}` inside iteration
- Check iteration context in variable names when debugging

## Technical Notes

- Iterations run sequentially to maintain order and prevent conflicts
- Each iteration has its own variable scope via context suffixes
- Preview mode uses the same execution logic but doesn't store results
- Nested iterations are supported with proper context stacking
- The system uses Supabase for variable persistence with real-time updates via SSE