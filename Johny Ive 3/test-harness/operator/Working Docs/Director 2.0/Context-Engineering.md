# Context Engineering: Director 2.0 Context Management

## Overview

This document defines the structured context management strategy for Director 2.0. The goal is to maintain clear, consistent context while avoiding redundant information and enabling effective conversation compression.

## Context Structure

Every Director conversation follows this exact 6-part structure:

```
(1) SYSTEM PROMPT
    You are Director, an AI workflow builder... [complete system prompt]

(2) CURRENT PLAN  
    [JSON structured plan with to-do items and status]

(3) WORKFLOW SNAPSHOT
    [Complete current workflow state as JSON from database]

(4) WORKFLOW VARIABLES
    [Chunked display of current variable state with debugging tools]

(5) BROWSER STATE
    [Real-time browser tab information and debugging tools]

(6) CONVERSATION HISTORY
    [Filtered chat history excluding past system prompts, plans, and workflow JSONs]
```

## Part 1: System Prompt

**Source**: Always the latest version from `directorPrompt.js`
**Updates**: When system prompt is updated in code, all new contexts use the new version
**Size**: ~2-3K tokens

## Part 2: Current Plan

### Structure
```json
{
  "workflow_id": "uuid",
  "plan_version": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z",
  "overall_goal": "Build Gmail to Airtable email extraction workflow",
  "current_phase": "Gmail Login Setup",
  "phases": [
    {
      "phase_name": "Gmail Login Setup",
      "status": "in_progress", // "pending", "in_progress", "completed", "failed"
      "tasks": [
        {
          "task_id": 1,
          "description": "Scout Gmail login flow",
          "status": "completed",
          "notes": "Found stable selectors: #identifierId, #identifierNext"
        },
        {
          "task_id": 2, 
          "description": "Build navigation node",
          "status": "completed",
          "node_ids": ["node_123"]
        },
        {
          "task_id": 3,
          "description": "Build and validate email entry",
          "status": "in_progress",
          "node_ids": ["node_124", "node_125"]
        }
      ]
    },
    {
      "phase_name": "Email Extraction",
      "status": "pending",
      "tasks": [
        {
          "task_id": 4,
          "description": "Extract email list from inbox",
          "status": "pending"
        }
      ]
    }
  ],
  "next_actions": [
    "Test email entry validation node",
    "Build password entry if email validation succeeds"
  ],
  "blockers": [],
  "notes": "Gmail redirects to accounts.google.com as expected"
}
```

### Management
- **Storage**: `director_plans` table in Supabase
- **Updates**: Via `update_plan` tool (replaces entire plan)
- **Frontend**: Rendered as interactive to-do list
- **Versioning**: Each update creates new version, keeps history

