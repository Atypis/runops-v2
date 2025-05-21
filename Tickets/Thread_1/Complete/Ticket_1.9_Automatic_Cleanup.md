# Ticket 1.9 - Automatic Cleanup of Raw Videos ✅

**Objective:** Ensure raw uploads are deleted after 24 hours and other artifacts are pruned to control storage costs.

**Status:** Completed

**Depends On:** Ticket 1.6 (worker processes uploads)

**Key Tasks:**
1. ✅ Configure Supabase Storage lifecycle rules to auto-delete files under `videos/raw/` after 24 hours.
2. ✅ Implement a scheduled script (Supabase Edge Function) to remove stale raw videos.
3. ✅ Document the cleanup strategy in the repository for clarity.

**Acceptance Criteria:**
- ✅ Raw uploads older than 24 hours are automatically removed.
- ✅ Cleanup tasks run on a schedule without manual intervention.

**Implementation Notes:**
- Created two Supabase Edge Functions:
  - `cleanup-raw-videos`: Scans the `videos/raw/` folder and deletes files older than 24 hours
  - `scheduled-cleanup`: Scheduler function that can be triggered by external services
- Set up GitHub Actions workflow to trigger the cleanup daily at midnight
- Added comprehensive documentation in `app_frontend/docs/CleanupStrategy.md`
- Updated README to reference the automatic cleanup strategy
- Implemented proper error handling and logging in the cleanup functions
- Added flexibility to manually trigger cleanup when needed
