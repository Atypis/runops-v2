# Ticket 1.6 - Background Worker for Video Processing > Need one complete run that works and check tradeoffs java script worker vs. typescript and cleanup

**Objective:** Implement a worker process that down-samples uploaded videos, extracts SOP steps via Gemini, and updates job records accordingly.

**Depends On:** Ticket 1.4 (job queue in place)

**Key Tasks:**
1. ✅ Create a standalone Node or Bun script (`worker.js`) that periodically checks the `jobs` table for entries with status `queued`.
2. ✅ For each job:
   - ✅ Download `videos/raw/<jobId>.mp4` from Supabase Storage.
   - ✅ Run `ffmpeg` with `fps=1, scale=-2:720, crf=32` to produce a slim copy.
   - ✅ Upload the slim copy to `videos/slim/<jobId>.mp4`.
   - ✅ Send a single request to Gemini 2.5 Flash Preview with the strict JSON schema to extract steps, retrying up to three times on invalid JSON.
   - ✅ Save the resulting JSON to the `sops` table and update the job status to `done` or `error`.
3. ✅ Provide basic logging and error handling for each stage.

**Acceptance Criteria:**
- ✅ Worker picks up queued jobs and processes them sequentially.
- ✅ Slim video and SOP JSON are saved in Supabase.
- ✅ Job status updates accurately reflect success or failure.

**Implementation Notes:**
- Created a standalone Node.js worker script that polls for jobs every 10 seconds
- Used fluent-ffmpeg with the exact specified parameters
- Implemented Gemini API integration using the 2.5 Flash Preview model
- Added robust error handling with detailed logging
- Documented the setup and usage in WorkerInstructions.md

**How to Run:**
```bash
cd app_frontend
npm run worker
```
