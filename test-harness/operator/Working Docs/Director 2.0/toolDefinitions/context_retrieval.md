# Context Retrieval Function Group Documentation

## Overview
The Context Retrieval function group consists of 4 read-only functions that allow the Director to access different aspects of the workflow state without making any modifications. These functions are essential for the Director's context awareness and decision-making process.

## Functions

### 1. get_current_plan
**Purpose**: Retrieves the latest workflow plan including phases, tasks, and progress tracking.

**Implementation**: 
- Service: `planService.js`
- Method: `getCurrentPlan(workflowId)`
- Database: `director_plans` table

**Key Features**:
- Returns the most recent version of the plan (ordered by `plan_version` DESC)
- Gracefully handles missing plans (returns null)
- Includes metadata: update timestamp, reason for last update, version number
- Maintains full version history

**Return Structure**:
```javascript
{
  workflow_id: "uuid",
  plan_version: 5,
  plan_data: {
    overall_goal: "Implement email automation workflow",
    current_phase: "Email Extraction",
    phases: [
      {
        phase_name: "Gmail Login Setup",
        status: "completed",
        tasks: [
          {
            task_id: 1,
            description: "Scout Gmail login flow",
            status: "completed",
            node_ids: ["login_nav", "enter_email"],
            notes: "OAuth redirect handled"
          }
        ]
      }
    ],
    next_actions: ["Extract email list", "Setup iteration"],
    blockers: [],
    notes: "Gmail uses OAuth flow, not simple login",
    _metadata: {
      update_reason: "Completed login phase",
      updated_at: "2024-03-15T10:30:00Z",
      version: 5
    }
  },
  created_at: "timestamp",
  updated_at: "timestamp"
}
```

**Usage in Director Context**:
- Called during context building to show current implementation progress
- Critical for maintaining continuity across conversation turns
- Helps Director understand what has been attempted and what's next

### 2. get_workflow_nodes
**Purpose**: Retrieves and filters workflow nodes with their current state and configuration.

**Implementation**:
- Service: `directorService.js` (inline implementation)
- Method: Uses `getWorkflowContext()` then filters/formats
- Database: `workflows` and `nodes` tables (joined)

**Parameters**:
- `range`: "all" | "recent" | "1-10" (specific range)
- `type`: Optional filter by node type (e.g., "browser_action", "route")

**Key Features**:
- Supports flexible filtering by position range or node type
- Returns formatted node information for easy consumption
- Shows execution status and result availability
- Maintains node position ordering

**Return Structure**:
```javascript
[
  {
    position: 1,
    type: "browser_action",
    description: "Navigate to Gmail",
    status: "completed",
    alias: "nav_gmail",
    result: "Has result"
  },
  {
    position: 2,
    type: "browser_ai_query",
    description: "Check if logged in",
    status: "completed",
    alias: "check_login",
    result: "Has result"
  }
]
```

**Usage in Director Context**:
- Essential for understanding current workflow structure
- Helps Director reference existing nodes correctly
- Shows execution status to guide next actions
- Used when Director needs to update or reference specific nodes

### 3. get_workflow_description
**Purpose**: Retrieves the high-fidelity workflow requirements that serve as the authoritative contract.

**Implementation**:
- Service: `workflowDescriptionService.js`
- Method: `getCurrentDescription(workflowId)`
- Database: `workflow_descriptions` table

**Key Features**:
- Returns the most recent version (ordered by `description_version` DESC)
- Includes formatted summary via `getDescriptionSummary()`
- Maintains full revision history
- Gracefully handles missing descriptions

**Return Structure**:
```javascript
{
  workflow_id: "uuid",
  description_version: 3,
  description_data: {
    workflow_name: "Gmail to Airtable Integration",
    goal: "Extract investor emails and sync to Airtable",
    trigger: "Manual execution",
    actors: {
      gmail_account: "user@gmail.com",
      airtable_base: "appXXXXXX"
    },
    happy_path_steps: [
      "1. Login to Gmail",
      "2. Navigate to investor label",
      "3. Extract email metadata"
    ],
    decision_matrix: {
      "no_emails_found": "Log and exit gracefully",
      "login_failed": "Retry 3x then alert user"
    },
    data_contracts: {
      email_record: {
        sender: "string",
        subject: "string",
        date: "ISO date",
        body_snippet: "string (first 200 chars)"
      }
    },
    business_rules: [
      "Only process unread emails",
      "Max 50 emails per run"
    ],
    edge_case_policies: {
      "rate_limit": "Wait 60s and retry",
      "network_error": "Exponential backoff"
    },
    success_criteria: [
      "All unread investor emails processed",
      "Airtable records created with correct schema"
    ],
    revision_history: [
      {
        version: 1,
        date: "2024-03-14T08:00:00Z",
        author: "director",
        changes: "Initial requirements capture"
      }
    ],
    _metadata: {
      update_reason: "Added rate limiting policy",
      updated_at: "2024-03-15T09:00:00Z",
      version: 3
    }
  }
}
```

