# 🚨 Error Handling & Retry Logic Guide

> **AI Agent Debugging Manual - Comprehensive Error Recovery Strategies**

## 📊 System Error Categories

### 1. Upload & Storage Errors (Frontend)
**Location**: `app/page.tsx`, `api/get-upload-url`, `api/queue-job`
**Impact**: Immediate user feedback required

### 2. Worker Processing Errors (Background)  
**Location**: `worker.js`
**Impact**: Job fails, requires retry or manual intervention

### 3. AI Processing Errors (Gemini API)
**Location**: `worker.js` transcription/SOP generation
**Impact**: Most common, has built-in retry logic

### 4. Database & Storage Errors
**Location**: All API routes, worker operations
**Impact**: Data consistency issues

### 5. Visualization Errors (ReactFlow)
**Location**: `components/sop/`, `lib/sop-utils.ts`
**Impact**: UI degradation, fallback needed

## 🔄 Retry Logic Implementation

### AI Processing Retry Strategy (worker.js)
```javascript
// VERIFIED IMPLEMENTATION - worker.js:300-370

async function transcribeVideo(videoPath) {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let transcriptData = null;
  
  while (attempt < MAX_RETRIES && !transcriptData) {
    attempt++;
    console.log(`Transcription attempt ${attempt}...`);
    
    try {
      const result = await model.generateContent([
        TRANSCRIPTION_PROMPT,
        { inlineData: { mimeType: "video/mp4", data: base64Video } }
      ]);
      
      const response = await result.response;
      const text = response.text();
      
      // JSON cleanup and validation
      let cleanedText = text.replace(/```json\\n|\\n```|```/g, '');
      transcriptData = JSON.parse(cleanedText.trim());
      
    } catch (error) {
      console.error(`Error during Gemini API transcription (attempt ${attempt}):`, error);
    }
    
    // Wait between retries (except last attempt)
    if (!transcriptData && attempt < MAX_RETRIES) {
      console.log(`Waiting 5 seconds before retry ${attempt + 1}...`);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  if (!transcriptData) {
    console.error(`Failed to transcribe video after ${MAX_RETRIES} attempts`);
    return null; // Causes job to fail with error status
  }
  
  return transcriptData;
}
```

### Key Retry Characteristics
- **Max Attempts**: 3 per AI operation  
- **Backoff Strategy**: Fixed 5-second delay
- **Error Types**: JSON parsing errors, API errors, network timeouts
- **Fallback**: Alternative JSON extraction patterns
- **Final Failure**: Job marked as 'error' status

## 🎯 Error Handling Patterns by Component

### Frontend Upload Validation (app/page.tsx)
```typescript
// File size and duration validation
const MAX_FILE_SIZE = 750 * 1024 * 1024; // 750MB
const MAX_DURATION = 20 * 60; // 20 minutes

const validateFile = (file: File): Promise<string | null> => {
  return new Promise((resolve) => {
    // Size check
    if (file.size > MAX_FILE_SIZE) {
      resolve('File too large. Maximum size is 750MB.');
      return;
    }
    
    // Duration check via HTML5 video element
    const video = document.createElement('video');
    video.onloadedmetadata = () => {
      if (video.duration > MAX_DURATION) {
        resolve('Video too long. Maximum duration is 20 minutes.');
      } else {
        resolve(null); // Valid
      }
    };
    video.onerror = () => resolve('Invalid video file.');
    video.src = URL.createObjectURL(file);
  });
};
```

### Upload Progress Error Handling
```typescript
// XMLHttpRequest error handlers
xhr.onload = async () => {
  if (xhr.status >= 200 && xhr.status < 300) {
    // Success path
    setUploadProgress(100);
    await queueJob(jobId);
  } else {
    throw new Error('Failed to upload file');
  }
};

xhr.onerror = () => {
  throw new Error('Network error occurred during upload');
};

