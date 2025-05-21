# runops MvP – End‑to‑End Flow & Architecture Decisions

This README is split into parts:

0. **Purpose** - What is this App and why are we Building it?
1. **Chronological Flow** – the user journey and system steps, each annotated with the relevant Architecture Decision Record (ADR).
2. **Detailed ADRs** – full text of every accepted decision so far (ADR‑001 → ADR‑014).
3. **MvP Building Process**

---

##0 Purpose 

The basic idea of Runops is to (a) capture workflow context effortlessly by just making a screenrecording + audio of your workflow; (b) Parsing that into an SOP and (c) using that SOP as the basis for automating the workflow fully or partially.

The MvP is divided into two stages: First, we are building the Capturing + SOP parsing layer. Second we are building the Agentic Execution layer. 


---

## 1  Chronological Flow (with ADR references)

| Step | Description                                                         | ADR ref.                 |
| ---- | ------------------------------------------------------------------- | ------------------------ |
| 1    | User records workflow with the built‑in OS screen recorder.         | **ADR‑001**              |
| 2    | Recording must be ≤ 10 min or ≤ 500 MB (guard‑rail).                | **ADR‑002**              |
| 3    | User visits **runops.app** (Next.js + Tailwind on Vercel).          | **ADR‑003**              |
| 4    | Landing page shows drag‑and‑drop zone plus file‑picker icon.        | **ADR‑004**              |
| 5    | File uploads via single POST; real‑time % bar shown.                | **ADR‑005**, **ADR‑006** |
| 6    | Server stores file in Supabase Storage and enqueues background job. | **ADR‑007**              |
| 7    | Worker down‑samples video to 1 fps / 720 p / CRF 32.                | **ADR‑010**              |
| 8    | Worker sends **one** request to Gemini 2.5 with strict JSON schema. | **ADR‑009**              |
| 9    | JSON validated; up to 3 retries on failure.                         | **ADR‑009**              |
| 10   | SOP JSON persisted in `sops` table; access via authed REST.         | **ADR‑011**              |
| 11   | Raw video auto‑deleted after 24 h (slim copy retained).             | **ADR‑010**              |
| 12   | Browser polls `/status/:jobId` every 3 s; "AI magic…" spinner.      | **ADR‑012**              |
| 13   | SOP rendered in ReactFlow diagram (dagre) with list toggle.         | **ADR‑013**              |
| 14   | User can rename/delete steps (PATCH sync) & copy Markdown export.   | **ADR‑014**              |

---

## 2  Architecture Decision Records for MVP v1

---

## ADR‑001 — Video Capture Method

* **Status:** Accepted (2025‑05‑12)  
* **Context:** We need a way for users to record workflows with the least friction. Options were native OS recorder vs. custom Chrome/desktop extension.  
* **Decision:** Use the **built‑in screen recorder shortcuts** (⌘‑Shift‑5 on macOS, Win + Alt + R on Windows).  
* **Consequences:**  
  * Zero install / fastest time‑to‑wow.  
  * No control over frame rate, so we'll down‑sample later with ffmpeg.  
  * Works for browser and desktop apps alike.

---

## ADR‑002 — Video Size & Duration Guard‑Rail

* **Status:** Accepted (2025‑05‑12)  
* **Context:** Large videos explode processing cost and latency.  
* **Decision:** **Hard‑cap recordings at 10 minutes or 500 MB**.  
* **Consequences:**  
  * Predictable spend (~€0.30 per clip after down‑sampling).  
  * Users over the limit must re‑record; clear error message required.

---

## ADR‑003 — Site & Hosting Stack

* **Status:** Accepted (2025‑05‑12)  
* **Context:** We need a landing page and simple API endpoints. Options: plain HTML, Next.js, or other frameworks.  
* **Decision:** **Next.js (TypeScript) + Tailwind + shadcn/ui on Vercel**.  
* **Consequences:**  
  * UI and API live in one repo; deploy = git push.  
  * Zero DevOps overhead.  
  * Slightly heavier bundle than pure HTML, but worth the leverage.

---

## ADR‑004 — Upload UI

* **Status:** Accepted (2025‑05‑12)  
* **Context:** Users must supply the video file.  
* **Decision:** Implement a **drag‑and‑drop drop‑zone plus a classic file‑picker icon** (accessibility).  
* **Consequences:**  
  * Modern, friendly UX; dependency on a small Dropzone library.  
  * Fallback file‑picker keeps keyboard‑only users covered.

---

## ADR‑005 — Upload Protocol

* **Status:** Accepted (2025‑05‑12)  
* **Context:** How the large file moves from browser to storage. Options: simple POST or resumable chunked upload.  
* **Decision:** Use a **single direct POST** to a Supabase‑signed URL (no chunking for MVP).  
* **Consequences:**  
  * Simplest possible code path.  
  * If connection drops, user must retry; acceptable for early demo.

---

## ADR‑006 — Progress Feedback

* **Status:** Accepted (2025‑05‑12)  
* **Context:** Users need feedback during upload and processing.  
* **Decision:** Show **two phases**  
  1. **Upload progress bar** with real % (using upload progress events).  
  2. **"AI magic…" spinner** while processing, updated by polling `/status/:jobId` every 3 s.  
