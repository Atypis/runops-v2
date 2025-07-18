# DOM Exploration Toolkit - In-Depth Scope

## `dom_overview` - Bread & Butter Tool

### Purpose
Provide Director with a high-density, token-efficient snapshot of actionable page elements. This is the go-to tool for understanding "what's on this page and what can I do with it?"

### Tool Definition (for toolDefinitions.js)

```javascript
{
  type: 'function',
  function: {
    name: 'dom_overview',
    description: 'Get a filtered overview of the current page showing structure, interactive elements, and key content. Returns element IDs that can be used with other DOM tools. This is your primary reconnaissance tool - use it first when exploring a new page or after navigation.',
    parameters: {
      type: 'object',
      properties: {
        tabName: {
          type: 'string',
          description: 'Browser tab to analyze (defaults to active tab)'
        },
        filters: {
          type: 'object',
          description: 'Which content types to include',
          properties: {
            outline: {
              type: 'boolean',
              description: 'Include page structure (depth ≤ 2)'
            },
            interactives: {
              type: 'boolean',
              description: 'Include clickable/typeable elements'
            },
            headings: {
              type: 'boolean',
              description: 'Include headings and key text blocks'
            }
          },
          additionalProperties: false
        },
        visible: {
          type: 'boolean',
          description: 'Only include visible elements (default: true)'
        },
        viewport: {
          type: 'boolean',
          description: 'Only include elements in current viewport (default: true)'
        },
        max_rows: {
          type: 'number',
          description: 'Maximum elements per category (default: 30, max: 100)'
        }
      },
      additionalProperties: false
    },
    strict: true
  }
}
```

### Response Format

```typescript
interface DomOverviewResponse {
  success: boolean;
  snapshotId: string;    // Unique ID for this DOM snapshot
  tabName: string;
  url: string;
  sections: {
    outline?: OutlineElement[];
    interactives?: InteractiveElement[];
    headings?: HeadingElement[];
  };
  summary: {
    total_elements: number;
    shown: number;
    truncatedSections: string[];  // Which sections hit max_rows limit
    viewport_info: {
      width: number;
      height: number;
      scroll_position: number;
      contentHeight: number;      // Total scrollable height
    };
  };
}

interface OutlineElement {
  id: string;        // "[123]"
  tag: string;       // "section"
  classes?: string;  // "hero-section"
  id_attr?: string;  // "main-content"
  depth: number;     // 1 or 2
  child_count: number;
}

interface InteractiveElement {
  id: string;        // "[456]"
  type: string;      // "button" | "link" | "input" | "select" | "textarea"
  tag: string;       // "button" or "a" or "input"
  text?: string;     // "Sign In" (for buttons/links)
  label?: string;    // "Email address" (from label or aria-label)
  value?: string;    // Current value for inputs (truncated to 80 chars)
  attributes: {      // Key attributes for identification (compressed)
    name?: string;
    placeholder?: string;
    href?: string;   // For links (truncated if > 50 chars)
    type?: string;   // For inputs (email, password, etc)
    role?: string;   // ARIA role
  };
  selector_hints: string[]; // ["#login-btn", "button.primary", "button:contains('Sign In')"]
}

// For grouped similar elements
interface GroupedInteractiveElement {
  id: string;        // "[200-205]"
  group: string;     // "email-row"
  count: number;     // 6
  selector_hints: string[]; // ["tr[role='link']"]
}

interface HeadingElement {
  id: string;        // "[789]"
  tag: string;       // "h1" | "h2" | "h3" | "p"
  text: string;      // Truncated to 100 chars
  length: number;    // Original text length
}
```

### Example Output (Token-Efficient Format)