xhr.ontimeout = () => {
  throw new Error('Upload timed out. Please try again.');
};
```

### API Route Error Standardization
```typescript
// Standard error response pattern (api routes)
try {
  // Operation logic
} catch (error) {
  console.error('Operation failed:', error);
  return NextResponse.json(
    { error: 'Human-readable error message' },
    { status: 500 }
  );
}
```

### Worker Job Processing Error Recovery
```javascript
// worker.js processJob() error handling
async function processJob(job) {
  const jobId = job.job_id;
  
  try {
    // Multi-stage processing with progress updates
    await updateJobStatus(jobId, 'processing', null, 'preparing_video', 10);
    const rawVideoPath = await downloadVideo(jobId);
    
    await updateJobStatus(jobId, 'processing', null, 'transcribing', 50);
    const sopData = await extractSopFromVideo(slimVideoPath, jobId);
    
    await updateJobStatus(jobId, 'processing', null, 'finalizing', 90);
    await saveSopToDatabase(jobId, sopData);
    
    await updateJobStatus(jobId, 'completed');
    cleanupTempFiles(jobId);
    
  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);
    await updateJobStatus(jobId, 'error', error.message);
    cleanupTempFiles(jobId); // Always cleanup on error
  }
}
```

## 🔍 Error Detection & Monitoring

### Worker Health Monitoring
```javascript
// Current polling with basic error detection
setInterval(async () => {
  try {
    await processJobs(); // Main worker loop
  } catch (error) {
    console.error('Worker loop error:', error);
    // Continue running despite errors
  }
}, POLL_INTERVAL);
```

### Database Connection Health
```javascript
// Test database connectivity (test-worker.js pattern)
const testDatabaseHealth = async () => {
  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('count(*)', { count: 'exact', head: true });
    
    if (error) {
      console.error('Database health check failed:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Database connection error:', err);
    return false;
  }
};
```

### AI API Health Monitoring
```javascript
// Basic Gemini API connectivity test
const testGeminiHealth = async () => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
    const result = await model.generateContent("Test prompt");
    return true;
  } catch (error) {
    console.error('Gemini API health check failed:', error);
    return false;
  }
};
```

## 🚨 Critical Failure Scenarios

### 1. Complete Gemini API Failure
**Symptoms**: All jobs stuck in 'transcribing' or 'parsing_sop' stage
**Detection**: Multiple consecutive API failures  
**Current Handling**: Jobs marked as 'error' after 3 attempts
**Recommendation**: Add circuit breaker pattern

### 2. Database Connection Loss
**Symptoms**: Worker polls fail, API routes return 500 errors
**Detection**: Supabase client throws connection errors
**Current Handling**: Worker continues trying, no graceful degradation
**Recommendation**: Add connection health checks and alerts

### 3. Storage Quota Exceeded  
**Symptoms**: Upload fails after signed URL generation
**Detection**: Storage PUT requests fail with quota errors
**Current Handling**: User sees upload error
**Recommendation**: Add quota monitoring and warnings

### 4. Worker Process Crash
**Symptoms**: Jobs stuck in 'queued' status indefinitely
**Detection**: No job status updates for extended period
**Current Handling**: Manual restart required
**Recommendation**: Add process monitoring and auto-restart

## 🛠️ Recovery Procedures

### Manual Job Recovery
```sql
-- Find stuck jobs
SELECT job_id, status, progress_stage, created_at 
FROM jobs 
WHERE status = 'processing' 
  AND updated_at < NOW() - INTERVAL '1 hour';

-- Reset stuck job for retry
UPDATE jobs 
SET status = 'queued', progress_stage = NULL, progress_percent = NULL
WHERE job_id = 'your-job-id';

-- Delete failed job (if unrecoverable)
DELETE FROM jobs WHERE job_id = 'failed-job-id';
```

### Worker Restart Procedure
```bash
# Check worker status
ps aux | grep "node worker.js"

# Kill stuck worker
pkill -f "node worker.js"

# Restart worker with logging
cd app_frontend
npm run worker > worker.log 2>&1 &

