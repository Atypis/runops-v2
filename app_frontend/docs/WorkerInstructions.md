# Background Worker Instructions

This document provides information on how to set up, run, and maintain the background worker for video processing in the Runops application.

## Overview

The worker is a Node.js script that:

1. Polls the Supabase database for queued jobs
2. Downloads raw videos from storage
3. Processes videos with ffmpeg (1fps, 720p, CRF 32)
4. Uploads processed videos back to storage
5. Sends videos to Gemini API for SOP extraction
6. Saves SOPs to database and updates job status

## Prerequisites

1. Node.js 18 or later
2. Environment variables (in `.env.local` file):
   - `NEXT_PUBLIC_SUPABASE_URL` - The URL of your Supabase project
   - `SUPABASE_SERVICE_ROLE_KEY` - The service role key for your Supabase project
   - `GOOGLE_GEMINI_API_KEY` - The API key for Google Gemini

## Running the Worker

To start the worker:

```bash
cd app_frontend
npm run worker
```

The worker will continue to run until manually stopped. It polls for new jobs every 10 seconds.

For development, you may want to run it in a separate terminal window or use a process manager like PM2 for production.

## Testing

To check the worker setup and configuration:

```bash
cd app_frontend
npm run test-worker
```

This will verify:
- The `sops` table exists in the database
- Storage folders (`raw`, `slim`, `sops`) exist
- Any existing jobs and their statuses

## Troubleshooting

Common issues and their solutions:

### Worker Fails to Start

1. Check that all required environment variables are set in `.env.local`
2. Verify Node.js is version 18 or later
3. Run `npm install` to ensure all dependencies are installed

### Jobs Remain in 'Processing' State

1. Check worker logs for errors
2. Verify the worker is still running (use `ps aux | grep worker.js`)
3. Reset stuck jobs with SQL: `UPDATE jobs SET status = 'queued' WHERE status = 'processing' AND updated_at < NOW() - INTERVAL '1 hour';`

### Gemini API Errors

1. Check that your Gemini API key is valid and has sufficient quota
2. Verify the model `gemini-2.5-flash-preview-04-17` is available
3. Test the API connection with `node test-gemini.js`

### Database Connection Issues

1. Verify Supabase service role key has the necessary permissions
2. Check that the Supabase project is active and accessible

### API Endpoints Return Incorrect Status

If the API consistently reports incorrect or stale job status:

1. Check that the job exists in the database with the correct status
2. Verify the client is using the most recent API implementation with cache busting
3. Clear browser cache and reload the application
4. The API endpoints have been updated with strong cache control to prevent stale data

## Architecture

The worker processes jobs in the following steps:

1. **Job Polling**: Queries the `jobs` table for entries with `status = 'queued'`
2. **User ID Extraction**: Gets the user_id from job metadata if available
3. **Video Download**: Retrieves the raw video from `videos/raw/{jobId}.mp4`
4. **Video Processing**: Uses ffmpeg to create a slim version with 1fps, 720p resolution, and CRF 32
5. **Storage Upload**: Uploads processed video to `videos/slim/{jobId}.mp4`
6. **SOP Generation (two-step process)**:
   - **Step 1: Transcription** - Sends the video to Gemini API to generate a detailed transcript with timestamps
   - **Step 2: SOP Extraction** - Sends the transcript to Gemini API with the SOP parsing prompt
7. **Database Update**: 
   - Saves the transcript to the `transcripts` table
   - Saves the SOP to the `sops` table with the user_id if available
   - Updates job status in the `jobs` table

## Maintenance

- **Logs**: The worker logs to stdout/stderr, capture these for monitoring
- **Performance**: The worker processes one job at a time to avoid overloading resources
- **Scaling**: For higher volumes, consider running multiple workers or implementing a queue system
- **Updates**: When updating the worker, check for compatibility with existing database schema and storage structure

## Prompt Management

The worker uses two separate prompt files:

1. **Transcription Prompt** (`prompts/transcription_prompt_v1.md`)
   - Used in Step 1 to extract a detailed transcript from the video
   - Includes guidelines for capturing visual events and audio segments

2. **SOP Parsing Prompt** (`prompts/sop_parser_v0.7.md`)
   - Used in Step 2 to convert the transcript into a structured SOP
   - Includes the JSON schema for the SOP format

To update either prompt:

1. Edit the respective file or create a new version
2. Update the corresponding `*_PROMPT_PATH` constant in `worker.js` if using a new file
3. Restart the worker to use the new prompt

## Database Schema

The worker interacts with three main tables:

1. **`jobs`** - Tracks processing status
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

2. **`transcripts`** - Stores raw video transcriptions
   ```sql
   CREATE TABLE public.transcripts (
     id SERIAL PRIMARY KEY,
     job_id UUID NOT NULL REFERENCES public.jobs(job_id),
     transcript JSONB NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
   ```

3. **`sops`** - Stores final processed SOPs
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

The `metadata` field in the `jobs` table contains the `user_id` which is extracted and used when creating SOPs. This ensures SOPs are associated with the user who created them.

## Row Level Security (RLS)

The database uses Row Level Security to control access to data. This affects how the worker interacts with the database:

1. **Service Role Access**: The worker uses the service role key (`SUPABASE_SERVICE_ROLE_KEY`) which bypasses RLS restrictions, allowing it to:
   - Read all jobs regardless of user
   - Write SOPs for any user_id

2. **RLS Policies**: For reference, the following policies are in place:
   ```sql
   -- Policy for the service role to access all SOPs
   CREATE POLICY service_all_sops ON public.sops
       FOR ALL
       TO service_role
       USING (true);
   
   -- Policy for authenticated users to only see their own SOPs (plus NULL user_id SOPs)
   CREATE POLICY select_own_sops ON public.sops
       FOR SELECT
       TO authenticated
       USING (user_id = auth.uid() OR user_id IS NULL);
   ```

3. **Worker Responsibility**: The worker must:
   - Extract user_id from job metadata if available
   - Store the user_id in the sops table when creating new SOPs
   - This ensures proper access control when users later view their SOPs

When troubleshooting permission issues, remember that the worker should not encounter RLS restrictions due to its service role, but clients accessing the API will be subject to these policies. 