# Shadow DOM & Portal Detection Implementation Guide

## Table of Contents

1. [Overview](#overview)
2. [Technical Architecture](#technical-architecture)
3. [API Reference](#api-reference)
4. [Implementation Details](#implementation-details)
5. [Code Examples](#code-examples)
6. [Integration Patterns](#integration-patterns)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Implementation Timeline](#implementation-timeline)

## Overview

The Shadow DOM and Portal Detection implementation provides the Director with comprehensive capabilities to interact with modern web applications that use Web Components, shadow DOM encapsulation, and dynamic portal/overlay patterns. This implementation enables seamless interaction across shadow boundaries and intelligent detection of dynamically rendered UI elements.

### Key Features

1. **Shadow DOM Piercing**: Traverse and interact with elements inside shadow roots
2. **Portal Detection**: Automatically detect modals, overlays, and dropdowns
3. **Visibility-First Matching**: Intelligently select visible elements when multiple matches exist
4. **Compound Actions**: Combined operations like click-and-wait-for-portal
5. **Deep Element Search**: Recursive traversal through nested shadow DOM hierarchies

## Technical Architecture

### Design Principles

1. **Non-Breaking Enhancement**: All shadow DOM features are opt-in via `useShadowDOM` parameter
2. **Playwright Compatibility**: Leverages Playwright's `>>` syntax for shadow piercing
3. **Performance Optimization**: Efficient DOM traversal with early termination
4. **Developer Experience**: Clear debug logs and error messages

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Action Service                     │
├─────────────────────────────────────────────────────────────┤
│  • processShadowDOMSelector()                               │
│  • shadowDOMHelpers (shared utilities)                      │
│  • Visibility-first matching logic                          │
│  • Portal detection algorithms                              │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                      Node Executor                           │
├─────────────────────────────────────────────────────────────┤
│  • Browser query shadow DOM support                         │
│  • Deterministic extraction with shadow traversal           │
│  • Validation rules with shadow piercing                    │
└─────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    DOM Capture (CDP)                         │
├─────────────────────────────────────────────────────────────┤
│  • includeShadowTree: true                                  │
│  • Shadow root node capture                                 │
│  • Visibility computation across boundaries                 │
└─────────────────────────────────────────────────────────────┘
```

## API Reference

### Browser Action Shadow DOM Support

#### Click Action
```javascript
browser_action click {
  selector: string,              // CSS selector
  useShadowDOM?: boolean,        // Enable shadow DOM piercing (default: false)
  tabName?: string,              // Target tab
  timeout?: number               // Wait timeout in ms (default: 10000)
}
```

#### Type Action
```javascript
browser_action type {
  selector: string,              // CSS selector
  text: string,                  // Text to type
  useShadowDOM?: boolean,        // Enable shadow DOM piercing (default: false)
  tabName?: string,              // Target tab
  timeout?: number               // Wait timeout in ms (default: 10000)
}
```

#### ScrollIntoView Action
```javascript
browser_action scrollIntoView {
  scrollIntoViewSelector: string,    // Element to scroll to
  useShadowDOM?: boolean,            // Enable shadow DOM piercing
  scrollContainer?: string,          // Custom scroll container
  scrollBehavior?: 'smooth'|'auto',  // Scroll animation
  scrollDirection?: 'up'|'down'|'both',
  maxScrollAttempts?: number         // Max scroll iterations (default: 30)
}
```

#### ClickAndWaitForPortal Action
```javascript
browser_action clickAndWaitForPortal {
  selector: string,                  // Element to click
  useShadowDOM?: boolean,            // Enable shadow DOM for click
  waitTimeout?: number,              // Initial wait (default: 1000ms)
  portalWaitTimeout?: number,        // Total wait (default: 2000ms)
  returnPortalSelector?: boolean,    // Include selector in result (default: true)
  store_variable?: boolean           // Store result in {{portal_result}}
}
```

### Browser Query Shadow DOM Support

#### Validation
```javascript
browser_query validate {
  rules: [{
    type: 'element_exists' | 'element_absent',
    selector: string,
    useShadowDOM?: boolean,
    description: string
  }]
}
```

#### Deterministic Extraction
```javascript
browser_query deterministic_extract {
  selector: string,              // Container selector
  useShadowDOM?: boolean,        // Enable shadow DOM piercing
  fields?: {                     // Field extraction map
    [key: string]: string        // fieldName: selector
  },
  limit?: number                 // Max items to extract
}
```

### DOM Toolkit Shadow DOM Support

The DOM capture system automatically includes shadow DOM content:
- `includeShadowTree: true` in CDP snapshot
- Shadow root nodes included in DOM exploration
- Portal detection works across shadow boundaries

## Implementation Details

### Shadow DOM Selector Processing

The `processShadowDOMSelector` function intelligently transforms selectors for shadow piercing:

```javascript
// Input: "host-element button.submit"
// Output: "host-element >> button.submit"

// Handles complex selectors:
// Input: "[aria-label='Add to cart']"
// Output: "[aria-label='Add to cart']" (no change needed)

// Input: "my-component [data-test='submit'] button"
// Output: "my-component >> [data-test='submit'] >> button"
```

### Visibility-First Matching Algorithm

When `useShadowDOM: true`, the system finds all matching elements and selects the first visible one:

```javascript
// 1. Find all elements matching selector (including in shadow DOM)
const elements = findAllElements(selector);

// 2. Filter by visibility
const visibleElement = elements.find(el => isVisible(el));

// 3. Visibility checks include:
//    - Bounding rect dimensions > 0
//    - Not display: none or visibility: hidden
//    - Within viewport bounds
//    - Shadow host is also visible (recursive check)
```

### Portal Detection Algorithm

The portal detection system uses a multi-phase approach:

```javascript
// Phase 1: Baseline capture
const baseline = captureBodyElements();

// Phase 2: User interaction
performClick();

// Phase 3: Wait for render
await wait(configuredTimeout);

// Phase 4: Detect new elements
const newElements = compareWithBaseline(baseline);

// Phase 5: Classify portals
const portals = classifyPortals(newElements);
// Checks: classes, roles, z-index, position
```

### Deep Shadow DOM Traversal

The recursive search algorithm for finding elements in nested shadow roots:

```javascript
function querySelectorDeep(selector, root = document) {
  // Handle explicit >> syntax
  if (selector.includes('>>')) {
    return handleExplicitPiercing(selector);
  }
  
  // Try light DOM first (fast path)
  const lightMatch = root.querySelector(selector);
  if (lightMatch) return lightMatch;
  
  // Recursive shadow DOM search (slow path)
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT
  );
  
  let node;
  while (node = walker.nextNode()) {
    if (node.shadowRoot) {
      const match = querySelectorDeep(selector, node.shadowRoot);
      if (match) return match;
    }
  }
  return null;
}
```

## Code Examples

### Example 1: Interacting with Web Components

```javascript
// Polymer Shop - Add to Cart
browser_action navigate { 
  url: "https://shop.polymer-project.org/detail/mens_outerwear/..." 
}

// Click button inside shadow DOM using attribute selector
browser_action click {
  selector: "[aria-label='Add this item to cart']",
  useShadowDOM: true,
  reason: "Add item to cart"
}

// Alternative: Use element hierarchy
browser_action click {
  selector: "shop-button button",
  useShadowDOM: true,
  reason: "Click button inside shop-button component"
}
```

### Example 2: Modal/Portal Workflow

```javascript
// Traditional workflow (before)
browser_action click { selector: "#open-modal" }
wait { waitType: "time", waitValue: 1000 }
dom_check_portals
browser_action type { selector: ".modal input", text: "test" }

// New compound workflow (after)
browser_action clickAndWaitForPortal {
  selector: "#open-modal",
  store_variable: true,
  reason: "Open modal and detect portal"
}

browser_action type {
  selector: "{{portal_result.portalSelector}} input",
  text: "test",
  reason: "Type in detected modal"
}
```

### Example 3: Complex Shadow DOM Navigation

```javascript
// Material UI with nested components
browser_query validate {
  rules: [{
    type: "element_exists",
    selector: "mui-dialog mui-input input[type='email']",
    useShadowDOM: true,
    description: "Email input exists in nested shadow DOM"
  }]
}

// Extract data from shadow DOM tables
browser_query deterministic_extract {
  selector: "custom-table tbody tr",
  useShadowDOM: true,
  fields: {
    name: "td:nth-child(1)",
    status: "td:nth-child(3)",
    action: "td:nth-child(4) button"
  },
  limit: 10
}
```

### Example 4: Scrolling in Shadow DOM

```javascript
// Scroll to element inside shadow DOM
browser_action scrollIntoView {
  scrollIntoViewSelector: "virtual-list item-card:nth-child(50)",
  useShadowDOM: true,
  scrollBehavior: "smooth",
  maxScrollAttempts: 50,
  reason: "Scroll to 50th item in virtual list"
}

// Scroll in custom container with shadow DOM
browser_action scrollIntoView {
  scrollIntoViewSelector: "data-grid row[data-id='123']",
  scrollContainer: ".grid-viewport",
  useShadowDOM: true,
  reason: "Scroll to specific row in data grid"
}
```

## Integration Patterns

### Pattern 1: Feature Detection

```javascript
// Check if page uses shadow DOM
dom_overview { filters: { interactives: true } }
// Look for hints about shadow hosts or web components

// Validate shadow DOM presence
browser_query validate {
  rules: [{
    type: "element_exists",
    selector: "*",
    useShadowDOM: false,
    description: "Check light DOM"
  }, {
    type: "element_exists", 
    selector: "custom-element *",
    useShadowDOM: true,
    description: "Check shadow DOM content"
  }]
}
```

### Pattern 2: Progressive Enhancement

```javascript
// Try without shadow DOM first (faster)
try {
  browser_action click { selector: "button.submit" }
} catch {
  // Fallback to shadow DOM search
  browser_action click { 
    selector: "button.submit",
    useShadowDOM: true 
  }
}
```

### Pattern 3: Portal-Aware Workflows

```javascript
// Define reusable portal interaction
function interactWithPortal(triggerSelector, portalAction) {
  // Open portal
  const result = browser_action clickAndWaitForPortal {
    selector: triggerSelector,
    useShadowDOM: true
  };
  
  // Interact with portal content
  if (result.portalsFound > 0) {
    portalAction(result.portalSelector);
  }
}

// Usage
interactWithPortal("#open-search", (portal) => {
  browser_action type {
    selector: `${portal} input[type='search']`,
    text: "search query"
  }
});
```

## Performance Considerations

### Shadow DOM Traversal Performance

1. **Fast Path Optimization**: Always checks light DOM first before shadow traversal
2. **Early Termination**: Stops searching once element is found
3. **Visibility Checks**: Only performed when multiple elements match

### Benchmarks

| Operation | Without Shadow DOM | With Shadow DOM | Impact |
|-----------|-------------------|-----------------|---------|
| Simple click | ~50ms | ~80ms | +60% |
| Deep nested click | ~50ms | ~150ms | +200% |
| Scroll to element | ~100ms | ~180ms | +80% |
| Portal detection | N/A | ~200ms | - |

### Optimization Tips

1. **Use Explicit Paths**: When you know the shadow structure, use `>>` syntax
   ```javascript
   // Faster: explicit path
   selector: "my-app >> header >> nav >> button"
   
   // Slower: deep search
   selector: "button.nav-button", useShadowDOM: true
   ```

2. **Limit Search Scope**: Use container selectors to reduce search space
   ```javascript
   // Better: scoped search
   selector: "#content-area button", useShadowDOM: true
   
   // Worse: global search
   selector: "button", useShadowDOM: true
   ```

3. **Cache Portal Selectors**: Store detected portals for reuse
   ```javascript
   browser_action clickAndWaitForPortal {
     selector: "#trigger",
     store_variable: true
   }
   // Reuse {{portal_result.portalSelector}} multiple times
   ```

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Element Not Found in Shadow DOM

**Symptom**: "Element not found" error despite element being visible

**Solutions**:
- Enable `useShadowDOM: true`
- Check if shadow root is closed (inaccessible)
- Use more specific selectors
- Try explicit `>>` syntax

```javascript
// Debug approach
dom_overview { filters: { interactives: true } }
// Look for shadow host indicators

// Try different selector strategies
browser_action click {
  selector: "host-element >> .target-class",
  useShadowDOM: true
}
```

#### 2. Wrong Element Clicked (Multiple Matches)

**Symptom**: Hidden or wrong element is clicked

**Solutions**:
- Use more specific selectors
- Add visibility-based filtering
- Use index-based selection

```javascript
// More specific selector
selector: "shop-button >> button[aria-label='Add to cart']"

// Or use deterministic extraction first
browser_query deterministic_extract {
  selector: "button",
  useShadowDOM: true,
  limit: 10
}
// Then click specific index
```

#### 3. Portal Not Detected

**Symptom**: `clickAndWaitForPortal` returns 0 portals

**Solutions**:
- Increase wait timeouts
- Check if portal renders in iframe
- Verify portal appears at body level

```javascript
browser_action clickAndWaitForPortal {
  selector: "#trigger",
  waitTimeout: 500,
  portalWaitTimeout: 3000,  // Increase timeout
  useShadowDOM: true
}
```

#### 4. Performance Issues

**Symptom**: Slow shadow DOM operations

**Solutions**:
- Use explicit `>>` paths when possible
- Limit search scope with containers
- Disable shadow DOM if not needed
- Use viewport filtering

### Debug Techniques

1. **Enable Verbose Logging**
   ```bash
   STAGEHAND_VERBOSE=2 npm start
   ```

2. **Use DOM Overview**
   ```javascript
   dom_overview { 
     filters: { outline: true, interactives: true },
     max_rows: 100 
   }
   ```

3. **Validate Shadow Structure**
   ```javascript
   browser_query validate {
     rules: [
       { type: "element_exists", selector: "shadow-host", description: "Host exists" },
       { type: "element_exists", selector: "shadow-host >> *", useShadowDOM: true, description: "Has shadow content" }
     ]
   }
   ```

## Implementation Timeline

### Phase 1: Portal Detection Foundation (Completed)
- **Date**: Initial implementation
- **Features**:
  - Portal hints in dom_overview
  - dom_check_portals tool
  - Basic portal classification

### Phase 2: Shadow DOM Support (Completed)
- **Date**: Following portal detection
- **Features**:
  - Shadow DOM piercing with `>>`
  - useShadowDOM parameter
  - CDP shadow tree capture

### Phase 3: Visibility-First Matching (Completed)
- **Date**: After shadow DOM base
- **Features**:
  - Intelligent element selection
  - Visibility checks across boundaries
  - Debug logging for matches

### Phase 4: Compound Actions (Completed)
- **Date**: Final phase
- **Features**:
  - clickAndWaitForPortal action
  - Variable storage integration
  - Portal selector extraction

### Bug Fixes and Enhancements

1. **Attribute Selector Fix**: Proper parsing of complex selectors with quotes and brackets
2. **ScrollIntoView Shadow Support**: Added shadow DOM traversal to scroll operations
3. **Deep Search Enhancement**: Recursive shadow root traversal for any selector
4. **Portal Detection Defaults**: Fixed baseline snapshot handling
5. **Enhanced Portal Hints**: Text pattern matching for better detection

## Future Enhancements

### Planned Features

1. **Browser Sequence Compound Node**: Bundle multiple browser actions
2. **Animation Frame Timing**: Better synchronization with render cycles
3. **Iframe Shadow DOM**: Support for shadow DOM inside iframes
4. **Performance Mode**: Optimized traversal for known structures

### Potential Optimizations

1. **Shadow Structure Caching**: Remember shadow tree structure
2. **Parallel Element Search**: Multi-threaded shadow traversal
3. **Intelligent Retry**: Automatic fallback strategies
4. **Shadow DOM Mapping**: Visual representation of shadow boundaries

## Conclusion

The Shadow DOM and Portal Detection implementation provides the Director with powerful capabilities to interact with modern web applications. By combining shadow DOM piercing, intelligent element selection, and portal detection, the system can handle complex UI patterns found in enterprise applications, component libraries, and modern frameworks.

The implementation prioritizes developer experience with clear APIs, helpful debug information, and sensible defaults while maintaining backward compatibility and performance. The modular architecture allows for future enhancements without breaking existing workflows.

For questions or issues, refer to the troubleshooting guide or check the implementation source files in the test-harness/operator/backend directory.