# Video Processing Worker

This document explains how to set up and run the background worker for video processing in the Runops application.

## Overview

The worker is a standalone Node.js script that:

1. Checks for queued jobs in the Supabase database
2. Downloads raw videos from Supabase Storage
3. Processes videos with ffmpeg to create slim versions (1fps, 720p, CRF 32)
4. Uploads the processed videos back to Supabase Storage
5. Updates job statuses in the database

## Prerequisites

Before running the worker, ensure you have:

1. Node.js installed (v16 or higher recommended)
2. Access to your Supabase project
3. Environment variables set up (see below)

## Environment Variables

Create a `.env.local` file in the `app_frontend` directory with the following variables:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**Important**: The worker requires the service role key to access the storage and database.

## Running the Worker

### Development

To run the worker in development mode:

```bash
cd app_frontend
npm run worker
```

This will start the worker which will poll for jobs every 10 seconds.

### Production

For production, you would typically deploy this as a containerized service on platforms like Railway or Fly.io. A simple Dockerfile would look like:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "run", "worker"]
```

## Job Processing Flow

1. The web application creates job records with status "queued" when videos are uploaded.
2. The worker polls the database for jobs with "queued" status.
3. When a job is found, the worker:
   - Updates status to "processing"
   - Downloads the raw video
   - Processes it with ffmpeg
   - Uploads the slim version
   - Updates status to "completed" (or "error" if something fails)

## Debugging

To debug the worker:

1. Check the console output for detailed logs of each step.
2. Verify Supabase Storage for the presence of files in `videos/raw/` and `videos/slim/`.
3. Check the `jobs` table in Supabase for current job statuses.

## Current Limitations

- The worker processes one job at a time (by design for the MVP).
- There's no retrying mechanism for failed jobs.
- Gemini API integration for SOP extraction is not yet implemented (coming next). 