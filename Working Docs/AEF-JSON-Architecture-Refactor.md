# AEF JSON Architecture Refactor

**Version**: 1.0  
**Focus**: Hardcoded Workflows → JSON + Generic Engine  
**Priority**: High - Foundation for AI Workflow Generation  

---

## 🎯 Executive Summary

**Current Problem**: AEF workflows are hardcoded in 3+ separate locations, making them impossible to generate via AI and difficult to maintain.

**Solution**: Extract workflows to standalone JSON files with a generic execution engine that reads and executes them consistently.

**Impact**: Enables AI workflow generation, eliminates code duplication, and creates a scalable foundation for complex automation.

---

## 📊 Current State Analysis

### **Hardcoded Locations Identified**
```
app_frontend/components/aef/AEFControlCenter.tsx
├── HARDCODED_TEST_WORKFLOW (289 lines)
├── createHardcodedAEFDocument() function
└── Embedded node definitions and actions

app_frontend/app/api/aef/action/[id]/route.ts  
├── HARDCODED_TEST_WORKFLOW (400+ lines)
├── Duplicate workflow definition
└── Embedded execution logic

app_frontend/app/api/aef/execute/route.ts
├── Mixed JSON loading for some workflows
├── Hardcoded fallbacks for others
└── Inconsistent execution paths

app_frontend/aef/execution_engine/engine.ts
├── Generic ExecutionEngine class (✅ GOOD)
├── Already handles WorkflowDocument type
└── Ready for JSON input
```

### **Architecture Problems**
- ❌ **Triple Maintenance**: Same workflow defined in 3 places
- ❌ **Code Coupling**: Workflow logic mixed with UI components
- ❌ **No AI Generation**: Impossible for AI to create new workflows
- ❌ **Inconsistent Execution**: Different engines handle same workflow differently
- ❌ **Hard to Test**: Can't easily create test workflows

---

## 🏗️ Target Architecture

### **New File Structure**
```
app_frontend/aef/
├── workflows/                          # ← NEW: Workflow definitions
│   ├── gmail-investor-crm.json        # ← Extracted from hardcoded
│   ├── salesforce-lead-gen.json       # ← Future workflows
│   ├── schemas/
│   │   ├── workflow-schema.json       # ← JSON validation schema
│   │   └── action-schema.json         # ← Action type definitions
│   └── templates/
│       └── empty-workflow.json        # ← Template for new workflows
├── engine/                             # ← NEW: Generic processing
│   ├── WorkflowLoader.ts              # ← JSON → Internal types
│   ├── WorkflowValidator.ts           # ← Schema validation
│   ├── CredentialInjector.ts          # ← {{variable}} replacement
│   ├── HybridActionMapper.ts          # ← Primary/fallback actions
│   └── ExecutionEngine.ts             # ← EXISTING (enhance)
├── components/                         # ← EXISTING (simplify)
│   ├── WorkflowRenderer.tsx           # ← JSON → UI rendering
│   └── AEFControlCenter.tsx           # ← Simplified loader
└── api/                               # ← EXISTING (unify)
    ├── workflow/
    │   ├── [id]/route.ts              # ← Load specific workflow
    │   └── validate/route.ts          # ← Validate workflow JSON
    └── execute/route.ts               # ← Unified execution
```

### **Data Flow Architecture**

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI Workflow Generator                      │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Prompt Input   │  │ JSON Generation │  │  Schema Valid.  │ │
│  │                 │  │                 │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Generates JSON
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  JSON Workflow Storage                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ gmail-crm.json  │  │ sales-lead.json │  │ custom-wf.json  │ │
│  │                 │  │                 │  │                 │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Loads JSON
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Generic Engine Layer                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ WorkflowLoader  │  │ CredentialInj.  │  │ HybridMapper    │ │
│  │ JSON→Types      │  │ {{variables}}   │  │ Primary/Fallback│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Processed Workflow
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Unified Execution Engine                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │ ExecutionEngine │  │ HybridBrowser   │  │ VNC Container   │ │
│  │ (Enhanced)      │  │ Manager         │  │ (Existing)      │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Tickets