* **Consequences:**  
  * Honest, concrete feedback when we can measure it; simple spinner when we can't.  
  * Polling can be swapped for WebSockets later without UI rewrite.

---

## ADR‑007 — Worker & Queue Model

* **Status:** Accepted (2025‑05‑12)  
* **Context:** Heavy processing (ffmpeg + Gemini) must not block the web request.  
* **Decision:** Store uploaded file, then **enqueue a background job** on a lightweight managed queue (e.g. Supabase jobs table + polling worker, or Cloud Tasks + Redis‑RQ worker).  
* **Consequences:**  
  * Fast HTTP response; web tier stays snappy.  
  * One small always‑on worker container (Railway/Fly.io) to manage.

---

## ADR‑008 — Object Storage Choice

* **Status:** Accepted (2025‑05‑12)  
* **Context:** Need a bucket to hold raw and slimmed videos plus SOP JSON. Options: Supabase Storage, AWS S3, GCS.  
* **Decision:** Use **Supabase Storage** (public bucket `videos/`).  
* **Consequences:**  
  * No new cloud accounts; we reuse existing Supabase keys.  
  * Paths convention: `videos/raw/<jobId>.mp4`, `videos/slim/<jobId>.mp4`, `videos/sops/<jobId>.json`.  
  * Set lifecycle rule to auto‑delete `raw/*` after 24 h to control cost & privacy.
  * Automatic cleanup implemented via Supabase Edge Function (see [Cleanup Strategy](app_frontend/docs/CleanupStrategy.md) for details).

---

---

## ADR‑009 — Single Gemini Call with Strict JSON Schema

* **Status:** Accepted (2025‑05‑12)
* **Context:** We need to transform a video into an SOP. Multiple chained calls add cost and latency.
* **Decision:** The worker sends **one** request to Gemini 2.5 Vision, embedding a strict JSON schema (`steps:[{id,title,description,timestamp}]`) in the system prompt.
* **Consequences:**

  * Simplest possible pipeline (one network hop).
  * Retry logic is straightforward (resend same prompt).
  * If the schema changes, we only touch one prompt.

---

## ADR‑010 — No Token Guard; ffmpeg Down‑Sampling for Bandwidth

* **Status:** Accepted (2025‑05‑12)
* **Context:** Gemini counts tokens by **duration**, not resolution or bitrate. Down‑sampling is only useful to shrink upload time and storage.
* **Decision:**

  * Impose a **10‑minute duration cap** (≈ €0.70 worst‑case).
  * Still run ffmpeg with `fps=1, scale=-2:720, crf=32` to cut a 250 MB capture to ~15 MB for faster uploads.
* **Consequences:**

  * Model cost is predictable and acceptable for demos.
  * Users wait less during upload; storage costs remain low.

---

## ADR‑011 — SOP Storage in Supabase Table with Authenticated REST Access

* **Status:** Accepted (2025‑05‑12)
* **Context:** SOP JSON is tiny (<50 KB) and should be queryable with user auth.
* **Decision:**

  * Create table `sops(id uuid, user_id uuid, json jsonb, created_at timestamptz)`.
  * Expose `/api/sop/:id` route protected by Supabase Google Sign‑In.
* **Consequences:**

  * One authoritative source of truth.
  * Future joins with user table are trivial.
  * Raw video lives in Storage; SOP lives in Postgres.

---

## ADR‑012 — Front‑End Polling Every 3 s for Job Status

* **Status:** Accepted (2025‑05‑12)
* **Context:** We need to tell the user when processing is done without extra infra.
* **Decision:** Browser polls `/api/status/:jobId` every **3 s** until 200 OK (`status=done`).
* **Consequences:**

  * Zero WebSocket/realtime configuration.
  * Slightly wasteful but negligible for MVP; can swap for Supabase realtime later.

---

## ADR‑013 — ReactFlow (+ dagre) Diagram as Primary Viewer, List Toggle Secondary

* **Status:** Accepted (2025‑05‑12)
* **Context:** Users need a visually impressive, editable SOP. Alternatives were Mermaid, GoJS, tldraw, timeline lists.
* **Decision:** Use **ReactFlow** with `dagre` auto‑layout as the main canvas, plus a collapsible ordered list view.
* **Consequences:**

  * Delivers instant "wow" factor; supports pan/zoom, future drag‑reorder.
  * Extra 48 kB bundle is acceptable.
  * List view enables copy‑paste to docs.

---

## ADR‑014 — Inline Rename/Delete Edits Synced via PATCH; Markdown Export

* **Status:** Accepted (2025‑05‑12)
* **Context:** Users should refine step titles quickly and export results.
* **Decision:**

  * Allow **rename** and **delete** of steps inline; send a `PATCH /api/sop/:id` per change.
  * Provide a **"Copy as Markdown"** button that converts the SOP list to clipboard.
* **Consequences:**

  * Keeps backend authoritative without heavy state management.
  * Enough editing power for demo; reordering can come later.
  * Markdown covers 80 % of export needs; Notion integration deferred.

---

## 3 MvP Building Process

I actually want to start with building out the end of the chain. So SOP Parsing Prompt -> ReactFlow Diagram. I have Gemini Account where I can access the new model for free, I will upload the video + SOP Parsing prompt and then we will start with the ReactFlow Frontend Viusalisation. > Once these two things look good (highest technical risk) we build the easy rest. 

---

*End of README*
