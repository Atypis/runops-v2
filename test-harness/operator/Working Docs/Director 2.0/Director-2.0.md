# Director 2.0: Incremental Workflow Building with Comprehensive Debugging

## Executive Summary

This document outlines the complete transformation of the Director system from a "build-all-at-once" approach to an incremental, validated workflow construction methodology with advanced debugging capabilities. The key insight is that the Director should build workflows like a human would - one step at a time, with immediate validation, comprehensive state visibility, and powerful debugging tools.

## Core Philosophy

### Current Problem
The Director currently:
- Tries to construct entire workflows without seeing results
- Has no feedback on whether nodes actually work
- Can't learn from failures or adjust approach
- Builds "blind" without validation
- Lacks visibility into workflow state and variables
- Cannot debug complex failures effectively

### New Approach: Enhanced Build → Validate → Debug → Iterate
1. **Chunk the workflow** into logical phases with structured planning
2. **Scout first** to understand the UI with detailed reconnaissance
3. **Build one node** at a time with immediate testing
4. **Validate with dedicated validation nodes** (business-level invariants)
5. **Debug with comprehensive tools** (browser state, variables, DOM inspection)
6. **Iterate based on results** with full state visibility
7. **Checkpoint with human** at phase boundaries

## Enhanced Context Architecture

### 6-Part Context Structure
Every Director conversation now follows this comprehensive structure:

```
(1) SYSTEM PROMPT
    Enhanced methodology with toolbox mastery
    
(2) CURRENT PLAN  
    JSON structured plan with phases, tasks, and progress tracking
    
(3) WORKFLOW SNAPSHOT
    Complete current workflow state from database
    
(4) WORKFLOW VARIABLES
    Chunked variable display with real-time state visibility
    
(5) BROWSER STATE
    Live browser tab information and debugging context
    
(6) CONVERSATION HISTORY
    Filtered chat history with debugging actions
```

### Context Benefits
- **Complete State Visibility**: Director sees everything at all times
- **Debugging Context**: Browser tabs, variables, and workflow state
- **Efficient Management**: Chunked display prevents context bloat
- **Real-time Updates**: All sections refresh with each API call
- **Smart Compression**: At 180k tokens, preserves all fresh context

## System Prompt Improvements

### 1. Toolbox Mastery Section

#### A. Deterministic vs AI Hierarchy
```
NAVIGATION HIERARCHY:
1. PRIMARY: Use deterministic selectors discovered by Scout
   - ID selectors: #submit-button
   - Data attributes: [data-testid="login"]
   - Stable classes: .primary-button
   - ARIA labels: [aria-label="Next"]

2. FALLBACK: Natural language selectors
   - text: prefix for exact text matching
   - act: prefix for AI-powered selection
   - Use ONLY when deterministic fails

3. NEVER: 
   - Dynamic IDs (Gmail's #:b5, #:a1)
   - Position-based selectors without context
   - Overly generic selectors (.button)
```

#### B. Exact Node Creation Specifications
```
NODE CREATION RULES:
- ALWAYS include config parameter
- NEVER create nodes with empty config {}
- Each node type has REQUIRED fields
- Use exact syntax shown in examples
- Reference previous nodes by position (node1, node2)
- State variables use snake_case (gmail_creds, not gmailCreds)
```

#### C. Business-Level Invariants
```
SMART PATTERNS:
1. Login Detection:
   - Check for DOM selector presence first
   - Example: document.querySelector('[data-action="sign in"]')
   - Only use browser_query if selector check fails

2. Page Load Verification:
   - Wait for specific elements, not arbitrary time
   - Example: Wait for [aria-label="Search mail"] on Gmail

3. Error States:
   - Always check for error messages after actions
   - Common selectors: .error-message, [role="alert"]
```

### 2. Variable Storage & Debugging

