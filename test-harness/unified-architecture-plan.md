# Test Harness Unified Architecture Plan

## Executive Summary

The current test harness has grown organically with multiple conflicting workflow sources and execution patterns. This plan proposes a radical simplification into a single, unified architecture that supports both atomic node execution (for debugging) and phase-based execution (for running larger workflow chunks).

## Current State Analysis

### Problems Identified

1. **Multiple Workflow Definition Sources**
   - `frontend/app.js`: Workflows embedded in React components
   - `bulletproof-email-workflow.js`: Standalone workflow file
   - Inline definitions in test files
   - No clear canonical source

2. **Multiple Execution Implementations**
   - `server.js`: HTTP-based executor
   - `test-primitive.js`: Standalone PrimitiveExecutor class
   - Frontend execution logic
   - Direct StageHand calls in test files

3. **Lack of Granular Control**
   - Can't easily run individual nodes
   - Can't run specific phases
   - No way to start/stop at arbitrary points
   - Debugging requires modifying code

4. **State Management Inconsistency**
   - Different state handling between implementations
   - No clear state inspection tools
   - State mutations not tracked

## Proposed Unified Architecture

### Directory Structure
```
test-harness/
├── workflows/
│   ├── definitions/
│   │   ├── gmail-airtable.js      # Main workflow
│   │   ├── experimental.js        # Test workflows
│   │   └── examples.js            # Example patterns
│   ├── library/
│   │   ├── phases/               # Reusable phase definitions
│   │   │   ├── gmail-login.js
│   │   │   ├── airtable-setup.js
│   │   │   └── email-processing.js
│   │   └── nodes/                # Reusable node definitions
│   │       ├── auth.js
│   │       ├── extraction.js
│   │       └── navigation.js
│   ├── executor/
│   │   ├── index.js              # Main executor
│   │   ├── primitives.js         # Primitive implementations
│   │   └── state-manager.js      # State handling
│   └── interfaces/
│       ├── cli.js                # Command-line interface
│       ├── server.js             # HTTP API
│       └── ui-adapter.js         # Frontend adapter
├── frontend/
│   └── app.js                    # Simplified UI
└── package.json                  # New scripts
```

### Core Concepts

#### 1. Workflow Definition Format
```javascript
export const workflowDefinition = {
  id: 'gmail-airtable-crm',
  version: '1.0.0',
  name: 'Gmail→Airtable CRM Sync',
  description: 'Extract investor emails and sync to Airtable',
  
  // Configuration
  config: {
    credentials: {
      gmail: { email: '{{env.GMAIL_EMAIL}}', password: '{{env.GMAIL_PASSWORD}}' },
      airtable: { baseId: '{{env.AIRTABLE_BASE_ID}}' }
    },
    options: {
      dateRange: { start: '2025/06/01', end: '2025/06/03' },
      retryAttempts: 3
    }
  },
  
  // Reusable phases (groups of nodes)
  phases: {
    'setup': {
      name: 'Initial Setup',
      description: 'Login to Gmail and Airtable',
      nodes: ['setup-gmail', 'setup-airtable']
    },
    'setup-gmail': {
      name: 'Gmail Setup',
      nodes: ['navigate-gmail', 'check-gmail-login', 'login-gmail']
    },
    'setup-airtable': {
      name: 'Airtable Setup',
      nodes: ['open-airtable', 'check-airtable-login', 'login-airtable']
    },
    'extract-emails': {
      name: 'Extract and Filter',
      nodes: ['search-emails', 'extract-list', 'classify-investors', 'filter-list']
    },
    'process-email': {
      name: 'Process Single Email',
      nodes: ['click-email', 'extract-content', 'extract-investor', 'update-airtable']
    }
  },
  
  // Individual atomic nodes
  nodes: {
    'navigate-gmail': {
      type: 'browser_action',
      method: 'goto',
      target: 'https://mail.google.com',
      description: 'Navigate to Gmail'
    },
    'check-gmail-login': {
      type: 'browser_query',
      method: 'extract',
      instruction: 'Check if Gmail inbox is visible',
      schema: { isLoggedIn: { type: 'boolean' } },
      output: 'gmailLoggedIn'
    },
    'search-emails': {
      type: 'sequence',
      nodes: [
        {
          type: 'browser_action',
          method: 'click',
          target: 'search box'
        },
        {
          type: 'browser_action',
          method: 'type',
          target: 'search input',
          data: 'after:{{config.options.dateRange.start}} before:{{config.options.dateRange.end}}'
        }
      ]
    },
    // ... more nodes
  },
  
  // Main workflow flow
  flow: {
    type: 'sequence',
    items: [
      { ref: 'phase:setup' },
      { ref: 'phase:extract-emails' },
      {
        type: 'iterate',
        over: 'state.investorEmails',
        as: 'currentEmail',
        body: { ref: 'phase:process-email' }
      },
      { ref: 'node:generate-summary' }
    ]
  }
};
```