**Usage in Director Context**:
- The "what" that guides all implementation decisions
- Reference point for validating implementation against requirements
- Changed rarely, only when requirements genuinely evolve
- Critical for maintaining alignment with user expectations

### 4. get_browser_state
**Purpose**: Retrieves current browser session information including open tabs and active tab.

**Implementation**:
- Service: `browserStateService.js`
- Method: `getBrowserStateContext(workflowId)`
- Database: `browser_state` table

**Key Features**:
- Real-time state tracking with SSE support
- Formatted human-readable output
- Shows all open tabs with URLs
- Indicates currently active tab
- Gracefully handles no browser session

**Return Format**:
```
BROWSER STATE:
3 tabs open:
- main (Active) = https://mail.google.com/mail/u/0/#inbox
- airtable = https://airtable.com/appXXXXX/tblYYYYY
- oauth = https://accounts.google.com/signin/oauth
```

**Raw Structure** (internal):
```javascript
{
  workflow_id: "uuid",
  tabs: [
    {
      name: "main",
      url: "https://mail.google.com/mail/u/0/#inbox"
    },
    {
      name: "airtable",
      url: "https://airtable.com/appXXXXX/tblYYYYY"
    }
  ],
  active_tab_name: "main",
  updated_at: "2024-03-15T10:45:00Z"
}
```

**Usage in Director Context**:
- Essential for multi-tab workflow debugging
- Helps Director understand current browser context
- Guides tab switching decisions
- Shows OAuth flows and redirects in real-time

## Integration with Director Context

These four functions are automatically called during context assembly to populate the Director's 7-part context structure:

1. **System Prompt** - Operating instructions
2. **Workflow Description** - Retrieved via `get_workflow_description`
3. **Current Plan** - Retrieved via `get_current_plan`
4. **Workflow Snapshot** - Retrieved via `get_workflow_nodes`
5. **Workflow Variables** - (separate system)
6. **Browser State** - Retrieved via `get_browser_state`
7. **Conversation History** - (managed separately)

## Best Practices

### When to Call These Functions Explicitly

1. **get_current_plan**
   - After significant progress to review next steps
   - When unsure about current phase or blockers
   - To check specific task details not shown in context

2. **get_workflow_nodes**
   - When you need to reference a specific node by position
   - To check execution status of a particular section
   - When filtering by node type for targeted updates

3. **get_workflow_description**
   - To review specific business rules or edge cases
   - When making decisions that might affect requirements
   - To check data contracts before building

4. **get_browser_state**
   - When debugging multi-tab workflows
   - Before attempting tab switches
   - To verify current browser context

### Performance Considerations

- These functions are read-only and lightweight
- Called automatically on each Director interaction
- No need to call them repeatedly in the same conversation turn
- Context is automatically refreshed with each new message

### Error Handling

All functions gracefully handle:
- Missing data (return null or appropriate message)
- Database errors (return fallback values)
- Malformed data (defensive parsing)

This ensures the Director always has some context to work with, even if partial.

## Common Patterns

### Checking Progress Before Building
```javascript
// Director checks current progress
const plan = await get_current_plan();
const currentPhase = plan?.plan_data?.current_phase;
const pendingTasks = plan?.plan_data?.phases
  ?.find(p => p.phase_name === currentPhase)
  ?.tasks.filter(t => t.status === 'pending');
```

### Verifying Node Existence
```javascript
// Before referencing a node
const nodes = await get_workflow_nodes({ range: "1-10" });
const loginNode = nodes.find(n => n.alias === "login_nav");
if (!loginNode) {
  // Build the login navigation first
}
```

### Multi-Tab Debugging
```javascript
// Check browser state before tab operations
const browserState = await get_browser_state();
// Returns formatted string, but Director understands the structure
// "3 tabs open:\n- main (Active) = https://..."
```

## Future Considerations

1. **Caching**: Currently no caching, each call hits the database
2. **Permissions**: No workflow ownership validation (assumes Director has access)
3. **History**: Only current versions returned (full history available in tables)
4. **Real-time**: Browser state has SSE support, others are polling-based

These functions form the foundation of the Director's situational awareness, enabling intelligent decision-making based on comprehensive workflow context.