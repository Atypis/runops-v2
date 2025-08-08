# Unified Workflow Architecture

> **⚠️ IMPORTANT: This system is OUTDATED and NOT USED by the Operator/Director.**  
> See [OUTDATED_NOTICE.md](./OUTDATED_NOTICE.md) for details.  
> The Operator uses its own implementation in `operator/backend/services/nodeExecutor.js`.

This is the unified architecture that was built for the old test harness (now deleted). It provides a clean, modular approach to workflow execution.

## 🚀 Quick Start

### Run a complete workflow
```bash
npm run workflow gmail-airtable
```

### Run specific phases
```bash
npm run workflow gmail-airtable --phases setupPlatforms,extractEmails
```

### Run individual nodes
```bash
npm run workflow gmail-airtable --nodes navigateGmail,checkGmailLogin
```

### Debug mode
```bash
npm run workflow gmail-airtable --debug --phases extractEmails
```

### List available components
```bash
npm run workflow gmail-airtable --list
```

## 📁 Directory Structure

```
workflows/
├── definitions/          # Workflow definitions
│   └── gmail-airtable.js
├── executor/            # Core execution engine
│   ├── index.js        # UnifiedExecutor
│   ├── primitives.js   # Primitive implementations
│   └── state-manager.js # State management
├── interfaces/          # Different ways to run workflows
│   ├── cli.js          # Command-line interface
│   └── server.js       # HTTP API
├── library/            # Reusable components
│   ├── phases/         # Reusable phase definitions
│   └── nodes/          # Reusable node definitions
└── run-example.js      # Example usage

```

## 🎯 Key Concepts

### 1. Workflows
Complete automation sequences with metadata, configuration, phases, nodes, and flow.

### 2. Phases
Named groups of nodes that represent logical chunks of work (e.g., "setup", "extract-emails").

### 3. Nodes
Individual atomic operations that map to primitives (e.g., "navigateGmail", "extractEmailList").

### 4. References
Use `ref` to reference phases and nodes:
- `{ ref: 'phase:setupPlatforms' }` - Run a phase
- `{ ref: 'node:navigateGmail' }` - Run a node

## 🛠️ CLI Options

| Option | Description | Example |
|--------|-------------|---------|
| `--list` | List phases and nodes | `npm run workflow gmail-airtable --list` |
| `--phases` | Run specific phases | `--phases setup,extract` |
| `--nodes` | Run specific nodes | `--nodes navigateGmail,login` |
| `--only` | Run specific refs | `--only phase:setup,node:extract` |
| `--start` | Start at ref | `--start phase:extractEmails` |
| `--stop` | Stop after ref | `--stop phase:processEmail` |
| `--debug` | Step-by-step mode | `--debug` |
| `--dry-run` | Validate only | `--dry-run` |
| `--state` | Initial state JSON | `--state '{"email":"test@test.com"}'` |
| `--show-state` | Show final state | `--show-state` |
| `--output` | Save results | `--output results.json` |

## 🌐 HTTP API

Start the server:
```bash
npm run workflow:server
```

### Endpoints

#### List workflows
```bash
GET http://localhost:3002/workflows
```

#### Get workflow details
```bash
GET http://localhost:3002/workflows/gmail-airtable
```

#### Run workflow
```bash
POST http://localhost:3002/workflows/gmail-airtable/run
Content-Type: application/json

{
  "options": {
    "only": ["phase:setupPlatforms"],
    "debug": true
  }
}
```

#### Get executor state
```bash
GET http://localhost:3002/state?executorId=xxx
```

## 📝 Workflow Definition Format

```javascript
export default {
  id: 'gmail-airtable',
  version: '1.0.0',
  name: 'Gmail→Airtable CRM Sync',
  description: 'Extract investor emails and sync to Airtable',
  
  config: {
    credentials: {
      gmail: { email: '{{env.GMAIL_EMAIL}}' },
      airtable: { baseId: '{{env.AIRTABLE_BASE_ID}}' }
    }
  },
  
  phases: {
    'setup': {
      name: 'Initial Setup',
      nodes: ['navigateGmail', 'checkLogin']
    }
  },
  
  nodes: {
    'navigateGmail': {
      type: 'browser_action',
      method: 'goto',
      target: 'https://mail.google.com'
    }
  },
  
  flow: {
    type: 'sequence',
    items: [
      { ref: 'phase:setup' },
      { ref: 'node:extractEmails' }
    ]
  }
};
```

## 🔧 Programmatic Usage

```javascript
import UnifiedExecutor from './executor/index.js';
import workflow from './definitions/gmail-airtable.js';

const executor = new UnifiedExecutor({ stagehand, openai });

// Run full workflow
await executor.run(workflow);

// Run specific phase
await executor.runPhase(workflow, 'setupPlatforms');

// Run single node
await executor.runNode(workflow, 'navigateGmail');

// Get state
const state = executor.getState();
```

## 🐛 Debugging

1. Use `--debug` flag for step-by-step execution
2. Use `--show-state` to see final state
3. Use `--output` to save detailed results
4. Check execution history with `executor.getHistory()`

## 🚦 Migration from Old System

1. Old workflows in `frontend/app.js` → New format in `definitions/`
2. Direct primitive calls → Use `UnifiedExecutor`
3. Scattered test files → Unified CLI interface

The new architecture provides:
- ✅ Single source of truth
- ✅ Granular execution control
- ✅ Better debugging tools
- ✅ Reusable components
- ✅ Multiple interfaces (CLI, API, programmatic)