#### 2. Unified Executor
```javascript
class UnifiedExecutor {
  constructor(options = {}) {
    this.stagehand = options.stagehand;
    this.state = new StateManager();
    this.options = options;
  }
  
  // Main execution methods
  async run(workflow, runOptions = {}) {
    const {
      only,      // Array of phases/nodes to run: ['phase:setup', 'node:extract-list']
      startAt,   // Start at specific phase/node: 'phase:extract-emails'
      stopAt,    // Stop after specific phase/node: 'phase:process-email'
      debug,     // Step-by-step mode with state inspection
      dryRun     // Validate without executing
    } = runOptions;
    
    // Execute based on options
    if (only) {
      return await this.runOnly(workflow, only);
    } else if (startAt || stopAt) {
      return await this.runRange(workflow, startAt, stopAt);
    } else {
      return await this.runFlow(workflow, workflow.flow);
    }
  }
  
  async runPhase(workflow, phaseName) {
    const phase = workflow.phases[phaseName];
    console.log(`📋 Running phase: ${phase.name}`);
    
    const results = [];
    for (const nodeRef of phase.nodes) {
      const result = await this.runNode(workflow, nodeRef);
      results.push(result);
    }
    return results;
  }
  
  async runNode(workflow, nodeName) {
    const node = workflow.nodes[nodeName];
    console.log(`🔧 Running node: ${nodeName}`);
    
    // Handle node references
    if (node.ref) {
      return await this.runReference(workflow, node.ref);
    }
    
    // Execute primitive
    return await this.executePrimitive(node);
  }
  
  // State inspection
  getState() {
    return this.state.getAll();
  }
  
  // Debugging support
  async stepThrough(workflow, breakpoints = []) {
    // Interactive step-by-step execution
  }
}
```

#### 3. CLI Interface
```bash
# Run full workflow
npm run workflow gmail-airtable

# Run specific phase
npm run workflow gmail-airtable --phase setup

# Run specific nodes
npm run workflow gmail-airtable --nodes navigate-gmail,check-gmail-login

# Run with range
npm run workflow gmail-airtable --start phase:extract-emails --stop phase:process-email

# Debug mode (step-by-step)
npm run workflow gmail-airtable --debug

# List available phases and nodes
npm run workflow gmail-airtable --list

# Dry run (validate without executing)
npm run workflow gmail-airtable --dry-run
```

#### 4. HTTP API
```javascript
// Simplified server.js
app.post('/workflow/:id/run', async (req, res) => {
  const { id } = req.params;
  const { options } = req.body;
  
  const workflow = await loadWorkflow(id);
  const executor = new UnifiedExecutor({ stagehand });
  
  const result = await executor.run(workflow, options);
  res.json({ success: true, result, state: executor.getState() });
});

app.get('/workflow/:id/phases', async (req, res) => {
  const workflow = await loadWorkflow(req.params.id);
  res.json({ phases: Object.keys(workflow.phases) });
});
```

### Migration Path

1. **Phase 1: Setup Structure** (Day 1)
   - Create new directory structure
   - Move primitive implementations to `executor/primitives.js`
   - Create StateManager class

2. **Phase 2: Port Workflows** (Day 2-3)
   - Convert existing workflows to new format
   - Extract reusable phases and nodes
   - Create workflow library

3. **Phase 3: Build Executor** (Day 4-5)
   - Implement UnifiedExecutor
   - Add granular execution options
   - Add debugging capabilities

4. **Phase 4: Create Interfaces** (Day 6)
   - Build CLI tool
   - Simplify server.js
   - Update frontend adapter

5. **Phase 5: Testing & Documentation** (Day 7)
   - Test all execution modes
   - Document new architecture
   - Create migration guide

### Benefits

1. **Single Source of Truth**: All workflows in `workflows/definitions/`
2. **Granular Control**: Run any combination of phases/nodes
3. **Debugging**: Step-through execution with state inspection
4. **Reusability**: Share phases and nodes across workflows
5. **Multiple Interfaces**: CLI, API, and UI all use same executor
6. **Maintainability**: Clear separation of concerns
7. **Extensibility**: Easy to add new primitives or workflows

### Example Usage

```javascript
// Run just the setup phase
const executor = new UnifiedExecutor({ stagehand });
await executor.run(gmailAirtableWorkflow, {
  only: ['phase:setup']
});

// Debug email extraction
await executor.run(gmailAirtableWorkflow, {
  startAt: 'phase:extract-emails',
  debug: true
});

// Run single node
await executor.runNode(gmailAirtableWorkflow, 'extract-list');

// Get current state
console.log(executor.getState());
```

This unified architecture provides the flexibility to run workflows at any granularity while maintaining a single, clean source of truth for all workflow definitions.