### Database Schema
```sql
CREATE TABLE director_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id),
  plan_version integer DEFAULT 1,
  plan_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

## Part 3: Workflow Snapshot

**Source**: Complete current workflow from database
**Content**: 
- Workflow metadata
- All nodes with their current configuration
- Node positions and relationships
- NO execution results (pulled separately when needed)

**Format**:
```json
{
  "workflow": {
    "id": "uuid",
    "name": "Gmail to Airtable Sync",
    "created_at": "...",
    "updated_at": "..."
  },
  "nodes": [
    {
      "id": "node_123",
      "position": 1,
      "type": "browser_action",
      "config": {
        "action": "navigate",
        "url": "https://mail.google.com"
      },
      "description": "Navigate to Gmail",
      "status": "success" // latest execution status
    }
    // ... more nodes
  ]
}
```

## Part 4: Workflow Variables (NEW!)

### Chunked Variable Display
The Director receives current workflow variable state with each API call:

```
WORKFLOW VARIABLES:
- gmail_creds = {email: "user@gmail.com", password: "[hidden]"}
- node4.loginRequired = true  
- node7.emails = [{"sender": "investor@vc.com", "subject": "Re: Funding"}, {"sender": "startup@...
- node10.selectedEmail = {sender: "investor@vc.com", subject: "Re: Funding", content: "Hi, we're inte...
- search_results = [Array of 8 results - first: {"title": "Gmail API", "url": "https://developers...
- current_page = "gmail_inbox"
```

### Display Rules:
- **Short variables** (≤100 chars): Show in full
- **Long variables** (>100 chars): Show first 100 chars + "..."
- **Sensitive data**: Passwords/keys shown as "[hidden]"
- **Arrays**: Show first element + count info
- **Empty variables**: Show as "[] (empty)" or "null"

### Variable Debugging Tools:

```javascript
// Get full variable content
get_workflow_variable({
  variableName: "node7.emails", // specific variable
  nodeId: 7 // alternative - get all variables from node 7
  // or use "all" to get complete variable dump
})

// Set variable for debugging
set_variable({
  variableName: "test_email",
  value: "debug@test.com",
  reason: "Override email for testing login flow"
})

// Clear specific variable
clear_variable({
  variableName: "node7.emails", 
  reason: "Reset to test email extraction again"
})

// Clear all variables (fresh workflow state)
clear_all_variables({
  reason: "Reset entire workflow state for clean test"
})
```

### Benefits:
- **Immediate visibility** into data flow between nodes
- **Context efficient** with chunked display
- **Perfect debugging** - see exactly what each node produced
- **Manual control** for testing edge cases

## Part 5: Browser State

### Real-time Browser Context
The Director receives live browser state information with each API call:

```
BROWSER STATE:
3 tabs open:
- Main Tab (Active) = https://mail.google.com/mail/u/0/#inbox
- Airtable Tab = https://airtable.com/app123/tbl456  
- Debug Tab = https://accounts.google.com/signin
```

### What's INCLUDED:
- Number of open tabs
- Tab names and current URLs
- Which tab is currently active
- Real-time updates after each Director action

### What's NOT INCLUDED by Default:
- DOM snapshots (retrieved only when Director requests)
- Page content or screenshots
- Browser cookies or storage state

### Debugging Tools Available:

#### Tab Inspection
```javascript
// Lightweight analysis
inspect_tab({
  tabName: "Main Tab",
  inspectionType: "lightweight_exploration",
  instruction: "What login elements are visible? Are we in 2FA?"
})

// Full DOM snapshot  
inspect_tab({
  tabName: "Main Tab",
  inspectionType: "dom_snapshot"
})
```

#### Director Navigation (Not Part of Workflow)
```javascript
// Navigate for debugging
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

// Tab management
debug_open_tab({url: "https://airtable.com", tabName: "Debug Tab"})
debug_close_tab({tabName: "Debug Tab"})
```

#### Key Features:
- **Batched Function Calls**: Director can perform multiple debugging actions in single API call
- **Workflow Separation**: Debugging actions don't appear in workflow nodes
- **Chat History Only**: Debug actions logged in conversation, not persisted
- **Real-time Updates**: Browser state refreshes with each Director response

## Part 6: Conversation History

### What's INCLUDED:
- User messages
- Director text responses  
- Tool calls (`create_node`, `update_plan`, `deploy_scout`, `debug_navigate`, etc.)
- Tool responses (Scout reports, node creation confirmations, debugging results)
- Execution results when Director tests nodes
- Director reasoning and explanations

### What's EXCLUDED:
- Previous system prompts
- Old plan versions  
- Old workflow snapshots
- Duplicate context attachments

### Example Filtered History:
```
User 1: Hi I would like to build a Gmail to Airtable workflow
Director 1: I'll help you build that workflow. Let me start by understanding your requirements...

calling_tool: update_plan
Tool Response: Plan updated successfully

Director 2: I've created an initial plan. Let me deploy a Scout to explore Gmail first.

calling_tool: deploy_scout  
Tool Response: Scout deployed successfully
Scout Report: "I found stable selectors for Gmail login: #identifierId for email, #identifierNext for next button..."

Director 3: Great findings! Based on the Scout report, I'll build the navigation node.

calling_tool: create_node
Tool Response: Node created with ID node_123

Director 4: Let me test this navigation node to ensure it works.

calling_tool: test_single_node
Tool Response: {"isSignInPage": true, "hasEmailField": true, "pageUrl": "https://accounts.google.com/signin"}

Director 5: Perfect! Navigation successful. Now I'll build the email entry node...
```

## Context Compression Strategy

### Trigger Point
- Compression activates at **180,000 tokens**
- Monitor context size after each message
- Trigger compression before adding next message would exceed limit

### Compression Process

1. **Preserve Fresh Context**:
   - System prompt (unchanged)
   - Current plan (unchanged)  
   - Current workflow snapshot (unchanged)
   - Current workflow variables (unchanged)
   - Current browser state (unchanged)

2. **Compress Conversation History**:
   - Use Director itself with compression prompt
   - Provide system prompt, plan, workflow, variables, browser state as context for compression
   - Target: Reduce conversation history to ~20K tokens

3. **Compression Prompt**:
```
You are the Director and your context window is getting full. Your job is to compress ONLY the conversation history while preserving all critical information needed to continue the workflow effectively.

CONTEXT FOR COMPRESSION:
- System Prompt: [full system prompt]
- Current Plan: [current plan JSON]
- Current Workflow: [workflow snapshot JSON]
- Current Variables: [workflow variables state]
- Browser State: [current browser tabs and state]

CONVERSATION HISTORY TO COMPRESS:
[full conversation history]

COMPRESSION INSTRUCTIONS:
1. Preserve all key decisions and reasoning
2. Keep Scout findings and recommendations  
3. Maintain workflow progression narrative
4. Include any important user preferences or constraints
5. Preserve error patterns and solutions found
6. Keep tool call results that informed decisions
7. Remove redundant explanations and verbose responses
8. Target output: ~20K tokens

Output the compressed conversation history that allows you to continue building this workflow effectively.
```

4. **Result**: New context window with:
   - Fresh system prompt
   - Current plan  
   - Current workflow
   - Current workflow variables
   - Current browser state
   - Compressed conversation history (~20K tokens)

## Implementation Requirements

### New Tools Needed

```javascript
// Update plan tool
{
  name: 'update_plan',
  description: 'Update the current workflow plan',
  parameters: {
    plan: 'Complete plan object (replaces existing plan)',
    reason: 'Why the plan is being updated'
  }
}

// Get current plan
{
  name: 'get_current_plan', 
  description: 'Retrieve the current plan',
  parameters: {}
}
```

### Backend Changes

1. **Context Builder Service**:
   ```javascript
   class ContextBuilder {
     async buildContext(workflowId) {
       const systemPrompt = getLatestSystemPrompt();
       const currentPlan = await getCurrentPlan(workflowId);
       const workflowSnapshot = await getWorkflowSnapshot(workflowId);
       const conversationHistory = await getFilteredHistory(workflowId);
       
       return {
         systemPrompt,
         currentPlan,
         workflowSnapshot,
         conversationHistory
       };
     }
   }
   ```

2. **Conversation Filter**:
   ```javascript
   function filterConversationHistory(messages) {
     return messages.filter(msg => {
       // Exclude system prompts, plans, workflow snapshots
       if (msg.role === 'system') return false;
       if (msg.content.includes('CURRENT PLAN:')) return false;
       if (msg.content.includes('WORKFLOW SNAPSHOT:')) return false;
       return true;
     });
   }
   ```

3. **Plan Management**:
   ```javascript
   async function updatePlan(workflowId, planData) {
     const newVersion = await getCurrentPlanVersion(workflowId) + 1;
     return await supabase.from('director_plans').insert({
       workflow_id: workflowId,
       plan_version: newVersion,
       plan_data: planData
     });
   }
   ```

### Frontend Changes

1. **Plan Viewer Component**:
   - Interactive to-do list UI
   - Phase-based organization
   - Task status indicators
   - Real-time updates when plan changes

2. **Context Size Monitor**:
   - Show current context size
   - Warning at 160K tokens
   - Compression trigger UI

## Benefits of This Approach

1. **Clarity**: Always know exactly what context the Director has
2. **Consistency**: Same structure every time, no context drift
3. **Efficiency**: No redundant information, focused context
4. **Scalability**: Compression allows unlimited conversation length
5. **Transparency**: User can see the plan and workflow state
6. **Persistence**: Plan survives context resets and server restarts

## Migration Plan

1. **Week 1**: Implement basic context structure and plan management
2. **Week 2**: Add conversation filtering and context builder
3. **Week 3**: Implement compression system
4. **Week 4**: Add frontend plan viewer and monitoring

This approach gives us the most controlled, transparent, and scalable context management while maintaining natural conversation flow.