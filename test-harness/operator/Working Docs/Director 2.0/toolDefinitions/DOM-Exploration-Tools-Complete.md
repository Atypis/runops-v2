# DOM Exploration Tools - Complete Documentation

## Overview

The DOM Exploration Toolkit provides Director with token-efficient, progressive DOM inspection capabilities. These tools mirror the Unix philosophy of simple, composable commands (`ls`, `grep`, `cat`) adapted for web page exploration.

### Quick Tool Comparison

| Tool | Purpose | Unix Equivalent | Primary Use Case | Token Usage |
|------|---------|----------------|------------------|-------------|
| `dom_overview` | Get filtered page snapshot | `ls` + `grep` | Initial exploration, state checks | ~300 tokens |
| `dom_structure` | Show DOM tree | `tree` / `ls -R` | Understand page hierarchy | ~200 tokens |
| `dom_search` | Find specific elements | `grep` | Locate buttons, inputs, text | ~100-300 tokens |
| `dom_inspect` | Deep element details | `cat` | Build selectors, debug | ~200-400 tokens |

## Design Philosophy

1. **Token Efficiency First** - Every design choice optimizes for minimal token usage (<300 tokens per call)
2. **Progressive Disclosure** - Start broad with overview, drill down as needed
3. **Stable References** - Use internal node IDs `[123]` that remain consistent across calls
4. **Smart Defaults** - Works well out of the box with sensible defaults
5. **Graceful Degradation** - Hard caps and truncation prevent token explosions

## Core Implementation Architecture

```
dom-toolkit/
├── index.js                      # Main API entry point
├── core/
│   ├── domCapture.js            # CDP snapshot with single call
│   └── domCache.js              # 30s cache with mutation observer
├── filters/
│   ├── outlineFilter.js         # Structure extraction (depth ≤ 2)
│   ├── interactivesFilter.js    # Clickable/typeable elements
│   ├── headingsFilter.js        # Text content extraction
│   └── searchFilter.js          # Element search logic
├── processors/
│   ├── groupingProcessor.js     # "N similar" element detection
│   ├── selectorHints.js         # Multiple selector generation
│   └── elementInspector.js      # Deep element inspection
└── formatters/
    └── tokenFormatter.js        # Token-efficient output formatting
```

## The Four Canonical Tools

### 1. `dom_overview` - The Bread & Butter Tool

**Purpose**: Primary reconnaissance tool for understanding "what's on this page and what can I do with it?"

**When to Use**:
- First exploration of any new page
- After navigation or major state changes
- When you need both structure AND interactive elements
- As a starting point before using other DOM tools
- **NEW**: To detect what changed between two snapshots (diff mode)

**Parameters**:
```javascript
{
  tabName: string,      // Browser tab (optional, defaults to active)
  filters: {            // What to include (all true by default)
    outline: boolean,     // Page structure (depth ≤ 2)
    interactives: boolean,// Clickable/typeable elements
    headings: boolean     // Headings and key text blocks
  },
  visible: boolean,     // Only visible elements (default: true)
  viewport: boolean,    // Only in viewport (default: true)
  max_rows: number,     // Max per category (default: 30, max: 100)
  
  // Diff mode parameters (NEW)
  diff_from: string|boolean|null,  // Compare to previous snapshot
                                   // true = use last snapshot for this tab
                                   // "snapshotId" = compare to specific snapshot
                                   // null/undefined = normal overview (default)
  include_full: boolean            // Include full overview with diff (default: false)
}
```

