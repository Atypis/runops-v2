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
  - Uses cache-busting parameters to prevent stale data

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
  - Includes strong cache control headers to prevent stale data
  - Standardized error responses

- **`app/api/sop/[sopId]/route.ts`**  
  Retrieves and updates SOP data:
  - Queries the sops table using the job_id
  - Returns the SOP data in JSON format 
  - Supports PATCH requests for updating and deleting nodes
  - Includes strong cache control headers to prevent stale data

### Database Schema

The system currently uses the following database structure:

- **`jobs` Table**  
  Tracks the status of video processing jobs:
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

- **`sops` Table**  
  Stores the extracted Standard Operating Procedures:
  ```sql
  CREATE TABLE public.sops (
    id SERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(job_id),
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
  );
  ```

- **`transcripts` Table**  
  Stores the raw video transcriptions (intermediate processing step):
  ```sql
  CREATE TABLE public.transcripts (
    id SERIAL PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(job_id),
    transcript JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  ```

### Storage Configuration

- **Supabase Storage Bucket: `videos`**  
  - `/raw` - Original uploaded videos
  - `/slim` - Processed videos (1fps, 720p, CRF 32)
  - `/sops` - Generated SOP JSON files (backup of database records)
  - `/transcripts` - Detailed video transcripts (intermediate step of processing)

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
   - User ID is stored in the job metadata (if authenticated)
   - Background worker polls for new jobs

2. **Status Updates**
   - SOP view polls `/api/job-status/[jobId]` every 3 seconds
   - Processing states handled: queued, processing, completed, error
   - Different UI displayed based on job status
   - Cache-busting parameters and cache control headers prevent stale data

3. **Completion**
   - When processing completes, SOP view displays the diagram
   - Users can toggle between list and flow visualizations
   - SOPs are associated with the user who created them via user_id

## Current Implementation Status

### Completed Components

- ✅ Video upload with validation and progress tracking
- ✅ Signed URL generation for secure direct-to-storage uploads
- ✅ Job queue system with database tracking
- ✅ Status polling API endpoint
- ✅ SOP viewer with status polling and UI states
- ✅ Background worker (Ticket 1.6)
  - Node.js worker that polls the job queue every 10 seconds
  - Downloads raw videos, processes with ffmpeg (1fps, 720p, CRF 32)
  - Uploads processed videos to the slim/ folder
  - Extracts SOPs using Gemini 2.5 Flash Preview API
  - Saves results to database and storage
- ✅ SOP Editing API (Ticket 1.7)
  - API endpoints for retrieving and updating SOPs
  - Robust caching prevention to ensure fresh data
- ✅ Integration with Authentication system (Ticket 1.8)
  - Google OAuth authentication via Supabase Auth
  - "My SOPs" page for viewing user's SOPs
  - Row Level Security (RLS) for user data privacy
  - Middleware protection for API routes and sensitive pages
  - User ID tracking throughout the upload and processing pipeline

### Pending Components

- ⏳ SOP Deletion functionality
- ⏳ Enhanced user interface feedback
- ⏳ Pagination for users with many SOPs

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

5. **Cache Control**
   - Strong cache control headers on all API responses
   - Cache-busting parameters in all API requests
   - Prevents browsers or proxies from serving stale data

6. **Row Level Security (RLS)**
   - Database tables have RLS policies enabled
   - Users can only access their own SOPs
   - Service role bypasses RLS for worker operations
   - Special policy for backward compatibility allows viewing SOPs with NULL user_id

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