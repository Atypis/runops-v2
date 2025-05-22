# Ticket: Implement Enhanced Collapse/Expand Functionality

## Objective
Implement a robust collapse/expand mechanism for nested nodes that properly hides child nodes and adjusts layout when containers are collapsed or expanded.

## Requirements

1. Implement node hiding for collapsed containers:
   - Use ReactFlow's `isHidden` attribute to hide child nodes when their parent is collapsed
   - Update the ReactFlow state to properly hide/show nodes based on expanded state
   - Ensure all descendants (not just direct children) are properly hidden when a container is collapsed

2. Handle edge visibility during collapse/expand:
   - Hide edges connected to hidden nodes when containers are collapsed
   - Ensure edges reappear properly when containers are expanded
   - Handle edge cases for edges that cross container boundaries

3. Implement re-layout on collapse/expand:
   - Re-run layout algorithm when a container is collapsed/expanded
   - Adjust the parent node's size when collapsed to minimize empty space
   - Ensure the diagram flows properly after collapsing or expanding nodes

4. Update SOPFlowView toggle handlers:
   - Enhance `handleToggleCollapse` to propagate visibility changes to all descendants
   - Maintain a map of node relationships for quick lookup of descendants
   - Update the layout after toggling to ensure proper visualization

5. Optimize performance for large diagrams:
   - Implement efficient methods for updating node visibility in bulk
   - Consider batching ReactFlow state updates to minimize re-renders
   - Test with complex diagrams to ensure smooth collapse/expand operations

## Acceptance Criteria

- Collapsing a container hides all its descendant nodes and associated edges
- Expanding a container reveals all its descendant nodes and edges
- The diagram layout adjusts properly after collapse/expand operations
- No visual artifacts or misplaced nodes occur during transitions
- Performance remains acceptable when collapsing/expanding large containers
- Nested collapse works properly (e.g., collapsing a parent with already-collapsed children)

## Technical Notes

- Use ReactFlow's `isHidden` property instead of removing nodes from the data structure
- Consider maintaining a map of parent->descendants for efficient lookup
- Test with complex nesting structures (multiple levels, siblings, etc.)
- Consider adding subtle animations or transitions for smooth visual changes
- Monitor performance impacts with large diagrams 