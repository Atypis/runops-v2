### Runops Demo – Refactor/Integration Plan

This document captures the current state after the AEF removal and Operator integration, plus the exact next steps to complete the Director-in-Next.js setup.

### Current state (what’s done)
- **Repo shape** (single Next.js app): `app/`, `components/`, `lib/`, `public/`, `hooks/`, `supabase/`, `docs/` (prompts moved to `docs/prompts/`).
- **AEF removed**: Old AEF engine/routes/components trimmed from this app.
- **Operator backend integrated** under `lib/director/`:
  - `lib/director/services/*`: `directorService.js`, `nodeExecutor.js`, `planService.js`, `workflowDescriptionService.js`, `variableManagementService.js`, `tokenCounterService.js`, `browserStateService.js`, `conversationService.js`, `domToolkitService.js`, `scoutService.js`, `tabInspectionService.js`, `schemaValidator.js`, `workflowService.js`.
  - `lib/director/tools/*`: `toolDefinitions*.js`, `domExplorationTools*.js`.
  - `lib/director/prompts/*`: `directorPromptV*`, `cleanDirectorPrompt.js`, prompt docs.
  - `lib/director/config/supabase.js`, `actionable-weights.json`.
  - `lib/director/dom-toolkit/*` (ported DOM toolkit used by services).
  - `lib/vendor/stagehand-pov/*` vendored (formatting helpers referenced by services).
- **APIs added**:
  - `POST /api/director/process`: proxies to `DirectorService.processMessage(...)`.
  - `GET /api/director/tool-stream`: SSE for Director tool-call events.
  - Director instance lifecycle managed via `lib/director/instance.ts`.
- **Minimal UI**: `app/director/[workflowId]/page.tsx` – left-side chat (calls `/api/director/process`, subscribes to SSE); right side placeholder.
- **Tooling cleanup**: Docker + VNC scripts removed from scripts; Jest removed; AEF migrations removed; prompts moved to `docs/prompts/`.
- **Stagehand**: bump to `^2.4.1`; avoided deep `StagehandAgent` import (replaced with `page.act(...)`).
- **Build**: Production build is green.

### Required environment variables
- In `.env.local` (or `.env` in deployment):
  - `OPENAI_API_KEY=`
  - `NEXT_PUBLIC_SUPABASE_URL=`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
  - If using Browserbase later: `BROWSERBASE_API_KEY=` (and any required Stagehand remote config).

### Outstanding integration tasks (prioritized)
1) Frontend (port the working Operator UI)
   - Copy the old Director UI (chat + nodes split view) into `components/director/`.
   - Replace its backend URLs with Next.js routes:
     - Chat → `POST /api/director/process`
     - Tool-call stream → `GET /api/director/tool-stream?workflowId=...`
     - Load workflow JSON → `GET /api/workflows/[id]` (already supported by `ServerWorkflowLoader`).
     - Execute nodes → `POST /api/nodes/execute` (to be added; see 2).
     - Session control → `POST /api/execution/start|stop` (to be added; see 2).

2) API routes needed for execution lifecycle
   - `POST /api/execution/start`: Create a Stagehand session for `workflowId` using `lib/browser/BrowserManager`.
   - `POST /api/execution/stop`: Destroy session, tidy resources.
   - `POST /api/nodes/execute`: Run selected nodes via `NodeExecutor`, integrate `lib/credentials/injection.ts` for required credentials.
   - Optional: `POST /api/director/cancel`: Cancel in-flight `DirectorService` execution.

3) Browserbase migration (optional now, recommended later)
   - Add flag `BROWSERBASE_ENABLED` and Stagehand remote config for `BrowserSession`.
   - When enabled, run Stagehand remotely instead of `LOCAL`.
   - Remove VNC fallbacks (`lib/vnc/*`, `/api/vnc/*`) once fully on Browserbase.

4) Persistence (move in-memory to Supabase where desired)
   - `conversationService`, `planService`, `variableManagementService`, `browserStateService`, `tokenCounterService` currently can run without DB; migrate to Supabase tables if you want durability across sessions.
   - Add migrations for any new tables (conversations, plans, variables, browser_state, token_usage).

5) Credentials UX
   - Ensure the credentials panel/flows are accessible before execution for Gmail/Airtable workflows.
   - `lib/credentials/*` already has storage and injection; hook UI affordances in the Director screen.

6) Security/Auth
   - `middleware.ts` protects `/my-sops`, `/sop/*`, and `/api/*` with a public allowlist for a few endpoints. Verify the list is correct for your desired public routes.
   - Rate-limit chat/process endpoints in production if needed.

7) Observability
   - Log Director events to the SSE stream (already wired via `tool-stream`).
   - Keep `BrowserManager` WebSocket plumbing for future real-time browser updates if needed.

8) Cleanup (once Browserbase-only)
   - Remove `/api/vnc/*`, `lib/vnc/*`, and any SingleVNC fallbacks in `lib/browser/BrowserManager.ts`.
   - Consider removing `vendor/stagehand-pov` once equivalent upstream helpers are available.

### Notable refactors to be aware of
- `nodeExecutor.executeAgent(...)` no longer imports the internal `StagehandAgent`. It now emulates “ensure” using `page.act(...)`. If you rely on Agent-only capabilities, we can reintroduce via a stable public API or light wrapper.
- The Director service and NodeExecutor are now loaded under Next.js server runtime. Avoid any browser-only APIs inside those files.

### How to run
- Dev: `npm run dev` (visit `/director/<workflowId>`)
- Build: `npm run build`
- Start: `npm start`

### Quick checklist
- **UI**: Port old Director UI → `components/director/*` and wire to new endpoints.
- **APIs**: Add `/api/nodes/execute`, `/api/execution/start|stop`.
- **Credentials**: Verify Supabase tables + UI paths.
- **Env**: Fill `OPENAI_API_KEY`, Supabase keys; later add Browserbase keys.
- **Auth**: Confirm `middleware.ts` protect-list.
- **Cleanup**: Remove VNC-only code when moving fully to Browserbase.

This file is the source of truth for remaining work. Update it as you complete tasks or make design decisions.


