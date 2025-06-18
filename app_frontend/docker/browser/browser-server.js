#!/usr/bin/env node

/**
 * AEF Browser Server
 * 
 * Runs inside Docker container to manage Stagehand browser automation
 * Communicates with host via HTTP API for action execution
 */

const express = require('express');
const { Stagehand } = require('@browserbasehq/stagehand');
const { z } = require('zod');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const app = express();
app.use(express.json({ limit: '10mb' }));

// ============================================================================
// ACCESSIBILITY TREE FUNCTIONS (copied from Stagehand v2.3.0 for LLM parity)
// ============================================================================

/**
 * Clean text by removing extra whitespace and newlines
 */
function cleanText(input) {
  return input.replace(/\s+/g, ' ').trim();
}

/**
 * Format accessibility tree into simplified string format (exact LLM view)
 */
function formatSimplifiedTree(node, level = 0) {
  const indent = "  ".repeat(level);
  const cleanName = node.name ? cleanText(node.name) : "";
  let result = `${indent}[${node.nodeId}] ${node.role}${
    cleanName ? `: ${cleanName}` : ""
  }\n`;

  if (node.children?.length) {
    result += node.children
      .map((child) => formatSimplifiedTree(child, level + 1))
      .join("");
  }
  return result;
}

/**
 * Remove redundant static text children
 */
