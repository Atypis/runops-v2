# Scout Implementation - Director 2.0

## Overview

The `send_scout` tool is a token-efficient exploration mechanism that allows the Director to deploy a lightweight reconnaissance agent using OpenAI's Responses API (o4-mini). The Scout operates in an isolated context to explore pages intelligently without bloating the Director's context window.

## Architecture

### Technology Stack:
- **Language**: JavaScript/Node.js (native to Director ecosystem)
- **AI Model**: OpenAI Responses API with o4-mini (same as Director)
- **Browser Access**: Via existing TabInspectionService
- **Context Management**: Isolated from Director's context for token efficiency

### Flow:
1. **Director** calls `send_scout` with natural language instructions
2. **ScoutService** creates isolated context with Scout-specific system prompt
3. **Scout Agent** (o4-mini with reasoning) receives:
   - Mission instructions
   - Access to `inspect_tab` and `expand_dom_selector` tools
   - Ability to make multiple tool calls within reasoning chain
4. **Scout** explores page through reasoning-driven tool calls
5. **Director** receives consolidated findings without context pollution

## Implementation Details

### ScoutService (`backend/services/scoutService.js`)
- Uses OpenAI Responses API with non-streaming for accurate token counts
- Implements recursive control loop pattern (same as Director)
- Handles tool execution within reasoning chains
- Returns structured findings with token usage metrics

### Tool Definition (`backend/tools/toolDefinitions.js`)

```javascript
{
  type: 'function',
  function: {
    name: 'send_scout',
    description: 'Deploy a Scout to explore the current page and report back with findings. Token-efficient alternative to inspect_tab for natural language exploration. The Scout uses reasoning to thoroughly investigate the page through multiple tool calls.',
    parameters: {
      type: 'object',
      properties: {
        instruction: {
          type: 'string',
          description: 'Natural language instruction for what to explore/find (e.g., "Find all login form elements and their selectors", "Identify the main navigation menu structure")'
        },
        tabName: {
          type: 'string',
          description: 'Tab to scout (defaults to active tab)'
        }
      },
      required: ['instruction']
    }
  }
}
```

### Director Integration (`backend/services/directorService.js`)
- Lazy loads ScoutService on first use
- Passes `nodeExecutor` for browser access
- Handles both Chat Completions and Responses API tool execution paths

## Usage Examples

```javascript
// Basic form exploration
send_scout({
  instruction: "Find all login form elements and their stable selectors"
})

// Complex conditional investigation
send_scout({
  instruction: "Check if we're logged in. If not, find the login form elements. If yes, find the logout button"
})

// Pattern discovery
send_scout({
  instruction: "Identify all data tables on this page and their column headers"
})

// Navigation analysis
send_scout({
  instruction: "Find the main navigation menu and list all top-level links with their selectors"
})
```

## Scout Agent Behavior

The Scout uses o4-mini reasoning to:
1. Call `inspect_tab` to get initial page structure
2. Analyze the DOM to identify relevant elements
3. Call `expand_dom_selector` multiple times on interesting elements
4. Build comprehensive understanding through iterative exploration
5. Compile findings into a structured report

### Scout System Prompt
The Scout is optimized for:
- Systematic exploration using available tools
- Finding stable selectors (IDs, data-testid, aria-label)
- Identifying patterns across similar elements
- Testing selector reliability
- Reporting ready-to-use selector strategies

## Response Format

```javascript
{
  "success": true,
  "summary": "Found login form with email and password fields. The email field has id='email' and data-testid='email-input'. The password field has id='password'. Submit button has data-testid='login-submit'.",
  "elements": [],  // Can be extended to include structured element data
  "patterns": [],   // Can be extended to include discovered patterns
  "warnings": [],   // Can be extended to include potential issues
  "reasoning_summary": "Inspected page, found form at..., investigated 4 input elements...",
  "token_usage": {
    "input_tokens": 5234,
    "output_tokens": 892,
    "total_tokens": 6126,
    "reasoning_tokens": 450
  },
  "tools_executed": 5,      // Total tool calls made
  "exploration_depth": 4    // Number of elements investigated with expand_dom_selector
}
```

## Benefits

1. **Token Efficiency**: Scout operates in isolated context, Director only sees findings
2. **Reasoning Power**: Uses o4-mini's reasoning for intelligent, adaptive exploration
3. **Multiple Tool Calls**: Scout can thoroughly investigate through reasoning chains
4. **Natural Language**: Director gives missions, not specific inspection commands
5. **Stable Selectors**: Scout prioritizes automation-friendly selectors
6. **Pattern Recognition**: Scout can identify patterns across multiple elements

## Integration with Director 2.0 Workflow

### Three-Tool Strategy:
1. **send_scout**: For intelligent exploration requiring reasoning
2. **inspect_tab**: For direct DOM structure access
3. **expand_dom_selector**: For surgical element inspection

### When to Use Scout:
- Complex exploration missions (e.g., "Find all form validation patterns")
- Conditional investigations (e.g., "Check login state and find appropriate elements")
- Pattern discovery across multiple elements
- When you need intelligent interpretation of the page

### When to Use Direct Inspection:
- Simple DOM structure queries
- When you know exactly what element to inspect
- Debugging specific selector issues
- When raw DOM data is needed

## Technical Architecture

### Key Design Decisions:
1. **JavaScript Native**: Seamless integration with existing Director ecosystem
2. **Responses API**: Enables complex reasoning chains with multiple tool calls
3. **Isolated Context**: Prevents Director context pollution
4. **Reuses Infrastructure**: Leverages existing TabInspectionService
5. **Non-streaming**: Ensures accurate token counting

### Performance Characteristics:
- **Model**: o4-mini (same as Director)
- **Reasoning Effort**: 'low' (vs Director's 'medium')
- **Typical Token Usage**: 3-8k input, 500-2k output
- **Tool Calls**: Usually 3-10 per mission
- **Response Time**: 5-15 seconds depending on complexity

## Future Enhancements

1. **Structured Element Extraction**: Return detailed element arrays
2. **Pattern Library**: Build reusable selector patterns
3. **Multi-Page Exploration**: Scout across navigation flows
4. **Visual Analysis**: Integration with screenshot analysis
5. **Learning System**: Remember successful selector strategies

## Conclusion

The Scout implementation provides Director 2.0 with a powerful, token-efficient reconnaissance capability. By leveraging the same Responses API infrastructure as the Director but in an isolated context, Scout can perform complex, reasoning-driven exploration without impacting the Director's token budget. This enables more intelligent and adaptive workflow building while maintaining the system's efficiency.