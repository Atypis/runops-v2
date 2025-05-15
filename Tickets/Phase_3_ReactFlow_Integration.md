# Ticket: Phase 3 - ReactFlow Integration (Secondary View)

**Objective:** Implement the ReactFlow-based diagram visualization as a secondary, toggleable view for the SOP, including custom nodes and automatic layout.

**Depends On:** Phase 1 (for SOP data structure and processing)

**Key Tasks:**

1.  **View Toggle Control**:
    *   Add a UI control (e.g., a toggle switch or button, likely in the top-right of the SOP [left] pane) to switch between the default List View and the ReactFlow diagram view.
2.  **ReactFlow Setup & Integration**:
    *   Install `reactflow` and its dependencies (including `dagre` for layout).
    *   Embed the `ReactFlow` component in a new container/component that is shown when the ReactFlow view is active.
    *   Wrap the `ReactFlow` component with `ReactFlowProvider`.
    *   Add basic ReactFlow controls (e.g., `MiniMap`, `Controls` for zoom/pan).
3.  **SOP Data Transformation for ReactFlow**:
    *   Develop/adapt a utility function to convert the hierarchical SOP JSON data (from `mocksop.json` / processed data) into ReactFlow's `nodes` and `edges` arrays.
    *   Ensure the transformation correctly represents parent-child relationships as edges for the diagram.
    *   The `edges` data from `mocksop.json` should be used to connect the steps.
4.  **Automatic Layout with Dagre**:
    *   Integrate `dagre` for automatic layout of the nodes and edges to create a clear, readable diagram (ADR-013).
5.  **Custom ReactFlow Node Components**:
    *   **`TriggerNode.tsx`**: Create a custom ReactFlow node for the trigger step, styled as per Design Brief Sec 4.3 (accent background, left ribbon, icon, text formatting).
    *   **`StepNode.tsx`**: Create a custom ReactFlow node for regular SOP steps, styled as per Design Brief Sec 4.4 (card body, borders, radius, hover shadow). This node should display step title and potentially a summary.
        *   Note: Collapse/expand functionality within ReactFlow nodes is more complex than in list view and might be simplified or deferred if it complicates the diagram view excessively for MVP.
    *   Register these custom nodes with ReactFlow.
6.  **Basic Interaction (Pan/Zoom)**:
    *   Ensure users can pan and zoom the ReactFlow diagram for better navigation.

**Acceptance Criteria:**

*   A toggle allows users to switch between the List View and ReactFlow View.
*   The ReactFlow diagram renders the SOP steps from `mocksop.json` as nodes and connections as edges.
*   `dagre` automatically layouts the diagram.
*   Custom `TriggerNode` and `StepNode` components are used and styled according to the design brief.
*   Users can pan and zoom the diagram.
*   The ReactFlow view correctly displays hierarchical relationships if deemed feasible for MVP (e.g. visually grouping children under a parent or using specific edge types). 