# Unifying the AEF Execution Path  
### (`ExecutionEngine` ⇢ single-source-of-truth)

_Last updated: 17 Jun 2025_

---
## 1 · Current Split – What We Confirmed

| Concern | **ExecutionEngine** (`aef/execution_engine/engine.ts`) | **HybridBrowserManager** (`lib/browser/HybridBrowserManager.ts`) |
|---------|--------------------------------------------------------|----------------------------------------------------------------|
| **Primary use-case** | Run **entire** DAG via `/api/aef/execute` (and, indirectly, `/execute-nodes`) | Rapid **single-node** dog-fooding via `/api/aef/action/*` |
| **Browser session** | Relies on `HybridBrowserManager.createSession` *once*, then controls page via `BrowserManager` helpers inside node-actions | Creates/owns session and directly invokes `BrowserManager.executeAction` per call |
| **Memory capture** | Full Inputs · Processing · Outputs via `MemoryManager.captureNodeMemory` | Minimal stub (now partially upgraded) – previously blank Inputs/Processing |
| **LLM / AI nodes** | Designed for; hooks exist (`addLLMInteraction`) | Never touches LLM logic |
| **Loop / decision nodes** | Complete support | _N/A_ – only atomic Stagehand actions |
| **Error handling / retries** | Engine-level | Basic try/catch per action |
| **ID conventions** | Standard UUID execution IDs | Prefixed `single-vnc-*` IDs (require special-case logic in DB & UI) |

### Evidence
* Source scan of all AEF API routes (see memo2).  
* Logs from `enter_email` step show HybridBrowserManager path.  
* `executeNodeById` and `executeNodesConsecutively` already exist inside **ExecutionEngine** – unused by API today.

---
## 2 · Why This Hurts
1. Two memory formats → frontend displays only a subset.  
2. Fixes & telemetry must be patched twice.  
3. Special-case execution IDs break Supabase relationships.  
4. Complicates auth & permission checks.

---
## 3 · Consolidation Blueprint

### 3.1 API Layer
| New Endpoint | Behaviour |
|--------------|-----------|
| **POST /api/aef/execute** | Body: `{ workflowId, executionId?, nodeIds?[] }`  
• _If_ `nodeIds` empty → run full DAG.  
• _If_ array length = N → run only those nodes (serially, in given order). |
| **POST /api/aef/action** | Thin alias → forwards to `/execute` with single-element `nodeIds` array; returns same schema. |

Deprecate `/execute-nodes` once migrated.

### 3.2 ExecutionEngine Upgrades
1. **Public method** `start(executionId, nodeIds?)`  
  • Defaults to existing behaviour; if provided, uses `executeNodesConsecutively`.
2. **Session management**  
  • Accept an injected `BrowserSession` (created once by API).  
  • Remove session logic from HybridBrowserManager or keep as helper but _not_ a second persistence layer.
3. **Browser state capture**  
  • Reuse `BrowserStateCapture.get*` already called by Engine; delete duplicate in HybridBrowserManager.
4. **MemoryManager**  
  • Remains single authority; Hybrid path removed.

### 3.3 HybridBrowserManager Refactor
* Keep only **session orchestration** (Docker container lifecycle + VNC URL).  
* Remove `executeAction` + temp MemoryManager call.  
* Rename to `BrowserSessionManager` for clarity.

### 3.4 Frontend & DB Unification
* Stop relying on `single-vnc-*` naming – use real UUID every time.  
* MemoryPanel fetch logic becomes agnostic of execution origin.

---
## 4 · Migration Steps
1. **Feature flag** – behind `UNIFIED_ENGINE=true` env variable.  
2. Implement `nodeIds` param in `/api/aef/execute` (simple pass-through).  
3. Update **/api/aef/action** to call new endpoint; delete fallback.  
4. Remove stub memory persistence from HybridBrowserManager; adjust imports.  
5. Run integration tests:
   ```bash
   # full run
   curl -X POST /api/aef/execute -d '{"workflowId":"gmail-investor-crm-v2"}'
   # single node
   curl -X POST /api/aef/execute -d '{"workflowId":"gmail-investor-crm-v2","nodeIds":["enter_email"]}'
   ```
6. Verify `memory_artifacts` rows – both shapes identical.  
7. Remove `execute-nodes` route; clean up special-case ID code.  
8. Update docs & unit tests.

---
## 5 · Open Questions / Risks
* **Parallel nodes** – current Engine assumes sequential; single-node calls are fine, but executing _multiple non-contiguous_ nodes may need dependency hydration.
* **Credential scope** – HB injected creds inline; Engine has central `CredentialInjectionService`. Works, but needs test.
* **UI lag** – fetching full DOM snapshots per node for dog-fooding may add 200-300 KB each; consider partial snapshot for Inputs bucket.

---
## 6 · Can We Test Individual Nodes Today?
Yes – via hidden methods:
```ts
const engine = new ExecutionEngine(aefDoc, userId, execId);
await engine.executeNodeById('enter_email');
```
*Not wired to any endpoint yet.*  
Our consolidation will expose this publicly through `/api/aef/execute`.

---
## 7 · Summary
The split is historical. ExecutionEngine already has the building blocks to run 1…N nodes; HybridBrowserManager duplicates logic and produces impoverished memory. **One execution engine** with a flexible entry-point will:
* Eliminate divergent memory formats
* Simplify API surface
* Reduce maintenance & testing overhead
* Unblock richer frontend diagnostics for every run. 