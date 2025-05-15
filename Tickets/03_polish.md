# Phase 3: UI Polish & Secondary Views

**Goal:** Improve the usability and presentation of the SOP visualiser by adding a list view and refining the overall styling.

**Prerequisites:** Phase 2 completed.

**Key Steps:**

1.  **List View Component:**
    *   Implement a `StepList` React component.
    *   Input: The parsed SOP JSON (or a relevant slice of it).
    *   Output: An ordered list (`<ol>`) displaying step titles, descriptions, and potentially other relevant info (`intent`, `context`).
2.  **View Toggle:**
    *   Add UI controls (e.g., Tabs, Segmented Control, Buttons) to allow users to switch between the ReactFlow diagram view and the `StepList` view.
    *   Manage the active view state in the parent component.
3.  **Refine Styling:**
    *   Apply Tailwind utility classes consistently across both the diagram and list views.
    *   Ensure good readability, spacing, and visual hierarchy.
    *   Consider subtle styling for different node types (if not done in Phase 2) or edge types.
4.  **(Optional) Custom Nodes Refinement:**
    *   If basic custom nodes were created in Phase 2, refine their appearance and information display. 