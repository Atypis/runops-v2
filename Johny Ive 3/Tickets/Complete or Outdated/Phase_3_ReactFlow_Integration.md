# Ticket: Phase 3 - ReactFlow Integration (Secondary View)

**Status: Initial Implementation Complete. Further enhancements tracked in sub-tickets.**

**Objective:** Implement the ReactFlow-based diagram visualization as a secondary, toggleable view for the SOP, including custom nodes and automatic layout.

**Depends On:** Phase 1 (for SOP data structure and processing)

**Sub-Tickets for Enhancements:**
*   `Tickets/Phase_3.1_BPMN_Lite_Visuals.md`
*   `Tickets/Phase_3.2_ReactFlow_Collapse_Expand.md`

**Summary of Initial Implementation (Completed):**

*   **View Toggle Control**: Implemented in `app/sop/[sopId]/page.tsx` to switch between List View and Flow View.
*   **ReactFlow Setup & Integration**: `reactflow` and `dagre` installed. `SOPFlowView.tsx` created and integrated with `ReactFlowProvider`, `Controls`, `MiniMap`.
*   **SOP Data Transformation**: `transformSopToFlowData` function created in `lib/sop-utils.ts` to convert `SOPDocument` to ReactFlow nodes/edges.
*   **Automatic Layout with Dagre**: Integrated into `SOPFlowView.tsx` for top-to-bottom layout.
*   **Custom ReactFlow Node Components**: `TriggerNode.tsx`, `StepNode.tsx`, and `EndNode.tsx` created and registered.
*   **Basic Interaction (Pan/Zoom)**: Provided by default ReactFlow controls.
*   **Trigger Logic**: Initial logic for connecting triggers to flow start nodes implemented and refined.

**Original Key Tasks (for reference - largely completed or superseded by sub-tickets):**

1.  **View Toggle Control**: COMPLETE
2.  **ReactFlow Setup & Integration**: COMPLETE
3.  **SOP Data Transformation for ReactFlow**: COMPLETE
4.  **Automatic Layout with Dagre**: COMPLETE
5.  **Custom ReactFlow Node Components**: COMPLETE (initial versions of `TriggerNode`, `StepNode`; `EndNode` also added). Styling refinements in Phase 3.1.
    *   ~~**`TriggerNode.tsx`**: Create a custom ReactFlow node for the trigger step, styled as per Design Brief Sec 4.3 (accent background, left ribbon, icon, text formatting).~~
    *   ~~**`StepNode.tsx`**: Create a custom ReactFlow node for regular SOP steps, styled as per Design Brief Sec 4.4 (card body, borders, radius, hover shadow). This node should display step title and potentially a summary.~~
        *   Note: Collapse/expand functionality deferred to Phase 3.2.
    *   ~~Register these custom nodes with ReactFlow.~~ COMPLETE
6.  **Basic Interaction (Pan/Zoom)**: COMPLETE

**Original Acceptance Criteria (for reference - largely met or refined in sub-tickets):**

*   A toggle allows users to switch between the List View and ReactFlow View. (MET)
*   The ReactFlow diagram renders the SOP steps from `mocksop.json` as nodes and connections as edges. (MET)
*   `dagre` automatically layouts the diagram. (MET)
*   Custom `TriggerNode` and `StepNode` components are used and styled according to the design brief. (Initial versions MET, design brief styling refinement in Phase 3.1)
*   Users can pan and zoom the diagram. (MET)
*   The ReactFlow view correctly displays hierarchical relationships if deemed feasible for MVP (e.g. visually grouping children under a parent or using specific edge types). (Basic hierarchical edge rendering MET; advanced grouping like subgraphs deferred) 