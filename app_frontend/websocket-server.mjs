import { wsServer } from './lib/browser/WebSocketServer.js';

wsServer.start()
  .then(() => console.log('✅ WebSocket server started on port 3003'))
  .catch(error => {
    console.error('❌ Failed to start WebSocket server:', error);
    process.exit(1);
  });

// Keep the process alive
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down WebSocket server...');
  await wsServer.stop();
  process.exit(0);
}); 