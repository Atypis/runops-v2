# AEF (Autonomous Execution Framework) Documentation

**Version**: 4.0 (JSON Workflow Architecture)  
**Updated**: June 2025  

---

## 🎯 Overview

AEF (Autonomous Execution Framework) is a JSON-driven browser automation platform that executes multi-step workflows in live VNC environments. This documentation covers the **JSON Workflow Architecture** - a completely refactored system that loads workflows from JSON files rather than hardcoded definitions.

### **Revolutionary Change: Hardcoded → JSON**
AEF has been completely refactored from hardcoded workflows to a **JSON-driven architecture**:

- ✅ **JSON Workflow Files** - All workflows defined in standalone JSON files
- ✅ **Generic Engine** - Execution engine reads any valid JSON workflow  
- ✅ **Schema Validation** - Comprehensive JSON schema validation
- ✅ **No Hardcode Dependencies** - Zero hardcoded workflow definitions
- ✅ **AI Generation Ready** - Enables AI to create workflows without touching source code
- ✅ **Single Source of Truth** - One JSON file per workflow, loaded everywhere

### **Key Features**
- ✅ **Single VNC Container** - Consistent ports, no conflicts
- ✅ **JSON Workflow Loading** - Standardized workflow format with validation
- ✅ **Real-time Browser Streaming** - Live VNC with direct prop passing  
- ✅ **Hybrid Action Execution** - Primary/fallback pattern with credential injection
- ✅ **Zero Discovery Latency** - Instant VNC connection
- ✅ **Fresh Session Enforcement** - 100% clean state for each run
- ✅ **Credential Management** - Secure {{variable}} replacement system

---

## 🏗️ JSON Workflow Architecture

### **Complete System Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend Layer                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ AEFControlCenter│  │   BrowserPanel  │  │  ExecutionLog   │ │
│  │ (JSON Loader)   │  │  (Direct VNC)   │  │    Monitor      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Loads via API
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    JSON Workflow System                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ WorkflowLoader  │  │ ServerWorkflow  │  │ HybridAction    │ │
│  │ (Client API)    │  │ Loader (Server) │  │ Mapper          │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              JSON Workflow Files                           │ │
│  │  • gmail-investor-crm.json (12 nodes, 8 flows)            │ │
│  │  • workflow-schema.json (validation)                       │ │
│  │  • Future AI-generated workflows...                        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Processed JSON
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Execution Engine Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ ExecutionEngine │  │ HybridBrowser   │  │ VNC Container   │ │
│  │ (JSON-driven)   │  │ Manager         │  │ (Single Session)│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### **JSON File Structure**

```
app_frontend/aef/
├── workflows/
│   ├── gmail-investor-crm.json       # ✅ Main workflow (extracted from hardcode)
│   ├── schemas/
│   │   └── workflow-schema.json      # ✅ JSON validation schema
│   └── (future AI-generated workflows)
├── execution_engine/
│   └── engine.ts                     # ✅ Enhanced for JSON workflows
└── lib/workflow/
    ├── WorkflowLoader.ts             # ✅ Client-side JSON loader
    ├── ServerWorkflowLoader.ts       # ✅ Server-side JSON loader  
    └── HybridActionMapper.ts         # ✅ Action execution with credentials
```

### **Fixed Port Allocation (No Port Discovery Needed)**

| Service | Internal Port | External Port | URL |
|---------|---------------|---------------|-----|
| Browser API | 3000 | **13000** | `http://localhost:13000` |
| TigerVNC Server | 5900 | **15900** | N/A (internal) |
| noVNC Web Client | 6080 | **16080** | `http://localhost:16080/vnc.html` |

---

## 📄 JSON Workflow Format

### **Complete Workflow Structure**

```typescript
interface AEFWorkflow {
  meta: {
    id: string;                    // "gmail-investor-crm"
    title: string;                 // "Gmail Investor CRM Workflow"
    version: string;               // "1.0.0"
    goal: string;                  // High-level objective
    purpose: string;               // Detailed description
    owner: string[];               // ["aef-dev-team"]
    created: string;               // ISO timestamp
    updated: string;               // ISO timestamp
    aiGenerated: boolean;          // false (human-created)
    tags: string[];               // ["gmail", "airtable", "crm"]
  };

  execution: {
    environment?: {
      required_tabs?: Array<{
        name: string;              // "Gmail"
        url: string;               // "https://mail.google.com"
      }>;
    };
    workflow: {
      nodes: WorkflowNode[];       // 12 nodes in gmail-investor-crm
      flow: WorkflowFlow[];        // 8 flow connections
    };
  };

  config?: {
    executionTimeout?: number;     // 1800 seconds
    retryAttempts?: number;        // 3 attempts
    hybridMode?: boolean;          // true (primary/fallback)
    pauseOnErrors?: boolean;       // true
  };
}
```

