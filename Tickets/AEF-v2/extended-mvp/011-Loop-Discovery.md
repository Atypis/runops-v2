# 🔄 Ticket 011: Dynamic Loop Discovery & Management

## 📋 Summary
Implement dynamic loop discovery that can detect unknown iteration counts at execution time (like "all emails today") and generate appropriate UI controls for managing each loop iteration individually.

## 🎯 Acceptance Criteria
- [ ] Automatic detection of loop items at execution time
- [ ] Dynamic UI generation for discovered loop iterations
- [ ] Individual control over each loop iteration (run/skip/retry)
- [ ] Progress tracking across variable-length loops
- [ ] Batch operations for similar loop items
- [ ] Loop context preservation and variable passing

## 📝 Implementation Details

### Backend Components
```
lib/loop/
├── LoopDiscoverer.ts           # Detect loop items at runtime
├── LoopIterationManager.ts     # Manage individual iterations
├── LoopContextManager.ts       # Handle variables between iterations
├── LoopProgressTracker.ts      # Track progress across iterations
├── BatchProcessor.ts           # Handle batch operations
└── LoopValidator.ts            # Validate loop completion
```

### Frontend Components
```
components/aef/loop/
├── DynamicLoopPanel.tsx        # Main loop management interface
├── LoopDiscoveryProgress.tsx   # Shows discovery progress
├── LoopIterationList.tsx       # List of discovered items
├── LoopItemController.tsx      # Controls for individual items
├── BatchOperationPanel.tsx     # Batch operation controls
└── LoopProgressIndicator.tsx   # Visual progress tracking
```

### Loop Discovery Types
```typescript
// Loop discovery configuration
interface LoopDiscoveryConfig {
  stepId: string;
  discoveryMethod: DiscoveryMethod;
  discoverySelector?: string; // For UI-based discovery
  discoveryQuery?: string;    // For API-based discovery
  itemIdentifier: string;     // How to uniquely identify items
  maxItems?: number;          // Safety limit
  timeout?: number;           // Discovery timeout
}

enum DiscoveryMethod {
  UI_ELEMENT_COUNT = 'ui_element_count',     // Count elements on page
  API_QUERY = 'api_query',                   // Query API for items
  DATABASE_QUERY = 'database_query',         // Query database
  FILE_LISTING = 'file_listing',             // List files/directories
  DYNAMIC_CONTENT = 'dynamic_content'        // Content that loads dynamically
}

// Discovered loop item
interface LoopItem {
  id: string;
  index: number;
  displayName: string;
  data: any;
  status: LoopItemStatus;
  context?: LoopItemContext;
  estimatedDuration?: number;
  priority?: LoopItemPriority;
}

enum LoopItemStatus {
  DISCOVERED = 'discovered',
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

enum LoopItemPriority {
  LOW = 'low',
  NORMAL = 'normal', 
  HIGH = 'high',
  URGENT = 'urgent'
}
```

### Loop Execution Management
```typescript
// Loop execution state
interface LoopExecutionState {
  loopId: string;
  status: LoopStatus;
  discoveredItems: LoopItem[];
  currentIndex: number;
  completedCount: number;
  failedCount: number;
  skippedCount: number;
  estimatedRemaining: number;
  batchOperations: BatchOperation[];
}

enum LoopStatus {
  DISCOVERING = 'discovering',
  READY = 'ready',
  EXECUTING = 'executing',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Batch operations for efficiency
interface BatchOperation {
  id: string;
  type: BatchOperationType;
  itemIds: string[];
  status: BatchOperationStatus;
  result?: BatchOperationResult;
}

enum BatchOperationType {
  RUN_ALL = 'run_all',
  SKIP_ALL = 'skip_all',
  RETRY_FAILED = 'retry_failed',
  RUN_SELECTED = 'run_selected',
  PRIORITIZE = 'prioritize'
}
```

## 🤔 Key Design Decisions Needed

### 1. **Discovery Timing Strategy**
**Decision Required**: When should loop discovery happen?
- **Option A**: Pre-execution discovery (before loop starts)
- **Option B**: Just-in-time discovery (when loop is reached)
- **Option C**: Progressive discovery (discover while executing previous items)

