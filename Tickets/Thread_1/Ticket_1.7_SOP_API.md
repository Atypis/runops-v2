# Ticket 1.7 - SOP Retrieval and Editing API

**Objective:** Expose REST endpoints to fetch a generated SOP and apply inline edits from the frontend.

**Depends On:** Ticket 1.6

**Key Tasks:**
1. Implement `GET /api/sop/[id]` that retrieves the SOP JSON from the `sops` table (requires Supabase Auth).
2. Implement `PATCH /api/sop/[id]` allowing updates to step titles or deletions according to ADR‑014.
3. Ensure both routes validate the authenticated user has access to the requested SOP.
4. Return updated JSON on successful edits and appropriate error codes on failure.

**Acceptance Criteria:**
- Authenticated requests can fetch SOP data for the owner.
- Inline edits from the viewer persist via the PATCH endpoint.
- Unauthorized or invalid requests receive proper error responses.
