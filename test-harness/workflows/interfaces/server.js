import express from 'express';
import cors from 'cors';
import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';
import UnifiedExecutor from '../executor/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage for executors and services
let stagehand = null;
let openai = null;
let executors = new Map(); // Track multiple workflow executions

/**
 * Initialize services
 */
async function initializeServices() {
  if (!stagehand) {
    console.log('🚀 Initializing services...');
    
    stagehand = new Stagehand({
      env: 'LOCAL',
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      headless: false,
      verbose: 1,
      debugDom: true
    });
    
    await stagehand.init();
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    console.log('✅ Services initialized!');
  }
  
  return { stagehand, openai };
}

/**
 * Load workflow definition
 */
async function loadWorkflow(workflowId) {
  const workflowPath = join(__dirname, '..', 'definitions', `${workflowId}.js`);
  try {
    const module = await import(workflowPath);
    return module.default || module[workflowId];
  } catch (error) {
    throw new Error(`Failed to load workflow ${workflowId}: ${error.message}`);
  }
}

/**
 * Get all available workflows
 */
async function getAvailableWorkflows() {
  const definitionsDir = join(__dirname, '..', 'definitions');
  try {
    const files = await fs.readdir(definitionsDir);
    const workflows = [];
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const workflowId = path.basename(file, '.js');
        try {
          const workflow = await loadWorkflow(workflowId);
          workflows.push({
            id: workflowId,
            name: workflow.name,
            version: workflow.version,
            description: workflow.description
          });
        } catch (e) {
          console.error(`Failed to load workflow ${workflowId}:`, e);
        }
      }
    }
    
    return workflows;
  } catch (error) {
    console.error('Failed to list workflows:', error);
    return [];
  }
}

// API Routes

/**
 * GET /workflows - List available workflows
 */
app.get('/workflows', async (req, res) => {
  try {
    const workflows = await getAvailableWorkflows();
    res.json({ workflows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /workflows/:id - Get workflow details
 */
app.get('/workflows/:id', async (req, res) => {
  try {
    const workflow = await loadWorkflow(req.params.id);
    
    // Extract phases and nodes info
    const phases = workflow.phases ? Object.entries(workflow.phases).map(([key, phase]) => ({
      id: key,
      name: phase.name,
      description: phase.description,
      nodes: phase.nodes
    })) : [];
    
    const nodes = workflow.nodes ? Object.entries(workflow.nodes).map(([key, node]) => ({
      id: key,
      type: node.type,
      description: node.description
    })) : [];
    
    res.json({
      id: workflow.id,
      name: workflow.name,
      version: workflow.version,
      description: workflow.description,
      phases,
      nodes
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * POST /workflows/:id/run - Run workflow with options
 */
app.post('/workflows/:id/run', async (req, res) => {
  try {
    const workflowId = req.params.id;
    const runOptions = req.body;
    
    // Load workflow
    const workflow = await loadWorkflow(workflowId);
    
    // Initialize services if needed
    const services = await initializeServices();
    
    // Create new executor for this run
    const executorId = `${workflowId}_${Date.now()}`;
    const executor = new UnifiedExecutor(services);
    executors.set(executorId, executor);
    
    // Start execution (async)
    const executionPromise = executor.run(workflow, runOptions);
    
    // Return execution ID immediately
    res.json({
      executorId,
      workflow: workflowId,
      status: 'running',
      startedAt: new Date().toISOString()
    });
    
    // Handle completion in background
    executionPromise
      .then(results => {
        const exec = executors.get(executorId);
        if (exec) {
          exec.results = results;
          exec.status = 'completed';
          exec.completedAt = new Date().toISOString();
        }
      })
      .catch(error => {
        const exec = executors.get(executorId);
        if (exec) {
          exec.error = error.message;
          exec.status = 'failed';
          exec.completedAt = new Date().toISOString();
        }
      });
    
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

/**
 * GET /workflows/:id/phases - List phases for a workflow
 */
app.get('/workflows/:id/phases', async (req, res) => {
  try {
    const workflow = await loadWorkflow(req.params.id);
    
    if (!workflow.phases) {
      return res.json({ phases: [] });
    }
    
    const phases = Object.entries(workflow.phases).map(([key, phase]) => ({
      id: key,
      ref: `phase:${key}`,
      name: phase.name,
      description: phase.description,
      nodes: phase.nodes
    }));
    
    res.json({ phases });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * GET /workflows/:id/nodes - List nodes for a workflow
 */
app.get('/workflows/:id/nodes', async (req, res) => {
  try {
    const workflow = await loadWorkflow(req.params.id);
    
    if (!workflow.nodes) {
      return res.json({ nodes: [] });
    }
    
    const nodes = Object.entries(workflow.nodes).map(([key, node]) => ({
      id: key,
      ref: `node:${key}`,
      type: node.type,
      description: node.description,
      method: node.method,
      target: node.target
    }));
    
    res.json({ nodes });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

/**
 * GET /state - Get current executor state
 */
app.get('/state', async (req, res) => {
  const { executorId } = req.query;
  
  if (!executorId) {
    return res.status(400).json({ error: 'executorId query parameter required' });
  }
  
  const executor = executors.get(executorId);
  if (!executor) {
    return res.status(404).json({ error: 'Executor not found' });
  }
  
  res.json({
    executorId,
    status: executor.status || 'running',
    state: executor.getState(),
    results: executor.results,
    error: executor.error,
    startedAt: executor.startedAt,
    completedAt: executor.completedAt
  });
});

/**
 * GET /executors - List all active executors
 */
app.get('/executors', async (req, res) => {
  const list = Array.from(executors.entries()).map(([id, exec]) => ({
    id,
    status: exec.status || 'running',
    startedAt: exec.startedAt,
    completedAt: exec.completedAt
  }));
  
  res.json({ executors: list });
});

/**
 * DELETE /executors/:id - Clean up an executor
 */
app.delete('/executors/:id', async (req, res) => {
  const executorId = req.params.id;
  
  if (executors.has(executorId)) {
    executors.delete(executorId);
    res.json({ message: 'Executor cleaned up' });
  } else {
    res.status(404).json({ error: 'Executor not found' });
  }
});

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    services: {
      stagehand: !!stagehand,
      openai: !!openai
    },
    activeExecutors: executors.size
  });
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`🌐 Workflow server running on http://localhost:${PORT}`);
  console.log(`
Available endpoints:
  GET  /workflows              - List available workflows
  GET  /workflows/:id          - Get workflow details
  POST /workflows/:id/run      - Run workflow with options
  GET  /workflows/:id/phases   - List phases
  GET  /workflows/:id/nodes    - List nodes
  GET  /state?executorId=xxx   - Get executor state
  GET  /executors              - List all executors
  DELETE /executors/:id        - Clean up executor
  GET  /health                 - Health check
  `);
});