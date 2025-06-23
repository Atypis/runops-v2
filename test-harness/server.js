import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { z } from 'zod';
import Primitives from './workflows/executor/primitives/index.js';
import StateManager from './workflows/executor/stateManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, 'frontend')));

let browser = null;
let stagehand = null;
let page = null;
let openai = null;
let workflowState = {};
let pages = {}; // Track StageHand pages by name
let currentPage = null; // Current active page
let primitives = null; // Primitives executor
let stateManager = null; // State manager

// Initialize connection
async function initialize() {
  try {
    console.log('🚀 Initializing StageHand...');
    
    // Let StageHand launch and manage its own browser
    stagehand = new Stagehand({
      env: 'LOCAL',
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      headless: false,  // Show the browser window
      verbose: 1,
      debugDom: true
    });
    
    // Initialize StageHand
    await stagehand.init();
    
    // Get the page from StageHand
    page = stagehand.page;
    currentPage = page;
    pages['main'] = page;
    
    // Also initialize OpenAI for cognition primitive
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Initialize state manager
    stateManager = new StateManager();
    
    // Initialize primitives executor with dependencies
    primitives = new Primitives({
      stagehand,
      openai,
      state: stateManager,
      pages,
      currentPage
    });
    
    console.log('✅ StageHand initialized! Current URL:', page.url());
    return true;
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    return false;
  }
}

// Execute a single node
async function executeNode(node, state = {}) {
  // Update legacy workflowState for backwards compatibility
  workflowState = { ...workflowState, ...state };
  
  // Update state manager
  Object.entries(state).forEach(([key, value]) => {
    stateManager.set(key, value);
  });
  
  // Update primitives with current page context
  primitives.currentPage = currentPage;
  primitives.pages = pages;
  
  // Use primitives executor
  return await primitives.execute(node, state);
}

// All primitive implementations are now handled by the Primitives class

// Helper functions - maintain for backwards compatibility
function resolveVariable(value) {
  return stateManager.resolveVariable(value);
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setStateValue(path, value) {
  const key = path.replace('state.', '');
  stateManager.set(key, value);
  // Also update legacy workflowState
  workflowState[key] = value;
}

// API Routes
app.get('/status', async (req, res) => {
  const connected = !!stagehand;
  const currentUrl = connected && stagehand.page ? stagehand.page.url() : null;
  res.json({ connected, currentUrl });
});

app.post('/execute', async (req, res) => {
  try {
    const { node, state } = req.body;
    const result = await executeNode(node, state);
    res.json({ success: true, data: result, state: workflowState });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.post('/connect', async (req, res) => {
  const success = await initialize();
  res.json({ success });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, async () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
  console.log('📂 Frontend available at http://localhost:3001');
  
  // Try to connect on startup
  await initialize();
});