**Response Format**:
```javascript
{
  success: boolean,
  snapshotId: string,     // Unique ID for this DOM state
  tabName: string,
  url: string,
  sections: {
    outline: [{           // Page structure
      id: "[101]",
      tag: "section",
      id_attr: "main-content",
      class_attr: "container",
      depth: 1,
      child_count: 5
    }],
    interactives: [{      // Interactive elements
      id: "[234]",
      type: "button",     // button|link|input|select|textarea
      tag: "button",
      text: "Submit",
      role: "button",
      selector_hints: ["#submit-btn", "button.primary"]
    }],
    headings: [{          // Text content
      id: "[567]",
      tag: "h1",
      text: "Welcome to Example App",
      length: 24
    }]
  },
  summary: {
    total_elements: 847,
    shown: 45,
    truncatedSections: ["interactives"],
    viewport_info: {
      width: 1920,
      height: 1080,
      scroll_position: 0,
      contentHeight: 3200
    }
  }
}

// Diff Mode Response (when diff_from is set):
{
  success: boolean,
  snapshotId: string,           // Current snapshot ID
  tabName: string,
  url: string,
  diff: {
    added: [{                   // Elements that appeared
      id: "[401]",
      tag: "button",
      text: "Pay Now",             // Compact format, same as overview
      class: "btn-primary"          // First class only
    }],
    removed: [{                 // Elements that disappeared  
      id: "[345]",
      tag: "a",
      text: "Upgrade Plan",
      href: "/upgrade"              // Truncated if needed
    }],
    modified: [{                // Elements that changed
      id: "[278]",
      tag: "span",
      changes: {
        text: { old: "$29", new: "$24" },
        attributes: {
          class: { old: "price", new: "price sale" }
        },
        visibility: { old: false, new: true }
      }
      // Note: No 'current' field to save tokens
    }]
  },
  summary: {
    baseline: "prevSnapId",     // Previous snapshot ID
    totalChanges: 5,            // Filtered changes shown
    totalRawChanges: 12,        // All changes before filtering
    filteredOutChanges: 7,      // Changes hidden by filters
    truncated: false,           // true if hit max_rows limit
    maxChangesPerType: 90       // Safety limit (3x max_rows)
  }
  // If include_full: true, also includes sections: {...}
}
```

**Quick Examples**:
```javascript
// Default: everything visible in viewport
dom_overview()

// Just interactive elements
dom_overview({ filters: { interactives: true } })

// Everything, including below fold
dom_overview({ viewport: false })

// DIFF MODE: Compare to last snapshot
dom_overview({ diff_from: true })

// DIFF MODE: Compare to specific snapshot
dom_overview({ diff_from: "5c2a6b3c" })

// DIFF MODE: With full overview included
dom_overview({ diff_from: true, include_full: true })

// Focus on forms with more results
dom_overview({ 
  filters: { interactives: true },
  viewport: false,
  max_rows: 50
})
```

**Token-Efficient Output Example**:
```
=== DOM OVERVIEW: https://app.example.com/dashboard ===

[OUTLINE - Page Structure]
[101] body
  [102] header.navbar (12 children)
  [103] aside#sidebar (8 children)
  [104] main#content
    [105] section.stats-grid (4 children)
    [106] section.data-table (2 children)

[INTERACTIVES - 12 found]
[234] button#create-new "Create New Project"
[256] input[name="search"] placeholder="Search projects..."
[278] a.nav-link "Settings" href="/settings"
[301] select#filter-status (3 options)
[367-372] 6 similar: button.row-action "Edit"

[HEADINGS & TEXT]
[156] h1: "Project Dashboard"
[178] h2: "Active Projects (12)"

[SUMMARY]
Snapshot: a1b2c3d4 | Total: 847 | Shown: 29 | Viewport: 1920x1080
```

### 2. `dom_structure` - Pure Structure View

**Purpose**: Get the DOM tree structure without content, like `ls` for web pages.

**When to Use**:
- Understanding page hierarchy
- Finding container elements
- Navigating complex nested structures
- When you need structural context without content noise

**Parameters**:
```javascript
{
  tabName: string,    // Browser tab (optional)
  depth: number       // Max depth (default: 3, max: 10)
}
```

