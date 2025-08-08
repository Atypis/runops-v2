# Message Editing & Forking Test Guide

## Overview
This feature allows users to edit their previous messages and fork the conversation from that point, creating a new conversation branch while preserving the original context.

## Implementation Summary

### Backend:
1. **Database Changes** - Added columns to conversations table:
   - `response_id` - Links messages to OpenAI response IDs
   - `previous_response_id` - Tracks fork points
   - `is_active` - Marks active vs forked-over messages

2. **Response ID Tracking** - Assistant messages now store their response IDs
3. **Fork Endpoint** - `/api/director/workflows/:id/fork` handles message editing

### Frontend:
1. **Edit UI** - Pencil icon on hover for user messages
2. **Inline Editing** - Edit in place with Save & Regenerate
3. **Automatic Cleanup** - Old messages marked inactive after fork

## Testing Instructions

### 1. Basic Message Editing
1. Start a conversation with the Director
2. Send at least 2-3 messages to build context
3. Hover over any of your previous messages
4. Click the pencil icon that appears
5. Edit the message and click "Save & Regenerate"
6. Verify:
   - Messages after the edit point disappear
   - Director responds to the edited message
   - Context is maintained from before the edit

### 2. Fork with Tool Execution
1. Send a message that triggers tool calls (e.g., "Create a node called test")
2. After completion, edit an earlier message
3. Verify:
   - The fork works correctly
   - New tools execute based on edited context
   - Old tool results don't interfere

### 3. Multiple Edits
1. Edit a message and get a response
2. Edit an even earlier message
3. Verify:
   - Each edit creates a clean fork
   - No "No tool output found" errors
   - Conversation flows naturally

### 4. Edge Cases
1. **Edit First Message**: Edit your very first message in a conversation
2. **Cancel Edit**: Start editing and click Cancel
3. **Empty Edit**: Try to save an empty message (should be disabled)
4. **Edit During Loading**: Try to edit while Director is responding

## Expected Behavior

- ✅ Only user messages can be edited
- ✅ Edit button appears on hover
- ✅ Editing preserves message history up to edit point
- ✅ Fork uses correct response ID for context
- ✅ Old messages marked inactive (not deleted)
- ✅ No errors about missing tool outputs

## Known Limitations

1. **Historical Messages**: Only new messages (with response IDs) support forking
2. **Side Effects**: Tool executions (like create_node) persist even after forking
3. **Visual History**: Forked-over messages are hidden (not shown as alternate branch)

## Troubleshooting

If you see "No tool output found" errors:
1. The message might not have a response ID (old conversation)
2. Check browser console for fork endpoint errors
3. Verify the database migration was applied

## Technical Notes

- Fork uses OpenAI's `previous_response_id` parameter
- Response IDs are saved only for final responses (no pending tools)
- Deactivated messages remain in database with `is_active = false`