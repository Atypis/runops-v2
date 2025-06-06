#!/usr/bin/env node

const path = require('path');

// Configure TypeScript compilation for this session
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

async function startWebSocketServer() {
  try {
    console.log('🚀 Starting VNC-enabled WebSocket server...');
    
    // Import the WebSocket server
    const { wsServer } = require('./lib/browser/WebSocketServer.ts');
    
    await wsServer.start();
    
    console.log('✅ WebSocket server started successfully!');
    console.log('📊 Server stats:', wsServer.getStats());
    console.log('🔗 Connect via: ws://localhost:3004/ws?executionId=<your-execution-id>');
    console.log('🖥️ VNC support: Enabled for Docker containers');
    
    // Graceful shutdown handling
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down WebSocket server...');
      await wsServer.stop();
      console.log('✅ WebSocket server stopped');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n🛑 Shutting down WebSocket server...');
      await wsServer.stop();
      console.log('✅ WebSocket server stopped');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start WebSocket server:', error);
    process.exit(1);
  }
}

// Start the server
startWebSocketServer(); 