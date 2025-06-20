import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { z } from 'zod';

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
    
    case 'wait':
      return await executeWait(node);
    
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
  console.log(`🌐 Browser action: ${method} on ${target || 'current page'}`);
  
  // Log current state for debugging
  if (currentPage) {
    console.log(`   Current tab URL: ${currentPage.url()}`);
  }
  
  switch (method) {
    case 'goto':
      console.log(`   Navigating to: ${target}`);
      try {
        await currentPage.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
        // Try networkidle but don't fail if it times out
        try {
          await currentPage.waitForLoadState('networkidle', { timeout: 10000 });
        } catch (e) {
          console.log('   Note: networkidle timeout, but page loaded');
        }
      } catch (error) {
        console.error(`   ❌ Navigation failed: ${error.message}`);
        throw error;
      }
      console.log(`   ✓ Navigation complete: ${currentPage.url()}`);
      return { success: true, url: currentPage.url() };
    
    case 'click':
      console.log(`   Click target: "${target}"`);
      // Use StageHand's AI-powered click on any page
      await currentPage.act(`click on ${target}`);
      return { success: true, action: 'clicked' };
    
    case 'type':
      const text = resolveVariable(data) || data;
      console.log(`   Type data: "${data}" resolved to: "${text}"`);
      // Use StageHand's AI-powered type on any page
      await currentPage.act(`type "${text}" into ${target}`);
      return { success: true, typed: text };
    
    case 'openNewTab':
      // Create new page using StageHand's context - it will have AI capabilities!
      const newPage = await stagehand.context.newPage();
      
      // Store the new page with a name
      const tabName = data?.name || `tab_${Date.now()}`;
      pages[tabName] = newPage;
      currentPage = newPage; // This becomes the active page
      console.log(`   ✓ New tab opened: ${tabName}`);
      
      // Navigate if URL provided
      if (target) {
        await newPage.goto(target);
        await newPage.waitForLoadState('networkidle');
      }
      
      return { success: true, tabName, url: newPage.url() };
    
    case 'switchTab':
      const targetTab = target || 'main';
      if (!pages[targetTab]) {
        console.error(`   ❌ Available tabs: ${Object.keys(pages).join(', ')}`);
        throw new Error(`Tab '${targetTab}' not found`);
      }
      currentPage = pages[targetTab];
      // Bring the tab to front for visibility
      await currentPage.bringToFront();
      console.log(`   ✓ Switched to tab: ${targetTab} (${currentPage.url()})`);
      return { success: true, currentTab: targetTab, url: currentPage.url() };
    
    default:
      throw new Error(`Unknown browser action: ${method}`);
  }
}

async function executeBrowserQuery({ method, instruction, schema }) {
  switch (method) {
    case 'extract':
      // Convert schema to Zod if it's provided
      let zodSchema = null;
      
      if (schema) {
        if (typeof schema === 'string') {
          // If schema is a string like "z.object({...})", evaluate it
          try {
            zodSchema = eval(schema);
          } catch (e) {
            console.error('Failed to parse Zod schema string:', e);
            // Fall back to converting JSON schema to Zod
            zodSchema = convertJsonSchemaToZod(schema);
          }
        } else if (typeof schema === 'object') {
          // Convert JSON schema to Zod schema
          zodSchema = convertJsonSchemaToZod(schema);
        }
      }
      
      // Use StageHand's AI extraction on the current page - works on ALL pages!
      const result = await currentPage.extract({ 
        instruction, 
        schema: zodSchema 
      });
      
      // Store the result in state - automatically store all extracted properties
      if (result && typeof result === 'object') {
        Object.entries(result).forEach(([key, value]) => {
          workflowState[key] = value;
        });
      }
      // Also store the full result
      workflowState.lastExtract = result;
      return result;
    
    case 'observe':
      // Use StageHand's AI observation on the current page
      const observations = await currentPage.observe({ instruction });
      workflowState.lastObserve = observations;
      return observations;
    
    default:
      throw new Error(`Unknown query method: ${method}`);
  }
}

