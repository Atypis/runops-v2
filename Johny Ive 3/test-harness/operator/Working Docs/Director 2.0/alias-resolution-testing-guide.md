# Alias Resolution Testing Guide for Directors

## Overview
This guide helps Directors test the new alias-based node reference system. Follow these tests to verify the system works correctly.

## Test 1: Basic Iterate with Alias References

### Setup
Create this workflow to test basic alias resolution:

```javascript
// Step 1: Create a mock data source
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "context",
    alias: "mock_emails",
    config: {
      variables: {
        emails: [
          { id: 1, subject: "Q4 Report", sender: "cfo@company.com" },
          { id: 2, subject: "Team Update", sender: "manager@company.com" },
          { id: 3, subject: "Invoice #123", sender: "vendor@supplier.com" }
        ]
      }
    }
  }]
})

// Step 2: Create the iterate structure
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "iterate",
    alias: "process_each_email",
    config: {
      over: "{{mock_emails.emails}}",
      variable: "email",
      body: ["log_email", "classify_email", "save_classification"]
    }
  }]
})

// Step 3: Create the body nodes
add_or_replace_nodes({
  target: "end",
  nodes: [
    {
      type: "context",
      alias: "log_email",
      config: {
        variables: {
          processing: "{{email.subject}}"
        }
      }
    },
    {
      type: "cognition",
      alias: "classify_email",
      config: {
        instruction: "Classify this email as either 'business', 'personal', or 'spam' based on subject: {{email.subject}}",
        schema: { type: "string", enum: ["business", "personal", "spam"] }
      }
    },
    {
      type: "context",
      alias: "save_classification",
      config: {
        variables: {
          "email_{{email.id}}_type": "{{classify_email}}"
        }
      }
    }
  ]
})
```

### Verification Steps
1. **Check the stored configuration**:
   ```
   get_workflow_nodes({ format: "detailed" })
   ```
   - Find the `process_each_email` iterate node
   - Verify it has both `body` (with aliases) AND `body_positions` (with numbers)

2. **Execute the workflow**:
   ```
   execute_nodes({ nodeSelection: "all" })
   ```
   - Should process all 3 emails successfully
   - Check variables to see classifications saved

## Test 2: Alias Range in Iterate

### Setup
```javascript
// Create a workflow with sequential processing nodes
add_or_replace_nodes({
  target: "end",
  nodes: [
    {
      type: "context",
      alias: "prepare_data",
      config: { variables: { items: ["A", "B", "C"] } }
    },
    {
      type: "iterate",
      alias: "process_items",
      config: {
        over: "{{prepare_data.items}}",
        variable: "item",
        body: "validate_item..store_result"  // Range format
      }
    },
    {
      type: "context",
      alias: "validate_item",
      config: { variables: { validating: "{{item}}" } }
    },
    {
      type: "context",
      alias: "transform_item",
      config: { variables: { transformed: "{{item}}_transformed" } }
    },
    {
      type: "context",
      alias: "store_result",
      config: { variables: { "result_{{item}}": "{{transform_item.transformed}}" } }
    }
  ]
})
```

### Verification
1. Check the iterate node has `body_positions` that includes all positions between validate_item and store_result
2. Execute and verify all three nodes run for each item

## Test 3: Route with Alias Branches

### Setup
```javascript
add_or_replace_nodes({
  target: "end",
  nodes: [
    {
      type: "context",
      alias: "set_priority",
      config: { variables: { priority: "high", value: 100 } }
    },
    {
      type: "route",
      alias: "route_by_priority",
      config: [
        {
          name: "high_priority",
          condition: "{{set_priority.priority}} === 'high'",
          branch: ["alert_team", "create_ticket"]
        },
        {
          name: "low_priority",
          condition: "{{set_priority.priority}} === 'low'",
          branch: "just_log"
        },
        {
          name: "default",
          condition: "true",
          branch: "handle_default"
        }
      ]
    },
    {
      type: "context",
      alias: "alert_team",
      config: { variables: { alerted: true } }
    },
    {
      type: "context",
      alias: "create_ticket",
      config: { variables: { ticket_created: true } }
    },
    {
      type: "context",
      alias: "just_log",
      config: { variables: { logged: true } }
    },
    {
      type: "context",
      alias: "handle_default",
      config: { variables: { default_handled: true } }
    }
  ]
})
```

### Verification
1. Check each branch has `branch_positions` resolved
2. Execute and verify high_priority branch runs (alert_team and create_ticket)
3. Change priority to "low" and verify different branch executes

