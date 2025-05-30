# Ticket 1.1 - Landing Page & Upload UI ✅

**Objective:** Implement the initial landing page with drag-and-drop upload zone and client-side validation of video size and duration.

**Status:** Completed

**Depends On:** None

**Key Tasks:**
1. ✅ Create `app/page.tsx` in `app_frontend` with a large drop zone styled using Tailwind.
2. ✅ Provide a fallback "Choose file" button for accessibility.
3. ✅ On file selection, check `file.size` (< 750 MB) and use a hidden `<video>` element to verify duration (< 20 min). Display friendly warnings on failure.
4. ✅ Display basic file info (name and size) once a valid video is selected.

**Acceptance Criteria:**
- ✅ Users can drag a video or use the file picker.
- ✅ Files over the limits show an error message and are rejected.
- ✅ Valid files display their name and size, ready for upload.

**Implementation Notes:**
- Added Johnny Ive inspired design with clean aesthetics and purposeful interactions
- Implemented multi-state interface: empty state → file selected → processing
- Added progress indicator and processing states for better user feedback
- Included "Create SOP" button that appears only after valid file selection
- Tested validation for both file size (>750MB) and duration (>20min) constraints 