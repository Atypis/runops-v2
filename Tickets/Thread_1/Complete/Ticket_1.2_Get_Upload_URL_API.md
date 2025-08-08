# Ticket 1.2 - Signed Upload URL API ✅

**Objective:** Provide an API endpoint that returns a Supabase signed URL for uploading the raw video file and a new `jobId` to track the process.

**Status:** Completed

**Depends On:** Ticket 1.1

**Key Tasks:**
1. ✅ Create `app/api/get-upload-url/route.ts` in Next.js API routes.
2. ✅ Generate a UUID `jobId` for each request.
3. ✅ Use Supabase server client to create a signed PUT URL for `videos/raw/<jobId>.mp4` valid for a short time.
4. ✅ Return `{ jobId, url }` in JSON format.
5. ✅ Handle and log errors, returning an HTTP 500 with a friendly message on failure.

**Acceptance Criteria:**
- ✅ Calling the endpoint returns a unique `jobId` and signed URL.
- ✅ The signed URL allows a direct PUT upload to Supabase Storage.
- ✅ Proper error handling with meaningful HTTP status codes.

**Implementation Notes:**
- Set up Supabase client configuration in `lib/supabase.ts` with both client and server-side functions
- Created storage bucket "videos" with secure access policies
- Implemented robust error handling in the API route with descriptive error messages
- Added security by making the storage bucket private with appropriate access controls
- Configured storage policies to allow uploads via signed URLs while restricting direct access