### **Workflow Node Types**

```typescript
interface WorkflowNode {
  id: string;                      // "gmail_login_flow"
  type: 'atomic_task' | 'compound_task' | 'iterative_loop';
  label: string;                   // "Navigate and Log in to Gmail"
  intent: string;                  // What this node accomplishes
  context?: string;                // Additional context/instructions
  
  // Hierarchy
  parentId?: string;               // Parent node for nested tasks
  children?: string[];             // Child node IDs
  canExecuteAsGroup?: boolean;     // Execute all children together
  
  // Credentials
  credentialsRequired?: Record<string, string[]>;  // {"gmail": ["email", "password"]}
  preferredAuthMethods?: Record<string, string[]>; // {"gmail": ["email_password"]}
  
  // Actions
  actions: WorkflowAction[];       // Actual browser automation steps
}
```

### **Action Types with Examples**

```typescript
interface WorkflowAction {
  type: 'navigate' | 'click' | 'type' | 'wait' | 'wait_for_navigation' | 
        'act' | 'extract' | 'visual_scan' | 'conditional_auth';
  instruction: string;             // Human-readable description
  target?: {
    url?: string;                  // "https://gmail.com"
    selector?: string;             // "#password"
    url_contains?: string;         // "mail.google.com"
  };
  data?: any;                      // Action-specific data
  timeout?: number;                // Action timeout in ms
  schema?: any;                    // For extraction actions
  credentialField?: string;        // Links to credential: "gmail_password"
}

// Example actions from gmail-investor-crm.json:

// 1. Navigation
{
  "type": "navigate",
  "instruction": "Navigate to Gmail login page",
  "target": { "url": "https://accounts.google.com/signin/v2/identifier?service=mail" }
}

// 2. AI-powered action  
{
  "type": "act",
  "instruction": "Enter the email address michaelburner595@gmail.com in the email field and click Next"
}

// 3. Credential-injected typing
{
  "type": "type",
  "instruction": "Enter password using stored credential",
  "target": { "selector": "input[type='password']" },
  "data": { "text": "{{gmail_password}}" },
  "credentialField": "gmail_password"
}

// 4. Data extraction with schema
{
  "type": "extract", 
  "instruction": "Extract investor information from email content",
  "schema": {
    "name": "string",
    "company": "string",
    "email": "string",
    "investment_focus": "string"
  }
}
```

---

## 🔄 Data Flow & Execution Pipeline

### **1. JSON Workflow Loading**

```typescript
// Frontend: AEFControlCenter.tsx
const loadWorkflow = async () => {
  try {
    const workflow = await workflowLoader.loadWorkflow('gmail-investor-crm');
    console.log(`✅ Loaded workflow: ${workflow.meta.title}`);
    setAefDocument(workflow);
  } catch (error) {
    // No fallback - show clear error if JSON fails
    setWorkflowLoadError(error.message);
  }
};

// Client WorkflowLoader → API → ServerWorkflowLoader → JSON file
```

### **2. API Route Integration**

```typescript
// app/api/aef/execute/route.ts
export async function POST(request: NextRequest) {
  const { aefDocumentId } = await request.json();
  
  // Load JSON workflow
  const workflow = await ServerWorkflowLoader.loadWorkflow('gmail-investor-crm');
  
  // Transform to AEF document format
  const aefDocument = {
    id: workflow.meta.id,
    title: workflow.meta.title,
    public: {
      nodes: workflow.execution.workflow.nodes.map(transformNode),
      flow: workflow.execution.workflow.flow
    },
    aef: {
      config: {
        executionMethod: ExecutionMethod.BROWSER_AUTOMATION,
        pauseOnErrors: workflow.config?.pauseOnErrors ?? true,
        retryAttempts: workflow.config?.retryAttempts || 3
      }
    }
  };
  
  // Start execution engine with JSON data
  const engine = new ExecutionEngine(aefDocument, user.id, aefDocumentId);
  engine.start(executionId);
}
```

