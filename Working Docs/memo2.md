# Memory System – Current State & Findings (June 17 2025)

## 1. High-level Architecture

```
Workflow node ──▶ ExecutionEngine* ─┐
                                 │
                                 │  (Inputs, Processing, Outputs)
                                 ▼
                       MemoryManager (server)
                                 │
                                 │  (Supabase insert – `memory_artifacts`)
                                 ▼
                        Supabase DB  ──▶  Memory API routes  ──▶  Front-end
                                 ▲
                                 │
                   HybridBrowserManager† ──┘
```

*ExecutionEngine* – orchestrates full workflow executions. For each node it now **always** calls `MemoryManager.captureNodeMemory` after we removed early `return` statements.

†*HybridBrowserManager* – powers ad-hoc single-VNC actions (used by the "Direct action" API). It wraps `BrowserManager` and:
1. Captures browser state before/after each action (DOM snapshot, URL, session state).
2. Emits StagehandMemoryHooks events for live traces.
3. Persists a **minimal** `memory_artifact` so that single-VNC executions still surface in the UI.

## 2. Key Components

| Layer | File(s) | Responsibility |
|-------|---------|----------------|
| *Memory types* | `app_frontend/lib/memory/types.ts` | Source-of-truth interfaces (`MemoryInputs`, `MemoryProcessing`, `MemoryOutputs` …) |
| *Capture helpers* | `BrowserStateCapture.ts` | DOM snapshot, current URL, session cookies, etc. |
| *Instrumentation* | `StagehandMemoryHooks.ts` | Emits **action_start/complete/error** events (used for traces & debugging). |
| *Persistence* | `MemoryManager.ts` | Validates + inserts artifacts into Supabase table `memory_artifacts`. |
| *Display* | `NodeMemoryPanel.tsx`, `MemoryPhaseView.tsx` | Fetch & render Inputs / Processing / Outputs buckets via `/api/aef/memory/*` routes. |

## 3. What's Working ✅

1. **Artifacts now contain real data**  
   • DOM snapshot (raw HTML)  
   • Action inputs (instruction, credentials, selectors)  
   • Processing actions list with timestamps  
   • Outputs → primary data, state changes, execution metadata.
2. **Artifacts are written for both full Engine runs and single-VNC actions.**  
   Verified via `debug-detailed-memory.js`.
3. **Backend API `/api/aef/memory/[executionId]/[nodeId]` returns the new structure** without errors.

## 4. Current Gaps 🚧

| Symptom | Suspected Cause |
|---------|-----------------|
| Front-end shows "Memory (Pending)" or empty panels even though DB has data | The UI still assumes the **old, sparse schema**. `NodeMemoryPanel` only renders a subset of fields. |
| Missing DOM snapshots for some nodes (e.g. *gmail search today*, *click next password*) | 1) BrowserStateCapture may crash (`DOM.disable` CDP error seen). 2) Snapshot is captured but not forwarded when the action is LLM-driven. |
| LLM interactions column always `0` | Deterministic Stagehand nodes do not record LLM msgs; AI nodes need to call `ProcessingCapture.addLLMInteraction`. |
| Browser events array size == 0 | StagehandMemoryHooks → `getExecutionTrace` returns custom object, not mapped into `browserEvents`. |

## 5. Next Steps

1. **UI refactor**  
   • Extend `useMemoryData` to merge `inputs.environment.*`, `outputs.browserState.*`, `processing.actions`, etc.  
   • Render DOM snapshot preview (first N chars) & full viewer modal.  
   • Show action list + timeline inside *Processing* bucket.
2. **Reliable DOM snapshots**  
   • Fix CDP error `DOM.disable` by ensuring `DOM.enable` before snapshot.  
   • Fallback to `document.documentElement.outerHTML` if CDP fails.
3. **LLM & Browser events capture**  
   • Wire `LLMInteraction` recording in AI-powered nodes.  
   • Convert Stagehand trace events to `BrowserEvent` objects before persistence.
4. **Screenshots & performance**  
   • Store PNG-base64 under `environment.screenshot` and/or `outputs.screenshot`.  
   • Record `executionMetadata.duration` per action.
5. **Data-size controls**  
   • Honour `compressLargeData` flag; gzip snapshots > 100 KB.

---
_Compiled automatically by the AI assistant after hands-on debugging of execution `single-vnc-1750140103462` (Gmail Investor CRM workflow)._ 