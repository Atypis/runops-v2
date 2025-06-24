# Operator Prototype Implementation Plan

## Core Decisions
- ✅ Chrome dev browser pops up separately (not embedded)
- ✅ User is the "eyes" - tells operator what's happening (no DOM flooding)
- ✅ Execution logs at bottom for debugging
- ✅ Supabase via MCP (you already have it set up!)
- ✅ No direct node editing - all changes through operator conversation

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Operator UI (localhost:3002)         │
├─────────────────────────┬───────────────────────────┤
│     Chat with Operator  │    Workflow Visualization  │
│                         │                             │
│ "I see a login page"    │    [1. Navigate Gmail] ✓   │
│                         │    [2. Type email] ⏳      │
│ "Ok, entering email..." │    [3. Click next] ⏸️      │
│                         │                             │
├─────────────────────────┴───────────────────────────┤
│                 Execution Logs                       │
│ [16:45:23] Navigating to https://mail.google.com    │
│ [16:45:25] Typing: michaelburner595@gmail.com       │
│ [16:45:26] ERROR: Cannot find selector #next-btn    │
└─────────────────────────────────────────────────────┘

[Separate Chrome Window - StageHand Browser]
```

## Quick Start Flow

### 1. Initialize Project
```bash
cd operator-prototype
npm init -y
npm install express cors openai @supabase/supabase-js dotenv
npm install --save-dev nodemon
```

### 2. Operator System Prompt
```javascript
const OPERATOR_PROMPT = `You are a Workflow Operator helping users build browser automation workflows.

IMPORTANT: You cannot see the browser directly. The user will describe what they see and you'll help them build the appropriate workflow nodes.

Your conversation pattern:
1. Understand their goal
2. Propose the next logical step
3. Create a node using the appropriate tool
4. Execute it
5. Ask the user what happened
6. Adjust based on their feedback

When the user reports an error, help them debug by:
- Asking what they see on screen
- Suggesting alternative selectors
- Proposing different approaches

Always be specific about what information you need from the user.`;
```

### 3. Tool Definitions for Operator
```javascript
const tools = [
  {
    name: "create_navigate_node",
    description: "Navigate to a URL",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to navigate to" },
        description: { type: "string", description: "What this navigation does" }
      },
      required: ["url", "description"]
    }
  },
  {
    name: "create_click_node",
    description: "Click an element on the page",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector or text to click" },
        description: { type: "string", description: "What this click does" }
      },
      required: ["selector", "description"]
    }
  },
  {
    name: "create_type_node",
    description: "Type text into an input field",
    parameters: {
      type: "object",
      properties: {
        selector: { type: "string", description: "CSS selector for the input" },
        text: { type: "string", description: "Text to type" },
        description: { type: "string", description: "What this input is for" }
      },
      required: ["selector", "text", "description"]
    }
  },
  {
    name: "execute_workflow",
    description: "Execute all pending nodes in the workflow",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  },
  {
    name: "execute_single_node",
    description: "Execute just one specific node",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "integer", description: "The node ID to execute" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "modify_node",
    description: "Modify an existing node based on user feedback",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "integer", description: "The node to modify" },
        updates: { type: "object", description: "The updates to apply" }
      },
      required: ["nodeId", "updates"]
    }
  }
];
```

### 4. Backend Structure
```javascript
// server.js
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Stagehand } from '@browserbasehq/stagehand';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Initialize services
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const openai = new OpenAI();
let stagehand = null;
let currentWorkflow = null;
let executionLogs = [];

// Operator chat endpoint
app.post('/chat', async (req, res) => {
  const { message, workflowId } = req.body;
  
  // Get operator response with function calling
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [
      { role: "system", content: OPERATOR_PROMPT },
      ...conversationHistory,
      { role: "user", content: message }
    ],
    tools: tools,
    tool_choice: "auto"
  });
  
  // Process any tool calls
  if (response.choices[0].message.tool_calls) {
    // Handle node creation, execution, etc.
  }
  
  res.json({ 
    response: response.choices[0].message.content,
    workflow: currentWorkflow,
    logs: executionLogs.slice(-10) // Last 10 logs
  });
});

