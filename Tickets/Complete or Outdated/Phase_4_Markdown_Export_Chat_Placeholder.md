# Ticket: Phase 4 - Markdown Export & Chat Panel Placeholder

**Objective:** Provide users with a way to export the SOP as Markdown and set up the initial placeholder for the AI Assistant chat panel.

**Depends On:** Phase 1 (for SOP data)

**Key Tasks:**

1.  **Markdown Export Functionality (ADR-014)**:
    *   Add a "Copy as Markdown" button to the UI (location to be determined, perhaps near the SOP title or in a toolbar).
    *   Create a utility function that takes the current SOP data (hierarchical list structure) and transforms it into a Markdown string.
        *   The Markdown should represent the SOP's hierarchy (e.g., using headings for parent steps and nested lists for atomic steps).
        *   Include step titles and descriptions.
    *   Implement functionality to copy the generated Markdown string to the user's clipboard using the Clipboard API.
2.  **Chat Panel Placeholder (Right Pane - Design Brief Sec 4.5)**:
    *   In the right-hand pane of the main layout, implement the basic visual structure for the AI Assistant Chat Panel.
    *   **Static Elements for MVP Placeholder**: Create the visual shell with:
        *   A title/header for the chat panel.
        *   A placeholder for the chat thread area (e.g., a styled container).
        *   A placeholder for the input bar at the bottom, including a disabled text input and a disabled "Regenerate SOP" button.
        *   A visual cue for a status spinner (can be static or a simple non-functional CSS animation initially).
    *   This phase focuses on the static UI structure. Full chat functionality (WebSocket/SSE, message handling, API calls) is out of scope for this ticket and will be part of a later, more extensive development effort for the AI Assistant.

**Acceptance Criteria:**

*   A "Copy as Markdown" button is present in the UI.
*   Clicking the button converts the currently displayed SOP (from the List View data) into a Markdown formatted string and copies it to the clipboard.
*   The Markdown output should clearly represent the SOP's structure and content.
*   The right pane displays a static placeholder for the Chat Panel, matching the general layout described in the Design Brief (Sec 4.5), without functional chat capabilities. 