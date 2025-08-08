# Dynamic Element Selection Implementation Plan

## Executive Summary

This document outlines the implementation plan for adding dynamic element selection capabilities to the Director 2.0 browser automation tools. This feature addresses a critical limitation where Directors cannot programmatically select specific elements from lists during iteration.

**Current Limitation:** Selectors must be static strings, preventing patterns like "click the Nth email in a list"

**Proposed Solution:** Add an `nth` parameter to browser actions supporting dynamic, index-based element selection

## Problem Statement

### Current State
- Browser actions only support static CSS selectors
- No way to select elements by position during iteration
- Forces Directors to use complex workarounds or abandon list processing
- Blocks ~80% of automation use cases involving lists (emails, tables, search results)

### Root Cause Analysis
```javascript
// What Directors need:
for (let i = 0; i < emails.length; i++) {
  click(email[i]);  // Not possible with current tools
}

// Current limitation:
browser_action({
  selector: "tr.zA:nth-child({{index}})"  // Variable interpolation not supported
})
```

## Technical Design

### Core Concept
Add an optional `nth` parameter to browser actions that accepts both static and dynamic indices:

```javascript
browser_action({
  action: "click",
  selector: "tr.zA",
  nth: 2  // Static: click 3rd element (0-indexed)
})

browser_action({
  action: "click", 
  selector: "tr.zA",
  nth: "{{emailIndex}}"  // Dynamic: resolved from variables
})
```

### Architecture Changes

#### 1. Browser Action Service (`browserActionService.js`)
```javascript
async performAction(page, action, config) {
  const { selector, nth } = config;
  
  if (nth !== undefined) {
    // Get all matching elements
    const elements = await page.$$(selector);
    
    // Resolve index (handles negative indices)
    const index = this.resolveIndex(nth, elements.length);
    
    if (!elements[index]) {
      throw new ElementNotFoundError(
        `No element at index ${nth} for selector: ${selector}. Found ${elements.length} elements.`
      );
    }
    
    return await this.executeAction(elements[index], action, config);
  }
  
  // Existing single-element behavior
  return await this.executeSingleElement(page, selector, action, config);
}

resolveIndex(nth, totalElements) {
  // Handle keywords
  if (nth === 'first') return 0;
  if (nth === 'last') return totalElements - 1;
  
  // Handle numeric indices
  const index = typeof nth === 'number' ? nth : parseInt(nth);
  
  // Handle negative indices (from end)
  if (index < 0) {
    return totalElements + index;
  }
  
  return index;
}
```

#### 2. Node Executor (`nodeExecutor.js`)
```javascript
async executeBrowserAction(node, memory) {
  const config = { ...node.params };
  
  // Resolve nth parameter if present
  if (config.nth !== undefined) {
    config.nth = this.resolveTemplateVariables(
      config.nth.toString(), 
      memory
    );
  }
  
  // Continue with existing execution
  return await this.browserService.performAction(
    this.page, 
    config.action, 
    config
  );
}
```

#### 3. Director Service Tool Definition (`directorService.js`)
```javascript
{
  name: 'browser_action',
  description: 'Perform browser interactions with optional element selection by index',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['click', 'type', 'navigate', ...],
        description: 'The action to perform'
      },
      selector: {
        type: 'string',
        description: 'CSS selector for the element(s)'
      },
      nth: {
        oneOf: [
          { type: 'number' },
          { type: 'string' }
        ],
        description: 'Zero-based index of element to select. Supports negative indices (-1 = last), keywords ("first", "last"), and variable references ("{{index}}")'
      }
    }
  }
}
```

### New Supporting Features

#### 1. Count Action
```javascript
browser_query({
  method: "count",
  selector: "tr.zA",
  store_variable: true
})
// Returns: { count: 14 }
```

#### 2. Shadow DOM Support
The `nth` parameter will work with shadow DOM piercing:
```javascript
browser_action({
  action: "click",
  selector: "custom-element >> .item",
  nth: 2  // Selects 3rd item inside shadow DOM
})
```