#### CRITICAL: How Variables Work
```
VARIABLE STORAGE & ACCESS:

1. STORING VARIABLES:
   A. From Environment Variables:
      {"type": "context", "config": {"operation": "set", "key": "gmail_creds", 
       "value": {"email": "{{GMAIL_EMAIL}}", "password": "{{GMAIL_PASSWORD}}"}}}
   
   B. From Node Results (automatic):
      - browser_query results stored as: node[position].result
      - Example: node4.emails contains extracted email array
   
   C. Manual Storage:
      {"type": "context", "config": {"operation": "set", "key": "user_data", 
       "value": {"name": "John", "id": 123}}}

2. ACCESSING VARIABLES:
   A. State Variables: {{variable_name}} or {{nested.path}}
      - {{gmail_creds.email}}
      - {{user_data.name}}
   
   B. Node Results: node[position].fieldName
      - node4.loginRequired
      - node7.emails[0].subject
   
   C. Iteration Variables: {{variableName}}
      - In iterate loop with variable "email": {{email.sender}}

3. VARIABLE VISIBILITY:
   - Always visible in context (chunked to 100 chars)
   - Director can see all workflow state immediately
   - Sensitive data masked: password: "[hidden]"
   - Arrays show preview: [{"sender": "investor@vc.com"}, {"sender": "startup@...
      
4. COMMON MISTAKES:
   - ❌ {{state.gmail_creds}} - Don't include "state" prefix
   - ❌ {{node4}} - Must specify field: {{node4.result}}
   - ❌ camelCase - Always use snake_case for consistency
```

### 3. Enhanced Workflow Methodology

#### The Chunk → Scout → Build → Validate → Debug Process
```
METHODOLOGY:

1. CHUNK THE WORKFLOW
   - Break into logical phases (Setup, Data Extraction, Processing)
   - Create structured plan with phases and tasks
   - Each chunk should be independently testable
   - Plan checkpoints between chunks

2. SCOUT THE TERRITORY
   - Deploy Scout to explore UI patterns
   - Get exact selectors and timing requirements
   - Understand page flow and states
   - Test selectors for reliability

3. BUILD INCREMENTALLY
   - Update plan with specific tasks
   - Build ONE node at a time
   - Add validation nodes for business invariants
   - Never build multiple nodes without testing

4. TEST & VALIDATE
   - Execute node ranges flexibly (3-5,15,20,30)
   - Use dedicated validation nodes that stop workflow on failure
   - Get structured execution results
   - Check business-level invariants

5. DEBUG WITH FULL VISIBILITY
   - Inspect browser state and tabs
   - View all workflow variables (chunked)
   - Navigate for debugging (separate from workflow)
   - DOM inspection tools (lightweight + full)

6. ITERATE BASED ON RESULTS
   - If validation fails, debug with inspection tools
   - Update approach based on actual behavior
   - Learn from what works/doesn't work
   - Clear/set variables for testing

7. CHECKPOINT WITH HUMAN
   - Confirm chunk completion
   - Get approval before next phase
   - Share learnings and observations
```

## Advanced Debugging Architecture

### Browser State Debugging
```
BROWSER STATE (always visible):
3 tabs open:
- Main Tab (Active) = https://mail.google.com/mail/u/0/#inbox
- Airtable Tab = https://airtable.com/app123/tbl456  
- Debug Tab = https://accounts.google.com/signin

DEBUGGING TOOLS:
- inspect_tab (lightweight analysis or full DOM)
- debug_navigate (manual navigation for testing)
- debug_action (click/type/wait for debugging)
- debug_open_tab / debug_close_tab
```

### Variable State Debugging
```
WORKFLOW VARIABLES (always visible):
- gmail_creds = {email: "user@gmail.com", password: "[hidden]"}
- node4.loginRequired = true  
- node7.emails = [{"sender": "investor@vc.com", "subject": "Re: Funding"}, {"sender": "startup@...
- node10.selectedEmail = {sender: "investor@vc.com", subject: "Re: Funding", content: "Hi, we're inte...

VARIABLE TOOLS:
- get_workflow_variable (full content when chunked preview insufficient)
- set_variable (manual override for testing)
- clear_variable (reset specific variable)
- clear_all_variables (fresh workflow state)
```

## New Node Types & Tools