```
=== DOM OVERVIEW: https://app.example.com/dashboard ===

[OUTLINE - Page Structure]
[101] body
  [102] header.navbar (12 children)
  [103] aside#sidebar (8 children)
  [104] main#content
    [105] section.stats-grid (4 children)
    [106] section.data-table (2 children)
  [107] footer (3 children)

[INTERACTIVES - 12 found, showing 12]
[234] button#create-new "Create New Project"
[256] input[name="search"] placeholder="Search projects..."
[278] a.nav-link "Settings" href="/settings"
[301] select#filter-status (3 options)
[323] button.icon-btn aria-label="Refresh data"
[345] input[type="checkbox"]#select-all
[367-372] 6 similar: button.row-action "Edit"
[389] a#logout "Sign Out" href="/logout"

[HEADINGS & TEXT]
[156] h1: "Project Dashboard"
[178] h2: "Active Projects (12)"
[412] p: "Last updated 5 minutes ago. All systems operational." (52 chars)

[SUMMARY]
Snapshot: a1b2c3d4 | Total: 847 | Shown: 29 | Truncated: [interactives]
Viewport: 1920x1080 | Scroll: 0/3440
```

### Implementation Details

#### 1. DOM Capture Strategy
```javascript
// Use Playwright CDP for efficiency
const snapshot = await page.evaluateHandle(() => 
  window.__dom_snapshot_cache || captureSnapshot()
);

function captureSnapshot() {
  // Single CDP call
  const snapshot = await CDPSession.send('DOMSnapshot.captureSnapshot', {
    computedStyles: ['visibility', 'display'],
    includePaintOrder: true,
    includeDOMRects: true
  });
  
  // Generate unique snapshot ID
  const snapshotId = generateSnapshotId();
  
  // Cache with metadata
  window.__dom_snapshot_cache = {
    id: snapshotId,
    timestamp: Date.now(),
    data: processSnapshot(snapshot),
    mutationCount: 0
  };
  
  // Set up mutation observer for cache invalidation
  setupMutationObserver();
  
  return window.__dom_snapshot_cache;
}
```

#### 2. Filtering Logic

**Outline Filter:**
- Start from body
- Traverse depth-first
- Stop at depth 2
- Only include elements with boundingBox
- Prefer semantic tags (header, main, nav, section, aside, footer)
- Include id/class for identification

**Interactives Filter:**
- Tags: button, a, input, select, textarea
- ARIA roles: button, link, textbox, combobox, checkbox, radio
- Must be visible (boundingBox exists)
- Must be in viewport if flag is true
- Group similar elements when:
  - Same parent element
  - Identical selector hints
  - Adjacent or near-adjacent siblings
- Extract best identifiers (id > name > unique text > class)
- Truncate long values:
  - Input/textarea values: max 80 chars
  - href attributes: max 50 chars for REST URLs
  - placeholder text: max 40 chars

**Headings Filter:**
- h1, h2, h3 tags
- p tags with > 50 characters
- Truncate text to 100 chars
- Must be visible
- Sort by reading order (top to bottom)

#### 3. Selector Hints Generation
For each interactive element, provide 2-3 selector options:
1. ID selector if available: `#login-button`
2. Unique attribute: `input[name="email"]`
3. Text-based: `button:contains('Submit')`
4. Class + position: `.btn-primary:nth-of-type(2)`

#### 4. Performance Optimizations
- Cache DOM snapshot for 30 seconds
- Invalidate cache on:
  - Navigation events
  - Major DOM mutations (>300 changes)
  - Manual refresh request
- Early termination when max_rows reached
- Use binary search for viewport checks
- Batch similar elements ("6 similar" notation)
- Track which sections were truncated

### Director Usage Patterns

```javascript
// Pattern 1: Initial page exploration
send_scout({
  instruction: "Understand the login page",
  // Scout internally calls:
  dom_overview({ filters: { outline: true, interactives: true, headings: true } })
})

// Pattern 2: Find specific elements after overview
dom_overview({ filters: { interactives: true }, viewport: false })
// Director sees button[id=234] "Create New Project"
// Then uses that ID in workflow nodes

// Pattern 3: Check page state after action
execute_nodes({ nodeSelection: "15" }) // Click login
dom_overview({ filters: { headings: true, interactives: true } })
// Director verifies login succeeded by seeing different headings/buttons

// Pattern 4: Handle infinite scroll
dom_overview({ viewport: true, max_rows: 20 }) // Initial view
// Scroll down...
dom_overview({ viewport: true, max_rows: 20 }) // New items
```

