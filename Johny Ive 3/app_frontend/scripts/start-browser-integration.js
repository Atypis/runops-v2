#!/usr/bin/env node

/**
 * Browser Integration Startup Script
 * 
 * This script starts the WebSocket server for browser automation alongside the Next.js app.
 * Use this instead of `npm run dev` when working on browser integration features.
 */

// Setup TypeScript support with proper module configuration
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    target: 'es2017',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    skipLibCheck: true
  }
});

const { wsServer } = require('../lib/browser/WebSocketServer.ts');

async function startBrowserIntegration() {
  console.log('🚀 Starting Browser Integration...\n');
  
  try {
    // Start WebSocket server
    console.log('📡 Starting WebSocket server...');
    await wsServer.start();
    console.log('✅ WebSocket server running on ws://localhost:3003/ws\n');
    
    console.log('🎯 Browser Integration is ready!');
    console.log('📊 WebSocket Stats:', wsServer.getStats());
    console.log('\n💡 Usage:');
    console.log('   - Create AEF execution via POST /api/aef/execute');
    console.log('   - Connect to WebSocket at ws://localhost:3003/ws?executionId=<uuid>');
    console.log('   - Execute actions via POST /api/aef/action/<executionId>');
    console.log('\n🔧 Debug:');
    console.log('   - Next.js app should be running on http://localhost:3002');
    console.log('   - Browser sessions will open visibly for debugging');
    console.log('\n📝 To test:');
    console.log('   1. Transform an SOP to AEF');
    console.log('   2. Click "Start Execution" in the AEF Control Center');
    console.log('   3. Watch the browser automation in real-time!');
    
  } catch (error) {
    console.error('❌ Failed to start Browser Integration:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down Browser Integration...');
  try {
    await wsServer.stop();
    console.log('✅ WebSocket server stopped');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  try {
    await wsServer.stop();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
});

// Start the browser integration
startBrowserIntegration(); 