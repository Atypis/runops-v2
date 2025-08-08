# Phase 2: Handling Structural Complexity

**Goal:** Accurately represent decision branches and loops in the ReactFlow diagram based on the JSON structure defined in `ParsingPrompt6.md`.

**Prerequisites:** Phase 1 completed. Sample JSON including decision and loop structures available.

**Key Steps:**

1.  **Enhance `toFlow` for Decisions:**
    *   Modify the `toFlow` transformer to recognize nodes with `type: "decision"`.
    *   Read the `condition` (e.g., "yes", "no") from outgoing edges in `public.edges` associated with decision nodes.
    *   Optionally, label these edges in the ReactFlow diagram (e.g., using `edge.label`).
2.  **Enhance `toFlow` for Loops:**
    *   Modify `toFlow` to handle nodes with `type: "loop"`.
    *   Identify the loop's `children` nodes as specified in the JSON (`loopNode.children`).
    *   Visually distinguish the loop node itself (see step 3).
    *   Ensure edges correctly represent child nodes connecting back to the loop start/parent (`condition: "next"`) or exiting the loop (`condition: "all_processed"`) 