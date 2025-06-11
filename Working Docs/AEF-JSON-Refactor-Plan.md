# AEF JSON Architecture Refactor Plan

**Version**: 1.0  
**Status**: Implementation Ready  
**Priority**: High - Enables AI Workflow Generation  

---

## 🎯 Overview

**Goal**: Refactor AEF from hardcoded workflows to JSON-based workflows with a generic execution engine.

**Current Problem**: 
- Workflows hardcoded in 3+ different files
- Impossible for AI to generate new workflows
- Triple maintenance burden
- Inconsistent execution across different code paths

**Solution**:
- Extract workflows to standalone JSON files
- Build generic engine that reads/executes any valid JSON workflow
- Enable AI workflow generation without touching source code

---

## 📊 Current Architecture Problems

### **Hardcoded Locations**
```
app_frontend/components/aef/AEFControlCenter.tsx
├── HARDCODED_TEST_WORKFLOW (289 lines)
└── createHardcodedAEFDocument() function

app_frontend/app/api/aef/action/[id]/route.ts  
├── HARDCODED_TEST_WORKFLOW (400+ lines)
└── Duplicate workflow definition

app_frontend/app/api/aef/execute/route.ts
├── Mixed JSON/hardcoded loading
└── Inconsistent execution paths
```

### **Issues**
- ❌ **Code Duplication**: Same workflow in multiple files
- ❌ **No AI Generation**: Can't create workflows without code changes  
- ❌ **Hard to Test**: Can't easily create test workflows
- ❌ **Maintenance Burden**: Change one workflow = change 3+ files

---

## 🏗️ Target Architecture

### **New Structure**
```
aef/
├── workflows/
│   ├── gmail-investor-crm.json       # Extracted from hardcoded
│   ├── schemas/
│   │   └── workflow-schema.json      # Validation schema
│   └── templates/
│       └── basic-template.json       # Template for new workflows
├── engine/
│   ├── WorkflowLoader.ts            # JSON → Internal types
│   ├── CredentialInjector.ts        # {{variable}} replacement  
│   ├── HybridActionMapper.ts        # Primary/fallback actions
│   └── ExecutionEngine.ts           # Enhanced existing engine
└── components/
    ├── WorkflowRenderer.tsx         # Dynamic UI from JSON
    └── AEFControlCenter.tsx         # Simplified, loads from JSON
```

### **Data Flow**
```
AI Agent → JSON Workflow → WorkflowLoader → ExecutionEngine → Browser
```

---

## 📋 Implementation Tickets

## 🎫 **Ticket 1: JSON Schema & Extraction**
**Priority**: Critical | **Days**: 1 | **Complexity**: Medium

### Objectives
- Define JSON schema for workflows
- Extract hardcoded workflow to JSON
- Build validation system

### Deliverables
1. `aef/workflows/schemas/workflow-schema.json`
2. `aef/workflows/gmail-investor-crm.json` 
3. `aef/engine/WorkflowValidator.ts`

### Schema Structure
```typescript
interface AEFWorkflow {
  meta: {
    id: string;
    title: string;
    version: string;
    description: string;
    aiGenerated: boolean;
    created: string;
    updated: string;
  };
  
  config: {
    executionTimeout: number;
    retryAttempts: number;
    hybridMode: boolean;        // Use cached selectors + AI fallback
    pauseOnErrors: boolean;
  };
  
  credentials: {
    required: string[];         // ["gmail_email", "gmail_password"]
    optional: string[];
    injection: object;          // {{variable}} mapping rules
  };
  
  workflow: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    entry: string;              // Starting node ID
  };
  
  automation: {
    selectorCache: object;      // Learned selectors (hybrid approach)
    estimatedDuration: number;
    confidenceLevel: string;
  };
}
```

### Hybrid Action Structure
```typescript
interface WorkflowAction {
  // Fast cached selector approach
  primary: {
    type: 'click' | 'type' | 'navigate' | 'wait';
    selector?: string;          // Stable cached selector
    instruction: string;        // Human description
    data?: any;
    timeout?: number;
  };
  
  // AI-powered fallback  
  fallback: {
    type: 'act';               // Always use Stagehand act()
    instruction: string;       // Natural language
    context?: string;
  };
  
  // Success monitoring
  monitoring: {
    successCriteria: string[];
    learnSelectors: boolean;   // Extract selectors from AI success
  };
}
```

