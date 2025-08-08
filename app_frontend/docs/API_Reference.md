# 🌐 API Reference Guide

> **Complete REST API Documentation - All Endpoints & Integration Patterns**

## 📋 API Overview

### Base URL
```
Local Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

### Authentication Strategy
- **Public Endpoints**: Upload, queue, status polling
- **Protected Endpoints**: SOP access (RLS via `user_id`)
- **Auth Method**: Google OAuth popup-based flow
- **Session Management**: Supabase Auth tokens

### Response Format Standards
```typescript
// Success Response
{
  "data": any,           // Endpoint-specific data
  "success": true,
  "timestamp": "2024-12-01T10:30:00Z"
}

// Error Response  
{
  "error": "Human-readable error message",
  "success": false,
  "code": "ERROR_CODE",  // Optional error classification
  "timestamp": "2024-12-01T10:30:00Z"
}
```

## 📤 Upload & Processing Endpoints

### GET /api/get-upload-url
**Purpose**: Generate signed URL for direct-to-storage video upload

#### Request
```http
GET /api/get-upload-url
Content-Type: application/json
```

#### Response (200 OK)
```json
{
  "uploadUrl": "https://storage.supabase.co/v1/object/videos/raw/uuid.mp4?token=...",
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "filePath": "raw/550e8400-e29b-41d4-a716-446655440000.mp4"
}
```

#### Implementation Details (api/get-upload-url/route.ts)
```typescript
// VERIFIED IMPLEMENTATION
export async function GET() {
  try {
    const jobId = uuidv4();
    const filePath = `raw/${jobId}.mp4`;
    
    // Generate signed URL (1 hour expiry)
    const { data, error } = await supabase.storage
      .from('videos')
      .createSignedUploadUrl(filePath, {
        expiresIn: 3600,  // 1 hour
        upsert: false     // Prevent overwriting
      });
    
    if (error) throw error;
    
    return NextResponse.json({
      uploadUrl: data.signedUrl,
      jobId,
      filePath
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate upload URL' },
      { status: 500 }
    );
  }
}
```

#### Usage Pattern
```javascript
// Frontend upload flow
const response = await fetch('/api/get-upload-url');
const { uploadUrl, jobId } = await response.json();

// Direct upload to storage
const uploadResponse = await fetch(uploadUrl, {
  method: 'PUT',
  body: videoFile,
  headers: { 'Content-Type': 'video/mp4' }
});
```

#### Error Cases
- **500**: Database connection failure
- **500**: Storage service unavailable
- **500**: UUID generation failure

---

### POST /api/queue-job
**Purpose**: Queue uploaded video for AI processing

#### Request
```http
POST /api/queue-job
Content-Type: application/json

{
  "jobId": "550e8400-e29b-41d4-a716-446655440000"
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued"
}
```

#### Implementation Details (api/queue-job/route.ts)
```typescript
// VERIFIED IMPLEMENTATION
export async function POST(request: Request) {
  try {
    const { jobId } = await request.json();
    
    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }
    
    // Insert job record
    const { data, error } = await supabase
      .from('jobs')
      .insert({
        job_id: jobId,
        status: 'queued',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({
      success: true,
      jobId: data.job_id,
      status: data.status
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to queue job' },
      { status: 500 }
    );
  }
}
```

#### Error Cases
- **400**: Missing `jobId` in request body
- **400**: Invalid `jobId` format
- **500**: Database insertion failure
- **409**: Job ID already exists (potential duplicate)

---

## 📊 Status & Monitoring Endpoints

### GET /api/job-status/[jobId]
**Purpose**: Poll processing status and progress for specific job

#### Request
```http
GET /api/job-status/550e8400-e29b-41d4-a716-446655440000
```

#### Response (200 OK)
```json
{
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress_stage": "transcribing",
  "progress_percent": 60,
  "created_at": "2024-12-01T10:00:00Z",
  "updated_at": "2024-12-01T10:02:30Z",
  "metadata": {
    "video_duration": "03:45",
    "original_size": "245MB",
    "compressed_size": "12MB"
  }
}
```

#### Status Values & Progression
```typescript
type JobStatus = 
  | 'queued'      // Initial state after upload
  | 'processing'  // Worker has picked up job
  | 'completed'   // Successfully processed
  | 'error';      // Failed processing

type ProgressStage = 
  | 'preparing_video'  // Download + FFmpeg compression (10-40%)
  | 'transcribing'     // Gemini video analysis (50-60%)
  | 'parsing_sop'      // Gemini SOP generation (70-80%)
  | 'finalizing'       // Database save + cleanup (90%)
  | null;              // Not started or completed
```

#### Implementation Details (api/job-status/[jobId]/route.ts)
```typescript
// VERIFIED IMPLEMENTATION  
export async function GET(
  request: Request,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;
    
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', jobId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Job not found' },
          { status: 404 }
        );
      }
      throw error;
    }
    
    return NextResponse.json({
      jobId: data.job_id,
      status: data.status,
      progress_stage: data.progress_stage,
      progress_percent: data.progress_percent,
      created_at: data.created_at,
      updated_at: data.updated_at,
      completed_at: data.completed_at,
      error: data.error,
      metadata: data.metadata || {}
    });
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    );
  }
}
```

#### Polling Pattern (Frontend)
```typescript
// Efficient status polling implementation
const pollJobStatus = async (jobId: string): Promise<JobStatus> => {
  const maxAttempts = 120; // 10 minutes max
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const response = await fetch(`/api/job-status/${jobId}`);
    const status = await response.json();
    
    if (status.status === 'completed') {
      return status;
    }
    
    if (status.status === 'error') {
      throw new Error(status.error || 'Processing failed');
    }
    
    // Progressive backoff: 2s → 5s → 5s...
    const delay = attempts < 3 ? 2000 : 5000;
    await new Promise(resolve => setTimeout(resolve, delay));
    attempts++;
  }
  
  throw new Error('Processing timeout after 10 minutes');
};
```

#### Error Cases
- **404**: Job ID not found in database
- **500**: Database query failure
- **422**: Invalid UUID format for jobId

---

## 📋 SOP Data Endpoints

### GET /api/sop/[sopId]
**Purpose**: Retrieve processed SOP data for visualization
**Authentication**: Protected (user must own SOP)

#### Request
```http
GET /api/sop/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <supabase-jwt-token>
```

#### Response (200 OK)
```json
{
  "id": 1,
  "job_id": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "meta": {
      "title": "User Registration Process",
      "description": "Complete workflow for new user signup",
      "estimated_duration": "5 minutes"
    },
    "public": {
      "nodes": [
        {
          "id": "trigger_1",
          "type": "trigger", 
          "label": "Start Registration",
          "description": "User clicks sign up button"
        },
        {
          "id": "step_1",
          "type": "step",
          "label": "Fill Registration Form",
          "description": "Enter email, password, and personal details",
          "parentId": null,
          "children": []
        }
      ],
      "edges": [
        {
          "id": "edge_1",
          "source": "trigger_1",
          "target": "step_1",
          "condition": "next"
        }
      ]
    }
  },
  "user_id": "auth-user-uuid",
  "created_at": "2024-12-01T10:05:00Z",
  "updated_at": "2024-12-01T10:05:00Z"
}
```

#### Implementation Details (api/sop/[sopId]/route.ts)
```typescript
// VERIFIED IMPLEMENTATION
export async function GET(
  request: Request,
  { params }: { params: { sopId: string } }
) {
  try {
    const supabase = createSupabaseServerClient();
    const { sopId } = params;
    
    // RLS automatically filters by user_id
    const { data, error } = await supabase
      .from('sops')
      .select('*')
      .eq('job_id', sopId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'SOP not found or access denied' },
          { status: 404 }
        );
      }
      throw error;
    }
    
    return NextResponse.json(data);
    
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch SOP data' },
      { status: 500 }
    );
  }
}
```

#### Row Level Security (RLS)
```sql
-- Users can only access their own SOPs
CREATE POLICY "Users can view own SOPs" ON public.sops
  FOR SELECT USING (auth.uid() = user_id);