#### 3. Enhanced Error Messages
```javascript
// When nth exceeds bounds:
ElementNotFoundError: Requested index 5 but only 3 elements found matching 'tr.zA'
Elements found at indices: 0, 1, 2

// When no elements match:
ElementNotFoundError: No elements found matching selector 'tr.missing'
```

## Implementation Phases

### Phase 1: Core Implementation (Days 1-2)

**Objective:** Basic nth parameter support

**Tasks:**
1. Add `nth` parameter to browser_action schema
2. Implement element selection by index in BrowserActionService
3. Add variable resolution for nth parameter
4. Implement basic error handling
5. Add unit tests for core functionality

**Deliverables:**
- Working nth parameter for click, type, and other actions
- Support for positive integer indices
- Variable resolution ({{index}})
- Basic error messages

### Phase 2: Enhanced Features (Day 3)

**Objective:** Full feature set for production use

**Tasks:**
1. Add negative index support (-1 = last element)
2. Implement keyword support ("first", "last")
3. Add count method to browser_query
4. Enhance error messages with helpful context
5. Add integration tests

**Deliverables:**
- Negative indices working
- Keywords for common cases
- Count functionality
- Detailed error messages

### Phase 3: Shadow DOM & Polish (Day 4)

**Objective:** Complete integration and documentation

**Tasks:**
1. Ensure nth works with shadow DOM piercing
2. Add range support for extract operations
3. Update Director system prompt with examples
4. Create migration guide
5. Add debug/highlight action

**Deliverables:**
- Full shadow DOM compatibility
- Range selection for extraction
- Comprehensive documentation
- Debug tools

### Phase 4: Advanced Features (Day 5 - Optional)

**Objective:** Power user features

**Tasks:**
1. Add visual debugging (highlight nth element)
2. Implement range syntax ("0:5" for first 5 elements)
3. Add performance optimizations for large lists
4. Create cookbook of common patterns

**Deliverables:**
- Debug visualization
- Range operations
- Performance improvements
- Pattern library

## Key Design Decisions

### 1. Zero-based vs One-based Indexing
**Decision:** Zero-based indexing

**Rationale:**
- Consistent with JavaScript arrays
- Matches Playwright conventions
- Directors are technical users
- Allows direct use of iteration indices

**Trade-off:** May require mental adjustment for non-programmers

### 2. Parameter vs Selector Syntax
**Decision:** Separate `nth` parameter

**Options Considered:**
- A) `{selector: "tr.zA", nth: 2}` ✓
- B) `{selector: "tr.zA[2]"}`
- C) `{selector: "tr.zA:nth(2)"}`

**Rationale:**
- Cleaner API design
- Easier validation and error handling
- Better variable resolution
- No CSS parser modifications needed

### 3. Error Handling Strategy
**Decision:** Fail fast with descriptive errors

**Rationale:**
- Prevents silent failures
- Aids debugging
- Matches existing Director patterns
- Clear action required from user

### 4. Negative Index Support
**Decision:** Support negative indices

**Rationale:**
- Common programming pattern
- Useful for "last element" cases
- Minimal implementation complexity
- Improves expressiveness

## Usage Examples

### Basic Usage
```javascript
// Click the third email
browser_action({
  action: "click",
  selector: "tr.zA",
  nth: 2
})

// Click the last button
browser_action({
  action: "click",
  selector: "button.submit",
  nth: -1
})
```

### Dynamic Usage in Iteration
```javascript
// Process each email by index
iterate({
  over: "{{emailList}}",
  variable: "email",
  index: "idx",
  body: [
    {
      type: "browser_action",
      config: {
        action: "click",
        selector: "tr.zA",
        nth: "{{idx}}"
      }
    }
  ]
})
```

### With Keywords
```javascript
// Click first and last elements
browser_action({
  action: "click",
  selector: ".tab",
  nth: "first"
})

browser_action({
  action: "click",
  selector: ".tab",
  nth: "last"
})
```

### Count Before Processing
```javascript
// Get total count first
browser_query({
  method: "count",
  selector: "tr.zA",
  store_variable: true,
  alias: "email_count"
})

// Process all except last
iterate({
  over: "{{Array(email_count.count - 1).keys()}}",
  variable: "index",
  body: [
    {
      type: "browser_action",
      config: {
        action: "click",
        selector: "tr.zA",
        nth: "{{index}}"
      }
    }
  ]
})
```

