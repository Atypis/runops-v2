# API Reference

This document provides information on the available API endpoints in the Runops application.

## Authentication

Most API endpoints require authentication. To authenticate requests, include a valid JWT from Supabase Auth in the cookies. The frontend handles this automatically when using `createClientComponentClient` or `createRouteHandlerClient`.

Authentication is implemented using Supabase Auth with Google OAuth. The application includes:

- JWT-based authentication via cookies (handled by Supabase Auth)
- Protected routes that require authentication (via Next.js middleware)
- Row Level Security (RLS) policies to ensure users can only access their own data

Unauthenticated requests to protected API endpoints will receive a 401 Unauthorized response.

## Cache Control

All API endpoints include strong cache control headers to prevent stale data:

```
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
Pragma: no-cache
Expires: 0
```

When making requests to these endpoints, the frontend adds cache-busting query parameters to ensure fresh data is always returned.

## SOP API Endpoints

### GET /api/sop/[sopId]

Retrieves a SOP document from the database.

**Parameters:**
- `sopId`: UUID of the SOP to retrieve (this is the same as the job_id)

**Response:**
```json
{
  "id": 1,
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "data": {
    "meta": {
      "id": "sop-123",
      "title": "Email Processing Workflow",
      "version": "1.0",
      "goal": "Process incoming emails efficiently",
      "purpose": "Streamline email management",
      "owner": ["user@example.com"]
    },
    "public": {
      "triggers": [],
      "nodes": [],
      "edges": [],
      "variables": {},
      "clarification_requests": []
    },
    "private": {
      "skills": [],
      "steps": [],
      "artifacts": []
    }
  },
  "created_at": "2025-05-21T10:15:30.123Z",
  "updated_at": "2025-05-21T10:15:30.123Z",
  "user_id": "d4af97b1-4994-41fe-8635-19d539afb4a2"
}
```

**Error Responses:**
- `404`: SOP not found
- `400`: Missing SOP ID
- `500`: Server error

### PATCH /api/sop/[sopId]

Updates a SOP document in the database. Supports two operations:
1. Update step title/properties
2. Delete a step

**Parameters:**
- `sopId`: UUID of the SOP to update (this is the same as the job_id)

**Request Body (Update):**
```json
{
  "type": "update",
  "nodeId": "node123",
  "updates": {
    "label": "New Step Title",
    "intent": "Updated intent for this step"
  }
}
```

**Request Body (Delete):**
```json
{
  "type": "delete",
  "nodeId": "node123"
}
```

**Response:**
Returns the updated SOP data in the same format as the GET endpoint.

**Error Responses:**
- `404`: SOP not found or node not found
- `400`: Invalid request body
- `500`: Server error

## Job Status API Endpoints

### GET /api/job-status/[jobId]

Retrieves the status of a video processing job.

**Parameters:**
- `jobId`: UUID of the job to check

**Response:**
```json
{
  "status": "completed",
  "job_id": "123e4567-e89b-12d3-a456-426614174000",
  "created_at": "2025-05-21T10:00:00.000Z",
  "updated_at": "2025-05-21T10:15:30.123Z",
  "completed_at": "2025-05-21T10:15:30.123Z"
}
```

Possible status values: `queued`, `processing`, `completed`, `error`

**Error Responses:**
- `404`: Job not found
- `500`: Server error

## Upload API Endpoints

### POST /api/get-upload-url

Generates a signed URL for uploading a video file to Supabase Storage.

**Response:**
```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000",
  "url": "https://example.com/signed-upload-url"
}
```

**Error Responses:**
- `500`: Failed to generate signed URL

### POST /api/queue-job

Queues a video processing job after the file has been uploaded.

**Request Body:**
```json
{
  "jobId": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Response:**
```json
{
  "status": "queued",
  "job_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Error Responses:**
- `400`: Missing job ID
- `404`: Uploaded file not found
- `500`: Server error 