## **🎫 Ticket 1: JSON Schema & Workflow Extraction**
**Priority**: Highest | **Effort**: 1 day | **Complexity**: Medium

### **Objectives**
- Define comprehensive JSON schema for AEF workflows
- Extract existing `HARDCODED_TEST_WORKFLOW` to JSON file
- Create validation framework

### **Deliverables**
1. **JSON Schema Definition**
   ```
   aef/workflows/schemas/workflow-schema.json
   aef/workflows/schemas/action-schema.json
   ```

2. **Extracted Workflow**
   ```
   aef/workflows/gmail-investor-crm.json
   ```

3. **Validation System**
   ```
   aef/engine/WorkflowValidator.ts
   ```

### **Technical Specifications**

#### **Workflow Schema Structure**
```typescript
interface AEFWorkflow {
  meta: {
    id: string;                    // Unique workflow identifier
    title: string;                 // Human readable name
    version: string;               // Semantic version (1.0.0)
    description: string;           // Purpose description
    created: string;               // ISO timestamp
    updated: string;               // ISO timestamp
    aiGenerated: boolean;          // Generated by AI vs human
    tags: string[];               // Categorization tags
    author: string;               // Creator identifier
  };
  
  config: {
    executionTimeout: number;      // Max execution time (seconds)
    retryAttempts: number;         // Retry failed actions N times
    hybridMode: boolean;           // Use cached selectors + AI fallback
    screenshotInterval: number;    // Screenshot frequency (ms)
    pauseOnErrors: boolean;        // Stop execution on errors
    requireConfirmation: boolean;  // Require human approval for steps
  };
  
  credentials: {
    required: CredentialSpec[];    // Must have credentials
    optional: CredentialSpec[];    // Nice to have credentials
    injection: CredentialMap;      // {{variable}} → credential mapping
  };
  
  workflow: {
    nodes: WorkflowNode[];         // All workflow steps
    edges: WorkflowEdge[];         // Step dependencies/flow
    entry: string;                 // Starting node ID
    exit: string[];               // Ending node IDs
  };
  
  automation: {
    selectorCache: SelectorCache;  // Learned selectors (hybrid approach)
    recoveryStrategies: RecoveryStrategy[];
    estimatedDuration: number;     // Expected execution time
    confidenceLevel: 'high' | 'medium' | 'low';
  };
}
```

#### **Action Schema (Hybrid Approach)**
```typescript
interface WorkflowAction {
  // Primary execution (fast cached selectors)
  primary: {
    type: 'navigate' | 'click' | 'type' | 'wait' | 'extract';
    instruction: string;           // Human-readable description
    selector?: string;             // Cached stable selector
    data?: any;                   // Action-specific data
    timeout?: number;             // Action timeout
  };
  
  // Fallback execution (AI-powered)
  fallback: {
    type: 'act';                  // Always use Stagehand's act()
    instruction: string;          // Natural language instruction
    context?: string;             // Additional context for AI
    retryInstructions?: string;   // What to do if first attempt fails
  };
  
  // Monitoring & Learning
  monitoring: {
    successCriteria: string[];    // How to verify success
    failureSignals: string[];     // Signs of failure to watch for
    learnSelectors: boolean;      // Extract selectors from AI success
  };
}
```

### **Acceptance Criteria**
- [ ] JSON schema validates all workflow structures
- [ ] Existing hardcoded workflow successfully extracted to JSON
- [ ] Validation catches common workflow errors
- [ ] Schema supports both simple and complex workflows
- [ ] AI can generate valid workflows using this schema

---

## **🎫 Ticket 2: Generic Workflow Loader**
**Priority**: High | **Effort**: 1.5 days | **Complexity**: Medium

