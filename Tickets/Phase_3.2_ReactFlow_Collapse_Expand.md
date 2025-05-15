# Ticket: Phase 3.2 - ReactFlow Collapse/Expand Functionality

**Objective:** Implement collapse and expand functionality for parent nodes within the ReactFlow diagram. This will allow users to manage the complexity of large SOPs by selectively showing or hiding branches and sub-flows.

**Depends On:** Phase 3.1 (BPMN-lite Visuals & Layout Refinements)

**Key Tasks:**

1.  **Data Preparation for Collapsible Nodes:**
    *   In `lib/sop-utils.ts` (`transformSopToFlowData`):
        *   Identify nodes that should be collapsible (e.g., those with `children` in the original `SOPNode` data).
        *   Add `isCollapsible: true` and `childNodeIds: string[]` (IDs of direct children or all descendants) to the `data` prop of these ReactFlow nodes.
    *   Create a robust helper function, e.g., `getAllDescendantNodeIds(parentNodeId: string, allSopNodes: SOPNode[], allSopEdges: SOPEdge[]): string[]`, to accurately collect all recursive descendant IDs for a given node.

2.  **State Management for Collapsed Nodes:**
    *   In `app_frontend/components/sop/SOPFlowView.tsx`, add state to track the set of currently collapsed node IDs (e.g., `collapsedNodeIds: Set<string>`).

3.  **Modify Parent Node Components (e.g., `StepNode.tsx`):**
    *   If a node is marked as `isCollapsible` in its `data` prop:
        *   Render a visual indicator (e.g., a `+/-` icon or `ChevronDown`/`ChevronRight`).
        *   The indicator should reflect the node's current collapsed state (e.g., `data.isCurrentlyCollapsed`).
        *   On click, the indicator should trigger a callback function (e.g., `onToggleCollapse(nodeId)`) passed down to it.

4.  **Implement Toggle Logic & Node/Edge Filtering:**
    *   In `SOPFlowView.tsx`:
        *   Create an `onToggleCollapse(nodeId: string)` handler that updates the `collapsedNodeIds` state.
        *   Pass this handler to ReactFlow nodes (e.g., via the `data` prop of collapsible nodes if that's the chosen mechanism).
        *   When `sopData` or `collapsedNodeIds` change, implement logic (likely within `useEffect` or `useMemo`) to:
            *   Determine the set of `visibleNodes` and `visibleEdges`.
            *   If a node is in `collapsedNodeIds`, its descendants (identified by `getAllDescendantNodeIds`) are removed from `visibleNodes`.
            *   Edges connected to hidden nodes are also removed from `visibleEdges` (or only if both source and target are hidden).
            *   Update the `data` prop of collapsible nodes to include `isCurrentlyCollapsed` based on `collapsedNodeIds` for styling the +/- icon.
            *   Update the ReactFlow instance with `setNodes(visibleNodes)` and `setEdges(visibleEdges)`.

5.  **Layout Adjustments:**
    *   Ensure `fitView` is appropriately called or configured on the `<ReactFlow>` component to smoothly adjust the viewport after nodes are collapsed or expanded.

**Acceptance Criteria:**

*   Parent nodes in the ReactFlow diagram display a visual control to collapse/expand.
*   Clicking the control hides all descendant nodes and relevant edges.
*   Clicking the control again shows the descendant nodes and relevant edges.
*   The visual indicator on the parent node updates to reflect its current state (collapsed/expanded).
*   The diagram layout adjusts cleanly after collapse/expand actions. 