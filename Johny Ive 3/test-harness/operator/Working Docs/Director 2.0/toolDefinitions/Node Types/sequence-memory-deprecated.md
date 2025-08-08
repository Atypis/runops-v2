# Deprecated Node Types: `sequence` and `memory`

## Executive Summary

This document details the findings from a deep exploration of two deprecated node types in the RunOps operator system:
- **`sequence`** - Completely deprecated with no implementation
- **`memory`** - Deprecated and replaced by `context`, but still functional for backward compatibility

## 1. `sequence` Node Type

### Status: FULLY DEPRECATED - NO IMPLEMENTATION

### Key Findings:

1. **No Execution Logic**
   - No case handler in `nodeExecutor.js`
   - No `executeSequence` function exists
   - Attempting to execute a sequence node would result in an error

2. **Not Available in Tool Definitions**
   - Not included in node type enums in `toolDefinitions.js` or `toolDefinitionsV2.js`
   - Cannot be created via `create_node` tool
   - Cannot be inserted or updated

3. **Documentation References**
   - Listed in `/Working Docs/Director 2.0/toolDefinitions/1-create_node.md` as "In enum but not in documentation"
   - No examples or patterns found in any prompt files

4. **Legacy Term Usage**
   - "sequence" appears only in context of:
     - `create_workflow_sequence` tool (creates multiple connected nodes)
     - Sequential execution descriptions (e.g., "execute in sequence")
     - Workflow step descriptions

### Functionality Replaced By:

1. **Route nodes with array branches**
   ```javascript
   {
     type: "route",
     config: [{
       name: "process_items",
       condition: "true",
       branch: [15, 16, 17]  // Executes nodes 15, 16, 17 in sequence
     }]
   }
   ```

2. **Group nodes**
   ```javascript
   {
     type: "group",
     config: {
       nodeRange: "10-20"  // Executes nodes 10-20 as a unit
     }
   }
   ```

3. **Iterate nodes with body**
   ```javascript
   {
     type: "iterate",
     config: {
       over: "{{items}}",
       variable: "item",
       body: [25, 26, 27]  // Executes these nodes for each item
     }
   }
   ```

## 2. `memory` Node Type

### Status: DEPRECATED - REPLACED BY `context`

### Key Findings:

1. **Execution Logic Still Exists**
   ```javascript
   // nodeExecutor.js lines 522-524
   case 'memory':
     result = await this.executeMemory(resolvedParams, workflowId);
     break;
   ```

2. **Shared Implementation with `context`**
   ```javascript
   // nodeExecutor.js lines 1275-1278
   async executeContext(config, workflowId) {
     // Context is the new name for memory, same functionality
     return this.executeMemory(config, workflowId);
   }
   ```

3. **Implementation Details**
   - **Supported Operations**: Only `set` and `get`
   - **Storage**: Uses `workflow_memory` table in Supabase
   - **Features**:
     - Template variable resolution (`{{variable}}`)
     - Environment variable support (`{{env:VAR_NAME}}`)
     - JSON value parsing for string inputs
     - Error handling for missing database tables

4. **Database Schema**
   ```sql
   CREATE TABLE workflow_memory (
     id SERIAL PRIMARY KEY,
     workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
     key TEXT NOT NULL,
     value JSONB,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     UNIQUE(workflow_id, key)
   );
   ```

5. **Not Available in Tool Definitions**
   - Missing from node type enums
   - Cannot be created via `create_node`
   - Existing memory nodes would still execute

### Documentation vs Implementation Gap:

| Operation | Documented | Implemented |
|-----------|------------|-------------|
| set       | ✅         | ✅          |
| get       | ✅         | ✅          |
| update    | ✅         | ❌          |
| clear     | ✅         | ❌          |
| merge     | ✅         | ❌          |

### Migration Path: `memory` → `context`

The `context` node type is the modern replacement:

**Old (deprecated):**
```javascript
{
  type: "memory",
  config: {
    operation: "set",
    variables: {
      user_email: "{{extracted_email}}"
    }
  }
}
```

**New (current):**
```javascript
{
  type: "context",
  config: {
    variables: {
      user_email: "{{extracted_email}}"
    }
  }
}
```

Note: The new `context` node simplified the API by removing the `operation` field and only supporting variable setting.

## Important Notes

1. **Variable Storage System**
   - The `workflow_memory` table is still actively used
   - All nodes with `store_variable: true` use this table
   - This is separate from the deprecated `memory` node type

2. **Backward Compatibility**
   - Existing workflows with `memory` nodes will continue to function
   - Both `memory` and `context` use the same underlying execution logic
   - No immediate action required for existing workflows

## Recommendations

1. **For `sequence` nodes:**
   - Remove all references from documentation
   - Update any migration guides to show modern alternatives
   - Consider adding validation to reject sequence nodes

2. **For `memory` nodes:**
   - Document `context` as the official state management node
   - Consider implementing missing operations (update, clear, merge) if needed
   - Add deprecation warnings when memory nodes are executed
   - Update migration documentation

3. **General cleanup:**
   - Remove both types from any remaining enum lists
   - Update all examples to use modern node types
   - Consider a migration tool for old workflows

## References

- `nodeExecutor.js`: Contains execution logic
- `toolDefinitionsV2.js`: Current node type definitions
- `directorPromptV3.js`: Current system prompt with node examples
- `workflow_memory` table: Database schema for variable storage