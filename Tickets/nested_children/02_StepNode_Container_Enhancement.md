# Ticket: Enhance StepNode to Support Child Containers

## Objective
Modify the `StepNode` component to properly render as a container when it has children, similar to how `LoopNode` currently works, enabling any step to visually contain nested nodes.

## Requirements

1. Add child container to StepNode:
   - Identify when a step has children via `data.childSopNodeIds` property
   - Add a container div for children with appropriate styling (similar to LoopNode)
   - Position the container below the node's header/content section
   - Apply appropriate background color and padding for the child area

2. Adjust StepNode styling for container nodes:
   - Create visual distinction for steps that are containers vs. regular steps
   - Consider using a distinct border color or styling for container steps
   - Ensure proper spacing and z-index for layered components

3. Add expand/collapse controls:
   - Add a toggle button in the step node header for collapse/expand
   - Implement click handler that calls `data.onToggleCollapse`
   - Update UI based on `data.isExpanded` state
   - Ensure proper icon orientation for expanded/collapsed states

4. Handle conditional rendering of children:
   - Only render the child container when `data.isExpanded !== false`
   - Ensure proper sizing when collapsed vs. expanded
   - Reconcile with existing StepNode expansion behavior for details/context

5. Add child count indicator:
   - Show the number of child steps in the header
   - Add a visual indicator that the step contains sub-steps

## Acceptance Criteria

- StepNode correctly renders a container area when it has children
- The container has appropriate styling, padding, and positioning
- Child nodes appear properly inside the container area
- The expand/collapse toggle works correctly
- The node visually indicates it has children (through styling and count)
- The expansion state for details doesn't conflict with child container expansion

## Technical Notes

- Use `LoopNode.tsx` as a reference for container implementation
- Ensure the container has proper z-indexing to not interfere with other elements
- Consider how this will work with the existing "expanded" state for step context
- Test with different node sizes and content lengths
- Verify that children are positioned correctly relative to the step header 