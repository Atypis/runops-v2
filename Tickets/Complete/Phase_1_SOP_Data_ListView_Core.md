# Ticket: Phase 1 - SOP Data & List View Core

**Status: IN PROGRESS (Mostly Complete)**

**Objective:** Define the SOP data structure, load mock data, and implement the primary List View interface for displaying SOPs hierarchically.

**Depends On:** Phase 0 (✔️ Completed)

**Key Tasks:**

1.  **TypeScript Interfaces for SOP Data**: ✔️
    *   Define comprehensive TypeScript interfaces based on the structure of `mocksop.json` (including metadata, triggers, nodes with potential children for hierarchy, edges, variables, clarification requests, etc.). ✔️ (`app_frontend/lib/types/sop.ts` created)
2.  **SOP Data Loading and Preparation**: ✔️
    *   Implement functionality to load `mocksop.json` (as a placeholder for future API fetching). ✔️ (Copied to `app_frontend/public/mocksop.json` and fetched in `SOPListView.tsx`)
    *   Create a utility function to process the raw SOP JSON. This function should: ✔️
        *   Resolve `children` IDs in parent nodes to full child node objects to facilitate easier hierarchical rendering. ✔️ (`processSopData` in `app_frontend/lib/sop-utils.ts`)
        *   Prepare any other data transformations needed for the view components. ✔️ (`getRootNodes` in `app_frontend/lib/sop-utils.ts`)
3.  **`SOPListView.tsx` Component Implementation (Default View)**: ✔️
    *   This component will be the main content of the left pane by default. ✔️ (`app_frontend/components/sop/SOPListView.tsx` created and used in `app/sop/[sopId]/page.tsx`)
    *   **Header Card Integration**: Display the `HeaderCard` component (from Design Brief Sec 4.1) at the top, populated with data from `meta` (title, version, goal). ✔️ (`app_frontend/components/sop/HeaderCard.tsx` created and integrated)
    *   **Access Card Integration**: Display the `AccessCard` component (DB Sec 4.2) likely below the Header Card or in a designated sidebar area within the left pane. ✔️ (`app_frontend/components/sop/AccessCard.tsx` created and integrated with mock data)
    *   **Trigger Block Rendering**: Display the `TriggerBlock` (DB Sec 4.3) as the first distinct item in the SOP sequence. ✔️ (`app_frontend/components/sop/TriggerBlockDisplay.tsx` created and integrated)
    *   **Hierarchical Step Rendering**: ✔️
        *   Iterate through the processed SOP nodes, rendering each as a `StepCard` (styled according to DB Sec 4.4). ✔️ (`app_frontend/components/sop/StepCardDisplay.tsx` created and integrated)
        *   Implement visual hierarchy (indentation, guide lines) for parent and child (atomic) steps. ✔️
        *   Include a chevron toggle for parent steps to collapse/expand their children (atomic steps). ✔️
        *   When collapsed, parent steps should show a summary (e.g., "3 atomic steps"). ✔️

**Acceptance Criteria:**

*   TypeScript interfaces accurately model the `mocksop.json` structure. ✔️
*   `mocksop.json` data is loaded, processed, and available to the view components. ✔️
*   The `SOPListView` component renders in the left pane. ✔️
*   `HeaderCard`, `AccessCard`, and `TriggerBlock` are displayed with mock data. ✔️
*   SOP steps (including the new atomic steps) are rendered hierarchically. ✔️
*   Parent steps can be collapsed and expanded to show/hide their children. ✔️ 