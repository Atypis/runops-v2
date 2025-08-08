# Phase 4: Integration (Later Stage)

**Goal:** Connect the standalone visualiser component to the actual backend API once the upload/processing pipeline is built.

**Prerequisites:** Phase 3 completed. Backend API endpoint for fetching SOP JSON (e.g., `/api/sop/:id`) is available.

**Key Steps:**

1.  **Replace JSON Input:** Remove the `JsonDrop` (or equivalent) component used for local file loading.
2.  **Fetch Data:** Implement logic to fetch the SOP JSON data from the backend API endpoint using the appropriate job/SOP ID.
3.  **Handle Loading/Error States:** Add UI elements (spinners, messages) to indicate when data is being fetched and handle potential API errors gracefully.
4.  **Connect Data:** Pass the fetched JSON data to the existing `toFlow` transformer and `StepList` component. 