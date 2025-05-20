# Ticket 1.1 - Landing Page & Upload UI

**Objective:** Implement the initial landing page with drag-and-drop upload zone and client-side validation of video size and duration.

**Depends On:** None

**Key Tasks:**
1. Create `app/page.tsx` in `app_frontend` with a large drop zone styled using Tailwind.
2. Provide a fallback "Choose file" button for accessibility.
3. On file selection, check `file.size` (< 500 MB) and use a hidden `<video>` element to verify duration (< 10 min). Display friendly warnings on failure.
4. Display basic file info (name and size) once a valid video is selected.

**Acceptance Criteria:**
- Users can drag a video or use the file picker.
- Files over the limits show an error message and are rejected.
- Valid files display their name and size, ready for upload.
