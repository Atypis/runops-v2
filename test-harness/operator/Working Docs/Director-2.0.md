# Director 2.0: Incremental Workflow Building with Validation Feedback

## Executive Summary

This document outlines the transformation of the Director system from a "build-all-at-once" approach to an incremental, validated workflow construction methodology. The key insight is that the Director should build workflows like a human would - one step at a time, with immediate validation and the ability to course-correct based on actual execution results.

## Core Philosophy

### Current Problem
The Director currently:
- Tries to construct entire workflows without seeing results
- Has no feedback on whether nodes actually work
- Can't learn from failures or adjust approach
- Builds "blind" without validation

### New Approach: Build → Validate → Iterate
1. **Chunk the workflow** into logical phases
2. **Scout first** to understand the UI
3. **Build one node** at a time
4. **Validate immediately** after each node
5. **Iterate based on results**
6. **Checkpoint with human** at phase boundaries

## System Prompt Improvements

### 1. Toolbox Mastery Section

The new prompt must include:

#### A. Deterministic vs AI Hierarchy
```
NAVIGATION HIERARCHY:
1. PRIMARY: Use deterministic selectors discovered by Scout
   - ID selectors: #submit-button
   - Data attributes: [data-testid="login"]
   - Stable classes: .primary-button
   - ARIA labels: [aria-label="Next"]

2. FALLBACK: Natural language selectors
   - text: prefix for exact text matching
   - act: prefix for AI-powered selection
   - Use ONLY when deterministic fails

3. NEVER: 
   - Dynamic IDs (Gmail's #:b5, #:a1)
   - Position-based selectors without context
   - Overly generic selectors (.button)
```

#### B. Exact Node Creation Specifications
```
NODE CREATION RULES:
- ALWAYS include config parameter
- NEVER create nodes with empty config {}
- Each node type has REQUIRED fields
- Use exact syntax shown in examples
- Reference previous nodes by position (node1, node2)
- State variables use snake_case (gmail_creds, not gmailCreds)
```

#### C. Business-Level Invariants
```
SMART PATTERNS:
1. Login Detection:
   - Check for DOM selector presence first
   - Example: document.querySelector('[data-action="sign in"]')
   - Only use browser_query if selector check fails

2. Page Load Verification:
   - Wait for specific elements, not arbitrary time
   - Example: Wait for [aria-label="Search mail"] on Gmail

3. Error States:
   - Always check for error messages after actions
   - Common selectors: .error-message, [role="alert"]
```

### 2. Variable Storage Clarification

#### CRITICAL: How Variables Work
```
VARIABLE STORAGE & ACCESS:

1. STORING VARIABLES:
   A. From Environment Variables:
      {"type": "context", "config": {"operation": "set", "key": "gmail_creds", 
       "value": {"email": "{{GMAIL_EMAIL}}", "password": "{{GMAIL_PASSWORD}}"}}}
   
   B. From Node Results (automatic):
      - browser_query results stored as: node[position].result
      - Example: node4.emails contains extracted email array
   
   C. Manual Storage:
      {"type": "context", "config": {"operation": "set", "key": "user_data", 
       "value": {"name": "John", "id": 123}}}

2. ACCESSING VARIABLES:
   A. State Variables: {{variable_name}} or {{nested.path}}
      - {{gmail_creds.email}}
      - {{user_data.name}}
   
   B. Node Results: node[position].fieldName
      - node4.loginRequired
      - node7.emails[0].subject
   
   C. Iteration Variables: {{variableName}}
      - In iterate loop with variable "email": {{email.sender}}
      
3. COMMON MISTAKES:
   - ❌ {{state.gmail_creds}} - Don't include "state" prefix
   - ❌ {{node4}} - Must specify field: {{node4.result}}
   - ❌ camelCase - Always use snake_case for consistency
```

### 3. Workflow Methodology

#### The Chunk → Scout → Build → Validate Process
```
METHODOLOGY:

1. CHUNK THE WORKFLOW
   - Break into logical phases (Setup, Data Extraction, Processing)
   - Each chunk should be independently testable
   - Plan checkpoints between chunks

2. SCOUT THE TERRITORY
   - Deploy Scout to explore UI patterns
   - Get exact selectors and timing requirements
   - Understand page flow and states
   - Test selectors for reliability

3. BUILD INCREMENTALLY
   - Create TODO list for the chunk
   - Build ONE node at a time
   - Never build multiple nodes without validation

4. VALIDATE IMMEDIATELY
   - Add validation node after EVERY action
   - Check both positive (success) and negative (errors)
   - Use deterministic checks when possible

5. ITERATE BASED ON RESULTS
   - If validation fails, modify the node
   - Update approach based on actual behavior
   - Learn from what works/doesn't work

6. CHECKPOINT WITH HUMAN
   - Confirm chunk completion
   - Get approval before next phase
   - Share learnings and observations
```

### 4. Node Type Best Practices

