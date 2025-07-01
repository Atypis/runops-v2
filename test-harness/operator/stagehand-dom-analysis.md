# Stagehand DOM Representation Analysis

## Overview

Stagehand transforms the browser DOM into a simplified text representation that LLMs can understand and interact with. This analysis explores how Stagehand processes, filters, and formats DOM elements for AI consumption.

## 1. DOM Processing Pipeline

### 1.1 Entry Points

Stagehand provides two main DOM processing functions:

- **`processDom(chunksSeen)`**: Processes a single chunk of the DOM based on viewport
- **`processAllOfDom(xpath?)`**: Processes the entire DOM or a specific element subtree

### 1.2 Chunking Strategy

The DOM is processed in viewport-sized chunks to handle large pages:

```typescript
// From process.ts
const viewportHeight = container.getViewportHeight();
const chunkSize = viewportHeight;
const startOffset = chunk * chunkSize;
```

Each chunk represents one viewport height of content, allowing the system to process large pages incrementally.

## 2. Element Representation

### 2.1 Candidate Collection

Elements are collected through `collectCandidateElements()` which performs a depth-first traversal. An element becomes a "candidate" if it meets these criteria:

**Interactive Elements:**
- Tag names: `A`, `BUTTON`, `INPUT`, `SELECT`, `TEXTAREA`, `DETAILS`, `EMBED`, `LABEL`, `MENU`, `MENUITEM`, `OBJECT`, `SUMMARY`
- ARIA roles: `button`, `menu`, `menuitem`, `link`, `checkbox`, `radio`, `slider`, `tab`, `textbox`, `combobox`, etc.
- Must be visible and active (not disabled/hidden)

**Leaf Elements:**
- Elements with text content but no children (or only text node children)
- Excluded: `SVG`, `IFRAME`, `SCRIPT`, `STYLE`, `LINK`

**Text Nodes:**
- Must have visible text content (trimmed)

### 2.2 Visibility Checks

Elements must pass several visibility tests:

```typescript
// From elementCheckUtils.ts
export const isVisible = (element: Element) => {
  const rect = element.getBoundingClientRect();
  // Must have size and be in viewport
  if (rect.width === 0 || rect.height === 0 || 
      rect.top < 0 || rect.top > window.innerHeight) {
    return false;
  }
  // Must be top element at sample points
  if (!isTopElement(element, rect)) {
    return false;
  }
  // Must pass browser visibility checks
  return element.checkVisibility({
    checkOpacity: true,
    checkVisibilityCSS: true,
  });
};
```

### 2.3 Output Format

Each candidate element is formatted as:

```
{index}:{element representation}
```

Examples:
- Text node: `0:Welcome to our website`
- Element: `1:<button id="submit-btn" class="primary-button">Submit Form</button>`
- Link: `2:<a href="/login" aria-label="Sign in to your account">Login</a>`

## 3. Attribute Filtering

Only essential attributes are preserved:

```typescript
const essentialAttributes = [
  "id", "class", "href", "src", 
  "aria-label", "aria-name", "aria-role", 
  "aria-description", "aria-expanded", "aria-haspopup",
  "type", "value"
];
// Plus any data-* attributes
```

This filtering removes noise while preserving semantic information needed for interaction.

## 4. Selector Mapping

Each element gets mapped to XPath selectors:

```typescript
selectorMap: {
  0: ["/html/body/div/p/text()"],
  1: ["//button[@id='submit-btn']", "//button[@class='primary-button']"],
  2: ["//a[@href='/login']"]
}
```

Multiple XPaths provide fallback options if the primary selector fails.

## 5. View Format for LLMs

The LLM receives the DOM in this format:

```
# Current Active Dom Elements
0:Welcome to our website
1:<button id="submit-btn" class="primary-button">Submit Form</button>
2:<input type="text" placeholder="Enter your name">
3:<a href="/login" aria-label="Sign in to your account">Login</a>
4:<select><option value="2">Option 2</option></select>
```

Key characteristics:
- Sequential numbering for reference
- Simplified HTML with only essential attributes
- Text content preserved exactly
- Hidden elements filtered out
- Only interactive and text elements included

## 6. Key Differences from Standard DOM

### 6.1 What Gets Filtered Out
- Non-interactive elements without text (empty divs, spans)
- Hidden elements (display: none, visibility: hidden, opacity: 0)
- Elements outside viewport (unless specifically requested)
- Non-essential attributes (style, data-reactid, etc.)
- Script and style elements

### 6.2 Attribute Preservation
- Semantic attributes (id, class, href, aria-*)
- Form-related attributes (type, name, value, placeholder)
- Custom data attributes (data-*)
- Functional attributes affecting behavior

### 6.3 Text Content Handling
- Text nodes are extracted separately with their full content
- Whitespace is trimmed but internal spacing preserved
- Text visibility is verified through parent element
- Multiple text nodes in an element are concatenated

## 7. Special Handling

### 7.1 Dropdown/Select Elements
Selected option is shown instead of all options:
```typescript
if (dropDownElem) {
  const elemText = dropDownElem.textContent || "";
  // Returns just the selected option text
}
```

### 7.2 Chunking and Scrolling
- DOM is processed in viewport-sized chunks
- Elements can be collected from specific scroll positions
- Supports scrollable containers within the page

### 7.3 Accessibility Tree Alternative
Stagehand can also use the Chrome Accessibility Tree instead of DOM:
- Provides semantic structure
- Better for screen reader compatibility
- Different element identification (backend node IDs)

## 8. Usage in Operator

The operator uses Stagehand's representation for:

1. **Act Operations**: Finding and interacting with elements
2. **Extract Operations**: Pulling structured data from pages
3. **Observe Operations**: Identifying available actions

Example act usage:
```typescript
const { outputString, selectorMap } = await page.evaluate(() => {
  return window.processDom(chunksSeen);
});

// LLM receives outputString and returns element ID
const elementId = response["element"];
const xpaths = selectorMap[elementId];
```

## Conclusion

Stagehand's DOM representation is optimized for LLM understanding by:
- Filtering to only actionable content
- Preserving semantic meaning
- Providing stable selectors
- Chunking for large pages
- Maintaining exact text content

This approach enables LLMs to effectively understand and interact with web pages through a simplified but semantically rich representation.