### Tasks
- [ ] Design complete JSON schema
- [ ] Extract HARDCODED_TEST_WORKFLOW to JSON
- [ ] Build schema validator
- [ ] Test with existing workflow

---

## 🎫 **Ticket 2: Generic Workflow Loader**
**Priority**: High | **Days**: 1.5 | **Complexity**: Medium

### Objectives
- Build loader that converts JSON to internal types
- Implement credential injection ({{variables}})
- Add caching and performance

### Deliverables
1. `aef/engine/WorkflowLoader.ts`
2. `aef/engine/CredentialInjector.ts`
3. `app/api/aef/workflow/[id]/route.ts`

### WorkflowLoader Class
```typescript
export class WorkflowLoader {
  private static cache = new Map<string, AEFWorkflow>();
  
  static async loadWorkflow(id: string): Promise<AEFWorkflow> {
    // Check cache
    if (this.cache.has(id)) return this.cache.get(id)!;
    
    // Load JSON file
    const filePath = `aef/workflows/${id}.json`;
    const json = await fs.readFile(filePath, 'utf8');
    const raw = JSON.parse(json);
    
    // Validate schema
    if (!WorkflowValidator.validate(raw)) {
      throw new Error(`Invalid workflow: ${id}`);
    }
    
    // Transform and cache
    const workflow = this.transformToInternal(raw);
    this.cache.set(id, workflow);
    return workflow;
  }
  
  static async listWorkflows(): Promise<WorkflowMeta[]> {
    // Return list of available workflows
  }
}
```

### Credential Injection
```typescript
export class CredentialInjector {
  static async inject(
    workflow: AEFWorkflow, 
    credentials: UserCredentials
  ): Promise<AEFWorkflow> {
    
    const injected = structuredClone(workflow);
    
    // Replace {{gmail_email}} → actual email in all actions
    for (const node of injected.workflow.nodes) {
      for (const action of node.actions) {
        if (action.primary?.data) {
          action.primary.data = this.replaceVariables(
            action.primary.data, 
            credentials
          );
        }
      }
    }
    
    return injected;
  }
}
```

### Tasks
- [ ] Build WorkflowLoader with caching
- [ ] Implement credential injection system
- [ ] Create API endpoints for loading workflows
- [ ] Add error handling for missing/invalid files

---

## 🎫 **Ticket 3: Hybrid Action Mapper** 
**Priority**: High | **Days**: 2 | **Complexity**: High

### Objectives
- Implement hybrid execution (primary + fallback)
- Integrate with existing hybrid selector strategy
- Add selector learning from AI success

### Deliverables
1. `aef/engine/HybridActionMapper.ts`
2. `aef/engine/SelectorCache.ts`
3. Enhanced `aef/execution_engine/engine.ts`

### HybridActionMapper Class
```typescript
export class HybridActionMapper {
  
  async executeAction(
    action: WorkflowAction,
    executionId: string
  ): Promise<ActionResult> {
    
    try {
      // 1. Try primary method (fast cached selectors)
      console.log(`🚀 Primary: ${action.primary.type}`);
      const result = await this.executePrimary(action.primary, executionId);
      
      if (this.isSuccessful(result, action.monitoring)) {
        console.log(`✅ Primary succeeded`);
        return result;
      }
      
    } catch (error) {
      console.log(`⚠️ Primary failed: ${error.message}`);
    }
    
    // 2. Fallback to AI method
    console.log(`🔄 Fallback: AI execution`);
    const result = await this.executeFallback(action.fallback, executionId);
    
    if (this.isSuccessful(result, action.monitoring)) {
      console.log(`✅ Fallback succeeded`);
      
      // 3. Learn from AI success
      if (action.monitoring.learnSelectors) {
        await this.learnSelectors(action, result);
      }
      
      return result;
    }
    
    throw new Error('Both primary and fallback failed');
  }
  
  private async executePrimary(action, executionId) {
    // Use HybridBrowserManager for cached selector execution
    return hybridBrowserManager.executeAction(executionId, {
      type: action.type,
      data: { selector: action.selector, ...action.data }
    });
  }
  
  private async executeFallback(action, executionId) {
    // Use HybridBrowserManager for AI execution
    return hybridBrowserManager.executeAction(executionId, {
      type: 'act',
      data: { instruction: action.instruction }
    });
  }
  
  private async learnSelectors(action, result) {
    // Extract stable selectors from AI success
    // Update workflow's selector cache
    console.log(`🧠 Learning selectors from AI success`);
  }
}
```

