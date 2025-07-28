# DOM Inspect 2.0: Visual Click-to-Inspect Feature Specification

## Overview

A revolutionary enhancement to the Director's DOM inspection capabilities that enables **visual point-and-click element targeting**. This feature bridges the gap between what the Director can see in screenshots and what can be programmatically accessed in the DOM.

## Problem Statement

### Current Limitation
Directors often encounter situations where they can visually identify elements in screenshots but struggle to:
- Generate reliable selectors for automation
- Understand why certain elements aren't detected by `dom_actionable`
- Debug DOM structure without extensive element ID hunting
- Build workflows efficiently when dealing with complex, modern web applications

### Real-World Example
**Airtable Table Rows Issue**: Director can clearly see "First Round Capital" text in a screenshot but `dom_actionable` doesn't detect it. Current workflow requires:
1. Multiple `dom_search` attempts with various selectors
2. Manual `dom_inspect` calls with element IDs
3. Trial-and-error selector generation
4. No clear correlation between visual and programmatic access

## Solution: Visual Click-to-Inspect

### Core Concept
**"See it, click it, inspect it"** - Directors can specify pixel coordinates on a screenshot and instantly get comprehensive DOM information about the element at that location.

## Feature Specification

### 1. Primary Tool: `dom_click_inspect`

```javascript
{
  type: 'function',
  function: {
    name: 'dom_click_inspect',
    description: 'Get detailed DOM information about the element at specific screen coordinates. Perfect for visual workflow building and debugging actionable detection.',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X pixel coordinate (from screenshot or visual observation)',
          minimum: 0
        },
        y: {
          type: 'number', 
          description: 'Y pixel coordinate (from screenshot or visual observation)',
          minimum: 0
        },
        tabName: {
          type: 'string',
          description: 'Browser tab to inspect (defaults to active tab)'
        },
        includeParentChain: {
          type: 'boolean',
          description: 'Include full parent element hierarchy (default: true)',
          default: true
        },
        includeChildren: {
          type: 'boolean',
          description: 'Include immediate child elements (default: false)',
          default: false
        },
        generateSelectors: {
          type: 'boolean',
          description: 'Generate multiple stable selector options (default: true)',
          default: true
        },
        checkActionability: {
          type: 'boolean',
          description: 'Test element against actionable detection filters (default: true)',
          default: true
        },
        includeNearbyElements: {
          type: 'boolean',
          description: 'Include elements within 50px radius for context (default: false)',
          default: false
        }
      },
      required: ['x', 'y'],
      additionalProperties: false
    },
    strict: true
  }
}
```

### 2. Enhanced Tool: `dom_visual_targeting`

```javascript
{
  type: 'function',
  function: {
    name: 'dom_visual_targeting',
    description: 'Advanced visual targeting that combines screenshot capture with click-based inspection. Takes screenshot first, then inspects clicked coordinates.',
    parameters: {
      type: 'object',
      properties: {
        x: {
          type: 'number',
          description: 'X pixel coordinate to inspect'
        },
        y: {
          type: 'number',
          description: 'Y pixel coordinate to inspect'
        },
        tabName: {
          type: 'string',
          description: 'Browser tab to target (defaults to active tab)'
        },
        includeScreenshot: {
          type: 'boolean',
          description: 'Include screenshot with target location highlighted (default: true)',
          default: true
        },
        searchRadius: {
          type: 'number',
          description: 'Pixel radius to search for nearby actionable elements (default: 50)',
          default: 50,
          minimum: 0,
          maximum: 200
        }
      },
      required: ['x', 'y'],
      additionalProperties: false
    },
    strict: true
  }
}
```

## Implementation Details

### Core Browser Function