## Backwards Compatibility

### Compatibility Guarantees
1. All existing workflows continue working unchanged
2. The `nth` parameter is optional
3. Default behavior remains "first matching element"
4. No changes to existing error messages for non-nth usage

### Migration Path
```javascript
// Old approach (still works)
browser_action({
  action: "click",
  selector: "button:first-child"
})

// New approach (more flexible)
browser_action({
  action: "click",
  selector: "button",
  nth: 0
})
```

## Testing Strategy

### Unit Tests
- Index resolution (positive, negative, keywords)
- Variable interpolation
- Error cases (out of bounds, no matches)
- Shadow DOM interaction

### Integration Tests
- Full workflow with iteration
- Multiple tab handling
- Complex selectors with nth
- Performance with large lists

### Manual Testing Scenarios
1. Gmail email list processing
2. Airtable row selection
3. Search result navigation
4. Dropdown option selection

## Performance Considerations

### Optimization Strategies
1. Cache element queries within same action
2. Use efficient Playwright selectors
3. Minimize re-queries during iteration
4. Batch element operations when possible

### Benchmarks
- Target: <100ms overhead for nth selection
- Test with 1000+ element lists
- Profile memory usage with element arrays

## Documentation Updates

### System Prompt Additions
```javascript
// New section: Dynamic Element Selection
When you need to select specific elements by position:
- Use the 'nth' parameter with browser actions
- Zero-based indexing (0 = first element)
- Supports negative indices (-1 = last element)
- Keywords: "first", "last"
- Variable references: nth: "{{index}}"

Example: Clicking through a list of emails
browser_action({
  action: "click",
  selector: "tr.email-row",
  nth: "{{emailIndex}}"
})
```

### Error Message Guidelines
- Always include selector and requested index
- Show how many elements were found
- Suggest alternatives when appropriate
- Include action context

## Success Metrics

### Functionality Metrics
- [ ] All browser actions support nth parameter
- [ ] Variable resolution works correctly
- [ ] Shadow DOM compatibility confirmed
- [ ] Error messages are helpful

### Usage Metrics
- [ ] 50% reduction in workaround patterns
- [ ] Successful list processing workflows
- [ ] No regression in existing workflows
- [ ] Positive Director feedback

## Rollout Plan

### Week 1
- Phase 1 & 2 implementation
- Internal testing
- Core functionality ready

### Week 2  
- Phase 3 implementation
- Documentation complete
- Beta testing with select Directors

### Week 3
- Phase 4 (if needed)
- Full rollout
- Monitor usage patterns

## Appendix: Technical Details

### Variable Resolution Flow
1. Node executor receives `nth: "{{index}}"`
2. Calls `resolveTemplateVariables("{{index}}", memory)`
3. Returns resolved value (e.g., "2")
4. BrowserActionService receives nth as string "2"
5. Parses to integer and selects element

### Error Handling Hierarchy
1. **No elements found**: ElementNotFoundError
2. **Index out of bounds**: IndexOutOfBoundsError  
3. **Invalid index format**: InvalidParameterError
4. **Variable not found**: VariableResolutionError

### Shadow DOM Implementation
```javascript
// Current shadow piercing
const parts = selector.split('>>');
let element = page;
for (const part of parts) {
  element = element.$(part.trim());
}

// With nth support
const parts = selector.split('>>');
let elements = [page];
for (const part of parts) {
  const newElements = [];
  for (const el of elements) {
    const found = await el.$$(part.trim());
    newElements.push(...found);
  }
  elements = newElements;
}
return elements[resolvedIndex];
```

## Conclusion

This implementation plan addresses a critical limitation in the Director 2.0 platform. By adding dynamic element selection, we enable Directors to build robust automations for list-based workflows, which represent the majority of real-world automation needs.

The phased approach ensures we deliver value quickly while building toward a comprehensive solution. The design maintains backwards compatibility while providing powerful new capabilities that will significantly improve the Director experience.