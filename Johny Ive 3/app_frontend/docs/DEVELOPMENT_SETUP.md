# 🛠️ Development Setup Guide

> **AI Agent Onboarding - Complete Environment Setup**

## 🚀 Quick Start (5 minutes)

### Prerequisites Verification
```bash
node --version     # Need 18+ 
npm --version      # Need 9+
ffmpeg -version    # Required for video processing
```

### Core Setup Commands
```bash
# 1. Install dependencies
cd app_frontend
npm install

# 2. Copy environment template
cp .env.example .env.local  # Create this file (see below)

# 3. Configure environment variables
# Edit .env.local with your credentials (required setup below)

# 4. Test system health
npm run test-worker  # Verify DB + storage + API keys

# 5. Start development
npm run dev          # Terminal 1: Frontend (localhost:3000)
npm run worker       # Terminal 2: Background processor

# ✅ Visit http://localhost:3000 to test upload
```

## 🔐 Environment Variables (.env.local)

### Required Configuration
```bash
# Supabase Configuration (REQUIRED)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# AI Processing (REQUIRED) 
GOOGLE_GEMINI_API_KEY=AIzaSyC...

# Optional - Development
NODE_ENV=development
```

### Where to Get These Values

#### Supabase Setup (Database + Storage + Auth)
1. **Create Project**: [supabase.com/dashboard](https://supabase.com/dashboard)
2. **Get URLs**: Project Settings → API → Project URL & API Keys
3. **Required Tables**: See Database Schema section below

#### Google Gemini API Key
1. **Get API Key**: [aistudio.google.com](https://aistudio.google.com/)
2. **Enable Models**: Ensure access to `gemini-2.5-flash-preview-04-17`
3. **Test Access**: Run `node test-gemini.js` after setup

## 🗄️ Database Schema Setup

### Required Tables & Storage

#### Option 1: Manual SQL Setup
```sql
-- Jobs tracking table
CREATE TABLE public.jobs (
  id SERIAL PRIMARY KEY,
  job_id UUID NOT NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error TEXT,
  metadata JSONB,
  progress_stage VARCHAR(50),
  progress_percent INT
);

-- Intermediate transcription storage
CREATE TABLE public.transcripts (
  id SERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(job_id),
  transcript JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Final SOP storage  
CREATE TABLE public.sops (
  id SERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.jobs(job_id),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id)
);

-- Create storage bucket
INSERT INTO storage.buckets (id, name) VALUES ('videos', 'videos');
```

#### Option 2: Use Existing Migrations
```bash
# If migration files exist (check app_frontend/migrations/)
supabase db reset --local  # Reset and apply all migrations
```

### Row Level Security (RLS) Setup
```sql
-- Enable RLS on SOPs table
ALTER TABLE public.sops ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own SOPs
CREATE POLICY "Users can view own SOPs" ON public.sops
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own SOPs" ON public.sops  
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own SOPs" ON public.sops
  FOR UPDATE USING (auth.uid() = user_id);
```

### Storage Policies
```sql
-- Allow authenticated uploads to videos bucket
CREATE POLICY "Authenticated upload" ON storage.objects
  FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'videos');

-- Allow public read access to videos bucket  
CREATE POLICY "Public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'videos');
```

## 🧪 System Health Verification

### Test Scripts Available
```bash
# Test database connectivity
node test-db.js

# Test Gemini API access  
node test-gemini.js

# Comprehensive worker setup test
npm run test-worker
```

### Expected Test Outputs
```bash
# test-worker.js success output:
✅ sops table exists
✅ raw folder exists  
✅ slim folder exists
✅ sops folder exists
Recent jobs: 3 found
✅ Worker setup looks good!

# test-gemini.js success output:  
✅ API client initialized
✅ Successfully initialized gemini-1.5-pro-preview model
SUCCESS: Gemini API is working properly!
```

## 🚨 Common Setup Issues & Solutions

### Database Connection Issues
```bash
# Error: "relation 'jobs' does not exist"
→ Run database setup SQL or migrations

# Error: "Invalid API key" 
→ Check SUPABASE_SERVICE_ROLE_KEY (not anon key)

# Error: "Row Level Security policy violation"
→ Disable RLS temporarily or fix policies
```

### Gemini API Issues  
```bash
# Error: "API key not valid"
→ Regenerate key at aistudio.google.com

# Error: "Model not found" 
→ Ensure access to gemini-2.5-flash-preview-04-17

# Error: "Permission denied"
→ Check API quota and billing settings
```

### Video Processing Issues
```bash  
# Error: "ffmpeg not found"
→ Install: brew install ffmpeg (macOS) or apt install ffmpeg (Linux)

# Error: "Cannot read video file"
→ Check file permissions and temp directory access

# Error: "Upload failed"  
→ Verify storage bucket exists and policies are correct
```

### Storage/Upload Issues
```bash
# Error: "Bucket 'videos' does not exist"
→ Create bucket in Supabase dashboard or via SQL

# Error: "Signed URL generation failed"
→ Check service role key has storage admin permissions

# Error: "CORS error on upload"
→ Configure CORS in Supabase Storage settings
```

## 🏗️ Architecture Quick Reference

### Application Flow
```
1. Frontend Upload (app/page.tsx) 
   ↓ 
2. Signed URL (api/get-upload-url)
   ↓
3. Direct Storage Upload (Supabase) 
   ↓
4. Job Queue (api/queue-job)
   ↓  
5. Worker Processing (worker.js)
   ↓
6. AI Processing (Gemini API)
   ↓
7. Results Storage (Database + Files)
   ↓
8. User Viewing (app/sop/[sopId])
```

### Key File Responsibilities
```
worker.js           → Background job processor
app/page.tsx        → Upload UI and validation  
app/api/*/route.ts  → API endpoint handlers
lib/sop-utils.ts    → Data transformation logic
components/sop/     → ReactFlow visualization
```

## 📦 Dependencies Overview

### Core Dependencies
```json
{
  "next": "^14.0.0",              // Full-stack framework
  "@supabase/supabase-js": "^2.0", // Database & auth client  
  "@google/generative-ai": "^0.2", // Gemini AI integration
  "reactflow": "^11.0",           // Diagram visualization
  "fluent-ffmpeg": "^2.1",        // Video processing
  "dagre": "^0.8",                // Auto-layout algorithm
}
```

### Development Tools
```json
{
  "typescript": "^5.0",           // Type safety
  "tailwindcss": "^3.0",         // CSS framework  
  "@types/*": "latest",           // TypeScript definitions
  "dotenv": "^16.0"               // Environment management
}
```

## 🔄 Development Workflow

### Starting Fresh Development Session
```bash
# Terminal 1: Frontend development  
cd app_frontend && npm run dev

# Terminal 2: Background worker
cd app_frontend && npm run worker  

# Terminal 3: Database monitoring (optional)
supabase start
```

### Making Changes

#### Frontend Changes
- Edit files in `app/`, `components/`, `lib/` 
- Hot reload happens automatically
- Check browser console for errors

#### Worker Changes  
- Edit `worker.js`
- Restart worker: `Ctrl+C` then `npm run worker`
- Check terminal output for processing logs

#### Database Changes
- Update schema in Supabase dashboard
- Or create migration files in `migrations/`
- Test with `npm run test-worker`

### Testing Changes
```bash
# Test upload flow
1. Visit localhost:3000
2. Drag/drop video file
3. Verify upload progress  
4. Check job processing in worker terminal
5. View result at /sop/[jobId] 

# Test API endpoints directly
curl -X POST localhost:3000/api/get-upload-url
curl -X GET localhost:3000/api/job-status/[jobId]
```

## 🎯 Quick Debugging Guide

### Upload Not Working?
1. Check browser network tab for failed requests
2. Verify `.env.local` variables are loaded
3. Test `api/get-upload-url` endpoint directly  
4. Check Supabase storage bucket exists

### Processing Stuck?
1. Check worker terminal for error messages
2. Verify Gemini API key is valid
3. Test `node test-gemini.js`
4. Check job status in database

### Visualization Issues?
1. Check browser console for ReactFlow errors
2. Verify SOP data structure in `/api/sop/[sopId]`
3. Test data transformation in `lib/sop-utils.ts`
4. Check node type registration in `SOPFlowView.tsx`

---

## 🔗 Related Documentation

- **CODEBASE_MAP.md** - Component relationships and file navigation
- **UploadProcessingArchitecture.md** - Detailed system architecture  
- **README.md** - Quick start and overview
- **SOPReactFlowArchitecture.md** - Visualization implementation

**Last Updated**: Dec 2024 | **Status**: Production-ready setup guide 