```javascript
// File: /dom-toolkit/core/visualInspector.js
export class VisualInspector {
  
  /**
   * Get element at specific coordinates with comprehensive details
   */
  async inspectAtCoordinates(x, y, options = {}) {
    const {
      includeParentChain = true,
      includeChildren = false,
      generateSelectors = true,
      checkActionability = true,
      includeNearbyElements = false
    } = options;

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
        checkActionability
      })
    };

    // Include nearby elements if requested
    if (includeNearbyElements) {
      result.nearbyElements = await this.findNearbyElements(x, y, 50);
    }

    return result;
  }

  /**
   * Get comprehensive element details
   */
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

    // Generate multiple selector options
    if (options.generateSelectors) {
      details.selectors = this.generateStableSelectors(element);
    }

    // Check actionability against current filters
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

  /**
   * Generate multiple stable selector options ranked by reliability
   */
  generateStableSelectors(element) {
    const selectors = [];
    
    // 1. ID selector (most stable)
    if (element.id) {
      selectors.push({
        selector: `#${element.id}`,
        reliability: 'high',
        type: 'id'
      });
    }

    // 2. Data attribute selectors (test-friendly)
    const dataAttrs = ['data-testid', 'data-cy', 'data-test', 'data-qa'];
    for (const attr of dataAttrs) {
      const value = element.getAttribute(attr);
      if (value) {
        selectors.push({
          selector: `[${attr}="${value}"]`,
          reliability: 'high',
          type: 'data-attribute'
        });
      }
    }

    // 3. Unique class combinations
    if (element.className) {
      const classes = element.className.split(' ').filter(c => c.length > 0);
      if (classes.length > 0) {
        selectors.push({
          selector: `.${classes.join('.')}`,
          reliability: 'medium',
          type: 'class'
        });
      }
    }

    // 4. ARIA selectors
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) {
      selectors.push({
        selector: `[aria-label="${ariaLabel}"]`,
        reliability: 'medium',
        type: 'aria'
      });
    }

    // 5. Text-based selectors (least stable)
    const text = this.extractText(element);
    if (text && text.length < 50) {
      selectors.push({
        selector: `${element.tagName.toLowerCase()}:has-text("${text}")`,
        reliability: 'low',
        type: 'text',
        note: 'Pseudo-selector, may need framework-specific adaptation'
      });
    }

    // 6. Structural selectors
    const parentTag = element.parentElement?.tagName.toLowerCase();
    if (parentTag) {
      selectors.push({
        selector: `${parentTag} > ${element.tagName.toLowerCase()}:nth-child(${this.getChildIndex(element)})`,
        reliability: 'low',
        type: 'structural'
      });
    }

    return selectors;
  }

  /**
   * Check element against actionable detection filters
   */
  checkActionability(element) {
    const actionableFilter = new ActionableFilter();
    
    return {
      isActionable: actionableFilter.isActionableElementLive(element),
      isVisible: actionableFilter.isElementVisibleLive(element),
      isSignificant: actionableFilter.isElementSignificantLive(element),
      reasons: this.getActionabilityReasons(element, actionableFilter),
      cursor: window.getComputedStyle(element).cursor,
      tabIndex: element.tabIndex,
      hasClickHandlers: actionableFilter.hasClickHandlersLive(element)
    };
  }

  /**
   * Find nearby actionable elements within radius
   */
  async findNearbyElements(centerX, centerY, radius) {
    const nearby = [];
    const searchPoints = this.generateSearchPoints(centerX, centerY, radius);
    
    for (const point of searchPoints) {
      const element = document.elementFromPoint(point.x, point.y);
      if (element && !nearby.some(n => n.element === element)) {
        const actionability = this.checkActionability(element);
        if (actionability.isActionable) {
          nearby.push({
            element: element,
            distance: Math.sqrt(Math.pow(point.x - centerX, 2) + Math.pow(point.y - centerY, 2)),
            bounds: this.getBounds(element),
            text: this.extractText(element).substring(0, 30)
          });
        }
      }
    }
    
    return nearby.sort((a, b) => a.distance - b.distance).slice(0, 10);
  }
}
```

### Service Layer Integration

```javascript
// File: /services/domToolkitService.js
async domClickInspect(options) {
  try {
    const page = await this.getPageForTab(options.tabName || 'main', nodeExecutor);
    
    if (nodeExecutor?.currentWorkflow?.id) {
      page._workflowId = nodeExecutor.currentWorkflow.id;
    }

    const result = await page.evaluate((coords, opts) => {
      const inspector = new VisualInspector();
      return inspector.inspectAtCoordinates(coords.x, coords.y, opts);
    }, { x: options.x, y: options.y }, options);

    if (result.success) {
      return {
        success: true,
        output: this.formatClickInspectOutput(result),
        element: result.target,
        coordinates: result.coordinates,
        selectors: result.target.selectors
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

## Output Format

### Standard Output Example

```
=== VISUAL CLICK INSPECTION ===
Coordinates: [490, 184]

[TARGET ELEMENT]
Tag: div
Text: "First Round Capital"
Bounds: [450, 168, 180, 32]
Visible: ✅ | In Viewport: ✅

[ACTIONABILITY ANALYSIS]
Detected as Actionable: ❌
Reasons: Missing standard interactive patterns
- No ARIA role: ❌
- No tabindex: ❌  
- No click handlers detected: ❌
- Cursor style: default (not pointer)
- Has data-testid="data-row": ✅
- Has class "rowSelectionEnabled": ✅

[RECOMMENDED SELECTORS]
1. [data-testid="data-row"] (High reliability - data attribute)
2. .dataRow.leftPane (Medium reliability - class combination)  
3. div:has-text("First Round Capital") (Low reliability - text based)

[PARENT CHAIN]
↑ [234] div.dataLeftPaneInnerContent
  ↑ [233] div.dataLeftPane  
    ↑ [200] div.leftPaneWrapper
      ↑ [199] div.headerAndDataRowContainer

[DEBUG INSIGHTS]
💡 Element should be actionable but isn't detected
💡 Has semantic classes suggesting clickability
💡 Consider enhancing actionable filter for this pattern

[SUGGESTED ACTIONS]
- Test click: browser_action({action: "click", selector: "[data-testid=\"data-row\"]"})
- Manual verify: Click element to confirm it's actually interactive
- Debug filter: Check why rowSelectionEnabled class isn't triggering detection
```

## Use Cases & Workflows

### 1. **Debugging Actionable Detection**
```
Director: "I can see 'First Round Capital' in the screenshot but dom_actionable isn't finding it"
→ Take screenshot with dom_actionable  
→ Call dom_click_inspect(490, 184)
→ Get detailed analysis of why element isn't detected
→ Enhance filtering rules or use manual selectors
```

### 2. **Visual Workflow Building**
```
Director: "I want to click on the submit button in this complex form"
→ Call dom_visual_targeting(x, y)
→ Get multiple selector options with reliability rankings
→ Choose best selector for browser_action node
→ Build robust automation workflow
```

### 3. **Cross-Verification**
```
Director: "Let me verify what dom_actionable found vs what I can see"
→ Run dom_actionable with screenshot
→ Click on elements that should be detected but aren't
→ Compare results and identify filter gaps
→ Improve detection accuracy
```

### 4. **Rapid Selector Generation**
```
Director: "I need a reliable selector for this tricky element"
→ Click on target element coordinates
→ Get ranked list of selector options
→ Test selectors for stability and uniqueness
→ Use in production workflows
```

## Technical Implementation Plan

### Phase 1: Core Click Inspection (Week 1)
- [ ] Implement `VisualInspector` class
- [ ] Add `dom_click_inspect` tool to DOM toolkit
- [ ] Basic coordinate-to-element mapping
- [ ] Simple output formatting

### Phase 2: Actionability Analysis (Week 2)  
- [ ] Integrate with existing `ActionableFilter`
- [ ] Add actionability reasoning and debugging
- [ ] Enhanced selector generation algorithms
- [ ] Parent chain and context analysis

### Phase 3: Visual Targeting (Week 3)
- [ ] Implement `dom_visual_targeting` with screenshots
- [ ] Nearby element discovery
- [ ] Visual highlighting of target and alternatives
- [ ] Advanced debugging insights

### Phase 4: Integration & Polish (Week 4)
- [ ] Full integration with Director workflow
- [ ] Comprehensive testing on various sites
- [ ] Documentation and examples
- [ ] Performance optimization

## Success Metrics

### Quantitative
- **Selector Reliability**: >90% of generated selectors should work consistently
- **Detection Accuracy**: Should identify actionable elements missed by current filters
- **Performance**: <2 seconds response time for click inspection
- **Coverage**: Should work on 95+ different website types

### Qualitative  
- **Developer Experience**: Directors can build workflows 50% faster
- **Debugging Efficiency**: Actionable detection issues resolved in <5 minutes
- **Visual Correlation**: Perfect mapping between screenshots and DOM access
- **Learning Curve**: New Directors can use effectively within 1 hour

## Future Enhancements

### Advanced Features
- **Multi-coordinate selection**: Select multiple points to get batch element info
- **Visual diff mode**: Compare two screenshots and highlight element changes
- **Smart grouping**: Automatically identify repeating patterns (table rows, list items)
- **Export selectors**: Generate selector libraries for common UI patterns

### AI Integration
- **Visual element classification**: "This looks like a submit button"
- **Pattern recognition**: "This appears to be a data table"
- **Predictive targeting**: "You probably want to click the primary action button"
- **Workflow suggestions**: "Based on this element, you might want to extract the adjacent text"

## Conclusion

DOM Inspect 2.0 represents a paradigm shift from programmatic-first to visual-first DOM interaction. By enabling Directors to literally point at what they want to interact with, we eliminate the friction between visual observation and programmatic action.

This feature will be particularly powerful for:
- **Complex modern web applications** with non-standard interaction patterns
- **Debugging edge cases** like the current Airtable table row issue
- **Rapid prototyping** of automation workflows
- **Training new Directors** to understand DOM structure visually

The implementation leverages existing DOM toolkit infrastructure while adding revolutionary visual targeting capabilities that will make Directors significantly more effective at building robust, reliable automations.