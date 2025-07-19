# Browser Action Tool Documentation

## Overview

The `browser_action` tool is Director's primary interface for interacting with web browsers during exploration and testing. It provides deterministic, CSS-selector-based browser automation without creating workflow nodes, making it perfect for reconnaissance and validation before building persistent automations.

## Purpose

- **Direct Exploration**: Navigate and interact with pages to understand their structure
- **Selector Testing**: Validate selectors work before creating workflow nodes  
- **State Management**: Manage browser tabs and capture page state
- **Rapid Iteration**: Test interactions without database persistence

## Tool Definition

```javascript
{
  type: 'function',
  function: {
    name: 'browser_action',
    description: 'Execute deterministic browser actions for scouting and exploration without creating workflow nodes.',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: [
            // Navigation
            'navigate', 'back', 'forward', 'refresh',
            // Explicit wait
            'wait',
            // Tab management  
            'openTab', 'closeTab', 'switchTab', 'listTabs',
            // State observation
            'screenshot', 'getCurrentUrl', 'getTitle',
            // Interaction
            'click', 'type', 'keypress'
          ]
        },
        config: {
          type: 'object',
          properties: {
            // Action-specific parameters
          }
        },
        reason: {
          type: 'string',
          description: 'Required audit trail'
        }
      },
      required: ['action', 'reason']
    }
  }
}
```

## Actions

### Navigation Actions

#### navigate
Navigate to a URL with configurable wait strategy.

```javascript
browser_action({
  action: "navigate",
  config: {
    url: "https://example.com",
    waitUntil: "domcontentloaded"  // or "load", "networkidle"
  },
  reason: "Exploring login page"
})
```

#### back / forward / refresh
Browser navigation controls.

```javascript
browser_action({
  action: "back",
  config: {
    tabName: "main"  // optional, defaults to active tab
  },
  reason: "Returning to previous page"
})
```

### Wait Actions

#### wait
Explicit wait for time, selector, or navigation.

```javascript
// Wait for time
browser_action({
  action: "wait",
  config: {
    waitType: "time",
    waitValue: 2000  // milliseconds
  },
  reason: "Waiting for animation"
})

// Wait for selector
browser_action({
  action: "wait", 
  config: {
    waitType: "selector",
    waitValue: "#content-loaded"
  },
  reason: "Waiting for content to load"
})

// Wait for navigation
browser_action({
  action: "wait",
  config: {
    waitType: "navigation",
    waitValue: "networkidle"
  },
  reason: "Waiting for page navigation"
})
```

### Tab Management

#### openTab
Open a new browser tab with a name for tracking.

```javascript
browser_action({
  action: "openTab",
  config: {
    name: "dashboard",  // required for tab tracking
    url: "https://app.example.com/dashboard"
  },
  reason: "Opening dashboard in new tab"
})
```

#### switchTab / closeTab
Manage multiple tabs during exploration.

```javascript
browser_action({
  action: "switchTab",
  config: {
    tabName: "dashboard"
  },
  reason: "Switching to dashboard tab"
})

browser_action({
  action: "closeTab",
  config: {
    tabName: "dashboard"
  },
  reason: "Closing dashboard tab"
})
```

#### listTabs
Get information about all open tabs.

```javascript
browser_action({
  action: "listTabs",
  config: {},
  reason: "Checking open tabs"
})
// Returns: {tabs: [{name: "main", active: true, url: "..."}, ...]}
```

### State Observation

#### screenshot
Capture page or element screenshots.

```javascript
// Full page screenshot
browser_action({
  action: "screenshot",
  config: {
    fullPage: true,
    path: "login-page.png"  // optional
  },
  reason: "Capturing login page state"
})

// Element screenshot
browser_action({
  action: "screenshot",
  config: {
    selector: "#error-message",
    path: "error.png"
  },
  reason: "Capturing error message"
})
```

#### getCurrentUrl / getTitle
Get current page information.

```javascript
browser_action({
  action: "getCurrentUrl",
  config: {},
  reason: "Checking redirect target"
})
// Returns: {url: "https://...", tab: "main"}

browser_action({
  action: "getTitle",
  config: {},
  reason: "Verifying page loaded"
})
// Returns: {title: "Page Title", tab: "main"}
```

### Interaction Actions

#### click
Click elements using CSS selectors with auto-wait.

```javascript
browser_action({
  action: "click",
  config: {
    selector: "#submit-button",
    timeout: 10000  // wait up to 10s for element
  },
  reason: "Testing form submission"
})
```

#### type
Type text into input fields with auto-clear.

```javascript
browser_action({
  action: "type",
  config: {
    selector: "input[name='email']",
    text: "test@example.com",
    timeout: 5000
  },
  reason: "Testing email input"
})
```

#### keypress
Send keyboard keys to the page.

```javascript
browser_action({
  action: "keypress",
  config: {
    key: "Enter"  // or "Escape", "Tab", "ArrowDown", etc.
  },
  reason: "Submitting form with Enter key"
})
```

## Integration with DOM Tools

The `browser_action` tool works seamlessly with DOM exploration tools for comprehensive page understanding:

