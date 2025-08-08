# Exhaustive Selector Generation & Validation Implementation

## Overview

This document provides the complete implementation details for combining exhaustive selector generation with real-time validation in the Director 2.0 DOM inspection tools. The implementation creates a unified selector discovery system that generates ALL possible selectors and validates them in a single browser context execution.

## Core Architecture

### Design Principles

1. **Single Browser Evaluation**: Generate and validate selectors in one `page.evaluate()` call
2. **Exhaustive Generation**: Create ALL possible selector types, not just "good" ones
3. **Real DOM Validation**: Test against live DOM, not cached snapshots
4. **Intelligent Ranking**: Sort by uniqueness, specificity, and reliability
5. **No Backward Compatibility Constraints**: New feature, clean implementation

### File Structure

```
/test-harness/operator/backend/
├── tools/
│   └── domExplorationTools.js          # Tool parameter definitions
├── services/
│   └── domToolkitService.js           # Main implementation
└── dom-toolkit/
    └── index.js                        # dom_inspect integration
```

## Complete Implementation

### Step 1: Update Tool Parameters

**File**: `/test-harness/operator/backend/tools/domExplorationTools.js`

Add these parameters to the `dom_click_inspect` tool definition (after line 320):

```javascript
selectorMode: {
  type: 'string',
  enum: ['stable', 'exhaustive', 'smart'],
  description: 'Selector generation mode. stable: only reliable selectors (default), exhaustive: ALL possible selectors with validation, smart: intelligent selection based on context',
  default: 'stable'
},
validateSelectors: {
  type: 'boolean',
  description: 'Validate each selector for uniqueness and validity. Default true for exhaustive mode, false for stable mode',
  default: null  // Will be set based on selectorMode
},
maxSelectors: {
  type: 'number',
  description: 'Maximum number of selectors to return in exhaustive mode (default: 50)',
  default: 50,
  minimum: 1,
  maximum: 200
},
includeNonUnique: {
  type: 'boolean',
  description: 'Include non-unique selectors in results (default: true)',
  default: true
}
```

### Step 2: Implement ExhaustiveSelectorGenerator Class

**File**: `/test-harness/operator/backend/services/domToolkitService.js`

Insert this complete implementation inside the `page.evaluate()` call (after the ActionableFilter class definition, around line 614):