# Monitor worker health
tail -f worker.log
```

### Storage Cleanup (if needed)
```javascript
// Clean up orphaned storage files
const cleanupOrphanedFiles = async () => {
  const { data: files } = await supabase.storage
    .from('videos')
    .list('raw');
    
  const validJobIds = new Set(
    (await supabase.from('jobs').select('job_id')).data.map(j => j.job_id)
  );
  
  for (const file of files) {
    const jobId = file.name.replace('.mp4', '');
    if (!validJobIds.has(jobId)) {
      await supabase.storage.from('videos').remove([`raw/${file.name}`]);
    }
  }
};
```

## 📈 Error Prevention Strategies

### Input Validation Enhancement
```typescript
// Enhanced file validation (recommended addition)
const validateVideoFile = async (file: File) => {
  // Check file signature (magic bytes)
  const buffer = await file.slice(0, 12).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  
  // MP4 file signature detection
  const isMP4 = bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70;
  
  if (!isMP4) {
    throw new Error('File must be MP4 format');
  }
};
```

### Rate Limiting (recommended addition)
```typescript
// API endpoint rate limiting
const rateLimiter = new Map();

const checkRateLimit = (clientId: string, maxRequests = 10, windowMs = 60000) => {
  const now = Date.now();
  const clientRequests = rateLimiter.get(clientId) || [];
  
  // Filter requests within window
  const validRequests = clientRequests.filter(timestamp => now - timestamp < windowMs);
  
  if (validRequests.length >= maxRequests) {
    throw new Error('Rate limit exceeded');
  }
  
  validRequests.push(now);
  rateLimiter.set(clientId, validRequests);
};
```

### Circuit Breaker Pattern (recommended)
```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureThreshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.nextAttempt = Date.now();
  }
  
  async call(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error('Circuit breaker is OPEN');
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
  
  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
    }
  }
}
```

## 🔧 Debugging Tools & Commands

### Worker Debug Commands
```bash
# Run worker with debug logging
DEBUG=* npm run worker

# Test specific job processing
node -e "
const { processSpecificJob } = require('./worker.js');
processSpecificJob('job-id-here');
"

# Check worker process health
curl -f http://localhost:3000/api/health || echo "API unhealthy"
```

### Database Debug Queries
```sql
-- Current job queue status
SELECT 
  status, 
  COUNT(*) as count,
  MIN(created_at) as oldest,
  MAX(created_at) as newest
FROM jobs 
GROUP BY status;

-- Error analysis
SELECT 
  error,
  COUNT(*) as frequency
FROM jobs 
WHERE status = 'error' 
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY error
ORDER BY frequency DESC;

-- Processing time analysis
SELECT 
  AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - created_at))) as max_seconds
FROM jobs 
WHERE status = 'completed' 
  AND completed_at IS NOT NULL;
```

### Frontend Error Tracking
```typescript
// Enhanced error reporting (recommended)
const reportError = async (error: Error, context: string) => {
  console.error(`[${context}]`, error);
  
  // Could integrate with error tracking service
  await fetch('/api/errors', {
    method: 'POST',
    body: JSON.stringify({
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    })
  });
};
```

---

## 🎯 Quick Error Resolution Checklist

### Upload Issues
- [ ] Check file size < 750MB and duration < 20min
- [ ] Verify `.env.local` has correct Supabase keys
- [ ] Test `GET /api/get-upload-url` responds 
- [ ] Check browser network tab for CORS errors
- [ ] Verify storage bucket exists and has correct policies

### Processing Issues  
- [ ] Check worker is running (`ps aux | grep worker`)
- [ ] Verify Gemini API key with `node test-gemini.js`
- [ ] Check job status in database
- [ ] Review worker terminal logs for specific errors
- [ ] Test database connectivity with `node test-db.js`

### Visualization Issues
- [ ] Check browser console for ReactFlow errors
- [ ] Verify SOP data structure via `/api/sop/[sopId]`
- [ ] Test data transformation functions
- [ ] Check node type registration in `SOPFlowView.tsx`

**Last Updated**: Dec 2024 | **Status**: Based on comprehensive codebase analysis 