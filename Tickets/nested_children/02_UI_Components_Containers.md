# Ticket: UI Components - Universal Container Support & Visual Hierarchy

## Objective
Update React components to support any node type as a visual container, implement depth-based styling, and add robust collapse/expand functionality for multi-level nested structures.

## Requirements

### 1. Enhance StepNode for Container Support

Extend `StepNode.tsx` to render container areas when it has children, similar to `LoopNode.tsx`:

```jsx
// Add container detection and rendering
const isContainer = data.childSopNodeIds && data.childSopNodeIds.length > 0;
const containerWidth = data.containerWidth || 3; // From layout algorithm

{isContainer && data.isExpanded !== false && (
  <div 
    className="step-container-area"
    style={{
      width: '100%',
      minHeight: '200px',
      backgroundColor: 'rgba(239, 68, 68, 0.05)', // Light red tint for step containers
      border: '1px solid rgba(239, 68, 68, 0.2)',
      borderRadius: '8px',
      padding: '20px',
      marginTop: '12px',
      position: 'relative'
    }}
    data-child-container="true"
  >
    {/* Child count indicator */}
    <div className="container-footer">
      {data.childSopNodeIds.length} steps • Width: {containerWidth}
    </div>
  </div>
)}
```

### 2. Implement Depth-Based Visual Hierarchy

Create a visual system that distinguishes nesting levels:

```typescript
function getContainerStyling(nodeType: string, depth: number) {
  const baseColors = {
    loop: { border: '#8b5cf6', background: 'rgba(139, 92, 246, 0.05)' },
    step: { border: '#ef4444', background: 'rgba(239, 68, 68, 0.05)' },
    decision: { border: '#eab308', background: 'rgba(234, 179, 8, 0.05)' }
  };
  
  const color = baseColors[nodeType] || baseColors.step;
  const opacity = Math.max(0.3, 1 - (depth * 0.1)); // Fade deeper levels
  
  return {
    borderColor: color.border,
    backgroundColor: color.background,
    opacity,
    borderWidth: Math.max(1, 3 - depth) // Thinner borders for deeper levels
  };
}
```

### 3. Universal Collapse/Expand System

Implement consistent expand/collapse behavior across all container types:

#### Component-Level Changes:
- Add collapse toggle to container headers (StepNode, DecisionNode if needed)
- Use consistent chevron icons and positioning
- Show child count and container width in headers

#### State Management (SOPFlowView.tsx):
```typescript
// Enhanced collapse handler for multi-level
const handleToggleCollapse = useCallback((nodeId: string) => {
  setExpandedNodes(prev => {
    const newState = { ...prev };
    const isCurrentlyExpanded = prev[nodeId] !== false;
    
    // Toggle current node
    newState[nodeId] = !isCurrentlyExpanded;
    
    // If collapsing, also collapse all descendants
    if (isCurrentlyExpanded) {
      const descendants = getAllDescendantIds(nodeId, nodes);
      descendants.forEach(id => {
        newState[id] = false;
      });
    }
    
    return newState;
  });
}, [nodes]);

// Use ReactFlow's isHidden property for collapsed nodes
const updateNodeVisibility = useCallback(() => {
  setNodes(currentNodes => 
    currentNodes.map(node => {
      const shouldBeHidden = isNodeCollapsed(node.id, expandedNodes, currentNodes);
      return { ...node, hidden: shouldBeHidden };
    })
  );
}, [expandedNodes]);
```

### 4. Container Size Indicators

Add visual indicators showing container dimensions and nesting:

```jsx
// Container metadata bar
<div className="container-metadata">
  <span className="depth-indicator">Level {currentDepth}</span>
  <span className="width-indicator">{containerWidth}-wide</span>
  <span className="child-count">{childCount} items</span>
</div>
```

### 5. Enhanced DecisionNode Container Support

If decision nodes can have children, add similar container functionality:

- Diamond-shaped header with expand/collapse controls
- Container area below the decision diamond
- Appropriate spacing and visual hierarchy

### 6. Improved Header Offset Calculation

Update `withHeaderOffset` and `getHeaderHeights` for new container types:

```typescript
function getHeaderHeights(nodes: FlowNode[]): Record<string, number> {
  const headerHeights: Record<string, number> = {};
  
  nodes.forEach(node => {
    if (node.data?.childSopNodeIds?.length) {
      let headerHeight = 60; // Default
      
      switch (node.type) {
        case 'loop':
          headerHeight = node.data?.isExpanded === false ? 45 : 120;
          break;
        case 'step':
          // Account for step header + metadata bar
          headerHeight = node.data?.isExpanded === false ? 50 : 90;
          break;
        case 'decision':
          headerHeight = node.data?.isExpanded === false ? 60 : 100;
          break;
      }
      
      headerHeights[node.id] = headerHeight;
    }
  });
  
  return headerHeights;
}
```

## Acceptance Criteria

### Visual Requirements:
- StepNode correctly renders container area when it has children
- Each container type has distinct visual styling (color-coded borders/backgrounds)
- Deeper nesting levels have progressively subtler styling (opacity/border thickness)
- Container metadata (width, depth, child count) is clearly displayed
- Expand/collapse toggles are consistent across all container types

### Interaction Requirements:
- Clicking expand/collapse toggle shows/hides children and updates container size
- Collapsing a parent automatically collapses all descendants
- Expanding a parent reveals children in their last known expansion state
- Container nodes adapt their visual size based on expanded/collapsed state
- Smooth transitions between expanded/collapsed states

### Layout Requirements:
- Container nodes correctly size themselves to accommodate children
- Header offsets prevent children from overlapping parent headers
- Full-width containers span their parent's complete width
- Container backgrounds and borders don't interfere with child nodes

## Implementation Notes

- Leverage existing LoopNode container implementation as reference
- Maintain consistent styling patterns across all container types  
- Ensure container styling works well at different zoom levels
- Test with various combinations of nested container types
- Add proper ARIA labels for accessibility

## Dependencies

This ticket depends on **Ticket 01: Core Layout Algorithm** being completed, as it relies on the new layout system providing proper `containerWidth`, `currentDepth`, and positioning data to the UI components.

## Test Cases

1. **Step containing steps**: Verify visual container and expand/collapse
2. **Decision containing steps**: Test if decisions can act as containers
3. **Multi-level nesting**: Loop → Step → Steps (3 levels) with different styling
4. **Mixed containers**: Different container types at same nesting level
5. **Deep nesting**: 4+ levels with progressive visual hierarchy
6. **Large containers**: Containers with 10+ children handle sizing properly 