### 1. Validation Node Type (NEW!)
Dedicated validation nodes that stop workflow execution on failure:

```javascript
{
  type: "validation",
  config: {
    validationType: "deterministic|ai|both",
    conditions: [
      {
        type: "element_exists",
        selector: "[data-action='signin']",
        description: "Login button must be present"
      },
      {
        type: "ai_assessment", 
        instruction: "Verify we're on Gmail login page, not 2FA",
        expectedResult: "gmail_login_page"
      }
    ],
    onFailure: {
      action: "stop_workflow", // or "branch_to_error_handler"
      errorMessage: "Gmail login page not accessible"
    }
  }
}
```

**Benefits over browser_query:**
- Built-in workflow stopping on failure
- Business invariant semantics  
- Clear error messaging
- Safety barrier functionality

### 2. Flexible Node Execution
Execute individual nodes or ranges for comprehensive testing:

```javascript
execute_nodes({
  nodeSelection: "3-5,15,20,30", // ranges and individual nodes
  resetBrowserFirst: false // default: use current browser session
})

// Returns structured results:
{
  "execution_results": [
    {
      "node_position": 3,
      "status": "success",
      "result": "Navigated to https://mail.google.com"
    },
    {
      "node_position": 15,
      "status": "error",
      "error_details": "Selector '#loginButton' not found"
    }
  ]
}
```

### 3. Advanced Debugging Tools

#### Tab Inspection
```javascript
// Lightweight page analysis (context-friendly)
inspect_tab({
  tabName: "Main Tab",
  inspectionType: "lightweight_exploration",
  instruction: "What login elements are visible? Are we in 2FA?"
})

// Full DOM snapshot (deep debugging)
inspect_tab({
  tabName: "Main Tab",
  inspectionType: "dom_snapshot"
})
```

#### Director Navigation (Debugging Only)
```javascript
// Navigate for debugging (not part of workflow)
debug_navigate({
  url: "https://mail.google.com",
  tabName: "Main Tab",
  reason: "Test fresh login flow to verify selectors"
})

// Perform debugging actions
debug_action({
  action: "click|type|wait",
  selector: "#identifierNext", 
  tabName: "Main Tab",
  reason: "Test if selector works"
})
```

**Key Features:**
- Batched function calls for efficiency
- Actions logged in chat history only (not persisted)
- Separate from workflow building
- Multiple actions in single API call

## Enhanced Gmail Login Example

### Phase 1: Strategic Planning
```
DIRECTOR: "I'll build a Gmail login flow. Let me create a comprehensive plan."

update_plan({
  overall_goal: "Build robust Gmail login with validation",
  current_phase: "Scout & Setup",
  phases: [
    {
      phase_name: "Scout & Setup", 
      status: "in_progress",
      tasks: [
        {task_id: 1, description: "Scout Gmail login flow", status: "pending"},
        {task_id: 2, description: "Store credentials", status: "pending"},
        {task_id: 3, description: "Build & validate navigation", status: "pending"}
      ]
    },
    {
      phase_name: "Login Execution",
      status: "pending", 
      tasks: [
        {task_id: 4, description: "Email entry with validation", status: "pending"},
        {task_id: 5, description: "Password entry with validation", status: "pending"},
        {task_id: 6, description: "Confirm successful login", status: "pending"}
      ]
    }
  ]
})
```

### Phase 2: Scout Deployment
```
DIRECTOR: "Let me deploy a Scout for detailed reconnaissance."

deploy_scout({
  mission: "Comprehensive Gmail login analysis",
  objectives: [
    "Document exact selectors with stability testing",
    "Identify all conditional flows (2FA, captcha, redirects)",
    "Measure precise timing requirements",
    "Test failure scenarios"
  ]
})

SCOUT REPORT: [Detailed findings with tested selectors]
```