### **Objectives**
- Build workflow loader that converts JSON to internal types
- Implement credential injection system
- Add caching and performance optimization

### **Deliverables**
1. **Workflow Loader**
   ```
   aef/engine/WorkflowLoader.ts
   ```

2. **Credential Injection**
   ```
   aef/engine/CredentialInjector.ts
   ```

3. **API Endpoints**
   ```
   app/api/aef/workflow/[id]/route.ts
   app/api/aef/workflow/validate/route.ts
   ```

### **Technical Specifications**

#### **WorkflowLoader Implementation**
```typescript
export class WorkflowLoader {
  private static cache = new Map<string, AEFWorkflow>();
  
  static async loadWorkflow(id: string): Promise<AEFWorkflow> {
    // Check cache first
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }
    
    // Load from file
    const filePath = path.join('aef/workflows', `${id}.json`);
    const rawJson = await fs.readFile(filePath, 'utf8');
    const rawWorkflow = JSON.parse(rawJson);
    
    // Validate schema
    const isValid = WorkflowValidator.validate(rawWorkflow);
    if (!isValid) {
      throw new Error(`Invalid workflow schema: ${id}`);
    }
    
    // Transform to internal types
    const workflow = this.transformToInternal(rawWorkflow);
    
    // Cache for performance
    this.cache.set(id, workflow);
    
    return workflow;
  }
  
  static async listWorkflows(): Promise<WorkflowMeta[]> {
    const workflowDir = path.join('aef/workflows');
    const files = await fs.readdir(workflowDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const workflows = await Promise.all(
      jsonFiles.map(async (file) => {
        const id = path.basename(file, '.json');
        const workflow = await this.loadWorkflow(id);
        return {
          id: workflow.meta.id,
          title: workflow.meta.title,
          description: workflow.meta.description,
          version: workflow.meta.version,
          aiGenerated: workflow.meta.aiGenerated,
          created: workflow.meta.created,
          updated: workflow.meta.updated
        };
      })
    );
    
    return workflows;
  }
  
  private static transformToInternal(raw: any): AEFWorkflow {
    // Convert raw JSON to typed internal structure
    // Handle version migrations
    // Apply environment-specific overrides
    // Validate business logic consistency
    return raw; // Simplified for brevity
  }
}
```

#### **Credential Injection System**
```typescript
export class CredentialInjector {
  static async injectCredentials(
    workflow: AEFWorkflow, 
    userCredentials: UserCredentials
  ): Promise<AEFWorkflow> {
    
    const injectedWorkflow = structuredClone(workflow);
    
    // Replace {{variable}} patterns in all action data
    for (const node of injectedWorkflow.workflow.nodes) {
      for (const action of node.actions) {
        if (action.primary?.data) {
          action.primary.data = this.replaceVariables(
            action.primary.data, 
            userCredentials
          );
        }
        
        if (action.fallback?.instruction) {
          action.fallback.instruction = this.replaceVariables(
            action.fallback.instruction,
            userCredentials
          );
        }
      }
    }
    
    return injectedWorkflow;
  }
  
  private static replaceVariables(data: any, credentials: UserCredentials): any {
    if (typeof data === 'string') {
      return data.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
        return credentials[varName] || match;
      });
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.replaceVariables(item, credentials));
    }
    
    if (typeof data === 'object' && data !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.replaceVariables(value, credentials);
      }
      return result;
    }
    
    return data;
  }
}
```

### **Acceptance Criteria**
- [ ] Can load any valid workflow JSON file
- [ ] Credential injection replaces all {{variables}}
- [ ] Caching improves performance on repeated loads
- [ ] API endpoints work for loading and validation
- [ ] Error handling for missing/invalid workflows

---

## **🎫 Ticket 3: Hybrid Action Mapper**
**Priority**: High | **Effort**: 2 days | **Complexity**: High

### **Objectives**
- Implement hybrid action execution (primary + fallback)
- Integrate with existing hybrid selector strategy
- Add selector learning and caching