### **3. Hybrid Action Execution**

```typescript
// ExecutionEngine processes JSON actions
for (const action of node.actions) {
  switch (action.type) {
    case 'type':
      // Inject credentials if needed
      let browserAction = {
        type: 'type',
        data: { 
          selector: action.target?.selector,
          text: action.data?.text // Contains {{gmail_password}}
        }
      };
      
      // Credential injection
      browserAction = await this.injectCredentialsIntoAction(browserAction, node);
      
      // Execute via HybridBrowserManager
      const result = await hybridBrowserManager.executeAction(executionId, browserAction);
      break;
      
    case 'act':
      // AI-powered fallback execution
      await hybridBrowserManager.executeAction(executionId, {
        type: 'act',
        data: { instruction: action.instruction }
      });
      break;
  }
}
```

### **4. Credential Management**

```typescript
// HybridActionMapper processes credentials
processCredentials(action: WorkflowAction, credentials: Record<string, any>): WorkflowAction {
  const processedAction = JSON.parse(JSON.stringify(action));
  
  // Replace {{variable}} placeholders
  if (processedAction.data?.text) {
    processedAction.data.text = this.replacePlaceholders(
      processedAction.data.text, 
      credentials
    );
  }
  
  return processedAction;
}

// Example: {{gmail_password}} → actual password from secure storage
```

---

## 📡 API Reference

### **JSON Workflow Management**

#### **GET `/api/aef/workflow/[workflowId]`**
Load specific JSON workflow
```json
// Request
GET /api/aef/workflow/gmail-investor-crm

// Response
{
  "success": true,
  "workflow": {
    "meta": {
      "id": "gmail-investor-crm",
      "title": "Gmail Investor CRM Workflow",
      "version": "1.0.0"
    },
    "execution": {
      "workflow": {
        "nodes": [...], // 12 workflow nodes
        "flow": [...]   // 8 flow connections
      }
    }
  }
}
```

#### **POST `/api/aef/workflow/[workflowId]`**
List all available JSON workflows
```json
// Response
{
  "success": true,
  "workflows": [
    {
      "id": "gmail-investor-crm",
      "title": "Gmail Investor CRM Workflow", 
      "version": "1.0.0",
      "description": "Automated workflow for processing investor inquiries"
    }
  ]
}
```

### **Execution with JSON Workflows**

#### **POST `/api/aef/execute`**
Start execution of JSON workflow
```json
// Request
{
  "aefDocumentId": "gmail-investor-crm",
  "stepIds": null // Execute entire workflow
}

// Response
{
  "executionId": "uuid-here",
  "websocketUrl": "ws://localhost:3004/ws?executionId=uuid",
  "status": "running",
  "estimatedDuration": 1800
}
```

#### **POST `/api/aef/action/[id]`**
Execute individual workflow step
```json
// Request
{
  "stepId": "enter_password",
  "action": "execute",
  "browserAction": {
    "type": "type",
    "data": { "selector": "input[type='password']", "text": "{{gmail_password}}" }
  }
}

// Response
{
  "success": true,
  "stepId": "enter_password",
  "results": [
    {
      "success": true,
      "source": "primary", // or "fallback" 
      "result": { "typed": true },
      "retryCount": 0
    }
  ]
}
```

### **VNC Session Management** 
(Unchanged from previous version)

#### **GET `/api/vnc/status`**
```json
{
  "status": "ready",
  "vncUrl": "http://localhost:16080/vnc.html",
  "session": {
    "id": "single-vnc-1704123456789"
  }
}
```

---

## 🛠️ Implementation Details

### **JSON Schema Validation**

```typescript
// aef/workflows/schemas/workflow-schema.json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["meta", "execution"],
  "properties": {
    "meta": {
      "type": "object",
      "required": ["id", "title", "version"],
      "properties": {
        "id": { "type": "string" },
        "title": { "type": "string" },
        "version": { "type": "string" }
      }
    },
    "execution": {
      "type": "object", 
      "required": ["workflow"],
      "properties": {
        "workflow": {
          "type": "object",
          "required": ["nodes", "flow"],
          "properties": {
            "nodes": {
              "type": "array",
              "items": { "$ref": "#/definitions/workflowNode" }
            }
          }
        }
      }
    }
  },
  "definitions": {
    "workflowNode": { /* Complete node definition */ }
  }
}
```

