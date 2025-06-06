#!/usr/bin/env node

/**
 * Test API for Dynamic VNC Resolution Changes
 * 
 * Provides endpoints to change X server resolution in Docker containers
 * Used by test-vnc-minimal.html to test dynamic resolution functionality
 */

const express = require('express');
const { execSync, spawn } = require('child_process');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors()); // Allow requests from test HTML file

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'Dynamic Resolution API',
    timestamp: new Date().toISOString()
  });
});

// Change container X server resolution
app.post('/change-resolution', async (req, res) => {
  try {
    const { containerId, width, height } = req.body;
    
    if (!containerId || !width || !height) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: containerId, width, height'
      });
    }

    console.log(`📐 Changing resolution for container ${containerId} to ${width}x${height}`);

    // Method 1: Try xrandr to change resolution dynamically
    try {
      const xrandrCommand = `docker exec ${containerId} bash -c "DISPLAY=:99 xrandr --output default --mode ${width}x${height} 2>/dev/null || DISPLAY=:99 xrandr --size ${width}x${height} 2>/dev/null || echo 'xrandr failed'"`;
      const xrandrResult = execSync(xrandrCommand, { encoding: 'utf8', timeout: 5000 });
      
      if (!xrandrResult.includes('xrandr failed')) {
        console.log(`✅ xrandr resolution change successful`);
        
        // Restart VNC server to pick up new resolution
        try {
          execSync(`docker exec ${containerId} bash -c "pkill x11vnc; sleep 1; DISPLAY=:99 x11vnc -forever -usepw -shared -rfbport 5900 -desktop 'AEF Browser' >/dev/null 2>&1 &"`, { timeout: 3000 });
          console.log(`🔄 VNC server restarted`);
        } catch (vncError) {
          console.log(`⚠️ VNC restart failed (may still work): ${vncError.message}`);
        }

        return res.json({
          success: true,
          method: 'xrandr',
          resolution: `${width}x${height}`,
          message: 'Resolution changed via xrandr'
        });
      }
    } catch (xrandrError) {
      console.log(`⚠️ xrandr method failed: ${xrandrError.message}`);
    }

    // Method 2: Try Xvfb restart (more disruptive but reliable)
    try {
      console.log(`🔄 Attempting Xvfb restart method...`);
      
      // Kill existing X server and VNC
      execSync(`docker exec ${containerId} bash -c "pkill Xvfb; pkill x11vnc; sleep 2"`, { timeout: 5000 });
      
      // Start new X server with desired resolution
      execSync(`docker exec ${containerId} bash -c "DISPLAY=:99 Xvfb :99 -screen 0 ${width}x${height}x24 -dpi 96 >/dev/null 2>&1 &"`, { timeout: 3000 });
      
      // Wait for X server to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start window manager
      execSync(`docker exec ${containerId} bash -c "DISPLAY=:99 fluxbox >/dev/null 2>&1 &"`, { timeout: 3000 });
      
      // Start VNC server
      execSync(`docker exec ${containerId} bash -c "DISPLAY=:99 x11vnc -forever -usepw -shared -rfbport 5900 -desktop 'AEF Browser' >/dev/null 2>&1 &"`, { timeout: 3000 });
      
      console.log(`✅ Xvfb restart successful`);
      
      return res.json({
        success: true,
        method: 'xvfb_restart',
        resolution: `${width}x${height}`,
        message: 'Resolution changed via Xvfb restart'
      });
      
    } catch (xvfbError) {
      console.log(`❌ Xvfb restart failed: ${xvfbError.message}`);
    }

    // Method 3: Container restart (last resort)
    try {
      console.log(`🔄 Attempting container environment update...`);
      
      // Update container environment variables for future sessions
      // This won't affect current session but will help with debugging
      
      return res.status(500).json({
        success: false,
        error: 'All resolution change methods failed',
        attempts: ['xrandr', 'xvfb_restart'],
        suggestion: 'Container may need to be recreated with new resolution'
      });
      
    } catch (error) {
      throw error;
    }

  } catch (error) {
    console.error(`❌ Resolution change failed:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Test browser launch
app.post('/test-browser', async (req, res) => {
  try {
    const { containerId, url = 'https://example.com' } = req.body;
    
    if (!containerId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: containerId'
      });
    }

    console.log(`🧪 Testing browser launch in ${containerId} with URL: ${url}`);

    // Launch Chrome with current display resolution
    const browserCommand = `docker exec ${containerId} bash -c "DISPLAY=:99 /home/aefuser/.cache/ms-playwright/chromium-1169/chrome-linux/chrome --no-sandbox --window-size=1280,720 --start-maximized '${url}' >/dev/null 2>&1 &"`;
    
    execSync(browserCommand, { timeout: 5000 });
    
    console.log(`✅ Browser launched successfully`);
    
    res.json({
      success: true,
      message: `Browser launched with URL: ${url}`,
      containerId: containerId
    });

  } catch (error) {
    console.error(`❌ Browser test failed:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get container info
app.get('/container-info/:containerId', async (req, res) => {
  try {
    const { containerId } = req.params;
    
    // Get X server resolution
    const xrandrOutput = execSync(`docker exec ${containerId} bash -c "DISPLAY=:99 xrandr 2>/dev/null || echo 'xrandr failed'"`, { encoding: 'utf8' });
    
    // Get running processes
    const processes = execSync(`docker exec ${containerId} ps aux | grep -E "(Xvfb|x11vnc|chrome|fluxbox)"`, { encoding: 'utf8' });
    
    res.json({
      success: true,
      containerId: containerId,
      xrandr: xrandrOutput,
      processes: processes,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ Container info failed:`, error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
const port = process.env.PORT || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Dynamic Resolution API listening on port ${port}`);
  console.log(`📋 Available endpoints:`);
  console.log(`   POST /change-resolution - Change container X server resolution`);
  console.log(`   POST /test-browser - Launch browser in container`);
  console.log(`   GET /container-info/:id - Get container status`);
  console.log(`   GET /health - Health check`);
  console.log(`\n🧪 Test with: http://localhost:${port}/health`);
  console.log(`📄 Open test page: test-vnc-minimal.html`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('📄 Dynamic Resolution API shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('📄 Dynamic Resolution API shutting down...');
  process.exit(0);
}); 