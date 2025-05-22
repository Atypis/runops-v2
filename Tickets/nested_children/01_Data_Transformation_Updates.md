# Ticket: Data Transformation Updates for Nested Nodes

## Objective
Update the data transformation logic in `lib/sop-utils.ts` to properly handle multi-level nesting of nodes, where any node type (including regular steps) can act as a parent container for child nodes.

## Requirements

1. Use `parentId` instead of `parentNode` for consistency with ReactFlow's API:
   - Update any code setting or checking `flowNode.parentNode` to use `parentId`
   - Ensure all children are properly linked to their parents via `parentId`

2. Mark any node with children as a container:
   - Set `flowNode.data.isCollapsible = true` for any node with children
   - Set `flowNode.data.childSopNodeIds` to track direct children IDs
   - Handle any "unsafe" layout cases by still proceeding with grouping

3. Compute container dimensions for all parent nodes:
   - Reuse sizing logic (padding and min dimensions) for any node with children
   - Apply calculated width/height to all parent nodes, not just loops
   - Ensure proper spacing and padding for nested content

4. Enforce proper node ordering and constraints:
   - Ensure parent nodes appear before their children in the flowNodes array
   - Set `extent: 'parent'` on child nodes to confine them within parent bounds
   - Add `expandParent: true` option to allow dynamic parent resizing

5. Edge handling for nested nodes:
   - Determine how to handle edges that connect parents to their children
   - Ensure proper edge routing for nested structures

## Acceptance Criteria

- The `transformSopToFlowData` function correctly identifies and marks all nodes with children as containers
- Child nodes are properly associated with their parents via `parentId`
- Container nodes have appropriate dimensions to accommodate their children
- The generated node structure preserves proper hierarchy and ordering
- The transformed data is compatible with ReactFlow's expectations for nested nodes

## Technical Notes

- This ticket focuses only on the data transformation layer, not the visual rendering
- Changes should maintain backward compatibility with existing SOP data
- Review existing `isSafeToRenderAsCompound` logic and adapt it for the new approach 