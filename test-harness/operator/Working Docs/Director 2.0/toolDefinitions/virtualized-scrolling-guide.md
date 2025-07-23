# Virtualized Scrolling Guide

## Overview

This guide documents the comprehensive virtualized scrolling capabilities available in Director 2.0. These features enable deterministic interaction with modern web applications that use virtualized grids, infinite scroll, and lazy-loaded content.

## Core Features

### 1. **scrollIntoView** - Progressive Element Discovery

Scrolls until a specific element appears in the DOM. Essential for virtualized content where elements only exist when in view.

#### Parameters:
- `scrollIntoViewSelector` (required): CSS selector of target element
- `scrollContainer` (optional): Container to scroll within. Auto-detects if not provided
- `scrollDirection`: Direction to scroll - "down" (default), "up", or "both"
- `scrollBehavior`: Animation - "smooth" (default), "instant", or "auto"
- `maxScrollAttempts`: Max attempts before failing (default: 30)

#### Example Usage:
```javascript
// Basic usage - auto-detects container
browser_action scrollIntoView scrollIntoViewSelector=".target-element"

// With specific container
browser_action scrollIntoView scrollIntoViewSelector="#item-500" scrollContainer=".scroll-area"

// Bi-directional search
browser_action scrollIntoView scrollIntoViewSelector=".old-message" scrollDirection="both"
```

### 2. **scrollToRow** - Index-Based Grid Navigation

Scrolls to a specific row index in virtualized grids. Supports multiple frameworks automatically.

#### Parameters:
- `rowIndex` (required): Zero-based row index
- `scrollContainer` (optional): Container to scroll. Auto-detects if not provided
- `rowHeight` (optional): Height of rows in pixels for precise scrolling
- `scrollBehavior`: Animation - "smooth" (default), "instant", or "auto"
- `maxScrollAttempts`: Max attempts before failing (default: 30)

#### Supported Grid Patterns:
- **React-Virtualized**: `style="top: XXXpx"` positioning
- **AG-Grid**: `[data-row-index]`, `[row-index]`
- **Tanstack Virtual**: `[data-index]`
- **HTML Tables**: `tr:nth-child()`
- **ARIA Grids**: `[aria-rowindex]` (1-based)
- **Custom**: `.row-X`, `#row-X`

#### Example Usage:
```javascript
// Basic usage - auto-detects grid type
browser_action scrollToRow rowIndex=500

// With precise row height (instant positioning)
browser_action scrollToRow rowIndex=500 rowHeight=50

// Specific container
browser_action scrollToRow rowIndex=100 scrollContainer=".ag-body-viewport"
```

## Auto-Detection Capabilities

### Container Auto-Detection

When `scrollContainer` is not provided, the system automatically detects common scrollable containers:

1. **React Virtualized**
   - `.ReactVirtualized__Grid`
   - `.ReactVirtualized__List`
   - `.ReactVirtualized__Table`
   - `.ReactVirtualized__Collection`

2. **Data Grid Libraries**
   - `.ag-body-viewport` (AG-Grid)
   - `.MuiDataGrid-virtualScroller` (Material UI)
   - `.ant-table-body` (Ant Design)
   - `.el-table__body-wrapper` (Element UI)

3. **Generic Patterns**
   - `[role="grid"]`
   - `[data-virtualized="true"]`
   - `.virtual-scroll`
   - `.infinite-scroll`
   - `.scrollable-container`
   - Elements with `overflow: auto` styles

### Row Height Auto-Detection

For React-Virtualized grids, `scrollToRow` automatically detects row height from the first visible row if not provided.

## DOM Exploration Tools Integration

### dom_overview with autoScroll

Captures complete page content including virtualized elements:

```javascript
// Capture all content with scrolling
dom_overview autoScroll=true maxScrollDistance=10000

// Scroll specific container
dom_overview autoScroll=true scrollContainer=".chat-messages" maxScrollDistance=5000
```

### dom_search with autoScroll

Search for elements that only appear when scrolled into view:

