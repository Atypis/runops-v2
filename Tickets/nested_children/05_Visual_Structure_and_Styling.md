# Ticket: Visual Structure and Styling for Nested Nodes

## Objective
Establish consistent visual styling and structure for nested nodes to ensure clarity and readability in complex hierarchical SOP diagrams.

## Requirements

1. Define container node appearance:
   - Establish consistent styling for parent container nodes across types
   - Implement distinct visual cues for different container types (loops vs. steps)
   - Ensure container backgrounds, borders, and shadows visually group children

2. Implement header and label styling:
   - Ensure parent node headers remain visible and prominent
   - Handle long node labels appropriately (truncation, wrapping)
   - Position collapse toggles and other controls consistently

3. Add visual indicators for nested structure:
   - Implement child count indicators for container nodes
   - Add visual cues that distinguish containers from regular nodes
   - Ensure nested levels are visually distinct through color or styling

4. Optimize spacing and padding:
   - Establish consistent padding inside containers
   - Ensure adequate spacing between siblings and between nesting levels
   - Prevent visual crowding in complex diagrams

5. Handle edge styling for nested structures:
   - Define consistent edge appearance for connections crossing container boundaries
   - Consider styling differences for parent-child edges vs. sibling connections
   - Ensure edge labels remain readable in nested contexts

## Acceptance Criteria

- Container nodes have distinct, consistent styling that clearly indicates their role
- Child nodes are visually grouped within their parent containers
- Visual hierarchy is maintained through styling (color, borders, backgrounds)
- Nested diagrams remain readable and clear at various zoom levels
- Complex multi-level nesting maintains visual clarity
- The styling is consistent with the existing design language

## Technical Notes

- Review existing styling in LoopNode and extend similar patterns to other container types
- Consider using a lighter version of node type colors for container backgrounds
- Test with various diagram complexities and nesting depths
- Ensure styles work well with both light and dark themes (if applicable)
- Consider accessibility concerns (contrast, distinguishability without relying solely on color) 