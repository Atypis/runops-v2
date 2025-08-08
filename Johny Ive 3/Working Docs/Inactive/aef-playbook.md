# AEF Playbook: Drafting SOP Flows

*A comprehensive guide to building bulletproof automation workflows with the Agentic Execution Framework*

---

## 1. What is This? Why?

### What is AEF?

The **Agentic Execution Framework (AEF)** is a sophisticated automation system that combines:
- **JSON-based workflow definitions** for complex multi-step processes
- **AI-powered browser automation** via Stagehand for intelligent web interactions
- **Bulletproof execution patterns** with error handling, retries, and state management
- **Hybrid action mapping** that falls back gracefully between different automation approaches

### Why Use AEF?

**Traditional automation breaks easily.** Websites change, selectors fail, timing issues occur. AEF solves this by:

1. **AI-First Approach**: Uses vision and natural language instructions instead of brittle selectors
2. **Graceful Degradation**: Multiple fallback strategies for every action
3. **State Management**: Tracks execution state, handles loops, manages memory
4. **Bulletproof Patterns**: Built-in retry logic, circuit breakers, and error recovery
5. **Composable Workflows**: Reusable nodes that can be combined into complex flows

### When to Use AEF

✅ **Perfect for:**
- Complex multi-step business processes (CRM updates, data migration, etc.)
- Web automation that needs to be reliable across UI changes
- Workflows involving multiple systems/websites
- Processes requiring human checkpoints and approvals
- Batch operations with error handling and recovery

❌ **Not ideal for:**
- Simple one-off scripts
- Real-time/low-latency operations
- Processes that don't involve web interfaces

---

## 2. Node Types

### 2.1 Stagehand Native Node Types

#### `atomic_task`
**What it is:** A single, indivisible unit of work containing multiple sequential actions.

**What it does:** Executes all actions in sequence. If any action fails, the entire node fails.

**Example:**
```json
{
  "id": "gmail_search_today",
  "type": "atomic_task",
  "label": "Search June 2nd Test Emails",
  "intent": "Search for emails received on June 2nd (test dataset)",
  "context": "Use Gmail search with date filter to find June 2nd test emails",
  "actions": [
    {
      "type": "act",
      "instruction": "Click the Gmail search mail textbox",
      "useVision": "fallback",
      "timeout": 5000
    },
    {
      "type": "type",
      "instruction": "Enter date filter",
      "target": { "selector": "input[aria-label='Search mail']" },
      "data": { "text": "after:2025/06/01 before:2025/06/03" },
      "timeout": 7000
    }
  ]
}
```

**Tips:**
- Keep atomic tasks focused on a single logical operation
- Use descriptive `intent` and `context` fields for debugging
- Actions execute sequentially - order matters
- If one action fails, the whole node fails

#### `compound_task`
**What it is:** A container node that groups related child nodes together.

**What it does:** Can execute child nodes sequentially if `canExecuteAsGroup: true`, or serve as a logical grouping.

**Example:**
```json
{
  "id": "gmail_auth_flow",
  "type": "compound_task",
  "label": "Gmail Authentication Flow",
  "intent": "Complete Gmail login process",
  "canExecuteAsGroup": true,
  "children": [
    "navigate_to_gmail",
    "enter_email",
    "enter_password",
    "verify_login_success"
  ]
}
```

**Tips:**
- Use for logical grouping of related operations
- Set `canExecuteAsGroup: true` to auto-execute all children
- Children execute in the order listed
- Good for authentication flows, setup sequences

#### `iterative_loop`
**What it is:** Legacy loop construct (being replaced by `list_iterator`).

**What it does:** Indicates a looping structure but requires manual implementation.

**Tips:**
- Prefer `list_iterator` for new workflows
- Mainly used for backward compatibility

### 2.2 AEF Custom Node Types

#### `filter_list`
**What it is:** AI-powered batch filtering of arrays using LLM reasoning.

**What it does:** Takes an input array, applies AI filtering logic, returns a filtered array.

**Example:**
```json
{
  "id": "filter_investor_emails",
  "type": "filter_list",
  "label": "Filter Investor Emails",
  "intent": "Filter email candidates to only investor-related emails",
  "context": "Apply investor detection logic to filter relevant emails",
  "listConfig": {
    "inputKey": "extract_email_candidates_extracted_data",
    "outputKey": "investorQueue",
    "batchSize": 25,
    "promptTemplate": "You will receive an array of email metadata objects. Return a JSON boolean array of equal length where true means the email is investor-related."
  },
  "actions": []
}
```