### **Deliverables**
1. **Hybrid Action Mapper**
   ```
   aef/engine/HybridActionMapper.ts
   ```

2. **Selector Cache System**
   ```
   aef/engine/SelectorCache.ts
   ```

3. **Enhanced ExecutionEngine**
   ```
   aef/execution_engine/engine.ts (enhanced)
   ```

### **Technical Specifications**

#### **HybridActionMapper Implementation**
```typescript
export class HybridActionMapper {
  private selectorCache: SelectorCache;
  
  constructor() {
    this.selectorCache = new SelectorCache();
  }
  
  async executeAction(
    action: WorkflowAction, 
    executionId: string,
    context: ExecutionContext
  ): Promise<ActionResult> {
    
    let result: ActionResult;
    
    try {
      // Attempt primary method first (fast cached selectors)
      console.log(`🚀 Attempting primary action: ${action.primary.type}`);
      
      result = await this.executePrimaryAction(action.primary, executionId);
      
      // Verify success
      if (this.isActionSuccessful(result, action.monitoring.successCriteria)) {
        console.log(`✅ Primary action succeeded`);
        return result;
      } else {
        throw new Error('Primary action did not meet success criteria');
      }
      
    } catch (error) {
      console.log(`⚠️ Primary action failed: ${error.message}`);
      console.log(`🔄 Falling back to AI-powered execution`);
      
      // Fall back to AI-powered method
      result = await this.executeFallbackAction(action.fallback, executionId);
      
      // Learn from AI success for future caching
      if (this.isActionSuccessful(result, action.monitoring.successCriteria)) {
        console.log(`✅ Fallback action succeeded`);
        await this.learnFromSuccess(action, result, context);
        return result;
      } else {
        throw new Error('Both primary and fallback actions failed');
      }
    }
  }
  
  private async executePrimaryAction(
    action: PrimaryAction, 
    executionId: string
  ): Promise<ActionResult> {
    
    // Use existing HybridBrowserManager for actual execution
    const browserAction: BrowserAction = {
      type: action.type,
      data: {
        selector: action.selector,
        instruction: action.instruction,
        ...action.data
      },
      stepId: 'hybrid-action'
    };
    
    return await hybridBrowserManager.executeAction(executionId, browserAction);
  }
  
  private async executeFallbackAction(
    action: FallbackAction, 
    executionId: string
  ): Promise<ActionResult> {
    
    // Always use Stagehand's act() for fallback
    const browserAction: BrowserAction = {
      type: 'act',
      data: {
        instruction: action.instruction,
        context: action.context
      },
      stepId: 'hybrid-fallback'
    };
    
    return await hybridBrowserManager.executeAction(executionId, browserAction);
  }
  
  private async learnFromSuccess(
    action: WorkflowAction,
    result: ActionResult, 
    context: ExecutionContext
  ): Promise<void> {
    
    if (!action.monitoring.learnSelectors) return;
    
    // Extract selector information from successful AI action
    // This would analyze the DOM elements that were interacted with
    // and cache stable selectors for future use
    
    console.log(`🧠 Learning new selectors from AI success`);
    
    // In a real implementation, this would:
    // 1. Analyze what elements the AI interacted with
    // 2. Extract stable selector patterns (name, id, aria-label)
    // 3. Cache them for this domain/page type
    // 4. Update the workflow's selector cache
    
    await this.selectorCache.learnFromAction(action, result, context);
  }
  
  private isActionSuccessful(
    result: ActionResult, 
    successCriteria: string[]
  ): boolean {
    
    // Check if action met success criteria
    for (const criteria of successCriteria) {
      if (!this.checkCriteria(criteria, result)) {
        return false;
      }
    }
    
    return true;
  }
  
  private checkCriteria(criteria: string, result: ActionResult): boolean {
    // Simple criteria checking - could be enhanced with complex rules
    switch (criteria) {
      case 'no_error':
        return !result.error;
      case 'screenshot_changed':
        return result.screenshot !== null;
      case 'navigation_occurred':
        return result.navigationOccurred === true;
      default:
        return true;
    }
  }
}
```

