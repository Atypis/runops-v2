import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import UnifiedExecutor from '../executor/index.js';
// We'll load workflows dynamically

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve the original frontend
app.use(express.static(join(__dirname, '../../frontend')));

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
    
    // Create executor
    executor = new UnifiedExecutor({ stagehand, openai });
    
    console.log('✅ StageHand initialized!');
    return true;
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    return false;
  }
}

// Compatibility endpoints for the original frontend

app.get('/status', async (req, res) => {
  const connected = !!stagehand;
  const currentUrl = connected && stagehand.page ? stagehand.page.url() : null;
  res.json({ connected, currentUrl });
});

app.post('/connect', async (req, res) => {
  const success = await initialize();
  res.json({ success });
});

// Execute a node using the new architecture
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

// New endpoint to run workflows/phases/nodes
app.post('/run', async (req, res) => {
  try {
    const { workflow = 'gmail-airtable', options = {} } = req.body;
    
    if (!executor) {
      throw new Error('Not initialized. Call /connect first.');
    }
    
    // For now, just create a dummy workflow to test
    const workflowDef = {
      id: 'test',
      name: 'Test Workflow',
      flow: { type: 'sequence', items: [] }
    };
    
    // Run with options
    const result = await executor.run(workflowDef, options);
    
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
  console.log(`🌐 Unified Frontend Adapter running on http://localhost:${PORT}`);
  console.log('📂 Frontend available at http://localhost:3001');
  console.log('\n💡 This adapter makes the original frontend work with the new unified architecture');
  
  // Try to connect on startup
  await initialize();
});