**Impact**: Affects execution speed and memory usage

### 2. **UI Generation Approach**
**Decision Required**: How should UI be generated for discovered items?
- **Option A**: Static template with dynamic data
- **Option B**: AI-generated UI based on item types
- **Option C**: User-configurable templates with smart defaults

**Impact**: Affects flexibility and development complexity

### 3. **Item Identification Strategy**
**Decision Required**: How should loop items be uniquely identified?
- **Option A**: Sequential numbering (simple but fragile)
- **Option B**: Content-based hashing (stable but complex)
- **Option C**: User-defined key extraction (flexible but requires configuration)

**Impact**: Affects reliability across executions

### 4. **Parallel Execution Model**
**Decision Required**: Should loop items be executed in parallel?
- **Option A**: Sequential only (simple, predictable)
- **Option B**: Configurable parallelism (user controls concurrency)
- **Option C**: Intelligent parallelism (system determines optimal concurrency)

**Impact**: Affects performance and resource usage

### 5. **Context Isolation Strategy**
**Decision Required**: How should variables be shared between loop iterations?
- **Option A**: Shared global context (simple but can cause conflicts)
- **Option B**: Isolated per-iteration context (safe but limited sharing)
- **Option C**: Hierarchical context with explicit sharing rules

**Impact**: Affects data flow and debugging complexity

### 6. **Discovery Failure Handling**
**Decision Required**: What happens if loop discovery fails?
- **Option A**: Fail the entire loop
- **Option B**: Continue with partial discovery
- **Option C**: Manual fallback with user input

**Impact**: Affects robustness and user experience

### 7. **Item Prioritization**
**Decision Required**: Should loop items have execution priority?
- **Option A**: No prioritization (simple FIFO)
- **Option B**: Manual user prioritization
- **Option C**: Intelligent auto-prioritization based on content

**Impact**: Affects execution efficiency and user control

## 📦 Dependencies
- Ticket 007 (Execution Engine) for loop execution
- Ticket 006 (Browser Integration) for UI-based discovery
- Ticket 008 (Real-Time Communication) for progress updates
- Ticket 009 (Checkpoint System) for loop approval

## 🧪 Testing Requirements
- [ ] Loop discovery accuracy across different websites
- [ ] UI generation for various item types
- [ ] Parallel execution correctness and safety
- [ ] Context isolation and variable passing
- [ ] Batch operation reliability
- [ ] Performance with large loop counts

## 📚 Documentation Needs
- [ ] Loop discovery configuration guide
- [ ] Supported discovery methods documentation
- [ ] Best practices for loop design
- [ ] Performance optimization for large loops
- [ ] Troubleshooting discovery failures

## 🎨 UI/UX Considerations
- [ ] Clear visual representation of loop progress
- [ ] Intuitive controls for individual items
- [ ] Efficient batch operation interface
- [ ] Responsive design for large item lists
- [ ] Visual grouping of similar items

## 🔒 Security Considerations
- [ ] Validation of discovered item data
- [ ] Prevention of infinite loop scenarios
- [ ] Safe handling of dynamic content
- [ ] Protection against malicious discovery results
- [ ] Audit logging of loop operations

## ⚡ Performance Considerations
- [ ] Efficient discovery algorithms
- [ ] Optimized UI rendering for large lists
- [ ] Memory management for loop state
- [ ] Progressive loading of loop items
- [ ] Efficient parallel execution scheduling

## 🐛 Error Scenarios to Handle
- [ ] Discovery timeout or failure
- [ ] Invalid or malformed discovered items
- [ ] Network failures during discovery
- [ ] Memory exhaustion with large loops
- [ ] Parallel execution conflicts
- [ ] Context corruption between iterations

## 📊 Analytics & Optimization
- [ ] Loop discovery success rates
- [ ] Item execution timing patterns
- [ ] Batch operation usage statistics
- [ ] User interaction patterns with loops
- [ ] Performance metrics for optimization

---
**Priority**: Medium  
**Estimated Time**: 6-7 days  
**Dependencies**: Tickets 006, 007, 008, 009  
**Blocks**: Ticket 012 