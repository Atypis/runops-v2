---
title: Ticket – Integrate ELK “layered” auto-layout with vertical spine & horizontal branches
---

# 📝 Ticket – Integrate ELK “layered” auto-layout with vertical spine & horizontal branches

## 1. Why?

The current Dagre layout handles only top-to-bottom flow. As workflows grow, sibling branches overlap and long edges snake across the canvas. ELK's layered algorithm provides:

- Per-subgraph directions (vertical spine, horizontal branches)
- Compound boxes that automatically resize to fit deep descendants
- Built-in ports, spacing, and tidy orthogonal edge routing

This upgrade should make every SOP readable without manual node shuffling.

---

## 2. Acceptance Criteria

| # | Scenario | Expected Result | **Status (End of Session)** |
|---|----------|-----------------|-----------------------------|
| 1 | Load any SOP | Root nodes (A → B → C → …) stack in a single vertical spine. | **Likely Met** (Visual inspection needed) |
| 2 | A root node has children | Children fan horizontally right of the parent. | **Likely Met** (Visual inspection needed) |
| 3 | A child has grandchildren | Grandchildren stack vertically under that child, staying inside the parent's compound box. | **Likely Met** (Visual inspection needed) |
| 4 | Two root decisions both have deep branches | ELK enlarges the first branch's box and pushes the second branch lower so boxes never overlap (default push-down strategy). | **Likely Met** (Visual inspection needed) |
| 5 | Manual drag | Works during the session but is not persisted; reload restores auto-layout. | **Met** (React Flow default behavior) |
| 6 | Performance | 100-node graph lays out in ≤ 500 ms in a web-worker. | **AT RISK / DEVIATION** (Now main-thread; performance TBD) |
| 7 | Edge look | All edges are orthogonal (right-angle bends), no diagonal or curved edges. | **Likely Met** (ELK option `'elk.layered.edgeRouting': 'ORTHOGONAL'` is set) |

---

## Session Summary & Key Learnings (NEW SECTION)

This session focused on integrating ELKjs for automated graph layout. After significant troubleshooting with the planned web worker approach, we pivoted to a main-thread implementation due to persistent environmental issues preventing worker execution.

**Current Status:** ELK is successfully rendering the SOP diagram on the main thread. Nodes are visible, and basic layout appears to be applied.

**Key Learnings & Deviations:**
*   **Web Worker Abandoned:** The primary deviation from the "Locked-in Design Choices" is the move from a web-worker to a main-thread implementation for ELK. This was necessary because:
    *   Webpack's transformation of `new Worker()` to `_Worker()` caused issues, first with our own worker, then with ELK's internal attempts to spawn sub-workers.
    *   Even with `elk.bundled.js` and careful pathing, the worker environment in Next.js (potentially due to Webpack configuration or other environmental factors) failed to execute worker scripts correctly (no logs, no `onmessage` triggering).
