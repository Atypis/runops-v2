# Operator Manual: Essential Primitive Reference

This manual documents the essential primitives that form the irreducible core of the workflow automation system. Every primitive listed here is necessary to express common patterns currently running in production.

## Overview

The system is built on **9 essential primitives** organized into 6 categories. These primitives compose like LEGO blocks to create any browser automation workflow.

**Note**: The system follows the "9 canonical primitives" philosophy. The `wait` functionality is implemented as part of `browser_action` to maintain simplicity.

## Architecture: How Primitives Use StageHand

The primitives are built on top of **StageHand**, which provides AI-powered browser automation:

1. **StageHand Core Methods**:
   - `act()` - Natural language actions ("click on Next button")
   - `extract()` - AI-powered data extraction with Zod schemas
   - `observe()` - Find interactive elements on the page
   - `goto()` - Enhanced navigation with captcha solving

2. **Our Primitive Layer**:
   - Wraps StageHand methods with consistent interfaces
   - Converts simple schemas to Zod for `extract()`
   - Manages state automatically
   - Provides error handling and logging

3. **Key Design Decision**: 
   - We only accept simple JSON schemas (`{"field": "type"}`)
   - These get converted to Zod schemas internally (StageHand requirement)
   - No eval(), no security risks, no Zod syntax to learn
   - Simple is better than complex

---

## 1. Cognition – "Think"

### `cognition`
AI-powered reasoning without side effects. Processes information and returns insights.

**Current Implementation Status:** ✅ Fully implemented with schema validation  
**Implementation Location:** `/test-harness/workflows/executor/primitives.js` (lines 227-369)

**Configuration:**
```javascript
{
  "type": "cognition",
  "prompt": "what the AI should do with the data",  // REQUIRED
  "input": "$.state.dataPath",   // Optional: data to process
  "output": "$.state.resultPath", // Optional: where to store result
  "schema": { ... }               // Optional: JSON schema for validation
}
```

**Note:** The `task` field shown in some examples is not used in implementation. Only `prompt` is required.

**Schema Validation (NEW):**
When a schema is provided, the AI response is validated and retried once if it doesn't match. Simple type checking is supported.

**Examples:**
```javascript
// Classify emails with schema validation
{
  "type": "cognition",
  "prompt": "Classify these email subjects as investor-related or not",
  "input": "$.emails",
  "output": "$.classifications",
  "schema": {
    "classifications": "array"  // Simple type validation
  }
}

// Extract structured data with validation
{
  "type": "cognition",
  "prompt": "Extract investor details from this email",
  "input": "$.emailContent",
  "output": "$.investorInfo",
  "schema": {
    "investorName": "string",
    "company": "string",
    "interested": "boolean"
  }
}

// Make a decision (no schema needed)
{
  "type": "cognition",
  "prompt": "Should we proceed with this investor based on their email?",
  "input": "$.currentEmail",
  "output": "$.decision"
}
```

**Implementation Details:**
- Uses OpenAI GPT-4o-mini by default (configurable in code, not by operator)
- Temperature set to 0.3 for consistency
- Robust JSON parsing with multiple fallbacks
- Automatic retry with feedback if schema validation fails
- Integrates with StateManager for input/output resolution

**When to use:**
- Classification and categorization
- Content summarization  
- Decision making based on complex criteria
- Generating responses or content
- Any task requiring understanding or reasoning
- When you need guaranteed output structure (use schema)

---

## 2. Observation & Extraction – "Read the World"

### `browser_query.extract`
Extract structured data from the current page using AI.

**Current Implementation Status:** ✅ Fully implemented  
**Implementation Location:** `/test-harness/workflows/executor/primitives/browser-query.js`

**Under the Hood:**
- Uses StageHand's `extract()` method which requires a **Zod schema**
- Our implementation accepts simple JSON schemas and converts them to Zod
- StageHand uses AI (GPT-4) to find and extract data matching your schema
- The schema ensures type-safe, structured responses

**Configuration:**
```javascript
{
  "type": "browser_query",
  "method": "extract",
  "instruction": "what to extract",
  "schema": { ... }  // Optional: simplified schema (gets converted to Zod)
}
```

**Schema Format:**
Simple JSON format: `{"fieldName": "type"}`

Supported types: `"string"`, `"number"`, `"boolean"`, `"array"`