### Tasks
- [ ] Build HybridActionMapper with primary/fallback logic
- [ ] Integrate with existing HybridBrowserManager
- [ ] Add selector learning and caching
- [ ] Test with Gmail workflow actions

---

## 🎫 **Ticket 4: Frontend Updates**
**Priority**: Medium | **Days**: 1.5 | **Complexity**: Medium

### Objectives
- Update AEFControlCenter to load from JSON
- Create dynamic workflow rendering
- Maintain existing UI/UX

### Deliverables
1. Updated `components/aef/AEFControlCenter.tsx`
2. New `components/aef/WorkflowRenderer.tsx`
3. New `components/aef/WorkflowSelector.tsx`

### Updated AEFControlCenter
```typescript
const AEFControlCenter: React.FC = ({ sopId }) => {
  const [workflow, setWorkflow] = useState<AEFWorkflow | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        const id = sopId || 'gmail-investor-crm';
        const response = await fetch(`/api/aef/workflow/${id}`);
        const workflowData = await response.json();
        setWorkflow(workflowData);
        
        console.log('🔍 Loaded workflow from JSON:', workflowData.meta.title);
      } catch (error) {
        console.error('Failed to load workflow:', error);
        // Fallback to hardcoded for backwards compatibility
        setWorkflow(createHardcodedAEFDocument());
      } finally {
        setLoading(false);
      }
    };
    
    loadWorkflow();
  }, [sopId]);
  
  if (!workflow) return <div>Loading...</div>;
  
  return (
    <div className="aef-control-center">
      <WorkflowRenderer 
        workflow={workflow}
        onExecuteAction={handleExecuteAction}
      />
      
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

### WorkflowRenderer Component  
```typescript
const WorkflowRenderer: React.FC<{
  workflow: AEFWorkflow;
  onExecuteAction: (nodeId: string) => void;
}> = ({ workflow, onExecuteAction }) => {
  
  const renderNode = (node: WorkflowNode) => (
    <div key={node.id} className="workflow-node">
      <h3>{node.label}</h3>
      <p>{node.intent}</p>
      
      {node.type === 'atomic_task' && (
        <button onClick={() => onExecuteAction(node.id)}>
          ▶️ Execute
        </button>
      )}
      
      {node.actions?.map((action, i) => (
        <div key={i} className="action-item">
          <span>{action.primary?.type || action.type}</span>
          <span>{action.primary?.instruction || action.instruction}</span>
        </div>
      ))}
    </div>
  );
  
  const rootNodes = workflow.workflow.nodes.filter(n => !n.parentId);
  
  return (
    <div className="workflow-renderer">
      <h2>{workflow.meta.title}</h2>
      <p>{workflow.meta.description}</p>
      {workflow.meta.aiGenerated && <span className="ai-badge">🤖 AI</span>}
      
      <div className="nodes">
        {rootNodes.map(renderNode)}
      </div>
    </div>
  );
};
```

### Tasks
- [ ] Update AEFControlCenter to load from JSON API
- [ ] Build WorkflowRenderer for dynamic rendering
- [ ] Add WorkflowSelector for switching workflows
- [ ] Maintain existing UI styling and behavior

---

## 🎫 **Ticket 5: API Unification & Testing**
**Priority**: Medium | **Days**: 1 | **Complexity**: Low

### Objectives
- Update all API routes to use JSON workflows
- Remove hardcoded workflow definitions
- Add comprehensive testing

### Deliverables
1. Updated `app/api/aef/execute/route.ts`
2. Updated `app/api/aef/action/[id]/route.ts`
3. Test suite for new components
4. API documentation

### Unified Execute API
```typescript
export async function POST(request: NextRequest) {
  try {
    const { workflowId, userCredentials } = await request.json();
    
    // Load workflow from JSON
    const workflow = await WorkflowLoader.loadWorkflow(workflowId);
    
    // Inject credentials
    const injectedWorkflow = await CredentialInjector.inject(
      workflow, 
      userCredentials
    );
    
    // Start execution with JSON workflow
    const engine = new ExecutionEngine(injectedWorkflow, user.id);
    const executionId = await engine.startExecution();
    
    return NextResponse.json({
      success: true,
      executionId,
      workflow: {
        id: workflow.meta.id,
        title: workflow.meta.title
      }
    });
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Unified Action API
```typescript
export async function POST(request: NextRequest, { params }) {
  try {
    const { stepId } = await request.json();
    const executionId = params.id;
    
    // Get execution context
    const execution = await getExecutionContext(executionId);
    
    // Load workflow
    const workflow = await WorkflowLoader.loadWorkflow(execution.workflowId);
    
    // Find target node
    const node = workflow.workflow.nodes.find(n => n.id === stepId);
    if (!node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    
    // Execute using hybrid mapper
    const mapper = new HybridActionMapper();
    const results = [];
    
    for (const action of node.actions) {
      const result = await mapper.executeAction(action, executionId);
      results.push(result);
    }
    
    return NextResponse.json({ success: true, stepId, results });
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

### Test Suite
```typescript
describe('WorkflowLoader', () => {
  test('loads valid workflow JSON', async () => {
    const workflow = await WorkflowLoader.loadWorkflow('gmail-investor-crm');
    expect(workflow.meta.id).toBe('gmail-investor-crm');
    expect(workflow.workflow.nodes.length).toBeGreaterThan(0);
  });
  
  test('validates schema', async () => {
    await expect(
      WorkflowLoader.loadWorkflow('invalid')
    ).rejects.toThrow('Invalid workflow');
  });
});

describe('CredentialInjector', () => {
  test('replaces variables', async () => {
    const workflow = createTestWorkflow();
    const credentials = { gmail_email: 'test@gmail.com' };
    
    const result = await CredentialInjector.inject(workflow, credentials);
    
    const emailAction = result.workflow.nodes[0].actions[0];
    expect(emailAction.primary.data.text).toBe('test@gmail.com');
  });
});
```

### Tasks
- [ ] Update execute API to load from JSON
- [ ] Update action API to use HybridActionMapper
- [ ] Remove all hardcoded workflow definitions
- [ ] Build comprehensive test suite
- [ ] Update API documentation

---

## 🚀 Implementation Timeline

### **Week 1: Foundation**
- Days 1-2: Complete Tickets 1 & 2
- Extract hardcoded workflow to JSON
- Build loader and validator
- Basic JSON workflow loading works

### **Week 2: Core Engine** 
- Days 3-4: Complete Ticket 3
- Build HybridActionMapper
- Integrate with existing execution engine
- Hybrid primary/fallback working

### **Week 3: Frontend Integration**
- Days 5-6: Complete Ticket 4  
- Update UI components to use JSON
- Dynamic workflow rendering
- Maintain existing UX

### **Week 4: Finalization**
- Day 7: Complete Ticket 5
- Unify all APIs
- Remove hardcoded definitions
- Testing and documentation

### **Week 5: AI Generation Ready**
- Add AI workflow generation endpoint
- End-to-end testing
- Performance optimization

---

## 📊 Success Criteria

### **Technical**
- ✅ Zero hardcoded workflows in codebase
- ✅ Single source of truth (JSON files)
- ✅ AI can generate valid workflows
- ✅ Performance maintained or improved
- ✅ All existing functionality preserved

### **Business**
- ✅ AI workflow generation enabled
- ✅ Workflow creation time reduced 90%
- ✅ Developer productivity increased
- ✅ Foundation for advanced features

### **Quality** 
- ✅ No regressions in execution
- ✅ Comprehensive test coverage
- ✅ Error handling improved
- ✅ Documentation complete

---

## 🎯 Next Steps

1. **Start with Ticket 1** - Create JSON schema and extract workflow
2. **Validate approach** - Test with existing hardcoded workflow  
3. **Build incrementally** - One ticket at a time with testing
4. **Maintain compatibility** - Keep fallbacks during transition
5. **Enable AI generation** - Foundation for future AI workflow creation

This refactor creates the architectural foundation needed for AI-powered workflow generation while maintaining all existing functionality and improving maintainability. 