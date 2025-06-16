# Single Source of Truth for VNC Execution IDs

## Problem Statement
When running **single-VNC executions** we end up with *two different* execution IDs for the *same* browser session:

| Stage | Who generates the ID | Example |
|-------|---------------------|---------|
| UI (before talking to server) | `'single-vnc-' + Date.now()` | `single-vnc-1750105116213` |
| Server (inside `SingleVNCSessionManager`) | Timestamp of Docker container creation | `single-vnc-1750105116089` |

Because the UI continues to use its own ID (`6213`) while the server persists all memory artifacts under its ID (`6089`), API calls like

```
GET /api/aef/memory/single-vnc-6213/navigate_to_gmail  → 404
```
loop forever even though the memory row actually exists in the database (but under `6089`).

## Root-Cause Summary
1. **Duplicate ID generation** – both client *and* server invent IDs independently.
2. API endpoints and HybridBrowserManager rely on the ID embedded in the VNC session object (server-side one), while the React hooks rely on the ID they originally created (client-side one).

## Decision → One Authoritative ID (server-generated)
The simplest, safest fix is to let the **server** create the execution ID exactly once and have the **client store & reuse** that value for all subsequent calls.

Advantages:
* Only one place in code can generate the ID → impossible to diverge.
* Minimal changes (mostly client-side): remove `single-vnc-${Date.now()}` snippets.
* No risk of forgetting to pass the ID to a new endpoint.

## Implementation Plan (Option A)
1. **/api/vnc/start** (or equivalent) already returns JSON.  Ensure the payload is:
   ```json
   { "executionId": "single-vnc-<timestamp>", "vncUrl": "http://…" }
   ```
   (Use the ID stored in `SingleVNCSessionManager.currentSession.id`.)

2. **Front-end changes**
   * After the start-session request, save `executionId` to React context / Redux / local state (e.g. `setCurrentExecutionId`).
   * Replace every `single-vnc-${Date.now()}` or similar hard-coded construction with the stored `currentExecutionId`.
   * Ensure all subsequent API calls (`/api/aef/action`, memory polling, stop session, etc.) read from that single state value.

3. **Server clean-up**
   * Remove the code in `SingleVNCSessionManager.atomicSessionCreation()` that overwrites the ID based on container timestamp when an ID already exists.
   * Keep using `currentSession.id` everywhere (it is now the same value the UI knows).

4. **Validation checklist**
   * Start a new single-VNC session → confirm the same ID appears in: UI state, server logs, `memory_artifacts.execution_id`.
   * Memory panel loads on first poll (no 404).  HybridBrowserManager log shows "✅ Memory artifact persisted" with EXACT SAME executionId the UI displays.

---
*Last updated: 2025-06-16* 