**Response Format**:
```javascript
{
  success: boolean,
  tabName: string,
  url: string,
  structure: [{
    tag: "body",
    id: "[101]",
    depth: 0,
    id_attr: "app",
    class_attr: "theme-light",
    childNodes: [{
      tag: "header",
      id: "[102]",
      depth: 1,
      childNodes: [...]
    }]
  }],
  summary: {
    total_nodes: 234,
    max_depth_reached: 3
  }
}
```

**Quick Examples**:
```javascript
// Default depth 3
dom_structure()

// Deeper exploration
dom_structure({ depth: 5 })

// Shallow overview
dom_structure({ depth: 2 })
```

### 3. `dom_search` - Find Specific Elements

**Purpose**: Search for elements by various criteria, like `grep` for DOM.

**When to Use**:
- Finding specific buttons or links by text
- Locating form inputs by name/type
- Searching within a specific container
- Finding elements by ARIA role

**Parameters**:
```javascript
{
  tabName: string,      // Browser tab (optional)
  query: {              // At least one required
    text: string,         // Contains text
    selector: string,     // CSS selector
    attributes: {         // Attribute values
      name: string,
      type: string,
      // any attribute...
    },
    role: string,         // ARIA role
    tag: string          // HTML tag
  },
  limit: number,        // Max results (default: 20)
  context: string,      // Search within element ID
  visible: boolean      // Only visible (default: true)
}
```

**Response Format**:
```javascript
{
  success: boolean,
  tabName: string,
  matches: [{
    id: "[789]",
    tag: "button",
    text: "Sign In",
    matchedOn: "text",    // What matched
    selector_hints: [
      "#login-btn",
      "button:contains('Sign In')",
      "form button.primary"
    ],
    attributes: {
      type: "submit",
      class: "btn primary"
    }
  }],
  summary: {
    matches_found: 3,
    search_criteria: { text: "Sign In" }
  }
}
```

**Quick Examples**:
```javascript
// By text
dom_search({ query: { text: "Sign in" } })

// By type and tag
dom_search({ query: { tag: "input", attributes: { type: "email" } } })

// Within specific element
dom_search({ query: { tag: "button" }, context: "[456]" })

// By ARIA role
dom_search({ query: { role: "navigation" } })

// Multiple criteria
dom_search({ 
  query: { 
    tag: "button",
    text: "Submit",
    attributes: { type: "submit" }
  }
})
```

### 4. `dom_inspect` - Deep Element Inspection

**Purpose**: Get comprehensive details about a specific element, like `cat` for DOM nodes.

**When to Use**:
- Building precise selectors
- Understanding element relationships
- Getting full attribute lists
- Debugging why an element isn't working

**Parameters**:
```javascript
{
  tabName: string,        // Browser tab (optional)
  elementId: string,      // Element ID from other tools ("[123]")
  include: {              // What to include
    attributes: boolean,    // All attributes (default: true)
    computedStyles: boolean,// CSS styles (default: false)
    children: boolean,      // Immediate children (default: true)
    siblings: boolean,      // Siblings (default: false)
    parents: boolean,       // Parent chain (default: true)
    text: boolean          // All text content (default: true)
  }
}
```

**Response Format**:
```javascript
{
  success: boolean,
  element: {
    id: "[456]",
    tag: "button",
    type: "submit",
    visible: true,
    inViewport: false,
    bounds: {
      x: 100,
      y: 200,
      width: 120,
      height: 40
    },
    attributes: {
      id: "submit-form",
      class: "btn btn-primary large",
      type: "submit",
      disabled: "false",
      "data-action": "submit-form"
    },
    text: "Submit Application",
    parents: [
      { id: "[455]", tag: "form", id_attr: "application-form" },
      { id: "[450]", tag: "div", class_attr: "form-container" }
    ],
    children: [
      { id: "[457]", tag: "span", text: "Submit" },
      { id: "[458]", tag: "svg", class_attr: "icon-arrow" }
    ],
    selectors: [      // Selector suggestions
      "#submit-form",
      "form#application-form button[type='submit']",
      "button.btn-primary:contains('Submit')"
    ]
  }
}
```

