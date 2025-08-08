# DOM Inspection Tools Enhancement Plan

## Overview

This document outlines the implementation plan for enhancing `dom_inspect` and `dom_click_inspect` tools to provide comprehensive selector generation, validation, and intelligent recommendations for the Director 2.0 system.

## Goals

1. **Reliability**: Ensure selectors are unique and stable
2. **Comprehensiveness**: Generate ALL possible selectors, not just the "good" ones
3. **Intelligence**: Provide context-aware recommendations
4. **Actionability**: Give complete interaction and state information

## Enhancement Specifications

### 1. Selector Testing & Validation (HIGH PRIORITY)

#### Implementation
Add a selector validation system that tests each generated selector in real-time.

```javascript
// New method in dom_click_inspect and dom_inspect
async validateSelector(page, selector) {
  return {
    selector: selector,
    matchCount: 0,      // How many elements match
    isUnique: false,    // true if matchCount === 1
    performance: 0,     // milliseconds to execute
    matches: [],        // Array of matching element IDs
    error: null         // If selector is invalid
  };
}
```

#### Features
- Test each selector against current DOM
- Measure query performance
- Return match count and element IDs
- Flag non-unique selectors with warnings

#### Output Example
```json
{
  "selector": "[data-testid='submit-button']",
  "validation": {
    "matchCount": 1,
    "isUnique": true,
    "performance": 0.23,
    "matches": ["[456]"]
  }
}
```

### 2. Exhaustive Selector Generation Mode (HIGH PRIORITY)

#### New Selector Types to Add

```javascript
// Enhanced generateStableSelectors method
generateExhaustiveSelectors(element, mode = 'exhaustive') {
  const selectors = [];
  
  // 1. ID Selector (existing)
  
  // 2. ALL Attribute Selectors (new)
  // Not just data-* but every single attribute
  for (const attr of element.attributes) {
    selectors.push({
      selector: `[${attr.name}="${attr.value}"]`,
      type: 'attribute',
      attribute: attr.name,
      reliability: this.assessAttributeReliability(attr.name)
    });
  }
  
  // 3. Combination Attribute Selectors (new)
  // Find unique combinations of 2-3 attributes
  selectors.push(...this.generateAttributeCombinations(element));
  
  // 4. Position-based Selectors (new)
  selectors.push({
    selector: `:nth-child(${this.getNthChildIndex(element)})`,
    type: 'position',
    reliability: 'low'
  });
  
  // 5. XPath Selectors (new)
  selectors.push({
    selector: this.generateXPath(element),
    type: 'xpath',
    reliability: 'medium'
  });
  
  // 6. Parent-Context Selectors (new)
  selectors.push(...this.generateContextualSelectors(element));
  
  // 7. Text-based for Multiple Frameworks (new)
  selectors.push(...this.generateFrameworkTextSelectors(element));
  
  // 8. Unique Class Combinations (enhanced)
  selectors.push(...this.generateUniqueClassCombinations(element));
  
  // 9. Sibling-based Selectors (new)
  selectors.push(...this.generateSiblingSelectors(element));
  
  // 10. Custom Property Selectors (new)
  // For React props, Vue directives, etc.
  selectors.push(...this.generateCustomPropertySelectors(element));
  
  return selectors;
}
```

#### Selector Categories
1. **Attribute-based**
   - Single attributes: `[name="email"]`
   - Multiple attributes: `[type="submit"][value="Save"]`
   - Partial matches: `[class*="submit"]`
   - Custom attributes: `[data-row-id="123"]`

2. **Position-based**
   - nth-child: `:nth-child(3)`
   - nth-of-type: `button:nth-of-type(2)`
   - first/last: `:first-child`, `:last-of-type`
   - Index in parent: `div > p:nth-child(2)`

3. **Context-based**
   - Within parent: `.modal button[type="submit"]`
   - After sibling: `label:contains("Email") + input`
   - Within section: `section[aria-label="User Info"] input[name="email"]`