**Examples:**
```javascript
// Extract all email subjects
{
  "type": "browser_query",
  "method": "extract",
  "instruction": "Get all email subjects from the inbox",
  "schema": { "subjects": "array" }
}
// This gets converted to: z.object({ subjects: z.array(z.any()) })

// Extract structured data
{
  "type": "browser_query",
  "method": "extract",
  "instruction": "Get sender name and email from the current email",
  "schema": {
    "senderName": "string",
    "senderEmail": "string"
  }
}
// This gets converted to: z.object({ senderName: z.string(), senderEmail: z.string() })
```

### `browser_query.observe`
Returns information about interactive elements on the page.

**Current Implementation Status:** ✅ Fully implemented (was missing from operator prompt - now fixed)

**Configuration:**
```javascript
{
  "type": "browser_query",
  "method": "observe",
  "instruction": "what to look for"
}
```

**Example:**
```javascript
// Find all clickable elements
{
  "type": "browser_query",
  "method": "observe",
  "instruction": "Find all buttons and links on this page"
}
```

**When to use browser_query:**
- Reading data from pages
- Checking element existence
- Gathering information before actions
- Understanding page structure

---

## 3. Action – "Change the World"

### `browser_action`
All side-effectful browser operations.

**Current Implementation Status:** ✅ Fully implemented  
**Implementation Location:** `/test-harness/workflows/executor/primitives/browser-action.js`

**Under the Hood:**
- **Navigate**: Uses Playwright's `goto()` with network idle waiting
- **Click/Type**: Uses StageHand's `act()` method for AI-powered interaction
  - Accepts natural language targets like "click on the Next button"
  - Falls back to CSS selectors when precise targeting needed
- **Tab Management**: Uses StageHand's context to create new pages with AI capabilities
- **Wait**: Simple setTimeout (should eventually move to control-flow)

#### `browser_action.goto`
Navigate to a URL.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "navigate",
  "url": "https://example.com"
}
```

#### `browser_action.click`
Click on an element.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "click",
  "selector": "CSS selector or text description"
}
```

**Examples:**
```javascript
// CSS selector
{ "action": "click", "selector": "#submit-button" }

// Natural language
{ "action": "click", "selector": "text=Next" }
```

#### `browser_action.type`
Type text into an input field.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "type",
  "selector": "CSS selector or text description",
  "text": "text to type"
}
```

#### `browser_action.wait`
Pause execution for specified time. While conceptually this could belong in Control-Flow, it fits naturally with browser actions as it's often used to wait for page elements to settle after interactions.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "wait",
  "duration": 2000  // milliseconds, default: 1000
}
```

#### `browser_action.openNewTab`
Open a new browser tab.

**Current Implementation Status:** ✅ Fully implemented (was missing from operator prompt - now fixed)

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "openNewTab",
  "url": "https://example.com",  // Optional initial URL
  "name": "airtable"             // Optional: name for the tab
}
```

#### `browser_action.switchTab`
Switch to a different browser tab.

**Current Implementation Status:** ✅ Fully implemented (was missing from operator prompt - now fixed)

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "switchTab",
  "tabName": "airtable"  // Tab name (use the name from openNewTab)
}
```

#### `browser_action.back`
Navigate back in browser history.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "back"
}
```

#### `browser_action.forward`
Navigate forward in browser history.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "forward"
}
```

#### `browser_action.refresh`
Refresh/reload the current page.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "refresh"
}
```

#### `browser_action.screenshot`
Take a screenshot of the page or specific element.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "screenshot",
  "selector": "CSS selector",  // Optional: screenshot specific element
  "path": "screenshot.png",    // Optional: file path
  "fullPage": true             // Optional: capture full page (default: true)
}
```