**Quick Examples**:
```javascript
// Basic inspection
dom_inspect({ elementId: "[456]" })

// With computed styles
dom_inspect({ 
  elementId: "[456]", 
  include: { computedStyles: true } 
})

// Minimal (just attributes and text)
dom_inspect({ 
  elementId: "[456]",
  include: { 
    children: false, 
    parents: false 
  }
})
```

## Key Concepts

### Element IDs
- Format: `[123]` where 123 is the internal node ID
- Stable within a DOM snapshot (30-second cache)
- **Not** the HTML `id` attribute
- Used across all tools for consistent references
- Can handle ranges: `[367-372]` for grouped elements

### Smart Grouping
When multiple similar elements exist:
```
[367-372] 6 similar: button.row-action "Edit"
```
- Reduces token usage dramatically
- Preserves semantic information
- Can be expanded with `dom_search` if needed
- Grouping criteria: same parent, identical selectors, adjacent siblings

### Selector Hints
Multiple selector options provided for robustness:
1. **ID selector** if available: `#login-button`
2. **Unique attributes**: `input[name="email"]`
3. **Text-based**: `button:contains('Submit')`
4. **Structural**: `.form-container > button:first-child`
5. **Class combinations**: `button.btn.btn-primary`

### Caching System
- DOM snapshots cached for 30 seconds
- Same `snapshotId` = same DOM state
- Single CDP call per navigation
- Cache invalidated on:
  - Navigation events
  - Major DOM mutations (>300 changes)
  - Manual refresh request
  - Tab switch

## Common Patterns

### Pattern 1: Initial Page Exploration
```javascript
// 1. Get overview first
const overview = await dom_overview({ 
  filters: { outline: true, interactives: true, headings: true } 
});

// 2. Find specific element
const searchResult = await dom_search({ 
  query: { text: "Login", tag: "button" } 
});

// 3. Inspect for selector building
const details = await dom_inspect({ 
  elementId: searchResult.matches[0].id 
});

// 4. Use in workflow
create_node({
  type: "browser_action",
  config: {
    action: "click",
    selector: details.element.selectors[0]
  }
});
```

### Pattern 2: Form Interaction
```javascript
// 1. Find the form
const forms = await dom_search({ query: { tag: "form" } });

// 2. Get form structure
const formDetails = await dom_inspect({ 
  elementId: forms.matches[0].id,
  include: { children: true }
});

// 3. Find inputs within form
const inputs = await dom_search({ 
  query: { tag: "input" },
  context: forms.matches[0].id 
});

// 4. Build form filling workflow
for (const input of inputs.matches) {
  const info = await dom_inspect({ elementId: input.id });
  if (info.element.attributes.name === "email") {
    create_node({
      type: "browser_action",
      config: {
        action: "type",
        selector: info.element.selectors[0],
        text: "user@example.com"
      }
    });
  }
}
```

### Pattern 3: Handling Dynamic Content
```javascript
// 1. Snapshot before action
const before = await dom_overview();

// 2. Perform action
await execute_nodes({ nodeSelection: "22" }); // Click "Load More"

// 3. Wait for update
await browser_action({ action: "wait", type: "time", value: "1000" });

// 4. Check new state
const after = await dom_overview();

// 5. Verify change occurred
if (after.snapshotId !== before.snapshotId) {
  // DOM changed, find new elements
  const newItems = await dom_search({ 
    query: { tag: "article" },
    limit: 50 
  });
}
```

