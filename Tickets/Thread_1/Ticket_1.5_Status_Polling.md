# Ticket 1.5 - Status Polling and Spinner

**Objective:** Provide feedback to the user during background processing by polling job status and switching the UI when processing completes.

**Depends On:** Ticket 1.4

**Key Tasks:**
1. Implement `/api/status/[jobId]/route.ts` returning `{ status, error? }` from the `jobs` table.
2. After queuing, display a spinner on the landing page while repeatedly calling this endpoint every 3 s.
3. When `status === 'done'` redirect to the SOP viewer route for that `jobId`.
4. Handle error states gracefully (e.g., display a message if status becomes `error`).

**Acceptance Criteria:**
- The front end polls the job status at the correct interval.
- Users see a spinner labeled “AI magic…” until processing completes.
- On completion, the page navigates to the viewer automatically.
