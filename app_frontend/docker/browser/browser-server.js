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

const app = express();
app.use(express.json({ limit: '10mb' }));

let stagehand = null;
let isInitialized = false;
let lastActivity = Date.now();

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
      execSync('xdpyinfo -display :99', { stdio: 'ignore' });
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
    console.log('[Browser Server] Initializing Stagehand...');
    
    // Wait for X server to be ready
    await waitForXServer();
    
    // Check if API key is available
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable not set');
    }
    
    // Find the correct browser executable
    const executablePath = findChromiumExecutable();
    
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
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--display=:99',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--window-size=1280,720',
          '--window-position=0,0',
          '--start-maximized',
          '--force-device-scale-factor=1',
          '--disable-background-mode'
        ],
        viewport: { width: 1280, height: 720 },
        env: {
          DISPLAY: ':99'
        }
      }
    };
    
    // Create new Stagehand instance
    console.log('[Browser Server] Creating Stagehand instance...');
    stagehand = new Stagehand(config);
    
    console.log('[Browser Server] Initializing Stagehand...');
    await stagehand.init();
    
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
    lastActivity = Date.now();
    
    console.log(`[Browser Server] Executing action: ${type}`);
    
    let result;
    
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
        
      case 'act':
        result = await stagehand.page.act(data.instruction);
        break;
        
      case 'extract':
        result = await stagehand.page.extract({
          instruction: data.instruction,
          schema: data.schema
        });
        break;
        
      case 'screenshot':
        const screenshot = await stagehand.page.screenshot({ 
          fullPage: false 
        });
        result = screenshot.toString('base64');
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
    
    console.log(`[Browser Server] Action completed: ${type}`);
    res.json(response);
    
  } catch (error) {
    console.error(`[Browser Server] Action failed:`, error);
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