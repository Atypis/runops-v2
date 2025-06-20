import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import UnifiedExecutor from '../executor/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve specific files for the new frontend
app.get('/', (req, res) => {
  console.log('Serving new frontend index-v2.html');
  res.sendFile(join(__dirname, '../../frontend/index-v2.html'));
});

app.get('/app-simple.js', (req, res) => {
  console.log('Serving new frontend app-simple.js');
  res.sendFile(join(__dirname, '../../frontend/app-simple.js'));
});

let stagehand = null;
let openai = null;
let executor = null;

// Initialize services
async function initialize() {
  try {
    console.log('🚀 Initializing StageHand...');
    
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
    
    // Create executor with proper page tracking
    executor = new UnifiedExecutor({ 
      stagehand, 
      openai,
      pages: { main: stagehand.page },
      currentPage: stagehand.page
    });
    
    // Update primitives with pages
    executor.primitives.pages = { main: stagehand.page };
    executor.primitives.currentPage = stagehand.page;
    
    console.log('✅ StageHand initialized!');
    return true;
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    return false;
  }
}

// Load workflow from definitions
async function loadWorkflow(workflowId) {
  const workflowPath = join(__dirname, '..', 'definitions', `${workflowId}.js`);
  try {
    const module = await import(workflowPath);
    return module.default || module[workflowId];
  } catch (error) {
    console.error(`Failed to load workflow ${workflowId}:`, error);
    return null;
  }
}

// API Endpoints

app.get('/status', async (req, res) => {
  const connected = !!stagehand;
  const currentUrl = connected && stagehand.page ? stagehand.page.url() : null;
  res.json({ connected, currentUrl });
});

app.post('/connect', async (req, res) => {
  const success = await initialize();
  res.json({ success });
});

// List all workflows
app.get('/workflows', async (req, res) => {
  try {
    const definitionsDir = join(__dirname, '..', 'definitions');
    const files = await fs.readdir(definitionsDir);
    const workflows = [];
    
    for (const file of files) {
      if (file.endsWith('.js')) {
        const filename = path.basename(file, '.js');
        const workflow = await loadWorkflow(filename);
        if (workflow) {
          workflows.push({
            id: filename, // Use filename as ID for consistency
            name: workflow.name,
            description: workflow.description
          });
        }
      }
    }
    
    res.json({ workflows });
  } catch (error) {
    res.json({ workflows: [], error: error.message });
  }
});

// Get workflow details
app.get('/workflows/:id', async (req, res) => {
  const workflow = await loadWorkflow(req.params.id);
  if (workflow) {
    res.json(workflow);
  } else {
    res.status(404).json({ error: 'Workflow not found' });
  }
});

// Run workflow with options
app.post('/workflows/:id/run', async (req, res) => {
  try {
    const { options = {} } = req.body;
    
    if (!executor) {
      throw new Error('Not initialized. Call /connect first.');
    }
    
    const workflow = await loadWorkflow(req.params.id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${req.params.id}`);
    }
    
    // Run with options
    const result = await executor.run(workflow, options);
    
    res.json({
      success: true,
      result,
      state: executor.getState()
    });
  } catch (error) {
    console.error('Run error:', error);
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Execute single primitive (backward compatibility)
app.post('/execute', async (req, res) => {
  try {
    const { node, state } = req.body;
    
    if (!executor) {
      throw new Error('Not initialized. Call /connect first.');
    }
    
    // Initialize state if provided
    if (state) {
      Object.entries(state).forEach(([key, value]) => {
        executor.state.set(key, value);
      });
    }
    
    // Execute the node directly as a primitive
    const result = await executor.executePrimitive(node);
    
    res.json({ 
      success: true, 
      data: result, 
      state: executor.getState() 
    });
  } catch (error) {
    console.error('Execution error:', error);
    res.json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get current state
app.get('/state', (req, res) => {
  if (!executor) {
    res.json({ error: 'Not initialized' });
    return;
  }
  
  res.json({
    state: executor.getState(),
    history: executor.getHistory()
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`\n🎨 Simplified Frontend + Unified Backend`);
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log('\n✨ Features:');
  console.log('   - Clean, simplified UI');
  console.log('   - Run full workflows, phases, or individual nodes');
  console.log('   - Real-time logs and state visualization');
  console.log('   - Workflows loaded from definitions folder\n');
  
  // Try to connect on startup
  await initialize();
});