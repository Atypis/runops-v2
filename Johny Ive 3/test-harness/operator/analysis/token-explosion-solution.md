# Token Explosion Analysis & Solution

## Problem Summary
The user reported that a ~3k token prompt is expanding to 190k tokens (63x increase).

## Root Causes Identified

1. **Director Prompt Size**: The Director system prompt is actually ~7.3k tokens, not 3k
2. **`include_full: true` Pattern**: The prompt includes an example showing `dom_overview` with `include_full: true`
3. **DOM Overview Doubling**: When `include_full: true` is used, the response includes both:
   - The diff (changes since last snapshot)
   - The full DOM overview sections (outline, interactives, headings)

## Token Growth Mechanism

1. Base DOM overview: ~1.4k tokens
2. With `include_full: true`: ~2.5k tokens (1.8x increase)
3. In conversation history: Each turn adds another copy
4. After 5 turns: ~12.5k tokens just from DOM overviews

## The 63x Mystery

To reach 190k tokens from a 3k base requires additional factors:
- The Director prompt itself is 7.3k tokens
- If conversation history isn't properly managed
- If tool results are being duplicated
- If the prompt is being included multiple times

## Recommended Solutions

### 1. Remove `include_full: true` from Examples
The example in the Director prompt teaches it to always use this flag:

```javascript
// Current example in prompt:
execute_node({
  type: "function",
  name: "dom_overview",
  args: {diff_from: true, include_full: true}  // ← Remove this
})
```

Should be:
```javascript
execute_node({
  type: "function",
  name: "dom_overview",
  args: {diff_from: true}  // Only show diff by default
})
```

### 2. Add Token Limits to DOM Overview
Implement hard limits in the DOM toolkit:

```javascript
// In domOverview function
const MAX_RESPONSE_SIZE = 50000; // characters
const responseStr = JSON.stringify(response);
if (responseStr.length > MAX_RESPONSE_SIZE) {
  // Truncate sections, add warning
}
```

### 3. Implement Conversation History Compression
- Exclude tool results from historical messages
- Only keep the assistant's interpretation/summary
- Archive old messages after N turns

### 4. Add Monitoring
Track token usage per conversation turn to identify exactly where the explosion happens.

## Immediate Fix

The quickest fix is to update the Director prompt to not show `include_full: true` in examples, which will prevent the AI from learning to always use this flag.