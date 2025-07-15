# Variables 2.0: Intentional Storage System

## Executive Summary

Transform the workflow variable system from automatic noise generation to intentional data storage. Variables are now created only when explicitly requested by the Director, using the node's alias as the sole storage key.

## Problem Statement

Current system stores EVERY node execution result as a variable:
- Simple navigation creates `node1`, `node2`, etc.
- Accumulates 50+ variables in typical workflows
- Most are never used again
- Creates noise in variable listings
- Wastes storage space

## Solution: Selective Variable Storage

### Core Principle
Variables are **intentional workflow data**, not execution artifacts.

### Key Changes

1. **Opt-in Storage**: Add `store_variable: true` to node config
2. **Alias-only Keys**: Store only by Director-provided alias
3. **No Position References**: Remove `node123` style completely
4. **Clean Variable List**: Only shows intentionally stored data

## Implementation Details

### 1. Database Schema Change

```sql
ALTER TABLE nodes 
ADD COLUMN store_variable BOOLEAN DEFAULT false;
```

### 2. Node Creation API

```javascript
// Director explicitly marks nodes that should store variables
create_node({ 
  type: "browser_query",
  alias: "search_results",
  config: {
    store_variable: true,  // ← New flag
    method: "querySelector",
    instruction: "Find all email elements"
  }
})
```

### 3. Storage Behavior

**Variable IS stored when:**
- Node has `store_variable: true` in config
- Node execution produces a result
- Result is stored with key = alias

**Variable is NOT stored when:**
- `store_variable` is false or missing (default)
- Result only available in `nodes.result` column
- No entry in `workflow_memory` table

### 4. Variable References

```javascript
// Valid (if search_results had store_variable: true)
"Click on {{search_results.emails[0].selector}}"

// Error (if navigate_home didn't have store_variable: true)
"URL is {{navigate_home.url}}"  
// Error: Variable 'navigate_home' not found. Did you forget to set store_variable: true?

// Invalid (position-based references removed)
"Data from {{node27}}"
// Error: Position-based references (node27) are no longer supported. Use the node alias instead.
```

## Usage Examples

### Example 1: Email Processing Workflow

```javascript
// Step 1: Navigate (no variable needed)
create_node({
  alias: "open_gmail",
  type: "browser_action",
  config: {
    action: "navigate",
    url: "https://gmail.com"
  }
})

// Step 2: Search emails (need results for later)
create_node({
  alias: "unread_emails", 
  type: "browser_query",
  config: {
    store_variable: true,  // ← Store for iteration
    method: "querySelectorAll",
    instruction: "Find all unread email elements"
  }
})

// Step 3: Iterate over results
create_node({
  alias: "process_emails",
  type: "iterate", 
  config: {
    over: "{{unread_emails}}",  // ← Reference stored variable
    variable: "email",
    body: "nodes:10-15"
  }
})
```

### Example 2: Conditional Flow

```javascript
// Check login state (need result for routing)
create_node({
  alias: "check_auth",
  type: "browser_query",
  config: {
    store_variable: true,  // ← Need for route decision
    method: "evaluate",
    instruction: "Check if user is logged in"
  }
})

// Route based on result
create_node({
  alias: "auth_route",
  type: "route",
  config: {
    condition: "{{check_auth.isLoggedIn}}",
    paths: {
      true: "nodes:20-25",
      false: "nodes:30-35"
    }
  }
})
```

## Migration Guide

### For New Workflows
- Add `store_variable: true` only to nodes whose results you need later
- Use meaningful aliases as your variable names
- Reference variables by alias: `{{search_results}}` not `{{node5}}`

### For Existing Workflows
- Existing variables in `workflow_memory` continue working
- Update gradually as you modify workflows
- Position-based references will error - update to use aliases

## Benefits

1. **Clarity**: Variable list shows only intentional data
2. **Performance**: Fewer database writes and less storage
3. **Predictability**: Director controls exactly what gets stored
4. **Simplicity**: One storage key (alias) per variable
5. **Debugging**: Easy to see which nodes produce reusable data

## Technical Implementation

### Modified Files
1. `nodes` table - Add `store_variable` column
2. `directorService.js` - Extract flag from config
3. `nodeExecutor.js` - Conditional storage logic
4. `toolDefinitions.js` - Document new option
5. Template resolution - Remove position-based lookups

### Storage Logic (nodeExecutor.js)
```javascript
if (result !== null && result !== undefined && node.store_variable) {
  const storageKey = this.getStorageKey(node.alias);
  await supabase
    .from('workflow_memory')
    .upsert({
      workflow_id: workflowId,
      key: storageKey,
      value: result
    });
}
```

## Best Practices

1. **Be Intentional**: Only store what you'll actually use
2. **Name Clearly**: Aliases should describe the data (e.g., `user_profile`, `search_results`)
3. **Document Usage**: In node description, note if/why result is stored
4. **Clean Up**: Remove `store_variable` from nodes that don't need it

## FAQ

**Q: What happens to results when store_variable is false?**
A: Results are still saved in the `nodes.result` column but NOT in `workflow_memory`. They're available for debugging but not for variable references.

**Q: Can I change store_variable after node creation?**
A: Yes, use `update_node` to modify the flag. Next execution will follow new setting.

**Q: Do iteration variables still work the same?**
A: Yes, iteration context variables (`email`, `emailIndex`) are still automatically created during iteration, but scoped to the iteration.

**Q: Why remove position-based references?**
A: Positions are fragile (change when nodes are reordered). Aliases are stable and semantic.