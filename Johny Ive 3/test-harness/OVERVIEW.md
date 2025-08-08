# Operator System Overview

This directory contains the **Operator (Director)** - an AI-powered system that creates browser automation workflows through natural language conversation.

## What Matters

### The Operator (`/operator/`)

The Operator is the core system - an AI that builds workflows by talking with users.

**Key Components:**

#### Backend (`/operator/backend/`)
- **`server.js`** - Express server (port 3002)
- **`services/`**
  - `directorService.js` - AI service that creates workflow nodes via OpenAI
  - `nodeExecutor.js` - Executes workflow nodes using StageHand
  - `workflowService.js` - Manages workflow lifecycle
- **`routes/director.js`** - API endpoints
- **`config/supabase.js`** - Database configuration
- **`prompts/directorPrompt.js`** - System prompts for the AI
- **`tools/toolDefinitions.js`** - Available tools the Director can use

#### Frontend (`/operator/frontend/`)
- **`index.html`** - React UI (no build required)
- **`app.js`** - Main application
- **`styles.css`** - Styling

#### Scout System (`/operator/scouts/`)
Python-based reconnaissance agents that explore UIs to find stable selectors:
- **`core/`** - Scout engine and configuration
- **`missions/`** - Specific scout missions (Airtable, Gmail, etc.)
- **`examples/`** - Example scout runners
- **`tests/`** - Scout test suite

#### Mock Director (`/operator/mock-director/`)
- Test the system without OpenAI API calls
- **`response.json`** - Mock responses to edit
- **`examples/`** - Example workflows

#### Database (`/operator/`)
- **`supabase-schema.sql`** - Complete database schema
- **`.env.example`** - Environment variables template

### Workflows (`/workflows/`) - OUTDATED

**⚠️ NOTE: This is NOT used by the Operator. It's a parallel implementation from the old test harness.**

A clean, modular workflow execution engine that we built before realizing the Operator had its own implementation. Kept for reference as it's actually better architected than the Operator's monolithic nodeExecutor.js.

#### Executor (`/workflows/executor/`)
- **`index.js`** - UnifiedExecutor class
- **`primitives/`** - All workflow operations:
  - `browser-action.js` - Click, type, navigate
  - `browser-query.js` - Extract data from pages
  - `cognition.js` - AI reasoning
  - `transform.js` - Data manipulation
  - `context.js` - Memory operations
  - `iterate.js` - Loops
  - `route.js` - Conditionals
  - `handle.js` - Error handling

#### Workflow Definitions (`/workflows/definitions/`)
- Pre-built workflows for common tasks

#### Interfaces (`/workflows/interfaces/`)
- **`cli.js`** - Run workflows from command line
- **`server.js`** - Workflow execution server

## How to Use

### 1. Start the Operator
```bash
cd operator
npm install
npm run dev
```
Open http://localhost:3002

### 2. Run Workflows
```bash
npm run workflow           # CLI interface
npm run workflow:list      # List available workflows
npm run workflow:server    # Start workflow server
```

### 3. Deploy Scouts
```bash
cd operator/scouts
python run_scout.py
```

## Key Concepts

1. **Director/Operator** - The AI that designs workflows through conversation
2. **Scouts** - Reconnaissance agents that explore UIs to find selectors
3. **Workflows** - The actual automation sequences that get executed
4. **Primitives** - Building blocks of workflows (click, type, extract, etc.)

## Environment Setup

Create `operator/.env`:
```
OPENAI_API_KEY=your_key
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
PORT=3002
```

That's it. Everything else in this folder is legacy cruft.