### **ServerWorkflowLoader Class**

```typescript
export class ServerWorkflowLoader {
  private static cache = new Map<string, AEFWorkflow>();
  private static ajv = new Ajv({ allErrors: true });
  private static validateWorkflow = ServerWorkflowLoader.ajv.compile(workflowSchema);

  static async loadWorkflow(workflowId: string): Promise<AEFWorkflow> {
    // Check cache first
    if (ServerWorkflowLoader.cache.has(workflowId)) {
      return ServerWorkflowLoader.cache.get(workflowId)!;
    }

    // Load JSON file
    const workflowPath = path.join(process.cwd(), 'aef', 'workflows', `${workflowId}.json`);
    const workflowContent = fs.readFileSync(workflowPath, 'utf-8');
    const workflow = JSON.parse(workflowContent);
    
    // Validate against schema
    const valid = ServerWorkflowLoader.validateWorkflow(workflow);
    if (!valid) {
      const errors = ServerWorkflowLoader.validateWorkflow.errors || [];
      throw new WorkflowValidationError('Validation failed', errors);
    }

    // Cache and return
    ServerWorkflowLoader.cache.set(workflowId, validatedWorkflow);
    return validatedWorkflow;
  }
}
```

### **HybridActionMapper Enhanced**

```typescript
export class HybridActionMapper {
  async executeAction(
    action: WorkflowAction,
    context: ExecutionContext,
    primaryExecutor: (action: WorkflowAction) => Promise<any>,
    fallbackExecutor: (action: WorkflowAction) => Promise<any>
  ): Promise<HybridExecutionResult> {
    
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        // Primary execution (cached selectors)
        if (attempt === 0 && this.hybridMode) {
          const result = await primaryExecutor(action);
          return { success: true, source: 'primary', result, retryCount: attempt };
        }

        // Fallback execution (AI-powered)
        const result = await fallbackExecutor(action);
        return { success: true, source: 'fallback', result, retryCount: attempt };
        
      } catch (error) {
        console.log(`Execution attempt ${attempt + 1} failed: ${error.message}`);
      }
    }

    return { success: false, source: 'fallback', error: lastError, retryCount: this.retryAttempts };
  }

  // Credential processing
  processCredentials(action: WorkflowAction, credentials: Record<string, any>): WorkflowAction {
    const processed = JSON.parse(JSON.stringify(action));
    
    // Replace {{variable}} placeholders
    if (processed.instruction) {
      processed.instruction = this.replacePlaceholders(processed.instruction, credentials);
    }
    if (processed.data) {
      processed.data = this.processObjectPlaceholders(processed.data, credentials);
    }
    
    return processed;
  }
}
```

### **Frontend Integration (No Fallback)**

```typescript
// components/aef/AEFControlCenter.tsx
async function loadWorkflowAsAEFDocument(): Promise<AEFDocument> {
  try {
    console.log('🔄 Loading JSON workflow...');
    const workflow = await workflowLoader.loadWorkflow('gmail-investor-crm');
    
    // Transform JSON to AEF document format
    const aefDocument = transformWorkflowToAEF(workflow);
    
    return aefDocument;
  } catch (error) {
    console.error('❌ Failed to load JSON workflow:', error);
    
    // NO FALLBACK - Re-throw error for clear failure indication
    if (error instanceof WorkflowValidationError) {
      throw new Error(`Workflow validation failed: ${error.message}`);
    }
    throw new Error(`Failed to load JSON workflow: ${error.message}`);
  }
}

// Error UI handling
if (!aefDocument) {
  if (workflowLoadError) {
    return (
      <div className="error-state">
        <h3>Failed to Load Workflow</h3>
        <p>The JSON workflow could not be loaded. No fallback available.</p>
        <div className="error-details">{workflowLoadError}</div>
        <button onClick={() => window.location.reload()}>Retry Loading</button>
      </div>
    );
  }
  
  return <div>Loading JSON workflow...</div>;
}
```

---

## 🧪 Testing & Usage

### **Start JSON Workflow Execution**

