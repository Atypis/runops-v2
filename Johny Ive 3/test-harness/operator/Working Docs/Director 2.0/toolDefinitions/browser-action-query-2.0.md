# Browser Action & Query 2.0 - Implementation Plan

## Overview

This document outlines the implementation plan for splitting `browser_action` and `browser_query` into deterministic and AI-powered versions, creating a clear separation between these fundamentally different approaches.

## Motivation

The current system mixes deterministic and AI approaches within single node types, causing:
- Mental model confusion about when AI is being used
- Unpredictable performance (immediate vs token-consuming)
- Complex error handling for different failure modes
- Violation of the core philosophy: "deterministic navigation, intelligent processing"

## New Architecture

### Four Distinct Node Types

1. **browser_action** - Deterministic UI interactions only
2. **browser_ai_action** - AI-powered UI interactions
3. **browser_query** - Deterministic validation only
4. **browser_ai_query** - AI-powered extraction and observation

## Implementation Details

### 1. Tool Definitions Update (`toolDefinitions.js`)

Update all 4 enum occurrences (lines 14, 45, 90, 115) to:
```javascript
enum: ['browser_action', 'browser_ai_action', 'browser_query', 'browser_ai_query', 'transform', 'cognition', 'agent', 'iterate', 'route', 'handle', 'context', 'group']
```

### 2. Node Type Specifications

#### browser_action (Deterministic Only)
**Purpose**: Predictable, fast browser operations that don't require interpretation

**Configuration**:
```javascript
{
  type: "browser_action",
  config: {
    action: "navigate|wait|openNewTab|switchTab|back|forward|refresh|screenshot|listTabs|getCurrentTab|keypress",
    // Action-specific parameters:
    url: string,              // for navigate/openNewTab
    duration: number,         // for wait (milliseconds)
    tabName: string,          // for switchTab
    name: string,             // for openNewTab (tab name)
    key: string,              // for keypress (e.g., 'Enter', 'Escape')
    path: string,             // for screenshot file path
    fullPage: boolean,        // for screenshot
    store_variable: boolean   // Store result as variable
  },
  alias: string,              // REQUIRED: snake_case identifier
  description: string
}
```

**Key Changes**:
- REMOVED: `click`, `type`, `act` actions (moved to AI)
- REMOVED: `fallback` parameter
- REMOVED: Selector arrays
- REMOVED: `act:` prefix support

#### browser_ai_action (New)
**Purpose**: AI-powered interactions using natural language

**Configuration**:
```javascript
{
  type: "browser_ai_action",
  config: {
    action: "click|type|act",
    instruction: string,      // Natural language instruction
    text: string,             // Text to type (for type action)
    constraints: string[],    // Optional constraints/hints
    store_variable: boolean   // Store result as variable
  },
  alias: string,              // REQUIRED: snake_case identifier
  description: string
}
```

**Examples**:
```javascript
// Click
{
  type: "browser_ai_action",
  config: {
    action: "click",
    instruction: "click the blue submit button in the login form"
  },
  alias: "click_submit"
}

// Type
{
  type: "browser_ai_action",
  config: {
    action: "type", 
    instruction: "find the email field",
    text: "{{user.email}}"
  },
  alias: "enter_email"
}

// General action
{
  type: "browser_ai_action",
  config: {
    action: "act",
    instruction: "scroll down until you see the testimonials section"
  },
  alias: "find_testimonials"
}
```

#### browser_query (Deterministic Only)
**Purpose**: Fast, reliable element validation

**Configuration**:
```javascript
{
  type: "browser_query",
  config: {
    method: "validate",
    rules: [{
      type: "element_exists|element_absent",
      selector: string,       // CSS selector only
      description: string     // What we're checking
    }],
    onFailure: "stop_workflow|continue_with_error"
  },
  alias: string,              // REQUIRED: snake_case identifier
  description: string
}
```

**Key Changes**:
- REMOVED: `extract` method (moved to AI)
- REMOVED: `observe` method (moved to AI)
- REMOVED: `ai_assessment` rule type

#### browser_ai_query (New)
**Purpose**: AI-powered data extraction and page understanding

**Configuration**:
```javascript
{
  type: "browser_ai_query",
  config: {
    method: "extract|observe|assess",
    instruction: string,      // Natural language instruction
    schema: object,           // For extract: expected data structure
    expected: string,         // For assess: expected state/condition
    store_variable: boolean   // Store result (default: true)
  },
  alias: string,              // REQUIRED: snake_case identifier
  description: string
}
```