#### `browser_action.listTabs`
Get information about all open tabs.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "listTabs"
}
```

**Returns:**
```javascript
{
  "success": true,
  "tabs": [
    {"name": "main", "url": "https://gmail.com", "isActive": true},
    {"name": "airtable", "url": "https://airtable.com", "isActive": false}
  ]
}
```

#### `browser_action.getCurrentTab`
Get information about the currently active tab.

**Configuration:**
```javascript
{
  "type": "browser_action",
  "action": "getCurrentTab"
}
```

**When to use browser_action:**
- Any interaction that changes the page state
- Navigation between pages and browser history
- Form interactions
- Multi-tab workflows
- Taking screenshots for documentation or debugging
- Querying browser state

---

## 4. Transform – "Pure Data Work"

### `transform`
Pure JavaScript data manipulation. No side effects, deterministic results.

**Current Implementation Status:** ✅ Implemented (with eval() - needs sandboxing in production)  
**Implementation Location:** `/test-harness/workflows/executor/primitives/transform.js`

**⚠️ SECURITY NOTE**: Currently uses eval() for function execution. Safe for development/dog-fooding but needs proper sandboxing for production use.

**Configuration:**
```javascript
{
  "type": "transform",
  "input": "state.sourcePath",        // Single input or array of inputs
  "function": "data => transformation", // JavaScript function as string
  "output": "state.targetPath"         // Where to store result
}
```

**Examples:**
```javascript
// Filter investor emails
{
  "type": "transform",
  "input": "state.classifiedEmails",
  "function": "emails => emails.filter(e => e.isInvestor === true)",
  "output": "state.investorEmails"
}

// Format data
{
  "type": "transform",
  "input": "state.rawContacts",
  "function": "data => data.map(item => ({ name: item.fullName, email: item.emailAddress }))",
  "output": "state.formattedContacts"
}

// Multiple inputs example
{
  "type": "transform",
  "input": ["state.firstName", "state.lastName"],
  "function": "(first, last) => `${first} ${last}`",
  "output": "state.fullName"
}

// Reduce example
{
  "type": "transform",
  "input": "state.prices",
  "function": "prices => prices.reduce((total, price) => total + price, 0)",
  "output": "state.totalPrice"
}
```

**When to use:**
- Data filtering and mapping
- Format conversions
- String manipulations
- Array/object operations
- Any pure data transformation

---

## 5. Control-Flow – "Orchestrate"

**Note**: Workflows execute sequentially by default. Control-flow primitives are only needed when you want to change this default behavior (loops, conditionals, error handling).

### `iterate`
Loop over a collection with proper variable scoping.

**Current Implementation Status:** ✅ Fully implemented with enhancements  
**Implementation Location:** `/test-harness/workflows/executor/primitives/iterate.js`

**How Iterate Gets Its Data:**
The `over` parameter references arrays stored in state by previous nodes:
1. **From browser_query**: Extract lists from web pages → stored to state → iterate
2. **From transform**: Filter/map data → output to state → iterate  
3. **From cognition**: AI categorization → output arrays to state → iterate
4. **From context**: Previously stored arrays in state

**Configuration:**
```javascript
{
  "type": "iterate",
  "over": "state.collection",      // Path to array in state (no $ prefix)
  "variable": "currentItem",       // Name for current item
  "body": node or [nodes],         // Single node or array of nodes
  "index": "currentIndex",         // Optional: name for index (default: variableIndex)
  "continueOnError": true,         // Optional: continue if item fails (default: true)
  "limit": 10                      // Optional: process only first N items
}
```

**Available Variables During Iteration:**
- `state.[variable]` - Current item being processed
- `state.[index]` - Current index (0-based)
- `state.[variable]Total` - Total number of items in collection

**Examples:**
```javascript
// Process each email with single action
{
  "type": "iterate",
  "over": "state.emails",
  "variable": "email",
  "body": {
    "type": "browser_action",
    "action": "click",
    "selector": "state.email.selector"
  }
}

// Multiple steps per item (array body)
{
  "type": "iterate",
  "over": "state.investorEmails",
  "variable": "email",
  "index": "emailNum",
  "body": [
    {"type": "browser_action", "action": "click", "selector": "state.email.link"},
    {"type": "browser_query", "method": "extract", "instruction": "Get email content"},
    {"type": "cognition", "prompt": "Summarize this email", "input": "state.lastExtract", "output": "state.summary"},
    {"type": "context", "operation": "set", "key": "processedEmails", "value": "state.emailNum"}
  ]
}

// Stop on first error
{
  "type": "iterate",
  "over": "state.criticalTasks",
  "variable": "task",
  "continueOnError": false,
  "body": {"type": "browser_action", "action": "click", "selector": "state.task.button"}
}