#### **Selector Cache System**
```typescript
export class SelectorCache {
  private cache = new Map<string, CachedSelector[]>();
  
  async getCachedSelector(
    domain: string, 
    actionType: string, 
    context: string
  ): Promise<string | null> {
    
    const key = `${domain}:${actionType}:${context}`;
    const selectors = this.cache.get(key) || [];
    
    // Return the most reliable cached selector
    const bestSelector = selectors
      .sort((a, b) => b.reliability - a.reliability)
      .find(s => s.reliability > 0.8);
    
    return bestSelector?.selector || null;
  }
  
  async cacheSelector(
    domain: string,
    actionType: string, 
    context: string,
    selector: string,
    reliability: number
  ): Promise<void> {
    
    const key = `${domain}:${actionType}:${context}`;
    const selectors = this.cache.get(key) || [];
    
    // Add new selector or update existing
    const existingIndex = selectors.findIndex(s => s.selector === selector);
    if (existingIndex >= 0) {
      selectors[existingIndex].reliability = reliability;
      selectors[existingIndex].lastUsed = new Date();
    } else {
      selectors.push({
        selector,
        reliability,
        firstSeen: new Date(),
        lastUsed: new Date(),
        usageCount: 1
      });
    }
    
    this.cache.set(key, selectors);
  }
  
  async learnFromAction(
    action: WorkflowAction,
    result: ActionResult,
    context: ExecutionContext
  ): Promise<void> {
    
    // Extract domain from current URL
    const domain = new URL(context.currentUrl).hostname;
    
    // This is where we'd implement the learning logic
    // For now, just log what we would do
    console.log(`📚 Would learn selectors for ${domain} from action ${action.primary.type}`);
    
    // In real implementation:
    // 1. Analyze DOM elements that were interacted with
    // 2. Extract stable selector patterns
    // 3. Cache them with reliability scores
    // 4. Update workflow JSON with learned selectors
  }
}
```

### **Acceptance Criteria**
- [ ] Primary actions execute with cached selectors
- [ ] Fallback to AI when primary actions fail  
- [ ] Success criteria verification works correctly
- [ ] Selector learning extracts stable patterns
- [ ] Performance improvement over pure AI approach

---

## **🎫 Ticket 4: Frontend Component Updates**
**Priority**: Medium | **Effort**: 1.5 days | **Complexity**: Medium

### **Objectives**
- Update AEFControlCenter to load from JSON instead of hardcoded
- Create dynamic workflow rendering from JSON
- Maintain existing UI/UX while using new architecture

### **Deliverables**
1. **Updated Control Center**
   ```
   components/aef/AEFControlCenter.tsx (updated)
   ```

2. **Dynamic Workflow Renderer**
   ```
   components/aef/WorkflowRenderer.tsx (new)
   ```

3. **Workflow Selection UI**
   ```
   components/aef/WorkflowSelector.tsx (new)
   ```

### **Technical Specifications**

