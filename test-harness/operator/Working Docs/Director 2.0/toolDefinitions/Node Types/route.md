# Route Node - Complete Documentation

## Overview

The route node is a control flow node that enables conditional branching in workflows. It evaluates conditions or values and directs execution to different paths based on the results. This is essential for implementing decision logic, handling different scenarios, and creating dynamic workflows that adapt to varying conditions.

### Key Features
- Multiple routing strategies (value-based, condition-based)
- Support for complex conditions with operators
- Nested branch execution with proper tracking
- Backward compatibility with legacy formats
- Default fallback paths for unmatched conditions

## Implementation Architecture

### Core Files

1. **Backend Execution**
   - `/test-harness/operator/backend/services/nodeExecutor.js` - `executeRoute()` method (lines 1203-1328)
   - `/test-harness/workflows/executor/primitives/route.js` - Legacy primitive implementation

2. **Frontend Components**
   - `/test-harness/operator/frontend/app.js` - `RouteCard` and `NestedRouteCard` components
   - Handles route visualization and nested node display

3. **Configuration**
   - `/test-harness/operator/backend/tools/toolDefinitionsV2.js` - Route node schema definition
   - `/test-harness/operator/backend/prompts/directorPromptV3.js` - Usage examples

### Node Configuration Formats

#### Modern Condition-Based Format (Recommended)
```javascript
{
  type: 'route',
  alias: 'check_login_status',
  config: {
    condition: '{{login_result}} === true',
    true_branch: 15,    // Execute node at position 15 if true
    false_branch: 20    // Execute node at position 20 if false
  }
}
```

#### Legacy Value-Based Format (Still Supported)
```javascript
{
  type: 'route',
  alias: 'process_by_type',
  config: {
    value: 'state.documentType',
    paths: {
      'invoice': [25, 26, 27],      // Process invoice nodes
      'receipt': [30, 31],          // Process receipt nodes
      'default': [35]               // Handle unknown types
    }
  }
}
```

## Routing Strategies

### 1. Condition-Based Routing (Modern Approach)

Uses explicit conditions with operators for clear, readable logic:

```javascript
// Simple boolean check
{
  condition: '{{isAuthenticated}}',
  true_branch: 10,
  false_branch: 15
}

// Comparison operators
{
  condition: '{{price}} > 100',
  true_branch: [20, 21],  // Can be array of positions
  false_branch: 25
}

// String matching
{
  condition: '{{status}} equals "completed"',
  true_branch: 30,
  false_branch: 35
}
```

### 2. Value-Based Routing (Legacy)

Maps specific values to execution paths:

```javascript
{
  value: 'state.userRole',
  paths: {
    'admin': [40, 41, 42],
    'user': [45, 46],
    'guest': [50],
    'default': [55]  // Fallback for unmatched values
  }
}
```

## Supported Operators

The route node supports these operators in conditions:

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact equality | `{{status}} equals "active"` |
| `notEquals` | Inequality | `{{count}} notEquals 0` |
| `contains` | String contains | `{{message}} contains "error"` |
| `exists` | Non-null/undefined/empty | `{{user}} exists` |
| `greater` | Greater than | `{{score}} greater 80` |
| `less` | Less than | `{{remaining}} less 10` |
| `greaterOrEqual` | Greater or equal | `{{age}} greaterOrEqual 18` |
| `lessOrEqual` | Less or equal | `{{items}} lessOrEqual 100` |
| `matches` | Regex pattern | `{{email}} matches "^[\\w]+@[\\w]+\\.[\\w]+$"` |

## Variable References

### State References
```javascript
// Direct state access
{ value: 'state.currentStep' }

// With template syntax
{ condition: '{{currentStep}} equals "verification"' }
```

### Node Result References
```javascript
// Reference another node's result
{ value: 'extract_data.documentType' }

// In conditions
{ condition: '{{login_attempt.success}} === true' }
```

### Iterator Variables (Within Loops)
```javascript
// Access current iteration item
{ condition: '{{email.priority}} equals "high"' }

// Check iteration index
{ condition: '{{emailIndex}} less 5' }
```

## Branch Specification

### Single Node Position
```javascript
{
  true_branch: 25,     // Go to node at position 25
  false_branch: 30     // Go to node at position 30
}
```