```bash
# Via CLI - Load JSON workflow
curl -X POST http://localhost:3000/api/aef/execute \
  -H "Content-Type: application/json" \
  -d '{"aefDocumentId": "gmail-investor-crm"}'

# Response includes executionId and websocketUrl
```

### **Execute Individual Steps**

```bash
# Execute specific workflow node
curl -X POST "http://localhost:3000/api/aef/action/execution-id" \
  -H "Content-Type: application/json" \
  -d '{
    "stepId": "gmail_login_flow",
    "action": "execute"
  }'
```

### **Load JSON Workflow via API**

```bash
# Get workflow definition
curl http://localhost:3000/api/aef/workflow/gmail-investor-crm

# List all available workflows
curl -X POST http://localhost:3000/api/aef/workflow/gmail-investor-crm
```

### **Validate JSON Workflow**

```javascript
// Test JSON loading
const loader = new WorkflowLoader();
try {
  const workflow = await loader.loadWorkflow('gmail-investor-crm');
  console.log(`✅ Loaded: ${workflow.meta.title}`);
  console.log(`📊 Nodes: ${workflow.execution.workflow.nodes.length}`);
  console.log(`🔗 Flows: ${workflow.execution.workflow.flow.length}`);
} catch (error) {
  console.error('❌ JSON workflow failed:', error.message);
}
```

---

## 🔧 Configuration

### **Environment Variables**

```bash
# VNC Configuration (unchanged)
VNC_RESOLUTION=1280x720
VNC_COL_DEPTH=24
DISPLAY=:1

# JSON Workflow Configuration
WORKFLOW_CACHE_ENABLED=true
WORKFLOW_VALIDATION_STRICT=true
WORKFLOW_SCHEMA_PATH=aef/workflows/schemas/workflow-schema.json

# Container Configuration
CONTAINER_NAME=aef-vnc-single
API_PORT=13000
VNC_PORT=15900
NOVNC_PORT=16080
```

### **JSON Workflow Files Structure**

```bash
app_frontend/aef/workflows/
├── gmail-investor-crm.json      # ✅ Main workflow (12 nodes, 8 flows)
├── schemas/
│   └── workflow-schema.json     # ✅ Validation schema
└── templates/
    └── basic-template.json      # Template for new workflows
```

---

## 🚀 Production Deployment

### **JSON Workflow Advantages**
- **AI Generation Ready** - AI can create workflows without touching source code
- **Version Control** - Each workflow is a separate JSON file with version tracking
- **Validation** - Comprehensive schema validation prevents errors
- **Caching** - WorkflowLoader caches parsed workflows for performance
- **Testing** - Easy to create test workflows and validate them
- **Maintenance** - Single source of truth, no code duplication

### **Migration from Hardcoded**
- **Before**: 700+ lines of hardcoded workflow definitions in 3+ files
- **After**: Single `gmail-investor-crm.json` file (258 lines) loaded everywhere
- **Benefits**: 
  - Eliminated code duplication
  - Enabled AI workflow generation
  - Improved maintainability
  - Consistent execution across all code paths

### **Security Considerations**
- **Credential Injection** - Secure {{variable}} replacement with encrypted storage
- **JSON Validation** - Schema validation prevents malicious workflows
- **File Access** - Server-side file loading with proper path validation
- **Resource Protection** - Container resource limits and timeouts

---

## 📚 Related Documentation

- **workflow-schema.json** - Complete JSON schema definition
- **gmail-investor-crm.json** - Example workflow implementation
- **VNC-WebSocket-RemoteDesktop-Documentation.md** - VNC integration details
- **Browser Integration Status** - Docker container and automation setup

---

## 🎉 Success Metrics

**✅ JSON Workflow System is Production Ready**

- **100% JSON-driven** - No hardcoded workflows remain
- **Schema Validated** - All workflows validated against comprehensive schema
- **Credential Injection** - Secure {{variable}} replacement working
- **Hybrid Execution** - Primary/fallback pattern with retry logic
- **Error Handling** - Clear error messages when JSON loading fails
- **AI Generation Ready** - Framework ready for AI workflow creation
- **Performance Optimized** - Caching and efficient loading
- **Single Source of Truth** - One JSON file per workflow, loaded everywhere

