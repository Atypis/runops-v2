# Browser Inspection Functions Documentation

## Overview

The browser inspection suite provides Director 2.0 with "eyes" to understand and interact with web pages. This group consists of three complementary functions that work together to enable intelligent browser automation.

## Function Group: Browser Inspection (3 functions)

### 1. inspect_tab - Get page overview

**Purpose**: Provides a context-efficient overview of the page structure using the accessibility tree.

**When to use**:
- Initial page reconnaissance
- After navigation to understand new page state
- When you need element IDs for detailed inspection
- To verify page has loaded expected content

**Parameters**:
```javascript
{
  tabName: string,              // Tab to inspect (default: active tab)
  inspectionType: string,       // "dom_snapshot" or "lightweight_exploration"
  instruction: string           // Optional: for lightweight exploration mode
}
```

**Returns**:
- Numbered accessibility tree with element roles and names
- Element IDs for use with expand_dom_selector
- ~10k tokens of structured page data

**Example**:
```javascript
inspect_tab({
  tabName: "main",
  inspectionType: "dom_snapshot"
})
```

**Output format**:
```
Page Title: Example Page
URL: https://example.com

[1] banner
  [2] heading "Welcome"
  [3] navigation
    [4] link "Home"
    [5] link "About"
[6] main
  [7] form
    [8] textbox "Email" (name="email")
    [9] button "Submit"
```

### 2. expand_dom_selector - Get detailed element info

**Purpose**: Surgical inspection of specific elements to extract all DOM attributes and generate stable selectors.

**When to use**:
- After inspect_tab to get selector options for specific elements
- When a selector fails and you need alternatives
- To understand element attributes and state
- To find the most stable selector for an element

**Prerequisites**:
- Must call inspect_tab first (uses cached DOM data)

**Parameters**:
```javascript
{
  tabName: string,              // Tab containing the element
  elementId: string             // Element ID from inspect_tab (e.g., "127")
}
```

**Returns**:
- Complete DOM attributes (all attributes, no filtering)
- Multiple selector suggestions ordered by stability
- Parent-child hierarchy for context

**Example**:
```javascript
expand_dom_selector({
  tabName: "main",
  elementId: "127"
})
```

**Output format**:
```
Element Details for ID 127:

DOM Attributes:
- id: "submit-btn"
- class: "primary-button form-submit"
- type: "submit"
- data-testid: "checkout-submit"
- aria-label: "Complete purchase"
- disabled: "false"

Suggested Selectors (most stable first):
1. #submit-btn
2. [data-testid="checkout-submit"]
3. [aria-label="Complete purchase"]
4. button[type="submit"]
5. .primary-button.form-submit

Parent Context:
form#checkout-form > div.form-actions > button#submit-btn
```

### 3. send_scout - Deploy AI scout for exploration

**Purpose**: Deploy an intelligent AI agent to explore pages and answer complex questions about UI structure.

**When to use**:
- Complex exploration missions requiring reasoning
- Finding patterns across multiple elements
- Understanding dynamic UI behavior
- Investigating error states or edge cases
- Multi-tab workflows

**Parameters**:
```javascript
{
  instruction: string,          // Natural language mission description
  tabName: string              // Optional: specific tab (default: active)
}
```

**Returns**:
```javascript
{
  summary: string,             // Key findings summary
  findings: object,            // Structured mission results
  tokensUsed: number,         // Total tokens consumed
  toolCalls: number,          // Number of tool calls made
  executionLog: array         // Detailed execution history
}
```

**Example missions**:
```javascript
// Find form elements
send_scout({
  instruction: "Find all form input fields on this page, including their labels, types, and validation requirements"
})

// Test dynamic behavior
send_scout({
  instruction: "Click the 'Show More' button and describe what content appears"
})

// Multi-condition exploration
send_scout({
  instruction: "Find the login form. Check if it has: email field, password field, remember me checkbox, and forgot password link"
})
```

## Architecture and Implementation

