# Debug Browsing Tools - Deep Architecture Analysis

## Overview

The Debug Browsing Tools are a set of 7 specialized functions that allow interaction with the browser **without creating workflow nodes**. These tools are designed for exploration, testing, and reconnaissance - not for building persistent automations.

**Architecture Note**: In the simplified Director architecture, these debug tools are NOT exposed directly to the Director. Instead, Director uses `send_scout` exclusively for browser exploration, and the scout has access to these debug tools internally. This keeps Director's interface focused on workflow building rather than low-level browser manipulation.

## Current Architecture

### 1. Tool Set (7 Functions)

```javascript
// Navigation & Page Control
debug_navigate    - Navigate to URL without creating node
debug_wait        - Wait for time/selector without creating node

// Interaction
debug_click       - Click element without creating node  
debug_type        - Type text without creating node

// Tab Management
debug_open_tab    - Open new tab without creating node
debug_close_tab   - Close tab without creating node
debug_switch_tab  - Switch tabs without creating node
```

### 2. Implementation Pattern

All debug tools follow a consistent pattern:

```javascript
async debugToolName(args, workflowId) {
  try {
    const { 
      /* tool-specific params */,
      tabName = 'main',  // Optional tab selection
      reason             // Required audit trail
    } = args;
    
    // Get appropriate page (main or named tab)
    const stagehand = await this.nodeExecutor.getStagehand();
    let page = /* logic to get correct page */;
    
    // Perform action
    await /* tool-specific action */;
    
    // Update browser state if needed
    await this.browserStateService.updateBrowserState(...);
    
    return {
      success: true,
      /* tool-specific results */,
      reason
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

### 3. Key Design Principles

1. **No Persistence** - Actions are immediate, no workflow nodes created
2. **Audit Required** - All tools require a `reason` parameter for tracking
3. **Shared Browser State** - Use same browser instance as workflow execution
4. **Tab Awareness** - All tools support multi-tab operations via `tabName`
5. **Error Tolerance** - Return structured error responses, don't throw

## Tool Specifications

### debug_navigate
```javascript
{
  url: "https://example.com",     // Required: URL to navigate to
  tabName: "main",                // Optional: Target tab (default: "main")
  reason: "Testing login flow"     // Required: Audit trail
}
```
- Uses Playwright's `page.goto()` with `domcontentloaded` wait
- Updates browser state with new URL
- Creates tab entry if navigating to non-existent tab

### debug_click
```javascript
{
  selector: "#submit",                    // CSS selector
  // OR
  selector: "text:Submit",               // Text-based selector
  // OR  
  selector: "act:click the blue button", // Natural language
  
  tabName: "main",                       // Optional: Target tab
  reason: "Testing form submission"       // Required: Audit trail
}
```
- Supports three selector types:
  - CSS selectors (direct Playwright click)
  - `text:` prefix for text matching (uses Stagehand act)
  - `act:` prefix for natural language (uses Stagehand act)

### debug_type
```javascript
{
  selector: "#email",              // Required: CSS selector only
  text: "test@example.com",        // Required: Text to type
  tabName: "main",                 // Optional: Target tab
  reason: "Testing email input"    // Required: Audit trail
}
```
- Uses Playwright's `page.fill()` (clears existing text)
- Only supports CSS selectors (no text: or act: prefixes)
- Truncates display of long text in response (50 chars)

### debug_wait
```javascript
{
  type: "time",                    // "time" or "selector"
  value: "2000",                   // ms for time, CSS selector for selector
  tabName: "main",                 // Optional: Target tab
  reason: "Waiting for page load"  // Required: Audit trail
}
```
- Time wait: Uses `page.waitForTimeout()`
- Selector wait: Uses `page.waitForSelector()` with 30s timeout

### debug_open_tab
```javascript
{
  url: "https://example.com",      // Required: Initial URL
  tabName: "example",              // Required: Tab name
  reason: "Opening second site"    // Required: Audit trail
}
```
- Creates new page in browser context
- Stores in `nodeExecutor.stagehandPages` map
- Updates browser state with new tab
- Automatically switches to new tab

### debug_close_tab
```javascript
{
  tabName: "example",              // Required: Tab to close
  reason: "Cleanup after test"     // Required: Audit trail
}
```
- Cannot close "main" tab
- Closes Playwright page instance
- Removes from stagehandPages map
- Switches to main if active tab was closed
- Clears tab inspection cache

### debug_switch_tab
```javascript
{
  tabName: "example",              // Required: Tab to switch to
  reason: "Checking other tab"     // Required: Audit trail
}
```
- Brings page to front
- Updates Stagehand's current page reference
- Updates browser state active tab

## Architecture Issues & Improvements

### 1. Current Issues

**Duplicate Implementations**
- Both directorService.js and scoutService.js have identical debug tool implementations
- No shared service or utility for debug tools
- Maintenance burden and risk of drift

**Missing Functionality** (vs browser_action)
- No `debug_screenshot` capability
- No `debug_keypress` for keyboard shortcuts
- No `debug_refresh` for page reload
- No `debug_back/forward` for navigation history
- No `debug_list_tabs` for tab enumeration

**Limited Selectors**
- `debug_type` only supports CSS selectors (no text: or act:)
- Inconsistent selector support across tools

**No State Inspection**
- No debug tools for inspecting variables
- No JavaScript evaluation in page context
- No element property inspection

### 2. Proposed Improvements

**Unified debug_action Tool**
```javascript
debug_action({
  action: 'navigate|click|type|wait|openTab|closeTab|switchTab|screenshot|keypress|refresh|back|forward|listTabs',
  config: {
    // Action-specific parameters
    url, selector, text, tabName, key, etc.
  },
  reason: 'Why performing this debug action'
})
```

Benefits:
- Single tool instead of 7+
- Consistent with browser_action mental model
- Easier to extend with new actions
- Better parameter validation
- Reduced API surface area

**Enhanced Capabilities**
1. Add missing actions (screenshot, keypress, etc.)
2. Consistent selector support (CSS, text:, act:) across all interaction actions
3. Add state inspection tools:
   - `debug_evaluate` - Run JS in page context
   - `debug_inspect_element` - Get element properties
   - `debug_get_cookies` - Inspect cookies
   - `debug_get_storage` - Inspect localStorage

**Shared Implementation**
- Extract debug tool logic to shared service
- Single source of truth for both Director and Scout
- Consistent behavior and error handling

## Usage Guidelines

### When to Use Debug Tools

✅ **Good Use Cases:**
- Initial exploration of a new site
- Testing selectors before building nodes
- Debugging failed workflow executions
- Manual intervention during development
- Quick verification of page state

❌ **Don't Use For:**
- Building actual workflow logic
- Production automations
- Anything that needs to persist

### Best Practices

1. **Always provide clear reasons** - Helps with debugging and audit trails
2. **Use scout first** - Often more efficient than manual debug navigation
3. **Clean up tabs** - Close debug tabs when done exploring
4. **Test selectors** - Use debug_click/type to verify selectors work
5. **Check state** - Use inspect_tab between debug actions to see results

### Common Patterns

**Exploring a login flow:**
```javascript
// 1. Navigate to site
debug_navigate({url: "https://example.com", reason: "Exploring login flow"})