### Multiple Node Positions
```javascript
{
  true_branch: [25, 26, 27],   // Execute nodes 25, 26, 27 in sequence
  false_branch: [30, 31]       // Execute nodes 30, 31 in sequence
}
```

### Inline Node Definitions (Legacy)
```javascript
{
  true_branch: {
    type: 'browser_action',
    alias: 'click_proceed',
    config: { action: 'click', selector: '#proceed' }
  }
}
```

## Execution Flow

### 1. Condition/Value Evaluation
- Resolves all variable references
- Evaluates the condition or retrieves the value
- Determines which branch to execute

### 2. Branch Selection
- For conditions: Selects true_branch or false_branch
- For values: Matches against paths or uses default
- Returns null if no matching path found

### 3. Node Execution
- Executes selected branch nodes in order
- Tracks which branches were NOT taken
- Updates execution context for proper flow control

### 4. Result Collection
- Aggregates results from all executed nodes
- Maintains execution order and context
- Provides clear execution trace

## Best Practices

### 1. Use Clear Conditions
```javascript
// Good - Clear and specific
{ condition: '{{user.isVerified}} === true' }

// Less clear
{ condition: '{{verified}}' }
```

### 2. Always Include Defaults
```javascript
// Value-based - always add default
{
  paths: {
    'option1': [10],
    'option2': [15],
    'default': [20]  // Handle unexpected values
  }
}
```

### 3. Prefer Node Positions Over Inline
```javascript
// Good - Reference existing nodes
{ true_branch: 25 }

// Avoid - Inline node definitions
{ true_branch: { type: 'browser_action', ... } }
```

### 4. Document Branch Logic
```javascript
{
  type: 'route',
  alias: 'check_payment_status',
  description: 'Route based on payment verification result',
  config: {
    condition: '{{payment.verified}} === true',
    true_branch: 30,  // Process successful payment
    false_branch: 35  // Handle payment failure
  }
}
```

## Common Patterns

### Authentication Flow
```javascript
{
  type: 'route',
  alias: 'auth_check',
  config: {
    condition: '{{login_attempt.success}} === true',
    true_branch: [10, 11, 12],  // Continue to dashboard
    false_branch: [15, 16]      // Show error, retry login
  }
}
```

### Multi-Way Branching
```javascript
{
  type: 'route',
  alias: 'process_document',
  config: {
    value: 'extract_type.documentType',
    paths: {
      'invoice': [20, 21, 22],
      'receipt': [25, 26],
      'contract': [30, 31, 32],
      'default': [35]  // Unknown document handler
    }
  }
}
```

### Nested Conditions
```javascript
// First route - check if logged in
{
  type: 'route',
  alias: 'logged_in_check',
  config: {
    condition: '{{isLoggedIn}}',
    true_branch: 40,  // Points to another route node
    false_branch: 45  // Login flow
  }
}

// Second route at position 40 - check user role
{
  type: 'route',
  alias: 'role_check',
  config: {
    value: 'state.userRole',
    paths: {
      'admin': [50, 51],
      'user': [55, 56],
      'default': [60]
    }
  }
}
```

## Error Handling

### Missing Values
- If referenced value doesn't exist, route returns null
- Workflow execution may stop unless wrapped in error handler

### Invalid Conditions
- Malformed conditions log warnings and evaluate to false
- Syntax errors in regex patterns are caught and logged

### Branch Not Found
- If no branch matches and no default exists, returns null
- Best practice: Always include fallback branches

## Troubleshooting

### Route Not Taking Expected Path
1. Check variable resolution - use `get_workflow_variables` to inspect
2. Verify condition syntax - especially operators and comparisons
3. Ensure referenced nodes exist at specified positions
4. Check for type coercion issues (numbers vs strings)

### Nested Routes Not Executing
1. Verify parent route points to correct child position
2. Check that nested route has unique alias
3. Ensure execution context is properly maintained

### Variables Not Found
1. Confirm variable is stored (`store_variable: true`)
2. Check variable name spelling and case
3. Verify variable is set before route evaluation
4. Use correct reference syntax (`{{alias.property}}`)

## Technical Notes

- Routes evaluate synchronously - no async operations in conditions
- Branch execution is sequential, not parallel
- Nested execution context prevents interference between branches
- Route nodes themselves don't store results unless `store_variable: true`
- Supports both position-based and inline node references for compatibility
- Execution tracking ensures skipped branches are properly marked