# The Director: AI Workflow Designer

> **Note**: This component was previously called "Operator" but has been renamed to "Director" to clarify its role as the workflow designer, not the executor.

## Core Concept

The Director is an AI agent that **designs and constructs** automation workflows through human collaboration. It does NOT execute workflows in production - that's the job of the future Executor component.

Think of the Director as:
- An architect designing a building (not the construction crew)
- A choreographer planning a dance (not the dancer)
- A recipe developer (not the chef cooking)

## What the Director Does

### 1. Understands Intent
Converts user goals into technical workflow plans:
```
User: "I need to sync Gmail contacts to Airtable"
Director: "I'll design a workflow that:
  1. Authenticates with Gmail
  2. Searches for contacts
  3. Extracts relevant data
  4. Authenticates with Airtable
  5. Creates/updates records"
```

### 2. Deploys Scouts
When the Director needs to understand how a UI works:
```javascript
// Director deploys a scout to explore
const scoutReport = await deployScout({
  mission: "Find reliable selectors for Gmail search",
  url: "https://mail.google.com",
  objectives: ["search box", "search button", "result elements"]
});

// Uses findings to design robust workflow
const searchNode = createNodeFromScoutReport(scoutReport);
```

### 3. Constructs Workflows
Builds a blueprint that the Executor will later follow:
```javascript
{
  id: "gmail-airtable-sync",
  name: "Sync Gmail Contacts to Airtable CRM",
  nodes: [
    {
      type: "browser_action",
      action: "navigate",
      url: "https://mail.google.com",
      description: "Open Gmail"
    },
    {
      type: "browser_query",
      method: "wait_for",
      selector: "[aria-label='Search mail']",
      description: "Wait for Gmail to load"
    },
    // ... more nodes
  ]
}
```

### 4. Tests and Refines
The Director can test its designs in a sandbox:
- Verifies selectors work
- Checks timing requirements
- Handles edge cases
- Refines based on results

## What the Director Does NOT Do

### ❌ Production Execution
The Director designs workflows but doesn't run them in production. That's the Executor's job (future component).

### ❌ Real-time Automation
The Director is a careful planner, not a speed demon. It takes time to design robust workflows.

### ❌ Direct Browser Control
While it can test designs, the Director's main output is a workflow blueprint, not live browser actions.

## Architecture

```
Human Intent
    ↓
Director Brain (LLM)
    ↓
Scout Deployment ←→ DOM Exploration
    ↓
Workflow Construction
    ↓
Testing & Refinement
    ↓
Final Blueprint (JSON)
    ↓
[Future: Executor runs this]
```

## Implementation Phases

### Phase 1: Basic Designer (Current)
- Understand user goals
- Create simple linear workflows
- Basic node types (navigate, click, type)

### Phase 2: Scout Integration
- Deploy scouts for reconnaissance
- Use findings to build robust selectors
- Handle complex UI patterns

### Phase 3: Advanced Patterns
- Conditional logic
- Loops and iterations
- Error handling strategies
- Data transformations

### Phase 4: Learning System
- Remember successful patterns
- Suggest optimizations
- Transfer knowledge between similar UIs

## Working with the Director

### Interactive Design Session
```
Human: I need to extract investor emails from Gmail
Director: I'll help design that workflow. Let me understand the requirements:
- Which Gmail account?
- What identifies an "investor" email?
- Where should extracted emails go?