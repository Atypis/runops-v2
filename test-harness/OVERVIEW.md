# Test-Harness System Overview

This document provides a comprehensive overview of the test-harness system architecture, folder structure, and key files.

## System Architecture

The test-harness is a sophisticated browser automation and workflow orchestration system with three main components:

1. **Test Harness** - Rapid iteration environment for testing browser automation workflows
2. **Operator (Director)** - AI-powered conversational system that builds workflows through natural language
3. **Scout System** - Reconnaissance agents that discover stable UI selectors and patterns

## Directory Structure

```
test-harness/
├── operator/           # Main operator system with Director AI and Scout reconnaissance
├── workflows/          # Unified workflow execution system
├── frontend/           # Test harness frontend UI
├── primitives/         # Legacy primitives (see workflows/executor/primitives for active ones)
└── downloads/          # Downloaded files during testing
```

## Key Components

### 1. Operator System (`/operator/`)

The Operator is an AI-powered system that creates and manages browser automation workflows through natural language.

#### Backend (`/operator/backend/`)
- **`server.js`** - Express server, main entry point (port 3000)
- **`services/`**
  - `directorService.js` - AI service that processes natural language and creates workflow nodes
  - `nodeExecutor.js` - Executes individual workflow nodes
  - `workflowService.js` - Manages workflow lifecycle and persistence
- **`routes/director.js`** - API endpoints for Director operations
- **`config/supabase.js`** - Database configuration
- **`prompts/directorPrompt.js`** - System prompts for Director AI
- **`tools/toolDefinitions.js`** - Available tools for Director
- **`middleware/errorHandler.js`** - Global error handling

#### Frontend (`/operator/frontend/`)
- **`index.html`** - React-based UI (no build required)
- **`app.js`** - Main frontend application
- **`styles.css`** - Application styles

#### Mock Director (`/operator/mock-director/`)
- **`response.json`** - Mock responses for development
- **`response-simplified.json`** - Simplified mock responses
- **`examples/`** - Example workflow definitions

#### Scout System (`/operator/scouts/`)
Python-based reconnaissance system for discovering UI selectors:

- **Core Components:**
  - `scout_engine.py` - Main Scout execution engine
  - `scout_agent.py` - Enhanced Browser-Use agent
  - `scout_service.py` - Scout service layer
  - `scout_config.py` - Configuration and settings
  - `browser_use_patch.py` - Monkey patches for Browser-Use

- **Active Missions:**
  - `airtable_filter_scout.py` - Airtable filtering reconnaissance
  - `airtable_filter_scout_mission.py` - Filter mission implementation
  - `airtable_login_scout_mission.py` - Login flow reconnaissance
  - `airtable_record_interaction_scout.py` - Record interaction patterns

- **Runners:**
  - `run_scout.py` - Generic scout runner
  - `run_airtable_filter_scout.py` - Airtable-specific runner
  - `scout_benchmark.py` - Performance benchmarking

- **Test Suite:** (`/scouts/tests/`)
  - `test_integration.py` - Integration tests
  - `test_dom_patch.py` - DOM patching tests
  - `run_tests.py` - Test runner

#### Database Schema (`/operator/`)
- **`supabase-schema.sql`** - Complete database schema
- **`create-workflow-memory-table.sql`** - Workflow memory table
- **`add-workflow-memory-table.sql`** - Memory table additions

### 2. Workflow System (`/workflows/`)

Unified workflow execution engine with modular primitives.

#### Executor (`/workflows/executor/`)
- **`index.js`** - Main UnifiedExecutor class
- **`StateManager.js`** - Sophisticated state management
- **`primitives/`** - Modular primitive operations:
  - `base-primitive.js` - Base class for all primitives
  - `browser-action.js` - Click, type, navigate, etc.
  - `browser-query.js` - Extract data from DOM
  - `cognition.js` - AI reasoning and decisions
  - `transform.js` - Data transformation
  - `context.js` - Context/memory operations
  - `iterate.js` - Loop over collections
  - `route.js` - Conditional branching
  - `handle.js` - Error handling

#### Workflow Definitions (`/workflows/definitions/`)
- **`gmail-airtable-simple.js`** - Simple Gmail to Airtable workflow
- **`gmail-airtable-advanced.js`** - Advanced workflow with error handling
- **`example.js`** - Example workflow structure

#### Interfaces (`/workflows/interfaces/`)
- **`server.js`** - Workflow execution server
- **`cli.js`** - Command-line interface
- **`frontend-adapter.js`** - Frontend integration
- **`frontend-adapter-v2.js`** - Updated frontend adapter

### 3. Test Harness Frontend (`/frontend/`)

Rapid testing environment for workflow development.

- **`index.html`** - Main UI (vanilla HTML)
- **`app.js`** - Core application logic (164KB)
- **`app-v2.js`** - Previous version (can be removed)
- **`app-simple.js`** - Simplified version (can be removed)

### 4. Root Level Files

#### Entry Points
- **`server.js`** - Test harness server (port 3001)
- **`package.json`** - Dependencies and scripts
- **`package-lock.json`** - Locked dependencies

#### Test Files
- **`test-workflow.js`** - Workflow testing
- **`test-gmail-airtable.js`** - Gmail-Airtable integration tests
- **`test-primitive.js`** - Primitive testing
- **`test-node.js`** - Node testing

#### Documentation
- **`README.md`** - Main documentation
- **`README-FRONTEND.md`** - Frontend-specific docs
- **`plan.md`** - System planning document
- **`unified-architecture-plan.md`** - Architecture design
- **`canonical-workflow.md`** - Workflow standards
- **`primitives-catalogue.md`** - Available primitives

## Key Technologies

- **Frontend**: React (no build), Vanilla JS
- **Backend**: Node.js, Express
- **Database**: Supabase (PostgreSQL)
- **Browser Automation**: StageHand (Playwright wrapper)
- **AI Services**: OpenAI (Director), Gemini (Scouts)
- **Python**: Scout system using Browser-Use

## Running the System

### Test Harness
```bash
npm start                  # Start test harness on port 3001
```

### Operator
```bash
cd operator
npm start                  # Start operator on port 3000
```

### Workflows
```bash
npm run workflow gmail-airtable-simple  # Run a workflow
```

### Scouts
```bash
cd operator/scouts
python run_scout.py        # Run scout reconnaissance
```

## Development Workflow

1. **Rapid Testing**: Use test harness frontend at localhost:3001
2. **Workflow Creation**: Use Operator UI at localhost:3000
3. **Scout Reconnaissance**: Deploy scouts to discover selectors
4. **Workflow Execution**: Run workflows via CLI or API

## Important Notes

- Mock Director mode available for development without API calls
- Scouts use patched Browser-Use to expose hidden DOM attributes
- Workflows use position-based ordering, not explicit connections
- State is managed both in-memory and in Supabase