### Pattern 4: Infinite Scroll
```javascript
// 1. Get initial viewport
const page1 = await dom_overview({ 
  viewport: true,
  filters: { interactives: true }
});

// 2. Scroll down
await browser_action({ 
  action: "scroll", 
  direction: "down", 
  amount: 1000 
});

// 3. Wait for content to load
await browser_action({ 
  action: "wait", 
  type: "time", 
  value: "500" 
});

// 4. Get new viewport content
const page2 = await dom_overview({ 
  viewport: true,
  filters: { interactives: true }
});

// 5. Find items that appeared
const newItems = page2.sections.interactives.filter(
  item => !page1.sections.interactives.find(old => old.id === item.id)
);
```

### Pattern 5: Tracking Page Changes with Diff Mode
```javascript
// 1. Take baseline snapshot before user action
const baseline = await dom_overview({ 
  filters: { interactives: true, headings: true } 
});
console.log(`Baseline snapshot: ${baseline.snapshotId}`);

// 2. Perform user action (e.g., submit form)
await execute_nodes({ nodeSelection: "submit-form" });
await browser_action({ action: "wait", type: "time", value: "1000" });

// 3. Get diff to see what changed
const changes = await dom_overview({ 
  diff_from: true,  // Compare to last snapshot
  filters: { interactives: true, headings: true }
});

// 4. Analyze changes
if (changes.diff.added.length > 0) {
  // New elements appeared (e.g., success message, new buttons)
  const newButtons = changes.diff.added.filter(el => el.tag === 'button');
  const messages = changes.diff.added.filter(el => 
    el.text && el.text.includes('Success')
  );
}

if (changes.diff.removed.length > 0) {
  // Elements disappeared (e.g., form was replaced)
  const removedForm = changes.diff.removed.find(el => el.tag === 'form');
}

if (changes.diff.modified.length > 0) {
  // Elements changed (e.g., button text, visibility)
  const visibilityChanges = changes.diff.modified.filter(el => 
    el.changes.visibility
  );
  const textChanges = changes.diff.modified.filter(el => 
    el.changes.text
  );
}

// 5. Make decisions based on changes
if (changes.summary.totalChanges > 50) {
  // Major page change - might need full re-exploration
  const newOverview = await dom_overview({ include_full: true });
}
```

### Pattern 6: Complex Navigation
```javascript
// 1. Find navigation menu
const nav = await dom_search({ 
  query: { role: "navigation" } 
});

// 2. Get all links in nav
const navLinks = await dom_search({ 
  query: { tag: "a" },
  context: nav.matches[0].id,
  limit: 50
});

// 3. Find specific link
const settingsLink = navLinks.matches.find(
  link => link.text.includes("Settings")
);

// 4. Navigate
if (settingsLink) {
  create_node({
    type: "browser_action",
    config: {
      action: "click",
      selector: settingsLink.selector_hints[0]
    }
  });
}
```

## Best Practices

### 1. Start with `dom_overview`
```javascript
// ✅ Good: Get context first
const overview = await dom_overview();
// Then drill down based on what you find

// ❌ Bad: Jump straight to search without context
const button = await dom_search({ query: { tag: "button" } });
```

### 2. Use Appropriate Filters
```javascript
// ✅ Good: Request only what you need
dom_overview({ filters: { interactives: true } })

// ❌ Bad: Request everything when you only need buttons
dom_overview({ max_rows: 100, viewport: false })
```

### 3. Progressive Refinement
```javascript
// ❌ Too broad
dom_search({ query: { tag: "div" } })

// ✅ Better
dom_search({ query: { tag: "div", attributes: { role: "button" } } })

// ✅ Best - combine criteria
dom_search({ 
  query: { 
    tag: "button",
    text: "Submit",
    attributes: { type: "submit" }
  },
  context: "[456]"  // Search within form
})
```

### 4. Handle Truncation
```javascript
const result = await dom_overview({ max_rows: 20 });

// Check if results were truncated
if (result.summary.truncatedSections.includes("interactives")) {
  // Get more results with search
  const allButtons = await dom_search({ 
    query: { tag: "button" },
    limit: 100
  });
}
```

