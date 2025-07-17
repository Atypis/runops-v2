# Route Node - Complete Documentation

## Overview

The route node is a control flow node that enables conditional branching in workflows. It evaluates conditions and directs execution to different paths based on the results. This is essential for implementing decision logic, handling different scenarios, and creating dynamic workflows that adapt to varying conditions.

### Key Features
- **Single, unified format** - One clean pattern for all routing needs
- **Unlimited branches** - Handle 2-way, 3-way, or N-way decisions with the same syntax
- **Enhanced expression evaluation** - Full support for &&, ||, !, parentheses, and ternary operators
- **First-match-wins** - Branches evaluated in order for predictable behavior
- **Named branches** - Clear, descriptive names for each path
- **Default support** - Use `condition: "true"` for fallback branches

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

### Node Configuration Format

The route node uses a single, clean format - an array of branches:

```javascript
{
  type: 'route',
  alias: 'handle_request',
  config: [
    {
      name: 'urgent',
      condition: '{{priority}} > 8',
      branch: [100, 101, 102]
    },
    {
      name: 'normal', 
      condition: '{{priority}} > 3',
      branch: 110
    },
    {
      name: 'low',
      condition: 'true',  // Default fallback
      branch: 120
    }
  ]
}
```

Each branch has three properties:
- **name** - Descriptive name for the branch (for clarity and debugging)
- **condition** - Expression that evaluates to true/false
- **branch** - Node position(s) to execute if condition is true

### Examples

#### Binary Decision (2 branches)
```javascript
{
  type: 'route',
  alias: 'check_auth',
  config: [
    { name: 'authenticated', condition: '{{isLoggedIn}}', branch: 10 },
    { name: 'anonymous', condition: 'true', branch: 20 }
  ]
}
```

#### Multi-Way Decision (5+ branches)
```javascript
{
  type: 'route',
  alias: 'customer_support_router',
  config: [
    {
      name: 'security_emergency',
      condition: '{{issue.type}} equals "security" && {{severity}} > 9',
      branch: [300, 301, 302]
    },
    {
      name: 'vip_technical',
      condition: '{{customer.tier}} equals "enterprise" && {{issue.technical}}',
      branch: [310, 311]
    },
    {
      name: 'billing_high_value',
      condition: '{{issue.type}} equals "billing" && {{amount}} > 1000',
      branch: [320, 321, 322]
    },
    {
      name: 'quick_resolution',
      condition: '{{issue.estimatedTime}} < 5',
      branch: 330
    },
    {
      name: 'standard_support',
      condition: 'true',
      branch: [340, 341]
    }
  ]
}
```

## How It Works

### Evaluation Order
Branches are evaluated **in order** from top to bottom. The first branch whose condition evaluates to `true` is executed. This makes the behavior predictable and allows for cascading conditions:

```javascript
config: [
  { name: 'critical', condition: '{{severity}} > 9', branch: 10 },
  { name: 'high', condition: '{{severity}} > 6', branch: 20 },
  { name: 'medium', condition: '{{severity}} > 3', branch: 30 },
  { name: 'low', condition: 'true', branch: 40 }  // Catches everything else
]
```

### Default Branches
Always include a default branch with `condition: 'true'` as the last entry. This ensures the workflow doesn't get stuck if no other conditions match:

```javascript
{ name: 'default', condition: 'true', branch: 50 }
```

## Enhanced Expression Syntax

### Logical Operators
| Operator | Description | Example |
|----------|-------------|---------|
| `&&` | Logical AND | `{{isActive}} && {{hasPermission}}` |
| `||` | Logical OR | `{{isAdmin}} || {{isOwner}}` |
| `!` | Logical NOT | `!{{isDisabled}}` |
| `()` | Grouping | `({{a}} || {{b}}) && {{c}}` |
| `? :` | Ternary | `{{count}} > 0 ? "has items" : "empty"` |

### Comparison Operators
| Operator | Description | Example |
|----------|-------------|---------|
| `===` | Strict equality | `{{status}} === "active"` |
| `!==` | Strict inequality | `{{type}} !== "draft"` |
| `==` | Loose equality | `{{count}} == "5"` |
| `!=` | Loose inequality | `{{result}} != null` |
| `>` | Greater than | `{{score}} > 80` |
| `<` | Less than | `{{remaining}} < 10` |
| `>=` | Greater or equal | `{{age}} >= 18` |
| `<=` | Less or equal | `{{items}} <= 100` |

