# Variable Reference System - Director 2.0

## Overview

The Director 2.0 variable system uses a single, consistent approach: **always reference nodes by their alias**. No position numbers, no confusion - just clear, semantic references that describe what the node does.

## The One Rule

**Every node MUST have an alias. You provide it. You reference it.**

When creating a node, you MUST provide an 'alias' field. This is not optional - the system will reject nodes without aliases. This alias becomes your handle for referencing that node's results anywhere in your workflow.

## Variable Types & Syntax

### 1. Node Results
Reference the output of any node using its alias:

```javascript
{{extract_emails.result}}         // Full result object
{{extract_emails.emails}}         // Specific field
{{extract_emails.emails[0]}}      // Array element
{{validate_login.success}}        // Boolean field
{{extract_product.title}}         // Nested property
```

**How it works:**
- You decide the alias when creating the node
- Must be snake_case format: `extract_emails`, `validate_login`, `click_submit`
- Must be unique within the workflow
- System will error if alias is missing or duplicate

### 2. Environment Variables
Always use the `env:` prefix for environment variables:

```javascript
{{env:GMAIL_EMAIL}}              // Email from environment
{{env:API_KEY}}                  // API key from environment
{{env:BASE_URL}}                 // Base URL from environment
```

**Note:** The `$` syntax has been removed to maintain consistency.

### 3. Workflow Variables
Variables stored in workflow state need no prefix:

```javascript
{{user_credentials.email}}       // Stored credentials
{{session_token}}                // Simple variable
{{config.timeout}}               // Nested configuration
{{saved_data.users[0].name}}     // Complex nested data
```

### 4. Iterator Variables
Inside loops, access the current item and metadata:

```javascript
{{current_email.subject}}        // Current item property
{{current_emailIndex}}           // Current index (0-based)
{{current_emailTotal}}           // Total items in array
{{message.sender}}               // If iterator variable is "message"
{{messageIndex}}                 // Index for "message" iterator
```

## Examples

### Basic Workflow
```javascript
// 1. Navigate to site - NOTE THE REQUIRED ALIAS
{
  type: "browser_action",
  config: {action: "navigate", url: "{{env:GMAIL_URL}}"},
  description: "Navigate to Gmail",
  alias: "navigate_to_gmail"  // REQUIRED: You must provide this
}

// 2. Extract emails (alias: extract_emails)
{
  type: "browser_query",
  config: {
    method: "extract",
    instruction: "Extract all email subjects and senders",
    schema: {
      emails: [{subject: "string", sender: "string", id: "string"}]
    }
  },
  description: "Extract emails"
}

// 3. Reference the extracted data
{
  type: "cognition",
  config: {
    prompt: "Classify these emails: {{extract_emails.emails}}",
    schema: {classifications: [{id: "string", category: "string"}]}
  },
  description: "Classify emails by type"
}
```

### Storing and Using Variables
```javascript
// Store credentials from environment
{
  type: "context",
  config: {
    operation: "set",
    key: "gmail_creds",
    value: {
      email: "{{env:GMAIL_EMAIL}}",
      password: "{{env:GMAIL_PASSWORD}}"
    }
  },
  description: "Store Gmail credentials"
}

// Use stored credentials later
{
  type: "browser_action",
  config: {
    action: "type",
    selector: "#email",
    text: "{{gmail_creds.email}}"  // Reference stored variable
  },
  description: "Enter email address"
}
```

### Iteration Example
```javascript
// Iterate over extracted emails
{
  type: "iterate",
  config: {
    over: "extract_emails.emails",     // Array from extract_emails node
    variable: "email",                  // Each item is "email"
    body: [/* node positions */]
  },
  description: "Process each email"
}

// Inside the loop, reference current item
{
  type: "browser_action",
  config: {
    action: "click",
    selector: `[data-email-id="${{email.id}}"]`  // Current email's ID
  },
  description: "Click email row"
}
```

## Common Patterns

### Conditional Routing
```javascript
{
  type: "route",
  config: {
    value: "check_login_status.isLoggedIn",  // Reference node result
    paths: {
      "true": [/* already logged in nodes */],
      "false": [/* login flow nodes */]
    }
  },
  description: "Route based on login status"
}
```

### Complex Data Access
```javascript
// After extracting structured data
{{extract_table_data.rows[0].cells[2]}}     // Third cell of first row
{{process_response.data.user.preferences}}   // Deeply nested data
{{transform_results.filtered[0]}}            // First filtered item
```

## Migration Guide

If you're updating from position-based references:

### ❌ Old Way (Don't Use)
```javascript
{{node4.result}}                 // Position-based
{{n:extract_emails.result}}      // Namespace prefix
{{$GMAIL_PASSWORD}}              // Dollar sign for env vars
```

### ✅ New Way (Use This)
```javascript
{{extract_emails.result}}        // Alias-based
{{extract_emails.result}}        // No namespace needed
{{env:GMAIL_PASSWORD}}           // Consistent env: prefix
```

## Best Practices

1. **Choose Clear Aliases**: Pick aliases that describe what the node does
   - Good: `extract_product_prices`, `validate_user_login`
   - Bad: `node1`, `temp`, `data`

2. **Consistent Naming**: Use similar patterns for similar operations
   - `extract_emails`, `extract_products`, `extract_prices`
   - `validate_login`, `validate_payment`, `validate_form`

3. **Access Specific Fields**: Don't pass entire objects when you need one field
   - Good: `{{extract_user.email}}`
   - Bad: `{{extract_user}}` (when you only need email)

4. **Check Variable Existence**: Some nodes might not always produce results
   - Use validation nodes to ensure data exists before using it
   - Handle empty arrays in iterations

## Debugging Variables

### View Current State
Use the workflow variables display in your context to see current values (chunked to 100 chars).

### Get Full Variable Content
```javascript
get_workflow_variable({name: "extract_emails"})
```

### Test with Different Values
```javascript
set_variable({
  name: "test_email",
  value: "test@example.com"
})
```

### Clear Variables
```javascript
clear_variable({name: "old_data"})        // Clear specific
clear_all_variables()                     // Reset everything
```

## Important Notes

1. **Aliases are Immutable**: Once a node is created, its alias doesn't change even if you update the description
2. **Case Sensitive**: `{{Extract_Emails.result}}` ≠ `{{extract_emails.result}}`
3. **No Position References**: Never use `{{node1}}`, `{{node15}}`, etc.
4. **Automatic Storage**: Every node automatically stores its result - you don't need explicit storage unless using context nodes
5. **Execution Context**: Variables are only available after their nodes execute

## Quick Reference Card

```
Node Results:      {{extract_emails.result}}
Environment Vars:  {{env:GMAIL_EMAIL}}
Stored Variables:  {{user_credentials.email}}
Iterator Current:  {{email.subject}}
Iterator Index:    {{emailIndex}}
Array Access:      {{data.items[0]}}
Nested Access:     {{response.data.user.name}}
```

That's it! One system, one way to reference variables. Keep it simple, keep it consistent.