```javascript
// Search with auto-scrolling
dom_search query.text="hidden content" autoScroll=true

// Search in specific container
dom_search query.selector=".target" autoScroll=true scrollContainer=".list"
```

## Performance Best Practices

### 1. **Use rowHeight When Known**
```javascript
// ✅ Fast - single jump to position
browser_action scrollToRow rowIndex=500 rowHeight=50

// ❌ Slower - progressive scrolling
browser_action scrollToRow rowIndex=500
```

### 2. **Let Auto-Detection Work**
```javascript
// ✅ Good - uses auto-detection
browser_action scrollIntoView scrollIntoViewSelector=".item"

// Only specify container if auto-detection fails
browser_action scrollIntoView scrollIntoViewSelector=".item" scrollContainer=".custom-scroll"
```

### 3. **Use instant scrollBehavior for Automation**
```javascript
// ✅ Fast for automation
browser_action scrollToRow rowIndex=100 scrollBehavior="instant"

// Use smooth only when user experience matters
browser_action scrollToRow rowIndex=100 scrollBehavior="smooth"
```

### 4. **Direction Optimization**
```javascript
// ✅ Efficient - when you know direction
browser_action scrollIntoView scrollIntoViewSelector=".old-message" scrollDirection="up"

// Use "both" only when location is unknown
browser_action scrollIntoView scrollIntoViewSelector=".unknown" scrollDirection="both"
```

## Error Handling

Enhanced error messages provide diagnostic information:

```javascript
// Example error with diagnostics
Error: Row 99999 not found after 30 attempts. Estimated position: ~row 3000
{
  diagnostics: {
    containerHeight: 400,
    scrollHeight: 30000,
    finalScrollTop: 15000,
    scrolledDistance: 15000,
    visibleRowCount: 15
  }
}
```

## Common Use Cases

### 1. **Infinite Social Media Feeds**
```javascript
// Find old posts
browser_action scrollIntoView scrollIntoViewSelector="[data-date='2024-01-01']" scrollDirection="down"
```

### 2. **Chat History**
```javascript
// Scroll to old messages (reverse timeline)
browser_action scrollIntoView scrollIntoViewSelector=".first-message" scrollDirection="up"
```

### 3. **Large Data Tables**
```javascript
// Navigate to specific row
browser_action scrollToRow rowIndex=1500 rowHeight=32
```

### 4. **Virtualized Lists**
```javascript
// React-Virtualized demo
browser_action navigate url="https://bvaughn.github.io/react-virtualized/#/components/List"
browser_action scrollToRow rowIndex=500 rowHeight=50
```

## Testing Your Implementation

### Test Script Template
```javascript
// 1. Navigate to your target page
browser_action navigate url="YOUR_URL"
browser_action wait waitType="time" waitValue="2000"

// 2. Test auto-detection
browser_action scrollToRow rowIndex=100

// 3. Verify element appeared
browser_query validate rules=[{type: "element_exists", selector: "YOUR_SELECTOR"}]

// 4. Test DOM tools with scrolling
dom_overview autoScroll=true maxScrollDistance=5000
```

## Troubleshooting

### Issue: Auto-detection not working
**Solution**: Manually specify scrollContainer
```javascript
browser_action scrollToRow rowIndex=100 scrollContainer=".my-custom-grid"
```

### Issue: Scrolling stops too early
**Solution**: Increase maxScrollAttempts
```javascript
browser_action scrollIntoView scrollIntoViewSelector=".far-element" maxScrollAttempts=50
```

### Issue: Wrong row position
**Solution**: Provide exact rowHeight
```javascript
browser_action scrollToRow rowIndex=500 rowHeight=75
```

## Implementation Notes

- Default `maxScrollAttempts` increased from 10 to 30 (allows ~15,000px scrolling)
- Each scroll step is 500px for viewport, or 50% of container height
- Auto-detection runs only when scrollContainer is not provided
- Row height detection works best with React-Virtualized patterns
- All features work identically in both nodes (workflows) and exploration tools