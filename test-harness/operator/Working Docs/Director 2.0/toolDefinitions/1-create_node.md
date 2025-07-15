# Create Node Tool Definition - Comprehensive Gap Analysis

## Executive Summary

The `create_node` tool definition in `toolDefinitions.js` is **severely incomplete** and missing critical documentation that would enable the Director to effectively use this fundamental tool. This analysis reveals significant gaps between what's documented in the tool definition versus what's actually required and used throughout the system.

## Current State of Tool Definition

### What's Currently Documented (toolDefinitions.js)

```javascript
{
  name: 'create_node',
  description: 'Create one or more nodes in the workflow. For a single node, pass type/config/alias directly. For multiple nodes, pass a nodes array.',
  parameters: {
    // Single node properties
    type: { enum: [...] },
    config: { 
      properties: {
        store_variable: { type: 'boolean' }
      }
    },
    description: { type: 'string' },
    alias: { type: 'string', pattern: '^[a-z][a-z0-9_]*$' },
    // Multiple nodes property
    nodes: { type: 'array' }
  }
}
```

### Critical Missing Information

1. **No node-specific configuration schemas**
2. **Missing node types in enum**
3. **No documentation of required fields per node type**
4. **No examples or usage patterns**
5. **No explanation of variable reference system**

## Detailed Gap Analysis by Node Type

### 1. browser_action Node

**Currently Documented:** Just that it exists in the enum

**Actually Required:**
```javascript
{
  type: "browser_action",
  config: {
    action: "click|type|navigate|wait|openNewTab|switchTab|back|forward|refresh|screenshot|listTabs|getCurrentTab|keypress|act",
    // Action-specific fields:
    selector: string | string[],     // For click/type/screenshot
    text: string,                    // For type
    url: string,                     // For navigate/openNewTab
    duration: number,                // For wait (milliseconds)
    tabName: string,                 // For switchTab
    name: string,                    // For openNewTab (tab name)
    key: string,                     // For keypress (e.g., 'Enter', 'Escape')
    instruction: string,             // For act
    path: string,                    // For screenshot
    fullPage: boolean,               // For screenshot
    fallback: string,                // Natural language fallback if selector fails
    store_variable: boolean          // Store result as variable
  },
  alias: string,                     // REQUIRED
  description: string
}
```

**Missing Documentation:**
- All 14+ action types and their specific parameters
- Selector strategies (arrays, act: prefix, text: prefix)
- Union selector pattern for cross-browser compatibility
- Fallback mechanism
- Tab management rules

### 2. browser_query Node

**Currently Documented:** Just that it exists in the enum

**Actually Required:**
```javascript
{
  type: "browser_query",
  config: {
    method: "extract|observe|validate",
    instruction: string,
    schema: object,                  // For extract (supports nested schemas)
    rules: array,                    // For validate
    onFailure: "stop_workflow|continue_with_error",  // For validate
    store_variable: boolean
  },
  alias: string,                     // REQUIRED
  description: string
}
```

**Missing Documentation:**
- Three distinct methods with different parameters
- Schema format options (simple vs nested)
- Validation rule types (element_exists, element_absent, ai_assessment)
- Anti-hallucination best practices

### 3. transform Node

**Currently Documented:** Just that it exists in the enum

**Actually Required:**
```javascript
{
  type: "transform",
  config: {
    input: string | string[],        // Single or multiple inputs
    function: string,                // JavaScript function as string
    output: string,                  // Where to store result
    store_variable: boolean
  },
  alias: string,                     // REQUIRED
  description: string
}
```

**Missing Documentation:**
- JavaScript function format
- Input/output path syntax
- Multiple input handling

### 4. cognition Node

**Currently Documented:** Just that it exists in the enum

**Actually Required:**
```javascript
{
  type: "cognition",
  config: {
    prompt: string,                  // REQUIRED
    input: string,                   // Optional data path
    output: string,                  // Optional output path
    schema: object,                  // Optional output validation
    store_variable: boolean
  },
  alias: string,                     // REQUIRED
  description: string
}
```

**Missing Documentation:**
- Prompt engineering best practices
- Schema validation
- Input/output path formats

### 5. agent Node

**Currently Documented:** NOT IN THE ENUM AT ALL!

**Actually Required:**
```javascript
{
  type: "agent",
  config: {
    goal: string,                    // REQUIRED
    maxSteps: number                 // Optional, default varies
  },
  alias: string,                     // REQUIRED
  description: string
}
```

**Missing Documentation:**
- Entire node type missing from enum
- Self-healing UI automation concept
- When to use vs deterministic approaches

### 6. iterate Node

**Currently Documented:** Just that it exists in the enum

**Actually Required:**
```javascript
{
  type: "iterate",
  config: {
    over: string,                    // REQUIRED: Array path
    variable: string,                // REQUIRED: Loop variable name
    body: node | node[],             // Nodes to execute per item
    index: string,                   // Optional index variable name
    continueOnError: boolean,        // Default: true
    limit: number                    // Optional max items
  },
  alias: string,                     // REQUIRED
  description: string
}
```

**Missing Documentation:**
- Both 'over' and 'variable' are REQUIRED
- Body can be single node or array
- Variable scoping rules
- Index variable naming

### 7. route Node

**Currently Documented:** Just that it exists in the enum

**Actually Required:**
```javascript
// Option 1: Value-based routing
{
  type: "route",
  config: {
    value: string,                   // Path to check
    paths: {
      [key: string]: node[]          // Branch for each value
    }
  }
}

// Option 2: Condition-based routing
{
  type: "route",
  config: {
    conditions: [{
      path: string,
      operator: "equals|contains|exists|greater_than|less_than|matches",
      value: any,
      branch: node[]
    }],
    default: node[]
  }
}
```