### String Operators
| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Case-sensitive equality | `{{status}} equals "active"` |
| `contains` | String contains | `{{message}} contains "error"` |
| `matches` | Regex pattern | `{{email}} matches "^[\\w]+@[\\w]+\\.[\\w]+$"` |
| `exists` | Non-null/undefined/empty | `{{user}} exists` |

### Complex Expression Examples
```javascript
// Combining multiple conditions
condition: '{{priority}} > 5 && ({{customer.tier}} equals "vip" || {{override}})'

// Using negation
condition: '!{{isProcessed}} && {{status}} !== "cancelled"'

// Ternary in computedPaths
condition: '{{items.length}} > 0 ? {{items[0].priority}} > 8 : false'

// Complex business logic
condition: '({{order.total}} > 1000 || {{customer.lifetimeValue}} > 5000) && !{{fraud.detected}}'
```

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

### 1. Use Descriptive Branch Names
```javascript
// Good - Clear what each branch does
config: [
  { name: 'payment_success', condition: '{{payment.verified}}', branch: 30 },
  { name: 'payment_failed', condition: 'true', branch: 35 }
]

// Less clear
config: [
  { name: 'branch1', condition: '{{payment.verified}}', branch: 30 },
  { name: 'branch2', condition: 'true', branch: 35 }
]
```

### 2. Order Matters - Most Specific First
```javascript
// Good - Specific conditions first
config: [
  { name: 'vip_urgent', condition: '{{vip}} && {{priority}} > 8', branch: 10 },
  { name: 'vip_normal', condition: '{{vip}}', branch: 20 },
  { name: 'urgent', condition: '{{priority}} > 8', branch: 30 },
  { name: 'normal', condition: 'true', branch: 40 }
]
```

### 3. Always Include a Default
```javascript
// Good - Workflow never gets stuck
config: [
  { name: 'has_email', condition: '{{email}} exists', branch: 50 },
  { name: 'no_email', condition: 'true', branch: 60 }  // Always have fallback
]
```

### 4. Use Clear Expressions
```javascript
// Good - Explicit and readable
{ condition: '{{status}} === "active" && {{balance}} > 0' }

// Less clear - Implicit truthiness
{ condition: '{{status}} && {{balance}}' }
```

## Common Patterns

### Authentication Flow
```javascript
{
  type: 'route',
  alias: 'auth_verification',
  config: [
    { 
      name: 'fully_authenticated',
      condition: '{{login.success}} && ({{mfa.verified}} || {{user.trustedDevice}})',
      branch: [10, 11, 12]  // Proceed to app
    },
    {
      name: 'needs_verification',
      condition: 'true',
      branch: [15, 16]  // Additional verification required
    }
  ]
}
```

### Document Processing by Type
```javascript
{
  type: 'route',
  alias: 'process_document',
  config: [
    { name: 'invoice', condition: '{{docType}} equals "invoice"', branch: [20, 21, 22] },
    { name: 'receipt', condition: '{{docType}} equals "receipt"', branch: [25, 26] },
    { name: 'contract', condition: '{{docType}} equals "contract"', branch: [30, 31, 32] },
    { name: 'unknown', condition: 'true', branch: 35 }  // Handle unknown types
  ]
}
```

### Error Severity Handling
```javascript
{
  type: 'route',
  alias: 'handle_error',
  config: [
    {
      name: 'critical_security',
      condition: '{{error.type}} equals "security" || {{error.severity}} >= 9',
      branch: [100, 101, 102]  // Immediate escalation
    },
    {
      name: 'high_priority',
      condition: '{{error.severity}} >= 7 || {{error.affectedUsers}} > 100',
      branch: [110, 111]
    },
    {
      name: 'known_issue',
      condition: '{{error.code}} matches "KNOWN-\\d+"',
      branch: 120  // Automated fix
    },
    {
      name: 'standard',
      condition: 'true',
      branch: [130, 131]  // Regular error handling
    }
  ]
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