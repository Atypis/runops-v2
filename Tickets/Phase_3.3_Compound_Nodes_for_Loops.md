# Ticket: Phase 3.3 - Compound Nodes for Loops

**Objective:** Improve diagram clarity and reduce visual clutter in the ReactFlow view by implementing compound/subgraph nodes for loop structures (e.g., "Process Daily Emails"), visually containing their child steps.

**Depends On:** Phase 3.1 (BPMN-lite Visuals), Phase 3.2 (Collapse/Expand), Removal of hardcoded positions from `mocksop.json`.

**Key Tasks:**

1.  **Enable `compound: true` in Dagre Configuration:**
    *   In `app_frontend/components/sop/SOPFlowView.tsx`, modify the Dagre graph initialization: `new dagre.graphlib.Graph({ compound: true })`.

2.  **Update `transformSopToFlowData` in `app_frontend/lib/sop-utils.ts`:**
    *   Identify nodes that are parents of sub-flows (e.g., `L1_process_emails` based on its `children` array in `mocksop.json`).
    *   For these parent nodes, assign appropriate `style: { width: ..., height: ... }` values to ensure they are large enough to contain their children. This might require estimation or a dynamic calculation strategy in the future.
    *   For each child node that belongs to such a parent loop/sub-flow:
        *   Set the `parentNode` property in its ReactFlow node data to the ID of its respective parent node (e.g., `parentNode: 'L1_process_emails'`).
        *   Ensure these child nodes do not also try to set a `parentNode` if they are themselves parents of "atomic" steps already handled by `parentId` (the `children` array in `mocksop.json` defines the primary grouping for compound nodes).

3.  **Adjust Parent Node Styling (If Necessary):**
    *   Review the custom node component used for loops (likely `StepNode.tsx` or a similar component if loops have a dedicated type).
    *   Ensure its styling (padding, borders) works well when acting as a container for child nodes.

4.  **Test and Refine Layout:**
    *   Verify that child nodes are rendered within their parent compound node.
    *   Observe the effect on edge routing and overall diagram readability.
    *   Adjust parent node dimensions in `transformSopToFlowData` as needed for a good fit.
    *   Re-evaluate Dagre layout parameters (`nodesep`, `ranksep`) if necessary, in conjunction with compound nodes.

**Acceptance Criteria:**

*   Loop nodes like "Process Daily Emails" visually contain their child steps in the ReactFlow diagram.
*   The overall diagram layout is significantly cleaner, with fewer long, crossing edges related to loop structures.
*   Collapse/expand functionality continues to work correctly with compound nodes.
*   Edges connecting to and from the compound node and its children are routed clearly.

---

**Note on Further Enhancements:**

*   The dimensions for parent compound nodes will initially be estimated. A future enhancement could involve dynamically calculating these based on their content for a tighter fit.
*   If the clarity achieved with Dagre compound nodes is still insufficient, particularly for achieving mixed-orientation layouts (e.g., children to the right of a parent in a top-to-bottom flow), exploring the **Eclipse Layout Kernel (ELK)** as an alternative layout engine integrated with ReactFlow would be the next logical step. ELK offers more advanced per-subgraph layout options.
*   Layout refinement is an iterative process. Further adjustments to spacing, node sizing, and potentially edge routing may be needed after initial implementation. 