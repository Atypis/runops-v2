# Frontend Refresh Issue After delete_nodes

## Problem
1. After deleting nodes, the frontend doesn't automatically update
2. Node positions appear incorrect (shows 1,3 instead of 1,2 after deleting node 2)

## Root Cause
- Frontend polls for updates every 10 seconds (setInterval in app.js)
- No real-time update mechanism for workflow/node changes (unlike browser state which uses SSE)
- Backend correctly updates positions but frontend shows cached data

## Current State
- Backend: ✅ Correctly deletes nodes, updates dependencies, recalculates positions
- Frontend: ❌ Shows stale data until manual page refresh

## Solutions

### Option 1: Quick Fix (User Education)
Add a message in the delete_nodes response telling the Director to inform the user:
```javascript
{
  refreshRequired: true,
  message: "Successfully deleted nodes. Please refresh the page to see updated positions."
}
```

### Option 2: Implement SSE for Workflow Updates (Recommended)
Similar to browser state updates, implement Server-Sent Events for workflow changes:

1. Add SSE endpoint: `/workflows/:id/updates/stream`
2. Create WorkflowUpdateService to manage SSE connections
3. Emit events on: create_node, update_node, delete_node operations
4. Frontend subscribes and updates React state in real-time

### Option 3: Force Polling on Delete
Add a special response flag that triggers immediate frontend refresh:
```javascript
// In Director response handling
if (result.refreshRequired) {
  loadWorkflowNodes(currentWorkflow.id);
}
```

## Implementation Status
- Added `refreshRequired: true` flag to delete_nodes response
- Added descriptive message about what happened
- Director can now communicate to user that a refresh may be needed

## Next Steps
For a complete solution, implement Option 2 (SSE for workflow updates) to match the real-time browser state updates already in place.