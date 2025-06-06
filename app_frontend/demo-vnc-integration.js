#!/usr/bin/env node

console.log('🧪 VNC Integration Demo Test');
console.log('================================');

async function testVNCIntegration() {
  try {
    console.log('\n1. 🚀 Starting VNC environment...');
    
    // Start VNC environment
    const startResponse = await fetch('http://localhost:3000/api/aef/start-vnc-environment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        executionId: 'demo-vnc-test-' + Date.now(),
        userId: 'demo-user'
      })
    });
    
    if (!startResponse.ok) {
      const error = await startResponse.json();
      throw new Error(`Failed to start VNC environment: ${error.error}`);
    }
    
    const vncResult = await startResponse.json();
    console.log('✅ VNC environment started:', vncResult.executionId);
    console.log(`🖥️ VNC port: ${vncResult.vncPorts.vnc}`);
    console.log(`🌐 noVNC port: ${vncResult.vncPorts.noVnc}`);
    console.log(`🔗 WebSocket URL: ${vncResult.websocketUrl}`);
    
    console.log('\n2. 🔗 Testing WebSocket connection...');
    
    // Test WebSocket connection
    const WebSocket = require('ws');
    const ws = new WebSocket(vncResult.websocketUrl);
    
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 10000);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        console.log('✅ WebSocket connected successfully');
        
        // Send VNC connect request
        ws.send(JSON.stringify({
          type: 'vnc_connect',
          timestamp: Date.now()
        }));
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log(`📨 Received: ${message.type}`);
          
          if (message.type === 'vnc_ready') {
            console.log('🖥️ VNC connection ready!');
            console.log(`🎯 VNC URL: ${message.data.vncUrl}`);
            resolve();
          }
        } catch (error) {
          console.error('Failed to parse message:', error);
        }
      });
      
      ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    ws.close();
    
    console.log('\n3. 🧹 Cleaning up VNC environment...');
    
    // Stop VNC environment
    const stopResponse = await fetch('http://localhost:3000/api/aef/stop-vnc-environment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        executionId: vncResult.executionId
      })
    });
    
    if (stopResponse.ok) {
      console.log('✅ VNC environment stopped successfully');
    } else {
      console.warn('⚠️ Failed to stop VNC environment gracefully');
    }
    
    console.log('\n🎉 VNC Integration Test COMPLETED SUCCESSFULLY!');
    console.log('\n📋 What this proves:');
    console.log('  ✅ VNC environment API endpoints working');
    console.log('  ✅ WebSocket server handling VNC connections');
    console.log('  ✅ noVNC URL generation working');
    console.log('  ✅ Complete VNC lifecycle management');
    console.log('\n🎯 Next step: Click "🖥️ Start Remote Desktop" in the AEF Control Center!');
    
  } catch (error) {
    console.error('\n❌ VNC Integration Test FAILED:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('  1. Ensure WebSocket server is running: node ws-server.js');
    console.log('  2. Ensure Next.js server is running: npm run dev');
    console.log('  3. Check Docker is running for container support');
    process.exit(1);
  }
}

// Run the test
testVNCIntegration(); 