const WebSocket = require('ws');

async function testVNCConnection() {
  console.log('🧪 Testing VNC Connection to WebSocket Server...');
  
  const executionId = 'vnc-env-dbfedfae-631d-4019-b3ad-9798fb0c481f';
  const wsUrl = `ws://localhost:3004/ws?executionId=${executionId}`;
  
  console.log(`📡 Connecting to: ${wsUrl}`);
  
  const ws = new WebSocket(wsUrl);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Request VNC connection
    console.log('🖥️ Requesting VNC connection...');
    ws.send(JSON.stringify({
      type: 'vnc_connect',
      timestamp: Date.now()
    }));
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Received message:`, message.type);
      
      if (message.type === 'vnc_ready') {
        console.log('🎉 VNC CONNECTION SUCCESS!');
        console.log('📊 VNC Details:');
        console.log(`   - VNC URL: ${message.data.vncUrl}`);
        console.log(`   - noVNC Port: ${message.data.noVncPort}`);
        console.log(`   - VNC Port: ${message.data.vncPort}`);
        console.log(`   - Message: ${message.data.message}`);
        
        // Test if VNC URL is accessible
        testVNCAccess(message.data.vncUrl);
      } else if (message.type === 'vnc_fallback') {
        console.log('⚠️ VNC fallback mode');
        console.log(`   - Message: ${message.data.message}`);
      } else if (message.type === 'vnc_error') {
        console.log('❌ VNC connection error');
        console.log(`   - Error: ${message.data.error}`);
      } else {
        console.log(`ℹ️ Other message: ${JSON.stringify(message, null, 2)}`);
      }
    } catch (error) {
      console.error('❌ Error parsing message:', error);
    }
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket disconnected');
    process.exit(0);
  });
  
  // Timeout after 10 seconds
  setTimeout(() => {
    console.log('⏰ Test timeout - closing connection');
    ws.close();
  }, 10000);
}

async function testVNCAccess(vncUrl) {
  try {
    const response = await fetch(vncUrl, { method: 'HEAD' });
    if (response.ok) {
      console.log('✅ VNC URL is accessible!');
    } else {
      console.log(`⚠️ VNC URL returned status: ${response.status}`);
    }
  } catch (error) {
    console.log(`❌ VNC URL not accessible: ${error.message}`);
  }
}

// Start the test
testVNCConnection(); 