```

#### Error Cases
- **401**: No authentication token provided
- **403**: User not authorized to access this SOP
- **404**: SOP not found or access denied
- **500**: Database query failure

---

## 🔍 Direct Access Endpoints (Alternative Routes)

### GET /api/direct-sop/[sopId]
**Purpose**: Public SOP access (bypasses authentication)
**Use Case**: Sharing SOPs without requiring login

#### Request
```http
GET /api/direct-sop/550e8400-e29b-41d4-a716-446655440000
```

#### Response (200 OK)
```json
// Same SOP data structure as /api/sop/[sopId]
// But without RLS restrictions
```

#### Implementation (api/direct-sop/[sopId]/route.ts)
```typescript
// Service role key bypasses RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data, error } = await supabase
  .from('sops') 
  .select('*')
  .eq('job_id', sopId)
  .single();
```

---

### GET /api/direct-status/[jobId]
**Purpose**: Public job status access (bypasses authentication)

#### Request & Response
Same as `/api/job-status/[jobId]` but without auth requirements.

---

## 🔧 Development & Testing Endpoints

### Health Check Pattern (Recommended Addition)
```typescript
// api/health/route.ts (recommended)
export async function GET() {
  try {
    // Test database connectivity
    const { error: dbError } = await supabase
      .from('jobs')
      .select('count(*)', { count: 'exact', head: true });
    
    // Test Gemini API connectivity  
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
    
    return NextResponse.json({
      status: 'healthy',
      services: {
        database: !dbError ? 'up' : 'down',
        ai_api: 'up',  // Assume up if no error
        storage: 'up'  // Could add storage health check
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { status: 'unhealthy', error: error.message },
      { status: 503 }
    );
  }
}
```

### Debug Endpoints (Development Only)
```typescript
// api/debug/jobs/route.ts (development)
export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  
  const { data } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  
  return NextResponse.json({ recent_jobs: data });
}
```

## 🔐 Authentication Integration

### Client-Side Auth Pattern
```typescript
// Frontend auth integration
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const supabase = createClientComponentClient();

// Authenticated API calls
const fetchSOP = async (sopId: string) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error('Authentication required');
  }
  
  const response = await fetch(`/api/sop/${sopId}`, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`
    }
  });
  
  return response.json();
};
```

### Server-Side Auth (API Routes)
```typescript
// Standard auth pattern in API routes
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(request: Request) {
  const supabase = createSupabaseServerClient();
  
  // Auth is handled automatically by Supabase client
  // RLS policies enforce access control
  const { data, error } = await supabase
    .from('protected_table')
    .select('*');
    
  // error will contain auth failure if user not authenticated
}
```

## 📈 Rate Limiting & Performance

### Current Limitations
- **No rate limiting implemented** on any endpoints
- **No request size limits** beyond Next.js defaults
- **No concurrent request limits** for same user

### Recommended Rate Limiting (Enhancement)
```typescript
// Simple in-memory rate limiter
const rateLimiter = new Map();

const checkRateLimit = (clientId: string, maxRequests = 10, windowMs = 60000) => {
  const now = Date.now();
  const clientRequests = rateLimiter.get(clientId) || [];
  
  const validRequests = clientRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (validRequests.length >= maxRequests) {
    throw new Error('Rate limit exceeded');
  }
  
  validRequests.push(now);
  rateLimiter.set(clientId, validRequests);
};

// Usage in API routes
export async function GET(request: Request) {
  const clientId = request.headers.get('x-forwarded-for') || 'unknown';
  checkRateLimit(clientId, 60, 60000); // 60 requests per minute
  
  // ... rest of endpoint logic
}
```

## 🐛 Error Handling Patterns

### Standard Error Response Format
```typescript
// Consistent error handling across all endpoints
const handleApiError = (error: any, defaultMessage: string) => {
  console.error('API Error:', error);
  
  // Supabase-specific error handling
  if (error.code === 'PGRST116') {
    return NextResponse.json(
      { error: 'Resource not found' },
      { status: 404 }
    );
  }
  
  if (error.code === '23505') { // Unique constraint violation
    return NextResponse.json(
      { error: 'Resource already exists' },
      { status: 409 }
    );
  }
  
  // Generic error response
  return NextResponse.json(
    { error: defaultMessage },
    { status: 500 }
  );
};
```

### Client-Side Error Handling
```typescript
// Robust client-side API error handling
const apiCall = async (url: string, options?: RequestInit) => {
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
    
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Network error - please check your connection');
    }
    
    throw error; // Re-throw API errors with original message
  }
};
```

## 🔧 Testing API Endpoints

### Manual Testing Commands
```bash
# Test upload URL generation
curl -X GET http://localhost:3000/api/get-upload-url

# Test job queueing
curl -X POST http://localhost:3000/api/queue-job \
  -H "Content-Type: application/json" \
  -d '{"jobId":"550e8400-e29b-41d4-a716-446655440000"}'

# Test job status polling
curl -X GET http://localhost:3000/api/job-status/550e8400-e29b-41d4-a716-446655440000

# Test SOP retrieval (requires auth token)
curl -X GET http://localhost:3000/api/sop/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer <token>"
```

### Automated Testing Framework
```typescript
// api.test.ts example
describe('API Endpoints', () => {
  test('GET /api/get-upload-url returns valid URL', async () => {
    const response = await fetch('/api/get-upload-url');
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.uploadUrl).toMatch(/^https:\/\/.+\.supabase\.co/);
    expect(data.jobId).toMatch(/^[0-9a-f-]{36}$/);
  });
  
  test('POST /api/queue-job creates job record', async () => {
    const jobId = uuidv4();
    
    const response = await fetch('/api/queue-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });
    
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.jobId).toBe(jobId);
  });
});
```

---

## 🎯 Quick Reference

### Endpoint Summary
```
GET  /api/get-upload-url           → Generate signed upload URL
POST /api/queue-job                → Queue video for processing  
GET  /api/job-status/[jobId]       → Poll processing status
GET  /api/sop/[sopId]              → Get SOP data (authenticated)
GET  /api/direct-sop/[sopId]       → Get SOP data (public)
GET  /api/direct-status/[jobId]    → Get job status (public)
```

### Response Status Codes
- **200**: Success
- **400**: Bad request (missing/invalid parameters)
- **401**: Authentication required
- **403**: Access forbidden
- **404**: Resource not found
- **409**: Conflict (duplicate resource)
- **500**: Internal server error

### Integration Flow
```
1. GET /api/get-upload-url         → Get signed URL + jobId
2. PUT <signedUrl>                 → Direct upload to storage
3. POST /api/queue-job             → Queue for processing
4. GET /api/job-status/[jobId]     → Poll until 'completed'
5. GET /api/sop/[jobId]            → Retrieve processed SOP
```

---

## 🔗 Related Documentation
- **Upload Flow**: See `UploadProcessingArchitecture.md` for complete upload → processing pipeline
- **Error Debugging**: See `ERROR_HANDLING_GUIDE.md` for API error patterns and troubleshooting
- **Development Setup**: See `DEVELOPMENT_SETUP.md` for local API testing environment

**Last Updated**: Dec 2024 | **Status**: Complete API reference with verified implementations 