**Missing Documentation:**
- Two completely different routing patterns
- Operator types
- Path syntax for accessing node results

### 8. handle Node

**Currently Documented:** Just that it exists in the enum

**Actually Required:**
```javascript
{
  type: "handle",
  config: {
    try: node[],                     // Nodes to attempt
    catch: node[],                   // Error recovery nodes
    finally: node[]                  // Cleanup nodes (optional)
  },
  alias: string,                     // REQUIRED
  description: string
}
```

**Missing Documentation:**
- Try/catch/finally pattern
- Error propagation rules
- Common patterns with agent fallback

### 9. context Node

**Currently Documented:** Just that it exists in the enum

**Actually Required:**
```javascript
{
  type: "context",
  config: {
    operation: "set|get|update|clear|merge",  // REQUIRED
    key: string,                     // Not needed for clear all
    value: any                       // For set/update/merge
  },
  alias: string,                     // REQUIRED
  description: string
}
```

**Missing Documentation:**
- All operation types
- When to use each operation
- Variable storage patterns

### 10. group Node

**Currently Documented:** Just that it exists in the enum

**Actually Required:**
```javascript
{
  type: "group",
  config: {
    nodeRange: string | number[],    // REQUIRED: "1-10" or [1, 10]
    name: string,                    // Optional display name
    continueOnError: boolean         // Optional
  },
  alias: string,                     // REQUIRED
  description: string
}
```

**Missing Documentation:**
- Node range format options
- Execution behavior
- Result structure

## Additional Missing Elements

### 1. Deprecated/Extra Node Types
- `sequence` - In enum but not in documentation
- `memory` - In enum but not in documentation

### 2. Variable Reference System
Not documented anywhere in toolDefinitions.js:
- `{{node_alias.result}}` - Node results
- `{{env:VARIABLE}}` - Environment variables
- `{{variable_name}}` - Stored variables
- `{{iterator_var.field}}` - Iterator variables

### 3. Common Patterns
No examples of:
- Multi-node creation
- Login flows with credentials
- Extract-transform-iterate patterns
- Error handling with agent fallback

### 4. Critical Rules
Not mentioned:
- Alias field is REQUIRED for all nodes
- Config cannot be empty {}
- Node referencing by alias, not position
- Execution context requirements

## Recommended Immediate Actions

### 1. Update Node Type Enum
```javascript
enum: ['browser_action', 'browser_query', 'transform', 'cognition', 'agent', 'iterate', 'route', 'handle', 'context', 'group']
```

### 2. Add Comprehensive Parameter Schemas
Each node type needs its own detailed schema with:
- Required fields clearly marked
- All possible configuration options
- Type constraints and validations
- Clear descriptions

### 3. Add Examples Section
Include common patterns:
```javascript
examples: {
  single_node: { /* example */ },
  multiple_nodes: { /* example */ },
  login_flow: { /* example */ },
  extract_and_process: { /* example */ }
}
```

### 4. Document Variable System
Add section explaining:
- How to reference node results
- Environment variable access
- Variable scoping in iterations
- Best practices for naming

### 5. Add Validation Rules
- Enforce required fields per node type
- Validate action-specific parameters
- Check for empty configs
- Validate alias uniqueness

## Impact Assessment

**Current State Impact:**
- Director cannot know what configuration each node type requires
- High likelihood of creating invalid nodes
- No guidance on best practices or patterns
- Missing critical functionality (agent node)

**With Proper Documentation:**
- Director can create valid nodes on first attempt
- Reduced debugging and error cycles
- Better workflow quality and reliability
- Proper use of advanced features

## Proposed Architectural Change: Separate AI and Deterministic Actions

### Current Problem: Mixed Mental Models

The current `browser_action` node conflates two fundamentally different approaches:

1. **Deterministic actions**: CSS selectors that either work or fail immediately
2. **AI-based actions**: Natural language instructions that require interpretation

This mixing creates confusion about:
- When to use which approach
- Performance expectations (immediate vs token-consuming)
- Error handling strategies
- The core philosophy of "deterministic navigation, intelligent processing"

### Proposed Solution: Clear Separation

**Remove from browser_action:**
- The `act` action type
- The `fallback` parameter
- Any `act:` selector prefix support

**Create new node type: `ai_action`**
```javascript
{
  type: "ai_action",
  config: {
    instruction: "click the submit button",
    constraints: ["must be blue", "in the top right"],
    max_attempts: 3
  },
  alias: "smart_click_submit",
  description: "Use AI to find and click submit button"
}
```

### Benefits of Separation

1. **Mental Clarity**: Developers explicitly choose their approach
2. **Clear Performance Expectations**: Deterministic = fast, AI = slower + tokens
3. **Better Error Messages**: "Selector not found" vs "AI couldn't interpret goal"
4. **Aligns with Core Philosophy**: Keeps deterministic and intelligent separate
5. **Simpler Tool Definitions**: Each node type has focused parameters

### Implementation Note

For now, we're NOT implementing hybrid approaches or fallback mechanisms. If a deterministic action fails, it fails cleanly and the Director can intervene to fix it. This maintains clarity and avoids muddy middle grounds.

## Conclusion

The `create_node` tool definition is the most critical tool in the Director's arsenal, yet it's currently documented at less than 10% of what's actually required. This gap severely limits the Director's ability to build effective workflows and requires immediate comprehensive documentation updates.

The good news is that all the required information exists in the system prompts - it just needs to be properly structured and added to the tool definition to make it accessible during tool selection and usage.

The proposed separation of AI and deterministic actions represents a key architectural improvement that will bring clarity to the entire system.