4. **Text-based**
   - Exact text: `:contains("Submit")` (jQuery/Testing Library)
   - Partial text: `*[text()*="Submit"]` (XPath)
   - Case-insensitive: `button:icontains("submit")`

5. **Framework-specific**
   - React: `[data-reactid]`, React component names
   - Vue: `[v-for]`, `[v-if]`
   - Angular: `[ng-click]`, `[ng-model]`

### 3. Smart Selector Recommendations (HIGH PRIORITY)

#### Implementation
Add an intelligent recommendation system that analyzes selectors and provides context-aware suggestions.

```javascript
// New method
generateSelectorRecommendations(selectors, element, context) {
  const recommendations = {
    preferred: null,      // Best overall choice
    stable: null,         // Most stable over time
    performance: null,    // Fastest execution
    fallback: null,       // If preferred fails
    warnings: [],         // Potential issues
    suggestions: []       // Improvement suggestions
  };
  
  // Analyze each selector
  selectors.forEach(sel => {
    const score = this.scoreSelectorQuality(sel, element, context);
    // ... recommendation logic
  });
  
  return recommendations;
}
```

#### Recommendation Categories

1. **Stability Recommendations**
   ```
   ✅ STABLE: [data-testid="submit-button"] 
      - Test-specific attribute unlikely to change
      - Unique match guaranteed
      - Recommended for production workflows
   ```

2. **Performance Recommendations**
   ```
   ⚡ FASTEST: #submit-btn (0.1ms)
      - ID selectors are always fastest
      - Use when performance is critical
   ```

3. **Context-Aware Recommendations**
   ```
   📍 CONTEXTUAL: .modal-active button[type="submit"]
      - Best when element appears in multiple contexts
      - Ensures correct element in modals/popups
   ```

4. **Warnings & Suggestions**
   ```
   ⚠️ WARNING: Only position-based selectors available
      - High risk of breaking if DOM structure changes
      - Suggestion: Ask developers to add data-testid="unique-name"
   
   ⚠️ WARNING: Class "btn-hf83js" appears to be dynamic
      - Likely generated by CSS-in-JS
      - Will change on rebuild
   ```

### 4. Element State Information (MEDIUM PRIORITY)

#### Implementation
Comprehensive state detection for form elements and interactive components.

```javascript
// New method
getElementState(element) {
  const state = {
    // Form states
    checked: element.checked,
    selected: element.selected,
    disabled: element.disabled,
    readOnly: element.readOnly,
    required: element.required,
    value: element.value,
    
    // ARIA states
    ariaExpanded: element.getAttribute('aria-expanded'),
    ariaSelected: element.getAttribute('aria-selected'),
    ariaChecked: element.getAttribute('aria-checked'),
    ariaPressed: element.getAttribute('aria-pressed'),
    ariaHidden: element.getAttribute('aria-hidden'),
    
    // Visual states
    visible: this.isVisible(element),
    inViewport: this.isInViewport(element),
    focused: element === document.activeElement,
    
    // Interaction states
    contentEditable: element.contentEditable === 'true',
    draggable: element.draggable,
    
    // Custom states
    dataStates: this.extractDataStates(element),
    classStates: this.extractClassStates(element)
  };
  
  return state;
}
```

#### State Categories

1. **Form Element States**
   - Input: value, placeholder, type, pattern, min/max
   - Checkbox/Radio: checked, indeterminate
   - Select: selected options, multiple
   - Textarea: value, rows, cols

2. **Component States**
   - Accordion: expanded/collapsed
   - Tab: active/inactive
   - Modal: open/closed
   - Dropdown: open/closed, selected item

3. **Validation States**
   - Valid/invalid
   - Error messages
   - Required fields
   - Pattern matching

### 5. Interaction Hints (MEDIUM PRIORITY)

#### Implementation
Detect and report how elements should be interacted with.