#### Navigation Nodes
```
NAVIGATION BEST PRACTICES:
1. Always wait for page load indicators
2. Check for redirects or auth challenges
3. Validate you're on the expected page
4. Handle both logged-in and logged-out states

Example Pattern:
- Navigate to URL
- Wait for specific element (not arbitrary time)
- Validate page title or unique element
- Check for login/auth requirements
```

#### Data Extraction
```
EXTRACTION BEST PRACTICES:
1. Use precise schemas to prevent hallucination
2. Always include "only extract visible data" instruction
3. Provide empty array/null fallbacks
4. Extract selectors for later interaction

Example:
{"type": "browser_query", "config": {
  "method": "extract",
  "instruction": "Extract all visible emails. Return empty array if none found. Include stable selectors for clicking.",
  "schema": {
    "emails": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "sender": "string",
          "subject": "string",
          "selector": "string"
        }
      }
    }
  }
}}
```

#### Routes
```
ROUTING BEST PRACTICES:
1. Check simple conditions first (boolean/string)
2. Use node results for dynamic routing
3. Always include default branch
4. Validate route decision with logging

Example:
{"type": "route", "config": {
  "value": "node4.needsLogin",
  "paths": {
    "true": [/* login flow */],
    "false": [/* continue to main flow */]
  }
}}
```

#### Loops
```
LOOP BEST PRACTICES:
1. Always set reasonable limits
2. Use continueOnError for robustness
3. Track iteration progress
4. Validate loop completion

Example:
{"type": "iterate", "config": {
  "over": "node4.emails",
  "variable": "email",
  "limit": 10,
  "continueOnError": true,
  "body": [
    {"type": "browser_action", "config": {"action": "click", "selector": "{{email.selector}}"}},
    {"type": "browser_query", "config": {"method": "extract", "instruction": "Validate email opened"}}
  ]
}}
```

## New Tools Required

### 1. Validation Tools

```javascript
// validate_node - Create validation check after any action
{
  name: 'validate_node',
  description: 'Create a validation node that checks if the previous node succeeded',
  parameters: {
    nodeId: 'ID of node to validate',
    intent: 'What the node was supposed to accomplish',
    expectedState: 'Description of expected outcome',
    validationType: 'deterministic|ai|both'
  }
}

// test_single_node - Execute just one node for testing
{
  name: 'test_single_node',
  description: 'Test a single node and return execution result',
  parameters: {
    nodeId: 'Node ID to test'
  }
}

// get_execution_result - Get detailed execution info
{
  name: 'get_execution_result',
  description: 'Get execution details of the last run node',
  parameters: {
    nodeId: 'Node ID to check'
  }
}
```

### 2. Browser State Tools

```javascript
// get_dom_state - Capture current page state
{
  name: 'get_dom_state',
  description: 'Capture current DOM state for comparison',
  parameters: {
    selectors: 'Array of selectors to check'
  }
}

// checkpoint - Human confirmation point
{
  name: 'checkpoint',
  description: 'Create a human confirmation checkpoint',
  parameters: {
    message: 'Message to show human',
    continueOnApproval: 'boolean'
  }
}
```

## Example: Gmail Login Flow with New Approach

Here's how the new incremental approach works in practice:

### Phase 1: Initial Planning

```
DIRECTOR: "I'll build a Gmail login flow. Let me start by understanding what we need to do."

create_todo_list:
1. Scout Gmail login flow
2. Build & validate navigation to Gmail
3. Build & validate login button click
4. Build & validate email entry
5. Build & validate password entry
6. Confirm successful login
```

### Phase 2: Scout Deployment

```
DIRECTOR: "First, I'll deploy a Scout to explore the Gmail login process."

deploy_scout({
  mission: "Explore Gmail login flow from gmail.com to successful inbox access",
  objectives: [
    "Document each step with exact selectors",
    "Test selector stability",
    "Identify any conditional flows (2FA, captcha)",
    "Measure load times between steps"
  ],
  credentials: {
    email: "{{GMAIL_EMAIL}}",
    password: "{{GMAIL_PASSWORD}}"
  }
})

SCOUT REPORT:
"I successfully completed the Gmail login flow. Here are my findings:

1. Initial Navigation:
   - URL: https://mail.google.com
   - Redirects to: https://accounts.google.com/signin
   - Key indicator: Sign in button present

2. Email Entry:
   - Selectors tested (all work):
     - #identifierId (most stable)
     - input[type="email"]
     - [autocomplete="username"]
   - Next button: #identifierNext

3. Password Entry:
   - Wait needed: ~800ms for password field
   - Selectors:
     - input[type="password"] (best)
     - [name="password"]
   - Next button: #passwordNext

4. Success Indicators:
   - URL contains: mail.google.com/mail/u/0
   - DOM element: [aria-label="Search mail"]
   - Load time: ~2-3 seconds

No 2FA or captcha encountered with these credentials."
```

### Phase 3: Incremental Building