**Tips:**
- Use for complex filtering that requires reasoning (not just simple field matching)
- Batch size of 25-50 works well for most LLMs
- Make prompt templates very specific about expected output format
- Always specify both `inputKey` and `outputKey`

#### `list_iterator`
**What it is:** Robust iteration over arrays with error handling and state management.

**What it does:** Executes child nodes for each item in an array, with circuit breaker and retry logic.

**Example:**
```json
{
  "id": "email_processing_loop",
  "type": "list_iterator",
  "label": "Process Each Investor Email",
  "intent": "Process each filtered investor email with full error handling",
  "children": [
    "select_email",
    "extract_investor_info",
    "update_crm"
  ],
  "iteratorConfig": {
    "listVariable": "investorQueue",
    "itemVariable": "currentItem",
    "indexVariable": "emailIndex",
    "continueOnError": true,
    "maxIterations": 1000
  },
  "retryPolicy": {
    "max": 5,
    "backoffMs": [0, 2000, 5000, 10000, 20000],
    "circuitBreaker": true
  }
}
```

**Tips:**
- Always set `continueOnError: true` for batch processing
- Use exponential backoff for retry delays
- Set reasonable `maxIterations` to prevent infinite loops
- Circuit breaker prevents cascading failures

#### `data_transform`
**What it is:** JavaScript-based data transformation node.

**What it does:** Applies a transformation function to data in the execution state.

**Example:**
```json
{
  "id": "data_transform_normalize",
  "type": "data_transform",
  "label": "Normalize Investor Data",
  "intent": "Clean and normalize extracted investor data",
  "transformFunction": "data => ({ ...data, phone: data.phone?.replace(/[^0-9]/g, ''), email: data.email?.toLowerCase(), hash: btoa(data.name + data.email).slice(0, 16) })"
}
```

**Tips:**
- Keep transformation functions simple and pure
- Use for data cleaning, normalization, hash generation
- Avoid complex logic - prefer separate nodes for readability

#### `decision`
**What it is:** Conditional branching based on data evaluation.

**What it does:** Evaluates conditions and determines next execution path.

**Tips:**
- Use for conditional logic in workflows
- Can evaluate data from previous nodes
- Supports multiple condition types

#### `assert`
**What it is:** Validation node that checks conditions and fails if not met.

**What it does:** Validates expected state before proceeding.

**Example:**
```json
{
  "id": "assert_email_unprocessed",
  "type": "assert",
  "label": "Assert Email Unprocessed",
  "intent": "Verify email doesn't have AEF-Processed label",
  "assertConditions": [
    {
      "type": "textPresent",
      "value": "AEF-Processed"
    }
  ]
}
```

**Tips:**
- Use for idempotency checks
- Prevents duplicate processing
- Fails fast if preconditions aren't met

#### `generator`
**What it is:** AI-powered content generation node.

**What it does:** Uses LLM to generate summaries, reports, or other content.

**Tips:**
- Good for generating summaries, reports, emails
- Specify clear output schema
- Use for final reporting steps

---

## 3. Action Types

### 3.1 Navigation Actions

#### `navigate`
**What it is:** Direct URL navigation.

**Example:**
```json
{
  "type": "navigate",
  "instruction": "Navigate to Gmail",
  "target": { "url": "https://mail.google.com" },
  "timeout": 10000
}
```

**Tips:**
- Use for initial page loads
- Always include reasonable timeouts
- Consider using `navigate_or_switch_tab` for better UX

#### `navigate_or_switch_tab`
**What it is:** Smart navigation that switches to existing tab if available.

**Example:**
```json
{
  "type": "navigate_or_switch_tab",
  "instruction": "Navigate to Airtable CRM base",
  "target": { "url": "https://airtable.com/{{airtable_base_id}}" },
  "timeout": 10000
}
```

**Tips:**
- Preferred over `navigate` for multi-tab workflows
- Reduces page load times
- Supports credential injection via `{{variable}}` syntax

### 3.2 Interaction Actions

#### `act`
**What it is:** AI-powered natural language action execution.

**Example:**
```json
{
  "type": "act",
  "instruction": "Click the Gmail search mail textbox",
  "useVision": "fallback",
  "timeout": 5000
}
```

**Tips:**
- Most flexible action type - use when selectors are unreliable
- Be specific in instructions: "Click the blue Submit button in the top right"
- Use `useVision: "fallback"` for better reliability
- Can handle complex interactions that would require multiple traditional actions