### 5. Robust Selector Building
```javascript
const element = await dom_inspect({ elementId: "[456]" });

// Use multiple selectors for fallback
const selectors = element.element.selectors;

// Test selectors before using
for (const selector of selectors) {
  const test = await browser_query({ 
    selector, 
    action: "exists" 
  });
  if (test.exists) {
    // Use this selector
    break;
  }
}
```

## Performance Optimization

### Token Usage Guidelines
- `dom_overview`: 200-400 tokens typical, up to 1000 with max_rows=100
- `dom_structure`: 100-300 tokens depending on depth
- `dom_search`: 100-300 tokens depending on matches
- `dom_inspect`: 200-400 tokens with full details

### Caching Best Practices
```javascript
// ✅ Good: Reuse snapshot within 30 seconds
const overview1 = await dom_overview();
// ... do some non-DOM-modifying operations ...
const overview2 = await dom_overview(); // Uses cache

// ❌ Bad: Force new snapshot unnecessarily
const overview1 = await dom_overview();
await browser_action({ action: "refresh" }); // Invalidates cache
const overview2 = await dom_overview(); // New CDP call
```

### Batch Operations
```javascript
// ✅ Good: Get all data in one overview
const data = await dom_overview({ 
  filters: { outline: true, interactives: true, headings: true } 
});

// ❌ Bad: Multiple calls for different filters
const outline = await dom_overview({ filters: { outline: true } });
const buttons = await dom_overview({ filters: { interactives: true } });
const headings = await dom_overview({ filters: { headings: true } });
```

## Error Handling

All tools return consistent error format:
```javascript
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Human readable message",
    suggestion: "How to fix"
  }
}
```

### Common Error Codes

| Code | Description | Common Cause | Solution |
|------|-------------|--------------|----------|
| `TAB_NOT_FOUND` | Invalid tab name | Tab doesn't exist | Create tab or check name |
| `ELEMENT_NOT_FOUND` | Invalid element ID | Element no longer exists | Refresh snapshot |
| `INVALID_QUERY` | Malformed search query | Missing required field | Check query syntax |
| `SNAPSHOT_EXPIRED` | DOM changed significantly | Major mutations | Call tool again |
| `CDP_ERROR` | Chrome DevTools error | Browser issue | Retry operation |

### Error Handling Pattern
```javascript
try {
  const result = await dom_overview();
  
  if (!result.success) {
    // Handle specific errors
    switch (result.error.code) {
      case 'TAB_NOT_FOUND':
        await browser_action({ action: 'openNewTab' });
        break;
      case 'SNAPSHOT_EXPIRED':
        // Retry once
        const retry = await dom_overview();
        break;
      default:
        console.error(result.error.message);
    }
  }
} catch (e) {
  // Network or critical error
  console.error('Tool execution failed:', e);
}
```

## Integration with Director

### Tool Registration
The tools are registered in `toolDefinitions.js`:
```javascript
import { createDOMExplorationTools } from './domExplorationTools.js';

export function createToolDefinitions() {
  const domTools = createDOMExplorationTools();
  return [...existingTools, ...domTools];
}
```

### In Director Workflows
```javascript
// 1. Alignment phase - Scout uses dom_overview internally
send_scout({
  instruction: "Find the login form and understand the page"
});

// 2. Planning phase - Identify elements
const loginBtn = await dom_search({ 
  query: { text: "Login", tag: "button" } 
});

// 3. Building phase - Create nodes
const btnDetails = await dom_inspect({ 
  elementId: loginBtn.matches[0].id 
});

create_node({
  type: "browser_action",
  config: {
    action: "click",
    selector: btnDetails.element.selectors[0]
  },
  alias: "click_login"
});

// 4. Testing phase - Verify state
const afterLogin = await dom_overview({ 
  filters: { headings: true } 
});
// Check for "Welcome" or "Dashboard" headings
```