```javascript
// Add after ActionableFilter class (line ~614)
class ExhaustiveSelectorGenerator {
  constructor() {
    this.MAX_ATTRIBUTE_LENGTH = 100;
    this.MAX_TEXT_LENGTH = 50;
    this.MAX_COMBO_DEPTH = 3;
  }

  /**
   * Main entry point - generates candidates based on mode
   */
  async generateCandidateSelectors(element, mode = 'stable') {
    if (mode === 'stable') {
      // Use existing stable selector generation
      return this.generateStableSelectors(element);
    }
    
    const selectors = [];
    
    // In exhaustive mode, generate ALL selector types
    selectors.push(...this.generateIdSelectors(element));
    selectors.push(...this.generateAttributeSelectors(element));
    selectors.push(...this.generateClassSelectors(element));
    selectors.push(...this.generatePositionSelectors(element));
    selectors.push(...this.generateTextSelectors(element));
    selectors.push(...this.generateContextSelectors(element));
    selectors.push(...this.generateSiblingSelectors(element));
    selectors.push(...this.generateFrameworkSelectors(element));
    selectors.push(...this.generateAriaSelectors(element));
    selectors.push(...this.generateCombinationSelectors(element));
    
    return selectors;
  }

  /**
   * Existing stable selector generation (moved from VisualInspector)
   */
  generateStableSelectors(element) {
    const selectors = [];
    
    // 1. ID selector (most stable)
    if (element.id) {
      selectors.push({
        selector: `#${element.id}`,
        type: 'id',
        specificity: 100,
        strategy: 'stable'
      });
    }

    // 2. Data attribute selectors (test-friendly)
    const dataAttrs = ['data-testid', 'data-cy', 'data-test', 'data-qa', 'data-id'];
    for (const attr of dataAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        selectors.push({
          selector: `[${attr}="${CSS.escape(value)}"]`,
          type: 'data-attribute',
          attribute: attr,
          specificity: 90,
          strategy: 'stable'
        });
      }
    }

    // 3. Unique class combinations
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.length > 0 && !c.match(/^[a-z0-9]{8}$/i));
      if (classes.length > 0) {
        selectors.push({
          selector: `.${classes.map(c => CSS.escape(c)).join('.')}`,
          type: 'class-combo',
          specificity: 20 * classes.length,
          strategy: 'stable'
        });
      }
    }

    // 4. ARIA selectors
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel && ariaLabel.length < this.MAX_TEXT_LENGTH) {
      selectors.push({
        selector: `[aria-label="${CSS.escape(ariaLabel)}"]`,
        type: 'aria',
        specificity: 50,
        strategy: 'stable'
      });
    }

    // 5. Text-based selectors (least stable)
    const text = element.textContent?.trim();
    if (text && text.length < this.MAX_TEXT_LENGTH) {
      selectors.push({
        selector: `${element.tagName.toLowerCase()}:contains("${text}")`,
        type: 'text',
        specificity: 5,
        strategy: 'stable',
        requiresLibrary: 'jquery/playwright'
      });
    }

    return selectors;
  }

  /**
   * Generate ID-based selectors
   */
  generateIdSelectors(element) {
    if (!element.id) return [];
    
    return [{
      selector: `#${CSS.escape(element.id)}`,
      type: 'id',
      specificity: 100,
      strategy: 'exhaustive'
    }];
  }

  /**
   * Generate all attribute selectors
   */
  generateAttributeSelectors(element) {
    const selectors = [];
    
    for (const attr of element.attributes) {
      // Skip certain attributes
      if (['class', 'id', 'style'].includes(attr.name)) continue;
      if (attr.value.length > this.MAX_ATTRIBUTE_LENGTH) continue;
      
      // Single attribute selector
      selectors.push({
        selector: `[${attr.name}="${CSS.escape(attr.value)}"]`,
        type: 'attribute',
        attribute: attr.name,
        specificity: this.getAttributeSpecificity(attr.name),
        strategy: 'exhaustive'
      });
      
      // Tag + attribute combo
      selectors.push({
        selector: `${element.tagName.toLowerCase()}[${attr.name}="${CSS.escape(attr.value)}"]`,
        type: 'tag-attribute',
        attribute: attr.name,
        specificity: this.getAttributeSpecificity(attr.name) + 10,
        strategy: 'exhaustive'
      });
    }
    
    return selectors;
  }

  /**
   * Generate class-based selectors
   */
  generateClassSelectors(element) {
    if (!element.className) return [];
    
    const selectors = [];
    const classes = element.className.split(' ').filter(c => c.length > 0);
    
    // Single classes
    classes.forEach(cls => {
      selectors.push({
        selector: `.${CSS.escape(cls)}`,
        type: 'class',
        specificity: 10,
        strategy: 'exhaustive'
      });
      
      // Tag + class
      selectors.push({
        selector: `${element.tagName.toLowerCase()}.${CSS.escape(cls)}`,
        type: 'tag-class',
        specificity: 15,
        strategy: 'exhaustive'
      });
    });
    
    // All possible class combinations (2-3 classes)
    for (let size = 2; size <= Math.min(classes.length, 3); size++) {
      const combinations = this.getCombinations(classes, size);
      combinations.forEach(combo => {
        selectors.push({
          selector: `.${combo.map(c => CSS.escape(c)).join('.')}`,
          type: 'class-combo',
          specificity: 10 * combo.length,
          strategy: 'exhaustive'
        });
      });
    }
    
    return selectors;
  }

  /**
   * Generate position-based selectors
   */
  generatePositionSelectors(element) {
    const selectors = [];
    const parent = element.parentElement;
    if (!parent) return selectors;
    
    const siblings = Array.from(parent.children);
    const index = siblings.indexOf(element);
    const tagName = element.tagName.toLowerCase();
    const sameTagSiblings = siblings.filter(el => el.tagName === element.tagName);
    const tagIndex = sameTagSiblings.indexOf(element);
    
    // nth-child selectors
    selectors.push({
      selector: `:nth-child(${index + 1})`,
      type: 'nth-child',
      specificity: 1,
      strategy: 'exhaustive'
    });
    
    // nth-of-type selectors
    selectors.push({
      selector: `${tagName}:nth-of-type(${tagIndex + 1})`,
      type: 'nth-of-type',
      specificity: 2,
      strategy: 'exhaustive'
    });
    
    // First/last child
    if (index === 0) {
      selectors.push({
        selector: ':first-child',
        type: 'first-child',
        specificity: 3,
        strategy: 'exhaustive'
      });
      
      selectors.push({
        selector: `${tagName}:first-of-type`,
        type: 'first-of-type',
        specificity: 3,
        strategy: 'exhaustive'
      });
    }
    
    if (index === siblings.length - 1) {
      selectors.push({
        selector: ':last-child',
        type: 'last-child',
        specificity: 3,
        strategy: 'exhaustive'
      });
      
      selectors.push({
        selector: `${tagName}:last-of-type`,
        type: 'last-of-type',
        specificity: 3,
        strategy: 'exhaustive'
      });
    }
    
    // Only child
    if (siblings.length === 1) {
      selectors.push({
        selector: ':only-child',
        type: 'only-child',
        specificity: 4,
        strategy: 'exhaustive'
      });
    }
    
    return selectors;
  }

  /**
   * Generate text-based selectors
   */
  generateTextSelectors(element) {
    const selectors = [];
    const text = element.textContent?.trim();
    
    if (!text || text.length > this.MAX_TEXT_LENGTH) return selectors;
    
    const tagName = element.tagName.toLowerCase();
    
    // jQuery/Playwright :contains
    selectors.push({
      selector: `:contains("${text}")`,
      type: 'text-contains',
      specificity: 5,
      strategy: 'exhaustive',
      requiresLibrary: 'jquery/playwright'
    });
    
    // Tag + contains
    selectors.push({
      selector: `${tagName}:contains("${text}")`,
      type: 'tag-text-contains',
      specificity: 7,
      strategy: 'exhaustive',
      requiresLibrary: 'jquery/playwright'
    });
    
    // XPath text selectors
    selectors.push({
      selector: `//*[text()="${text}"]`,
      type: 'xpath-exact-text',
      specificity: 6,
      strategy: 'exhaustive',
      isXPath: true
    });
    
    selectors.push({
      selector: `//*[contains(text(), "${text}")]`,
      type: 'xpath-contains-text',
      specificity: 5,
      strategy: 'exhaustive',
      isXPath: true
    });
    
    // Normalized space XPath
    selectors.push({
      selector: `//*[normalize-space()="${text}"]`,
      type: 'xpath-normalized-text',
      specificity: 6,
      strategy: 'exhaustive',
      isXPath: true
    });
    
    return selectors;
  }

  /**
   * Generate context-based selectors (parent > child)
   */
  generateContextSelectors(element, maxDepth = 3) {
    const selectors = [];
    const tagName = element.tagName.toLowerCase();
    
    // Build parent chain
    const parents = [];
    let current = element.parentElement;
    let depth = 0;
    
    while (current && depth < maxDepth) {
      const parentDescriptor = this.getElementDescriptor(current);
      if (parentDescriptor) {
        parents.push(parentDescriptor);
      }
      current = current.parentElement;
      depth++;
    }
    
    // Generate selectors for each parent level
    for (let i = 0; i < parents.length; i++) {
      const parentChain = parents.slice(0, i + 1).reverse();
      const contextSelector = parentChain.join(' ') + ' ' + tagName;
      
      selectors.push({
        selector: contextSelector,
        type: 'context',
        depth: i + 1,
        specificity: 15 * (i + 1),
        strategy: 'exhaustive'
      });
      
      // Also with direct child combinator
      const directChildSelector = parentChain.join(' > ') + ' > ' + tagName;
      selectors.push({
        selector: directChildSelector,
        type: 'context-direct',
        depth: i + 1,
        specificity: 20 * (i + 1),
        strategy: 'exhaustive'
      });
    }
    
    return selectors;
  }

  /**
   * Generate sibling-based selectors
   */
  generateSiblingSelectors(element) {
    const selectors = [];
    const prev = element.previousElementSibling;
    const next = element.nextElementSibling;
    const tagName = element.tagName.toLowerCase();
    
    if (prev) {
      const prevDescriptor = this.getElementDescriptor(prev);
      if (prevDescriptor) {
        // Adjacent sibling
        selectors.push({
          selector: `${prevDescriptor} + ${tagName}`,
          type: 'adjacent-sibling',
          specificity: 25,
          strategy: 'exhaustive'
        });
        
        // General sibling
        selectors.push({
          selector: `${prevDescriptor} ~ ${tagName}`,
          type: 'general-sibling',
          specificity: 20,
          strategy: 'exhaustive'
        });
      }
    }
    
    return selectors;
  }

  /**
   * Generate framework-specific selectors
   */
  generateFrameworkSelectors(element) {
    const selectors = [];
    
    // React
    const reactProps = this.getReactProps(element);
    if (reactProps) {
      selectors.push({
        selector: `[data-reactroot] ${element.tagName.toLowerCase()}`,
        type: 'react',
        specificity: 30,
        strategy: 'exhaustive',
        framework: 'react'
      });
    }
    
    // Vue
    const vueAttrs = ['v-for', 'v-if', 'v-show', 'v-model', '@click', ':class'];
    vueAttrs.forEach(attr => {
      if (element.hasAttribute(attr)) {
        selectors.push({
          selector: `[${attr}]`,
          type: 'vue-directive',
          specificity: 35,
          strategy: 'exhaustive',
          framework: 'vue'
        });
      }
    });
    
    // Angular
    const ngAttrs = ['ng-repeat', 'ng-if', 'ng-show', 'ng-model', 'ng-click', '*ngFor', '*ngIf'];
    ngAttrs.forEach(attr => {
      if (element.hasAttribute(attr)) {
        selectors.push({
          selector: `[${attr}]`,
          type: 'angular-directive',
          specificity: 35,
          strategy: 'exhaustive',
          framework: 'angular'
        });
      }
    });
    
    return selectors;
  }

  /**
   * Generate ARIA-based selectors
   */
  generateAriaSelectors(element) {
    const selectors = [];
    const ariaAttrs = [
      'aria-label', 'aria-labelledby', 'aria-describedby',
      'aria-controls', 'aria-owns', 'role'
    ];
    
    ariaAttrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value && value.length < this.MAX_ATTRIBUTE_LENGTH) {
        selectors.push({
          selector: `[${attr}="${CSS.escape(value)}"]`,
          type: 'aria',
          attribute: attr,
          specificity: 45,
          strategy: 'exhaustive'
        });
      }
    });
    
    return selectors;
  }

  /**
   * Generate combination selectors
   */
  generateCombinationSelectors(element) {
    const selectors = [];
    const attrs = Array.from(element.attributes)
      .filter(a => !['class', 'id', 'style'].includes(a.name))
      .filter(a => a.value.length < 50);
    
    // 2-attribute combinations
    for (let i = 0; i < attrs.length && i < 5; i++) {
      for (let j = i + 1; j < attrs.length && j < i + 3; j++) {
        selectors.push({
          selector: `[${attrs[i].name}="${CSS.escape(attrs[i].value)}"][${attrs[j].name}="${CSS.escape(attrs[j].value)}"]`,
          type: 'attribute-combo',
          specificity: 40,
          strategy: 'exhaustive'
        });
      }
    }
    
    // Attribute + class combinations
    if (element.className) {
      const firstClass = element.className.split(' ')[0];
      attrs.slice(0, 3).forEach(attr => {
        selectors.push({
          selector: `.${CSS.escape(firstClass)}[${attr.name}="${CSS.escape(attr.value)}"]`,
          type: 'class-attribute-combo',
          specificity: 35,
          strategy: 'exhaustive'
        });
      });
    }
    
    return selectors;
  }

  /**
   * Helper: Get element descriptor for building compound selectors
   */
  getElementDescriptor(element) {
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }
    
    let descriptor = element.tagName.toLowerCase();
    
    if (element.className) {
      const firstClass = element.className.split(' ')[0];
      if (firstClass) {
        descriptor += `.${CSS.escape(firstClass)}`;
      }
    }
    
    // Add distinctive attribute if no id/class
    if (!element.id && !element.className) {
      for (const attr of ['data-testid', 'data-id', 'name', 'type']) {
        const value = element.getAttribute(attr);
        if (value && value.length < 30) {
          descriptor += `[${attr}="${CSS.escape(value)}"]`;
          break;
        }
      }
    }
    
    return descriptor;
  }

  /**
   * Helper: Get combinations of array elements
   */
  getCombinations(arr, size) {
    const result = [];
    
    function combine(start, combo) {
      if (combo.length === size) {
        result.push([...combo]);
        return;
      }
      
      for (let i = start; i < arr.length; i++) {
        combo.push(arr[i]);
        combine(i + 1, combo);
        combo.pop();
      }
    }
    
    combine(0, []);
    return result;
  }

  /**
   * Helper: Get attribute specificity score
   */
  getAttributeSpecificity(attrName) {
    const rankings = {
      'data-testid': 90,
      'data-cy': 90,
      'data-test': 90,
      'data-qa': 90,
      'data-id': 85,
      'data-automation-id': 85,
      'id': 100,  // Handled separately but included for completeness
      'name': 70,
      'type': 60,
      'role': 55,
      'aria-label': 50,
      'aria-labelledby': 48,
      'placeholder': 40,
      'title': 35,
      'alt': 35,
      'value': 25,
      'href': 20,
      'src': 20
    };
    
    // Check for data-* attributes not in the list
    if (attrName.startsWith('data-')) {
      return 75;
    }
    
    return rankings[attrName] || 15;
  }

  /**
   * Helper: Check if element has React fiber
   */
  getReactProps(element) {
    // Check for React fiber properties
    const keys = Object.keys(element);
    return keys.some(key => key.startsWith('__react'));
  }

  /**
   * Validate all selectors in batch
   */
  async validateAllSelectors(candidates) {
    const results = [];
    
    for (const candidate of candidates) {
      try {
        // Skip XPath selectors in CSS validation
        if (candidate.isXPath) {
          const xpathResult = document.evaluate(
            candidate.selector,
            document,
            null,
            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
            null
          );
          
          results.push({
            ...candidate,
            validation: {
              isValid: true,
              matchCount: xpathResult.snapshotLength,
              isUnique: xpathResult.snapshotLength === 1,
              isXPath: true,
              matches: []  // XPath match details omitted for performance
            }
          });
          continue;
        }
        
        // CSS selector validation
        const elements = document.querySelectorAll(candidate.selector);
        
        results.push({
          ...candidate,
          validation: {
            isValid: true,
            matchCount: elements.length,
            isUnique: elements.length === 1,
            matches: Array.from(elements).slice(0, 3).map(el => ({
              tag: el.tagName.toLowerCase(),
              id: el.id || undefined,
              text: el.textContent?.substring(0, 30) || undefined,
              classes: el.className || undefined
            }))
          }
        });
      } catch (error) {
        results.push({
          ...candidate,
          validation: {
            isValid: false,
            matchCount: 0,
            isUnique: false,
            error: error.message
          }
        });
      }
    }
    
    return results;
  }

  /**
   * Rank selectors by quality
   */
  rankSelectors(validatedSelectors, options = {}) {
    const { includeNonUnique = true, maxSelectors = 50 } = options;
    
    // Filter out non-unique if requested
    let selectors = validatedSelectors;
    if (!includeNonUnique) {
      selectors = selectors.filter(s => s.validation.isUnique);
    }
    
    // Sort by quality
    selectors.sort((a, b) => {
      // Invalid selectors go last
      if (!a.validation.isValid && b.validation.isValid) return 1;
      if (a.validation.isValid && !b.validation.isValid) return -1;
      
      // Unique selectors first
      if (a.validation.isUnique && !b.validation.isUnique) return -1;
      if (!a.validation.isUnique && b.validation.isUnique) return 1;
      
      // Both unique or both non-unique - sort by specificity
      if (a.specificity !== b.specificity) {
        return b.specificity - a.specificity;
      }
      
      // Same specificity - prefer fewer matches
      return a.validation.matchCount - b.validation.matchCount;
    });
    
    // Limit results
    return selectors.slice(0, maxSelectors);
  }

  /**
   * Main discovery method that combines generation and validation
   */
  async discoverSelectors(element, options = {}) {
    const {
      mode = 'stable',
      validateAll = true,
      maxSelectors = 50,
      includeNonUnique = true
    } = options;
    
    // Generate candidates
    const candidates = await this.generateCandidateSelectors(element, mode);
    
    // Validate if requested
    if (validateAll) {
      const validated = await this.validateAllSelectors(candidates);
      return this.rankSelectors(validated, { includeNonUnique, maxSelectors });
    }
    
    // Return unvalidated candidates (limited)
    return candidates.slice(0, maxSelectors);
  }
}
```

### Step 3: Update VisualInspector Class

**File**: `/test-harness/operator/backend/services/domToolkitService.js`

Replace the existing `generateStableSelectors` method in VisualInspector with this implementation:

```javascript
// Inside VisualInspector class (around line 700)
// Replace the existing generateStableSelectors method
async generateSelectors(element, options = {}) {
  const generator = new ExhaustiveSelectorGenerator();
  
  const {
    mode = 'stable',
    validateSelectors = (mode === 'exhaustive'), // Auto-validate in exhaustive mode
    maxSelectors = 50,
    includeNonUnique = true
  } = options;
  
  // Use the new discovery method
  const selectors = await generator.discoverSelectors(element, {
    mode,
    validateAll: validateSelectors,
    maxSelectors,
    includeNonUnique
  });
  
  return selectors;
}

