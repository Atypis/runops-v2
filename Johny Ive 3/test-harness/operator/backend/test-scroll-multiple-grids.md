# Multi-Grid Scrolling Test Suite

Hey Director! We've enhanced `scrollToRow` to support multiple grid implementations. Here's a test suite covering various virtualized grids:

## 1. React-Virtualized (Fixed!)

```javascript
// Navigate to React Virtualized demo
browser_action navigate url="https://bvaughn.github.io/react-virtualized/#/components/List"
browser_action wait waitType="time" waitValue="2000"

// Test 1: With explicit rowHeight (most precise)
browser_action scrollToRow scrollContainer=".ReactVirtualized__Grid" rowIndex=500 rowHeight=50

// Test 2: Without rowHeight (auto-detection)
browser_action scrollToRow scrollContainer=".ReactVirtualized__Grid" rowIndex=800

// Validate
dom_search query.text="This is row 500"
dom_search query.text="This is row 800"
```

## 2. AG-Grid Demo

```javascript
// Navigate to AG-Grid demo
browser_action navigate url="https://www.ag-grid.com/example"
browser_action wait waitType="selector" waitValue=".ag-root"

// AG-Grid uses data-row-index
browser_action scrollToRow scrollContainer=".ag-body-viewport" rowIndex=100

// Validate
browser_query validate rules=[{type: "element_exists", selector: "[data-row-index='100']"}]
```

## 3. Traditional HTML Table

```javascript
// Any page with a long table
browser_action navigate url="https://en.wikipedia.org/wiki/List_of_countries_by_population_(United_Nations)"
browser_action wait waitType="time" waitValue="2000"

// Tables use tr:nth-child
browser_action scrollToRow scrollContainer="table.wikitable" rowIndex=50

// Validate - row 51 because nth-child is 1-based
browser_query validate rules=[{type: "element_exists", selector: "tr:nth-child(51)"}]
```

## 4. Virtualized Table with ARIA

```javascript
// Many modern tables use ARIA attributes
// Example: Google Sheets or similar
browser_action scrollToRow scrollContainer="[role='grid']" rowIndex=200

// ARIA uses 1-based indexing
browser_query validate rules=[{type: "element_exists", selector: "[aria-rowindex='201']"}]
```

## 5. Custom Implementation Patterns

The enhanced `scrollToRow` now supports:

### Style-based (React-Virtualized):
- `div[style*="top: 25000px"]` (when rowHeight=50, rowIndex=500)

### Data attributes (AG-Grid, Tanstack):
- `[data-rowindex="500"]`
- `[data-row-index="500"]`
- `[row-index="500"]`
- `[data-index="500"]`

### ARIA accessibility:
- `[aria-rowindex="501"]` (1-based)

### Class/ID based:
- `.row-500`
- `#row-500`

### Traditional HTML:
- `tr:nth-child(501)` (1-based)

## Auto-Detection Features

When `rowHeight` is not provided:
1. For React-Virtualized grids, we auto-detect row height from the first visible row
2. For AG-Grid, we attempt to use the grid API if available
3. For others, we use progressive scrolling with smart estimation

## Error Handling

The enhanced error messages now show:
- Container dimensions
- Final scroll position
- Estimated current row position
- Number of visible rows

## Performance Tips

1. **Always provide rowHeight when known** - enables single-jump scrolling
2. **Use specific scrollContainer** - faster than viewport scrolling
3. **Set scrollBehavior="instant"** for faster automation

Let me know how these work across different sites!