## Comparison with `inspect_tab`

| Aspect | DOM Exploration Tools | inspect_tab |
|--------|----------------------|-------------|
| **Token Usage** | ~300 tokens typical | 1000+ tokens |
| **Information** | Filtered, relevant | Everything |
| **Structure** | Organized sections | Flat list |
| **Element IDs** | Stable `[123]` format | CSS selectors |
| **Caching** | 30-second smart cache | No cache |
| **CDP Calls** | Single efficient call | Multiple calls |
| **Best For** | Exploration & discovery | Known selectors |
| **Grouping** | "N similar" smart grouping | Lists all |

## Quick Decision Tree

```
Need to understand page? → dom_overview
Need specific element? → dom_search  
Need element details? → dom_inspect
Need page structure? → dom_structure
Need to track changes? → dom_overview with diff_from

Exploring new page? → dom_overview first
Know what you want? → dom_search directly
Building selectors? → dom_inspect the element
Debugging issues? → dom_inspect with all options
Tracking state changes? → dom_overview before/after with diff_from
```

## Tips & Tricks

### 1. Handling Grouped Elements
```javascript
// See: "[367-372] 6 similar: button.row-action 'Edit'"
// Expand the group:
const allEditButtons = await dom_search({ 
  query: { selector: "button.row-action" },
  limit: 50
});
```

### 2. Finding Hidden Elements
```javascript
// Include hidden elements
const allInputs = await dom_search({ 
  query: { tag: "input" },
  visible: false  // Include hidden
});
```

### 3. Working with Iframes
```javascript
// Find iframes in structure
const structure = await dom_structure({ depth: 3 });
// Look for iframe tags in the structure

// Note: Content within iframes requires switching context
```

### 4. Efficient State Checking
```javascript
// Option 1: Quick change detection with snapshotId
const before = await dom_overview();
// ... perform action ...
const after = await dom_overview();

if (before.snapshotId === after.snapshotId) {
  // DOM hasn't changed - action may have failed
}

// Option 2: Detailed change tracking with diff
const before = await dom_overview();
// ... perform action ...
const diff = await dom_overview({ diff_from: true });

if (diff.summary.totalChanges === 0) {
  // No relevant changes detected
} else {
  // Analyze specific changes
  console.log(`Added: ${diff.diff.added.length}`);
  console.log(`Removed: ${diff.diff.removed.length}`);
  console.log(`Modified: ${diff.diff.modified.length}`);
}
```

### 5. Multi-criteria Search
```javascript
// Combine multiple criteria for precision
const submitButton = await dom_search({
  query: {
    tag: "button",
    text: "Submit",
    attributes: { 
      type: "submit",
      disabled: "false"  // Only enabled buttons
    }
  }
});
```

## Diff Mode Deep Dive

### How Diff Mode Works

The diff mode uses **bi-temporal filtering** to ensure consistency with regular `dom_overview`:

1. **Snapshot Comparison**: Compares full DOM snapshots by node ID
2. **Smart Filtering**: Applies the same filters as regular overview, but:
   - **Added elements**: Must pass filters in the NEW snapshot
   - **Removed elements**: Must have passed filters in the OLD snapshot  
   - **Modified elements**: Included if they pass filters in EITHER snapshot
   - **Special case**: Visibility changes on relevant elements always included
3. **Compact Format**: Uses same concise format as regular overview (not verbose JSON)
4. **Token Safety**: Hard limit of 3x max_rows per change type (default: 90 each)

### Edge Cases Handled Correctly

| Scenario | Detected? | Why |
|----------|-----------|-----|
| Hidden button becomes visible | ✅ Yes | Added to "added" if now passes filters |
| Visible button becomes hidden | ✅ Yes | Added to "removed" if previously passed filters |
| Button text changes | ✅ Yes | Modified if button passes filters |
| Element scrolls into view | ✅ Yes | Viewport filter applied per snapshot |
| Whole page navigation | ✅ Yes | Up to 90 added + 90 removed (truncated) |
| Form input value changes | ✅ Yes | Text/value changes tracked |
| CSS class changes | ✅ Yes | Attribute changes tracked |
| Minor position shifts | ❌ No | Layout changes need >1px difference |

