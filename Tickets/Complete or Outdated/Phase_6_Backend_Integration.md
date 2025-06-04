# Ticket: Phase 6 - Backend Integration

**Objective:** Connect the frontend SOP visualization and editing features to a backend API for data persistence and retrieval.

**Depends On:** All preceding frontend phases (especially Phase 1 for data structures and Phase 2 for editing actions).

**Key Tasks:**

1.  **API Endpoint for Fetching SOP Data (ADR-011)**:
    *   Define the structure for the API endpoint (e.g., `GET /api/sop/:id`).
    *   Modify the frontend data loading logic (from Phase 1) to fetch SOP data from this endpoint instead of `mocksop.json`.
    *   Handle API response (success, errors, loading states).
    *   Ensure the fetched data is correctly processed and displayed in both List View and ReactFlow View.
2.  **API Endpoint for Syncing SOP Changes (ADR-014)**:
    *   Define the structure for the API endpoint to save changes (e.g., `PATCH /api/sop/:id`).
    *   Determine the payload structure for the `PATCH` request. It should efficiently convey changes like:
        *   Step content updates (title, description).
        *   Step deletions.
        *   Step reordering (new parent/child relationships or order indices).
    *   Integrate `PATCH` calls into the frontend actions developed in Phase 2:
        *   After an inline edit is saved locally.
        *   After a step is deleted locally.
        *   After steps are reordered locally.
    *   Handle API responses for these `PATCH` calls (success, optimistic updates, error handling, potential conflict resolution strategies if considered for MVP).
3.  **Authentication/Authorization Considerations (ADR-011)**:
    *   While full auth implementation might be separate, ensure the API client on the frontend is prepared to send authentication tokens (e.g., Supabase JWT) if required by the backend for these endpoints.
    *   The backend will be responsible for protecting these routes.

**Acceptance Criteria:**

*   The frontend application fetches initial SOP data from a `GET /api/sop/:id` endpoint upon loading.
*   Changes made in the UI (edits to step content, step deletions, step reordering) trigger `PATCH /api/sop/:id` requests to the backend.
*   The frontend correctly handles responses from these API calls, updating its state or providing user feedback as necessary.
*   The application remains functional, using the backend as the source of truth for SOP data.

**Notes:**
*   This phase focuses on the frontend integration. The actual backend API implementation is a separate effort but must align with the contracts defined here.
*   For MVP, error handling might be basic (e.g., toast notifications for failures). 