#### **Updated AEFControlCenter**
```typescript
const AEFControlCenter: React.FC<AEFControlCenterProps> = ({ sopId }) => {
  const [currentWorkflow, setCurrentWorkflow] = useState<AEFWorkflow | null>(null);
  const [availableWorkflows, setAvailableWorkflows] = useState<WorkflowMeta[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Load available workflows on mount
  useEffect(() => {
    const loadWorkflows = async () => {
      try {
        const response = await fetch('/api/aef/workflow/list');
        const workflows = await response.json();
        setAvailableWorkflows(workflows);
        
        // Load default workflow or use sopId if provided
        const defaultId = sopId || 'gmail-investor-crm';
        await loadWorkflow(defaultId);
      } catch (error) {
        console.error('Failed to load workflows:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadWorkflows();
  }, [sopId]);
  
  const loadWorkflow = async (workflowId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/aef/workflow/${workflowId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to load workflow: ${workflowId}`);
      }
      
      const workflow = await response.json();
      setCurrentWorkflow(workflow);
      
      console.log('🔍 [AEF] Loaded workflow from JSON:', workflow.meta.title);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      // Fallback to hardcoded for backwards compatibility
      console.log('🔄 Falling back to hardcoded workflow');
      setCurrentWorkflow(createHardcodedAEFDocument());
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p>Loading workflow...</p>
      </div>
    </div>;
  }
  
  if (!currentWorkflow) {
    return <div className="text-center p-8 text-red-600">
      Failed to load workflow. Please try again.
    </div>;
  }
  
  return (
    <div className="aef-control-center">
      {/* Workflow Selection */}
      <WorkflowSelector
        workflows={availableWorkflows}
        currentWorkflow={currentWorkflow}
        onWorkflowChange={loadWorkflow}
      />
      
      {/* Main Workflow Display */}
      <WorkflowRenderer
        workflow={currentWorkflow}
        onExecuteAction={handleExecuteAction}
        onExecuteGroup={handleExecuteGroup}
      />
      
      {/* Existing browser panel and other components */}
      <BrowserPanel
        vncUrl={discoveredSession?.vncUrl}
        vncSupported={!!discoveredSession?.vncUrl}
        executionId={activeExecutionId}
        isActive={isExecutionActive}
      />
    </div>
  );
};
```

#### **Dynamic Workflow Renderer**
```typescript
interface WorkflowRendererProps {
  workflow: AEFWorkflow;
  onExecuteAction: (nodeId: string) => Promise<void>;
  onExecuteGroup: (nodeIds: string[]) => Promise<void>;
}

