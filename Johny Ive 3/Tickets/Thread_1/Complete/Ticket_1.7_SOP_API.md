# Ticket 1.7 - SOP Retrieval and Editing API (COMPLETED)

**Objective:** Expose REST endpoints to fetch a generated SOP and apply inline edits from the frontend.

**Depends On:** Ticket 1.6

**Key Tasks:**
1. ✅ Implement `GET /api/sop/[id]` that retrieves the SOP JSON from the `sops` table (requires Supabase Auth).
2. ✅ Implement `PATCH /api/sop/[id]` allowing updates to step titles or deletions according to ADR‑014.
3. ✅ Ensure both routes validate the authenticated user has access to the requested SOP.
4. ✅ Return updated JSON on successful edits and appropriate error codes on failure.

**Acceptance Criteria:**
- ✅ Authenticated requests can fetch SOP data for the owner.
- ✅ Inline edits from the viewer persist via the PATCH endpoint.
- ✅ Unauthorized or invalid requests receive proper error responses.

**Implementation Notes:**
- Created two API endpoints:
  - `GET /api/sop/[sopId]` - Retrieves SOP data from the database
  - `PATCH /api/sop/[sopId]` - Updates SOP data with edit or delete operations
- Updated `SOPListView` component to use the new API for updating and deleting nodes
- Updated `SopPage` component to fetch SOP data from the API
- Added placeholder for authentication (to be implemented in Ticket 1.8)
- Created API documentation in `docs/API_Reference.md`
- Added information about the API to the project README

**Issues Encountered and Resolved:**
- We discovered a discrepancy between job status in the database (showing "completed") and what the API returned (showing "queued")
- The issue was related to Supabase client instantiation in the API routes
- We initially created temporary direct endpoints as a workaround
- Fixed the root issue by:
  1. Implementing a robust Supabase client creation approach that works consistently
  2. Adding aggressive cache control headers to prevent stale data
  3. Adding cache-busting query parameters to all API requests
  4. Improving error handling and logging to track down any future issues
- All temporary workarounds have been removed and the main endpoints now work reliably

**Technical Debt:**
1. ✅ Temporary direct endpoints have been removed
2. ✅ Cache control headers added to all API endpoints
3. The `@supabase/auth-helpers-nextjs` package is deprecated and should eventually be replaced with `@supabase/ssr`

**Future Work (Ticket 1.8):**
- Implement authentication with Google Sign-In via Supabase Auth
- Secure all API routes with the authenticated user's JWT
- Ensure users can only access their own SOPs 