**Examples**:
```javascript
// Extract
{
  type: "browser_ai_query",
  config: {
    method: "extract",
    instruction: "Extract all email messages with sender and subject",
    schema: {
      emails: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sender: "string",
            subject: "string"
          }
        }
      }
    }
  },
  alias: "extract_emails"
}

// Observe
{
  type: "browser_ai_query",
  config: {
    method: "observe",
    instruction: "Find all clickable elements in the navigation menu"
  },
  alias: "find_nav_items"
}

// Assess
{
  type: "browser_ai_query",
  config: {
    method: "assess",
    instruction: "Check if we're on the login page",
    expected: "login_page"
  },
  alias: "verify_login_page"
}
```

### 3. Backend Implementation

#### 3.1 NodeExecutor.js Updates

Add new execution methods:
```javascript
async executeBrowserAIAction(node, context) {
  // Implementation using StageHand's act() method
  // Handle click, type, and general act actions
}

async executeBrowserAIQuery(node, context) {
  // Implementation using StageHand's extract() and observe()
  // Handle extract, observe, and assess methods
}
```

Update existing methods:
- `executeBrowserAction`: Remove all AI functionality
- `executeBrowserQuery`: Keep only deterministic validation

Update main switch statement:
```javascript
case 'browser_action':
  return await this.executeBrowserAction(node, context);
case 'browser_ai_action':
  return await this.executeBrowserAIAction(node, context);
case 'browser_query':
  return await this.executeBrowserQuery(node, context);
case 'browser_ai_query':
  return await this.executeBrowserAIQuery(node, context);
```

#### 3.2 Validation Updates (directorService.js)

Add validation for new node types in the switch statements.

### 4. Frontend Updates (app.js)

#### 4.1 Node Type Colors
```javascript
function getNodeTypeColor(type) {
  switch(type) {
    case 'browser_action': return '#4CAF50';      // Green (deterministic)
    case 'browser_ai_action': return '#9C27B0';   // Purple (AI)
    case 'browser_query': return '#2196F3';       // Blue (deterministic)
    case 'browser_ai_query': return '#E91E63';    // Pink (AI)
    // ... existing colors
  }
}
```

#### 4.2 Node Display
Update `NodeCard` component to handle new types and show AI indicator.

### 5. System Prompt Update (directorPromptV3.js)

Update the node types section to reflect the new architecture:

```javascript
## The 11 Core Node Types

**Execution Layer:**
1. `browser_action` - Deterministic UI interactions (navigate, wait, tab management)
   - Fast, predictable, no AI involvement
   - Actions: navigate, wait, screenshot, tab operations, keypress
   
2. `browser_ai_action` - AI-powered UI interactions 
   - Uses natural language to find and interact with elements
   - Actions: click, type, act (general purpose)
   - Slower, costs tokens, but handles complex/dynamic UIs

3. `browser_query` - Deterministic validation
   - Fast element existence checks using CSS selectors
   - Method: validate (element_exists, element_absent)

4. `browser_ai_query` - AI-powered data extraction and observation
   - Natural language data extraction with schema validation
   - Methods: extract (get data), observe (find elements), assess (check state)
   - Costs tokens but handles complex data structures

5. `transform` - Pure data manipulation
6. `cognition` - AI-powered reasoning

**Control Layer:**
7. `iterate` - Loop over arrays
8. `route` - Conditional branching  
9. `handle` - Error boundaries

**State Layer:**
10. `context` - Explicit state management
11. `group` - Execute node ranges as unit

## Core Philosophy: Deterministic by Default

Always prefer deterministic nodes (browser_action, browser_query) when:
- You have stable selectors (IDs, data-testid)
- The UI structure is predictable
- Performance is critical
- Token costs need to be minimized

Use AI nodes (browser_ai_action, browser_ai_query) only when:
- UI elements lack stable selectors
- Content is dynamic or unpredictable
- Natural language understanding is required
- Complex data extraction is needed
```

### 6. Error Handling

#### Deterministic Failures
```
Error: Element not found: #submit-button
Node: click_submit (browser_action)
Resolution: Element doesn't exist. Check selector or page state.
```

#### AI Failures
```
Error: AI could not complete action after 3 attempts
Node: find_submit (browser_ai_action)  
Instruction: "click the blue submit button"
Resolution: AI couldn't interpret or find the target. Refine instruction.
```

## Implementation Order

1. **Update tool definitions** - Add new node types to enums
2. **Implement backend handlers** - Create new execution methods
3. **Update validation** - Add validation for new types
4. **Update frontend** - Add colors and display logic
5. **Update system prompt** - Document new node types
6. **Test thoroughly** - Ensure clean separation works as expected

## Benefits

1. **Mental Clarity**: Explicit choice between deterministic and AI approaches
2. **Performance Predictability**: Know exactly when tokens are being used
3. **Better Error Messages**: Different failure modes have different solutions
4. **Cost Transparency**: AI usage is explicit and measurable
5. **Philosophical Alignment**: True separation of "deterministic navigation, intelligent processing"

## Notes

- No backwards compatibility or migration tools needed
- Director will choose appropriate node types based on system prompt guidance
- Clean break from mixed approach to pure separation