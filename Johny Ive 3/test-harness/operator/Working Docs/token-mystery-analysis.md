# Token Mystery Analysis

## Observed Pattern (Fresh Browser, New Workflow)

1. **Message 1**: 19.6k tokens ✓ (normal)
2. **Message 2**: 40.6k tokens (DOUBLES!)
3. **Message 3**: 20k tokens (back to normal?!)
4. **Message 4**: PayloadTooLarge error (118KB > 100KB limit)

## Key Clues

### Clue 1: Character Count vs Token Count
- Frontend shows: 36k → 37k chars (only 1k increase)
- But tokens: 19.6k → 40.6k (21k increase!)
- This suggests ~84k chars of hidden content

### Clue 2: The Pattern is Erratic
- Not exponential growth (would be 19k → 40k → 80k → 160k)
- Not linear growth (would be 19k → 40k → 60k → 80k)
- Instead: 19k → 40k → 20k → error

### Clue 3: PayloadTooLarge Error
- Trying to send 118KB to backend
- This is the `conversationHistory` from frontend
- Something is accumulating in the messages array

## Hypothesis: The Debug Input Accumulation

Even though we filtered `debug_input` from being sent to OpenAI, it's still:
1. Being stored in frontend messages array
2. Being sent to backend in conversationHistory
3. Growing with each turn

### The Cycle:
1. **Turn 1**: 
   - Send clean messages
   - Response includes debug_input (contains full context)
   - Store in frontend messages

2. **Turn 2**:
   - conversationHistory includes Turn 1's debug_input
   - This debug_input contains the full system prompt!
   - Backend filters it for OpenAI, but still processes it
   - Response includes NEW debug_input (even larger)

3. **Turn 3**:
   - conversationHistory now has 2 debug_inputs
   - Payload size approaches limit

4. **Turn 4**:
   - Payload exceeds 100KB limit
   - Error!

## The Smoking Gun

The `debug_input` field in assistant messages is:
1. Not filtered when sending conversationHistory to backend
2. Contains the entire OpenAI request including system prompt
3. Accumulates with each turn
4. Eventually exceeds Express body parser limit

## Solution

We need to filter `debug_input` from conversationHistory when sending to backend, not just when sending to OpenAI!