// Update getElementDetails method (around line 657)
async getElementDetails(element, options) {
  const rect = element.getBoundingClientRect();
  const styles = window.getComputedStyle(element);
  
  const details = {
    tag: element.tagName.toLowerCase(),
    text: this.extractText(element),
    bounds: [
      Math.round(rect.x),
      Math.round(rect.y), 
      Math.round(rect.width),
      Math.round(rect.height)
    ],
    attributes: this.getAllAttributes(element),
    visible: this.isElementVisible(element),
    inViewport: this.isInViewport(rect)
  };

  // Generate selectors with new system
  if (options.generateSelectors) {
    details.selectors = await this.generateSelectors(element, {
      mode: options.selectorMode,
      validateSelectors: options.validateSelectors,
      maxSelectors: options.maxSelectors,
      includeNonUnique: options.includeNonUnique
    });
    
    // Add statistics
    details.selectorStats = {
      total: details.selectors.length,
      unique: details.selectors.filter(s => s.validation?.isUnique).length,
      valid: details.selectors.filter(s => s.validation?.isValid).length,
      invalid: details.selectors.filter(s => !s.validation?.isValid).length
    };
  }

  // Check actionability
  if (options.checkActionability) {
    details.actionability = this.checkActionability(element);
  }

  // Include parent chain
  if (options.includeParentChain) {
    details.parentChain = this.getParentChain(element);
  }

  // Include children
  if (options.includeChildren) {
    details.children = Array.from(element.children).map(child => ({
      tag: child.tagName.toLowerCase(),
      text: this.extractText(child).substring(0, 50),
      bounds: this.getBounds(child)
    }));
  }

  return details;
}
```

### Step 4: Update inspectAtCoordinates Method

**File**: `/test-harness/operator/backend/services/domToolkitService.js`

Update the options destructuring in `inspectAtCoordinates` (around line 617):

```javascript
async inspectAtCoordinates(x, y, options = {}) {
  const {
    includeParentChain = true,
    includeChildren = false,
    generateSelectors = true,
    checkActionability = true,
    includeNearbyElements = false,
    searchRadius = 50,
    // New options
    selectorMode = 'stable',
    validateSelectors = null,  // Will be auto-set based on mode
    maxSelectors = 50,
    includeNonUnique = true
  } = options;
  
  // Auto-enable validation for exhaustive mode
  const shouldValidate = validateSelectors !== null 
    ? validateSelectors 
    : (selectorMode === 'exhaustive');

  // Get element at exact coordinates
  const targetElement = document.elementFromPoint(x, y);
  
  if (!targetElement) {
    return {
      success: false,
      error: `No element found at coordinates [${x}, ${y}]`,
      coordinates: { x, y }
    };
  }

  const result = {
    success: true,
    coordinates: { x, y },
    target: await this.getElementDetails(targetElement, {
      includeParentChain,
      includeChildren,
      generateSelectors,
      checkActionability,
      // Pass new options
      selectorMode,
      validateSelectors: shouldValidate,
      maxSelectors,
      includeNonUnique
    })
  };

  // Include nearby elements if requested
  if (includeNearbyElements) {
    result.nearbyElements = await this.findNearbyElements(x, y, searchRadius);
  }

  return result;
}
```

### Step 5: Update the Main domClickInspect Method

**File**: `/test-harness/operator/backend/services/domToolkitService.js`

Update the method to pass new options to the browser context (around line 470):

```javascript
async domClickInspect(options = {}, nodeExecutor) {
  try {
    const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
    
    if (nodeExecutor?.currentWorkflow?.id) {
      page._workflowId = nodeExecutor.currentWorkflow.id;
    }

    // Call the visual inspector in the browser context
    const result = await page.evaluate((params) => {
      // [Include all the class definitions here: ActionableFilter, ExhaustiveSelectorGenerator, VisualInspector]
      
      const inspector = new VisualInspector();
      return inspector.inspectAtCoordinates(params.x, params.y, params.options);
    }, { 
      x: options.x, 
      y: options.y, 
      options: {
        includeParentChain: options.includeParentChain,
        includeChildren: options.includeChildren,
        generateSelectors: options.generateSelectors,
        checkActionability: options.checkActionability,
        includeNearbyElements: options.includeNearbyElements,
        searchRadius: options.searchRadius,
        // Pass new options
        selectorMode: options.selectorMode,
        validateSelectors: options.validateSelectors,
        maxSelectors: options.maxSelectors,
        includeNonUnique: options.includeNonUnique
      }
    });

    if (result.success) {
      return {
        success: true,
        output: this.formatClickInspectOutput(result, options),
        element: result.target,
        coordinates: result.coordinates,
        selectors: result.target.selectors,
        selectorStats: result.target.selectorStats
      };
    }

    return {
      success: false,
      error: result.error,
      coordinates: result.coordinates
    };

  } catch (error) {
    console.error('[DOMToolkitService] Error in domClickInspect:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### Step 6: Update Output Formatting

**File**: `/test-harness/operator/backend/services/domToolkitService.js`

Enhance the `formatClickInspectOutput` method (around line 976):

```javascript
formatClickInspectOutput(result, options) {
  const lines = [];
  const target = result.target;
  
  lines.push('=== VISUAL CLICK INSPECTION ===');
  lines.push(`Coordinates: [${result.coordinates.x}, ${result.coordinates.y}]`);
  lines.push('');
  
  // Target element details
  lines.push('[TARGET ELEMENT]');
  lines.push(`Tag: ${target.tag}`);
  lines.push(`Text: "${target.text}"`);
  lines.push(`Bounds: [${target.bounds.join(', ')}]`);
  lines.push(`Visible: ${target.visible ? '✅' : '❌'} | In Viewport: ${target.inViewport ? '✅' : '❌'}`);
  lines.push('');
  
  // Selector statistics (if in exhaustive mode)
  if (target.selectorStats && options.selectorMode === 'exhaustive') {
    lines.push('[SELECTOR DISCOVERY SUMMARY]');
    lines.push(`Total selectors generated: ${target.selectorStats.total}`);
    lines.push(`✅ Valid selectors: ${target.selectorStats.valid}`);
    lines.push(`🎯 Unique selectors: ${target.selectorStats.unique}`);
    lines.push(`❌ Invalid selectors: ${target.selectorStats.invalid}`);
    lines.push('');
  }
  
  // Recommended selectors with validation info
  if (target.selectors && target.selectors.length > 0) {
    lines.push('[DISCOVERED SELECTORS]');
    
    // Group by uniqueness
    const uniqueSelectors = target.selectors.filter(s => s.validation?.isUnique);
    const nonUniqueSelectors = target.selectors.filter(s => s.validation && !s.validation.isUnique);
    const invalidSelectors = target.selectors.filter(s => !s.validation?.isValid);
    
    if (uniqueSelectors.length > 0) {
      lines.push('');
      lines.push('🎯 UNIQUE SELECTORS (Recommended):');
      uniqueSelectors.slice(0, 10).forEach((sel, index) => {
        let line = `${index + 1}. ${sel.selector}`;
        line += ` (${sel.type}, specificity: ${sel.specificity})`;
        if (sel.requiresLibrary) line += ` [Requires: ${sel.requiresLibrary}]`;
        lines.push(line);
      });
    }
    
    if (nonUniqueSelectors.length > 0 && options.includeNonUnique !== false) {
      lines.push('');
      lines.push(`⚠️ NON-UNIQUE SELECTORS (${nonUniqueSelectors.length} total):`);
      nonUniqueSelectors.slice(0, 5).forEach((sel, index) => {
        let line = `${index + 1}. ${sel.selector}`;
        line += ` (matches: ${sel.validation.matchCount})`;
        lines.push(line);
        
        // Show what else it matches
        if (sel.validation.matches && sel.validation.matches.length > 1) {
          sel.validation.matches.slice(1, 3).forEach(match => {
            lines.push(`   └─ Also matches: <${match.tag}> "${match.text || ''}"`)
          });
        }
      });
    }
    
    if (invalidSelectors.length > 0) {
      lines.push('');
      lines.push(`❌ INVALID SELECTORS (${invalidSelectors.length} total):`);
      invalidSelectors.slice(0, 3).forEach((sel, index) => {
        lines.push(`${index + 1}. ${sel.selector} - Error: ${sel.validation.error}`);
      });
    }
    
    lines.push('');
  }
  
  // Actionability analysis
  if (target.actionability) {
    const actionability = target.actionability;
    lines.push('[ACTIONABILITY ANALYSIS]');
    lines.push(`Detected as Actionable: ${actionability.isActionable ? '✅' : '❌'}`);
    
    if (actionability.reasons) {
      lines.push('Reasons:');
      actionability.reasons.forEach(reason => {
        lines.push(`- ${reason}`);
      });
    }
    
    lines.push(`- Cursor style: ${actionability.cursor}`);
    lines.push(`- Tab index: ${actionability.tabIndex}`);
    lines.push(`- Has click handlers: ${actionability.hasClickHandlers ? '✅' : '❌'}`);
    lines.push('');
  }
  
  // Parent chain
  if (target.parentChain && target.parentChain.length > 0) {
    lines.push('[PARENT CHAIN]');
    target.parentChain.forEach(parent => {
      const id = parent.id ? `#${parent.id}` : '';
      const classes = parent.classes ? `.${parent.classes.split(' ').join('.')}` : '';
      const text = parent.text ? ` "${parent.text}"` : '';
      lines.push(`↑ ${parent.tag}${id}${classes}${text}`);
    });
    lines.push('');
  }
  
  // Suggested actions
  if (target.selectors && target.selectors.length > 0) {
    const bestSelector = target.selectors.find(s => s.validation?.isUnique) || target.selectors[0];
    lines.push('[SUGGESTED ACTIONS]');
    lines.push(`- Best selector: ${bestSelector.selector}`);
    lines.push(`- Test click: browser_action({action: "click", selector: "${bestSelector.selector}"})`);
    
    if (options.selectorMode === 'stable' && target.selectorStats?.unique === 0) {
      lines.push('- 💡 Try exhaustive mode for more selector options: selectorMode: "exhaustive"');
    }
    
    lines.push('');
  }
  
  return lines.join('\n');
}
```

### Step 7: Integration with dom_inspect

For `dom_inspect`, add similar functionality but adapted to work with cached snapshots:

**File**: `/test-harness/operator/backend/dom-toolkit/index.js`

Add after the `domInspect` method:

```javascript
// Add selector generation capability to dom_inspect
async generateSelectorsForElement(page, element, options = {}) {
  // Since dom_inspect works with snapshots, we need to go back to browser
  return await page.evaluate((elementData, opts) => {
    // Find the element using its unique properties from snapshot
    let targetElement = null;
    
    // Try to find by ID first
    if (elementData.id) {
      targetElement = document.getElementById(elementData.id);
    }
    
    // If not found, try other methods
    if (!targetElement && elementData.selector) {
      try {
        targetElement = document.querySelector(elementData.selector);
      } catch (e) {}
    }
    
    if (!targetElement) {
      return {
        success: false,
        error: 'Could not locate element in current DOM'
      };
    }
    
    // Use the same ExhaustiveSelectorGenerator
    const generator = new ExhaustiveSelectorGenerator();
    const selectors = await generator.discoverSelectors(targetElement, opts);
    
    return {
      success: true,
      selectors
    };
  }, element, options);
}
```

## Usage Examples

### Basic Usage (Stable Mode)

```javascript
// Default behavior - returns only stable selectors
const result = await dom_click_inspect({
  x: 100,
  y: 200
});
```

### Exhaustive Mode with Validation

```javascript
// Get ALL possible selectors with validation
const result = await dom_click_inspect({
  x: 100,
  y: 200,
  selectorMode: 'exhaustive',
  maxSelectors: 100
});

