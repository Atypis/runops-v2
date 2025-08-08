# Upload & Processing Architecture

> **⚠️ DOCUMENTATION STATUS**: Updated with reality check (Dec 2024)  
> **✅ Core flow verified** | **⚠️ Some limits outdated** | **❓ Cleanup logic uncertain**

This document outlines the architecture of the video upload and processing system in Runops. It explains the complete flow from client-side upload to backend processing and storage.

## 🚨 Reality Check vs. Documentation

### ✅ VERIFIED - Accurate Information
- ✅ Multi-stage architecture (client validation → signed URLs → progress tracking → job queueing → status polling)
- ✅ Direct-to-storage uploads via Supabase signed URLs
- ✅ Background worker with polling queue
- ✅ ReactFlow visualization with custom node types
- ✅ Google OAuth authentication via popup

### ⚠️ OUTDATED - Needs Update
- ⚠️ **File Limits**: Doc claims various limits, **actual is 750MB / 20min** (see `app/page.tsx:25-26`)
- ⚠️ **Processing Stages**: Doc missing intermediate `transcription` step
- ⚠️ **Database Schema**: Missing `transcripts` table and progress tracking fields

### ❓ UNCERTAIN - Needs Verification  
- ❓ **Auto-cleanup**: Claimed in ADRs but not found in worker code
- ❓ **Storage policies**: May be configured in Supabase dashboard

---

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

- **`app/page.tsx`** *(✅ VERIFIED)*  
  The landing page with drag-and-drop upload zone that:
  - Validates videos (**ACTUAL**: size < 750MB, duration < 20min - *line 25-26*)
  - Requests signed upload URLs from the API
  - Uploads directly to Supabase Storage with progress tracking
  - Queues processing jobs after successful upload
  - Provides real-time feedback via progress bar and status indicators

- **`app/sop/[sopId]/page.tsx`** *(✅ VERIFIED)*  
  The SOP viewer page that:
  - Polls the job status endpoint every 3 seconds *(line 82)*
  - Shows an "AI magic in progress..." spinner during processing
  - Displays a ReactFlow diagram or list view when processing completes
  - Handles error states with appropriate user feedback
  - Provides toggle between list view and flow view
  - Uses cache-busting parameters to prevent stale data *(line 72-74)*

### API Endpoints *(✅ VERIFIED)*

- **`app/api/get-upload-url/route.ts`**  
  Generates signed upload URLs:
  - Creates a unique `jobId` (UUID) for each upload *(line 13)*
  - Uses Supabase service role to generate a signed URL for `videos/raw/<jobId>.mp4` *(line 20)*
  - Returns `{ jobId, url }` to the client
  - Implements error handling with meaningful HTTP status codes

- **`app/api/queue-job/route.ts`**  
  Initiates video processing:
  - Verifies the uploaded file exists in storage *(line 26-32)*
  - Creates a job record in the database with "queued" status *(line 38-47)*
  - **NEW**: Stores user_id in metadata for RLS *(line 35)*
  - Returns job status confirmation to the client
  - Handles errors with appropriate HTTP status codes

- **`app/api/job-status/[jobId]/route.ts`**  
  Provides processing status information:
  - Queries the jobs table for current status *(line 22)*
  - **NEW**: Returns progress stage and percentage *(line 56-60)*
  - Includes strong cache control headers to prevent stale data *(line 61-66)*
  - Standardized error responses

- **`app/api/sop/[sopId]/route.ts`**  
  Retrieves and updates SOP data:
  - Queries the sops table using the job_id
  - Returns the SOP data in JSON format 
  - Supports PATCH requests for updating and deleting nodes
  - Includes strong cache control headers to prevent stale data

### Database Schema *(⚠️ UPDATED)*

The system currently uses the following database structure:

