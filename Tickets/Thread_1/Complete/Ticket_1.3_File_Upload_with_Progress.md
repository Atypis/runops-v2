# Ticket 1.3 - File Upload with Progress Feedback ✅

**Objective:** Upload the selected video directly to Supabase Storage using the signed URL, showing real-time progress in the UI.

**Status:** Completed

**Depends On:** Ticket 1.2

**Key Tasks:**
1. ✅ In the landing page component, trigger the upload after validation by requesting the signed URL from `/api/get-upload-url`.
2. ✅ Use `XMLHttpRequest` (or `fetch` with progress workaround) to PUT the file to the returned URL.
3. ✅ Update a progress bar using `xhr.upload.onprogress` events from 0–100 %.
4. ✅ Display upload success or failure states and allow retry on failure.
5. ✅ After success, POST `/api/queue-job` with the `jobId` to start processing.

**Acceptance Criteria:**
- ✅ Progress bar visibly updates during upload.
- ✅ Network errors show a clear retry message.
- ✅ Successful uploads trigger the job queue request automatically.

**Implementation Notes:**
- Used XMLHttpRequest for upload with progress tracking
- Implemented error handling for both upload and job queueing failures
- Created a jobs table in Supabase to track processing status
- Added a job-status API endpoint for polling the processing status
- Improved UX with clear visual feedback during the entire upload process
