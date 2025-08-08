# Operator System - Single Source of Truth

## 1. Project Overview

### Goal
The Operator is an AI-powered workflow builder that helps users create browser automation workflows through natural conversation. It acts as an intelligent assistant that understands user intent and builds workflows step-by-step using a set of primitive operations.

### Key Concept
- Users describe what they want to achieve in plain language
- The Operator translates this into executable workflow nodes
- Workflows are built incrementally with user feedback
- The system executes these workflows using StageHand for browser automation

## 2. Project Structure

### Working Directory
**PRIMARY**: `/Users/a1984/runops-v2/Johny Ive 3/test-harness/operator/`

### Critical Directories
```
test-harness/operator/
├── backend/
│   ├── server.js                 # Main server (port 3002)
│   ├── services/
│   │   ├── nodeExecutor.js       # ⭐ EXECUTES WORKFLOW NODES
│   │   └── operatorService.js   # Handles operator AI logic
│   ├── prompts/
│   │   └── operatorPrompt.js    # ⭐ OPERATOR SYSTEM PROMPT & NODE GUIDELINES
│   └── config/
│       └── supabase.js          # Database connection
├── frontend/                    # Operator UI
└── Working Docs/
    ├── operator.md             # High-level operator concept
    └── operator-plan.md        # THIS FILE - Single source of truth
```

### Important: What Lives Where
- **Node Execution**: `/operator/backend/services/nodeExecutor.js` (NOT in test-harness/workflows/executor/primitives!)
- **Operator Prompt**: `/operator/backend/prompts/operatorPrompt.js`
- **Database**: Supabase (nodes, workflows, context stored here)

## 3. System Architecture

### Components
1. **Operator AI** (operatorService.js)
   - Uses Claude to understand user intent
   - Creates workflow nodes based on conversation
   - Manages workflow building process

2. **Node Executor** (nodeExecutor.js)
   - Executes individual workflow nodes
   - Integrates with StageHand for browser automation
   - Handles variable resolution and context management

3. **Database** (Supabase)
   - `workflows` table: Workflow metadata
   - `nodes` table: Individual workflow nodes
   - `workflow_context` table: Runtime variables/state

### Node Types (The 9 Primitives)
1. **browser_action** - Side effects (click, type, navigate, wait)
2. **browser_query** - Read data (extract, observe)
3. **cognition** - AI reasoning
4. **transform** - Data manipulation
5. **iterate** - Loops
6. **route** - Conditional branching
7. **handle** - Error handling
8. **context** - State management
9. **checkpoint** - Save/restore state

## 4. Key Implementation Details

### Variable Resolution
- Format: `{{variableName}}` or `{{nested.path}}`
- Resolved from `workflow_context` table
- Implemented in: `nodeExecutor.js::resolveVariable()`

### Schema Handling
- Operator sends simple format: `{"field": "type"}`
- Converted to Zod schemas for StageHand
- Implemented in: `nodeExecutor.js::convertJsonSchemaToZod()`

### Browser Automation
- Uses StageHand library
- Single browser instance shared across workflow
- Tab management supported (openNewTab, switchTab)

### Browser Tab Management
**Implementation**: Each tab is a StagehandPage instance with act/extract/observe capabilities

**Key Concepts**:
1. **Active Tab Tracking**: System maintains `activeTabName` to track current tab
2. **Auto-Switch on Open**: `openNewTab` automatically makes the new tab active
3. **Explicit Switching**: Use `switchTab` to change active tab
4. **Context Persistence**: ALL operations (click, type, extract, observe, act) operate on active tab

**Technical Details**:
- StagehandPages created via `stagehand.context.newPage()`
- Stored in `nodeExecutor.stagehandPages` by name
- `getActiveStagehandPage()` helper ensures correct tab targeting
- Fixed 2024-06-24: Direct page assignment issue resolved

## 5. Development Workflow

### Running the Operator
```bash
cd /Users/a1984/runops-v2/Johny\ Ive\ 3/test-harness/operator
npm start
# Runs on http://localhost:3002
```

### Making Changes
1. **Node Execution Logic**: Edit `backend/services/nodeExecutor.js`
2. **Operator Behavior**: Edit `backend/prompts/operatorPrompt.js`
3. **Frontend**: Edit files in `frontend/`
4. **Restart Required**: After backend changes, Ctrl+C and `npm start`

### Common Pitfalls
- ❌ Don't edit `/test-harness/workflows/executor/primitives/` - that's a different system!
- ❌ Don't confuse test-harness server (port 3001) with operator server (port 3002)
- ✅ Always work in `/test-harness/operator/` directory
- ✅ Restart operator server after backend changes

## 6. Current Implementation Status

### Working Features
- ✅ Basic node creation and workflow building
- ✅ Browser automation (navigate, click, type, wait)
- ✅ Context storage and retrieval
- ✅ Route visualization in frontend
- ✅ Iterate visualization in frontend
- ✅ Simple schema format support
- ✅ Variable interpolation with {{syntax}}

### Known Issues
- 🔧 Schema conversion needs proper error handling
- 🔧 Variable resolution needs better error messages
- 🔧 Tab management needs more testing

### Recent Fixes (2024-06-24)
1. Added schema conversion for simple format `{"field": "type"}`
2. Added variable resolution for `{{variable}}` syntax
3. Fixed multi-tab support - all operations now target active tab correctly
4. Reduced log noise by filtering StageHand OpenAI logs
5. Fixed syntax errors in operatorPrompt.js (triple backticks in template literals)

## 7. Testing Workflows

### Gmail Login Example
```javascript
// Nodes created by operator:
1. context.set: Store credentials
2. browser_action.navigate: Go to Gmail
3. browser_action.wait: Wait for load
4. browser_query.extract: Check if login needed
5. route: If login needed, type credentials
```

### Variable Usage
```javascript
// Context node stores:
{
  "gmailCreds": {
    "email": "user@gmail.com",
    "password": "password123"
  }
}

// Type action uses:
{
  "action": "type",
  "selector": "input[type='email']",
  "text": "{{gmailCreds.email}}"  // Resolved at runtime
}
```

## 8. References

### Key Files
- Node execution: `/operator/backend/services/nodeExecutor.js`
- Operator prompt: `/operator/backend/prompts/operatorPrompt.js`
- Database schema: Check Supabase dashboard
- Frontend: `/operator/frontend/`

### External Dependencies
- StageHand: AI-powered browser automation
- OpenAI: For operator intelligence
- Supabase: Database and auth
- Zod: Schema validation

### Documentation
- Operator concept: `/operator/Working Docs/operator.md`
- Manual/primitives: `/operator/manual.md`
- Strategy: `/Working Docs/Strategy-short.md`

---

**Remember**: This is the OPERATOR system, not the test-harness. Always work in the `/test-harness/operator/` directory!