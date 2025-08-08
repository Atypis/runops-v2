# Prompt Analysis: Director Input Context Structure

## Overview
This document analyzes the exact structure of messages sent to OpenAI's API, breaking down each element to understand where content originates and how it's assembled.

## Hierarchical Structure Analysis

### Top Level Structure
```
{
  "messages": [...],         // Array of message objects
  "model": "o4-mini",        // Model identifier
  "total_chars": 75120,      // Total character count
  "total_messages": 4,       // Number of messages
  "message_breakdown": [...], // Summary of each message
  "timestamp": "2025-07-04T15:43:33.947Z"  // When this was sent
}
```

### Messages Array Breakdown

#### Message 0 (System)
```
{
  "role": "system",
  "content": "You are the Director - an AI assistant..."
}
```
- **Origin**: DIRECTOR_SYSTEM_PROMPT from `/backend/prompts/directorPrompt.js`
- **Size**: 33,505 characters
- **When Added**: Fresh on every API call

#### Message 1 (User - First)
```
{
  "role": "user",
  "content": "Please build a small workflow..."
}
```
- **Origin**: User's original input from chat interface
- **Size**: 147 characters (pure user input)
- **When Added**: From frontend `sendMessage()` function

#### Message 2 (Assistant - First Response)
```
{
  "role": "assistant",
  "content": "I've drafted the plan...",
  "reasoning": null,
  "isTemporary": false,
  "toolCalls": [...],
  "tokenUsage": {...},
  "debug_input": {...}
}
```
- **Origin**: Director's first response (stored in conversation history)
- **Size**: 395 characters
- **Additional Fields**: 
  - `reasoning`: From reasoning API (null here)
  - `isTemporary`: Frontend state flag
  - `toolCalls`: Tool execution results
  - `tokenUsage`: Token metrics
  - `debug_input`: Our debugging data (nested structure)

##### Nested debug_input Structure
```
"debug_input": {
  "messages": [
    {
      "role": "system",
      "content": "{SYSTEM PROMPT}"
    },
    {
      "role": "user", 
      "content": "{USER MESSAGE + DIRECTOR 2.0 CONTEXT}"
    }
  ],
  "model": "o4-mini",
  "total_chars": 36613,
  "total_messages": 2,
  "message_breakdown": [...],
  "timestamp": "..."
}
```

**KEY OBSERVATION**: The user message in debug_input shows the ACTUAL content sent to OpenAI for the first request:
- User's input: "Please build a small workflow..."
- PLUS Director 2.0 context appended:
  - "(2) CURRENT PLAN\nNo plan created yet..."
  - "(3) WORKFLOW SNAPSHOT\nNo nodes created yet..."
  - "(4) WORKFLOW VARIABLES\nNo variables stored yet..."
  - "(5) BROWSER STATE & CONTEXT METRICS..."
  - "Available credentials:\nGMAIL_EMAIL:...\nGMAIL_PASSWORD:..."

#### Message 3 (User - Second)
```
{
  "role": "user",
  "content": "good please now build the workflow\n\n(2) CURRENT PLAN..."
}
```
- **Origin**: User's second input + Director 2.0 context
- **Size**: 734 characters
- **Composition**:
  - User typed: "good please now build the workflow"
  - System appended: Full Director 2.0 context

## Critical Findings

### 1. Message Assembly Flow
```
Frontend (user types) 
    → Backend receives message
    → buildDirector2Context() appends context
    → Combined message sent to OpenAI
    → Response stored in conversation history
    → Next request includes full history
```

### 2. Context Duplication Issue
- First request: System prompt + User message + Director 2.0 context
- Second request: System prompt + Full conversation history + User message + NEW Director 2.0 context
- The conversation history ALREADY contains the previous Director 2.0 context embedded in user messages

### 3. What OpenAI Actually Sees
**YES**, this is EXACTLY what OpenAI receives. No filtering by OpenAI. The `messages` array is sent as-is to the API.

## Code-Level Analysis

### Where Director 2.0 Context is Built

#### 1. In DirectorService.processMessage() (lines 89-105)
```javascript
// Build Director 2.0 context if workflowId provided
let director2Context = '';
if (workflowId) {
  director2Context = await this.buildDirector2Context(workflowId);
}

// Build messages array
const messages = [
  { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
  ...conversationHistory.filter(msg => msg.content !== null && msg.content !== undefined),
  { role: 'user', content: message }
];

// Add Director 2.0 context to the latest message if available
if (director2Context) {
  messages[messages.length - 1].content += `\n\n${director2Context}`;
}
```

#### 2. The buildDirector2Context() Method (lines 862-931)
Builds the 5-part context structure:

- **(2) CURRENT PLAN**: From `planService.getCurrentPlan()`
- **(3) WORKFLOW SNAPSHOT**: From `getWorkflowContext()`
- **(4) WORKFLOW VARIABLES**: From `variableManagementService.getFormattedVariables()`
- **(5) BROWSER STATE**: Placeholder + reasoning token metrics

### The Context Accumulation Problem

