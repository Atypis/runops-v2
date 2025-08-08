const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3004/ws?executionId=vnc-env-e68b0753-7dc3a2d7-394e-4d07-ad18-8f0546a9e979');

ws.on('open', function() {
  console.log('✅ WebSocket connected');
  ws.send(JSON.stringify({
    type: 'vnc_connect',
    timestamp: Date.now()
  }));
});

ws.on('message', function(data) {
  const message = JSON.parse(data.toString());
  console.log('📨 Received:', message.type, message);
  if (message.type === 'vnc_ready') {
    console.log('🖥️ VNC URL:', message.data.vncUrl);
    process.exit(0);
  }
});

ws.on('error', function(error) {
  console.error('❌ WebSocket error:', error);
  process.exit(1);
});

setTimeout(() => {
  console.log('⏰ Timeout - closing');
  process.exit(1);
}, 5000); 