// Initialize StageHand when starting workflow
app.post('/workflow/start', async (req, res) => {
  const { goal } = req.body;
  
  // Initialize browser
  stagehand = new Stagehand({
    env: 'LOCAL',
    headless: false,
    verbose: 1
  });
  await stagehand.init();
  
  // Create workflow in Supabase
  const { data: workflow } = await supabase
    .from('workflows')
    .insert({ goal, status: 'building' })
    .select()
    .single();
    
  currentWorkflow = workflow;
  res.json({ workflow });
});
```

### 5. Frontend Components
```jsx
// app.js
function OperatorApp() {
  const [messages, setMessages] = useState([]);
  const [workflow, setWorkflow] = useState(null);
  const [logs, setLogs] = useState([]);
  const [input, setInput] = useState('');
  
  const sendMessage = async (message) => {
    // Add user message
    setMessages([...messages, { role: 'user', content: message }]);
    
    // Get operator response
    const response = await fetch('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message, 
        workflowId: workflow?.id 
      })
    });
    
    const data = await response.json();
    setMessages([...messages, 
      { role: 'user', content: message },
      { role: 'assistant', content: data.response }
    ]);
    setWorkflow(data.workflow);
    setLogs(data.logs);
  };
  
  return (
    <div className="flex h-screen">
      {/* Chat Panel */}
      <div className="w-1/2 p-4 border-r">
        <div className="h-5/6 overflow-y-auto">
          {messages.map((msg, i) => (
            <ChatMessage key={i} {...msg} />
          ))}
        </div>
        <div className="h-1/6">
          <input 
            className="w-full p-2 border rounded"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                sendMessage(input);
                setInput('');
              }
            }}
            placeholder="Tell operator what you see..."
          />
        </div>
      </div>
      
      {/* Workflow Panel */}
      <div className="w-1/2 p-4">
        <h2 className="text-xl font-bold mb-4">Workflow</h2>
        <div className="space-y-2">
          {workflow?.nodes?.map((node, i) => (
            <WorkflowNode key={i} node={node} index={i + 1} />
          ))}
        </div>
      </div>
      
      {/* Logs Panel */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gray-900 text-green-400 p-2 overflow-y-auto font-mono text-sm">
        {logs.map((log, i) => (
          <div key={i}>[{log.timestamp}] {log.message}</div>
        ))}
      </div>
    </div>
  );
}
```

### 6. Supabase Schema (via MCP)
```sql
-- Workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal TEXT NOT NULL,
  status TEXT DEFAULT 'building',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Nodes table  
CREATE TABLE nodes (
  id SERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  position INTEGER NOT NULL,
  type TEXT NOT NULL,
  params JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  result JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Execution logs
CREATE TABLE execution_logs (
  id SERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  node_id INTEGER REFERENCES nodes(id),
  timestamp TIMESTAMP DEFAULT NOW(),
  level TEXT, -- info, error, success
  message TEXT
);
```

## Execution Flow Example

```
User: "I want to extract emails from Gmail"

Operator: "I'll help you build that workflow. Let me start by navigating to Gmail."
[Creates navigate node → https://mail.google.com]
[Executes]

Operator: "I've navigated to Gmail. What do you see on the screen?"

User: "I see a login page with an email input field"

Operator: "Good, I'll create a node to enter your email. What email should I use?"

User: "Use test@example.com"

Operator: "Creating a node to type that email. Can you describe the email input field? Any placeholder text or labels?"

User: "It says 'Email or phone'"

[Creates type node with selector based on description]
[Executes]

Operator: "I've tried to enter the email. Did it work? What do you see now?"

User: "Yes, the email is entered. Now there's a blue 'Next' button"

[Continues building workflow interactively...]
```

## Key Benefits of This Approach

1. **No DOM flooding** - Operator never sees the raw DOM
2. **Human in the loop** - User provides visual context
3. **Natural debugging** - "It didn't work" → "What do you see?"
4. **Learn by doing** - Operator learns what works through user feedback
5. **Simple to implement** - Just chat + function calling + basic execution

## Next Steps

1. Set up basic Express server with OpenAI
2. Create simple chat UI
3. Implement core tool functions
4. Add StageHand execution
5. Connect to Supabase for persistence

This gives you a working prototype in ~3 hours that demonstrates the core interaction pattern!