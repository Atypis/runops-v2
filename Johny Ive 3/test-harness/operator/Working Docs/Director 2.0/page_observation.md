# Page Observation Feature

## Overview

The Page Observation feature provides the Director with visual context after each browser action, solving the critical gap where mechanically successful actions (e.g., typing, clicking) don't reveal semantic failures (e.g., error messages, wrong values entered).

## Problem Statement

Previously, the Director received only technical success/failure status from node execution:
- ✅ "Successfully typed in email field" 
- ✅ "Successfully clicked Next button"

But missed crucial context:
- ❌ The email field contained `{{gmail_email}}` (placeholder not replaced)
- ❌ An error message appeared: "Enter a valid email"
- ❌ The page didn't transition to the password screen

## Solution

After each UI-affecting node execution, we capture a screenshot and use Gemini 2.5 Flash to generate a concise observation that's embedded directly in the tool response.

## Implementation Details

### 1. Visual Observation Service
**File**: `backend/services/visualObservationService.js`

- Takes screenshots after node execution
- Uses Gemini 2.5 Flash (free tier) for analysis
- 500 token limit for detailed observations
- Simple, focused prompt asking for:
  1. What page/section are you on?
  2. What components are visible?
  3. What values are visible?

### 2. Node Executor Integration
**File**: `backend/services/nodeExecutor.js`

```javascript
// After successful node execution
if (visualObservationService.shouldObserveNode(node.type, this.getNodeDescription(node))) {
  const visualObservation = await visualObservationService.captureAndAnalyze(
    activePage,
    node.type,
    this.getNodeDescription(node),
    result
  );
  
  // Embed in result
  if (visualObservation.success) {
    result._page_observation = visualObservation.observation;
  }
}
```

### 3. Director Service Integration
**File**: `backend/services/directorService.js`

Extracts `_page_observation` from node results and includes it in the execute_nodes response:

```javascript
{
  "node_position": 6,
  "status": "success",
  "result": "Clicked Next button",
  "execution_time": "0.8s",
  "page_observation": "Currently on Gmail sign-in error page. The email field contains '{{gmail_email}}' showing the placeholder was not replaced. A red error message states 'Enter a valid email' below the input field."
}
```

### 4. Frontend Display
**File**: `frontend/app.js`

Displays observations in amber-colored boxes with a 🔍 icon within the tool results.

## Token Efficiency

- **Screenshot to Gemini**: ~3-5K tokens (internal to observation service)
- **Director receives**: Only the 500-token text observation
- **Context impact**: Can include 20+ observations for the cost of a single screenshot

## Configuration

- Environment variable: `ENABLE_VISUAL_OBSERVATION` (default: true)
- Gemini API key: Uses existing `GEMINI_API_KEY` or defaults to test key
- Model: `gemini-2.0-flash-exp` (configurable)

## When Observations Occur

Observations are captured for:
- ✅ `browser_action` nodes (click, type, navigate)
- ✅ Failed validations
- ✅ Nodes that timeout

Observations are skipped for:
- ❌ `transform`, `context`, `cognition` nodes
- ❌ `wait` actions
- ❌ Successful `browser_query` nodes

## Example Output

```json
{
  "execution_results": [
    {
      "node_position": 3,
      "status": "success",
      "result": "Navigated to https://mail.google.com",
      "page_observation": "On Google Account sign-in page. Email input field is visible with label 'Email or phone'. Blue 'Next' button is present. Google logo displayed at top."
    },
    {
      "node_position": 4,
      "status": "success", 
      "result": "Typed in email field",
      "page_observation": "Still on sign-in page. Email field now contains '{{gmail_email}}' text. No error messages visible yet."
    },
    {
      "node_position": 5,
      "status": "success",
      "result": "Clicked Next button",
      "page_observation": "Gmail sign-in error state. Red error message 'Enter a valid email' displayed below email field which still shows '{{gmail_email}}'. Page has not transitioned to password entry."
    }
  ]
}
```

## Benefits

1. **Immediate Context**: Director sees page state within reasoning chain
2. **Error Detection**: Catches semantic failures that appear as technical successes
3. **Token Efficient**: ~60 tokens per observation vs 5-20K for screenshots
4. **Debugging Aid**: Clear visibility into what happened at each step
5. **No Workflow Changes**: Transparent addition to existing execution flow

## Future Enhancements

1. **Selective Observation**: Only observe on failures or specific nodes
2. **Diff Mode**: Compare before/after states
3. **Pattern Learning**: Identify common error patterns
4. **Observation History**: Store for workflow replay/debugging

## Technical Notes

- Screenshots are temporarily saved to `backend/temp/screenshots/`
- Observations don't block node execution (fail gracefully)
- No persistence - observations exist only in tool responses
- Browser state is captured from the active tab at execution time