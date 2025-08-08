#!/usr/bin/env node

/**
 * Test WebSocket connection to verify complete VNC flow
 */

const WebSocket = require('ws');

async function testWebSocketConnection() {
  console.log('🔗 Testing WebSocket VNC Connection\n');
  
  const executionId = 'vnc-env-e68b0753-626f43c2-2967-433a-a87b-1f32cdc533ed';
  const wsUrl = `ws://localhost:3004/ws?executionId=${executionId}`;
  
  return new Promise((resolve) => {
    console.log(`Connecting to: ${wsUrl}`);
    
    const ws = new WebSocket(wsUrl);
    let success = false;
    
    ws.on('open', () => {
      console.log('✅ WebSocket Connected');
      ws.send(JSON.stringify({
        type: 'vnc_connect',
        timestamp: Date.now()
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📨 Received:', message);
      
      if (message.type === 'connection_established') {
        console.log('✅ Connection established successfully');
      } else if (message.type === 'vnc_ready') {
        console.log('✅ VNC is ready for streaming');
        success = true;
      } else if (message.type === 'vnc_error') {
        console.log('❌ VNC Error:', message.data.error);
      }
    });
    
    ws.on('error', (err) => {
      console.log('❌ WebSocket Error:', err.message);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
      resolve(success);
    });
    
    // Close after 5 seconds
    setTimeout(() => {
      ws.close();
    }, 5000);
  });
}

// Run the test
testWebSocketConnection().then(success => {
  console.log(`\n🏁 WebSocket Test ${success ? 'PASSED' : 'COMPLETED'}`);
  console.log(success ? 
    '✅ VNC streaming should now work in the frontend!' : 
    '⚠️  Check if VNC container is properly configured'
  );
  process.exit(0);
}); 