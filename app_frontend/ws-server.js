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
      
      if (session && 'vncPort' in session && 'noVncPort' in session) {
        // Real Docker container with VNC
        console.log(`[WebSocketServer] Found Docker container for ${executionId} with VNC ports`);
        ws.send(JSON.stringify({
          type: 'vnc_ready',
          timestamp: Date.now(),
          data: { 
            vncUrl: `http://localhost:${session.noVncPort}/vnc.html`,
            vncPort: session.vncPort,
            noVncPort: session.noVncPort,
            message: 'Live VNC connection to browser automation'
          }
        }));
        return;
      }
    }
    
    // Check if test container is running (our manual test container)
    const testNoVncPort = 16080;
    ws.send(JSON.stringify({
      type: 'vnc_ready',
      timestamp: Date.now(),
      data: { 
        vncUrl: `http://localhost:${testNoVncPort}/vnc.html`,
        vncPort: 15900,
        noVncPort: testNoVncPort,
        message: 'VNC connection to test container'
      }
    }));
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