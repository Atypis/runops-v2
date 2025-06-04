# 🗃️ Ticket 001: AEF Data Models & TypeScript Interfaces

## 📋 Summary
Create comprehensive TypeScript interfaces and data models to support AEF execution capabilities while maintaining compatibility with existing SOP structures.

## 🎯 Acceptance Criteria
- [ ] New AEF-specific TypeScript interfaces created in `lib/types/`
- [ ] Existing `SOPDocument` interface extended with execution metadata
- [ ] All execution states, checkpoint configurations, and browser session data modeled
- [ ] Type safety maintained across all AEF operations
- [ ] Backward compatibility with existing SOP data structures

## 📝 Implementation Details

### New Files to Create
```
lib/types/
├── aef.ts                    # Core AEF execution types
├── execution.ts              # Execution state and control types  
├── checkpoint.ts             # Human intervention types
├── browser.ts                # Browser automation types
└── analytics.ts              # Execution analytics types
```

### Core Interfaces Required
```typescript
// AEF execution configuration
interface AEFExecutionConfig {
  checkpoints: CheckpointConfig[];
  secrets: SecretConfig[];
  executionMethod: ExecutionMethod;
  estimatedDuration?: number;
  parallelismEnabled?: boolean;
}

// Real-time execution state
interface AEFExecutionState {
  id: string;
  status: ExecutionStatus;
  currentStepId?: string;
  progress: number;
  browserSessionId?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// Extended SOP document with AEF capabilities
interface AEFDocument extends SOPDocument {
  aef?: {
    config: AEFExecutionConfig;
    lastExecution?: AEFExecutionState;
    learnedPatterns?: Pattern[];
  };
}
```

## 🤔 Key Design Decisions Needed

### 1. **Execution Method Granularity**
**Decision Required**: How granular should execution method configuration be?
- **Option A**: Per-workflow (all steps use same method)
- **Option B**: Per-step (each step can have different method)
- **Option C**: Per-node-type (different defaults for loops, decisions, etc.)

**Impact**: Affects complexity of UI and execution engine

### 2. **State Persistence Strategy**
**Decision Required**: How should execution state be persisted?
- **Option A**: In-memory only (lost on restart)
- **Option B**: Database snapshots at checkpoints
- **Option C**: Continuous state streaming to database

**Impact**: Affects recovery capabilities and performance

### 3. **Checkpoint Configuration Model**
**Decision Required**: How should checkpoints be configured?
- **Option A**: Boolean per step (on/off)
- **Option B**: Enum per step (never/errors/always/custom)
- **Option C**: Rules-based system with conditions

**Impact**: Affects user experience and automation flexibility

### 4. **Browser Session Lifecycle**
**Decision Required**: When should browser sessions be created/destroyed?
- **Option A**: One session per execution
- **Option B**: Persistent sessions across executions
- **Option C**: Pool of reusable sessions

**Impact**: Affects performance, resource usage, and state management

### 5. **Variable Scope & Context**
**Decision Required**: How should variables flow between steps?
- **Option A**: Global execution context
- **Option B**: Step-level scope with explicit passing
- **Option C**: Hierarchical scope (parent/child relationships)

**Impact**: Affects data flow design and debugging capabilities

## 📦 Dependencies
- Existing `lib/types/sop.ts` structure
- Understanding of browser automation library APIs
- Database schema design (Ticket 002)

## 🧪 Testing Requirements
- [ ] Type checking passes for all new interfaces
- [ ] Backward compatibility with existing SOP documents
- [ ] Mock data generation for all AEF types
- [ ] Integration with existing `sop-utils.ts` functions

## 📚 Documentation Needs
- [ ] JSDoc comments for all new interfaces
- [ ] Migration guide for existing SOP types
- [ ] Examples of AEF document structure
- [ ] Type relationship diagrams

---
**Priority**: High  
**Estimated Time**: 3-4 days  
**Dependencies**: None (foundational)  
**Blocks**: All other AEF tickets 