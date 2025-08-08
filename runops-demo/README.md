# Runops Frontend

The Runops frontend is a Next.js application that handles video uploads, SOP visualization, and editing.

## Getting Started

First, install dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Architecture

The application is structured as follows:

- `/app` - Next.js App Router for pages and API routes
- `/components` - Reusable React components
- `/lib` - Utility functions and types
- `/public` - Static assets
- `/docs` - Documentation

## API Endpoints

### SOP API

The SOP API provides endpoints for retrieving and editing SOPs.

#### GET /api/sop/[sopId]

Retrieves a SOP document from the database.

```typescript
// Example usage
const response = await fetch(`/api/sop/${sopId}`);
const data = await response.json();
```

#### PATCH /api/sop/[sopId]

Updates a SOP document. Supports two operations:
- Update step titles/properties
- Delete steps

```typescript
// Example for updating a step title
await fetch(`/api/sop/${sopId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'update',
    nodeId: 'node123',
    updates: {
      label: 'New Step Title'
    }
  })
});

// Example for deleting a step
await fetch(`/api/sop/${sopId}`, {
  method: 'PATCH',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    type: 'delete',
    nodeId: 'node123'
  })
});
```

For more detailed API documentation, see [API_Reference.md](./docs/API_Reference.md).

## Background Worker

The application includes a background worker for processing uploaded videos. To run the worker:

```bash
npm run worker
```

For more information about the worker, see [WorkerInstructions.md](./docs/WorkerInstructions.md).

## Development Notes

### Authentication

Authentication is not currently implemented but will be added in Ticket 1.8. The API routes currently don't require authentication but will in the future.

### Testing

To test the SOP API endpoints, you need a valid SOP ID (which is the job_id of a completed job). You can get this by:

1. Uploading a video on the main page
2. Waiting for processing to complete
3. Using the ID from the URL in the SOP viewer page

## Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.io/docs)
- [ReactFlow Documentation](https://reactflow.dev/docs) 