#### `click`
**What it is:** Traditional selector-based clicking.

**Example:**
```json
{
  "type": "click",
  "instruction": "Click submit button",
  "target": { "selector": "#submit-btn" },
  "timeout": 5000
}
```

**Tips:**
- Use when you have reliable selectors
- Faster than `act` but less flexible
- Falls back to `act` automatically if selector fails

#### `type`
**What it is:** Text input into form fields.

**Example:**
```json
{
  "type": "type",
  "instruction": "Enter date filter",
  "target": { "selector": "input[aria-label='Search mail']" },
  "data": { "text": "after:2025/06/01 before:2025/06/03" },
  "timeout": 7000
}
```

**Tips:**
- Don't rely on `\n` for Enter key - use separate `act` action
- Use descriptive selectors when possible
- Falls back to `act` if selector fails

### 3.3 Waiting Actions

#### `wait`
**What it is:** Wait for element to appear.

**Example:**
```json
{
  "type": "wait",
  "instruction": "Wait for loading spinner to disappear",
  "target": { "selector": ".loading-spinner" },
  "timeout": 10000
}
```

#### `wait_for_navigation`
**What it is:** Wait for URL change or page navigation.

**Example:**
```json
{
  "type": "wait_for_navigation",
  "instruction": "Wait for Gmail to load search results",
  "target": { "url_contains": "#search" },
  "timeout": 10000
}
```

**Tips:**
- Essential after form submissions
- Use `url_contains` for partial URL matching
- Set generous timeouts for slow pages

### 3.4 Data Extraction Actions

#### `extract`
**What it is:** AI-powered data extraction with structured schema.

**Example:**
```json
{
  "type": "extract",
  "instruction": "Extract investor information from email content",
  "schema": {
    "name": "string",
    "company": "string",
    "email": "string",
    "phone": "string",
    "investment_focus": "string"
  },
  "useVision": "fallback",
  "timeout": 15000
}
```

**Tips:**
- Define clear, specific schemas
- Use longer timeouts for complex extractions
- AI can extract from any visible content, not just form fields

#### `extract_list`
**What it is:** Extract multiple items with pagination support.

**Example:**
```json
{
  "type": "extract_list",
  "instruction": "Extract all email threads from Gmail search results",
  "listConfig": {
    "scrollStrategy": "auto",
    "maxItems": 100,
    "deduplication": true,
    "itemSelector": ".zA",
    "nextPageSelector": ".T-I-J3.J-J5-Ji"
  },
  "fields": {
    "threadId": "@data-thread-id",
    "subject": "[data-tooltip] .bog",
    "sender": ".yW span[email]",
    "snippet": ".y2",
    "date": ".xY span"
  }
}
```

**Tips:**
- Use for paginated data extraction
- Set `deduplication: true` to avoid duplicates
- `scrollStrategy: "auto"` handles infinite scroll

### 3.5 Utility Actions

#### `clear_memory`
**What it is:** Clears Stagehand's conversation memory.

**Example:**
```json
{
  "type": "clear_memory",
  "instruction": "Clear Stagehand conversation memory",
  "timeout": 1000
}
```

**Tips:**
- Use in loops to prevent token bloat
- Essential for long-running workflows
- Place at end of loop iterations

---

## 4. Insights & Best Practices

### 4.1 Action Sequencing Insights

#### The Enter Key Problem
**Issue:** Using `\n` in `type` actions doesn't reliably trigger form submissions.

**Solution:** Always use a separate `act` action to press Enter:
```json
{
  "type": "type",
  "data": { "text": "search query" }
},
{
  "type": "act",
  "instruction": "Press Enter to execute the search"
}
```

**Why:** Different websites handle newline characters differently. An explicit Enter action is more reliable.

#### Early Return Bug
**Issue:** Action handlers with `return result;` statements cause premature exit from action loops.

**Solution:** Remove `return` statements from action handlers unless they're the final action.

**Why:** The ExecutionEngine processes actions sequentially in a loop. Early returns break the loop.

### 4.2 Workflow Design Insights

#### Node ID and Flow Consistency
**Issue:** Changing node IDs without updating flow references breaks workflow execution.

**Solution:** Always update both the node definition AND all flow references:
```json
// Node definition
{ "id": "new_node_name", ... }

// Flow references
{ "from": "previous_node", "to": "new_node_name" },
{ "from": "new_node_name", "to": "next_node" }
```

