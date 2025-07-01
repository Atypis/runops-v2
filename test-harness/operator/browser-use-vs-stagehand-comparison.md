# Browser-Use vs Stagehand DOM Representation Comparison

## Executive Summary

Browser-Use and Stagehand take fundamentally different approaches to DOM representation for LLMs. Browser-Use uses a hierarchical tree structure with highlight indices, while Stagehand uses a flat, numbered list format. This analysis reveals critical compatibility issues that will require transformation layers for scout findings to work with the Operator system.

## 1. Structural Differences

### Element Indexing

| Aspect | Browser-Use | Stagehand |
|--------|------------|-----------|
| **Indexing Method** | `highlight_index` on interactive elements only | Sequential numbering (0, 1, 2...) for all candidates |
| **Index Scope** | Sparse - only interactive elements get indices | Dense - every visible element/text gets an index |
| **Index Format** | `[index]` or `*[index]*` for new elements | `index:element` format |
| **Persistence** | Tracks element history across pages | No cross-page tracking |

### Element Format

**Browser-Use Format:**
```
[0]<button aria-label='Submit' >Submit Form />
[1]<input type='text' placeholder='Enter name' />
*[2]*<a href='/login' >Login />  // New element indicator
```

**Stagehand Format:**
```
0:Welcome to our website
1:<button id="submit-btn" class="primary-button">Submit Form</button>
2:<input type="text" placeholder="Enter your name">
3:<a href="/login" aria-label="Sign in to your account">Login</a>
```

### Attribute Preservation

| Attribute Type | Browser-Use | Stagehand |
|----------------|------------|-----------|
| **Core Attributes** | Selective based on LLM optimization | Fixed list of essentials |
| **ID/Class** | Sometimes included | Always preserved |
| **ARIA Attributes** | Optimized (removed if redundant) | Always preserved |
| **Data Attributes** | Not mentioned | All data-* preserved |
| **Style Attributes** | Not preserved | Not preserved |

## 2. Processing Approaches

### Browser-Use: DOMHistoryTreeProcessor

- **Architecture**: Hierarchical tree traversal with parent-child relationships
- **Key Features**:
  - Maintains DOM tree structure
  - Hash-based element tracking across page changes
  - Parent branch path tracking for context
  - Distinguishes new vs existing elements

### Stagehand: domExtract/collectCandidateElements

- **Architecture**: Depth-first traversal with flat output
- **Key Features**:
  - Flattens DOM to numbered list
  - Collects both interactive and text elements
  - XPath-based selector generation
  - Viewport-based chunking for large pages

### Chunking/Pagination Strategies

| Strategy | Browser-Use | Stagehand |
|----------|------------|-----------|
| **Approach** | Full tree with selective highlighting | Viewport-based chunks |
| **Chunk Size** | N/A - processes entire tree | One viewport height |
| **Navigation** | Focus on specific elements | Scroll-based collection |
| **Memory** | Maintains full tree in memory | Processes chunks incrementally |

### Visibility Detection

**Browser-Use:**
- Uses `is_visible`, `is_top_element`, `is_in_viewport` flags
- Checks element visibility during tree construction
- Considers parent visibility for text nodes

**Stagehand:**
- Multi-point visibility check (5 sample points)
- `checkVisibility` API with opacity and CSS checks
- Viewport boundary validation
- Parent element visibility for text nodes

## 3. Selector Generation

### Browser-Use Selectors

- **Primary**: XPath from last root node (shadow root/iframe/document)
- **Enhanced CSS**: Generated through `_enhanced_css_selector_for_element`
- **Caching**: XPath results cached for performance
- **Format**: Full hierarchical path preservation

### Stagehand Selectors

- **Primary**: Multiple XPath variants for fallback
- **Storage**: `selectorMap` with index → xpath[] mapping
- **Generation**: `generateXPathsForElement` creates alternatives
- **Format**: Array of XPath strings per element

**Key Difference**: Stagehand provides multiple selector options for resilience, while Browser-Use focuses on a single accurate selector.

## 4. LLM View Format

### Side-by-Side Example: Submit Button