function removeRedundantStaticTextChildren(parent, children) {
  if (!children || children.length <= 1) return children;
  
  return children.filter((child, index) => {
    if (child.role !== 'StaticText') return true;
    
    // Keep if it's the only static text
    const otherStaticTexts = children.filter(c => c.role === 'StaticText');
    if (otherStaticTexts.length === 1) return true;
    
    // Remove if it's redundant with parent name
    if (parent.name && child.name && parent.name.includes(child.name)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Clean structural nodes (generic/none roles)
 */
async function cleanStructuralNodes(node, tagNameMap) {
  // Filter out nodes with negative IDs
  if (node.nodeId && parseInt(node.nodeId) < 0) {
    return null;
  }

  // Base case: if no children, remove generic/none nodes
  if (!node.children || node.children.length === 0) {
    return node.role === "generic" || node.role === "none" ? null : node;
  }

  // Recursively clean children
  const cleanedChildrenPromises = node.children.map((child) =>
    cleanStructuralNodes(child, tagNameMap)
  );
  const resolvedChildren = await Promise.all(cleanedChildrenPromises);
  let cleanedChildren = resolvedChildren.filter(child => child !== null);

  // Handle structural nodes
  if (node.role === "generic" || node.role === "none") {
    if (cleanedChildren.length === 1) {
      return cleanedChildren[0]; // Collapse single-child structural node
    } else if (cleanedChildren.length === 0) {
      return null; // Remove empty structural node
    }
    // Update role with DOM tag name if available
    if (node.backendDOMNodeId !== undefined) {
      const tagName = tagNameMap[node.backendDOMNodeId];
      if (tagName) node.role = tagName;
    }
  }

  // Remove redundant static text children
  cleanedChildren = removeRedundantStaticTextChildren(node, cleanedChildren);

  if (cleanedChildren.length === 0) {
    return node.role === "generic" || node.role === "none" ? null : { ...node, children: [] };
  }

  return cleanedChildren.length > 0 ? { ...node, children: cleanedChildren } : node;
}

/**
 * Build hierarchical tree from flat accessibility nodes
 */
async function buildHierarchicalTree(nodes, tagNameMap) {
  const nodeMap = new Map();

  // First pass: Create meaningful nodes
  nodes.forEach((node) => {
    const nodeIdValue = parseInt(node.nodeId, 10);
    if (nodeIdValue < 0) return;

    const hasChildren = node.childIds && node.childIds.length > 0;
    const hasValidName = node.name && node.name.trim() !== "";
    const isInteractive = node.role !== "none" && 
                         node.role !== "generic" && 
                         node.role !== "InlineTextBox";

    if (!hasValidName && !hasChildren && !isInteractive) return;

    const cleanNode = {
      role: node.role,
      nodeId: node.nodeId,
      ...(hasValidName && { name: node.name }),
      ...(node.description && { description: node.description }),
      ...(node.value && { value: node.value }),
      ...(node.backendDOMNodeId !== undefined && { backendDOMNodeId: node.backendDOMNodeId }),
      children: [],
      parentId: node.parentId,
      childIds: node.childIds || []
    };

    nodeMap.set(node.nodeId, cleanNode);
  });

  // Second pass: Build parent-child relationships
  for (const [nodeId, node] of nodeMap) {
    if (node.childIds) {
      for (const childId of node.childIds) {
        const child = nodeMap.get(childId);
        if (child) {
          node.children.push(child);
        }
      }
    }
  }

  // Get root nodes and clean them
  const rootNodes = nodes
    .filter((node) => !node.parentId && nodeMap.has(node.nodeId))
    .map((node) => nodeMap.get(node.nodeId))
    .filter(Boolean);

  const cleanedTreePromises = rootNodes.map((node) =>
    cleanStructuralNodes(node, tagNameMap)
  );
  const finalTree = (await Promise.all(cleanedTreePromises)).filter(Boolean);

  // Generate simplified string representation
  const simplifiedFormat = finalTree
    .map((node) => formatSimplifiedTree(node))
    .join("\n");

  return {
    tree: finalTree,
    simplified: simplifiedFormat,
    iframes: [],
    idToUrl: {},
    xpathMap: {}
  };
}

/**
 * Get accessibility tree using standard Playwright page (compatible with Stagehand)
 */
async function getAccessibilityTreeLocal(page) {
  try {
    // Get CDP session and enable accessibility
    const cdpSession = await page.context().newCDPSession(page);
    await cdpSession.send("Accessibility.enable");

    try {
      // Get full accessibility tree
      const { nodes: fullNodes } = await cdpSession.send("Accessibility.getFullAXTree");

      // Transform nodes to our format
      const transformedNodes = fullNodes.map((node) => ({
        role: node.role?.value || "",
        name: node.name?.value,
        description: node.description?.value,
        value: node.value?.value,
        nodeId: node.nodeId,
        backendDOMNodeId: node.backendDOMNodeId,
        parentId: node.parentId,
        childIds: node.childIds || [],
        properties: node.properties,
      }));

      // Build hierarchical tree (simplified - no tag name mapping for now)
      const hierarchicalTree = await buildHierarchicalTree(transformedNodes, {});

      return hierarchicalTree;
    } finally {
      await cdpSession.send("Accessibility.disable");
      await cdpSession.detach();
    }
  } catch (error) {
    console.error('Error in getAccessibilityTreeLocal:', error);
    throw error;
  }
}

// ============================================================================
// END ACCESSIBILITY TREE FUNCTIONS
// ============================================================================

let stagehand = null;
let isInitialized = false;
let lastActivity = Date.now();

// In-memory log storage for debugging
const nodeLogs = new Map(); // nodeId -> logs[]

// LLM conversation capture for memory system
const llmTraces = new Map(); // nodeId -> llmConversations[]

// Store current LLM model name for visibility across routes
let currentModelName = null;

function addLLMTrace(nodeId, role, content, metadata = {}) {
  if (!llmTraces.has(nodeId)) {
    llmTraces.set(nodeId, []);
  }
  llmTraces.get(nodeId).push({
    role,
    content,
    timestamp: new Date().toISOString(),
    tokens: content.length, // Rough estimate
    metadata
  });
  
  // Keep only last 20 interactions per node to prevent memory bloat
  const traces = llmTraces.get(nodeId);
  if (traces.length > 20) {
    traces.splice(0, traces.length - 20);
  }
}

function getLLMTrace(nodeId) {
  return llmTraces.get(nodeId) || [];
}

function clearLLMTrace(nodeId) {
  llmTraces.delete(nodeId);
}

function addNodeLog(nodeId, logEntry) {
  if (!nodeLogs.has(nodeId)) {
    nodeLogs.set(nodeId, []);
  }
  nodeLogs.get(nodeId).push({
    ...logEntry,
    timestamp: new Date().toISOString()
  });
  
  // Keep only last 50 logs per node to prevent memory issues
  const logs = nodeLogs.get(nodeId);
  if (logs.length > 50) {
    logs.splice(0, logs.length - 50);
  }
}

// Health endpoint
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    browser: {
    initialized: isInitialized,
      model: currentModelName || 'not_configured',
      apiKey: process.env.OPENAI_API_KEY ? 'configured' : 'missing'
    },
    uptime: process.uptime()
  };
  
  console.log(`[Browser Server] Health check - Model: ${healthInfo.browser.model}, API Key: ${healthInfo.browser.apiKey}`);
  res.json(healthInfo);
});

// Wait for X server to be ready
async function waitForXServer() {
  const maxWait = 30000; // 30 seconds
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    try {
      // Check if DISPLAY is accessible
      const { execSync } = require('child_process');
              execSync('xdpyinfo -display :1', { stdio: 'ignore' });
      console.log('[Browser Server] X server is ready');
      return true;
    } catch (error) {
      console.log('[Browser Server] Waiting for X server...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error('X server not ready after 30 seconds');
}

// Find the correct Chromium executable
function findChromiumExecutable() {
  // First, try to find Playwright Chromium dynamically
  const playwrightCacheDir = '/home/aefuser/.cache/ms-playwright';
  
  try {
    if (fs.existsSync(playwrightCacheDir)) {
      const entries = fs.readdirSync(playwrightCacheDir);
      const chromiumDirs = entries.filter(entry => entry.startsWith('chromium-'));
      
      for (const chromiumDir of chromiumDirs) {
        const chromePath = path.join(playwrightCacheDir, chromiumDir, 'chrome-linux', 'chrome');
        if (fs.existsSync(chromePath)) {
          console.log(`[Browser Server] Found Playwright Chromium at: ${chromePath}`);
          return chromePath;
        }
      }
    }
  } catch (error) {
    console.log(`[Browser Server] Error searching for Playwright Chromium: ${error.message}`);
  }
  
  // Fallback to hardcoded paths
  const possiblePaths = [
    // System Chromium fallback
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  
  for (const execPath of possiblePaths) {
    if (fs.existsSync(execPath)) {
      console.log(`[Browser Server] Found system Chromium at: ${execPath}`);
      return execPath;
    }
  }
  
  throw new Error('No suitable Chromium executable found');
}

// Initialize Stagehand
app.post('/init', async (req, res) => {
  try {
    // PREVENT DOUBLE INITIALIZATION
    if (isInitialized && stagehand) {
      console.log('[Browser Server] Already initialized, returning existing instance');
      return res.json({
        success: true,
        message: 'Stagehand already initialized',
        url: stagehand.page.url()
      });
    }
    
    console.log('[Browser Server] Initializing Stagehand...');
    
    // Wait for X server to be ready
    await waitForXServer();
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable not set');
    }
    
    // Find the correct browser executable
    const executablePath = findChromiumExecutable();
    
    // 🔥 FORCE FRESH SESSION: Create unique temporary userDataDir for this session
    const sessionId = crypto.randomBytes(8).toString('hex');
    const freshUserDataDir = path.join(os.tmpdir(), `aef-browser-session-${sessionId}`);
    
    console.log(`[Browser Server] 🔥 Creating FRESH session with userDataDir: ${freshUserDataDir}`);
    
    // Configuration using available Chromium
    const config = {
      // Use OpenAI O3 model for Stagehand browser automation
      modelName: 'o3',
      modelClientOptions: {
        apiKey: process.env.OPENAI_API_KEY,
      },
      env: 'LOCAL',
      headless: false,
      verbose: 1,
      browserLaunchOptions: {
        executablePath: executablePath,
        headless: false,
        // 🔥 FORCE FRESH SESSION: Set explicit unique userDataDir to prevent ANY state persistence
        userDataDir: freshUserDataDir,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--display=:1',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--window-size=1280,720',
          '--window-position=0,0',
          '--disable-background-mode',
          '--force-device-scale-factor=1',
          '--incognito',
          '--disable-session-crashed-bubble',
          '--disable-restore-session-state',
          '--disable-background-networking',
          '--disable-sync',
          '--disable-translate',
          '--disable-ipc-flooding-protection'
        ],
        viewport: { width: 1280, height: 720 },
        env: {
          DISPLAY: ':1'
        }
      }
    };
    
    // Persist model name for later logging
    currentModelName = config.modelName;
    console.log(`[Browser Server] 🧠 LLM model configured: ${currentModelName}`);
    
    // Create new Stagehand instance
    console.log('[Browser Server] Creating Stagehand instance...');
    stagehand = new Stagehand(config);
    
    console.log('[Browser Server] Initializing Stagehand...');
    await stagehand.init();
    
    // Ensure the browser page uses the full VNC resolution
    console.log('[Browser Server] Setting page viewport to full VNC resolution...');
          await stagehand.page.setViewportSize({ width: 1280, height: 720 });
    
    console.log('[Browser Server] Stagehand initialized, navigating to welcome page...');
    
    // Navigate to a welcome page
    await stagehand.page.goto('data:text/html,<html><head><title>AEF Browser Automation</title><style>body{font-family:system-ui;margin:0;padding:40px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-align:center;min-height:100vh;display:flex;flex-direction:column;justify-content:center;}h1{font-size:3em;margin:0;text-shadow:2px 2px 4px rgba(0,0,0,0.3);}p{font-size:1.2em;margin:20px 0;opacity:0.9;}</style></head><body><h1>🤖 AEF Browser Ready</h1><p>This browser is controlled by AI automation</p><p>Navigate to any website to begin automation workflows</p><div style="margin-top:40px;"><button onclick="window.location.href=\'https://example.com\'" style="background:rgba(255,255,255,0.2);border:2px solid white;color:white;padding:12px 24px;border-radius:8px;font-size:16px;cursor:pointer;">Visit Example.com</button> <button onclick="window.location.href=\'https://google.com\'" style="background:rgba(255,255,255,0.2);border:2px solid white;color:white;padding:12px 24px;border-radius:8px;font-size:16px;cursor:pointer;">Go to Google</button></div></body></html>');
    
    isInitialized = true;
    lastActivity = Date.now();
    
    console.log('[Browser Server] Stagehand initialized successfully with welcome page');
    
    res.json({
      success: true,
      message: 'Stagehand initialized with browser window',
      url: stagehand.page.url()
    });
    
  } catch (error) {
    console.error('[Browser Server] Failed to initialize:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute browser action
app.post('/action', async (req, res) => {
  try {
    if (!isInitialized || !stagehand) {
      return res.status(400).json({
        success: false,
        error: 'Browser not initialized'
      });
    }
    
    const { type, data } = req.body;
    // FIXED: Use the correct nodeId from the data
    const nodeId = data.nodeId || data.stepId || 'unknown';
    lastActivity = Date.now();
    
    console.log(`[Browser Server] Executing action: ${type} for node: ${nodeId} (Model: ${currentModelName})`);
    
    // Log the action start
    addNodeLog(nodeId, {
      type: 'action',
      title: `Executing ${type}`,
      content: `Starting ${type} action with data:\n${JSON.stringify(data, null, 2)}`,
      metadata: {
        actionType: type,
        url: stagehand.page.url(),
        actionIndex: data.actionIndex
      }
    });
    
    let result;
    const startTime = Date.now();
    
    switch (type) {
      case 'navigate':
        await stagehand.page.goto(data.url);
        result = { url: data.url };
        break;
        
      case 'click':
        if (data.selector) {
          await stagehand.page.click(data.selector);
        } else if (data.instruction) {
          await stagehand.page.act(data.instruction);
        }
        result = { action: 'click', target: data.selector || data.instruction };
        break;
        
      case 'type':
        if (data.selector && data.text) {
          await stagehand.page.fill(data.selector, data.text);
        }
        result = { action: 'type', text: data.text };
        break;

      case 'wait':
        if (data.selector) {
          await stagehand.page.waitForSelector(data.selector, { 
            timeout: data.timeout || 5000 
          });
        }
        result = { action: 'wait', selector: data.selector, timeout: data.timeout };
        break;

      case 'wait_for_navigation':
        if (data.url_contains) {
          // Wait for URL to contain specific text
          await stagehand.page.waitForFunction(
            (urlFragment) => window.location.href.includes(urlFragment), 
            data.url_contains,
            { timeout: data.timeout || 10000 }
          );
        }
        result = { action: 'wait_for_navigation', url_contains: data.url_contains };
        break;
        
      case 'act':
        // === LLM TRACE CAPTURE FOR ACT ===
        // Capture the instruction/prompt being sent
        const actPrompt = `Act instruction: "${data.instruction}"\n\nPage context: ${stagehand.page.url()}\n\nDOM context: Available for element selection and interaction`;
        addLLMTrace(nodeId, 'user', actPrompt, {
          actionType: 'act',
          instruction: data.instruction,
          url: stagehand.page.url()
        });
        
        // Log the prompt being sent to LLM
        addNodeLog(nodeId, {
          type: 'prompt',
          title: 'LLM Prompt for Act',
          content: `Instruction: ${data.instruction}\n\nContext: Performing browser action on page: ${stagehand.page.url()}`,
          metadata: {
            actionType: 'act',
            url: stagehand.page.url()
          }
        });
        
        result = await stagehand.page.act(data.instruction);
        
        // === LLM TRACE CAPTURE FOR ACT RESPONSE ===
        // Capture the LLM's response/decision
        const actResponse = `Act execution completed. Result: ${JSON.stringify(result, null, 2)}`;
        addLLMTrace(nodeId, 'assistant', actResponse, {
          actionType: 'act',
          success: true,
          duration: Date.now() - startTime
        });
        
        // Log the result
        addNodeLog(nodeId, {
          type: 'success',
          title: 'Act Action Completed',
          content: `Successfully executed act instruction: "${data.instruction}"\n\nResult: ${JSON.stringify(result, null, 2)}`,
          metadata: {
            actionType: 'act',
            duration: Date.now() - startTime
          }
        });
        break;
        
      case 'extract':
        // === LLM TRACE CAPTURE FOR EXTRACT ===
        const extractPrompt = `Extract instruction: "${data.instruction}"\n\nSchema requirements: ${JSON.stringify(data.schema, null, 2)}\n\nPage context: ${stagehand.page.url()}\n\nDOM context: Available for data extraction`;
        addLLMTrace(nodeId, 'user', extractPrompt, {
          actionType: 'extract',
          instruction: data.instruction,
          schema: data.schema,
          url: stagehand.page.url()
        });
        
        // Log the extraction prompt
        addNodeLog(nodeId, {
          type: 'prompt',
          title: 'LLM Prompt for Extract',
          content: `Instruction: ${data.instruction}\\n\\nSchema: ${JSON.stringify(data.schema, null, 2)}\\n\\nContext: Extracting data from page: ${stagehand.page.url()}`,
          metadata: {
            actionType: 'extract',
            url: stagehand.page.url()
          }
        });
        
        // Convert simple schema definition to Zod schema
        function createZodSchema(schemaDefinition) {
          if (!schemaDefinition || typeof schemaDefinition !== 'object') {
            return z.object({ result: z.string() }); // fallback
          }
          
          const zodProps = {};
          
          for (const [key, value] of Object.entries(schemaDefinition)) {
            if (typeof value === 'string') {
              // Simple type definitions
              switch (value) {
                case 'string':
                  zodProps[key] = z.string();
                  break;
                case 'number':
                  zodProps[key] = z.number();
                  break;
                case 'boolean':
                  zodProps[key] = z.boolean();
                  break;
                default:
                  zodProps[key] = z.string(); // fallback
              }
            } else if (typeof value === 'object' && value !== null) {
              if (value.type === 'array') {
                // Handle array types
                if (value.items && typeof value.items === 'object') {
                  const itemSchema = createZodSchema(value.items);
                  zodProps[key] = z.array(itemSchema);
                } else {
                  zodProps[key] = z.array(z.string()); // fallback
                }
              } else if (value.type === 'string' && value.optional) {
                // Handle optional strings
                zodProps[key] = z.string().optional();
              } else if (value.type === 'number' && value.optional) {
                // Handle optional numbers
                zodProps[key] = z.number().optional();
              } else {
                // Handle nested objects
                const nestedSchema = createZodSchema(value);
                zodProps[key] = nestedSchema;
              }
            } else {
              zodProps[key] = z.string(); // fallback
            }
          }
          
          return z.object(zodProps);
        }
        
        // Create proper Zod schema from simple definition
        const zodSchema = createZodSchema(data.schema);
        
        try {
          result = await stagehand.page.extract({
            instruction: data.instruction,
            schema: zodSchema
          });
          
          // === LLM TRACE CAPTURE FOR EXTRACT RESPONSE ===
          const extractResponse = `Extract completed successfully. Extracted data: ${JSON.stringify(result, null, 2)}`;
          addLLMTrace(nodeId, 'assistant', extractResponse, {
            actionType: 'extract',
            success: true,
            duration: Date.now() - startTime,
            extractedFields: Object.keys(result || {})
          });
          
        } catch (extractError) {
          console.error('Extract action failed:', extractError);
          result = { error: extractError.message };
          
          // === LLM TRACE CAPTURE FOR EXTRACT ERROR ===
          const extractErrorResponse = `Extract failed: ${extractError.message}`;
          addLLMTrace(nodeId, 'assistant', extractErrorResponse, {
            actionType: 'extract',
            success: false,
            error: extractError.message,
            duration: Date.now() - startTime
          });
        }
        break;
        
      case 'screenshot':
        const screenshot = await stagehand.page.screenshot({ 
          fullPage: false 
        });
        result = screenshot.toString('base64');
        break;

      case 'dom_snapshot':
        // Return the full HTML content of the current page (no LLM usage)
        result = await stagehand.page.content();
        break;

      case 'accessibility_tree':
        // Return the simplified accessibility tree (exact string LLM sees)
        try {
          const treeResult = await getAccessibilityTreeLocal(stagehand.page);
          result = treeResult.simplified || "";
        } catch (error) {
          console.error('Failed to get accessibility tree:', error);
          result = `Error getting accessibility tree: ${error.message}`;
        }
        break;

      case 'observe':
        // === LLM TRACE CAPTURE FOR OBSERVE ===
        const observePrompt = `Observe instruction: "${data.instruction}"\n\nMax actions: ${data.maxActions || 1}\n\nPage context: ${stagehand.page.url()}\n\nDOM context: Available for analysis and action discovery`;
        addLLMTrace(nodeId, 'user', observePrompt, {
          actionType: 'observe',
          instruction: data.instruction,
          maxActions: data.maxActions || 1,
          url: stagehand.page.url()
        });
        
        // Log the observation prompt
        addNodeLog(nodeId, {
          type: 'prompt',
          title: 'LLM Prompt for Observe',
          content: `Instruction: ${data.instruction}\n\nMax Actions: ${data.maxActions || 1}\n\nContext: Observing page: ${stagehand.page.url()}`,
          metadata: {
            actionType: 'observe',
            url: stagehand.page.url()
          }
        });
        
        result = await stagehand.page.observe({
          instruction: data.instruction,
          maxActions: data.maxActions || 1
        });
        
        // === LLM TRACE CAPTURE FOR OBSERVE RESPONSE ===
        const observeResponse = `Observe completed. Discovered actions: ${JSON.stringify(result, null, 2)}`;
        addLLMTrace(nodeId, 'assistant', observeResponse, {
          actionType: 'observe',
          success: true,
          duration: Date.now() - startTime,
          actionsDiscovered: Array.isArray(result) ? result.length : 0
        });
        
        // Log the observation result
        addNodeLog(nodeId, {
          type: 'llm_response',
          title: 'Observe Result',
          content: `Observation completed!\n\nDiscovered actions:\n${JSON.stringify(result, null, 2)}`,
          metadata: {
            actionType: 'observe',
            duration: Date.now() - startTime
          }
        });
        break;

      case 'clear_memory':
        await stagehand.page.clearMemory();
        result = { action: 'clear_memory', success: true };
        break;

      case 'label_email':
        // Gmail-specific action to label emails
        await stagehand.page.act(`Apply label "${data.label || 'AEF-Processed'}" to the current email`);
        result = { action: 'label_email', label: data.label || 'AEF-Processed' };
        break;

      case 'search_airtable':
        // Airtable-specific search action
        const searchFields = data.searchFields || ['name'];
        const searchValue = data.searchValue;
        await stagehand.page.act(`Search for "${searchValue}" in fields: ${searchFields.join(', ')}`);
        result = { action: 'search_airtable', searchValue, searchFields };
        break;

      case 'paginate_extract':
        // Complex pagination with extraction
        const allResults = [];
        let hasMorePages = true;
        let pageCount = 0;
        const maxPages = 10; // Safety limit
        
        while (hasMorePages && pageCount < maxPages) {
          // Extract current page
          const pageResult = await stagehand.page.extract({
            instruction: data.instruction,
            schema: data.schema
          });
          
          if (pageResult && pageResult.threads && Array.isArray(pageResult.threads)) {
            allResults.push(...pageResult.threads);
          }
          
          // Check for next page
          const hasNext = await stagehand.page.extract({
            instruction: "Check if 'Older' or 'Next' button is enabled and visible",
            schema: { hasNextPage: 'boolean' }
          });
          
          if (hasNext?.hasNextPage) {
            // Click next page
            await stagehand.page.act("Click the 'Older' or 'Next' button to go to next page");
            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            hasMorePages = false;
          }
          
          pageCount++;
        }
        
        result = { threads: allResults, totalPages: pageCount };
        break;

      case 'extract_list':
        // Extract list of items with pagination support
        console.log(`[Browser Server] Starting extract_list with config:`, JSON.stringify(data, null, 2));
        
        // Log the extraction prompt
        addNodeLog(nodeId, {
          type: 'prompt',
          title: 'LLM Prompt for Extract List',
          content: `Instruction: ${data.instruction}\n\nFields: ${JSON.stringify(data.fields, null, 2)}\n\nConfig: ${JSON.stringify({
            itemSelector: data.itemSelector,
            maxItems: data.maxItems,
            scrollStrategy: data.scrollStrategy
          }, null, 2)}\n\nContext: Extracting list from page: ${stagehand.page.url()}`,
          metadata: {
            actionType: 'extract_list',
            url: stagehand.page.url()
          }
        });

        // Create proper Zod schema for the fields
        const fieldSchema = {};
        const fields = data.fields || { text: "string", link: "string" };
        
        // Convert field definitions to Zod schema properties
        for (const [fieldName, fieldType] of Object.entries(fields)) {
          if (typeof fieldType === 'string') {
            // Simple string type
            fieldSchema[fieldName] = z.string().describe(`The ${fieldName} field`);
          } else {
            // Default to string for complex selectors
            fieldSchema[fieldName] = z.string().describe(`The ${fieldName} field`);
          }
        }
        
        // Use Stagehand's built-in extract with proper Zod schema
        const extractResult = await stagehand.page.extract({
          instruction: data.instruction || "Extract all items from the current page",
          schema: z.object({
            items: z.array(z.object(fieldSchema))
          })
        });

        // Format result to match expected structure
        const extractListResult = {
          items: extractResult?.items || [],
          pagesVisited: 1,
          totalItems: extractResult?.items?.length || 0,
          hasMore: false
        };

        // Log the extraction result
        addNodeLog(nodeId, {
          type: 'llm_response',
          title: 'Extract List Result',
          content: `List extraction completed!\n\nExtracted ${extractListResult.items.length} items:\n${JSON.stringify(extractListResult.items.slice(0, 3), null, 2)}${extractListResult.items.length > 3 ? '\n... and ' + (extractListResult.items.length - 3) + ' more items' : ''}`,
          metadata: {
            actionType: 'extract_list',
            duration: Date.now() - startTime,
            itemCount: extractListResult.items.length
          }
        });

        result = extractListResult;
        break;
        
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
    
    const response = {
      success: true,
      result,
      url: stagehand.page.url(),
      timestamp: Date.now(),
      // === PLAN A: INCLUDE LLM TRACE IN RESPONSE ===
      trace: getLLMTrace(nodeId)
    };
    
    // Log successful completion
    addNodeLog(nodeId, {
      type: 'success',
      title: `${type} Action Completed`,
      content: `Action completed successfully in ${Date.now() - startTime}ms\n\nResult:\n${JSON.stringify(result, null, 2)}`,
      metadata: {
        actionType: type,
        duration: Date.now() - startTime,
        url: stagehand.page.url()
      }
    });
    
    console.log(`[Browser Server] Action completed: ${type}`);
    res.json(response);
    
  } catch (error) {
    console.error(`[Browser Server] Action failed:`, error);
    
    // Log the error
    const errorNodeId = req.body.data?.nodeId || req.body.data?.stepId || 'unknown';
    addNodeLog(errorNodeId, {
      type: 'error',
      title: `${req.body.type} Action Failed`,
      content: `Action failed with error:\n\n${error.message}\n\nStack trace:\n${error.stack}`,
      metadata: {
        actionType: req.body.type,
        duration: typeof startTime !== 'undefined' ? Date.now() - startTime : 0,
        url: stagehand?.page?.url() || 'unknown'
      }
    });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Restart browser if closed
app.post('/restart-browser', async (req, res) => {
  try {
    console.log('[Browser Server] Restarting browser...');
    
    if (stagehand) {
      // Try to navigate to check if browser is responsive
      try {
        await stagehand.page.goto('data:text/html,<html><head><title>AEF Browser Restarted</title><style>body{font-family:system-ui;margin:0;padding:40px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;text-align:center;min-height:100vh;display:flex;flex-direction:column;justify-content:center;}h1{font-size:3em;margin:0;text-shadow:2px 2px 4px rgba(0,0,0,0.3);}p{font-size:1.2em;margin:20px 0;opacity:0.9;}</style></head><body><h1>🔄 Browser Restarted</h1><p>The browser window has been restored</p><p>Ready for automation workflows</p><div style="margin-top:40px;"><button onclick="window.location.href=\'https://example.com\'" style="background:rgba(255,255,255,0.2);border:2px solid white;color:white;padding:12px 24px;border-radius:8px;font-size:16px;cursor:pointer;">Visit Example.com</button> <button onclick="window.location.href=\'https://google.com\'" style="background:rgba(255,255,255,0.2);border:2px solid white;color:white;padding:12px 24px;border-radius:8px;font-size:16px;cursor:pointer;">Go to Google</button></div></body></html>');
        
        lastActivity = Date.now();
        
        res.json({
          success: true,
          message: 'Browser restarted successfully',
          url: stagehand.page.url()
        });
        
      } catch (error) {
        // Browser is unresponsive, reinitialize
        console.log('[Browser Server] Browser unresponsive, reinitializing...');
        await stagehand.close();
        stagehand = null;
        isInitialized = false;
        
        // Reinitialize
        const response = await fetch('http://localhost:3000/init', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          res.json({
            success: true,
            message: 'Browser fully reinitialized',
            url: 'Browser window restored'
          });
        } else {
          throw new Error('Failed to reinitialize browser');
        }
      }
    } else {
      // No browser instance, initialize
      const response = await fetch('http://localhost:3000/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        res.json({
          success: true,
          message: 'Browser initialized',
          url: 'Browser window created'
        });
      } else {
        throw new Error('Failed to initialize browser');
      }
    }
    
  } catch (error) {
    console.error('[Browser Server] Failed to restart browser:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🔥 KILL SESSION: Force destroy all browser state and cleanup
app.post('/kill-session', async (req, res) => {
  try {
    console.log('[Browser Server] 🔥 KILLING SESSION - Force destroying all browser state...');
    
    if (stagehand) {
      try {
        console.log('[Browser Server] Closing Stagehand instance...');
        await stagehand.close();
      } catch (error) {
        console.warn('[Browser Server] Error closing Stagehand:', error.message);
      }
      stagehand = null;
    }
    
    // Reset state flags
    isInitialized = false;
    lastActivity = Date.now();
    
    // 🔥 FORCE CLEANUP: Remove any lingering browser processes
    try {
      const { execSync } = require('child_process');
      // Kill any remaining chromium processes
      execSync('pkill -f chromium || true', { stdio: 'ignore' });
      execSync('pkill -f chrome || true', { stdio: 'ignore' });
      console.log('[Browser Server] 🔥 Killed all browser processes');
    } catch (error) {
      console.warn('[Browser Server] Error killing processes:', error.message);
    }
    
    // 🔥 CLEANUP TEMP DIRECTORIES: Remove any stagehand temp directories
    try {
      const tempDir = os.tmpdir();
      const { execSync } = require('child_process');
      execSync(`find "${tempDir}" -name "aef-browser-session-*" -type d -exec rm -rf {} + 2>/dev/null || true`, { stdio: 'ignore' });
      execSync(`find "${tempDir}" -name "stagehand*" -type d -exec rm -rf {} + 2>/dev/null || true`, { stdio: 'ignore' });
      console.log('[Browser Server] 🔥 Cleaned up temporary directories');
    } catch (error) {
      console.warn('[Browser Server] Error cleaning temp directories:', error.message);
    }
    
    console.log('[Browser Server] 🔥 Session killed completely - ready for fresh initialization');
    
    res.json({
      success: true,
      message: 'Session killed completely - all browser state destroyed',
      isInitialized: false
    });
    
  } catch (error) {
    console.error('[Browser Server] Error killing session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get node logs for debugging
app.get('/logs/:nodeId', (req, res) => {
  try {
    const { nodeId } = req.params;
    const logs = nodeLogs.get(nodeId) || [];
    
    res.json({
      success: true,
      nodeId,
      logs,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Browser Server] Error getting logs:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get browser state
app.get('/state', async (req, res) => {
  try {
    if (!isInitialized || !stagehand) {
      return res.status(400).json({
        success: false,
        error: 'Browser not initialized'
      });
    }
    
    const screenshot = await stagehand.page.screenshot({ 
      fullPage: false 
    });
    
    res.json({
      success: true,
      state: {
        url: stagehand.page.url(),
        screenshot: screenshot.toString('base64'),
        timestamp: Date.now(),
        lastActivity
      }
    });
    
  } catch (error) {
    console.error('[Browser Server] Failed to get state:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Shutdown gracefully
app.post('/shutdown', async (req, res) => {
  try {
    console.log('[Browser Server] Shutting down...');
    
    if (stagehand) {
      await stagehand.close();
    }
    
    res.json({ success: true, message: 'Shutdown initiated' });
    
    // Exit after response is sent
    setTimeout(() => {
      process.exit(0);
    }, 100);
    
  } catch (error) {
    console.error('[Browser Server] Shutdown error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling
app.use((error, req, res, next) => {
  console.error('[Browser Server] Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`[Browser Server] Listening on port ${port}`);
  console.log(`[Browser Server] Health check: http://localhost:${port}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Browser Server] Received SIGTERM, shutting down...');
  if (stagehand) {
    await stagehand.close();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[Browser Server] Received SIGINT, shutting down...');
  if (stagehand) {
    await stagehand.close();
  }
  process.exit(0);
}); 