### Token Efficiency
- **inspect_tab**: ~10k tokens (vs 50k for full DOM in v1)
- **expand_dom_selector**: ~2-5k tokens per element
- **send_scout**: 20-22k tokens typical for complex missions

### Technical Stack
- **Browser Integration**: Playwright/Stagehand
- **DOM Access**: Chrome DevTools Protocol (CDP)
- **Scout LLM**: OpenAI o1-mini in isolated context
- **Caching**: In-memory DOM cache between inspect/expand calls

### State Management
- inspect_tab caches full DOM snapshot
- expand_dom_selector uses cached data (no new page access)
- Scout operates in isolated context with browser access

## Best Practices

### 1. Reconnaissance First
Always scout or inspect before building interaction nodes:
```javascript
// ❌ Bad: Guessing selectors
create_node({
  type: "browser_action",
  config: {action: "click", selector: ".submit"}
})

// ✅ Good: Scout first, then build
send_scout({instruction: "Find the submit button"})
// Then use discovered selector
```

### 2. Selector Stability Hierarchy
Prefer selectors in this order:
1. `#id` - Most stable
2. `[data-testid]`, `[data-*]` - Purpose-built for testing
3. `[aria-label]`, `[role]` - Accessibility attributes
4. `input[name]`, `button[type]` - Semantic attributes
5. `.class` - Last resort, often changes

### 3. Efficient Exploration Pattern
```javascript
// 1. Initial overview
inspect_tab({tabName: "main"})

// 2. Detailed inspection of key elements
expand_dom_selector({elementId: "42"})  // Login button
expand_dom_selector({elementId: "38"})  // Email field

// 3. Complex exploration via Scout
send_scout({
  instruction: "Test if the form validates email format and shows error messages"
})
```

### 4. Multi-Tab Workflows
```javascript
// Scout can handle tab transitions
send_scout({
  instruction: "Click 'Login with Google' and find the email field in the OAuth popup",
  tabName: "main"
})
```

### 5. Debugging Failed Selectors
When a selector fails:
```javascript
// 1. Re-inspect the page
inspect_tab({tabName: "main"})

// 2. Find the element's new ID
// 3. Get updated selectors
expand_dom_selector({elementId: "new_id"})

// 4. Update the node with stable selector
```

## Common Patterns

### Form Discovery
```javascript
send_scout({
  instruction: `Find all form inputs on this page. For each input, provide:
  - Field label or placeholder
  - Input type (text, email, password, etc)
  - name attribute
  - Required status
  - Any validation attributes`
})
```

### Dynamic Content Detection
```javascript
send_scout({
  instruction: "Check if there are any loading spinners, skeleton screens, or 'Loading...' text visible on the page"
})
```

### Error State Investigation
```javascript
send_scout({
  instruction: "Look for any error messages, warning banners, or validation errors currently displayed"
})
```

### Navigation Verification
```javascript
// After navigation
inspect_tab({tabName: "main"})
// Verify expected page loaded by checking for unique elements
```

## Evolution Notes

### From v1 to v2
- **Token Reduction**: 80% reduction through accessibility tree
- **Tool Separation**: Split monolithic observe into inspect + expand
- **Scout Addition**: New AI agent for complex exploration
- **Better Errors**: Truthful "not found" vs empty results
- **Cache Strategy**: Efficient DOM data reuse

### Future Considerations
- Lightweight exploration mode implementation
- Visual element detection integration
- Performance profiling for selector stability
- Cross-browser compatibility tracking

## Troubleshooting

### "No cached DOM data"
- Always call inspect_tab before expand_dom_selector
- Cache is per-tab, ensure same tabName

### Scout taking too long
- Break complex missions into smaller parts
- Use specific element targeting
- Limit exploration scope

### Selectors breaking
- Regular maintenance: re-scout after UI updates
- Use multiple fallback selectors
- Implement validation nodes to catch breaks early

### Token optimization
- Use inspect_tab for overview, not full details
- Target specific elements with expand_dom_selector
- Let Scout handle complex multi-step exploration