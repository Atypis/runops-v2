#!/usr/bin/env node

const { WebSocketServer, WebSocket } = require('ws');
const { createServer } = require('http');
const { parse } = require('url');

// Configure TypeScript compilation
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2020',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true
  }
});

class SimpleVNCWebSocketServer {
  constructor(port = 3004) {
    this.port = port;
    this.server = createServer();
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });
    
    // Import HybridBrowserManager
    try {
      const { hybridBrowserManager } = require('./lib/browser/HybridBrowserManager.ts');
      this.browserManager = hybridBrowserManager;
      console.log('✅ Connected to HybridBrowserManager');
    } catch (error) {
      console.warn('⚠️ Could not connect to HybridBrowserManager:', error.message);
      this.browserManager = null;
    }
    
    this.setupWebSocketHandling();
  }
  
  setupWebSocketHandling() {
    this.wss.on('connection', (ws, req) => {
      const { pathname, query } = parse(req.url, true);
      
      console.log(`[WebSocketServer] New connection to ${pathname}`);
      
      const executionId = query.executionId;
      
      if (!executionId) {
        console.error('[WebSocketServer] No execution ID provided');
        ws.close(1008, 'Execution ID required');
        return;
      }
      
      // Handle incoming WebSocket messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(ws, executionId, message);
        } catch (error) {
          console.error('[WebSocketServer] Invalid message format:', error);
          ws.send(JSON.stringify({
            type: 'error',
            timestamp: Date.now(),
            data: { error: 'Invalid message format' }
          }));
        }
      });
      
      ws.on('close', () => {
        console.log(`[WebSocketServer] Connection closed for execution ${executionId}`);
      });
      
      ws.on('error', (error) => {
        console.error(`[WebSocketServer] WebSocket error for execution ${executionId}:`, error);
      });
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection_established',
        timestamp: Date.now(),
        data: { executionId, message: 'WebSocket connected successfully' }
      }));
    });
  }
  
  handleWebSocketMessage(ws, executionId, message) {
    console.log(`[WebSocketServer] Received message for ${executionId}:`, message.type);
    
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
          data: { originalTimestamp: message.timestamp }
        }));
        break;
        
      case 'vnc_connect':
        this.handleVncConnection(ws, executionId);
        break;
        
      case 'request_screenshot':
        this.handleScreenshotRequest(ws, executionId);
        break;
        
      default:
        console.warn(`[WebSocketServer] Unknown message type: ${message.type}`);
        break;
    }
  }
  
  handleVncConnection(ws, executionId) {
    console.log(`[WebSocketServer] VNC connection requested for ${executionId}`);
    
    if (this.browserManager) {
      // Check for real Docker container
      const session = this.browserManager.getSessionByExecution(executionId);
      
      console.log(`[WebSocketServer] Session lookup result:`, session ? {
        id: session.id,
        executionId: session.executionId,
        hasVncPort: 'vncPort' in session,
        hasNoVncPort: 'noVncPort' in session,
        vncPort: session.vncPort || 'undefined',
        noVncPort: session.noVncPort || 'undefined'
      } : 'null');
      
      if (session && 'vncPort' in session && 'noVncPort' in session) {
        // Real Docker container with VNC
        console.log(`[WebSocketServer] Found Docker container for ${executionId} with VNC ports - VNC: ${session.vncPort}, noVNC: ${session.noVncPort}`);
        const vncUrl = `http://localhost:${session.noVncPort}/vnc.html`;
        console.log(`[WebSocketServer] Sending VNC URL: ${vncUrl}`);
        
        ws.send(JSON.stringify({
          type: 'vnc_ready',
          timestamp: Date.now(),
          data: { 
            vncUrl: vncUrl,
            vncPort: session.vncPort,
            noVncPort: session.noVncPort,
            message: 'Live VNC connection to browser automation'
          }
        }));
        return;
      }
    }
    
    // Enhanced fallback - check all running containers for VNC ports
    console.log(`[WebSocketServer] Session not found via browserManager, checking Docker containers directly...`);
    
    // Try common VNC ports based on our allocation scheme
    const testPorts = [16080, 16081, 16082, 16083, 16084];
    
    // Test each port to see if it's responding
    Promise.all(testPorts.map(async (port) => {
      try {
        const response = await fetch(`http://localhost:${port}/vnc.html`, { 
          method: 'HEAD',
          timeout: 1000 
        });
        return response.ok ? port : null;
      } catch {
        return null;
      }
    })).then(results => {
      const workingPort = results.find(port => port !== null);
      
      if (workingPort) {
        console.log(`[WebSocketServer] Found working VNC port: ${workingPort}`);
        ws.send(JSON.stringify({
          type: 'vnc_ready',
          timestamp: Date.now(),
          data: { 
            vncUrl: `http://localhost:${workingPort}/vnc.html`,
            vncPort: workingPort - 180, // Estimate VNC port (noVNC port - 180)
            noVncPort: workingPort,
            message: 'VNC connection to available container'
          }
        }));
      } else {
        console.log(`[WebSocketServer] No working VNC ports found`);
        ws.send(JSON.stringify({
          type: 'vnc_fallback',
          timestamp: Date.now(),
          data: { 
            message: 'No VNC containers available'
          }
        }));
      }
    }).catch(error => {
      console.error(`[WebSocketServer] Error testing VNC ports:`, error);
      ws.send(JSON.stringify({
        type: 'vnc_error',
        timestamp: Date.now(),
        data: { 
          error: 'Failed to find VNC connection'
        }
      }));
    });
  }
  
  handleScreenshotRequest(ws, executionId) {
    console.log(`[WebSocketServer] Screenshot requested for ${executionId}`);
    
    // Send mock screenshot
    const mockScreenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    ws.send(JSON.stringify({
      type: 'browser_update',
      timestamp: Date.now(),
      data: { 
        screenshot: mockScreenshot,
        state: { currentUrl: 'http://example.com' }
      }
    }));
  }
  
  start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`✅ VNC WebSocket server started on ws://localhost:${this.port}/ws`);
          resolve();
        }
      });
    });
  }
  
  stop() {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          console.log('✅ WebSocket server stopped');
          resolve();
        });
      });
    });
  }
}

async function startServer() {
  try {
    console.log('🚀 Starting VNC-enabled WebSocket server...');
    
    const server = new SimpleVNCWebSocketServer();
    await server.start();
    
    console.log('🔗 Connect via: ws://localhost:3004/ws?executionId=<your-execution-id>');
    console.log('🖥️ VNC support: Mock mode for testing');
    
    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down WebSocket server...');
      await server.stop();
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down WebSocket server...');
      await server.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start WebSocket server:', error);
    process.exit(1);
  }
}

// Start the server
startServer(); 