### Diff Mode Best Practices

```javascript
// ✅ Good: Take baseline before action
const before = await dom_overview();
await performAction();
const diff = await dom_overview({ diff_from: true });

// ❌ Bad: No baseline to compare
const diff = await dom_overview({ diff_from: true });
// Returns empty diff with note

// ✅ Good: Use same filters for consistency  
const before = await dom_overview({ 
  filters: { interactives: true } 
});
// ... action ...
const diff = await dom_overview({ 
  diff_from: true,
  filters: { interactives: true }  // Same filters!
});

// ✅ Good: Handle major changes gracefully
if (diff.summary.totalChanges > 100) {
  // Major change - get fresh overview
  const fresh = await dom_overview();
}
```

### Understanding Diff Results

```javascript
// Added elements - NEW in the DOM
diff.added = [
  { id: "[234]", tag: "div", class: "alert" },
  { id: "[235]", tag: "button", text: "OK" }
];

// Removed elements - NO LONGER in the DOM
diff.removed = [
  { id: "[123]", tag: "form", id_attr: "login-form" }
];

// Modified elements - CHANGED properties
diff.modified = [
  {
    id: "[456]",
    tag: "button",
    changes: {
      text: { old: "Submit", new: "Submitting..." },
      attributes: {
        disabled: { old: null, new: "true" }
      }
    }
  }
];
```

### Performance Impact

- **First overview**: Creates snapshot (one CDP call)
- **Subsequent overview**: Uses 30-second cache
- **Diff operation**: Pure computation, no CDP calls
- **Token usage**: ~400-1000 tokens for typical diffs
- **Large changes**: Capped at ~2000 tokens worst case

## Implementation Details

### DOM Capture Strategy
- Single CDP call using `DOMSnapshot.captureSnapshot`
- Captures computed styles, paint order, DOM rects
- Processes into optimized internal format
- Generates stable element IDs

### Filtering Algorithms
- **Outline**: Depth-first traversal, semantic tag preference
- **Interactives**: Tag matching + ARIA role detection
- **Headings**: h1-h6 tags + long paragraphs (>50 chars)
- **Search**: Multi-criteria matching with scoring
- **Diff**: Bi-temporal filtering with change-aware logic

### Grouping Logic
Elements are grouped when:
- Same parent element
- Identical tag and attributes (excluding unique ones)
- Adjacent or near-adjacent siblings
- Similar selector patterns

### Cache Implementation
- In-memory cache per tab
- 30-second TTL
- Mutation observer threshold: 300 changes
- Automatic invalidation on navigation

## Summary

The DOM Exploration Toolkit provides Director with efficient, progressive tools for understanding and interacting with web pages. By following the Unix philosophy of simple, composable tools, it enables sophisticated DOM exploration while maintaining token efficiency and clarity.

**Key Benefits**:
- 🚀 **Fast**: Single CDP call, smart caching
- 📦 **Efficient**: <300 tokens typical usage
- 🎯 **Precise**: Stable element IDs, multiple selectors
- 🔍 **Progressive**: Start broad, drill down as needed
- 🛡️ **Robust**: Handles dynamic content, large pages
- 🧩 **Composable**: Tools work together seamlessly
- 🔄 **Change Tracking**: Bi-temporal diff mode for state monitoring

**Remember**:
- Always start with `dom_overview` for context
- Use specific tools for specific needs
- Leverage the 30-second cache
- Element IDs are `[123]` format, not HTML ids
- Check truncation and adjust max_rows as needed
- Combine search criteria for precision
- Use diff mode to track changes between states