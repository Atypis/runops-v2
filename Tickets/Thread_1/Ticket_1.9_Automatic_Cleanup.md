# Ticket 1.9 - Automatic Cleanup of Raw Videos

**Objective:** Ensure raw uploads are deleted after 24 hours and other artifacts are pruned to control storage costs.

**Depends On:** Ticket 1.6 (worker processes uploads)

**Key Tasks:**
1. Configure Supabase Storage lifecycle rules to auto-delete files under `videos/raw/` after 24 hours.
2. Optionally implement a scheduled script (or Supabase Edge Function) to remove stale jobs or slim videos if needed.
3. Document the cleanup strategy in the repository README for clarity.

**Acceptance Criteria:**
- Raw uploads older than 24 hours are automatically removed.
- Any additional cleanup tasks run on a schedule without manual intervention.
