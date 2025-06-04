# Ticket: Phase 5 - Responsive Design & Accessibility

**Objective:** Ensure the SOP visualization interface is responsive across common device sizes and adheres to accessibility best practices.

**Depends On:** Phase 0, 1, 2, 3, 4 (as it applies to all developed UI components)

**Key Tasks:**

1.  **Responsive Behavior Implementation (Design Brief Sec 7)**:
    *   **≥ 1280 px**: Verify standard layout (e.g., 66/34 split for SOP/Chat panes) functions correctly.
    *   **960–1279 px**: Implement chat pane as a collapsible drawer, default closed. Adjust left SOP pane to take full width when chat is collapsed.
    *   **< 960 px**: Implement single-column layout. The chat panel access might transform into a floating action button (FAB) that opens the chat in a full-screen sheet or modal.
    *   Test and refine the responsiveness of all key components: HeaderCard, AccessCard, TriggerBlock, StepCards (in List View), ReactFlow canvas, and Chat Panel placeholder.
    *   Ensure content reflows and remains readable without horizontal scrolling on smaller screens.
2.  **Accessibility Enhancements (Design Brief Sec 8)**:
    *   **Keyboard Navigation**: Ensure all interactive elements (buttons, toggles, editable fields, drag handles, list items, ReactFlow nodes if applicable) are focusable and operable via keyboard.
        *   For drag-and-drop (List View), provide keyboard fallbacks (e.g., "Move Up" / "Move Down" buttons that appear on focus, or arrow key controls with modifiers as per DB Sec 6).
    *   **ARIA Attributes**: Apply appropriate ARIA roles and properties:
        *   `role="tree"` and `aria-level` for the hierarchical list view of steps.
        *   `aria-expanded`, `aria-controls` for collapse/expand toggles.
        *   `aria-label` or `aria-labelledby` for icon buttons or interactive elements needing clearer context.
    *   **Focus Management**: Ensure logical focus order and that focus is managed correctly after interactions (e.g., after closing a modal or saving an edit).
    *   **Color Contrast**: Verify that text and UI elements meet WCAG AA minimum contrast ratios (4.5:1 for normal text, 3:1 for large text and graphics), especially with the brand-indigo accent color.
    *   **Semantic HTML**: Use appropriate HTML5 elements for structure (nav, main, article, aside, etc.).
    *   **(Deferred) Live Regions**: Plan for live region announcements for dynamic changes like SOP regeneration or diff results (relevant when chat becomes functional).

**Acceptance Criteria:**

*   The application layout and components adapt correctly to viewport widths specified in the Design Brief.
*   All interactive UI elements are fully operable using only a keyboard.
*   Keyboard alternatives are provided for drag-and-drop interactions.
*   ARIA attributes are implemented to enhance semantic meaning and accessibility for screen reader users.
*   Color contrast meets WCAG AA guidelines.
*   The application provides a good user experience on various device sizes (desktop, tablet, mobile). 