#### Turn 1:
```
User types: "Please build a small workflow..."
Backend appends: Director 2.0 context
Sent to OpenAI: User message + Director 2.0 context
```

#### Turn 2:
```
conversationHistory contains:
  - Message 1: "Please build..." + Director 2.0 context (from Turn 1)
  - Message 2: Assistant response

User types: "good please now build the workflow"
Backend appends: NEW Director 2.0 context
Sent to OpenAI: 
  - System prompt
  - Message 1 WITH old Director 2.0 context
  - Assistant response
  - New user message WITH new Director 2.0 context
```

### The Root Issue

The `conversationHistory` from the frontend **already contains** the Director 2.0 context embedded in previous user messages. When we append a new Director 2.0 context, we're not removing the old one from history.

## Frontend Conversation History Analysis

### Critical Finding: Frontend Stores Clean Messages!

The frontend stores the **user's original input**, NOT the modified version with Director 2.0 context.

#### Proof from Code:

1. **User message storage** (frontend/app.js line 2819-2820):
```javascript
const userMessage = { role: 'user', content: input };  // Raw user input
setMessages(prev => [...prev, userMessage]);
```

2. **What's sent to backend** (line 2851-2860):
```javascript
body: JSON.stringify({
  message: input,                    // Current user input
  workflowId,
  conversationHistory: messages,     // Array of clean messages
  mockMode
})
```

3. **Director 2.0 context added ONLY in backend** (directorService.js):
```javascript
if (director2Context) {
  messages[messages.length - 1].content += `\n\n${director2Context}`;
}
```

### The ACTUAL Problem Revealed

Looking at the debug JSON carefully, here's what's really happening:

#### The Misunderstanding:
The `message_breakdown` at the top level shows clean messages:
- Message 1: 147 chars (just "Please build a small workflow...")
- Message 3: 734 chars ("good please now build the workflow" + Director 2.0 context)

But this is **misleading**! These are the character counts of what's in `conversationHistory`, NOT what was actually sent to OpenAI.

#### The Reality:
Looking at the nested `debug_input` inside Message 2 (the first assistant response), we see:
- Message 1 sent to OpenAI: 503 chars (user input + Director 2.0 context)

This proves that:
1. Frontend sends clean message ("Please build a small workflow...")
2. Backend appends Director 2.0 context
3. Combined message (503 chars) is sent to OpenAI
4. But the `conversationHistory` still contains the clean 147-char version

#### The Token Count Mystery Solved:

**Turn 1 (20K tokens):**
- System prompt: 33.5K chars
- User message + Director 2.0 context: 503 chars
- Total: ~34K chars ≈ 20K tokens ✓

**Turn 2 (74K tokens):**
- System prompt: 33.5K chars
- Message 1 (from history): 147 chars (clean)
- Assistant response: 395 chars  
- Message 3: User input + NEW Director 2.0 context: 734 chars
- Total chars in debug: 75,120 ≈ 74K tokens ✓

#### The Math DOES Add Up!

**Critical corrections:**
1. **I was comparing TRUNCATED data**: The system prompts were shortened to "{REST OF THE HUGE SYSTEM PROMPT....}" in the data you showed me
2. **Chars vs Tokens**: 75,120 chars ≈ 30.3K tokens (roughly 2.5 chars per token)

**Turn 2 Breakdown (with FULL system prompt):**
- System prompt: 33,505 chars (full version)
- Message 1: 147 chars  
- Assistant response: 395 chars
- Message 3: 734 chars
- **Total: 34,781 chars**

Wait, that's still only ~35K chars, not 75K...

#### The Hidden Culprit: Assistant Message Fields!

The assistant message (Message 2) contains MORE than just the 395-char content:
- `content`: 395 chars
- `reasoning`: null
- `isTemporary`: false
- `toolCalls`: Array with update_plan result
- `tokenUsage`: Object with metrics
- `debug_input`: **ENTIRE nested structure including full system prompt!**

The `debug_input` field alone contains:
- Another copy of the system prompt (33.5K chars)
- The messages array
- Message breakdown
- Total: ~37K chars

**So Turn 2 actually sends:**
- System prompt: 33.5K chars
- Conversation history INCLUDING assistant's debug_input: ~40K chars
- User message + Director 2.0: 734 chars
- **Total: ~75K chars ✓**

#### The Real Problem Identified

When the frontend sends `conversationHistory` to the backend, it's sending the ENTIRE message objects, including the `debug_input` field that contains a complete copy of the previous request's system prompt and messages!

This creates exponential growth:
- Turn 1: 1 system prompt
- Turn 2: 2 system prompts (1 current + 1 in debug_input)
- Turn 3: Would have 3+ system prompts!

## The Solution

### Option 1: Filter debug_input in Backend (Recommended)
In `directorService.js`, clean the conversation history before use:

```javascript
// Clean conversation history to remove debug data
const cleanHistory = conversationHistory.map(msg => ({
  role: msg.role,
  content: msg.content
})).filter(msg => msg.content !== null && msg.content !== undefined);

const messages = [
  { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
  ...cleanHistory,
  { role: 'user', content: message }
];
```