// Process only first 5 items
{
  "type": "iterate",
  "over": "state.searchResults",
  "variable": "result",
  "limit": 5,
  "body": {"type": "browser_query", "method": "extract", "instruction": "Get result details"}
}
```

**Return Value:**
```javascript
{
  "results": [/* array of results from each iteration */],
  "errors": [/* array of any errors that occurred */],
  "processed": 5,  // Number of items actually processed
  "total": 10      // Total number of items in collection
}
```

### `route`
Multi-way branching based on conditions. Supports two formats for different use cases.

**Current Implementation Status:** ✅ Fully implemented with both formats  
**Implementation Location:** `/test-harness/workflows/executor/primitives/route.js`

#### Option 1: Simple Value Routing
Best for switch-like statements where you're checking a single value against multiple options.

**Configuration:**
```javascript
{
  "type": "route",
  "value": "state.emailType",  // Path to value to check
  "paths": {
    "investor": node_or_array,    // Path for when value === "investor"
    "customer": node_or_array,    // Path for when value === "customer"
    "default": node_or_array      // Fallback path (optional)
  }
}
```

**Example:**
```javascript
// Route emails by type
{
  "type": "route",
  "value": "state.emailType",
  "paths": {
    "investor": {"type": "cognition", "prompt": "Process investor email"},
    "customer": {"type": "browser_action", "action": "click", "selector": "#customer-flow"},
    "spam": {"type": "context", "operation": "set", "key": "spamCount", "value": 1},
    "default": {"type": "cognition", "prompt": "Unknown email type, analyze further"}
  }
}
```

#### Option 2: Condition-Based Routing
Best for complex conditions with different operators.

**Configuration:**
```javascript
{
  "type": "route",
  "conditions": [
    {
      "path": "state.value",      // Path to value to check (no $ prefix)
      "operator": "equals" | "contains" | "exists" | "greater" | "less" | "notEquals" | "matches",
      "value": "expected",        // Value to compare against (not needed for "exists")
      "branch": node_or_array     // Node(s) to execute if condition is true
    }
  ],
  "default": node_or_array        // Fallback if no conditions match (optional)
}
```

**Available Operators:**
- `equals` - Exact match (===)
- `notEquals` - Not equal (!==)
- `contains` - String contains substring
- `exists` - Value is not null, undefined, or empty string
- `greater` - Numeric comparison (>)
- `less` - Numeric comparison (<)
- `greaterOrEqual` - Numeric comparison (>=)
- `lessOrEqual` - Numeric comparison (<=)
- `matches` - Regular expression match

**Examples:**
```javascript
// Multiple conditions with different operators
{
  "type": "route",
  "conditions": [
    {
      "path": "state.priority",
      "operator": "equals",
      "value": "high",
      "branch": {"type": "browser_action", "action": "click", "selector": "#urgent"}
    },
    {
      "path": "state.emailCount",
      "operator": "greater",
      "value": 10,
      "branch": {"type": "cognition", "prompt": "Too many emails, batch process"}
    },
    {
      "path": "state.subject",
      "operator": "matches",
      "value": "\\b(urgent|asap|critical)\\b",
      "branch": {"type": "context", "operation": "set", "key": "isUrgent", "value": true}
    }
  ],
  "default": {"type": "wait", "duration": 1000}
}

// Check if value exists
{
  "type": "route",
  "conditions": [
    {
      "path": "state.investorEmail",
      "operator": "exists",
      "branch": {"type": "browser_action", "action": "navigate", "url": "https://crm.example.com"}
    }
  ],
  "default": {"type": "cognition", "prompt": "No investor email found"}
}
```

**When to use each format:**
- Use **simple value routing** when checking one value against multiple exact matches
- Use **condition-based routing** when you need complex comparisons, multiple conditions, or different operators

### Future Control-Flow Primitives
**Conditional Wait**: In the future, we might add advanced waiting capabilities like:
- Wait for element to appear/disappear
- Wait for network idle
- Wait for custom conditions
- Wait with timeout and early exit

For now, use `browser_action.wait` for simple delays.

### `handle`
Error boundaries with recovery strategies.

**Configuration:**
```javascript
{
  "type": "handle",
  "try": "node_that_might_fail",
  "catch": "error_recovery_node",     // Optional
  "finally": "cleanup_node"           // Optional
}
```

**Example:**
```javascript
// Handle login with 2FA fallback
{
  "type": "handle",
  "try": "standard_login_sequence",
  "catch": "handle_2fa_flow",
  "finally": "verify_logged_in"
}
```

**When to use control-flow:**
- Sequencing operations
- Iterating over collections
- Conditional logic
- Error handling and recovery
- Timing control

---

## 6. Context / State – "Execution Context"

### `context.set`
Explicitly store data in workflow context.

**Configuration:**
```javascript
{
  "type": "context",
  "operation": "set",
  "key": "variable_name",
  "value": { ... }  // Any JSON-serializable data
}
```

### `context.get`
Retrieve data from workflow context.

**Configuration:**
```javascript
{
  "type": "context",
  "operation": "get",
  "key": "variable_name"
}
```

### `context.clear`
Remove data from workflow context.

**Configuration:**
```javascript
{
  "type": "context",
  "operation": "clear",
  "key": "variable_name"  // Or array of keys
}
```

### `context.merge`
Merge new data with existing context.

**Configuration:**
```javascript
{
  "type": "context",
  "operation": "merge",
  "key": "variable_name",
  "value": { ... }  // Will be merged with existing value
}
```

**Examples:**
```javascript
// Store credentials
{
  "type": "context",
  "operation": "set",
  "key": "gmail_credentials",
  "value": {
    "email": "user@gmail.com",
    "password": "secure_password"
  }
}

