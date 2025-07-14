# Context Compression 2.0: Pragmatic Implementation

## Overview

This document outlines the context compression strategy for Clean Context 2.0. We're taking a pragmatic approach that balances simplicity with effectiveness for dogfooding.

## The Approach: One-Time 7-Part Context Injection

When the user manually triggers compression, we:

1. **Start fresh** - No `previous_response_id` (clean slate)
2. **Inject 7-part context once** - Reuse existing `buildDirector2Context()`
3. **Resume clean flow** - All subsequent messages use stateful context

## Implementation

### Manual Compression Handler

```javascript
async handleManualCompress(workflowId) {
  // 1. Build the familiar 7-part context
  const director2Context = await this.buildDirector2Context(workflowId);
  
  // 2. Start fresh conversation (no previous_response_id)
  const response = await this.openai.responses.create({
    model: selectedModel,
    instructions: CLEAN_SYSTEM_PROMPT,
    input: [{
      type: 'message',
      role: 'user',
      content: `[CONTEXT COMPRESSED - Starting Fresh]

${director2Context}

Continue working on this workflow. Use context retrieval tools as needed for any additional details.`
    }],
    tools: responsesTools,
    store: true  // Start new chain
  });
  
  // 3. Clear old chain, start new
  await this.clearResponseId(workflowId);
  await this.saveResponseId(workflowId, response.id);
  
  // 4. Mark messages as archived (optional)
  await this.archiveMessagesBeforeCompression(workflowId);
  
  return response;
}
```

### Why This Approach?

1. **Simplicity**: Reuses existing, tested context building
2. **Comprehensive**: 7-part context provides complete state transfer
3. **One-time cost**: ~3-5k tokens only on compression
4. **Clean afterwards**: Subsequent messages use pure stateful approach
5. **Pragmatic**: Good enough for dogfooding, can optimize later

### What Happens After Compression

**First Message (Compression)**:
```
System Prompt
+ 
User: [CONTEXT COMPRESSED - Starting Fresh]
(2) WORKFLOW DESCRIPTION
...
(7) COMPRESSED CONTEXT HISTORY

Continue working on this workflow...
```

**All Subsequent Messages**:
```
System Prompt
+
previous_response_id: [fresh chain ID]
+
User: [normal message]
```

The Director can then use context retrieval tools (`get_workflow_summary`, `get_workflow_nodes`, etc.) whenever it needs specific information.

### Compression Triggers

For dogfooding, compression is **manual only**:
- User clicks "Compress Context" button
- System performs compression as described above
- User sees confirmation and continues chatting

### Future Considerations

Once we validate this approach works well, we could:

1. **Trim the context**: Maybe only include parts 2-5, skip compressed history
2. **Auto-compress**: Based on token count or message count
3. **Checkpoint system**: Store compression points for rollback
4. **Selective context**: Let model choose which parts it needs

But for now, we keep it simple: full 7-part context, once, on manual trigger.

## Benefits

- **No new code needed**: Reuses `buildDirector2Context()`
- **Predictable behavior**: Director gets full context to work with
- **Clean token usage**: After injection, back to efficient stateful flow
- **Easy rollback**: If it doesn't work well, easy to modify

## Example Flow

```
[User has been chatting for 50+ messages]

User: [Clicks Compress Context]

System: [Builds 7-part context]
        [Starts fresh conversation with context injection]
        [Clears old response_id chain]

Director: I see we're working on a Gmail automation workflow with 15 nodes built so far. 
          The current phase is email extraction. I'll continue from here.

User: Add validation to the email parser

Director: I'll add email validation. Let me first check the current email parser implementation.
          [Uses get_workflow_nodes tool to get details]

[Conversation continues with clean stateful flow]
```

## Implementation Priority

1. Add compression handler to `directorService.js`
2. Add API endpoint in `director.js` routes
3. Add "Compress Context" button to UI
4. Test with real workflows

This pragmatic approach gets us testing quickly while maintaining the benefits of Clean Context 2.0.