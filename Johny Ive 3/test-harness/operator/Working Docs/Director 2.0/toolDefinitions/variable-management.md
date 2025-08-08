# Variable Management Functions - Director 2.0

## Overview

The Variable Management function group provides Director with complete control over workflow state, enabling debugging, testing, and state inspection. These functions are essential for understanding workflow execution, troubleshooting issues, and managing data flow.

## Architecture Deep Dive

### Storage Layer
- **Database**: Supabase `workflow_memory` table stores all variables
- **Key Format**: Variables use different prefixes for categorization:
  - Node results: `node{id}.{property}` or alias-based storage
  - Custom variables: Direct key names (e.g., `email`, `username`)
  - Iteration variables: `{variable}@iter:{nodePosition}:{index}`
  - Environment references: Resolved at runtime, not stored

### Variable Types & Lifecycle

1. **Node Result Variables**
   - Automatically created when nodes with `store_variable: true` execute
   - Stored with node alias as key (e.g., `extract_emails`)
   - Persist across workflow executions
   - Can contain any JSON-serializable data

2. **Context Variables**
   - Created by `context` nodes
   - Stored flat in workflow state (not nested under alias)
   - Used for credentials, configuration, user input
   - Persist until explicitly cleared

3. **Iteration Variables**
   - Temporarily created during loop execution
   - Format: `{variable}@iter:{position}:{index}`
   - Automatically cleaned up when iteration completes
   - Not visible in standard variable listings

4. **Environment Variables**
   - Never stored in database
   - Resolved at runtime using `{{env:VAR_NAME}}` syntax
   - Secure handling for sensitive data

## Function Specifications

### 1. get_workflow_variables

**Purpose**: Retrieve workflow variables with flexible querying options

**Implementation Details**:
```javascript
// Service layer handles three query modes:
1. All variables: variableName = "all"
2. Node-specific: nodeId parameter provided  
3. Single variable: specific variableName
```

**Parameters**:
```javascript
{
  variableName: string,  // Variable name or "all" for complete dump
  nodeId?: number       // Alternative: get all variables from specific node
}
```

**Returns**:
```javascript
// For "all" variables:
{
  success: true,
  allVariables: {
    "variable1": value1,
    "variable2": value2,
    // ... all workflow variables
  }
}

// For specific variable:
{
  success: true,
  variableName: "extract_emails",
  value: {/* variable content */}
}

// For node-specific:
{
  success: true,
  nodeId: 7,
  variables: {
    "node7": {/* main result */},
    "node7.emails": [/* array */],
    "node7.count": 5
  }
}
```

**Internal Flow**:
1. Validates workflow ID exists
2. Queries Supabase based on request type
3. Returns full content (bypasses chunking)
4. Handles missing variables gracefully (returns null)

### 2. set_variable

**Purpose**: Manually set or update variables for testing and debugging

**Implementation Details**:
- Uses UPSERT to create or update
- Optional JSON schema validation
- Triggers iteration variable cleanup if needed
- Audit trail via reason parameter

**Parameters**:
```javascript
{
  variableName: string,    // Variable name (required)
  value: any,             // Any JSON-serializable value (required)
  reason: string,         // Why setting this variable (required)
  schema?: object         // Optional JSON schema for validation
}
```

**Schema Validation Example**:
```javascript
set_variable({
  variableName: "user_data",
  value: {name: "John", age: 30},
  reason: "Testing user data processing",
  schema: {
    type: "object",
    properties: {
      name: {type: "string"},
      age: {type: "number", minimum: 0}
    },
    required: ["name", "age"]
  }
})
```

**Special Behaviors**:
- If variable is referenced by iterate nodes, stale iteration variables are cleaned
- Validation failure prevents variable update
- Supabase conflict resolution on duplicate keys

### 3. clear_variable

**Purpose**: Delete specific variables for testing workflow behavior

**Implementation Details**:
```javascript
// Direct deletion from workflow_memory table
await supabase
  .from('workflow_memory')
  .delete()
  .eq('workflow_id', workflowId)
  .eq('key', variableName);
```

**Parameters**:
```javascript
{
  variableName: string,  // Variable to delete (required)
  reason: string        // Why clearing (required)
}
```