```javascript
// New method
getInteractionHints(element) {
  return {
    primaryAction: 'click',           // click, type, select, drag
    supportedActions: ['click', 'focus', 'hover'],
    
    clickBehavior: {
      requiresDoubleClick: false,
      opensMenu: this.detectDropdown(element),
      submitsForm: this.isFormSubmit(element),
      navigates: element.tagName === 'A',
      togglesState: this.detectToggle(element)
    },
    
    keyboardShortcuts: {
      enter: this.respondsToEnter(element),
      space: this.respondsToSpace(element),
      escape: this.respondsToEscape(element),
      tab: element.tabIndex >= 0
    },
    
    formContext: {
      isFormElement: this.isInForm(element),
      formId: this.getFormId(element),
      submitsOnEnter: this.formSubmitsOnEnter(element),
      validationTrigger: this.getValidationTrigger(element)
    },
    
    specialBehaviors: {
      hasTooltip: this.hasTooltip(element),
      hasPopover: this.hasPopover(element),
      triggersAjax: this.detectAjaxTrigger(element),
      hasConfirmation: this.detectConfirmDialog(element)
    }
  };
}
```

### 6. Framework Detection (LOW PRIORITY)

#### Implementation
Detect which framework/library is being used.

```javascript
// New method
detectFramework(element) {
  return {
    framework: 'react',  // react, vue, angular, vanilla
    version: '18.2.0',
    
    componentInfo: {
      componentName: this.getReactComponentName(element),
      props: this.getReactProps(element),
      state: this.getComponentState(element)
    },
    
    shadowDOM: {
      isInShadowDOM: this.isInShadowRoot(element),
      shadowRoot: element.getRootNode(),
      pierceSelector: this.generateShadowSelector(element)
    },
    
    frameworkSpecific: {
      reactFiber: this.getReactFiber(element),
      vueInstance: this.getVueInstance(element),
      angularScope: this.getAngularScope(element)
    }
  };
}
```

### 7. Parent Context Selectors (LOW PRIORITY)

#### Implementation
Generate selectors that work within specific contexts.

```javascript
// New method
generateContextualSelectors(element) {
  const contextual = [];
  
  // Within labeled section
  const section = this.findLabeledAncestor(element);
  if (section) {
    contextual.push({
      selector: `[aria-label="${section.label}"] ${baseSelector}`,
      type: 'contextual',
      context: 'labeled-section'
    });
  }
  
  // Within data row containing specific text
  const row = this.findDataRow(element);
  if (row) {
    contextual.push({
      selector: `tr:contains("${row.identifier}") ${baseSelector}`,
      type: 'contextual',
      context: 'table-row'
    });
  }
  
  return contextual;
}
```

### 8. Historical Stability Check (LOW PRIORITY)

#### Implementation
Track selector stability over time using cached snapshots.

```javascript
// New method
checkSelectorStability(selector, workflowId) {
  const history = this.getSelectorHistory(selector, workflowId);
  
  return {
    stability: 'stable',  // stable, unstable, new
    matchHistory: [
      { timestamp: '...', matched: true, elementId: '[123]' },
      { timestamp: '...', matched: true, elementId: '[123]' }
    ],
    stabilityScore: 0.95,  // 0-1
    recommendation: 'Safe to use - stable for 10+ snapshots'
  };
}
```

## API Changes

### Enhanced dom_click_inspect Options

```javascript
{
  // Existing options
  x: 100,
  y: 200,
  includeParentChain: true,
  includeChildren: false,
  
  // New options
  selectorMode: 'exhaustive',  // 'stable' | 'exhaustive' | 'smart'
  validateSelectors: true,     // Test each selector
  includeState: true,          // Element state info
  includeInteractionHints: true,
  detectFramework: true,
  includeRecommendations: true,
  checkStability: true         // Requires snapshot history
}
```

### Enhanced dom_inspect Options

```javascript
{
  // Existing options
  elementId: '[123]',
  include: { ... },
  
  // New options (same as dom_click_inspect)
  selectorMode: 'exhaustive',
  validateSelectors: true,
  includeState: true,
  includeInteractionHints: true,
  detectFramework: true,
  includeRecommendations: true,
  checkStability: true
}
```

## Output Format Example