```
DIRECTOR: "Based on Scout findings, I'll build the first node - navigation to Gmail."

// Store credentials first
create_node({
  type: "context",
  config: {
    operation: "set",
    key: "gmail_creds",
    value: {
      email: "{{GMAIL_EMAIL}}",
      password: "{{GMAIL_PASSWORD}}"
    }
  },
  description: "Store Gmail credentials"
})

// Navigate to Gmail
create_node({
  type: "browser_action",
  config: {
    action: "navigate",
    url: "https://mail.google.com"
  },
  description: "Navigate to Gmail"
})

// Validate navigation
create_node({
  type: "browser_query",
  config: {
    method: "extract",
    instruction: "Check if we're on the Gmail sign-in page",
    schema: {
      isSignInPage: "boolean",
      hasEmailField: "boolean",
      pageUrl: "string"
    }
  },
  description: "Validate Gmail navigation"
})

DIRECTOR: "Let me test these first three nodes before continuing."

test_single_node({nodeId: "node3"})

VALIDATION RESULT:
{
  isSignInPage: true,
  hasEmailField: true,
  pageUrl: "https://accounts.google.com/signin/v2/identifier"
}

DIRECTOR: "Perfect! Navigation successful. The redirect to accounts.google.com is expected. Now I'll build the email entry."

// Enter email
create_node({
  type: "browser_action",
  config: {
    action: "type",
    selector: "#identifierId",
    text: "{{gmail_creds.email}}"
  },
  description: "Enter email address"
})

// Click next
create_node({
  type: "browser_action",
  config: {
    action: "click",
    selector: "#identifierNext"
  },
  description: "Click Next after email"
})

// Validate email entry
create_node({
  type: "browser_query",
  config: {
    method: "extract",
    instruction: "Check if password field is now visible",
    schema: {
      hasPasswordField: "boolean",
      hasError: "boolean",
      errorMessage: "string"
    }
  },
  description: "Validate email accepted"
})

test_single_node({nodeId: "node6"})

VALIDATION RESULT:
{
  hasPasswordField: true,
  hasError: false,
  errorMessage: null
}

DIRECTOR: "Email entry successful. Continuing with password entry..."

[Process continues node by node with validation after each step]
```

## Implementation Roadmap

### Phase 1: Core Tools (Week 1)
1. **validation_node tool** - Enable validation checks
2. **test_single_node tool** - Test individual nodes
3. **get_execution_result tool** - Retrieve execution details
4. **Update Director prompt** - Add methodology section

### Phase 2: Enhanced Feedback (Week 2)
1. **get_dom_state tool** - Capture page states
2. **checkpoint tool** - Human confirmation points
3. **Execution history tracking** - Store all attempts
4. **Pattern learning system** - Start collecting successful patterns

### Phase 3: Advanced Features (Week 3-4)
1. **Scout integration improvements** - Better selector recommendations
2. **Failure analysis system** - Learn from common failures
3. **Workflow templates** - Reusable patterns for common tasks
4. **Performance optimization** - Batch similar operations

## Success Metrics

### Immediate Success Indicators
- Node success rate > 90% on first attempt
- Reduced debugging time by 75%
- Clear understanding of failure causes
- Faster workflow completion

### Long-term Success Indicators
- Pattern library grows automatically
- Director suggests proven solutions
- Failure patterns are recognized early
- Workflow quality improves over time

## Migration Strategy

### For Existing Workflows
1. Keep existing workflows functional
2. New workflows use new methodology
3. Gradually update old workflows when modified
4. Track improvement metrics

### For Director Training
1. Update system prompt immediately
2. Add new tools incrementally
3. Monitor Director's adaptation
4. Adjust based on usage patterns

## Conclusion

The Director 2.0 approach transforms workflow building from a "hope it works" model to a "know it works" model. By building incrementally with immediate validation, we ensure robust, reliable automations while simultaneously building a knowledge base of what works.

This isn't just about building better workflows - it's about building a system that learns and improves with every workflow it creates.

<function_calls>
<invoke name="TodoWrite">
<parameter name="todos">[{"id": "1", "content": "Create a validation_node tool that runs a browser_query to check node success", "status": "in_progress", "priority": "high"}, {"id": "2", "content": "Add get_dom_state tool to capture before/after DOM snapshots", "status": "pending", "priority": "high"}, {"id": "3", "content": "Create test_single_node tool that executes just one node for validation", "status": "pending", "priority": "high"}, {"id": "4", "content": "Add get_execution_result tool to retrieve node execution details", "status": "pending", "priority": "medium"}, {"id": "5", "content": "Implement checkpoint tool for human confirmation points", "status": "pending", "priority": "medium"}, {"id": "6", "content": "Create clear_browser_state tool for fresh starts between chunks", "status": "pending", "priority": "medium"}, {"id": "7", "content": "Rewrite Director system prompt with new methodology", "status": "pending", "priority": "high"}]