## Test 4: Re-resolution After Insert

### Setup
1. Create the initial workflow from Test 1
2. Insert a new node in the middle:

```javascript
add_or_replace_nodes({
  target: { after: "log_email" },
  nodes: [{
    type: "context",
    alias: "validate_email",
    config: { variables: { validated: true } }
  }]
})
```

### Verification
1. Check the iterate node's `body_positions` - should NOT include the new node (since it wasn't in original body)
2. Execute workflow - should still work correctly
3. Update the iterate to include the new node:

```javascript
add_or_replace_nodes({
  target: "process_each_email",
  mode: "update",
  nodes: [{
    config: {
      body: ["log_email", "validate_email", "classify_email", "save_classification"]
    }
  }]
})
```

4. Now check `body_positions` - should include all 4 positions

## Test 5: Alias-based Targeting

### Setup & Test Each Targeting Mode

```javascript
// Test 1: Insert AFTER
add_or_replace_nodes({
  target: { after: "classify_email" },
  nodes: [{
    type: "context",
    alias: "mark_processed",
    config: { variables: { processed: true } }
  }]
})

// Test 2: Insert BEFORE  
add_or_replace_nodes({
  target: { before: "save_classification" },
  nodes: [{
    type: "context",
    alias: "prepare_save",
    config: { variables: { preparing: true } }
  }]
})

// Test 3: Replace nodes
add_or_replace_nodes({
  target: { replace: ["mark_processed", "prepare_save"] },
  nodes: [{
    type: "context",
    alias: "combined_step",
    config: { variables: { combined: true } }
  }]
})
```

## Test 6: Execute with Aliases

### Test Various Selection Formats

```javascript
// Single alias
execute_nodes({ nodeSelection: "mock_emails" })

// Alias range
execute_nodes({ nodeSelection: "validate_item..store_result" })

// Mixed selection
execute_nodes({ nodeSelection: "mock_emails,process_each_email,alert_team" })

// Combined with positions
execute_nodes({ nodeSelection: "1,mock_emails,5-7,classify_email" })
```

## Test 7: Error Scenarios

### Test These Should Fail

```javascript
// 1. Duplicate alias
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "context",
    alias: "mock_emails",  // Already exists!
    config: { variables: {} }
  }]
})
// Expected: Error about duplicate alias

// 2. Non-existent alias reference
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "iterate",
    alias: "bad_iterate",
    config: {
      over: "{{items}}",
      variable: "item",
      body: ["non_existent_node"]  // Doesn't exist!
    }
  }]
})
// Expected: Error resolving alias

// 3. Invalid range
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "iterate",
    alias: "bad_range",
    config: {
      over: "{{items}}",
      variable: "item",
      body: "end_node..start_node"  // Wrong order!
    }
  }]
})
// Expected: Error about invalid range
```

## Test 8: Backward Compatibility

### Verify Old Format Still Works

```javascript
// Create iterate with position-based body
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "iterate",
    alias: "old_style_iterate",
    config: {
      over: "{{items}}",
      variable: "item",
      body: [8, 9, 10]  // Direct positions
    }
  }]
})

// Should work without any alias resolution
// Check that body_positions equals body
```

## Success Criteria

✅ All tests pass if:
1. Nodes with alias references store both original aliases and resolved positions
2. Execution uses the resolved positions (check logs)
3. Re-resolution happens after insert/delete operations
4. All targeting modes work correctly
5. Execute supports alias-based selection
6. Errors are caught with clear messages
7. Old workflows continue to work

## Debugging Tips

If something fails:
1. Use `get_workflow_nodes({ format: "detailed" })` to inspect full node configs
2. Check if `body_positions` or `branch_positions` are populated
3. Look for `[UPDATE_REFERENCES]` in logs after insert/delete
4. Verify aliases are unique with `get_workflow_nodes({ format: "tree" })`

## Quick Test Script

Here's a one-command test to verify basic functionality:

```javascript
// Run this to quickly test if aliases work
add_or_replace_nodes({
  target: "end",
  nodes: [
    { type: "context", alias: "test_start", config: { variables: { test: "starting" } } },
    { type: "context", alias: "test_middle", config: { variables: { test: "middle" } } },
    { type: "context", alias: "test_end", config: { variables: { test: "done" } } }
  ]
}) && execute_nodes({ nodeSelection: "test_start..test_end" })

// Should execute all 3 nodes if alias resolution works
```