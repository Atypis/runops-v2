#!/usr/bin/env node

/**
 * AEF Browser Server
 * 
 * Runs inside Docker container to manage Stagehand browser automation
 * Communicates with host via HTTP API for action execution
 */

const express = require('express');
const { Stagehand } = require('@browserbasehq/stagehand');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const os = require('os');

const app = express();
app.use(express.json({ limit: '10mb' }));

let stagehand = null;
let isInitialized = false;
let lastActivity = Date.now();

// In-memory log storage for debugging
const nodeLogs = new Map(); // nodeId -> logs[]

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
  res.json({
    status: 'healthy',
    initialized: isInitialized,
    lastActivity: new Date(lastActivity).toISOString(),
    uptime: process.uptime()
  });
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
  const possiblePaths = [
    // Playwright Chromium (preferred for Stagehand)
    '/home/aefuser/.cache/ms-playwright/chromium-1169/chrome-linux/chrome',
    process.env.HOME + '/.cache/ms-playwright/chromium-1169/chrome-linux/chrome',
    // System Chromium fallback
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable'
  ];
  
  for (const execPath of possiblePaths) {
    if (fs.existsSync(execPath)) {
      console.log(`[Browser Server] Found Chromium at: ${execPath}`);
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
    
    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }
    
    // Find the correct browser executable
    const executablePath = findChromiumExecutable();
    
    // 🔥 FORCE FRESH SESSION: Create unique temporary userDataDir for this session
    const sessionId = crypto.randomBytes(8).toString('hex');
    const freshUserDataDir = path.join(os.tmpdir(), `aef-browser-session-${sessionId}`);
    
    console.log(`[Browser Server] 🔥 Creating FRESH session with userDataDir: ${freshUserDataDir}`);
    
    // Configuration using available Chromium
    const config = {
      modelName: 'claude-3-5-sonnet-20241022',
      modelClientOptions: {
        apiKey: process.env.ANTHROPIC_API_KEY,
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
    
    console.log(`[Browser Server] Executing action: ${type} for node: ${nodeId}`);
    
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
        // Log the extraction prompt
        addNodeLog(nodeId, {
          type: 'prompt',
          title: 'LLM Prompt for Extract',
          content: `Instruction: ${data.instruction}\n\nSchema: ${JSON.stringify(data.schema, null, 2)}\n\nContext: Extracting data from page: ${stagehand.page.url()}`,
          metadata: {
            actionType: 'extract',
            url: stagehand.page.url()
          }
        });
        
        result = await stagehand.page.extract({
          instruction: data.instruction,
          schema: data.schema
        });
        
        // Log the extraction result
        addNodeLog(nodeId, {
          type: 'llm_response',
          title: 'Extract Result',
          content: `Extraction completed successfully!\n\nExtracted data:\n${JSON.stringify(result, null, 2)}`,
          metadata: {
            actionType: 'extract',
            duration: Date.now() - startTime
          }
        });
        break;
        
      case 'screenshot':
        const screenshot = await stagehand.page.screenshot({ 
          fullPage: false 
        });
        result = screenshot.toString('base64');
        break;

      case 'observe':
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
        
      default:
        throw new Error(`Unknown action type: ${type}`);
    }
    
    const response = {
      success: true,
      result,
      url: stagehand.page.url(),
      timestamp: Date.now()
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
        duration: Date.now() - startTime,
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