// 2. Scout for login elements  
send_scout({instruction: "Find login form elements and their selectors"})

// 3. Test selectors
debug_click({selector: "#login-button", reason: "Testing login button selector"})

// 4. Verify navigation
inspect_tab({tabName: "main", inspectionType: "lightweight_exploration"})
```

**Multi-tab testing:**
```javascript
// 1. Open second tab
debug_open_tab({url: "https://api.example.com", tabName: "api", reason: "Testing API docs"})

// 2. Switch between tabs
debug_switch_tab({tabName: "main", reason: "Back to main site"})
debug_switch_tab({tabName: "api", reason: "Check API response"})

// 3. Clean up
debug_close_tab({tabName: "api", reason: "Done with API testing"})
```

## Integration with Director 2.0

In the simplified Director architecture:
- **Director** only has access to `send_scout` for all browser exploration needs
- **Scout** (the AI agent deployed by send_scout) has access to:
  - All debug tools (for browser manipulation)
  - inspect_tab (for DOM inspection)
  - expand_dom_selector (for detailed element analysis)

This separation of concerns keeps Director focused on high-level workflow orchestration while Scout handles all the low-level browser interaction details.

## Future Considerations

1. **Token Efficiency** - Debug tools are "free" (no LLM calls) vs scout
2. **Debugging Workflows** - Could add workflow debugging modes
3. **Recorder Pattern** - Could record debug actions and convert to nodes
4. **Assertions** - Could add debug_assert for testing expected states
5. **Network Inspection** - Could add debug tools for network monitoring