*   **ELK Configuration:**
    *   To run ELK synchronously, `workerUrl: null` (or omitting it when ELK can't find a worker environment) in the ELK constructor options was crucial to prevent it from attempting to use its own worker logic.
    *   The `elkjs` package requires `web-worker` as a dependency even if not actively using ELK's worker features, leading to an initial build error.
*   **TypeScript & Imports:** Careful handling of ELK types (`InstanceType<typeof ELKConstructor>`) and ensuring `elk.bundled.js` was accessible were key.

**Issues Encountered & Resolutions (Chronological Summary):**
1.  **Initial Setup:**
    *   Planned `elk-worker.ts` and `elkjs` dependency.
2.  **Build/Import Issues:**
    *   `Module not found: Can't resolve 'elkjs/lib/elk.bundled.js'`: Resolved by `npm install elkjs`.
    *   Persistent issues with `elkjs` module resolution inside the worker, leading to using `elk.bundled.js` directly via `importScripts`.
3.  **TypeScript Errors:**
    *   ELK types (`ElkNode`, `ElkExtendedEdge`) lacking a generic `data` field: Addressed by defining `CustomElkNode`, `CustomElkEdge`.
4.  **Worker Execution Failures:**
    *   `DataCloneError`: Caused by sending non-cloneable data (functions like `onToggleCollapse`) to the worker. Resolved by stripping UI-specific data before `postMessage` and re-attaching it after.
    *   `TypeError: undefined is not a constructor (evaluating 'new _Worker(url)')` (initially for our worker, then from within `elk.bundled.js`): This was the major blocker for the worker approach. Webpack's worker handling conflicted with ELK's internal worker spawning. Setting `workerUrl: null` in ELK options resolved the latter.
    *   No logs from `elk-worker.js` despite adding extensive logging: Indicated a fundamental failure of the worker script to execute or for `importScripts` to load `elk.bundled.js` correctly/without fatal error, even after copying it to `/public`.
    *   Test worker (`test-worker.js`) also failed to produce logs, confirming a general worker environment problem.
5.  **Pivot to Main-Thread ELK:**
    *   Due to persistent worker failures, ELK was implemented directly in `SOPFlowView.tsx`.
    *   Build error `Module not found: Can't resolve 'web-worker'` (from `elkjs/lib/main.js`): Resolved by `npm install web-worker`.
6.  **Final Warnings:**
    *   React Flow: `Node type "task"/"loop" not found`. Addressed by mapping them to `StepNode`.
    *   React Flow: `new nodeTypes or edgeTypes object`. Persists despite `nodeTypes` being global.
    *   Browser: `ResizeObserver loop completed with undelivered notifications`. Generally benign.

---

## 3. Locked-in Design Choices

| Area | Decision | Rationale | **Updated Status/Notes** |
|------|----------|-----------|--------------------------|
| Layout engine | ELK (layered) via `elkjs` in a web-worker | Supports mixed directions & compounds, keeps UI responsive | **DEVIATION:** Now main-thread due to worker issues. UI responsiveness for large graphs TBD. |
| Spine direction | `'elk.direction': 'DOWN'` (root graph) | Matches existing mental model | Implemented. |
| Branch direction | `'elk.direction': 'RIGHT'` on nodes flagged `isBranchRoot` | Horizontal child rows | Implemented via `sop-utils.ts`. |
| Descendant direction | Leave default (`'DOWN'`) unless a deeper node is also `isBranchRoot` | "Tree-of-trees" appearance | Implemented via `sop-utils.ts`. |
| Box sizing | `hierarchyHandling = INCLUDE_CHILDREN` (default) | Parent boxes always enclose every descendant | Implemented (ELK default). |
| Alignment | `'elk.alignment': 'CENTER'` | Keeps spine visually centred; slight x-adjustments allowed for symmetry | Implemented via `sop-utils.ts`. |
| Edge routing | `'elk.layered.edgeRouting': 'ORTHOGONAL'` | Clearest around right-angle boxes | Implemented. |
| Branch-root flag | Backend JSON field `isBranchRoot: true` | No new UI toggle needed | Assumed available and used in `sop-utils.ts`. |
| Auto-layout trigger | Run once on page load | Avoids latency on every edit | Implemented (runs on data/option changes). |
| Manual drag | No persistence | Simplest; user can always reload to reset | Default React Flow behavior. |
| Feature flag | None (always on) | Personal dog-fooding only | N/A. |

---

## 4. Task Breakdown

| Seq | Task | Owner | Notes | **Updated Status** |
|-----|------|--------|-------|--------------------|
| 1 | Add `elkjs` bundle + web-worker wrapper | FE | Copy ReactFlow ELK example | **DEVIATION:** Web worker wrapper abandoned. `elkjs` added directly. `web-worker` package also added as a dependency for `elkjs`. |
| 2 | Build `getLayoutOptions()` util returning locked-in defaults | FE | Includes spacing sliders | **Done.** |
| 3 | Extend node schema with `isBranchRoot` flag (back-end) | BE | Existing migrations tag appropriate nodes | **Assumed Done** (by frontend logic). |
| 4 | Invoke ELK once after initial React render | FE | Worker returns positions → `setNodes` | **DEVIATION:** ELK invoked on main thread. Logic for transforming data and applying layout is in `SOPFlowView.tsx` and `sop-utils.ts`. |
| 5 | Hook up two UI sliders for vertical/horizontal spacing | FE | Modify `'elk.layered.spacing.nodeNodeBetweenLayers'` and `'elk.spacing.componentComponent'` | **Done** (Three sliders implemented). |
| 6 | Documentation update (“Marking branch roots & tweaking spacing”) | Docs | Short MD file | To Do. |
| 7 | Demo & sign-off | PM |  | To Do. |

---

## Updated Next Steps for Tomorrow (NEW SECTION)

1.  **Verify Visual Acceptance Criteria:**
    *   Thoroughly check criteria #1, #2, #3, #4, and #7 against various SOPs.
2.  **Address React Flow `nodeTypes` Warning:**
    *   The warning `It looks like you've created a new nodeTypes or edgeTypes object` persists. Investigate if this is causing re-renders or if it can be safely ignored/suppressed if `nodeTypes` is confirmed stable.
3.  **Fine-Tune Layout & Spacing:**
    *   Test the three spacing sliders (`verticalNodeSpacing`, `horizontalBranchSpacing`, `siblingInBranchSpacing`) with different SOPs to find optimal default values.
    *   Review other ELK layout options in `sop-utils.ts` (`getElkLayoutOptions`) to see if further tuning for aesthetics or criteria matching is needed.
4.  **Performance Assessment (Main Thread):**
    *   Evaluate layout performance for a ~100-node graph on the main thread (Criterion #6).
    *   If performance is an issue, consider:
        *   Debouncing the layout recalculation when spacing sliders are changed.
        *   Optimizing the `transformSopToElkInput` or data filtering logic.
5.  **Revisit Web Worker (Optional but Recommended):**
    *   Given the original requirement and benefits, if time permits or if main-thread performance is insufficient, further investigate the root cause of worker execution failure in the Next.js/Webpack environment. This might involve:
        *   Simpler worker tests with different module loading strategies.
        *   Consulting Next.js specific documentation/forums for worker best practices.
        *   Potentially configuring Webpack's worker output if possible.
6.  **Code Cleanup:**
    *   Remove unused worker files: `app_frontend/workers/elk-worker.js` and `app_frontend/workers/test-worker.js`.
    *   Remove temporary `console.log` statements used for debugging.
7.  **Custom Node Components:**
    *   Currently, "task" and "loop" nodes are mapped to `StepNode`. Create or adapt specific components if their visual representation or functionality needs to differ.

---

## 5. Future Considerations (Not in Scope)

- Alternate LEFT/RIGHT branching or lane-slot strategies (could be added later by flipping `elk.direction` per branch or running a two-pass layout)
- Persisting manual node positions
- Feature-flag infrastructure or staged rollout

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation | **Updated Notes** |
|------|--------|------------|-------------------|
| Large graphs freeze UI | Poor UX | Web-worker execution; throttle redraw | **CURRENT STATUS:** Web worker abandoned. Risk of UI freeze exists. Mitigation for main-thread includes debouncing, optimization. |
| Unexpected ELK quirks in rare edge cases | Layout bugs | Keep minimal Dagre fallback behind a build flag (hidden) | Risk remains. Fallback not implemented. |
| Spacing feels off in specific diagrams | Readability | Expose spacing sliders; tweak defaults after dog-fooding | Mitigation in place (sliders and configurable defaults). |

---

## Hand-off

All locked-in choices are final. Work can begin with Task 1 in the next sprint.
**(Note: Significant deviation from web-worker approach occurred during implementation.)**