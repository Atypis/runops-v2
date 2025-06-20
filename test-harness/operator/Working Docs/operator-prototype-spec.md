# Operator Prototype Specification

## Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────┬───────────────────────────────────┤
│     Chat Interface      │      Workflow Visualizer          │
│  "Extract emails from   │   ┌─────────────────┐            │
│   Gmail to Airtable"    │   │ 1. Navigate     │            │
│                         │   │    gmail.com    │            │
│  "Sure! First I'll     │   └────────┬────────┘            │
│   navigate to Gmail"    │            ↓                      │
│                         │   ┌─────────────────┐            │
│  [Operator adds node]   │   │ 2. Check Auth   │            │
│                         │   │    ...          │            │
└─────────────────────────┴───────────────────────────────────┘
                                    ↑
                                    │
┌─────────────────────────────────────────────────────────────┐
│                     Operator Backend                         │
│  - LLM with system prompt                                   │
│  - Tool calling for node creation                           │
│  - State awareness                                          │
│  - Execution engine                                         │
└─────────────────────────────────────────────────────────────┘
                                    ↑
                                    │
┌─────────────────────────────────────────────────────────────┐
│                    Storage (Supabase)                        │
│  - Workflows table                                          │
│  - Nodes table                                              │
│  - Execution history                                        │
│  - Learned patterns                                         │
└─────────────────────────────────────────────────────────────┘
```

## 1. Frontend Components

### Chat Interface (Left Panel)
```jsx
// Simple chat with operator
<ChatPanel>
  <Message from="user">
    Extract investor emails from Gmail and add them to Airtable
  </Message>
  <Message from="operator">
    I'll help you build a workflow for that. First, I'll navigate to Gmail.
    [Adding navigation node...]
  </Message>
  <Message from="operator" type="confirmation">
    Should I proceed with navigating to https://mail.google.com?
    [Confirm] [Modify] [Skip]
  </Message>
</ChatPanel>
```

### Workflow Visualizer (Right Panel)
```jsx
// Real-time workflow building
<WorkflowPanel>
  <WorkflowNode 
    id={1}
    type="navigate"
    status="pending"
    data={{
      url: "https://mail.google.com",
      description: "Navigate to Gmail"
    }}
  />
  <WorkflowNode 
    id={2}
    type="check"
    status="building"
    data={{
      description: "Check if logged in..."
    }}
  />
</WorkflowPanel>
```

### Live Browser View (Optional for MVP)
- Small preview window showing current state
- Or just screenshots at key moments

## 2. Operator Tools

### System Prompt
```
You are a Workflow Operator that helps users build browser automation workflows through conversation.

Your capabilities:
- Understand user goals and break them into steps
- Create workflow nodes using tool calls
- Execute nodes and observe results
- Learn from failures and adjust
- Ask for human help when uncertain

Workflow Building Process:
1. Understand the goal completely
2. Propose next logical step
3. Create node with appropriate parameters
4. Get confirmation for critical actions
5. Execute and observe results
6. Adjust based on what happened

Always:
- Explain what you're doing
- Preview actions before data changes
- Learn from corrections
- Build incrementally
```

### Tool Definitions
```typescript
interface OperatorTools {
  // Navigation
  createNavigateNode(params: {
    url: string;
    description: string;
    waitForSelector?: string;
  }): WorkflowNode;

  // Interaction
  createClickNode(params: {
    selector: string;
    description: string;
    confirmBefore?: boolean;
  }): WorkflowNode;

  createTypeNode(params: {
    selector: string;
    text: string;
    description: string;
    confirmBefore?: boolean;
  }): WorkflowNode;

  // Extraction
  createExtractNode(params: {
    instruction: string;
    schema: object;
    description: string;
  }): WorkflowNode;

  // Control Flow
  createConditionalNode(params: {
    condition: string;
    trueBranch: string;
    falseBranch: string;
    description: string;
  }): WorkflowNode;

  createLoopNode(params: {
    over: string;
    body: string;
    description: string;
  }): WorkflowNode;

  // Execution
  executeNode(nodeId: number): ExecutionResult;
  
  // State
  getCurrentState(): BrowserState;
  getWorkflowState(): WorkflowState;
  
