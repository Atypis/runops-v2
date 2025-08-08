const { register } = require('ts-node');

// Register TypeScript with Node.js-compatible settings
register({
  project: './tsconfig.node.json',
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node'
  }
});

// Start the WebSocket server
async function startServer() {
  try {
    const { wsServer } = require('./lib/browser/WebSocketServer.ts');
    await wsServer.start();
    console.log('✅ WebSocket server started successfully on port 3004');
    
    // Keep process alive
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down WebSocket server...');
      await wsServer.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Failed to start WebSocket server:', error);
    process.exit(1);
  }
}

startServer(); 