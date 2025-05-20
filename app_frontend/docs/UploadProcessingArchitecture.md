# Upload & Processing Architecture

This document outlines the architecture of the video upload and processing system in Runops. It explains the complete flow from client-side upload to backend processing and storage.

## Overview

The upload and processing system follows a multi-stage architecture:

1. **Client Validation** - Browser-side checks for file type, size, and duration
2. **Signed URL Generation** - Secure, temporary URLs for direct-to-storage uploads
3. **Progress-Tracked Upload** - Real-time feedback during file transfer
4. **Job Queueing** - Tracking system for background processing
5. **Status Polling** - Client-side monitoring of processing status

This approach separates immediate user interactions from longer-running background tasks, providing a responsive experience even for large files and complex processing.

## Core Components

### Client-Side Components

- **`app/page.tsx`**  
  The landing page with drag-and-drop upload zone that:
  - Validates videos (size < 750MB, duration < 20min)
  - Requests signed upload URLs from the API
  - Uploads directly to Supabase Storage with progress tracking
  - Queues processing jobs after successful upload
  - Provides real-time feedback via progress bar and status indicators

- **`app/sop/[sopId]/page.tsx`**  
  The SOP viewer page that:
  - Polls the job status endpoint every 3 seconds
  - Shows an "AI magic in progress..." spinner during processing
  - Displays a ReactFlow diagram or list view when processing completes
  - Handles error states with appropriate user feedback
  - Provides toggle between list view and flow view

### API Endpoints

- **`app/api/get-upload-url/route.ts`**  
  Generates signed upload URLs:
  - Creates a unique `jobId` (UUID) for each upload
  - Uses Supabase service role to generate a signed URL for `videos/raw/<jobId>.mp4`
  - Returns `{ jobId, url }` to the client
  - Implements error handling with meaningful HTTP status codes

- **`app/api/queue-job/route.ts`**  
  Initiates video processing:
  - Verifies the uploaded file exists in storage
  - Creates a job record in the database with "queued" status
  - Returns job status confirmation to the client
  - Handles errors with appropriate HTTP status codes

- **`app/api/job-status/[jobId]/route.ts`**  
  Provides processing status information:
  - Queries the jobs table for current status
  - Returns detailed job information (status, timestamps, errors)
  - Fallback file existence check if job record isn't found
  - Standardized error responses

### Database Schema

- **`jobs` Table**  
  Persistent storage for job tracking:
  ```sql
  CREATE TABLE public.jobs (
    id SERIAL PRIMARY KEY,
    job_id UUID NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error TEXT,
    metadata JSONB
  );
  ```

  Key fields:
  - `job_id`: UUID matching the uploaded file name
  - `status`: Current processing state (queued, processing, completed, error)
  - Timestamps for creation, updates, and completion
  - Error message storage for failed processing

### Storage Configuration

- **Supabase Storage Bucket: `videos`**  
  Organized storage for video assets:
  - `/raw` - Original uploaded videos
  - `/slim` - Processed videos (planned)
  - `/sops` - Generated SOP JSON files (planned)

- **Security Policies**
  - Upload allowed via signed URLs (no auth required)
  - Read access restricted to authenticated users
  - Service role has full access for background processing

## Implementation Details

### Upload Process

1. **Client-Side Validation**
   - Browser checks file type, size, and uses HTML5 video element to verify duration
   - Clear error messages for invalid files

2. **Signed URL Request**
   - Client calls `/api/get-upload-url` to get a temporary upload URL
   - Server generates a UUID and creates a signed URL valid for 10 minutes

3. **Direct Upload with Progress**
   - XMLHttpRequest used for upload with progress tracking
   - `xhr.upload.onprogress` events update UI progress bar
   - Standard HTTP status codes for error handling

4. **Post-Upload Processing**
   - After successful upload, client calls `/api/queue-job` with the jobId
   - Server verifies file exists and creates database record
   - Client redirects to SOP view which will show processing status

### Job Processing Flow

1. **Job Creation**
   - Jobs start in "queued" status
   - Background worker polls for new jobs (future implementation)

2. **Status Updates**
   - SOP view polls `/api/job-status/[jobId]` every 3 seconds
   - Processing states handled: queued, processing, completed, error
   - Different UI displayed based on job status

3. **Completion**
   - When processing completes, SOP view displays the diagram
   - Users can toggle between list and flow visualizations

## Current Implementation Status

### Completed Components

- ✅ Video upload with validation and progress tracking
- ✅ Signed URL generation for secure direct-to-storage uploads
- ✅ Job queue system with database tracking
- ✅ Status polling API endpoint
- ✅ SOP viewer with status polling and UI states

### Pending Components

- ⏳ Background worker (Ticket 1.6)
  - This component will process queued jobs
  - Until implemented, uploaded videos will remain in "queued" status
  - The SOP view will show the "AI magic in progress..." spinner indefinitely
  
- ⏳ Video processing with ffmpeg
  - Down-sample videos as specified in architecture
  
- ⏳ Gemini API integration
  - Process videos to extract SOP steps

## Security Considerations

1. **Private Storage Bucket**
   - Videos are stored in a private bucket, not publicly accessible
   - Access requires either a signed URL or authenticated request

2. **Server-Side Validation**
   - All uploads and requests are validated on the server
   - File existence checks before processing

3. **Service Role Separation**
   - Public API uses limited permissions
   - Background processing uses service role with elevated permissions

4. **Temporary Signed URLs**
   - Upload URLs expire after a short period
   - Each URL is specific to a single file path

## Future Enhancements

1. **Resumable Uploads**
   - Add chunked upload support for very large files
   - Enable resuming interrupted uploads

2. **Worker Infrastructure**
   - Implement background worker for video processing
   - Add job priority queue and parallel processing

3. **Enhanced Monitoring**
   - Add detailed processing stages within each job
   - Implement webhook notifications for job completion

4. **User Authentication**
   - Associate uploads with specific user accounts
   - Implement access control for private SOPs

## Testing Notes

Currently, without the background worker implementation, the system can be tested up to the job queuing stage:

1. Upload a video through the landing page
2. Verify the file appears in Supabase Storage under `videos/raw/[jobId].mp4`
3. Check that a job record is created in the `jobs` table with status "queued"
4. The SOP view will show the "AI magic in progress..." spinner

To complete the testing loop, you would need to:
1. Manually update a job's status to "completed" in the Supabase dashboard
2. Ensure a mock SOP JSON is available at the expected location 