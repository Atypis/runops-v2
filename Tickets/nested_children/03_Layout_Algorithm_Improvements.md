# Ticket: Layout Algorithm Improvements for Multi-level Nesting

## Objective
Enhance the layout algorithm in `SOPFlowView.tsx` to properly handle multi-level nesting, ensuring that nested child nodes at any depth are positioned correctly within their parent containers.

## Requirements

1. Implement recursive child placement:
   - Modify the existing child positioning logic to handle multiple levels of nesting
   - Ensure children of children are properly positioned relative to their immediate parent
   - Replace the current single-pass approach with a recursive or multi-pass algorithm

2. Update the positioning data flow:
   - Ensure positioned child nodes are immediately added to `positionedNodesById` map
   - Implement proper traversal order (parents before their children) for consistent positioning
   - Handle edge cases where a parent is not yet positioned when its children need placement

3. Adjust parent node sizing logic:
   - Generalize the parent node resizing code to work with all container types, not just loops
   - Apply consistent padding and spacing rules for all parent types
   - Calculate required width/height based on child layout for all container nodes

4. Maintain header offset logic for all containers:
   - Ensure the `withHeaderOffset` function properly handles all parent node types
   - Verify that child nodes are positioned below their parent's header area
   - Adjust offset values if needed for different node types

5. Handle edge routing for nested structures:
   - Ensure edges connecting to nodes inside containers are properly routed
   - Handle cases where edges cross container boundaries
   - Maintain consistent edge appearance and routing

## Acceptance Criteria

- Child nodes at any nesting level are properly positioned within their parent container
- Parent containers are correctly sized to accommodate all their children
- No overlap occurs between parent headers and child nodes
- Layout is visually clean with proper spacing between elements
- Edges are properly routed in and out of nested containers
- The layout algorithm handles complex nesting scenarios without errors or fallbacks

## Technical Notes

- Consider implementing a depth-first traversal for positioning nodes
- Test with various nesting depths (2-3 levels at minimum)
- Verify that the layout maintains vertical alignment and flow direction
- Monitor performance with larger diagrams containing many nested nodes
- Consider adding debug logging to trace the positioning algorithm's behavior 