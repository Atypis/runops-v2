# Context Compression Feature

## Overview

The Context Compression feature allows users to compress conversation history to manage token usage while preserving continuity for the Director AI. This feature is essential for long-running workflows where conversation history can grow large and consume excessive tokens.

## How It Works

### User Interface

1. **Compress Button**: Located above the input area in the chat interface
   - Shows with a lightning bolt icon (⚡)
   - Only visible when there are messages to compress

2. **Confirmation Modal**: 
   - Shows accurate count of messages to be compressed
   - Indicates if building on previous compression
   - Clearly states the action cannot be undone

### Compression Process

#### 1. Message Selection
The system intelligently selects which messages to compress:
- **Includes**: All non-archived messages since the last compression
- **Excludes**: Previously archived messages and existing compression summaries
- **Result**: Only new conversation content is compressed

#### 2. Summary Generation
The Director creates a comprehensive summary that:
- Builds on any previous compression summary
- Captures the complete journey and context
- Preserves key decisions, problems, and solutions
- Maintains continuity for future Director instances

#### 3. Message Archival
After compression:
- Compressed messages are marked as `is_archived = true`
- Archived messages remain visible but greyed out
- A new compression summary message is added

### Database Schema

#### compressed_contexts Table
```sql
CREATE TABLE compressed_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  original_message_count INTEGER NOT NULL,
  compression_ratio FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'manual'
);
```

#### conversations Table
Added column:
```sql
is_archived BOOLEAN DEFAULT FALSE
```

### Director Context Building

The Director receives conversation context in two ways:

1. **Conversation History**: Non-archived messages in the chat flow
2. **Part 7 of Context**: Compressed summary from the database

This ensures the Director sees:
- The compressed summary of old conversations
- All messages since the last compression
- No duplicate information

## Implementation Details

### Frontend (app.js)

#### Message Filtering for Director
```javascript
const cleanConversationHistory = messages
  .filter(msg => {
    if (msg.isArchived) return false;  // Exclude archived
    if (msg.isCompressed) return false; // Exclude compressed summary
    return true;
  })
```

#### Compression Confirmation
Shows accurate message count:
```javascript
messages.filter(m => !m.isArchived && !m.isCompressed && 
                    (m.role === 'user' || m.role === 'assistant')).length
```

### Backend (routes/director.js)

#### Compression Endpoint
1. Queries only non-archived messages
2. Loads previous compression for context
3. Creates unified summary
4. Archives only the compressed messages

```javascript
// Get only messages since last compression
const { data: conversationHistory } = await directorService.supabase
  .from('conversations')
  .select('*')
  .eq('workflow_id', workflowId)
  .eq('is_archived', false)
  .order('timestamp', { ascending: true });
```

### Director Service (directorService.js)

#### Context Building (Part 7)
```javascript
// Load the latest compressed context if exists
const { data: compressedContext } = await this.supabase
  .from('compressed_contexts')
  .select('summary, original_message_count, created_at')
  .eq('workflow_id', workflowId)
  .order('created_at', { ascending: false })
  .limit(1)
  .single();
```

## Benefits

1. **Token Efficiency**: Reduces token usage by compressing old messages
2. **Context Preservation**: Maintains full conversation context through summaries
3. **Incremental Compression**: Each compression builds on the previous one
4. **User Reference**: Old messages remain visible for user reference
4. **No Information Loss**: Director maintains complete understanding

## Usage Example

### First Compression
- User has 20 messages in conversation
- Clicks compress → All 20 messages compressed
- Creates Summary A
- Messages 1-20 marked as archived

### Second Compression
- User adds 10 more messages (21-30)
- Clicks compress → Only messages 21-30 compressed
- Creates Summary B that incorporates Summary A
- Messages 21-30 marked as archived

### Director's View After Second Compression
- Part 7: Summary B (includes context from A + messages 21-30)
- Conversation History: Any new messages after compression (31+)

## Best Practices

1. **When to Compress**:
   - When approaching token limits
   - After completing major workflow phases
   - Before starting new complex tasks

2. **What Gets Preserved**:
   - All workflow state and variables
   - Created nodes and configurations
   - Key decisions and rationale
   - Problems encountered and solutions

3. **What to Avoid**:
   - Compressing too frequently (loses conversational flow)
   - Compressing during active problem-solving
   - Compressing before Director completes current task

## Technical Notes

- Compression is irreversible (messages cannot be unarchived)
- Each compression builds on previous compressions
- The system prevents re-compressing already compressed content
- Compressed summaries are stored separately from conversation messages
- Frontend and backend coordinate to ensure proper message filtering

## Future Enhancements

Potential improvements for consideration:
- Automatic compression based on token thresholds
- Compression preview (see summary before confirming)
- Selective compression (choose which messages to compress)
- Compression history viewer
- Export compressed summaries