### Edge Cases Handled

1. **Dynamic Content**: Elements loaded after initial render are captured
2. **Hidden Elements**: Controlled by `visible` flag
3. **Iframes**: Listed in outline with `[iframe]` prefix
4. **Shadow DOM**: Automatically pierced and included
5. **Large Pages**: Hard cap at max_rows prevents token explosion
6. **Duplicate IDs**: Use internal nodeId, not HTML id attribute
7. **Non-English**: UTF-8 text handled properly

### Integration with Director's Workflow

1. **During Alignment Phase**: Director uses overview to understand the page
2. **During Planning**: Identifies which elements to interact with
3. **During Building**: References element IDs from overview in nodes
4. **During Testing**: Re-runs overview to verify state changes

### Success Metrics
- Response under 300 tokens for typical pages
- Complete overview in < 100ms
- No context window pollution
- Director can build accurate selectors from the hints
- Works on 95% of real-world web apps

### Future Enhancements (Not in MVP)
- `dom_diff(snapshotIdA, snapshotIdB)`: Show only what changed
- Pagination helpers: Detect and expose "next page" buttons
- Smart grouping: Detect and group form fields
- Visual position: "above the fold" indicator
- Confidence scores for selector hints
- Vision fallback for canvas-heavy apps

## Implementation Architecture

### File Structure
```
test-harness/operator/backend/
├── dom-toolkit/
│   ├── index.js                 # Main exports
│   ├── domCapture.js           # CDP snapshot logic
│   ├── domFilters.js           # Filtering algorithms
│   ├── domFormatters.js        # Output formatting
│   ├── domCache.js             # Caching & invalidation
│   ├── domSelectors.js         # Selector hint generation
│   └── domGrouping.js          # Similar element detection
├── tools/
│   └── domExplorationTools.js  # Tool definitions for Director
```

### Integration Points
1. **Tool Registration**: Add to `toolDefinitions.js` with proper imports
2. **Browser Context**: Access via existing browser management
3. **Cache Management**: Separate from existing DOM snapshot functionality
4. **Error Handling**: Graceful fallbacks for CDP failures

## The 12 Core Design Decisions

| # | Design Decision | Options Considered | Chosen Path & Why |
|---|-----------------|-------------------|-------------------|
| 1 | Single "dom_overview" call per navigation | • Multiple partial snapshots<br>• Heavy one-shot dump | One lightweight hybrid snapshot for immediate awareness with single CDP call |
| 2 | Filter flags (outline, interactives, headings) | • Fixed payload<br>• Separate tools for each | Boolean flags for pay-what-you-need flexibility |
| 3 | visible + viewport booleans | • Always include all nodes<br>• Different tools | On-by-default flags for token savings |
| 4 | Hard cap via max_rows (default 30) | • No cap<br>• Token-length cap | Row count is deterministic and plannable |
| 5 | "Row" = visible, interactive element | • Every DOM node<br>• ML clustering | Simple rule matching human clickable elements |
| 6 | "N similar" grouping | • List every item<br>• Omit duplicates | Collapse while preserving semantic info |
| 7 | Selector-hints array | • Model invents<br>• Single best guess | Multiple ranked options offload heuristics |
| 8 | Internal nodeId "[456]" | • Raw CSS selectors<br>• outerHTML | Guarantees uniqueness despite duplicate IDs |
| 9 | 30s cache with snapshotId | • Fresh every call<br>• Infinite cache | Amortize CDP calls with explicit refresh option |
| 10 | Attribute truncation | • Full strings<br>• Drop attributes | Keep selector-relevant, trim verbose content |
| 11 | Edge-case handling | • Ignore<br>• Separate tools | Pierce shadow DOM, list iframes, auto-invalidate |
| 12 | Four canonical tools | • Many micro-tools<br>• Monolithic | Mirror ls→grep→cat for familiarity |