# Ticket 1.8 - Authentication and SOP History

**Objective:** Enable Google sign-in via Supabase and provide a page listing a user’s previously generated SOPs.

**Depends On:** Ticket 1.7

**Key Tasks:**
1. Configure Supabase Auth in the Next.js project and add login/logout controls to the UI.
2. Secure all API routes with the authenticated user’s JWT.
3. Create a “My SOPs” page that queries `sops` table for entries owned by the current user (id and created_at).
4. Link each entry to the SOP viewer route for easy access or deletion.

**Acceptance Criteria:**
- Users can sign in with Google and see a list of their past SOPs.
- API endpoints reject requests without a valid JWT.
- The list page allows navigation back to each SOP viewer.
