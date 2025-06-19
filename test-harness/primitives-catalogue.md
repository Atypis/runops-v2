# AEF Primitives Catalogue
*The Builder's Manual for Agentic Execution Framework*

Version: 1.0.0  
Last Updated: January 2025

---

## Table of Contents
1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Execution Primitives](#execution-primitives)
   - [browser_action](#browser_action)
   - [browser_query](#browser_query)
   - [transform](#transform)
   - [cognition](#cognition)
4. [Control Primitives](#control-primitives)
   - [sequence](#sequence)
   - [iterate](#iterate)
   - [route](#route)
   - [handle](#handle)
5. [State Primitives](#state-primitives)
   - [memory](#memory)
6. [Composition Patterns](#composition-patterns)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Introduction

This catalogue is the definitive guide for building workflows with AEF's 9 canonical primitives. Think of these primitives as LEGO blocks - simple, orthogonal pieces that combine to create complex automations.

### Design Philosophy
- **Orthogonal**: Each primitive does ONE thing well
- **Composable**: Complex behaviors emerge from simple combinations
- **Observable**: Every execution is transparent and debuggable
- **Deterministic**: Same inputs produce same outputs (except AI operations)

### Quick Reference
| Layer | Primitive | Purpose | Side Effects |
|-------|-----------|---------|--------------|
| Execution | `browser_action` | Browser interactions | Yes |
| Execution | `browser_query` | Data extraction | No |
| Execution | `transform` | Data manipulation | No |
| Execution | `cognition` | AI reasoning | No |
| Control | `sequence` | Serial execution | Depends |
| Control | `iterate` | Loops | Depends |
| Control | `route` | Branching | Depends |
| Control | `handle` | Error handling | Depends |
| State | `memory` | State management | Yes |

---

## Core Concepts

### State Management
Every workflow has a shared state object accessible by all primitives:
```javascript
{
  // System state
  "lastResult": {...},      // Result from previous node
  "lastExtract": {...},     // Last extraction result
  
  // Your workflow state
  "emails": [...],          // Custom data
  "currentEmail": {...},    // Iteration variables
  "processedCount": 0       // Counters
}
```

### Variable Resolution
Variables use template syntax and dot notation:
```javascript
"{{state.email}}"              // Simple state reference
"{{currentEmail.subject}}"     // Nested access
"{{state.users[0].name}}"      // Array access
"Hello {{name}}"               // String interpolation
```

### Error Handling
All primitives can throw errors. Use `handle` primitive for recovery:
- Network failures
- Element not found
- AI extraction failures
- Invalid state

---

## Execution Primitives

### browser_action
Performs side-effectful browser operations.

#### Signature
```javascript
{
  "type": "browser_action",
  "method": "goto" | "click" | "type",
  "target": string,  // URL or element description
  "data": any        // Optional data (for type method)
}
```

#### Methods

##### goto
Navigate to a URL.
```javascript
{
  "type": "browser_action",
  "method": "goto",
  "target": "https://mail.google.com"
}
```
- **Target**: Full URL to navigate to
- **Waits for**: Page load and network idle
- **Returns**: `{ success: true, url: "final-url" }`
- **Common errors**: Network timeout, invalid URL

##### click
Click an element using AI to find it.
```javascript
{
  "type": "browser_action",
  "method": "click",
  "target": "the blue Submit button"
}
```
- **Target**: Natural language description of element
- **AI-powered**: Uses vision + DOM analysis
- **Returns**: `{ success: true, action: "clicked" }`
- **Common errors**: Element not found, multiple matches

##### type
Type text into an input field.
```javascript
{
  "type": "browser_action",
  "method": "type",
  "target": "email address field",
  "data": "user@example.com"
}
```
- **Target**: Natural language description of input
- **Data**: Text to type (supports variables)
- **Returns**: `{ success: true, typed: "text" }`
- **Common errors**: Input not found, not editable

#### Advanced Examples
```javascript
// Using variables
{
  "type": "browser_action",
  "method": "type",
  "target": "search box",
  "data": "{{state.searchQuery}}"
}

// Complex element descriptions
{
  "type": "browser_action",
  "method": "click",
  "target": "the Edit button next to {{currentItem.name}}"
}
```

---

### browser_query
Extracts data from the page without side effects.

#### Signature
```javascript
{
  "type": "browser_query",
  "method": "extract" | "observe",
  "instruction": string,
  "schema": object  // For extract only
}
```

#### Methods

##### extract
Extract structured data using AI.
```javascript
{
  "type": "browser_query",
  "method": "extract",
  "instruction": "Extract all email threads with sender and subject",
  "schema": {
    "emails": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "sender": { "type": "string" },
          "subject": { "type": "string" },
          "date": { "type": "string" }
        }
      }
    }
  }
}
```
- **Instruction**: What to extract in natural language
- **Schema**: JSON schema defining expected structure
- **Auto-stores**: Results in state (e.g., `state.emails`)
- **Returns**: Extracted data matching schema

##### observe
Get possible actions on current page.
```javascript
{
  "type": "browser_query",
  "method": "observe",
  "instruction": "Find all clickable buttons"
}
```
- **Returns**: Array of possible actions
- **Use case**: Exploration, debugging
- **⚠️ Status**: Not fully implemented

#### Schema Best Practices
```javascript
// Be specific about types
"schema": {
  "isLoggedIn": { "type": "boolean" },
  "userName": { "type": "string" },
  "accountBalance": { "type": "number" },
  "transactions": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "date": { "type": "string" },
        "amount": { "type": "number" }
      }
    }
  }
}
```

---

### transform
Pure data transformation without side effects.

#### Signature
```javascript
{
  "type": "transform",
  "input": string | array,    // State path(s)
  "function": string,          // JavaScript function
  "output": string             // State path to store result
}
```

#### Examples
```javascript
// Filter an array
{
  "type": "transform",
  "input": "state.emails",
  "function": "(emails) => emails.filter(e => e.date === '2025-01-19')",
  "output": "state.todaysEmails"
}

// Multiple inputs
{
  "type": "transform",
  "input": ["state.emails", "state.investorMask"],
  "function": "(emails, mask) => emails.filter((e, i) => mask[i])",
  "output": "state.investorEmails"
}

// Data normalization
{
  "type": "transform",
  "input": "state.rawInvestor",
  "function": `(investor) => ({
    name: investor.name?.trim(),
    email: investor.email?.toLowerCase(),
    phone: investor.phone?.replace(/[^0-9]/g, ''),
    id: btoa(investor.name + investor.email).slice(0, 8)
  })`,
  "output": "state.normalizedInvestor"
}
```

#### Function Guidelines
- Must be pure (no side effects)
- Can access multiple inputs as parameters
- Should handle edge cases (null, undefined)
- Keep complex logic readable

---

### cognition
AI-powered reasoning and content generation.

#### Signature
```javascript
{
  "type": "cognition",
  "prompt": string,
  "input": string,           // State path
  "output": string,          // State path  
  "model": string,           // Optional, default: "gpt-4o-mini"
  "temperature": number,     // Optional, default: 1
  "schema": object          // Optional output schema
}
```

#### Examples
```javascript
// Classification
{
  "type": "cognition",
  "prompt": "Classify these emails as investor-related or not. Return a boolean array.",
  "input": "state.emails",
  "output": "state.investorFlags",
  "model": "gpt-4o-mini"
}

// Content generation
{
  "type": "cognition",
  "prompt": "Write a professional follow-up email to this investor",
  "input": "state.investorInfo",
  "output": "state.draftEmail"
}

// Structured extraction
{
  "type": "cognition",
  "prompt": "Extract key metrics from this financial report",
  "input": "state.reportText",
  "output": "state.metrics",
  "schema": {
    "revenue": "number",
    "profit": "number",
    "growth": "string"
  }
}
```

#### Best Practices
- Be specific in prompts
- Use schema for structured outputs
- Consider token limits for large inputs
- Handle non-deterministic results

---

## Control Primitives

### sequence
Execute nodes in serial order.

#### Signature
```javascript
{
  "type": "sequence",
  "nodes": array,     // Array of nodes to execute
  "name": string      // Optional name for logging
}
```

#### Example
```javascript
{
  "type": "sequence",
  "name": "Login Flow",
  "nodes": [
    { "type": "browser_action", "method": "goto", "target": "https://app.com" },
    { "type": "browser_action", "method": "type", "target": "username", "data": "{{user}}" },
    { "type": "browser_action", "method": "type", "target": "password", "data": "{{pass}}" },
    { "type": "browser_action", "method": "click", "target": "Login button" }
  ]
}
```

#### Behavior
- Executes nodes one by one
- Stops on first error (unless wrapped in handle)
- Each node sees results from previous nodes
- Returns array of all results

---

### iterate
Loop over collections with scoped variables.

#### Signature
```javascript
{
  "type": "iterate",
  "over": string,          // State path to array
  "as": string,            // Variable name for current item
  "index": string,         // Optional index variable name
  "body": object           // Node to execute for each item
}
```

#### Example
```javascript
{
  "type": "iterate",
  "over": "state.emails",
  "as": "currentEmail",
  "index": "emailIndex",
  "body": {
    "type": "sequence",
    "nodes": [
      {
        "type": "browser_action",
        "method": "click",
        "target": "email with subject {{currentEmail.subject}}"
      },
      {
        "type": "browser_query",
        "method": "extract",
        "instruction": "Extract email body content",
        "schema": { "body": "string" }
      },
      {
        "type": "memory",
        "operation": "set",
        "data": {
          "processedEmails[{{emailIndex}}]": "{{lastExtract}}"
        }
      }
    ]
  }
}
```

#### Scoping
- `currentEmail` available in body and nested nodes
- `emailIndex` tracks position (0-based)
- Parent state still accessible
- Changes to state persist across iterations

---

### route
Multi-way branching based on conditions.

#### Signature
```javascript
{
  "type": "route",
  "value": string,         // State path to check
  "paths": object         // Map of values to nodes
}
```

#### Examples
```javascript
// Binary routing
{
  "type": "route",
  "value": "state.isLoggedIn",
  "paths": {
    "true": { "type": "browser_action", "method": "goto", "target": "/dashboard" },
    "false": { "type": "sequence", "name": "Login Flow", "nodes": [...] }
  }
}

// Multi-way routing
{
  "type": "route",
  "value": "state.userType",
  "paths": {
    "admin": { "type": "browser_action", "method": "goto", "target": "/admin" },
    "user": { "type": "browser_action", "method": "goto", "target": "/home" },
    "guest": { "type": "browser_action", "method": "goto", "target": "/welcome" },
    "default": { "type": "browser_action", "method": "goto", "target": "/error" }
  }
}
```

#### Path Resolution
- Converts value to string for matching
- Checks exact match first
- Falls back to "default" if present
- Throws error if no match found

---

### handle
Error boundary with recovery options.

#### Signature
```javascript
{
  "type": "handle",
  "try": object,           // Node to attempt
  "catch": object,         // Node to run on error (optional)
  "finally": object        // Always runs (optional)
}
```

#### Example
```javascript
{
  "type": "handle",
  "try": {
    "type": "browser_action",
    "method": "click",
    "target": "Submit button"
  },
  "catch": {
    "type": "sequence",
    "nodes": [
      {
        "type": "cognition",
        "prompt": "The submit button wasn't found. What should we try?",
        "input": "state.pageContent",
        "output": "state.fallbackAction"
      },
      {
        "type": "browser_action",
        "method": "click",
        "target": "{{state.fallbackAction}}"
      }
    ]
  },
  "finally": {
    "type": "memory",
    "operation": "set",
    "data": { "attemptComplete": true }
  }
}
```

#### ⚠️ Status: Planned for implementation

---

## State Primitives

### memory
Explicit state management operations.

#### Signature
```javascript
{
  "type": "memory",
  "operation": "set" | "get" | "clear" | "merge",
  "scope": "local" | "iteration" | "global",   // Optional
  "data": object | array                       // Depends on operation
}
```

#### Operations

##### set
Store values in state.
```javascript
{
  "type": "memory",
  "operation": "set",
  "data": {
    "userName": "{{lastExtract.name}}",
    "loginTime": "{{Date.now()}}",
    "processedCount": 0
  }
}
```

##### get
Retrieve values (rarely needed, use variables instead).
```javascript
{
  "type": "memory",
  "operation": "get",
  "data": ["userName", "loginTime"]
}
```

##### clear
Reset state.
```javascript
{
  "type": "memory",
  "operation": "clear",
  "scope": "global"
}
```

##### merge
Merge objects into state.
```javascript
{
  "type": "memory",
  "operation": "merge",
  "data": {
    "settings": {
      "theme": "dark",
      "notifications": true
    }
  }
}
```

#### ⚠️ Note: Scope management not yet implemented

---

## Composition Patterns

### Login Flow Pattern
```javascript
{
  "type": "handle",
  "try": {
    "type": "sequence",
    "name": "Standard Login",
    "nodes": [
      { "type": "browser_action", "method": "goto", "target": "{{loginUrl}}" },
      { "type": "browser_query", "method": "extract", "instruction": "Is user already logged in?", "schema": { "isLoggedIn": "boolean" } },
      {
        "type": "route",
        "value": "state.isLoggedIn",
        "paths": {
          "true": { "type": "memory", "operation": "set", "data": { "loginStatus": "already logged in" } },
          "false": {
            "type": "sequence",
            "nodes": [
              { "type": "browser_action", "method": "type", "target": "email field", "data": "{{credentials.email}}" },
              { "type": "browser_action", "method": "click", "target": "Next button" },
              { "type": "browser_action", "method": "type", "target": "password field", "data": "{{credentials.password}}" },
              { "type": "browser_action", "method": "click", "target": "Sign in button" }
            ]
          }
        }
      }
    ]
  },
  "catch": {
    "type": "cognition",
    "prompt": "Login failed. Analyze the page and suggest next steps.",
    "input": "state.lastError",
    "output": "state.recoveryPlan"
  }
}
```

### Data Processing Pattern
```javascript
{
  "type": "sequence",
  "name": "Process Customer Data",
  "nodes": [
    // Extract raw data
    {
      "type": "browser_query",
      "method": "extract",
      "instruction": "Extract all customer records from the table",
      "schema": {
        "customers": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "email": { "type": "string" },
              "status": { "type": "string" }
            }
          }
        }
      }
    },
    
    // Filter active customers
    {
      "type": "transform",
      "input": "state.customers",
      "function": "(customers) => customers.filter(c => c.status === 'active')",
      "output": "state.activeCustomers"
    },
    
    // Enrich with AI
    {
      "type": "cognition",
      "prompt": "For each customer, predict their likelihood to upgrade. Return array of scores 0-100.",
      "input": "state.activeCustomers",
      "output": "state.upgradeScores"
    },
    
    // Process each high-value customer
    {
      "type": "iterate",
      "over": "state.activeCustomers",
      "as": "customer",
      "index": "idx",
      "body": {
        "type": "route",
        "value": "state.upgradeScores[{{idx}}]",
        "paths": {
          "default": {
            "type": "sequence",
            "nodes": [
              { "type": "browser_action", "method": "click", "target": "Create task for {{customer.name}}" },
              { "type": "browser_action", "method": "type", "target": "task description", "data": "Follow up about upgrade opportunity" }
            ]
          }
        }
      }
    }
  ]
}
```

---

## Best Practices

### 1. Error Handling
Always wrap critical operations in `handle` primitives:
```javascript
{
  "type": "handle",
  "try": { /* your risky operation */ },
  "catch": { /* recovery logic */ }
}
```

### 2. State Management
- Use descriptive keys: `customerEmail` not `email`
- Clean up after iterations with memory clear
- Don't store sensitive data in state

### 3. AI Operations
- Provide clear, specific prompts
- Use schemas for structured outputs
- Handle non-deterministic results gracefully

### 4. Performance
- Batch operations when possible
- Use `transform` instead of multiple `cognition` calls
- Clear memory between large iterations

### 5. Debugging
- Use descriptive node names
- Add memory checkpoints for complex flows
- Test primitives in isolation first

---

## Troubleshooting

### Common Issues

#### "Element not found"
- Make the description more specific
- Add wait time before clicking
- Use `browser_query` to check element exists first

#### "State variable undefined"
- Check variable name spelling
- Ensure previous node stored the value
- Use memory set to initialize variables

#### "AI extraction returned null"
- Make instruction clearer
- Provide example in prompt
- Check if page fully loaded

#### "Iteration stopped early"
- Check array exists and has items
- Look for errors in loop body
- Ensure state mutations don't affect iteration

### Debug Workflow
```javascript
{
  "type": "sequence",
  "nodes": [
    // Check current state
    { "type": "memory", "operation": "get", "data": ["*"] },
    
    // Extract page info
    {
      "type": "browser_query",
      "method": "extract",
      "instruction": "What is on this page?",
      "schema": { "pageInfo": "string" }
    },
    
    // Log to console
    {
      "type": "cognition",
      "prompt": "Summarize the current workflow state and page",
      "input": "state",
      "output": "state.debugSummary"
    }
  ]
}
```

---

## Future Primitives

The following primitives are planned but not yet implemented:

### parallel
Execute multiple nodes concurrently.
```javascript
{
  "type": "parallel",
  "nodes": [...],
  "maxConcurrency": 3,
  "joinStrategy": "all" | "race" | "some"
}
```

### checkpoint
Save and restore workflow state.
```javascript
{
  "type": "checkpoint",
  "operation": "save" | "restore",
  "id": "before-payment-flow"
}
```

### wait
Pause execution with conditions.
```javascript
{
  "type": "wait",
  "until": "element-visible" | "time" | "condition",
  "target": "Success message",
  "timeout": 5000
}
```

---

*This catalogue is a living document. As new patterns emerge and primitives evolve, this guide will be updated to reflect the latest best practices.*