**Returns**:
```javascript
{
  success: true,
  message: "Variable 'extract_emails' cleared successfully",
  variable: "extract_emails",
  reason: "Testing fresh extraction"
}
```

### 4. clear_all_variables

**Purpose**: Complete workflow state reset for clean testing

**Implementation Details**:
- Deletes ALL variables for the workflow
- Returns count and list of deleted variables
- Useful for testing from scratch

**Parameters**:
```javascript
{
  reason: string  // Why clearing all (required)
}
```

**Returns**:
```javascript
{
  success: true,
  message: "All variables cleared successfully (15 variables)",
  deletedCount: 15,
  deletedVariables: ["email", "username", "node7.result", ...],
  reason: "Starting fresh test run"
}
```

## Variable Management Service Architecture

### Key Methods:

1. **findIterateNodesReferencingVariable**
   - Identifies iterate nodes using a variable
   - Handles multiple reference formats
   - Used for cleanup operations

2. **cleanupIterationVariables**
   - Removes stale iteration variables
   - Prevents memory bloat
   - Automatic on variable updates

3. **validateAgainstSchema**
   - JSON Schema validation
   - Type checking and constraints
   - Prevents invalid data storage

4. **Security Considerations**:
   - Sensitive key detection (password, token, etc.)
   - Truncation for display (100 char default)
   - Audit logging for all operations

## Best Practices & Patterns

### 1. Debugging Workflows
```javascript
// Check current state
get_workflow_variables({variableName: "all"})

// Test with different data
set_variable({
  variableName: "test_emails",
  value: ["test1@example.com", "test2@example.com"],
  reason: "Testing email processing with minimal data"
})

// Clean up after testing
clear_variable({
  variableName: "test_emails",
  reason: "Removing test data"
})
```

### 2. State Inspection During Development
```javascript
// Get all variables from a specific node
get_workflow_variables({nodeId: 15})

// Check if login succeeded
get_workflow_variables({variableName: "login_check"})
```

### 3. Reset Patterns
```javascript
// Full reset for clean testing
clear_all_variables({reason: "Starting fresh test of login flow"})

// Selective reset
clear_variable({variableName: "session_token", reason: "Testing expired session"})
clear_variable({variableName: "user_data", reason: "Testing anonymous flow"})
```

## Common Use Cases

### 1. Variable Not Found Debugging
When a node can't find a variable:
```javascript
// Check what variables exist
get_workflow_variables({variableName: "all"})

// Check specific node output
get_workflow_variables({nodeId: 7})
```

### 2. Testing Edge Cases
```javascript
// Test with empty array
set_variable({
  variableName: "emails",
  value: [],
  reason: "Testing empty inbox scenario"
})

// Test with null
set_variable({
  variableName: "user_profile",
  value: null,
  reason: "Testing logged out state"
})
```

### 3. Iteration Debugging
```javascript
// Set test data for iteration
set_variable({
  variableName: "test_items",
  value: [{id: 1, name: "Test 1"}, {id: 2, name: "Test 2"}],
  reason: "Testing iteration with minimal items"
})
```

## Integration with Director Workflow

1. **Planning Phase**: Use to understand current state
2. **Building Phase**: Test nodes with different variable values
3. **Testing Phase**: Reset state between test runs
4. **Debugging Phase**: Inspect actual vs expected values

## Error Handling

Common errors and solutions:

1. **Variable Not Found**
   - Variable doesn't exist yet
   - Use get_workflow_variables to check available variables

2. **Schema Validation Failed**
   - Value doesn't match provided schema
   - Check schema definition and value structure

3. **Workflow ID Required**
   - Internal error - workflow context missing
   - Report to user, likely system issue

## Performance Considerations

1. **Variable Size**: No hard limits, but large objects impact performance
2. **Chunking**: Display limited to 100 chars, full content via tools
3. **Cleanup**: Iteration variables automatically cleaned
4. **Query Efficiency**: Node-specific queries faster than "all"

## Security Notes

1. **Sensitive Data**: Never store unencrypted passwords/tokens
2. **Environment Variables**: Use {{env:}} for secrets
3. **Audit Trail**: All operations logged with reasons
4. **Access Control**: Variables scoped to workflow

This documentation provides the complete picture of variable management in Director 2.0, enabling robust debugging and testing capabilities while maintaining security and performance.