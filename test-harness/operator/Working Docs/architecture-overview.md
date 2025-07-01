# Architecture Overview: Three-Phase Workflow Automation System

## Core Vision

We're building a system to automate repetitive digital workflows with AI. This requires three distinct phases, each with its own specialized component:

```
(a) Capture Context → (b) Design Automation → (c) Execute in Production
```

## The Three Phases

### Phase A: Workflow Context Capture (Future)
**Status**: Not current focus

How users describe what they want automated:
- Video recording of manual process
- Chrome extension recording clicks/inputs
- Plain English description
- Combination of the above

### Phase B: Workflow Design & Construction (Current Focus)
**Component**: DIRECTOR (formerly "Operator")
**Helper**: SCOUT

This is where AI agents collaborate to build robust automation workflows:

```
User Intent → DIRECTOR → Scout Missions → Workflow Blueprint
                ↑            ↓
                └────────────┘
              (iterative refinement)
```

**DIRECTOR responsibilities:**
- Understands user's automation goals
- Designs workflow architecture
- Deploys Scouts for reconnaissance
- Constructs robust automation patterns
- Tests and refines the workflow

**SCOUT responsibilities:**
- Explores specific UI patterns on command
- Tests DOM selectors for reliability
- Measures timing requirements
- Discovers edge cases
- Reports findings back to Director

#### Architectural Principle: Deterministic Navigation vs Cognitive Processing

The Director designs workflows with a clear separation of concerns:

**Navigation & Interaction (Deterministic):**
- Uses **hardcoded Playwright selectors** discovered by Scouts
- Employs stable DOM selectors: `#submit-btn`, `[data-testid="email"]`, etc.
- Provides predictable, fast, reliable execution
- Reduces randomness and computational overhead
- Example nodes:
  ```javascript
  {
    "type": "browser_action",
    "config": {
      "action": "click",
      "selector": "#APjFqb",  // Hardcoded, stable selector
      "fallback": "click the search box"  // AI healing fallback
    }
  }
  ```

**Cognitive Processing (LLM-based):**
- Handles content understanding and decision-making
- Examples:
  - "Look at this email and summarize its contents for the CRM"
  - "Classify whether this email is investor-related or not"
  - "Extract key information from this unstructured text"
- Uses `cognition` nodes for AI reasoning:
  ```javascript
  {
    "type": "cognition",
    "config": {
      "prompt": "Analyze this email and determine if it's from an investor",
      "input": "{{email_content}}",
      "schema": {"isInvestor": "boolean", "confidence": "number"}
    }
  }
  ```

**Why This Separation:**
1. **Performance**: Deterministic selectors are instant vs LLM calls
2. **Reliability**: CSS selectors don't hallucinate or vary between runs
3. **Cost**: Navigation via selectors is free vs expensive LLM tokens
4. **Speed**: Direct DOM interaction is milliseconds vs seconds for LLM
5. **Debugging**: Deterministic paths are predictable and testable

**Healing Fallbacks:**
When deterministic selectors fail, the system can fall back to AI-driven `act()` methods, but this is the exception, not the rule. The goal is 90%+ deterministic navigation with AI as a safety net.

### Phase C: Production Execution (Future)
**Component**: EXECUTOR (not yet built)

The runtime that actually performs the automation:
- Executes the Director-designed workflows
- Handles dynamic situations with AI
- Self-heals when UI changes
- Reports execution status

## Key Distinctions

### DIRECTOR vs EXECUTOR
- **DIRECTOR**: The architect who designs the blueprint
- **EXECUTOR**: The construction crew who builds from the blueprint

### Why This Separation Matters

1. **Different AI Requirements**
   - Director needs planning, reasoning, architecture skills
   - Executor needs speed, reliability, error recovery

2. **Different Performance Characteristics**
   - Director can take time to design robust solutions
   - Executor must be fast and efficient in production

3. **Different Failure Modes**
   - Director failures = incomplete workflow design
   - Executor failures = automation doesn't complete

## Current Implementation Focus

We're building the DIRECTOR system with these components:

```
test-harness/operator/
├── backend/
│   ├── operatorService.js    # Director's brain
│   ├── nodeExecutor.js       # Workflow node execution
│   └── scoutService.js       # Scout deployment system
├── frontend/
│   └── app.js               # Director's UI
└── Working Docs/
    ├── director.md          # Director documentation
    ├── scout.md            # Scout documentation
    └── architecture.md     # This file
```

## Clarifications

### "Eyes" Are Metaphorical
When we say the Director needs "eyes", we mean:
- Ability to understand page structure through DOM
- Capability to test selectors and interactions
- Knowledge of what's possible on a page

This is NOT about:
- Computer vision or screenshot analysis
- Visual AI models (though they could help)
- Human-like visual perception

### Scout Exploration Methods
Scouts explore through:
- DOM traversal and selector testing
- Programmatic interaction attempts
- State change detection
- Timing measurements
- NOT primarily through visual analysis

## Example Workflow

1. **User Request**: "Automate extracting emails from Gmail to Airtable"

2. **Director Analysis**:
   - Break down into sub-tasks
   - Identify needed UI interactions
   - Plan Scout missions

3. **Scout Missions**:
   - Scout A: Explore Gmail search and email list
   - Scout B: Test Airtable record creation
   - Scout C: Find reliable selectors

4. **Director Construction**:
   - Build workflow from Scout reports
   - Add error handling
   - Create final automation

5. **Future Executor Run**:
   - Load Director's workflow
   - Execute in production
   - Handle dynamic situations

## Next Steps

1. Rename "Operator" → "Director" in codebase
2. Update all documentation for clarity
3. Focus on Director + Scout integration
4. Design Executor architecture for future

The key insight: We're not building the automation executor right now - we're building the AI system that designs automations.