const WorkflowRenderer: React.FC<WorkflowRendererProps> = ({
  workflow,
  onExecuteAction,
  onExecuteGroup
}) => {
  
  const renderNode = (node: WorkflowNode) => {
    const isCompound = node.type === 'compound_task';
    const hasChildren = node.children && node.children.length > 0;
    
    return (
      <div key={node.id} className="workflow-node">
        <div className={`node-header ${isCompound ? 'compound' : 'atomic'}`}>
          <div className="node-info">
            <h3 className="node-title">{node.label}</h3>
            <p className="node-intent">{node.intent}</p>
            {node.context && (
              <p className="node-context text-sm text-gray-600">{node.context}</p>
            )}
          </div>
          
          <div className="node-actions">
            {!isCompound && (
              <button
                onClick={() => onExecuteAction(node.id)}
                className="execute-btn"
              >
                ▶️ Execute
              </button>
            )}
            
            {isCompound && hasChildren && (
              <button
                onClick={() => onExecuteGroup(node.children!)}
                className="execute-group-btn"
              >
                ▶️ Execute Group
              </button>
            )}
          </div>
        </div>
        
        {/* Show actions for atomic nodes */}
        {!isCompound && node.actions && (
          <div className="node-actions-details">
            {node.actions.map((action, index) => (
              <div key={index} className="action-item">
                <span className="action-type">{action.primary?.type || action.type}</span>
                <span className="action-desc">{action.primary?.instruction || action.instruction}</span>
              </div>
            ))}
          </div>
        )}
        
        {/* Render child nodes for compound tasks */}
        {hasChildren && (
          <div className="child-nodes">
            {node.children!.map(childId => {
              const childNode = workflow.workflow.nodes.find(n => n.id === childId);
              return childNode ? renderNode(childNode) : null;
            })}
          </div>
        )}
      </div>
    );
  };
  
  const rootNodes = workflow.workflow.nodes.filter(node => !node.parentId);
  
  return (
    <div className="workflow-renderer">
      <div className="workflow-header">
        <h2>{workflow.meta.title}</h2>
        <p>{workflow.meta.description}</p>
        <div className="workflow-meta">
          <span>Version: {workflow.meta.version}</span>
          {workflow.meta.aiGenerated && <span className="ai-badge">🤖 AI Generated</span>}
        </div>
      </div>
      
      <div className="workflow-nodes">
        {rootNodes.map(renderNode)}
      </div>
    </div>
  );
};
```

### **Acceptance Criteria**
- [ ] AEFControlCenter loads workflows from JSON instead of hardcode
- [ ] Dynamic rendering works for any valid workflow JSON
- [ ] UI maintains existing functionality and appearance
- [ ] Error handling for invalid/missing workflows
- [ ] Backwards compatibility with existing workflows

---

## **🎫 Ticket 5: API Unification & Testing**
**Priority**: Medium | **Effort**: 1 day | **Complexity**: Low

### **Objectives**
- Unify execution APIs to use new JSON architecture
- Remove hardcoded workflow definitions from API routes
- Add comprehensive testing suite

### **Deliverables**
1. **Unified API Routes**
   ```
   app/api/aef/execute/route.ts (updated)
   app/api/aef/action/[id]/route.ts (updated)
   ```

2. **Test Suite**
   ```
   __tests__/aef/workflow-loader.test.ts
   __tests__/aef/credential-injection.test.ts
   __tests__/aef/hybrid-mapper.test.ts
   ```

3. **Documentation**
   ```
   Working Docs/AEF-JSON-API-Reference.md
   ```

### **Technical Specifications**

#### **Unified Execute Route**
```typescript
// app/api/aef/execute/route.ts
export async function POST(request: NextRequest) {
  try {
    const { workflowId, userCredentials } = await request.json();
    
    // Load workflow from JSON
    const workflow = await WorkflowLoader.loadWorkflow(workflowId);
    
    // Inject user credentials
    const workflowWithCredentials = await CredentialInjector.injectCredentials(
      workflow, 
      userCredentials
    );
    
    // Initialize execution engine with JSON workflow
    const engine = new ExecutionEngine(workflowWithCredentials, user.id, workflowId);
    
    // Start execution
    const executionId = await engine.startExecution();
    
    return NextResponse.json({
      success: true,
      executionId,
      workflow: {
        id: workflow.meta.id,
        title: workflow.meta.title,
        estimatedDuration: workflow.automation.estimatedDuration
      }
    });
    
  } catch (error) {
    console.error('Failed to execute workflow:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow execution' },
      { status: 500 }
    );
  }
}
```

#### **Unified Action Route**
```typescript
// app/api/aef/action/[id]/route.ts
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { stepId, action } = await request.json();
    const executionId = params.id;
    
    // Get the current execution context
    const execution = await getExecutionContext(executionId);
    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }
    
    // Load the workflow for this execution
    const workflow = await WorkflowLoader.loadWorkflow(execution.workflowId);
    
    // Find the specific node to execute
    const targetNode = workflow.workflow.nodes.find(node => node.id === stepId);
    if (!targetNode) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    
    // Execute using hybrid action mapper
    const hybridMapper = new HybridActionMapper();
    
    let results = [];
    for (const action of targetNode.actions) {
      const result = await hybridMapper.executeAction(action, executionId, execution);
      results.push(result);
    }
    
    return NextResponse.json({
      success: true,
      stepId,
      results,
      nodeTitle: targetNode.label
    });
    
  } catch (error) {
    console.error('Action execution failed:', error);
    return NextResponse.json(
      { error: 'Action execution failed' },
      { status: 500 }
    );
  }
}
```

### **Test Suite Examples**
```typescript
// __tests__/aef/workflow-loader.test.ts
describe('WorkflowLoader', () => {
  test('loads valid workflow JSON', async () => {
    const workflow = await WorkflowLoader.loadWorkflow('gmail-investor-crm');
    
    expect(workflow.meta.id).toBe('gmail-investor-crm');
    expect(workflow.workflow.nodes).toBeDefined();
    expect(workflow.workflow.nodes.length).toBeGreaterThan(0);
  });
  
  test('validates workflow schema', async () => {
    await expect(
      WorkflowLoader.loadWorkflow('invalid-workflow')
    ).rejects.toThrow('Invalid workflow schema');
  });
  
  test('caches loaded workflows', async () => {
    const workflow1 = await WorkflowLoader.loadWorkflow('gmail-investor-crm');
    const workflow2 = await WorkflowLoader.loadWorkflow('gmail-investor-crm');
    
    expect(workflow1).toBe(workflow2); // Same object reference (cached)
  });
});