- **`jobs` Table** *(⚠️ ENHANCED)*  
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
    metadata JSONB,
    -- NEW: Progress tracking fields
    progress_stage VARCHAR(50),    -- preparing_video|transcribing|parsing_sop|finalizing
    progress_percent INT           -- 0-100 for UI progress bars
  );
  ```

- **`transcripts` Table** *(🆕 NEW - Missing from original docs)*  
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

- **`sops` Table** *(✅ VERIFIED)*  
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

### Storage Configuration *(⚠️ PARTIALLY VERIFIED)*

- **Supabase Storage Bucket: `videos`** *(✅ VERIFIED)*  
  - `/raw` - Original uploaded videos *(worker.js:181)*
  - `/slim` - Processed videos (1fps, 720p, CRF 32) *(worker.js:232)*
  - `/sops` - Generated SOP JSON files (backup of database records) *(worker.js:497)*
  - `/transcripts` - Detailed video transcripts *(worker.js:468)*

- **Security Policies** *(❓ UNCERTAIN)*
  - Upload allowed via signed URLs (no auth required)
  - Read access restricted to authenticated users
  - Service role has full access for background processing

## Implementation Details

### Upload Process *(✅ VERIFIED)*

1. **Client-Side Validation** *(app/page.tsx:74-117)*
   - Browser checks file type, size, and uses HTML5 video element to verify duration
   - **ACTUAL LIMITS**: 750MB / 20min *(lines 25-26)*
   - Clear error messages for invalid files

2. **Signed URL Request** *(app/page.tsx:190-199)*
   - Client calls `/api/get-upload-url` to get a temporary upload URL
   - Server generates a UUID and creates a signed URL valid for 10 minutes

3. **Direct Upload with Progress** *(app/page.tsx:204-225)*
   - XMLHttpRequest used for upload with progress tracking
   - `xhr.upload.onprogress` events update UI progress bar *(line 213)*
   - Standard HTTP status codes for error handling

4. **Post-Upload Processing** *(app/page.tsx:228-243)*
   - After successful upload, client calls `/api/queue-job` with the jobId
   - Server verifies file exists and creates database record
   - Client redirects to SOP view which will show processing status

### Job Processing Flow *(⚠️ ENHANCED)*

1. **Job Creation** *(api/queue-job/route.ts:38-47)*
   - Jobs start in "queued" status
   - User ID is stored in the job metadata (if authenticated) *(line 35)*
   - Background worker polls for new jobs *(worker.js:94)*

2. **Status Updates** *(✅ VERIFIED - Enhanced)*
   - SOP view polls `/api/job-status/[jobId]` every 3 seconds
   - **NEW STAGES**: `preparing_video` → `transcribing` → `parsing_sop` → `finalizing` → `completed`
   - Progress percentages: 10-40% → 50-60% → 70-80% → 90% → 100% *(worker.js:129-169)*
   - Cache-busting parameters and cache control headers prevent stale data

3. **Two-Stage AI Processing** *(🆕 NEW - worker.js:261-287)*
   - **Stage 1**: Video → Detailed transcript *(worker.js:300-373)*
   - **Stage 2**: Transcript → Structured SOP *(worker.js:374-467)*
   - Uses Gemini 2.5 Flash Preview with retry logic (3 attempts each)

4. **Completion** *(✅ VERIFIED)*
   - When processing completes, SOP view displays the diagram
   - Users can toggle between list and flow visualizations
   - SOPs are associated with the user who created them via user_id

## Current Implementation Status

### Completed Components *(✅ VERIFIED)*

- ✅ Video upload with validation and progress tracking
- ✅ Signed URL generation for secure direct-to-storage uploads
- ✅ Job queue system with database tracking
- ✅ Status polling API endpoint with progress stages
- ✅ SOP viewer with status polling and UI states
- ✅ Background worker with **two-stage AI processing**
  - Node.js worker that polls the job queue every 10 seconds *(worker.js:12)*
  - Downloads raw videos, processes with ffmpeg (1fps, 720p, CRF 32)
  - **Stage 1**: Video → Transcript using Gemini *(worker.js:300)*
  - **Stage 2**: Transcript → SOP using Gemini *(worker.js:374)*
  - Saves results to database and storage
- ✅ SOP Editing API with robust caching prevention
- ✅ Integration with Authentication system
  - Google OAuth authentication via Supabase Auth *(lib/auth-context.tsx:67)*
  - "My SOPs" page for viewing user's SOPs
  - Row Level Security (RLS) for user data privacy
  - Middleware protection for API routes and sensitive pages
  - User ID tracking throughout the upload and processing pipeline

### Pending/Uncertain Components *(❓)*

- ❓ **Auto-cleanup**: Claimed in ADRs but no visible implementation in worker
- ❓ **Advanced error recovery**: Basic retry logic exists, but no sophisticated recovery
- ❓ **Rate limiting**: No visible API rate limits implemented
- ⏳ **SOP Deletion functionality**
- ⏳ **Enhanced user interface feedback**
- ⏳ **Pagination for users with many SOPs**

## Security Considerations *(✅ VERIFIED)*

1. **Private Storage Bucket**
   - Videos are stored in a private bucket, not publicly accessible
   - Access requires either a signed URL or authenticated request *(worker.js uses service role)*

2. **Row Level Security (RLS)** *(✅ VERIFIED)*
   - SOPs are filtered by user_id automatically *(enforced in Supabase)*
   - Service role bypasses RLS for worker operations
   - Users can only see their own SOPs or public ones

3. **Popup Authentication** *(✅ VERIFIED)*
   - Preserves upload state during authentication *(lib/auth-context.tsx:82)*
   - No full-page redirects that would lose user progress

---

## 🎯 Implementation References for AI Agents

**Upload flow**: `app/page.tsx:177` → `api/get-upload-url` → `api/queue-job`  
**Processing pipeline**: `worker.js:129` → `transcribeVideo()` → `generateSopFromTranscript()`  
**Status polling**: `app/sop/[sopId]/page.tsx:82` → `api/job-status/[jobId]`  
**Database schema**: See CODEBASE_MAP.md for complete SQL definitions  

---

## 🔗 Related Documentation
- **AI Processing**: See `AI_PROCESSING_PIPELINE.md` for detailed Gemini pipeline workflow
- **Worker Operations**: See `WorkerInstructions.md` for background processing maintenance
- **Error Handling**: See `ERROR_HANDLING_GUIDE.md` for upload and processing debugging
- **API Reference**: See `API_REFERENCE.md` for complete endpoint documentation

**Last Updated**: Dec 2024 | **Status**: Verified upload & processing flow documentation