```javascript
// 1. Navigate to page
browser_action({
  action: "navigate",
  config: {url: "https://example.com/form"},
  reason: "Loading form page"
})

// 2. Understand page structure
dom_overview()  // See all elements with IDs

// 3. Find specific element
dom_search({query: {text: "Submit"}})  // Returns [id: 123]

// 4. Get selector details
dom_inspect({elementId: "[123]"})  // Returns selectors

// 5. Test interaction
browser_action({
  action: "click",
  config: {selector: "#submit-btn"},
  reason: "Testing submit button"
})

// 6. See what changed
dom_overview({diff_from: true})  // Shows only changes
```

## Best Practices

### 1. Always Provide Clear Reasons
The `reason` parameter is required for audit trails and debugging.

```javascript
// Good
reason: "Testing if login button is clickable with valid credentials entered"

// Bad
reason: "clicking"
```

### 2. Use Appropriate Timeouts
Configure timeouts based on expected page behavior.

```javascript
{
  timeout: 30000  // 30s for slow-loading pages
}
```

### 3. Handle Tab Names Carefully
Tab names must be unique. The system auto-suffixes duplicates.

```javascript
// First call creates "report"
openTab({name: "report", url: "..."})

// Second call creates "report_2" 
openTab({name: "report", url: "..."})
```

### 4. Test Selectors Before Building
Always verify selectors work before creating workflow nodes.

```javascript
// Test with browser_action first
browser_action({
  action: "click",
  config: {selector: ".dynamic-button"},
  reason: "Verifying selector before building node"
})

// Then build node if successful
add_or_replace_nodes({
  target: "end",
  nodes: [{
    type: "browser_ai_action",
    alias: "click_button",
    config: {
      action: "click",
      instruction: "Click the dynamic button"
    }
  }]
})
```

### 5. Integrated Wait Strategies
Use built-in wait configurations instead of separate wait actions when possible.

```javascript
// Preferred: Integrated wait
browser_action({
  action: "navigate",
  config: {
    url: "https://spa-app.com",
    waitUntil: "networkidle"  // Wait for SPA to load
  },
  reason: "Loading SPA with full network idle"
})

// Alternative: Separate wait (only when needed)
browser_action({action: "navigate", config: {url: "..."}})
browser_action({action: "wait", config: {waitType: "time", waitValue: 2000}})
```

## Common Patterns

### Login Flow Exploration
```javascript
// Navigate to login
browser_action({
  action: "navigate",
  config: {url: "https://app.com/login"},
  reason: "Starting login flow exploration"
})

// Find form elements
dom_search({query: {tag: "input"}})

// Test credentials entry
browser_action({
  action: "type",
  config: {selector: "#email", text: "test@example.com"},
  reason: "Testing email input"
})

browser_action({
  action: "type", 
  config: {selector: "#password", text: "testpass123"},
  reason: "Testing password input"
})

// Submit form
browser_action({
  action: "click",
  config: {selector: "button[type='submit']"},
  reason: "Testing form submission"
})

// Wait for redirect
browser_action({
  action: "wait",
  config: {waitType: "navigation"},
  reason: "Waiting for post-login redirect"
})

// Verify landing page
browser_action({
  action: "getCurrentUrl",
  config: {},
  reason: "Confirming successful login redirect"
})
```

### Multi-Tab Workflow
```javascript
// Main workflow page
browser_action({
  action: "navigate",
  config: {url: "https://app.com/orders"},
  reason: "Loading orders page"
})

// Open detail in new tab
browser_action({
  action: "openTab",
  config: {name: "order-detail", url: "https://app.com/orders/123"},
  reason: "Opening order detail in new tab"
})

// Work in detail tab
dom_overview()  // Analyze detail page

// Switch back to main
browser_action({
  action: "switchTab",
  config: {tabName: "main"},
  reason: "Returning to orders list"
})

// Close detail tab
browser_action({
  action: "closeTab",
  config: {tabName: "order-detail"},
  reason: "Closing completed detail tab"
})
```

## Error Handling

The tool returns structured results with success/error information:

```javascript
// Success
{
  success: true,
  navigated: "https://example.com",
  tab: "main",
  reason: "Exploring login page"
}

// Error
{
  success: false,
  error: "Tab \"dashboard\" does not exist. Use openTab first."
}
```

Common errors:
- Missing required parameters (url, selector, etc.)
- Tab doesn't exist
- Element not found within timeout
- Invalid wait type
- Cannot close main tab

## Migration from Debug Tools

The `browser_action` tool consolidates and replaces the previous debug_* tools:

| Old Tool | New Action |
|----------|------------|
| debug_navigate | browser_action({action: "navigate", ...}) |
| debug_click | browser_action({action: "click", ...}) |
| debug_type | browser_action({action: "type", ...}) |
| debug_wait | browser_action({action: "wait", ...}) |
| debug_open_tab | browser_action({action: "openTab", ...}) |
| debug_close_tab | browser_action({action: "closeTab", ...}) |
| debug_switch_tab | browser_action({action: "switchTab", ...}) |

## Summary

The `browser_action` tool is Director's Swiss Army knife for browser exploration. It provides:

1. **Immediate Execution** - No database persistence, instant feedback
2. **Comprehensive Actions** - Navigation, interaction, state observation, tab management
3. **Integrated Waits** - Smart waiting built into actions
4. **Deterministic Control** - CSS selectors only, predictable behavior
5. **Seamless Integration** - Works perfectly with DOM exploration tools

Use `browser_action` liberally during exploration to understand pages, test selectors, and validate your automation approach before building persistent workflow nodes.