### Option 2: Don't Store debug_input in Frontend
Remove `debug_input` from the message object when storing:

```javascript
// In frontend/app.js when updating messages
updated[updated.length - 1] = {
  ...lastMessage,
  content: data.message,
  toolCalls: data.toolCalls,
  isTemporary: false,
  reasoning: data.reasoning_summary ? {...} : null,
  tokenUsage: {...},
  // debug_input: data.debug_input  // <- Remove this line
};
```

### Option 3: Filter When Sending
Clean the conversation history before sending to backend:

```javascript
conversationHistory: messages.map(msg => ({
  role: msg.role,
  content: msg.content
}))
```

## Summary

1. **Root Cause**: The `debug_input` field in assistant messages contains the entire previous OpenAI request, including the full system prompt
2. **Effect**: Each turn includes all previous system prompts nested in debug_input fields
3. **Growth**: Exponential token growth with each conversation turn
4. **Solution**: Filter out non-essential fields from conversation history

The Director 2.0 context management is actually working correctly - the issue is the debugging feature accidentally creating recursive context embedding!

## What Data Do We Actually Need?

### For the AI (Director):
- **role**: 'user' or 'assistant'
- **content**: The message text

That's it! The Director gets everything else from:
- **Workflow state**: Created nodes, variables, execution results
- **Current plan**: Task completion status
- **Node references**: Can access `node4.result` directly

### For the UI (User Experience):
- **toolCalls**: To show what tools were executed
- **reasoning**: To display AI reasoning (when available)
- **tokenUsage**: To show token metrics
- **debug_input**: For debugging (but causing the problem!)

### The Right Solution:

**Option 1A: Smart Filtering in Backend**
```javascript
// Clean conversation history for AI, but preserve full object structure
const cleanHistory = conversationHistory.map(msg => ({
  role: msg.role,
  content: msg.content
  // Intentionally exclude: toolCalls, reasoning, tokenUsage, debug_input
})).filter(msg => msg.content !== null && msg.content !== undefined);
```

This approach:
- ✅ Sends only what the AI needs (role + content)
- ✅ Preserves UI functionality (tool calls still display in frontend)
- ✅ Prevents exponential token growth
- ✅ Maintains clean separation of concerns

The tool execution results are already persisted in the workflow state, so the AI doesn't need to see them in conversation history!

## The Hidden Token Mystery: Encrypted Reasoning Context

### The Real Culprit Behind Token Explosion

After implementing the conversation history fix, we still saw a massive token jump (19.7k → 30.5k) despite only 1k character increase. Here's why:

#### For Reasoning Models (o4-mini, o3), OpenAI Loads Hidden Context:

```javascript
// From processWithResponsesAPI() in directorService.js
const encryptedContext = await this.loadReasoningContext(workflowId);

// This loads the LAST 5 TURNS of encrypted reasoning data!
const initialInput = [
  ...encryptedContext,  // ← HIDDEN encrypted reasoning blobs
  ...userMessages.map(msg => ({
    type: 'message',
    role: msg.role,
    content: msg.content
  }))
];
```

#### What's Actually Happening:

1. **Turn 1**: 
   - Visible: System prompt + user message = 19.7k tokens
   - Hidden: No previous context
   
2. **Turn 2**:
   - Visible: System prompt + conversation = ~20k tokens expected
   - Hidden: + Encrypted reasoning from Turn 1 = **30.5k tokens actual!**
   
3. **Turn 3+**:
   - Hidden context accumulates from last 5 turns
   - Token usage grows even without visible content

#### The loadReasoningContext() Method:
```javascript
async loadReasoningContext(workflowId) {
  const { data: contexts } = await this.supabase
    .from('reasoning_context')
    .select('encrypted_items')
    .eq('workflow_id', workflowId)
    .order('conversation_turn', { ascending: false })
    .limit(5); // Load last 5 turns!
  
  // Flattens ALL encrypted reasoning from recent turns
  const allEncryptedItems = [];
  for (const context of contexts || []) {
    if (context.encrypted_items && Array.isArray(context.encrypted_items)) {
      allEncryptedItems.push(...context.encrypted_items);
    }
  }
  
  return allEncryptedItems;
}
```

### Why This Matters:

1. **Invisible to debug_input**: The encrypted context is added AFTER the debug snapshot
2. **Accumulates quickly**: Each turn adds ~10k tokens of encrypted reasoning
3. **Persists across sessions**: Stored in the database, not conversation history
4. **Model-specific**: Only happens with reasoning models (o4-mini, o3)

### Solutions:

1. **Reduce context window**: Change `limit(5)` to `limit(2)` for less history
2. **Add to debug output**: Include encrypted context size in debug_input
3. **Use non-reasoning models**: Switch to gpt-4o for predictable token usage
4. **Clear reasoning context**: Add a tool to reset encrypted history

This explains the mysterious token jump - it's not a bug, it's encrypted reasoning context preservation!