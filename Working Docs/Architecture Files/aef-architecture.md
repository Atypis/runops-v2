# Agentic Execution Framework (AEF) – Architecture Overview

**Version:** 4.1  (last updated: June 2025)

> This document is the authoritative reference for the **Agentic Execution Framework (AEF)** as it exists **today**. It supersedes all previous docs, including `AEF-Doc.md`.

---

## 1. What AEF Is

AEF is a **JSON-driven browser-automation platform** that converts declarative workflow files into deterministic executions inside an isolated, single-session VNC container.  It is designed for agentic (LLM-assisted) automation where:  
• **Workflows live in JSON** – no code edits required to add/alter flows.  
• **Hybrid execution** – deterministic selector actions first, AI fallback when selectors break.  
• **Credential injection** – secrets are never hard-coded; placeholders are resolved server-side just-in-time.  
• **End-to-end observability** – every prompt, DOM snapshot, screenshot and error is streamed live.

Typical use-case: ingest an email in Gmail ➜ extract investor info ➜ write to Airtable CRM – all orchestrated by an AEF JSON file.

---

## 2. High-Level Architecture

```mermaid
flowchart TD
    subgraph Frontend (Next.js)
        A[AEFControlCenter] -- loads JSON --> B[WorkflowLoader.ts]
        A --> C[BrowserPanel (VNC)]
        A --> D[ExecutionLog Viewer]
    end

    subgraph API Layer (Next.js routes)
        E[/api/aef/workflow/:id] -- returns JSON --> A
        F[/api/aef/execute & /execute-nodes] -- starts run --> G
        G[ExecutionEngine] -- action ➡ --> H[HybridBrowserManager]
        G -- logs ➡ --> I[NodeLogs Map]
        I -- stream --> D
    end

    subgraph Runtime
        H --> J[Single VNC Container]
        J -->|TigerVNC 15900| C
    end
```

Key points:
1. **Single canonical pipeline** – both single-node and multi-node runs end up in `ExecutionEngine.executeNodesConsecutively()`.
2. **Server-side only execution** – the browser, credential reads and LLM calls never touch the client; the frontend is read-only.
3. **Stable ports** – 13000 (API), 15900 (VNC raw), 16080 (noVNC web-client).  No discovery dance.

---

## 3. Repository Layout (selected)

```
app_frontend/
  aef/
    workflows/               # ➊ ✅ JSON files & schema
      gmail-investor-crm.json
      schemas/workflow-schema.json
    execution_engine/engine.ts   # ➋ core runner
  lib/
    workflow/ServerWorkflowLoader.ts  # JSON ↔ TS loader + AJV validation
    browser/HybridBrowserManager.ts  # Browser + memory hooks
    credentials/                    # Supabase-backed secret store
    logging/NodeLogger.ts           # Node-level structured logs
    memory/                         # Universal memory system
    vnc/SingleVNCSessionManager.ts  # 1-container orchestration
app/
  api/aef/                          # Next.js API routes
```

---

## 4. JSON Workflow Primer

Only three top-level blocks matter:
```typescript
interface AEFWorkflow {
  meta: {...}            // id, title, version, tags
  execution: {
    environment?: { required_tabs?: [...]}  // optional pre-open tabs
    workflow: { nodes: WorkflowNode[]; flow: Edge[] }
  };
  config?: { executionTimeout?: number; retryAttempts?: number; hybridMode?: boolean }
}
```
### 4.1 Node anatomy (excerpt)
```typescript
interface WorkflowNode {
  id: string;
  type: 'atomic_task' | 'compound_task' | 'iterative_loop' | ...;
  label: string;
  intent: string;
  credentialsRequired?: Record<string,string[]>; // e.g. { gmail: ['email','password'] }
  actions: WorkflowAction[];
}
```
### 4.2 Action types
`navigate` • `click` • `type` • `wait(_for_navigation)` • `act` (AI) • `extract` • `visual_scan` • `conditional_auth` • `paginate_extract` …

Placeholders like `{{gmail_password}}` are resolved by `ExecutionEngine.injectCredentialsIntoAction()` **immediately before dispatch**.

Schema validation: `workflow-schema.json` (JSON-Schema draft-07, enforced by AJV in `ServerWorkflowLoader`).

---

## 5. Execution Pipeline (request → pixels)

