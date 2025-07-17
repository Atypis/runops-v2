# Context Node Documentation

## Overview

The `context` node is a State Layer node type that provides a simple mechanism for storing variables in workflow state. It serves as the primary way to store credentials, user input, and configuration that needs to persist throughout workflow execution.

## Evolution and Current State

### Historical Context
- Originally named "memory" node in earlier versions
- Initially supported 5 operations: `set`, `get`, `clear`, `merge`, `update`
- Has been radically simplified to only support storing variables
- Internally still uses `executeMemory` function for backward compatibility

### Current Implementation
- **Node Type**: `context`
- **Layer**: State Layer
- **Purpose**: Store variables in workflow state
- **Storage**: Persisted in Supabase `workflow_memory` table
- **Philosophy**: Keep it simple - just store variables when needed

## Configuration

### Basic Structure
```javascript
{
  type: "context",
  alias: "store_user_data",
  config: {
    variables: {
      // Object containing variables to store
    }
  },
  description: "Store user credentials and configuration"
}
```

### How It Works

The context node stores one or more variables in workflow state. Variables are overwritten if they already exist (upsert behavior).

```javascript
{
  type: "context",
  alias: "store_credentials",
  config: {
    variables: {
      user_email: "{{env:GMAIL_EMAIL}}",
      user_config: {
        theme: "dark",
        notifications: true,
        language: "en"
      },
      api_key: "{{extract_key.result}}"
    }
  }
}
```

## Variable Storage and Access

### Storage Mechanism
- Variables are stored in the `workflow_memory` table with JSONB format
- Each variable is stored with a unique key per workflow
- Supports complex nested data structures
- Automatic upsert behavior (creates or updates)

### Accessing Stored Variables
Variables set via context nodes are stored flat in the workflow state, NOT nested under the node's alias:

```javascript
// Context node
{
  type: "context",
  alias: "store_user_data",
  config: {
    variables: {
      user_email: "test@example.com",
      user_name: "Alice"
    }
  }
}

// ✅ CORRECT - Reference variables directly
"{{user_email}}"
"{{user_name}}"

// ❌ WRONG - Don't use the alias
"{{store_user_data.user_email}}"  // This won't work!

// Use in other nodes
{
  type: "browser_ai_action",
  alias: "login_with_email",
  config: {
    action: "type",
    instruction: "Enter email in the login field",
    text: "{{user_email}}"  // Direct reference
  }
}
```

**Important**: This is different from nodes with `store_variable: true`, which ARE referenced using their alias (e.g., `{{extract_data.result}}`).

## Integration with Other Systems

### Variable Resolution Priority
1. Iteration variables (e.g., `{{current_item}}`)
2. Workflow variables (set via context nodes)
3. Node results (e.g., `{{extract_data.result}}`)
4. Environment variables (e.g., `{{env:API_KEY}}`)

### Automatic Variable Population
Many nodes automatically populate workflow variables without explicit context nodes:
- `browser_query` with `method: "extract"`
- `iterate` nodes create iteration variables
- Nodes with `store_variable: true`

## Usage Patterns

### Pattern 1: Initial Setup
```javascript
// Store configuration at workflow start
{
  type: "context",
  alias: "initialize_workflow",
  config: {
    variables: {
      credentials: {
        email: "{{env:EMAIL}}",
        password: "{{env:PASSWORD}}"
      },
      config: {
        max_retries: 3,
        timeout: 30000
      }
    }
  }
}
```

### Pattern 2: Store User Input
```javascript
// Save form data or user selections
{
  type: "context",
  alias: "save_user_selections",
  config: {
    variables: {
      selected_items: "{{extract_selections.result}}",
      user_preferences: "{{form_data.preferences}}",
      timestamp: "{{current_time.value}}"
    }
  }
}
```

### Pattern 3: Store External Data
```javascript
// Store API keys or external configuration
{
  type: "context",
  alias: "store_api_config",
  config: {
    variables: {
      api_endpoint: "{{env:API_URL}}",
      api_key: "{{env:API_KEY}}",
      rate_limit: 100
    }
  }
}
```

