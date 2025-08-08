#!/usr/bin/env node

/**
 * Test Browser Integration
 * 
 * Simple test to verify browser automation and WebSocket streaming works
 */

const WebSocket = require('ws');

async function testBrowserIntegration() {
  console.log('🧪 Testing Browser Integration...\n');
  
  try {
    // Step 1: Create an AEF execution
    console.log('📝 Step 1: Creating AEF execution...');
    
    const executeResponse = await fetch('http://localhost:3002/api/aef/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: In a real app, you'd need proper authentication headers
      },
      body: JSON.stringify({
        aefDocumentId: 'test-sop-id' // This would be a real SOP ID
      })
    });
    
    if (!executeResponse.ok) {
      console.log('⚠️  Could not create execution (expected - need proper auth/SOP)');
      console.log('Response:', await executeResponse.text());
      console.log('\n📝 Manual test instructions:');
      console.log('1. Go to http://localhost:3002');
      console.log('2. Upload a video and create an SOP');  
      console.log('3. Transform it to AEF');
      console.log('4. Start execution in the AEF Control Center');
      console.log('5. Watch browser automation + WebSocket streaming!');
      return;
    }
    
    const execution = await executeResponse.json();
    console.log('✅ Execution created:', execution.executionId);
    console.log('🔗 WebSocket URL:', execution.websocketUrl);
    
    // Step 2: Connect to WebSocket
    console.log('\n📡 Step 2: Connecting to WebSocket...');
    
    const ws = new WebSocket(execution.websocketUrl);
    
    ws.on('open', () => {
      console.log('✅ WebSocket connected!');
      
      // Request a screenshot
      ws.send(JSON.stringify({
        type: 'request_screenshot',
        timestamp: Date.now()
      }));
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      console.log('📨 WebSocket message:', message.type);
      
      if (message.type === 'browser_update' && message.data.screenshot) {
        console.log('📸 Screenshot received! (length:', message.data.screenshot.length, 'chars)');
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
    });
    
    // Step 3: Test browser action
    console.log('\n🤖 Step 3: Testing browser action...');
    
    const actionResponse = await fetch(`http://localhost:3002/api/aef/action/${execution.executionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        stepId: 'test-step-1',
        action: 'execute',
        browserAction: {
          type: 'navigate',
          data: { url: 'https://example.com' }
        }
      })
    });
    
    if (actionResponse.ok) {
      const actionResult = await actionResponse.json();
      console.log('✅ Browser action completed:', actionResult.browserResult);
    } else {
      console.log('⚠️  Browser action failed:', await actionResponse.text());
    }
    
    // Clean up
    setTimeout(() => {
      ws.close();
      console.log('\n🎉 Test completed!');
      process.exit(0);
    }, 5000);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testBrowserIntegration(); 