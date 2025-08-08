const { spawn } = require('child_process');

// Start the WebSocket server using npx ts-node
const ws = spawn('npx', ['ts-node', '-e', `
  import('./lib/browser/WebSocketServer').then(({ wsServer }) => {
    wsServer.start()
      .then(() => console.log('WebSocket server started on port 3003'))
      .catch(console.error);
  });
`], {
  stdio: 'inherit',
  detached: true
});

ws.on('error', (error) => {
  console.error('Failed to start WebSocket server:', error);
});

console.log('Starting WebSocket server...'); 