**Why:** Flow references are like foreign keys - they must match exactly.

#### Caching Gotchas
**Issue:** Changes to workflow files don't appear in frontend due to multi-layer caching.

**Root Cause:** 
- Server-side cache in `ServerWorkflowLoader`
- Client-side cache in `WorkflowLoader`
- Browser HTTP caching

**Solution:**
1. Enable file watching in development (auto-clears server cache)
2. Add cache-busting timestamps to API requests
3. Bypass client cache in development mode
4. Use hard refresh (Ctrl+Shift+R) when in doubt

### 4.3 Error Handling Insights

#### Timeout Strategy
**Best Practice:** Use progressive timeouts based on action complexity:
- Simple clicks: 5000ms
- Form inputs: 7000ms
- Page navigation: 10000ms
- Data extraction: 15000ms
- Complex AI operations: 30000ms

#### Fallback Patterns
**Best Practice:** Always provide fallback instructions for `act` actions:
```json
{
  "type": "act",
  "instruction": "Click the blue Submit button in the top-right corner of the form",
  "useVision": "fallback"
}
```

**Why:** Specific instructions help AI when visual recognition is needed.

### 4.4 Performance Insights

#### Batch Size Optimization
**For `filter_list` operations:**
- Small batches (10-25): Better error isolation, slower overall
- Large batches (50-100): Faster overall, harder to debug failures
- Sweet spot: 25-50 items per batch

#### Memory Management
**Best Practice:** Clear Stagehand memory in loops:
```json
{
  "type": "clear_memory",
  "instruction": "Clear Stagehand conversation memory"
}
```

**Why:** Prevents token limit issues in long-running workflows.

### 4.5 Debugging Insights

#### Logging Strategy
**Best Practice:** Use descriptive `intent` and `context` fields:
```json
{
  "intent": "Search for emails received on June 2nd (test dataset)",
  "context": "Use Gmail search with date filter to find June 2nd test emails"
}
```

**Why:** Makes logs much easier to understand during debugging.

#### State Inspection
**Best Practice:** Use `extract` actions to capture intermediate state:
```json
{
  "type": "extract",
  "instruction": "Capture current page state for debugging",
  "schema": {
    "currentUrl": "string",
    "visibleText": "string",
    "errorMessages": "array"
  }
}
```

### 4.6 Authentication Insights

#### Credential Injection
**Best Practice:** Use variable substitution for sensitive data:
```json
{
  "data": { "email": "{{gmail_email}}" },
  "credentialField": "gmail_email"
}
```

**Why:** Keeps credentials out of workflow definitions.

#### Multi-Step Auth
**Best Practice:** Break authentication into atomic steps:
1. Navigate to login page
2. Enter email
3. Click next
4. Handle 2FA if present
5. Enter password
6. Verify success

**Why:** Easier to debug and handle different auth flows.

---

## 5. Common Patterns

### 5.1 The Search Pattern
```json
[
  { "type": "act", "instruction": "Click search box" },
  { "type": "type", "data": { "text": "search query" } },
  { "type": "act", "instruction": "Press Enter to search" },
  { "type": "wait_for_navigation", "target": { "url_contains": "search" } }
]
```

### 5.2 The Extract-Filter-Process Pattern
```json
[
  { "type": "extract_list", "instruction": "Extract all items" },
  { "type": "filter_list", "listConfig": { "promptTemplate": "Filter logic" } },
  { "type": "list_iterator", "children": ["process_item"] }
]
```

### 5.3 The Idempotency Pattern
```json
[
  { "type": "assert", "assertConditions": [{ "type": "textPresent", "value": "PROCESSED" }] },
  { "type": "atomic_task", "actions": ["do_work"] },
  { "type": "act", "instruction": "Mark as PROCESSED" }
]
```

---

## 6. Troubleshooting Guide

### Common Issues

1. **Node not executing:** Check flow references match node IDs exactly
2. **Actions stopping early:** Remove `return` statements from action handlers
3. **Changes not appearing:** Clear caches, restart dev server
4. **Timeouts:** Increase timeout values, check network conditions
5. **Authentication failures:** Verify credential injection, check auth flow steps

### Debug Checklist

- [ ] Node IDs match flow references
- [ ] All required fields present in node definitions
- [ ] Timeouts appropriate for action complexity
- [ ] Credentials properly configured
- [ ] Cache cleared after changes
- [ ] Server logs checked for errors

---

*This playbook is a living document. Add new insights and patterns as you discover them!* 