1. **POST `/api/aef/execute`** (or `execute-nodes`) with `workflowId` + optional `nodeIds`.
2. **Workflow load & validate** – `ServerWorkflowLoader.loadWorkflow()` (disk → memory → AJV).
3. **ExecutionEngine** instantiated with (workflow, userId, executionId).  Responsibilities:
   • variable resolution & scoping  
   • credential validation & injection  
   • hybrid action dispatch  
   • node‐level logging  
   • memory capture hooks
4. **HybridBrowserManager** maps actions to a _single_ Playwright-driven Chromium instance running inside **one Docker container** with TigerVNC.
5. **Logs & artefacts** (prompt, AX tree, screenshots…) are pushed to `NodeLogs` and streamed via `/api/aef/logs/:executionId/:nodeId`.
6. **Frontend** consumes Server-Sent Events (SSE) and renders live timeline; the user can safely refresh without breaking the run.

---

## 6. Credential Pipeline

• Secrets stored encrypted in Supabase.  
• `ExecutionEngine.validateCredentials()` pre-flights that every `credentialsRequired` entry exists.  
• Each action's placeholders are replaced **in-memory**; secrets are wiped right after dispatch.  
• No credentials are ever sent to the browser UI or persisted in logs.

---

## 7. Observability & Memory

| Artefact | Source | Retrieval |
|----------|--------|-----------|
| Prompt / LLM response | `StagehandMemoryHooks` | `/api/aef/logs/*` |
| Accessibility tree | Playwright CDP (copied from Stagehand 2.3) | Node log |
| DOM snapshot / URL | `BrowserStateCapture` | Node log |
| Screenshots | Playwright | `/public/screenshots/:id.png` |

Memory can be replayed offline by querying `HybridBrowserManager.getExecutionTrace()`.

---

## 8. Public API Surface (v4.1)

| Method | Route | Notes |
|--------|-------|-------|
| `POST` | `/api/aef/execute` | Run entire workflow |
| `POST` | `/api/aef/execute-nodes` | Canonical *single & multi-node* run |
| `POST` | `/api/aef/action/:nodeId` | Legacy proxy (will disappear in v4.2) |
| `GET`  | `/api/aef/workflow/:id` | Fetch workflow JSON |
| `GET`  | `/api/aef/logs/:executionId/:nodeId` | Stream structured logs |
| `GET`  | `/api/vnc/status` | Readiness & URL for noVNC client |

---

## 9. Configuration & Environment

```bash
# --- Core ---
WORKFLOW_CACHE_ENABLED=true         # Server-side cache
WORKFLOW_SCHEMA_PATH=aef/workflows/schemas/workflow-schema.json
WORKFLOW_VALIDATION_STRICT=true

# --- VNC Container ---
VNC_RESOLUTION=1280x720
VNC_COL_DEPTH=24
API_PORT=13000
VNC_PORT=15900
NOVNC_PORT=16080
```

---

## 10. Development Quick-Start

```bash
# 1. Boot dev servers (Next.js + Docker browser)
$ pnpm --filter app_frontend dev          # UI & API
$ pnpm --filter app_frontend run docker   # launches single VNC container

# 2. Hit the app
http://localhost:3000 (UI)  –  http://localhost:16080/vnc.html (raw VNC)

# 3. Run a workflow end-to-end
curl -X POST http://localhost:3000/api/aef/execute \
     -H 'Content-Type: application/json' \
     -d '{"aefDocumentId":"gmail-investor-crm"}'
```

---

## 11. Extending AEF

1. **Create a new workflow** – duplicate `templates/basic-template.json`, edit, save under `aef/workflows/`.  The dev server auto-reloads.
2. **Add a new Action type** – implement handler in `ExecutionEngine.executeAction()` and update `workflow-schema.json` enum.
3. **UI components** – React code lives under `components/aef/`; use shadcn-ui design system.
4. **Memory processors** – hook into `StagehandMemoryHooks`.

---

## 12. Security Considerations

• Workflows are schema-validated to prevent arbitrary code execution.  
• Browser container is isolated and time-boxed; no host network access.  
• Credentials never leave the server context and are wiped from memory post-use.

---

## 13. Release & Deprecation Policy

| Version | Impact |
|---------|--------|
| **4.1** | current; unified `/execute-nodes`; memory refactor |
| **4.2** | `/api/aef/action/:id` emits deprecation warning |
| **4.3** | legacy route removed; only `/execute-nodes` remains |

---

**AEF is now fully JSON-driven, AI-ready and production-hardened.**  Contributions are welcome — start by adding a new workflow file and watching it run live!  🚀 