# Ticket 1.6 - Background Worker for Video Processing

**Objective:** Implement a worker process that down-samples uploaded videos, extracts SOP steps via Gemini, and updates job records accordingly.

**Depends On:** Ticket 1.4 (job queue in place)

**Key Tasks:**
1. Create a standalone Node or Bun script (`worker.ts`) that periodically checks the `jobs` table for entries with status `queued`.
2. For each job:
   - Download `videos/raw/<jobId>.mp4` from Supabase Storage.
   - Run `ffmpeg` with `fps=1, scale=-2:720, crf=32` to produce a slim copy.
   - Upload the slim copy to `videos/slim/<jobId>.mp4`.
   - Send a single request to Gemini 2.5 with the strict JSON schema to extract steps, retrying up to three times on invalid JSON.
   - Save the resulting JSON to the `sops` table and update the job status to `done` or `error`.
3. Provide basic logging and error handling for each stage.

**Acceptance Criteria:**
- Worker picks up queued jobs and processes them sequentially.
- Slim video and SOP JSON are saved in Supabase.
- Job status updates accurately reflect success or failure.
