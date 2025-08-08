# Token Count Analysis: Character vs Token Discrepancy

## Issue Summary

The user observed:
- **Character count**: 36k → 37k (only 1k increase)
- **Token count**: 19.7k → 30.5k (11k increase!)

This discrepancy is caused by the **encrypted reasoning context** that's being loaded and sent with every request when using reasoning models (o4-mini).

## Root Cause

When using OpenAI's reasoning models (o4-mini, o3), the system:

1. **Stores encrypted reasoning context** after each API response
2. **Loads the last 5 turns** of encrypted context for every new message
3. **Sends all encrypted context** with each API request

### The Code Path

```javascript
// In directorService.js - processWithResponsesAPI()
const encryptedContext = await this.loadReasoningContext(workflowId);

// Build initial input array
const initialInput = [
  ...encryptedContext,  // ← THIS IS THE CULPRIT!
  ...userMessages.map(msg => ({
    type: 'message',
    role: msg.role,
    content: msg.content
  }))
];
```

### What's in the Encrypted Context?

From the database analysis:
- Each turn contains **6-12KB of encrypted data**
- Loading last 5 turns = **~31KB of encrypted content**
- This equals approximately **7,900 tokens**

## Token Multiplication Breakdown

Here's what happens when the user sends a new message:

### Visible to User:
- New message: 1KB (250 tokens)
- Character count: 36k → 37k ✓

### Actually Sent to OpenAI:
1. System prompt: ~10KB (2,500 tokens)
2. Conversation history: ~25KB (6,250 tokens)  
3. **Encrypted reasoning context: ~31KB (7,900 tokens)** ← Hidden from debug_input
4. New user message: 1KB (250 tokens)

**Total**: ~67KB → **16,900 tokens**

### Why the 11k Jump?
- Previous message already included encrypted context from turns 1-4
- New message adds turn 5's encrypted context
- Plus re-sends all previous encrypted contexts
- Result: **Exponential growth** in token usage

## Debug Input Limitation

The `debug_input` in the response only shows:
```javascript
const debugInput = {
  messages: messages,  // Does NOT include encryptedContext
  model: model,
  total_chars: JSON.stringify(messages).length,
  // ...
};
```

It's missing the encrypted context that's added in `processWithResponsesAPI()`.

## Solutions

### 1. Immediate Fix - Reduce Context Window
```javascript
// In loadReasoningContext()
.limit(2); // Instead of .limit(5)
```
This would reduce encrypted context from ~31KB to ~12KB.

### 2. Add Encrypted Context to Debug
```javascript
// In processWithResponsesAPI()
const debugInput = {
  messages: messages,
  encrypted_context_size: JSON.stringify(encryptedContext).length,
  encrypted_context_items: encryptedContext.length,
  total_api_payload_size: JSON.stringify([...encryptedContext, ...messages]).length,
  // ...
};
```

### 3. Context Management Options

#### Option A: Selective Loading
Only load encrypted context when needed:
```javascript
const shouldLoadContext = recursionDepth > 0 || hasToolCalls;
const encryptedContext = shouldLoadContext ? 
  await this.loadReasoningContext(workflowId) : [];
```

#### Option B: Context Compression
Implement a compression strategy for older turns:
```javascript
// Keep full context for recent turns, compress older ones
const recentTurns = 2;
const compressedOlderTurns = await this.compressReasoningContext(workflowId, recentTurns);
```

#### Option C: Context Clearing
Add a method to clear reasoning context:
```javascript
async clearReasoningContext(workflowId) {
  await this.supabase
    .from('reasoning_context')
    .delete()
    .eq('workflow_id', workflowId);
}
```

### 4. Alternative Model
Use non-reasoning models (gpt-4, gpt-4-turbo) which don't require encrypted context:
```javascript
// In .env
DIRECTOR_MODEL=gpt-4-turbo-preview
```

## Verification

To verify this analysis:

1. Check the exact size of encrypted context:
```bash
node analyze-tokens.js
```

2. Monitor token usage in real-time:
```bash
# In one terminal
tail -f logs/director.log | grep "REASONING_CONTEXT"

# In another, send a message and watch the token counts
```

3. Test with reduced context:
- Temporarily change `.limit(5)` to `.limit(1)` in `loadReasoningContext()`
- Send a message and observe the token count difference

## Recommendations

1. **Short term**: Reduce context limit from 5 to 2 turns
2. **Medium term**: Implement context compression for older turns
3. **Long term**: Add UI controls for context management (clear, limit, disable)
4. **Monitoring**: Add encrypted context size to debug_input for transparency

The key insight is that **encrypted reasoning context is invisible in debug_input but significantly impacts token usage**, causing the observed discrepancy between character and token counts.