```javascript
{
  success: true,
  element: {
    // Basic info (existing)
    tag: 'button',
    text: 'Submit',
    bounds: [100, 200, 80, 40],
    
    // Enhanced selectors with validation
    selectors: [
      {
        selector: '[data-testid="submit-button"]',
        type: 'data-attribute',
        reliability: 'high',
        validation: {
          isUnique: true,
          matchCount: 1,
          performance: 0.12
        }
      },
      // ... 20+ more selectors in exhaustive mode
    ],
    
    // Smart recommendations
    recommendations: {
      preferred: {
        selector: '[data-testid="submit-button"]',
        reason: 'Unique, stable, and test-friendly'
      },
      performance: {
        selector: '#submit-btn',
        reason: 'Fastest query time (0.08ms)'
      },
      warnings: [
        'No semantic HTML - button is actually a <div>',
        'Element is only sometimes visible - check state first'
      ],
      suggestions: [
        'Element lacks aria-label for accessibility',
        'Consider adding data-testid for more stable testing'
      ]
    },
    
    // Complete state information
    state: {
      disabled: false,
      ariaExpanded: 'false',
      visible: true,
      focused: false,
      customStates: {
        'data-loading': 'false',
        'data-submitted': 'true'
      }
    },
    
    // Interaction hints
    interactions: {
      primaryAction: 'click',
      clickBehavior: {
        submitsForm: true,
        requiresDoubleClick: false
      },
      keyboardShortcuts: {
        enter: true,
        space: false
      },
      formContext: {
        isFormElement: true,
        formId: 'login-form',
        submitsOnEnter: true
      }
    },
    
    // Framework detection
    framework: {
      detected: 'react',
      componentName: 'SubmitButton',
      shadowDOM: false
    }
  }
}
```

## Implementation Priority & Timeline

### Phase 1 (Week 1-2) - Critical Features
1. **Selector Validation System**
   - Add validation to both tools
   - Real-time testing of selectors
   - Performance measurement

2. **Exhaustive Selector Generation**
   - Implement all selector types
   - Add mode selection option
   - Ensure backwards compatibility

3. **Smart Recommendations Engine**
   - Basic recommendation logic
   - Warnings for unstable selectors
   - Context-aware suggestions

### Phase 2 (Week 3) - Enhanced Intelligence
4. **State Information System**
   - Complete state detection
   - ARIA state handling
   - Custom state extraction

5. **Interaction Hints**
   - Click behavior detection
   - Keyboard shortcut detection
   - Form context analysis

### Phase 3 (Week 4) - Advanced Features
6. **Framework Detection**
   - React/Vue/Angular detection
   - Shadow DOM handling
   - Component information extraction

7. **Contextual Selectors**
   - Parent context generation
   - Sibling-based selectors
   - Complex relationships

8. **Historical Stability**
   - Snapshot comparison system
   - Stability scoring
   - Trend analysis

## Testing Strategy

1. **Unit Tests**
   - Test each selector generator
   - Validate recommendation logic
   - State detection accuracy

2. **Integration Tests**
   - Test against real websites
   - Multiple framework coverage
   - Edge case handling

3. **Performance Tests**
   - Selector generation speed
   - Validation performance
   - Memory usage with exhaustive mode

## Success Metrics

1. **Selector Uniqueness**: 95%+ of generated selectors should be unique
2. **Stability Score**: Track selector stability over time
3. **Performance**: Selector generation < 100ms even in exhaustive mode
4. **Coverage**: Successfully generate selectors for 99%+ of interactive elements
5. **Director Satisfaction**: Reduce workflow creation time by 40%

## Migration Guide

The enhancements are backwards compatible. Existing workflows will continue to function with the default 'stable' selector mode. To access new features:

```javascript
// Old way (still works)
dom_click_inspect({ x: 100, y: 200 })

// New way with enhancements
dom_click_inspect({ 
  x: 100, 
  y: 200,
  selectorMode: 'exhaustive',
  includeRecommendations: true
})
```

## Conclusion

These enhancements will transform the DOM inspection tools from simple element inspectors into intelligent automation assistants that help the Director create more reliable, maintainable workflows. The phased approach ensures we deliver immediate value while building toward a comprehensive solution.