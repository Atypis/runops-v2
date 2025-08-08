# DOM Processing Comparison: Stagehand vs Browser-Use

## Overview

This document provides a detailed comparison of how Stagehand and Browser-Use process and represent DOM for LLM consumption. Both frameworks solve the same fundamental problem - making web pages understandable to AI - but take distinctly different approaches.

## 1. Core Processing Methods

### Stagehand: Accessibility Tree via Chrome DevTools Protocol

```typescript
// Stagehand's approach - Single CDP call
const { nodes } = await page.sendCDP("Accessibility.getFullAXTree");
const tree = await buildHierarchicalTree(nodes);
```

**Process:**
1. Makes a single Chrome DevTools Protocol call
2. Gets the entire accessibility tree as flat nodes
3. Builds hierarchy in memory
4. Filters out generic/structural nodes
5. Maps to XPath selectors

### Browser-Use: Visual DOM Traversal

```javascript
// Browser-Use's approach - Recursive DOM walk
function buildDomTree(node) {
  // Check visibility
  const rect = getCachedBoundingRect(node);
  
  // Check interactivity
  if (isInteractiveElement(node)) {
    highlightElement(node, index);
  }
  
  // Process children
  for (const child of node.childNodes) {
    buildDomTree(child);
  }
}
```

**Process:**
1. Recursively traverses the DOM tree
2. Checks each element's visual properties
3. Creates highlight overlays for interactive elements
4. Builds tree structure during traversal
5. Caches bounding rectangles and styles

## 2. Element Identification

### Stagehand: Semantic Roles

```
[100] button: Submit Form
[101] link: Documentation
[102] textbox: Email Address
[103] heading: Welcome
[104] navigation: Main Menu
```

- Uses accessibility roles (button, link, textbox)
- Includes accessibility names
- Node IDs from backend Chrome process
- Clean, semantic representation

### Browser-Use: Visual Indexes

```
0: Welcome to our website
1: <button id="submit-btn" class="primary">Submit</button>
2: <input type="text" placeholder="Enter email">
3: <a href="/docs">Documentation</a>
```

- Sequential visual indexes
- Preserves HTML structure
- Includes essential attributes
- Shows actual element representation

## 3. Interactivity Detection

### Stagehand's Approach

```typescript
// Relies on accessibility tree properties
function isNodeInteractive(node: AXNode): boolean {
  const interactiveRoles = [
    'button', 'link', 'textbox', 'checkbox', 
    'radio', 'slider', 'combobox', 'menuitem'
  ];
  
  return interactiveRoles.includes(node.role?.value || '');
}
```

**Criteria:**
- Accessibility role
- Focusable state
- Not disabled/hidden in accessibility tree
- Semantic understanding

### Browser-Use's Approach

```javascript
function isInteractiveElement(element) {
  // 1. Check cursor style
  const style = getComputedStyle(element);
  if (style.cursor === 'pointer') return true;
  
  // 2. Check tag name
  const interactiveTags = ['button', 'a', 'input', 'select'];
  if (interactiveTags.includes(element.tagName.toLowerCase())) {
    return !element.disabled;
  }
  
  // 3. Check event listeners
  if (element.onclick || element.hasAttribute('onclick')) {
    return true;
  }
  
  // 4. Check ARIA attributes
  const role = element.getAttribute('role');
  return interactiveRoles.has(role);
}
```

**Criteria:**
- Visual cursor style
- HTML tag type
- Event listeners (onclick, etc.)
- ARIA roles
- Not visually hidden

## 4. Visibility Determination

### Stagehand

```typescript
// Uses browser's accessibility visibility
if (!node.ignored && node.role?.value !== 'none') {
  // Node is visible in accessibility tree
}
```

- Binary visible/hidden based on accessibility
- Handles screen reader visibility
- Respects aria-hidden

### Browser-Use

```javascript
function isElementVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  
  return (
    rect.width > 0 && 
    rect.height > 0 &&
    style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    style.opacity !== '0' &&
    isInViewport(rect)
  );
}
```

- Checks actual visual rendering
- Validates dimensions
- Checks CSS properties
- Viewport intersection

## 5. Text Content Handling

### Stagehand

```typescript
// Gets text from accessibility names
const text = node.name?.value || node.description?.value;
```

- Uses computed accessible names
- Includes ARIA labels
- Follows accessibility computation rules
- May not match visual text exactly

