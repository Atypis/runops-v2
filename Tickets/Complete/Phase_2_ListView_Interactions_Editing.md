# Ticket: Phase 2 - List View Interactions & Editing (Complete)

**Objective:** Enable user interaction with the SOP List View, including editing step content, deleting steps, and reordering steps via drag-and-drop.

**Depends On:** Phase 1

**Key Tasks:**

1.  **Inline Editing for Step Cards (COMPLETED)**:
    *   Allow users to double-click (or click an edit icon) on a step's title or description within the `StepCard` in the List View to make it editable (e.g., using a content-editable div or swapping to an input/textarea). (COMPLETED)
    *   Save changes on blur or by pressing `Cmd/Ctrl + Enter`. (COMPLETED)
    *   Update the underlying SOP data state with the changes. (COMPLETED)
    *   (Backend `PATCH` sync will be deferred to Phase 6).
    *   **Micro-interaction**: Visual confirmation (green tick) upon saving an inline edit. (COMPLETED - part of Task 1)
2.  **Deleting Steps (COMPLETED)**:
    *   Provide a mechanism (e.g., a delete icon on `StepCard` hover) to remove a step from the list. (COMPLETED)
    *   Implement logic to handle deletion of parent steps (and their children) or individual atomic steps. (COMPLETED)
    *   Update the underlying SOP data state. (COMPLETED)
    *   (Backend `PATCH` sync deferred).
3.  **Drag-and-Drop Reordering of Steps (COMPLETED for same-level reordering)**:
    *   Integrate a drag-and-drop library (e.g., `@dnd-kit/core`, `@dnd-kit/sortable`). (COMPLETED)
    *   Allow users to drag `StepCard` items to reorder them within the list. (COMPLETED for root-level nodes AND for child nodes within their parent group)
    *   Handle reordering logic, considering hierarchical constraints. (Reordering of root nodes, and children within their parent group, implemented. Changing hierarchy, e.g., moving between parents or root/child status, is TBD / deferred).
    *   Update the underlying SOP data state to reflect the new order. (COMPLETED for same-level reordering)
    *   (Backend `PATCH` sync deferred).
    *   Known Issue: A bug exists where drag handles can become unresponsive/offset after certain invalid drag attempts; workaround is to scroll. See `Tickets/Backlog/BUG_DnD_Offset_After_Invalid_Drag.md`.
4.  **Micro-interactions Implementation (from Design Brief Sec 6 for List View) (COMPLETED)**:
    *   **Collapse/Expand Animation**: Ensure smooth height animation (150ms ease-out) and chevron rotation when toggling atomic steps. (COMPLETED)
    *   **Inline Edit Save Feedback**: Implement visual confirmation (e.g., green tick slides in for 2s) upon saving an inline edit. (COMPLETED - already part of Task 1)

**Acceptance Criteria:**

*   Users can edit the title and description of steps directly in the List View. (COMPLETED)
*   Users can delete steps (both parent and atomic) from the List View. (COMPLETED)
*   Users can reorder steps in the List View using drag-and-drop. (COMPLETED for same-level reordering; changing hierarchy deferred)
*   Changes made via editing, deletion, or reordering are reflected in the application's state. (COMPLETED)
*   Specified micro-interactions for collapse/expand and edit save are implemented. (COMPLETED) 