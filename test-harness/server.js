import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
    
    // Also initialize OpenAI for cognition primitive
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    console.log('✅ StageHand initialized! Current URL:', page.url());
    return true;
  } catch (error) {
    console.error('❌ Initialization failed:', error);
    return false;
  }
}

// Execute a single node
async function executeNode(node, state = {}) {
  workflowState = { ...workflowState, ...state };
  
  switch (node.type) {
    case 'browser_action':
      return await executeBrowserAction(node);
    
    case 'browser_query':
      return await executeBrowserQuery(node);
    
    case 'transform':
      return executeTransform(node);
    
    case 'cognition':
      return await executeCognition(node);
    
    case 'memory':
      return executeMemory(node);
    
    case 'sequence':
      return await executeSequence(node);
    
    case 'iterate':
      return await executeIterate(node);
    
    case 'route':
      return await executeRoute(node);
    
    case 'handle':
      return await executeHandle(node);
    
    default:
      throw new Error(`Unknown node type: ${node.type}`);
  }
}

async function executeBrowserAction({ method, target, data }) {
  switch (method) {
    case 'goto':
      await page.goto(target);
      await page.waitForLoadState('networkidle');
      return { success: true, url: page.url() };
    
    case 'click':
      await page.act(`click on ${target}`);
      return { success: true, action: 'clicked' };
    
    case 'type':
      const text = resolveVariable(data) || data;
      await page.act(`type "${text}" into ${target}`);
      return { success: true, typed: text };
    
    default:
      throw new Error(`Unknown browser action: ${method}`);
  }
}

async function executeBrowserQuery({ method, instruction, schema }) {
  switch (method) {
    case 'extract':
      const result = await page.extract({ instruction, schema });
      // Store the result in state - check what was extracted
      if (result.emails) {
        workflowState.emails = result.emails;
      } else if (result.accountChooser !== undefined) {
        workflowState.accountChooser = result.accountChooser;
      } else if (result.hasRecords !== undefined) {
        workflowState.hasRecords = result.hasRecords;
      }
      // Also store the full result
      workflowState.lastExtract = result;
      return result;
    
    case 'observe':
      const observations = await page.observe({ instruction });
      workflowState.lastObserve = observations;
      return observations;
    
    default:
      throw new Error(`Unknown query method: ${method}`);
  }
}

function executeTransform({ input, function: fn, output }) {
  const inputData = resolveVariable(input);
  // Safe evaluation for demo - use proper sandboxing in production!
  const transformFn = eval(`(${fn})`);
  const result = transformFn(inputData);
  
  if (output) {
    setStateValue(output, result);
  }
  
  return result;
}

async function executeCognition({ prompt, input, output, model = 'gpt-4o-mini' }) {
  const inputData = resolveVariable(input);
  
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: 'You are a data processing assistant. Return only JSON.' },
      { role: 'user', content: `${prompt}\n\nInput: ${JSON.stringify(inputData)}` }
    ],
    temperature: 1
  });
  
  const result = JSON.parse(response.choices[0].message.content);
  
  if (output) {
    setStateValue(output, result);
  }
  
  return result;
}

function executeMemory({ operation, data }) {
  switch (operation) {
    case 'set':
      Object.entries(data).forEach(([key, value]) => {
        workflowState[key] = value;
      });
      return { updated: Object.keys(data) };
    
    case 'get':
      return data.map(key => workflowState[key]);
    
    case 'clear':
      workflowState = {};
      return { cleared: true };
    
    default:
      throw new Error(`Unknown memory operation: ${operation}`);
  }
}

// Control flow primitives
async function executeSequence({ nodes, name }) {
  console.log(`📋 Executing sequence: ${name || 'unnamed'}`);
  const results = [];
  for (const node of nodes) {
    try {
      const result = await executeNode(node);
      results.push(result);
      // Store last result in state for next node
      workflowState.lastResult = result;
    } catch (error) {
      console.error(`Error in sequence at node ${results.length}:`, error);
      throw error;
    }
  }
  return results;
}

async function executeIterate({ over, as, body }) {
  console.log(`🔁 Iterating over ${over}`);
  const items = resolveVariable(over) || [];
  const results = [];
  
  for (let i = 0; i < items.length; i++) {
    console.log(`  → Processing item ${i + 1}/${items.length}`);
    // Set iteration variables
    workflowState[as] = items[i];
    workflowState[`${as}Index`] = i;
    
    try {
      const result = await executeNode(body);
      results.push(result);
    } catch (error) {
      console.error(`Error in iteration ${i}:`, error);
      // Continue on error for now
    }
  }
  return results;
}

async function executeRoute({ value, paths }) {
  const checkValue = String(resolveVariable(value));
  console.log(`🚦 Routing based on ${value} = ${checkValue}`);
  
  const selectedPath = paths[checkValue] || paths['false'] || paths.default;
  if (!selectedPath) {
    throw new Error(`No route found for value: ${checkValue}`);
  }
  
  return await executeNode(selectedPath);
}

async function executeHandle({ try: tryNode, catch: catchNode, finally: finallyNode }) {
  console.log(`🛡️ Executing with error handling`);
  try {
    return await executeNode(tryNode);
  } catch (error) {
    console.error('Caught error:', error);
    if (catchNode) {
      return await executeNode(catchNode);
    }
    throw error;
  } finally {
    if (finallyNode) {
      await executeNode(finallyNode);
    }
  }
}

// Helper functions
function resolveVariable(value) {
  if (typeof value !== 'string') return value;
  
  // Handle template variables like {{currentEmail.subject}}
  if (value.includes('{{') && value.includes('}}')) {
    return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      return getNestedValue(workflowState, path.trim());
    });
  }
  
  // Handle state references
  if (value.startsWith('state.')) {
    const path = value.replace('state.', '');
    return getNestedValue(workflowState, path);
  }
  
  return value;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setStateValue(path, value) {
  const key = path.replace('state.', '');
  workflowState[key] = value;
}

// API Routes
app.get('/status', async (req, res) => {
  const connected = !!page;
  const currentUrl = connected ? page.url() : null;
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