  // Learning
  markSuccess(nodeId: number): void;
  reportIssue(nodeId: number, issue: string): void;
}
```

## 3. Database Schema (Supabase)

### Workflows Table
```sql
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT DEFAULT 'building', -- building, ready, failed
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Nodes Table
```sql
CREATE TABLE nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id),
  position INTEGER NOT NULL,
  type TEXT NOT NULL, -- navigate, click, type, extract, etc
  params JSONB NOT NULL,
  status TEXT DEFAULT 'pending', -- pending, executing, success, failed
  result JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Patterns Table (for learning)
```sql
CREATE TABLE patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger TEXT NOT NULL, -- "Gmail login page"
  solution JSONB NOT NULL, -- Reusable node sequence
  confidence FLOAT DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP
);
```

## 4. Core Implementation Flow

### Startup
```javascript
// Initialize
const operator = new WorkflowOperator({
  llm: 'gpt-4',
  browser: stagehand,
  storage: supabase
});

// Start conversation
operator.startWorkflow("Extract investor emails from Gmail to Airtable");
```

### Building Loop
```javascript
while (!workflow.complete) {
  // Operator proposes next step
  const proposal = await operator.proposeNextStep();
  
  // Create node (via tool call)
  const node = await operator.createNode(proposal);
  
  // Get confirmation if needed
  if (node.requiresConfirmation) {
    const confirmed = await frontend.getConfirmation(node);
    if (!confirmed) continue;
  }
  
  // Execute
  const result = await operator.executeNode(node);
  
  // Learn from result
  await operator.processResult(result);
}
```

## 5. MVP Feature Set

### Must Have
- [ ] Chat interface for natural language interaction
- [ ] Basic node types: navigate, click, type, extract
- [ ] Visual workflow builder showing nodes
- [ ] Confirmation flow for critical actions
- [ ] Basic execution with StageHand
- [ ] Simple state tracking

### Nice to Have
- [ ] Browser preview window
- [ ] Node editing after creation
- [ ] Pattern learning/recognition
- [ ] Workflow export/import
- [ ] Error recovery suggestions

### Skip for MVP
- Complex control flow (loops, conditionals)
- Multi-tab handling
- Advanced data transformations
- User authentication
- Workflow sharing

## 6. Tech Stack

### Frontend
```json
{
  "ui": "React (no build step, just babel standalone)",
  "styling": "Tailwind CSS",
  "state": "Simple React state (no Redux)",
  "api": "Fetch to backend"
}
```

### Backend
```json
{
  "server": "Express.js",
  "llm": "OpenAI GPT-4 with function calling",
  "browser": "StageHand",
  "database": "Supabase (or local SQLite for true local)",
  "runtime": "Node.js"
}
```

## 7. File Structure
```
operator-prototype/
├── frontend/
│   ├── index.html
│   ├── app.js (React components)
│   └── style.css
├── backend/
│   ├── server.js
│   ├── operator.js (main logic)
│   ├── tools.js (operator tools)
│   └── prompts.js
├── shared/
│   └── types.js
└── supabase/
    └── schema.sql
```

## 8. Key Decisions

### Confirmation Strategy
- **Auto-execute**: Navigation, waits, reads
- **Confirm first**: Inputs, clicks, data changes
- **Detailed confirm**: Loops, branches, complex logic

### State Management
- Operator maintains conversation context
- Each node execution updates state
- Browser state checked before each action

### Error Handling
- Operator recognizes failures
- Proposes alternatives
- Learns from corrections

## 9. Example Interaction

```
User: "Extract investor emails from Gmail to Airtable"

Operator: "I'll help you build a workflow for that. Let me start by navigating to Gmail."
[Creates navigate node → gmail.com]

Operator: "I can see Gmail is asking for login. I'll need your email address."
[Creates type node → email field]

User: "Use michaelburner595@gmail.com"

Operator: "Got it. I'll enter that email."
[Confirms and executes]

Operator: "Now I see it's asking for a password. For security, I'll let you enter this manually. Should I wait for you to complete login?"
[Creates wait node with manual instruction]

User: "Yes, I'll login now"

[Process continues iteratively...]
```

## What's Missing?

1. **Execution Feedback Loop**: How does operator know what happened after execution?
2. **State Persistence**: How do we resume interrupted workflows?
3. **Pattern Matching**: When does operator suggest "I've seen this before"?
4. **Rollback**: What if user wants to undo/modify previous steps?
5. **Export Format**: How do we save the final workflow for reuse?

These can be figured out during implementation based on what feels natural.