**Browser-Use View:**
```
[15]<button aria-label='Submit Form' >Submit />
```

**Stagehand View:**
```
42:<button id="submit-btn" class="btn-primary" aria-label="Submit Form">Submit</button>
```

### Text Node Handling

**Browser-Use:**
- Text included within parent elements
- `get_all_text_till_next_clickable_element()` method
- Text nodes don't get separate indices

**Stagehand:**
- Text nodes get their own indices
- Appear as separate entries: `0:Welcome to our website`
- Trimmed and visibility-checked

## 5. Critical Compatibility Issues

### Index Incompatibility

| Issue | Impact | Solution |
|-------|--------|----------|
| **Different numbering schemes** | Browser-Use indices won't match Stagehand | Index mapping table required |
| **Sparse vs Dense indexing** | Missing indices in Browser-Use | Generate synthetic indices |
| **Text node handling** | Browser-Use doesn't index text separately | Extract and renumber |

### Selector Incompatibility

1. **XPath Differences**: Browser-Use uses full paths from root; Stagehand uses relative paths
2. **Multiple Selectors**: Stagehand expects arrays; Browser-Use provides singles
3. **Shadow DOM**: Different handling approaches for shadow roots

### Attribute Mismatch

- Browser-Use optimizes away redundant attributes
- Stagehand always includes the full essential set
- Data attributes missing in Browser-Use representation

## 6. Scout Reconnaissance Impact

### Direct Transfer Compatibility

**What Works:**
- Element type identification (button, input, etc.)
- Basic interaction detection
- Visibility status
- Text content extraction

**What Breaks:**
- Element indices (complete mismatch)
- Selector formats (need transformation)
- Attribute expectations (missing in Browser-Use)
- Text node references (not indexed in Browser-Use)

### Required Transformations

1. **Index Translation Layer**:
   ```python
   def translate_browser_use_to_stagehand(browser_use_index, dom_state):
       # Map sparse Browser-Use indices to dense Stagehand numbering
       # Account for text nodes that need synthetic indices
   ```

2. **Selector Adaptation**:
   ```python
   def adapt_selector(browser_use_xpath):
       # Convert to Stagehand format
       # Generate alternative selectors
       return [primary_xpath, *fallback_xpaths]
   ```

3. **Attribute Enhancement**:
   ```python
   def enhance_attributes(element):
       # Add missing essential attributes
       # Ensure id, class, aria-* are present
   ```

## 7. Recommendations for Scout System

### Immediate Actions

1. **Dual-Mode Scouts**: Implement scouts that can output both Browser-Use and Stagehand formats
2. **Translation Service**: Build a robust translation layer between formats
3. **Validation Suite**: Create tests to verify selector compatibility

### Scout Output Format

Recommend scouts produce an intermediate format:
```json
{
  "element": {
    "type": "button",
    "text": "Submit",
    "attributes": {
      "id": "submit-btn",
      "class": "primary",
      "aria-label": "Submit Form"
    },
    "selectors": {
      "xpath": ["//button[@id='submit-btn']", "//button[text()='Submit']"],
      "css": ["#submit-btn", ".primary"]
    },
    "position": {
      "index_browser_use": 15,
      "index_stagehand": 42,
      "in_viewport": true
    }
  }
}
```

### Long-term Strategy

1. **Unified DOM Model**: Define a common DOM representation that both systems can target
2. **Selector Library**: Build resilient selector generation that works across frameworks
3. **Progressive Enhancement**: Start with basic compatibility, add advanced features incrementally

## Conclusion

While Browser-Use and Stagehand serve similar purposes, their DOM representations are fundamentally incompatible without transformation. The key challenge is not just syntactic differences but conceptual mismatches in how elements are identified, indexed, and presented to LLMs.

For the Scout system to provide value to the Operator, we must:
1. Build robust transformation layers
2. Enhance scout outputs with dual-format support
3. Create validation to ensure compatibility
4. Consider adopting a unified intermediate format

The investment in compatibility layers will be significant but necessary for leveraging Browser-Use's scouting capabilities within the Stagehand-based Operator system.