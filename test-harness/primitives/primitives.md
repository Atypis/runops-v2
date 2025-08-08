# AEF Node Primitives: Comprehensive Analysis

## Table of Contents
1. [Existing Node Types](#existing-node-types)
2. [Primitive Framework Analysis](#primitive-framework-analysis)
3. [Future Improvements & Overlaps](#future-improvements--overlaps)
4. [Pure StageHand API](#pure-stagehand-api)
5. [The Canonical Cleansing Plan](#the-canonical-cleansing-plan)

---

## Existing Node Types

### Current Implementation (11 Node Types)

#### 1. atomic_task
**Purpose**: Basic execution unit for browser and AI actions  
**Key Actions**: navigate, click, type, act, extract, wait, screenshot  
**Strength**: Direct browser control with AI fallback  
**Weakness**: Can become a "kitchen sink" if overloaded with actions

#### 2. compound_task
**Purpose**: Logical grouping and sequential execution of child nodes  
**Parameters**: children[], canExecuteAsGroup  
**Strength**: Clean workflow organization  
**Weakness**: Limited to sequential execution only

#### 3. list_iterator
**Purpose**: Iterate through arrays with scoped variable management  
**Parameters**: listVariable, itemVariable, indexVariable, maxIterations, continueOnError  
**Strength**: Proper scope management and error handling  
**Weakness**: No parallel execution, can be slow for large lists

#### 4. decision
**Purpose**: Conditional branching based on extracted data  
**Outbound Edges**: Y/N paths based on conditions  
**Strength**: Clear binary decision paths  
**Weakness**: Limited to Y/N; complex multi-way decisions require chaining

#### 5. assert
**Purpose**: Validate conditions and halt on failure  
**Condition Types**: selectorVisible, urlMatch, textPresent  
**Strength**: Ensures workflow prerequisites  
**Weakness**: Binary pass/fail with no recovery options

#### 6. error_handler
**Purpose**: Error recovery with human escalation option  
**Parameters**: humanEscalate, fallbackAction  
**Strength**: Graceful degradation  
**Weakness**: Limited to single fallback strategy

#### 7. data_transform
**Purpose**: JavaScript-based data manipulation  
**Security**: Uses eval() - needs sandboxing  
**Strength**: Flexible data transformation  
**Weakness**: Security risk, no type safety

#### 8. generator
**Purpose**: AI-powered content generation  
**Implementation**: Wraps extract with generation prompt  
**Strength**: Natural language generation  
**Weakness**: Just a thin wrapper over extract

#### 9. explore
**Purpose**: Bounded UI exploration with AI  
**Parameters**: maxActions (default: 6)  
**Strength**: Adaptive exploration  
**Weakness**: Limited use cases, can be unpredictable

#### 10. filter_list
**Purpose**: LLM-based array filtering  
**Parameters**: batchSize, promptTemplate  
**Strength**: Semantic filtering capabilities  
**Weakness**: Expensive for large lists, non-deterministic

#### 11. llm_call
**Purpose**: Direct LLM API calls without browser context  
**Parameters**: model, promptTemplate, outputSchema  
**Strength**: Lightweight, no browser overhead  
**Weakness**: New addition, still being integrated

---

## Primitive Framework Analysis

### Layer 1: Browser Mechanics (StageHand Integration)

**Core Primitives**:
- navigate / navigate_or_switch_tab
- click (with AI fallback)
- type (with credential injection)
- wait / wait_for_navigation
- screenshot
- act (AI-powered catch-all)

**Design Pattern**: These are thin wrappers around StageHand/Playwright with standardized error handling and memory capture.

**Quality Assessment**: ✅ Well-designed, follows single responsibility

### Layer 2: Domain Intelligence

**Core Primitives**:
- extract (structured data extraction)
- extract_list (with pagination)
- filter_list (semantic filtering)
- llm_call (pure LLM operations)
- data_transform (data manipulation)

**Application-Specific Actions** (Should be generalized):
- label_email → should be "apply_label" 
- search_airtable → should be "search_database"
- update_row / create_row → should be "upsert_record"

**Design Pattern**: AI-powered understanding and transformation of content

**Quality Assessment**: 🟡 Mixed - core primitives are good, but app-specific actions violate abstraction

### Layer 3: Workflow Coordination

**Core Primitives**:
- compound_task (sequential grouping)
- list_iterator (iteration with state)
- decision (branching)
- assert (validation gates)
- error_handler (recovery flows)

**Missing Primitives**:
- parallel_execution
- while_loop (condition-based iteration)
- switch_case (multi-way branching)
- aggregate (reduce operations)
- checkpoint (save/restore state)

**Design Pattern**: Control flow and state management across nodes

**Quality Assessment**: 🟡 Incomplete - good foundation but missing key patterns

### Layer 4: Meta/System Operations

**Existing**:
- generator (thin wrapper)
- explore (limited use)
- clear_memory (StageHand specific)

**Should Add**:
- log (structured logging)
- metric (performance tracking)
- cache (selector/result caching)
- notify (human notifications)

---

## Future Improvements & Overlaps

### 1. Node Consolidation Opportunities

#### Merge Overlapping Nodes:
- **generator** → Just use **extract** with generation prompt
- **explore** → Special case of **atomic_task** with observe actions
- **filter_list** → Could be **llm_call** with array input/output

#### Split Overloaded Nodes:
- **atomic_task** → Split into:
  - **browser_action** (navigate, click, type)
  - **ai_action** (act, observe, extract)
  - **wait_action** (wait, wait_for_navigation)

### 2. Missing Critical Primitives

#### State Management:
```javascript
{
  type: "checkpoint",
  label: "Save Progress",
  saveKeys: ["processedEmails", "investorQueue"],
  restoreOnFailure: true
}
```

#### Parallel Execution:
```javascript
{
  type: "parallel",
  label: "Process Multiple Tabs",
  children: ["tab1_flow", "tab2_flow"],
  maxConcurrency: 3,
  mergeStrategy: "combine"
}
```

#### Advanced Branching:
```javascript
{
  type: "switch",
  label: "Route by Email Type",
  switchOn: "emailCategory",
  cases: {
    "investor": "process_investor_flow",
    "customer": "process_customer_flow",
    "spam": "mark_spam_flow",
    "default": "manual_review"
  }
}
```

### 3. Architectural Improvements

#### A. Implement Proper Node Inheritance:
```
BaseNode
├── ActionNode (browser/AI actions)
├── ControlNode (flow control)
├── DataNode (transformations)
└── SystemNode (meta operations)
```

#### B. Standardize Node Interfaces:
- Every node should have: preExecute, execute, postExecute hooks
- Consistent error handling and retry policies
- Standardized memory capture points

#### C. Create Composable Sub-Workflows:
- Package common patterns (login flows, pagination, etc.)
- Enable workflow importing/composition
- Build a library of tested patterns

### 4. Selector Learning System

Implement the planned hybrid approach:
1. Track selector success rates
2. Automatically cache stable selectors
3. Fall back to AI when selectors fail
4. Continuously improve selector library

### 5. Type Safety & Validation

- Replace eval() in data_transform with safe expression parser
- Add TypeScript interfaces for all node types
- Runtime validation of node configurations
- Static analysis of workflow JSON

### 6. Performance Optimizations

#### Batching:
- Group similar operations (multiple extracts, clicks)
- Reduce LLM round trips

#### Caching:
- Cache extracted data within iterations
- Reuse StageHand sessions
- Store successful selectors

#### Parallelization:
- Process independent branches concurrently
- Parallel list processing for large datasets

### 7. Developer Experience

#### Better Error Messages:
- Node-specific error types
- Actionable error descriptions
- Suggested fixes

#### Debugging Tools:
- Step-through execution
- Breakpoints in JSON
- State inspection

#### Testing Framework:
- Mock nodes for unit testing
- Workflow validation
- Performance benchmarks

---

## Pure StageHand API

This is the raw StageHand API - nothing more, nothing less. These are the only methods StageHand actually provides:

### Core Methods

#### act(options)
Execute an AI-powered action based on natural language instructions.
```javascript
await stagehand.act("Click the login button")
```

#### observe(options)
Observe the page and return possible actions that could be taken.
```javascript
await stagehand.observe("Find all clickable buttons")
```

#### extract(options)
Extract structured data from the page using AI.
```javascript
await stagehand.extract({ 
  instruction: "Get all email addresses", 
  schema: { emails: z.array(z.string()) }
})
```

#### goto(url, options)
Navigate to a URL (enhanced Playwright goto with captcha solving).
```javascript
await stagehand.goto("https://example.com")
```

#### agent(config)
Create an AI agent for complex multi-step tasks.
```javascript
const agent = stagehand.agent({ provider: "openai" })
await agent.execute("Book a flight to NYC")
```

### Utility Methods

- **waitForCaptchaSolve(timeout)** - Wait for captcha resolution
- **_waitForSettledDom(timeout)** - Wait for DOM to settle
- **init()** - Initialize session
- **close()** - Close session

### Properties
- **page** - Playwright page instance
- **context** - Browser context
- **metrics** - Usage metrics
- **history** - Action history

**That's it. Everything else is AEF's invention.**

---

## The Canonical Cleansing Plan

### First Principles
Before we cleanse, let's establish the principles that guide us:

**A. Orthogonality**: Every primitive does exactly ONE thing - no overlap, no ambiguity
**B. State × Effect Clarity**: Each primitive explicitly declares its state transitions and side effects
**C. Observability → Trust**: Every execution shows intent, inputs, outputs, effects, and failure modes
**D. Invariant Core**: Small, stable primitive set that won't change as the system evolves

### DELETE IMMEDIATELY (Redundant/Misguided)

1. **generator** - This is just `extract` with a generation prompt. DELETE.
2. **explore** - A confused `observe` wrapper. DELETE.
3. **filter_list** - This is `cognition` with array processing. DELETE.
4. **clear_memory** - Should be a context operation, not a separate node. DELETE.
5. **assert** - This is just `browser_query` + `route`. DELETE.
6. **decision** - Subsumed by the more general `route` primitive. DELETE.
7. **error_handler** - Subsumed by `handle` primitive. DELETE.
8. **compound_task** - Redundant, workflows are sequential by default. DELETE.

### RENAME/GENERALIZE (Too Specific)

1. **label_email** → Part of `browser_action` 
2. **search_airtable** → Part of `browser_action`
3. **update_row/create_row** → Part of `browser_action` sequence
4. **wait_for_navigation** → Parameter to `browser_action`
5. **llm_call** → **cognition** (better name for AI thinking)
6. **data_transform** → **transform** (cleaner, simpler)

### THE 9 CANONICAL PRIMITIVES

Here are the ONLY primitives you need:

#### Execution Layer (4 primitives)

1. **browser_action** - Side-effectful browser operations
   ```javascript
   {
     type: "browser_action",
     method: "goto|click|type",
     target: "selector or url",
     data: "optional data"
   }
   ```
   *Idempotency: Maybe | Side effects: Yes*

2. **browser_query** - Pure browser observations
   ```javascript
   {
     type: "browser_query", 
     method: "observe|extract",
     instruction: "what to find/extract",
     schema: "expected shape"
   }
   ```
   *Idempotency: Yes | Side effects: No*

3. **transform** - Pure data manipulation
   ```javascript
   {
     type: "transform",
     input: "state.sourceData",
     function: "data => data.map(x => x.toUpperCase())",
     output: "state.transformedData"
   }
   ```
   *Idempotency: Yes | Side effects: No*

4. **cognition** - AI-powered thinking/reasoning
   ```javascript
   {
     type: "cognition",
     prompt: "Classify these emails as investor-related or not",
     input: "state.emails",
     output: "state.classifications",
     model: "gpt-4o-mini"
   }
   ```
   *Idempotency: No (non-deterministic) | Side effects: No*

#### Control Layer (3 primitives)

1. **iterate** - Loop over collections with scope
   ```javascript
   {
     type: "iterate",
     over: "state.items",
     variable: "currentItem",
     index: "currentIndex",
     body: node or [nodes],
     continueOnError: true,
     limit: 10
   }
   ```

3. **route** - Multi-way branching (handles all conditionals)
   ```javascript
   // Simple value routing
   {
     type: "route",
     value: "state.emailType",
     paths: {
       "investor": "investorFlow",
       "customer": "customerFlow",
       "default": "unknownFlow"
     }
   }
   
   // Condition-based routing
   {
     type: "route",
     conditions: [
       {
         path: "state.priority",
         operator: "greater",
         value: 5,
         branch: "urgentFlow"
       }
     ],
     default: "normalFlow"
   }
   ```
   *Supports both exact value matching and complex conditions*

4. **handle** - Error boundaries with recovery
   ```javascript
   {
     type: "handle",
     try: "riskyNode",
     catch: "errorRecoveryNode",
     finally: "cleanupNode"
   }
   ```

#### State Layer (1 primitive)

1. **context** - Explicit control over execution context
   ```javascript
   {
     type: "context",
     operation: "set|get|clear|merge",
     key: "variableName",
     value: "data to store"
   }
   ```
   *Note: Context is auto-populated by other nodes, use this for explicit control*

### EVERYTHING IS COMPOSITION

With these 9 primitives, you can build anything:

**Login Flow:**
```javascript
// Workflows are arrays - they execute sequentially by default
[
  {type: "browser_action", method: "goto", target: "https://gmail.com"},
  {type: "browser_action", method: "type", target: "#email", data: "user@example.com"},
  {type: "browser_action", method: "click", target: "#next"},
  {type: "handle", try: "passwordEntry", catch: "handle2FA"}
]
```

**Email Classification:**
```javascript
// Sequential steps to classify emails
[
  {type: "browser_query", method: "extract", instruction: "Get all email subjects"},
  {type: "cognition", prompt: "Which are investor emails?", input: "state.emails"},
  {type: "transform", function: "filter by classification", output: "state.investorEmails"}
]
```

**Process Email List:**
```javascript
iterate({
  over: "state.emails",
  as: "email",
  body: [
    {type: "browser_action", method: "click", target: "email"},
    {type: "browser_query", method: "extract", instruction: "Get email content"},
    {type: "route", value: "state.emailType", paths: {...}}
  ]
})
```

### THE RADICAL SIMPLIFICATION

- **Current system**: 11 node types + 18 action types = 29 concepts
- **New system**: 9 primitives total
- **Reduction**: 69% fewer concepts to learn and maintain

### WHY THIS IS RIGHT

1. **Truly Orthogonal** - No primitive duplicates another's functionality
2. **Complete** - These 9 can express any browser automation workflow
3. **Learnable** - A developer can understand the entire system in minutes
4. **Stable** - The primitive set won't need to grow as requirements change
5. **Observable** - Each primitive's behavior is predictable and auditable

### IMPLEMENTATION PATH

**Phase 1: Adapter Layer**
- Build a compatibility layer that maps old nodes → new primitives
- Existing workflows continue to run unchanged

**Phase 2: Migration Tools**
- Automated converter from old JSON format to new format
- Side-by-side comparison to verify equivalence

**Phase 3: Clean Slate**
- New workflows use only the 9 primitives
- Deprecate and remove old node types
- Pure, simple, powerful

### THE HARD TRUTH

Your current system has 29 concepts because you've been adding a new node type for every new use case. This is unsustainable. With these 9 primitives, you'll never need to add another node type - just compose them differently.

**Choose simplicity. Choose composability. Choose the canonical 9.**

---

## Next-Generation Primitive Taxonomy

Below is the definitive, plain-English reference of every primitive in the Agentic Execution Framework, grouped by the seven high-level categories.  Each bullet states **what the primitive does** and **when you would typically use it**.

### Category Cheatsheet

• **Cognition – "Think"** Reason over information with the help of an LLM.  No side-effects.  
• **Observation & Extraction – "Read the World"** Look at the UI; gather structured facts.  
• **Action – "Change the World"** Click, type, navigate, or call an external API.  
• **Transform – "Pure Data Work"** Manipulate data in memory, pure & deterministic.  
• **Control-Flow – "Orchestrate"** Sequencing, branching, looping, waiting, error handling.  
• **State / Memory – "Remember"** Persist and retrieve workflow state.  
(• **Meta / System – "Observe the Observers"** Logging, metrics, notifications.)

---

### Category Details & Usage Notes

#### 1. Cognition – "Think"
Primitives in this layer should never alter the outside world.  They can *read* from context and write new insights back to context.

* **cognition** – The Swiss-army knife for AI reasoning.  Feed it input via a state path, a prompt, and (optionally) an output schema.  Useful for: decision-making, classification, summarisation, drafting replies, generating SQL, etc.

#### 2. Observation – "Read the World"
These nodes observe the browser without causing side-effects.

* **browser_query.extract** – Provide a natural-language instruction and a zod (?) schema; receives structured data.  Auto-stores results in state.
* **browser_query.observe** – Returns an object describing clickable/typable elements.  Handy for dynamic pages when selectors are unknown.

#### 3. Action – "Change the World"
All side-effectful operations live here.  They mutate the browser, an API, or external systems.

* **browser_action.goto / click / type / openNewTab / switchTab** – The standard Playwright-backed commands with AI selector help.  `goto` waits for network idle; `click` retries with AI hints; `type` supports credential vault.

#### 4. Transform – "Pure Data Work"

* **transform** – Runs user-provided JS over any input(s) from state and writes to a target path.  Guaranteed pure; ideal for filtering arrays, normalising strings, merging objects.

#### 5. Control-Flow – "Orchestrate"

* **Arrays** – Workflows are arrays that execute sequentially by default.
* **iterate** – `for-each` with local scope isolation; supports `index` variable.
* **route** – Multi-way or binary branching; supports "default".
* **handle** – Try/catch/finally.  Encourage small try bodies; avoid nesting.
* **browser_action.wait** – Fixed millisecond pause (part of browser actions for simplicity).

#### 6. Context / State – "Execution Context"

* **context.set / get / clear / merge** – Explicit control over workflow context.  Remember that many nodes auto-populate context (browser_query, iterate, etc.)
* **checkpoint** – Save context snapshot identified by `id`; restore later for retries or long sessions.

#### 7. Meta / System – "Observe the Observers" (Future work)

* **log** – Emits `{ level, message, data, timestamp }` to the central logger.
* **metric** – Records named counters, gauges, or histograms (e.g., `emailsProcessed +=1`).
* **notify** – Sends human-facing alerts; keep rare to avoid noise.

### Design Rules Recap
1. Every primitive belongs to exactly one category.
2. Only Action primitives create external side-effects.
3. Only Cognition primitives may call LLMs.
4. Observation primitives never mutate state outside their return value.
5. Control-Flow primitives orchestrate; they do not contain business logic.
6. Transform stays pure; no randomness or I/O.
7. Context is for workflow execution state, not for persisting to external databases.

---

## Conclusion

The AEF has a solid foundation with 11 node types covering basic workflow automation needs. However, there's significant room for improvement in:

1. **Abstraction**: Some nodes are too specific (Gmail, Airtable) and need generalization
2. **Completeness**: Missing critical patterns like parallel execution and state management  
3. **Architecture**: Overlapping responsibilities between nodes need consolidation
4. **Performance**: Current sequential-only approach limits scalability

The path forward should focus on:
- Extracting truly reusable primitives from the Gmail CRM workflow
- Implementing missing coordination patterns
- Building a proper node hierarchy with clear responsibilities
- Creating a library of composable sub-workflows

This will transform AEF from a specific-purpose tool into a general-purpose workflow automation framework.

### Essential Primitive Stack

The primitives below form the **irreducible core** that every workflow **must** understand.  If you remove anything here, you can no longer express at least one common pattern we already run in production.

**Cognition** – `cognition`

**Observation & Extraction** – `browser_query.extract`, `browser_query.observe`

**Action** – `browser_action.goto`, `browser_action.click`, `browser_action.type`, `browser_action.wait`, `browser_action.openNewTab`, `browser_action.switchTab`

**Transform** – `transform`

**Control-Flow** – `route`, `iterate`  _(and `handle` for robust error recovery)_  
_(Note: `wait` is part of `browser_action` for simplicity)_

**Context / State** – `context.set`, `context.get`, `context.clear`, `context.merge`

> These alone let you: think, read a page, act on it, loop, branch, recover from errors, wait for the world to settle, and store intermediate data.

---

### Optional / Extended Primitive Stack

Use these when you need extra ergonomics, observability, or advanced patterns – but you can implement all business logic without them.

*Control-Flow* – `parallel`  *(future)* – run branches concurrently.

*Context / State* – `checkpoint` – snapshot/restore long-running flows.

*Meta / System* – `log`, `metric`, `notify` – structured logging, performance counters, human alerts.

> Skip these if you are building a proof-of-concept or need the absolute minimal runtime surface.  Add them back as your workflows grow in complexity or operational maturity.

---