### Phase 3: Incremental Building with Full Debugging
```
DIRECTOR: "Building incrementally with immediate validation."

// Store credentials
create_node({type: "context", config: {...}})

// Navigate with validation
create_node({type: "browser_action", config: {action: "navigate", url: "gmail.com"}})
create_node({
  type: "validation", 
  config: {
    conditions: [{type: "element_exists", selector: "#identifierId"}],
    onFailure: {action: "stop_workflow", errorMessage: "Gmail not accessible"}
  }
})

// Test first chunk
execute_nodes({nodeSelection: "1-3"})

EXECUTION RESULT: [Success with details]

CURRENT CONTEXT NOW SHOWS:
WORKFLOW VARIABLES:
- gmail_creds = {email: "user@gmail.com", password: "[hidden]"}
- node3.validationPassed = true

BROWSER STATE:
- Main Tab (Active) = https://accounts.google.com/signin/v2/identifier

DIRECTOR: "Navigation validated successfully. Continuing with email entry..."

[Continues building with immediate validation and debugging...]
```

### Phase 4: Advanced Debugging Scenario
```
DIRECTOR: "Email entry failed. Let me debug this comprehensively."

// Check current state
inspect_tab({
  tabName: "Main Tab",
  inspectionType: "lightweight_exploration", 
  instruction: "What's on the page? Any error messages?"
})

RESPONSE: "Page shows 'Something went wrong' message. No email field visible."

// Get full DOM for deeper analysis
inspect_tab({tabName: "Main Tab", inspectionType: "dom_snapshot"})

// Navigate to fresh state for testing
debug_navigate({
  url: "https://mail.google.com",
  tabName: "Main Tab",
  reason: "Reset to test fresh login flow"
})

// Test selector manually
debug_action({
  action: "click",
  selector: "#identifierId", 
  reason: "Test if email field selector works"
})

DIRECTOR: "Found the issue - need to wait for page load. Updating node..."
```

## Implementation Architecture

### Backend Services
1. **ContextBuilder** - Assembles 6-part context structure
2. **VariableManager** - Handles variable chunking and CRUD
3. **BrowserStateService** - Live browser tab information
4. **PlanManager** - Structured plan storage and updates
5. **ValidationEngine** - Business invariant checking
6. **DebugNavigator** - Separate debugging browser actions

### Frontend Control Panel
- **Plan Viewer**: Interactive to-do list with real-time updates
- **Variable Inspector**: Chunked display with expand/collapse
- **Browser Monitor**: Live tab state and debugging controls
- **Context Monitor**: Real-time context size and compression

### Database Schema
```sql
-- Enhanced plan storage
CREATE TABLE director_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id),
  plan_version integer DEFAULT 1,
  plan_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Additional tables for enhanced features as needed
```

## Success Metrics & Benefits

### Immediate Benefits
- **90%+ node success rate** on first attempt
- **75% reduction** in debugging time
- **Complete workflow visibility** at all times
- **Surgical debugging capabilities** for complex failures
- **Zero surprises** - Director sees everything

### Long-term Benefits  
- **Pattern library** grows automatically from successful workflows
- **Intelligent suggestions** based on historical data
- **Failure prediction** through business invariant monitoring
- **Self-improving system** that learns from every interaction

## Migration Strategy

### Implementation Phases
1. **Phase 1 (Weeks 1-2)**: Core infrastructure (planning, context, variables)
2. **Phase 2 (Weeks 3-4)**: Validation and testing tools
3. **Phase 3 (Weeks 5-6)**: Browser debugging and advanced tools
4. **Phase 4 (Weeks 7-8)**: Frontend integration and polish

### Rollout Approach
- New workflows use Director 2.0 methodology immediately
- Existing workflows remain functional during transition
- Gradual enhancement of existing workflows when modified
- Comprehensive metrics tracking throughout migration

## Conclusion

Director 2.0 represents a fundamental evolution from "hope it works" to "know it works" workflow building. With comprehensive state visibility, advanced debugging tools, and incremental validation, the Director becomes a true workflow engineering assistant capable of building robust, reliable automations.

The combination of structured planning, real-time state visibility, business-level invariants, and surgical debugging capabilities creates a system that not only builds better workflows but continuously learns and improves with each interaction.

This isn't just an incremental improvement - it's a complete reimagining of how AI systems should build and debug complex automations.