**Implementation Statistics**: 
- **Files Created**: 4 (workflow-schema.json, gmail-investor-crm.json, WorkflowLoader.ts, HybridActionMapper.ts)
- **Files Modified**: 6 (AEFControlCenter.tsx, execute route, action route, etc.)
- **Lines Removed**: 700+ (hardcoded workflow definitions)
- **Lines Added**: 800+ (JSON infrastructure and validation)
- **Execution**: 100% JSON-driven with schema validation and credential injection

---

## 🆕 v4.1 – Unified Execution Path

> **Why this change?** Prior to v4.1 we had two parallel execution routes:
> 1. `/api/aef/action/[id]` – triggered by the **RUN** button on an individual node.
> 2. `/api/aef/execute-nodes` – triggered by **Select-nodes → Run** (multi-node execution).
>
> These diverged over time (different credential-injection logic, authentication context, logging), causing bugs such as credential placeholders not being replaced for multi-node runs. v4.1 collapses the two flows into *one* canonical pipeline driven by the **ExecutionEngine**.

### 🔗 Public API Surface
| Endpoint | Purpose | Notes |
|----------|---------|-------|
| **POST `/api/aef/execute-nodes`** | Execute one or more workflow nodes consecutively | Accepts `nodeIds[]`, `executionId`, `workflowId` (defaults to `gmail-investor-crm-v2`). Requires an authenticated session cookie. |
| **POST `/api/aef/action/[id]`** | _Legacy compatibility_. Internally proxies to `/execute-nodes` with `nodeIds=[stepId]`. Will be deprecated in v4.2. |

### 🛣️  Request → Execution Flow
1. **Authentication** – Route uses `createSupabaseServerClient()` to retrieve the logged-in user (`SUPABASE_AUTH`).
2. **Workflow Load** – `ServerWorkflowLoader.loadWorkflow(workflowId)` parses the JSON file and validates against `workflow-schema.json`.
3. **ExecutionEngine Instantiation**
   ```ts
   const engine = new ExecutionEngine(workflow, user.id, workflowId);
   engine.setSupabaseClient(serviceRoleSupabase); // credential db access
   ```
4. **Credential Validation** – `engine.validateCredentials()` checks that all required credentials exist before any node runs.
5. **Node Execution** – `engine.executeNodesConsecutively(executionId, nodeIds)` iterates through each node:
   • Variable resolution  →  • Credential injection  →  • HybridBrowserManager action dispatch  →  • Node-level logging.
6. **Logging** – All node logs are stored in‐memory (`nodeLogs` Map) and streamed to the frontend via `/api/aef/logs/[executionId]/[nodeId]` (unchanged).
7. **Response** – JSON object keyed by `nodeId` → `{ success, message, nextNodeId }`.

### 🔐  Credential Injection – Single Source of Truth
* `ExecutionEngine.injectCredentialsIntoAction()` is now the *only* place where credentials are fetched & injected.
* Uses the **service-role** Supabase client passed from the route ➜ direct database read (no HTTP round-trip).
* After injection, credentials are wiped from memory with `CredentialInjectionService.clearCredentialsFromMemory()`.

### 🗺️  Architectural Diagram
```mermaid
graph TD
    A[Frontend RUN / Select-Nodes] -->|HTTP POST| B[/api/aef/execute-nodes]
    B --> C{Auth & Validation}
    C -->|load JSON| D[ServerWorkflowLoader]
    D --> E[ExecutionEngine]
    E --> F[CredentialInjectionService]
    E --> G[HybridBrowserManager]
    G --> H[VNC Container]
    E --> I[NodeLogs Map]
    I --> J[/api/aef/logs/...]
```

### 🚦  Deprecation Timeline
| Version | Change |
|---------|--------|
| 4.1 (current) | `/api/aef/action/[id]` proxies to the unified route. |
| 4.2 | Route will emit a deprecation warning header. |
| 4.3 | Route removed; clients must call `/execute-nodes` directly. |

### ✅  Benefits
* **Consistent behaviour** across single & multi-node runs.
* **One credential path** – eliminates placeholder-leak bugs.
* **Simpler maintenance** – all enhancements (parallel runs, breakpoints, etc.) touch only `ExecutionEngine`.
* **Clear logging** – every node passes its own `nodeId` → no log cross-contamination.

### 📑 Comprehensive Reference (v4.1)

