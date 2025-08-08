# Defining Functions 2.0: Complete Tool Definitions Following OpenAI Best Practices

## Executive Summary

The current tool definitions are skeletal - they define structure but not substance. The Director has to guess how each node type works, leading to frustration and errors. Deep investigation reveals that the real documentation exists but is scattered across system prompts, not in the tool definitions where it belongs. This document outlines a complete revision following OpenAI's function calling best practices.

## Core Problems Identified (From Deep Investigation)

1. **No Parameter Schemas**: The `config` object has no defined properties for each node type
2. **No Examples**: Zero examples showing how to use each tool
3. **No Strict Mode**: Missing validation that would catch errors early
4. **Poor Discoverability**: Director must use trial and error
5. **Violates "Intern Test"**: An intern couldn't use these tools without extensive guessing
6. **Documentation Exists But Hidden**: Rich documentation buried in system prompts instead of tool definitions
7. **Advanced Features Unknown**: Sophisticated capabilities like selector arrays, fallbacks, and special prefixes are undocumented
8. **OpenAI Schema Violations**: Current implementation uses `oneOf`, `allOf`, and `type: ['object', 'array']` which OpenAI rejects

## Key Findings from Deep Investigation

### 1. The Real Documentation Already Exists!
The system prompts (directorPrompt.js and directorPromptV2.js) contain EXTENSIVE documentation that should be in the tool definitions:

```javascript
// From directorPrompt.js - THIS IS WHERE THE REAL DOCS ARE!
## browser_action:
REQUIRED: action field must be one of: click, type, navigate, wait, openNewTab, switchTab, back, forward, refresh, screenshot, listTabs, getCurrentTab, keypress, act
{
  "action": "click" | "type" | "navigate" | "wait" | "openNewTab" | "switchTab" | "back" | "forward" | "refresh" | "screenshot" | "listTabs" | "getCurrentTab" | "keypress" | "act",
  "selector": "CSS selector or text description (for click/type/screenshot)",
  "text": "text to type (for type action)",
  "url": "URL to navigate to (for navigate/openNewTab action)",
  "duration": "milliseconds to wait (for wait action, default 1000)",
  "tabName": "tab name (for switchTab action)",
  "name": "tab name to assign (for openNewTab action)",
  "path": "file path for screenshot (optional)",
  "fullPage": "boolean for full page screenshot (optional, default true)",
  "key": "key to press (for keypress action, e.g. 'Enter', 'Escape', 'Tab', 'ArrowDown', etc.)",
  "instruction": "natural language instruction (for act action)"
}
```

### 2. Hidden Advanced Features in nodeExecutor.js
The implementation reveals sophisticated features the Director doesn't know about:
- **Selector Arrays**: Can provide multiple fallback selectors `['#submit', '.submit-btn', 'text=Submit']`
- **Special Prefixes**: `text:` for text matching, `act:` for AI-powered selection
- **Auto-conversion**: jQuery `:contains()` automatically converted to Playwright format
- **Union Selectors**: Handle variations like `input[type="email"], textarea[name="email"]`
- **Tab Management**: Auto-suffixing for duplicate tab names to prevent collisions
- **Variable Templates**: `{{variable_name}}` support throughout

### 3. OpenAI Function Calling Constraints
Current implementation violates OpenAI's constraints:
- **NOT ALLOWED**: `oneOf`, `anyOf`, `allOf` at parameter level
- **NOT ALLOWED**: `type: ['object', 'array']` 
- **NOT ALLOWED**: Complex conditional schemas
- **MUST HAVE**: Simple, flat parameter structures
- **MUST HAVE**: `items` schema for all array types

## Proposed Structure for Each Tool