// Access selector statistics
console.log(result.selectorStats);
// { total: 87, unique: 23, valid: 85, invalid: 2 }
```

### Exhaustive Mode - Only Unique Selectors

```javascript
// Get only unique selectors in exhaustive mode
const result = await dom_click_inspect({
  x: 100,
  y: 200,
  selectorMode: 'exhaustive',
  includeNonUnique: false
});
```

### Custom Configuration

```javascript
const result = await dom_click_inspect({
  x: 100,
  y: 200,
  selectorMode: 'exhaustive',
  validateSelectors: true,    // Explicitly enable validation
  maxSelectors: 200,          // Get more selectors
  includeNonUnique: true,     // Include non-unique selectors
  includeParentChain: true,   // Include parent hierarchy
  checkActionability: true    // Check if element is interactive
});
```

## Output Format

### Stable Mode Output

```javascript
{
  success: true,
  element: {
    tag: 'button',
    text: 'Submit',
    selectors: [
      {
        selector: '[data-testid="submit-btn"]',
        type: 'data-attribute',
        specificity: 90,
        strategy: 'stable'
      },
      {
        selector: '#submitBtn',
        type: 'id',
        specificity: 100,
        strategy: 'stable'
      }
    ]
  }
}
```

### Exhaustive Mode Output

```javascript
{
  success: true,
  element: {
    tag: 'button',
    text: 'Submit',
    selectors: [
      // Unique selectors first
      {
        selector: '[data-testid="submit-btn"]',
        type: 'data-attribute',
        specificity: 90,
        strategy: 'exhaustive',
        validation: {
          isValid: true,
          matchCount: 1,
          isUnique: true,
          matches: [{ tag: 'button', text: 'Submit' }]
        }
      },
      // ... many more selectors
    ],
    selectorStats: {
      total: 87,
      unique: 23,
      valid: 85,
      invalid: 2
    }
  }
}
```

## Performance Considerations

1. **Exhaustive mode generates 50-100+ selectors** per element
2. **Validation adds ~100-500ms** depending on DOM complexity
3. **Use `maxSelectors`** to limit output size
4. **Consider `includeNonUnique: false`** to reduce noise
5. **XPath selectors are slower** but included for completeness

## Testing Checklist

- [ ] Test with simple elements (button, link)
- [ ] Test with complex elements (nested divs, dynamic classes)
- [ ] Test with framework components (React, Vue, Angular)
- [ ] Test with shadow DOM elements
- [ ] Test with dynamically generated content
- [ ] Verify performance with large DOM trees
- [ ] Verify all selector types are generated correctly
- [ ] Verify validation accuracy
- [ ] Test error handling for invalid selectors
- [ ] Test output formatting in all modes

## Future Enhancements

1. **Smart Mode**: ML-based selector recommendation
2. **Stability Tracking**: Historical selector performance
3. **Framework Detection**: Auto-detect React/Vue/Angular
4. **Shadow DOM**: Better shadow root penetration
5. **Performance Mode**: Skip certain expensive selectors
6. **Caching**: Cache validation results for repeated elements

## Conclusion

This implementation provides a comprehensive selector discovery system that:
- Generates ALL possible selectors in exhaustive mode
- Validates each selector against the live DOM
- Ranks selectors by quality (uniqueness, specificity)
- Maintains backward compatibility with stable mode
- Provides detailed statistics and validation results

The Director now has complete information to make informed decisions about which selectors to use for reliable automation.