### Browser-Use

```javascript
// Direct text node extraction
if (node.nodeType === Node.TEXT_NODE) {
  const text = node.textContent.trim();
  if (text && isTextNodeVisible(node)) {
    return { type: 'TEXT_NODE', text };
  }
}
```

- Extracts actual DOM text nodes
- Preserves exact text content
- Separate visibility check for text
- Maintains text node boundaries

## 6. Performance Characteristics

### Stagehand Performance

**Advantages:**
- Single CDP call for entire tree
- No DOM traversal needed
- Bulk data transfer
- Minimal JavaScript execution

**Overhead:**
- CDP protocol overhead
- Tree reconstruction in memory
- Backend node ID mapping

**Typical timing:** 50-200ms for full page

### Browser-Use Performance

**Advantages:**
- Direct DOM access
- Granular caching (WeakMaps)
- Incremental processing possible
- No protocol overhead

**Overhead:**
- Recursive traversal cost
- Multiple `getBoundingClientRect()` calls
- Style computation for each element
- Highlight overlay creation

**Typical timing:** 100-500ms depending on DOM size

## 7. Special Element Handling

### Iframes

**Stagehand:**
```typescript
// Detected in accessibility tree
if (node.role === 'Iframe') {
  // Marked but not traversed into
}
```

**Browser-Use:**
```javascript
// Attempts cross-origin access
if (tagName === "iframe") {
  const iframeDoc = node.contentDocument;
  if (iframeDoc) {
    // Process iframe content
  }
}
```

### Shadow DOM

**Stagehand:**
- Generally not included in accessibility tree
- Requires special handling

**Browser-Use:**
```javascript
if (node.shadowRoot) {
  nodeData.shadowRoot = true;
  for (const child of node.shadowRoot.childNodes) {
    buildDomTree(child);
  }
}
```

### Scrollable Elements

**Stagehand:**
```typescript
// Marks scrollable in role
if (scrollableBackendIds.has(node.backendDOMNodeId)) {
  roleValue = `scrollable, ${roleValue}`;
}
```

**Browser-Use:**
- Handles via viewport expansion parameter
- Can process elements outside viewport

## 8. Output Format Comparison

### Stagehand Output to LLM
```
Page Structure:
[1] navigation: Main Navigation
  [2] link: Home
  [3] link: Products
  [4] button: Cart (2 items)
[5] main: 
  [6] heading: Welcome to Our Store
  [7] button: Shop Now
  [8] textbox: Search products...
```

### Browser-Use Output to LLM
```
Current Active Dom Elements:
0: Welcome to Our Store
1: <nav class="main-nav">Home Products Cart</nav>
2: <a href="/">Home</a>
3: <a href="/products">Products</a>
4: <button class="cart-btn">Cart (2 items)</button>
5: <button class="cta-button">Shop Now</button>
6: <input type="text" placeholder="Search products...">
```

## 9. Trade-offs Analysis

### When Stagehand's Approach is Better:
- **Accessibility compliance** is important
- Need **semantic understanding** of page structure
- Working with **screen reader compatible** sites
- Want **consistent representation** across browsers
- Processing **very large DOMs** (single call efficiency)

### When Browser-Use's Approach is Better:
- Need **exact visual representation**
- Working with **non-semantic markup**
- Require **pixel-perfect positioning**
- Need to detect **visual-only interactions**
- Want **granular visibility control**

## 10. Hybrid Possibilities

Both approaches could be combined:
```typescript
// Hypothetical hybrid approach
async function getHybridDom() {
  // Get semantic structure from accessibility tree
  const { tree } = await getAccessibilityTree();
  
  // Enhance with visual properties
  for (const node of tree) {
    const element = await node.getElement();
    node.visualRect = element.getBoundingClientRect();
    node.computedStyle = getComputedStyle(element);
  }
  
  return tree;
}
```

## Conclusion

The fundamental difference is **semantic vs. visual** representation:

- **Stagehand** prioritizes semantic understanding through accessibility APIs, making it ideal for production workflows that need to work reliably across different visual presentations of the same content.

- **Browser-Use** prioritizes visual accuracy through direct DOM inspection, making it ideal for automating sites where visual cues are primary and accessibility might be lacking.

Both are valid approaches optimized for different use cases in the browser automation spectrum.