### 1. OpenAI-Compliant Parameter Definitions
```javascript
{
  type: 'function',
  function: {
    name: 'create_node',
    description: 'Create one or more nodes in the workflow',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['browser_action', 'browser_query', ...],
          description: 'The type of node to create'
        },
        config: {
          type: 'object',
          description: 'Configuration for the node. Structure depends on node type - see examples.',
          // Instead of oneOf, we document requirements in descriptions
          properties: {
            // Common properties that apply to multiple node types
            action: {
              type: 'string',
              description: 'For browser_action: navigate, click, type, wait, openNewTab, switchTab, back, forward, refresh, screenshot, listTabs, getCurrentTab, keypress, act'
            },
            selector: {
              type: 'string',
              description: 'Element selector. Supports: CSS (#id, .class), text matching (text:Submit), AI selection (act:click submit), or array for fallbacks'
            },
            // ... other properties with clear descriptions
          }
        }
      }
    }
  }
}
```

### 2. Rich Examples Section
```javascript
{
  examples: [
    {
      description: 'Navigate to Gmail',
      input: {
        type: 'browser_action',
        alias: 'open_gmail',
        config: {
          action: 'navigate',
          url: 'https://gmail.com'
        }
      }
    },
    {
      description: 'Click with fallback strategies',
      input: {
        type: 'browser_action',
        alias: 'click_submit',
        config: {
          action: 'click',
          selector: ['#submit', '.submit-btn', 'text=Submit'],
          fallback: 'click the submit button'
        }
      }
    }
  ]
}
```

## Complete Node Type Schemas (From Investigation)

### browser_action
Based on nodeExecutor.js implementation:
- **Required**: `action` field
- **Actions**: `navigate`, `click`, `type`, `wait`, `openNewTab`, `switchTab`, `back`, `forward`, `refresh`, `screenshot`, `listTabs`, `getCurrentTab`, `keypress`, `act`
- **Properties**:
  - `action`: The browser action to perform
  - `selector`: CSS selector, `text:` prefix, `act:` prefix, or **array of selectors for fallback**
  - `url`: URL for navigate/openNewTab (supports `{{variables}}`)
  - `text`: Text to type (supports `{{variables}}`)
  - `duration`: Milliseconds to wait (default: 1000)
  - `tabName`: Tab name for switchTab
  - `name`: Tab name for openNewTab (auto-suffixed if duplicate)
  - `key`: Key name for keypress (e.g., 'Enter', 'Tab', 'ArrowDown')
  - `instruction`: Natural language for act action
  - `path`: Screenshot save path
  - `fullPage`: Full page screenshot (default: true)
  - `fallback`: Natural language fallback if selectors fail
  - `store_variable`: Store result in workflow variables (new!)

### browser_query
- **Required**: `method` field
- **Methods**: `extract`, `observe`, `validate`
- **Properties**:
  - `method`: Query method
  - `instruction`: What to extract/observe (AI validates against actual data)
  - `schema`: JSON schema for structured extraction
  - `rules`: Validation rules array (for validate)
  - `onFailure`: `stop_workflow` or `continue_with_error`
  - `store_variable`: Store query result

### iterate
- **Required**: `over`, `variable`, `body`
- **Properties**:
  - `over`: Path to array (e.g., "extract_emails.emails")
  - `variable`: Loop variable name
  - `body`: Node position(s) to execute - number or array
  - `index`: Index variable name (default: `${variable}Index`)
  - `continueOnError`: Continue if iteration fails (default: true)
  - `limit`: Max iterations
  - `store_variable`: Store iteration results

### route
Two patterns discovered:
- **Value-based routing**:
  - `value`: Path to check (e.g., "login_status.authenticated")
  - `paths`: Object mapping values to node positions
  - Example: `{ "true": [20, 21], "false": [25], "default": [30] }`
- **Condition-based routing**:
  - `conditions`: Array of {path, operator, value, branch}
  - `operators`: equals, notEquals, contains, exists, greater, less, greaterOrEqual, lessOrEqual, matches
  - `default`: Fallback branch

### context/memory
- **Required**: `operation`
- **Operations**: `set`, `get`, `update`, `clear`, `merge`
- **Properties**:
  - `operation`: State operation
  - `key`: Variable name (not needed for clear all)
  - `value`: Any JSON value (supports `{{ENV_VAR}}` and `{{variable}}`)
  - `store_variable`: Store operation result

