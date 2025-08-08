# Ticket: Core Layout Algorithm - Depth-Aware Full-Width Container Strategy

## Objective
Implement a scalable multi-level nested node layout system using a full-width container strategy with depth-aware sizing that can handle unlimited nesting levels without breaking the grid.

## Strategy Overview

### Full-Width Container Rules
1. **Regular nodes**: Follow normal grid layout (2-N per row based on container width)
2. **Container nodes**: Always span full parent width and force a new row
3. **Width inheritance**: Child containers get proportional width (`floor(parent * 0.8)`) with minimum of 1
4. **Depth analysis**: Calculate max nesting depth first, then determine root container width accordingly

### Example Layout Structure
```
Root Container (4-wide, max depth=4):
├─ Row 1: [Step] [Step] [Step] [Step]
├─ Row 2: [Step] [Step] [---] [---]                     <- partial row
├─ Row 3: [CONTAINER spanning full 4-wide]              <- forces new row
│  ├─ Row 1: [Step] [Step] [Step]                       <- 3-wide (floor(4*0.8))
│  └─ Row 2: [SUB-CONTAINER spanning full 3-wide]       <- forces new row
│     ├─ Row 1: [Step] [Step]                           <- 2-wide (floor(3*0.8))
│     └─ Row 2: [DEEP-CONTAINER spanning full 2-wide]   <- forces new row
│        └─ Row 1: [Step]                               <- 1-wide (floor(2*0.8))
└─ Row 4: [Step] [Step] [Step] [Step]                   <- continues main grid
```

## Implementation Requirements

### 1. Depth Analysis Functions (sop-utils.ts)

```typescript
function calculateMaxNestingDepth(sopData: SOPDocument): number {
  let maxDepth = 0;
  
  function traverse(nodeId: string, currentDepth: number) {
    maxDepth = Math.max(maxDepth, currentDepth);
    const node = sopData.public.nodes.find(n => n.id === nodeId);
    if (node?.children) {
      node.children.forEach(childId => traverse(childId, currentDepth + 1));
    }
  }
  
  sopData.public.nodes.filter(n => !n.parentId).forEach(root => 
    traverse(root.id, 1)
  );
  return maxDepth;
}

function calculateMinimumContainerWidth(maxDepth: number): number {
  return Math.max(3, maxDepth); // Never go below 3 for readability
}

function calculateChildContainerWidth(
  parentWidth: number, 
  currentDepth: number, 
  maxDepth: number
): number {
  const calculatedWidth = Math.floor(parentWidth * 0.8);
  return Math.max(1, calculatedWidth);
}
```

### 2. Update Data Transformation (sop-utils.ts)

- Remove type restrictions - allow ANY node with children to be a container
- Calculate depth-aware container sizes during transformation
- Set `isCollapsible`, `childSopNodeIds`, and `calculatedWidth/Height` for all parent nodes
- Store `maxDepth` and `containerWidth` in flow node data for layout use

### 3. New Layout Algorithm (SOPFlowView.tsx)

Replace current single-level child positioning with recursive full-width container logic:

```typescript
function layoutChildrenWithContainers(
  children: FlowNode[], 
  parentWidth: number,
  parentPosition: {x: number, y: number},
  currentDepth: number,
  maxDepth: number
): FlowNode[] {
  const maxItemsPerRow = Math.max(1, parentWidth);
  let currentRow: FlowNode[] = [];
  let rows: FlowNode[][] = [];
  let currentY = 0;

  children.forEach(child => {
    const isContainer = child.data?.childSopNodeIds?.length > 0;
    
    if (isContainer) {
      // Finish current row if it has items
      if (currentRow.length > 0) {
        rows.push([...currentRow]);
        currentRow = [];
      }
      
      // Container gets its own full-width row
      rows.push([child]);
      
      // Recursively layout container's children
      const childWidth = calculateChildContainerWidth(parentWidth, currentDepth, maxDepth);
      child.children = layoutChildrenWithContainers(
        child.children, 
        childWidth, 
        child.position,
        currentDepth + 1,
        maxDepth
      );
    } else {
      // Regular node - add to current row
      currentRow.push(child);
      
      if (currentRow.length >= maxItemsPerRow) {
        rows.push([...currentRow]);
        currentRow = [];
      }
    }
  });
  
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }
  
  return positionRowsWithVariableWidths(rows, parentWidth, parentPosition);
}
```

### 4. Enhanced Positioning Logic

- Position regular nodes in grid within their row
- Position container nodes to span full parent width
- Calculate container heights based on their children + padding
- Apply proper header offsets recursively
- Handle coordinate transformation between nesting levels

### 5. Integration Points

- Update `getLayoutedElements` to use the new recursive algorithm
- Modify `withHeaderOffset` to work recursively with multiple levels
- Ensure `transformSopToFlowData` passes depth information to layout
- Keep DAGRE layout for top-level nodes, use new algorithm for children

## Acceptance Criteria

- Any node type (step, decision, loop) can act as a container when it has children
- Multi-level nesting works reliably up to 6+ levels deep
- Container nodes span full width of their parent and force new rows
- Child containers get proportionally smaller widths with 1-wide minimum
- Layout algorithm automatically determines root container width based on max depth
- No overlap or positioning errors in complex nested scenarios
- Performance remains acceptable with large SOPs (100+ nodes, 4+ levels)

## Technical Notes

- This ticket focuses on the core algorithm - UI styling is handled in subsequent tickets
- Maintain backward compatibility with existing single-level layouts
- Add comprehensive logging for debugging complex layouts
- Consider edge cases like empty containers or very deep nesting

## Test Data

Use `latest-sop-v0.8.json` and `mocksop-original-structure.json` which have real multi-level nesting:
- `L1_process_daily_emails` (loop) containing `L1_C3_process_investor_logic` (step with 7 children)
- `L1_C9_update_existing_record` (step with 3 children) nested inside the loop

This ticket establishes the foundation for multi-level nested layouts. Subsequent tickets will handle UI components and visual polish. 