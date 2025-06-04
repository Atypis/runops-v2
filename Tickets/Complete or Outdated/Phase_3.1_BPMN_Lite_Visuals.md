# Ticket: Phase 3.1 - BPMN-lite Visuals & Layout Refinements

**Objective:** Enhance the ReactFlow diagram's clarity and adherence to common process modeling conventions by adopting BPMN-inspired visual styles for key node types and refining layout parameters.

**Depends On:** Initial ReactFlow setup (from original Phase 3 ticket)

**Key Tasks:**

1.  **Style `TriggerNode.tsx` (as BPMN Start Event):**
    *   Modify styling to a circular shape, green background, and appropriate icon/text contrast.
2.  **Style `EndNode.tsx` (as BPMN End Event):**
    *   Modify styling to a circular shape, red background (or thick red border), and appropriate icon/text contrast.
3.  **Create and Style `DecisionNode.tsx` (as BPMN Gateway/Decision):**
    *   Create a new custom node component.
    *   Design with a diamond visual cue (e.g., diamond icon within a rectangular node, or attempt a diamond shape if feasible).
    *   Use a distinct background color (e.g., yellow/orange).
4.  **Integrate `DecisionNode` into Flow Logic:**
    *   Update `transformSopToFlowData` in `lib/sop-utils.ts` to map `SOPNode.type === 'decision'` to the new `'decision'` ReactFlow node type.
    *   Update `SOPFlowView.tsx`:
        *   Import `DecisionNode.tsx`.
        *   Add `decision: DecisionNode` to `nodeTypes`.
        *   Adjust `getLayoutedElements` to account for `DecisionNode` dimensions if they differ significantly.
5.  **Review `StepNode.tsx` (as BPMN Task):**
    *   Ensure its styling (rounded rectangle) is consistent with the overall BPMN-lite theme. Minor color/border tweaks if necessary.
6.  **Refine Dagre Layout Parameters:**
    *   In `SOPFlowView.tsx`, review and adjust Dagre's `ranksep` and `nodesep` for optimal spacing with new node styles.
7.  **Fix Tailwind CSS Ambiguity Warning:**
    *   In `app_frontend/components/sop/StepCardDisplay.tsx`, change `duration-[300ms]` to `duration-&lsqb;300ms&rsqb;`.

**Acceptance Criteria:**

*   Trigger, End, and Decision nodes in the ReactFlow diagram use distinct, BPMN-inspired styling (shapes, colors).
*   The overall ReactFlow diagram layout is clear, readable, and well-spaced.
*   The Tailwind CSS `duration` warning is resolved. 