### Pattern 4: Complex State Updates
```javascript
// Store processed results
{
  type: "context",
  alias: "store_analysis",
  config: {
    variables: {
      analysis_results: "{{cognition_analyze.result}}",
      extraction_data: "{{browser_ai_query.products}}",
      processing_status: "completed"
    }
  }
}
```

## Best Practices

### When to Use Context Nodes
1. **Storing Credentials**: Save environment variables and API keys for workflow use
2. **User Input Storage**: Capture form data or user selections that need persistence
3. **Configuration Management**: Store workflow settings and parameters
4. **Batch Variable Storage**: When you need to set multiple related variables at once

### When NOT to Use Context Nodes
1. **Single Node Results**: Use `store_variable: true` on the node instead
2. **Temporary Values**: If only needed for next node, use direct references
3. **Simple Transformations**: Use cognition nodes for data transformation
4. **Already Stored Data**: Don't re-store variables that are already accessible

### Performance Considerations
- Each context node involves a database write
- Batch related variables in a single context node when possible
- Variables are automatically overwritten (upsert behavior)
- No need to clear variables - just overwrite when needed

## Differences from Other State Management

### Context Node vs store_variable
| Feature | Context Node | store_variable |
|---------|--------------|----------------|
| Purpose | Store multiple variables | Automatic result storage |
| Control | Full control over variable names | Stores as node alias |
| Bulk Operations | Can set multiple variables | Single result only |
| Reference Syntax | `{{variable_name}}` (flat) | `{{alias.property}}` (nested) |
| Use Case | Credentials, config, user input | Simple result capture |

### Key Difference in Variable Access
- **Context variables**: Stored flat, accessed directly: `{{email}}`
- **Node results** (store_variable: true): Stored under alias, accessed with dot notation: `{{extract_user.email}}`

### Context Node vs Direct References
- **Context nodes**: Persist data for entire workflow
- **Direct references**: Only available while nodes exist
- **Context variables**: Survive node deletions/updates

## Technical Implementation Details

### Internal Execution Flow
1. Validates configuration (variables must be provided)
2. Resolves environment variables in values
3. Resolves template variables (e.g., `{{node.result}}`)
4. Attempts JSON parsing of string values
5. Performs database upsert operation
6. Returns confirmation with stored variables

### Database Schema
Variables are stored in `workflow_memory` table:
- `workflow_id`: UUID reference
- `key`: Variable name
- `value`: JSONB data
- `created_at`, `updated_at`: Timestamps

## Common Issues and Solutions

### Issue 1: Variables Not Resolving
**Problem**: `{{variable}}` showing as literal string
**Solution**: Ensure variable was set before use and name matches exactly

### Issue 2: Nested Data Access
**Problem**: Cannot access nested properties
**Solution**: Ensure data is stored as object, not stringified JSON

### Issue 3: Variable Persistence
**Problem**: Variables disappearing between executions
**Solution**: Context variables persist only within workflow execution context

## Migration Notes

### From Old Context/Memory Nodes
Old format with operation:
```javascript
{
  type: "context",
  config: {
    operation: "set",
    variables: {
      user_email: "test@example.com"
    }
  }
}
```

New simplified format:
```javascript
{
  type: "context",
  config: {
    variables: {
      user_email: "test@example.com"
    }
  }
}
```

### Deprecated Operations
The following operations have been removed:
- `set`: No longer needed - context nodes now only store variables
- `clear`: Variables can be overwritten when needed
- `clear_all`: Not necessary - workflows start fresh
- `get`: Use template variables instead
- `update`: Just store the new value
- `merge`: Read current value, merge in code, then store

## Future Considerations

### Potential Enhancements
1. Transaction support for atomic multi-variable operations
2. Variable namespacing for complex workflows
3. TTL (time-to-live) for temporary variables
4. Built-in merge operations for complex objects

### Current Limitations
1. No built-in merge functionality (must read, modify, store)
2. No variable type validation
3. No conditional storage (always overwrites)
4. No TTL or expiration for variables