// Update counter
{
  "type": "context",
  "operation": "set",
  "key": "processed_count",
  "value": 5
}
```

**When to use context:**
- Explicitly storing credentials or configuration
- Tracking progress across workflow execution
- Overriding auto-populated values
- Managing workflow-wide settings

**Remember:** Many nodes auto-populate context:
- `browser_query` stores extracted data
- `iterate` creates iteration variables
- `handle` stores error information
- Use this node only when you need explicit control

---

## Implementation Gaps Summary

1. **Fixed issues (previously missing from operator prompt):**
   - ✅ `browser_action.openNewTab` - Now documented
   - ✅ `browser_action.switchTab` - Now documented
   - ✅ `browser_query.observe` - Now documented
   - ✅ `browser_query` parameters - Fixed critical mismatch

2. **Still missing from operator prompt:**
   - Better document context auto-population
   - Clarify that `get` operation supports arrays

3. **Design decisions:**
   - `wait` is implemented as part of `browser_action` for simplicity and practical use

4. **Fully implemented primitives:**
   - ✅ `cognition` - Including new schema validation feature
   - ✅ `browser_query` - Both extract and observe methods
   - ✅ `browser_action` - All methods including tab operations

---

## Best Practices

1. **Use the right primitive for the job:**
   - Observation for reading without side effects
   - Action only when changing state
   - Transform for pure data operations

2. **Compose small, focused nodes:**
   - Each node should do one thing well
   - Use sequence to combine operations
   - Name nodes descriptively

3. **Handle errors gracefully:**
   - Wrap risky operations in handle nodes
   - Provide meaningful recovery flows
   - Always verify critical operations

4. **Manage state carefully:**
   - Store only necessary data
   - Clear sensitive information after use
   - Use descriptive key names

5. **Think in patterns:**
   - Login flows are sequential steps with error handling
   - List processing uses iterate
   - Decisions use route with clear branches

---

## Common Patterns

### Login Flow
```javascript
// Workflows are arrays that execute sequentially by default
[
  {type: "context", operation: "set", key: "credentials", value: {...}},
  {type: "browser_action", action: "goto", url: "https://login.example.com"},
  {type: "browser_action", action: "type", selector: "#email", text: "user@example.com"},
  {type: "browser_action", action: "click", selector: "#next"},
  {type: "handle", 
    try: {type: "browser_action", action: "type", selector: "#password", text: "***"},
    catch: {type: "browser_action", action: "click", selector: "#use-2fa"}
  }
]
```

### Process List
```javascript
{
  type: "iterate",
  over: "state.items",
  variable: "currentItem",
  // The body is an array that executes sequentially
  body: [
    {type: "browser_action", action: "click", selector: "state.currentItem.selector"},
    {type: "browser_query", method: "extract", instruction: "Get item details"},
    {type: "cognition", prompt: "Analyze this item", input: "state.lastExtract"},
    {type: "route", value: "state.lastResult.category", paths: {...}}
  ]
}
```

### Safe Navigation
```javascript
{
  type: "handle",
  // Try block is an array that executes sequentially
  try: [
    {type: "browser_action", action: "goto", url: "https://example.com"},
    {type: "browser_action", action: "wait", duration: 2000},
    {type: "browser_query", method: "extract", instruction: "Get required element"}
  ],
  catch: {type: "browser_action", action: "refresh"}
}
```

---

*This manual documents the essential primitive stack. Additional primitives (parallel execution, checkpoints, logging) may be added as the system evolves.*