#### Workflow Node Types
| Type | Purpose | Notes |
|------|---------|-------|
| `atomic_task` | Smallest executable unit (1–N actions) | Default leaf node |
| `compound_task` | Parent that orchestrates children | Supports `canExecuteAsGroup` flag |
| `iterative_loop` | Repeat its children until loop-exit condition | Children executed in order each iteration |
| `decision` | Branch based on runtime evaluation | Exposes `outgoingEdges` with conditions |
| `assert` | Validate state (URL match, text present, etc.) | Halts/flags on failure |
| `error_handler` | Local recover block for sibling/child failures | Can retry / skip / abort |
| `data_transform` | Pure function node that transforms extracted data | Runs in server context (no browser) |
| `generator` | Produces new data (e.g. AI generation) | Output persisted to variable store |
| `explore` | Open-ended AI exploration step | Uses GPT-4o auto-tooling |

#### Action Types (ExecutionEngine → HybridBrowserManager)
| Action | Description |
|--------|-------------|
| `navigate` | Hard, direct URL navigation |
| `navigate_or_switch_tab` | If `url_contains` already open, switches, else navigates |
| `click` | DOM click by selector or AI heuristics |
| `type` | Direct keystroke entry |
| `wait` | Fixed sleep in ms |
| `wait_for_navigation` | Wait until URL regex / DOM condition satisfied |
| `act` | **AI-powered**; large-context instruction (fallback when selectors fail) |
| `extract` | Structured extraction with JSON schema |
| `visual_scan` | CV scan for template-free element recognition |
| `conditional_auth` | Detect & perform login prompts |
| `paginate_extract` | Scroll/paginate list & extract batch JSON data |
| `search_airtable` | Hit Airtable API to locate record (server-only action) |
| `label_email` | Add Gmail label via keyboard/API |
| `clear_memory` | Flush in-engine transient state |
| `generator` | (paired with generator node) produce content via LLM |

> **Tip:** All actions accept `stepId`, `nodeId`, `actionIndex` fields – these drive granular logging & replay.

#### Logging & Debugging Enhancements
* **NodeLogViewer** – Expandable, colour-coded log pane under each node.
* **Seven log types**
  | Color | Type |
  |-------|------|
  | 🔵 `prompt` | LLM prompt sent |
  | 🟣 `accessibility_tree` | AX tree snapshot |
  | 🟢 `llm_response` | Model completion |
  | 🟠 `action` | Browser action dispatched |
  | ⚫ `screenshot` | Screenshot reference |
  | 🔴 `error` | Failure w/ stack |
  | 🟢 `success` | Successful completion |
* **Auto-scroll** – Only if user is already near bottom (≤10 px) to avoid jump.
* Endpoint: `GET /api/aef/logs/[executionId]/[nodeId]` (poll every 2 s).

#### UI Quality-of-Life
* **Resizable Panels** – Drag vertical & horizontal splitters in `AEFControlCenter` to resize ExecutionEngine, RemoteDesktop, and Log pane.
* **Credential Badge Removed** – Top-of-panel red "Credentials required" banner eliminated for cleaner UI; credential status now lives inside Execution sidebar.

#### Credential Pipeline Changes
1. **Single Injection Point** – `ExecutionEngine.injectCredentialsIntoAction()`.
2. **Service-Role DB Access** – Credentials fetched server-side (no XHR round-trip).
3. **Memory Hygiene** – Every injection followed by `clearCredentialsFromMemory()`.
4. **Validation Pre-flight** – `validateCredentials()` blocks run if any credential missing.

#### Endpoint Quick-Sheet (v4.1)
| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/aef/execute` | POST | ✅ | Run entire workflow (unchanged) |
| `/api/aef/execute-nodes` | POST | ✅ | **NEW canonical** – run 1-N nodes |
| `/api/aef/action/[id]` | POST | ✅ | Legacy single-node, proxies to above |
| `/api/aef/logs/[executionId]/[nodeId]` | GET | ✅ | Live log stream |
| `/api/vnc/*` | var | – | Remote desktop ops |

#### Developer Notes
* **Dev server** – Run from project root: `pnpm --filter app_frontend dev` (workspace) or `npm --workspace app_frontend run dev` (package.json inside workspace).
* **Unit tests** – `pnpm --filter app_frontend test` (jest + playwright stub).
* **Schema updates** – After editing `workflow-schema.json`, regenerate TS types via `npm run schema:gen`.

---