function executeTransform({ input, function: fn, output }) {
  // Handle both single input and array of inputs
  let inputData;
  if (Array.isArray(input)) {
    inputData = input.map(i => resolveVariable(i));
  } else {
    inputData = resolveVariable(input);
  }
  
  // Safe evaluation for demo - use proper sandboxing in production!
  let result;
  try {
    const transformFn = eval(`(${fn})`);
    result = Array.isArray(inputData) ? transformFn(...inputData) : transformFn(inputData);
  } catch (error) {
    console.error('Transform execution error:', error);
    console.error('Input data:', inputData);
    console.error('Function:', fn);
    throw new Error(`Transform failed: ${error.message}`);
  }
  
  if (output) {
    setStateValue(output, result);
  }
  
  return result;
}

async function executeCognition({ prompt, input, output, model = 'gpt-4o-mini', schema }) {
  const inputData = resolveVariable(input);
  
  // Enhanced system prompt to ensure clean JSON output
  const systemPrompt = `You are a data processing assistant. You MUST return ONLY valid JSON without any markdown formatting, code blocks, or explanations. 
Do not wrap the response in \`\`\`json\`\`\` tags.
Do not include any text before or after the JSON.
The response must be parseable by JSON.parse().

Examples of correct responses:
{"summary": "Investor interested in Series A, requesting runway details."}
{"stage": "In Diligence"}
[true, false, true, false]
{"investorName": "John Smith", "company": "Accel Partners"}`;
  
  const response = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${prompt}\n\nInput: ${JSON.stringify(inputData)}` }
    ],
    temperature: 0.3  // Lower temperature for more consistent JSON output
  });
  
  let content = response.choices[0].message.content;
  console.log('Raw cognition response:', content);
  
  // Clean up common formatting issues
  // Remove markdown code blocks if present
  content = content.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  content = content.replace(/^```\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  // Remove any leading/trailing whitespace and newlines
  content = content.trim();
  
  // Try to parse the cleaned content
  let result;
  try {
    result = JSON.parse(content);
  } catch (parseError) {
    console.error('Failed to parse cognition response:', content);
    // Try to extract JSON from the response if it's embedded in text
    const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[0]);
        console.log('Successfully extracted JSON from response');
      } catch (e) {
        throw new Error(`Invalid JSON response from cognition: ${parseError.message}`);
      }
    } else {
      throw new Error(`Invalid JSON response from cognition: ${parseError.message}`);
    }
  }
  
  if (output) {
    setStateValue(output, result);
  }
  
  return result;
}

function executeMemory({ operation, data }) {
  switch (operation) {
    case 'set':
      Object.entries(data).forEach(([key, value]) => {
        // Resolve value if it's a state reference
        const resolvedValue = resolveVariable(value);
        workflowState[key] = resolvedValue;
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

async function executeWait({ duration = 1000, reason }) {
  console.log(`⏳ Waiting ${duration}ms${reason ? `: ${reason}` : ''}`);
  await new Promise(resolve => setTimeout(resolve, duration));
  return { waited: duration };
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
function convertJsonSchemaToZod(jsonSchema) {
  // Helper to convert a single JSON schema type to Zod
  const convertType = (schema) => {
    if (!schema || typeof schema !== 'object') {
      return z.any();
    }
    
    switch (schema.type) {
      case 'string':
        return z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array':
        if (schema.items) {
          return z.array(convertType(schema.items));
        }
        return z.array(z.any());
      case 'object':
        if (schema.properties) {
          const shape = {};
          for (const [key, value] of Object.entries(schema.properties)) {
            shape[key] = convertType(value);
          }
          return z.object(shape);
        }
        return z.object({});
      default:
        return z.any();
    }
  };
  
  // Start conversion from the root
  if (typeof jsonSchema === 'object' && !jsonSchema.type) {
    // If the root doesn't have a type, assume it's the properties directly
    const shape = {};
    for (const [key, value] of Object.entries(jsonSchema)) {
      shape[key] = convertType(value);
    }
    return z.object(shape);
  }
  
  return convertType(jsonSchema);
}

function resolveVariable(value) {
  if (typeof value !== 'string') return value;
  
  // Handle template variables like {{currentEmail.subject}} or {{state.currentEmail.subject}}
  if (value.includes('{{') && value.includes('}}')) {
    return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      // If path starts with state., remove it
      const cleanPath = trimmedPath.startsWith('state.') ? trimmedPath.replace('state.', '') : trimmedPath;
      const result = getNestedValue(workflowState, cleanPath);
      console.log(`   Resolved {{${trimmedPath}}} to:`, result);
      return result !== undefined ? result : '';
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