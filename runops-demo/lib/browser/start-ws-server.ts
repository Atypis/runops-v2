#!/usr/bin/env node

import { wsServer } from './WebSocketServer';

async function startWebSocketServer() {
  try {
    console.log('🚀 Starting VNC-enabled WebSocket server...');
    
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