### group
- **Required**: `nodeRange`
- **Properties**:
  - `nodeRange`: Range as string "1-25" or array [1, 25]
  - `groupId`: Optional group identifier
  - `name`: Human-readable name
  - `continueOnError`: Continue if node fails (default: false)
  - `store_variable`: Store group results

### Hidden Features Discovered:
1. **Selector Arrays**: Provide fallback strategies
2. **Special Prefixes**: `text:`, `act:` for intelligent selection
3. **Template Variables**: `{{variable_name}}` everywhere
4. **Auto-suffixing**: Duplicate tab names get "_2", "_3" etc.
5. **Union Selectors**: Handle cross-browser input variations
6. **Anti-hallucination**: Extract validates against actual DOM

## Tool Consolidation Recommendations

### 1. Merge Debug Tools
Instead of 7 separate debug tools, create one:
```javascript
{
  name: 'debug_browser',
  parameters: {
    action: { enum: ['navigate', 'click', 'type', 'wait', 'inspect', 'open_tab', 'close_tab', 'switch_tab'] },
    // Common parameters based on action
  }
}
```

### 2. Combine Variable Tools
Merge get/set/clear into one:
```javascript
{
  name: 'manage_variable',
  parameters: {
    operation: { enum: ['get', 'set', 'clear', 'clear_all'] },
    // Parameters based on operation
  }
}
```

## Methodical Migration Strategy

### Phase 1: Fix OpenAI Compatibility Issues (Immediate)
1. **Remove Schema Violations**:
   - Fix `type: ['object', 'array']` → Separate into distinct parameters
   - Remove `oneOf/anyOf/allOf` from parameter level
   - Ensure all arrays have proper `items` schemas
   - Move complex conditionals to descriptions

2. **Clean Separation**:
   - Create `openai-compatible-schemas.js` for API calls
   - Keep rich schemas for internal validation only
   - No more patching with `cleanSchemaForOpenAI()`

### Phase 2: Move Documentation to Tool Definitions
1. **Extract from System Prompts**:
   - All node configurations from directorPrompt.js
   - All examples from directorPromptV2.js
   - All validation rules from nodeExecutor.js

2. **Add to Each Tool**:
   - Complete parameter descriptions
   - Rich examples for common use cases
   - Document hidden features (selector arrays, prefixes, etc.)

### Phase 3: Implement Proper Schemas
1. **Per-Node-Type Schemas**:
   - Define all properties for each node type
   - Add proper enum values
   - Include default values
   - Document required vs optional

2. **Enable Validation**:
   - Use internal rich schemas for validation
   - Provide clear error messages
   - Guide Director to correct usage

### Phase 4: Tool Consolidation
1. **Reduce Cognitive Load**:
   - Merge 7 debug tools → 1 `debug_browser` tool
   - Combine variable operations where sensible
   - Keep single-purpose principle

### Phase 5: Documentation & Testing
1. **Update System Prompts**:
   - Remove duplicate documentation
   - Point to tool definitions as source of truth
   - Add migration guide for Director

## Expected Benefits

- **Director Success**: No more guessing - everything documented in tool definitions
- **Earlier Error Detection**: OpenAI validates at API level
- **Maintainability**: Single source of truth for node configurations
- **Performance**: Fewer failed attempts = faster workflows
- **Developer Experience**: Clear, discoverable, well-documented API

## Implementation Order

1. **Week 1**: Fix OpenAI schema violations (Priority: Critical)
2. **Week 2**: Extract and consolidate documentation
3. **Week 3**: Implement proper per-node schemas
4. **Week 4**: Tool consolidation and testing
5. **Week 5**: Update prompts and roll out

## Success Metrics

- Zero OpenAI schema validation errors
- 80% reduction in Director trial/error attempts
- All node features documented in tool definitions
- System prompts reduced by 50% (no duplicate docs)
- Director satisfaction: "Finally, I know what I'm doing!"