// __tests__/aef/credential-injection.test.ts
describe('CredentialInjector', () => {
  test('replaces credential variables', async () => {
    const workflow = createTestWorkflow();
    const credentials = { gmail_email: 'test@gmail.com' };
    
    const injectedWorkflow = await CredentialInjector.injectCredentials(
      workflow, 
      credentials
    );
    
    const emailAction = injectedWorkflow.workflow.nodes[0].actions[0];
    expect(emailAction.primary.data.text).toBe('test@gmail.com');
  });
});
```

### **Acceptance Criteria**
- [ ] All API routes use JSON workflows instead of hardcoded
- [ ] Execution works consistently across all entry points
- [ ] Test suite covers critical functionality
- [ ] Documentation is updated with new API structure
- [ ] Backwards compatibility maintained during transition

---

## 🚀 Migration Strategy

### **Phase 1: Foundation (Week 1)**
- Complete Tickets 1 & 2 (Schema + Loader)
- Extract existing workflow to JSON
- Basic validation and loading working

### **Phase 2: Core Engine (Week 2)**  
- Complete Ticket 3 (Hybrid Mapper)
- Integrate with existing execution engine
- Test hybrid primary/fallback approach

### **Phase 3: Frontend Integration (Week 3)**
- Complete Ticket 4 (Component Updates)
- Update UI to use JSON workflows
- Maintain existing user experience

### **Phase 4: API Unification (Week 4)**
- Complete Ticket 5 (API & Testing)
- Remove all hardcoded workflows
- Comprehensive testing and documentation

### **Phase 5: AI Generation Ready (Week 5)**
- Add AI workflow generation endpoint
- Create workflow editor UI (optional)
- Full end-to-end testing

---

## 📊 Success Metrics

### **Technical Metrics**
- ✅ Zero hardcoded workflows remaining
- ✅ Single source of truth for workflow definitions
- ✅ AI can generate valid workflows
- ✅ Execution performance maintained or improved
- ✅ Test coverage > 80% for new components

### **Business Metrics**
- ✅ Workflow creation time reduced by 90%
- ✅ AI can generate workflows without code changes
- ✅ New workflows deployable without code deployment
- ✅ Developer productivity increased for workflow maintenance

### **Quality Metrics**
- ✅ No regressions in existing workflow execution
- ✅ Error handling improved with clear failure messages
- ✅ Documentation covers all new functionality
- ✅ Backwards compatibility maintained

---

## 🎯 Future Enhancements

### **Short Term (Post-Refactor)**
- **Workflow Editor UI**: Visual drag-and-drop workflow creation
- **A/B Testing**: Compare different workflow versions
- **Analytics**: Track workflow success rates and performance
- **Version Control**: Git-like versioning for workflows

### **Medium Term**
- **Multi-Environment**: Dev/staging/prod workflow variants
- **Workflow Marketplace**: Share and discover workflows
- **Advanced Recovery**: Smart error recovery and retry strategies
- **Performance Analytics**: Detailed execution metrics

### **Long Term**
- **Workflow AI Assistant**: AI that optimizes workflows over time
- **Cross-Platform**: Support for mobile and desktop automation
- **Enterprise Features**: Multi-tenant, RBAC, audit logs
- **Integration Ecosystem**: Connect with external tools and APIs

---

*This refactor creates the foundation for AI-powered workflow generation while maintaining all existing functionality and improving system maintainability.* 