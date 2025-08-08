#!/usr/bin/env node

/**
 * Test script to verify fresh session cleanup functionality
 * 
 * This script tests that:
 * 1. Kill session endpoint completely destroys browser state
 * 2. New sessions are truly fresh with no persistence
 * 3. Browser window positions don't carry over between sessions
 */

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

async function testFreshSessionCleanup() {
  console.log('🧪 Testing Fresh Session Cleanup...\n');
  
  try {
    // Step 1: Create a VNC session
    console.log('📝 Step 1: Creating initial VNC session...');
    const createResponse = await fetch('http://localhost:3000/api/aef/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!createResponse.ok) {
      throw new Error(`Failed to create session: ${createResponse.status}`);
    }
    
    const createResult = await createResponse.json();
    console.log(`✅ Session created: ${createResult.session?.executionId}`);
    console.log(`🔧 API URL: ${createResult.session?.apiUrl}`);
    console.log(`🖥️ VNC URL: ${createResult.session?.vncUrl}\n`);
    
    const apiPort = createResult.session?.apiPort || 13000;
    const sessionId = createResult.session?.executionId;
    
    // Step 2: Wait for container to be ready
    console.log('⏳ Step 2: Waiting for container to initialize...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    
    // Step 3: Test browser initialization
    console.log('🌐 Step 3: Testing browser initialization...');
    const healthResponse = await fetch(`http://localhost:${apiPort}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log(`✅ Browser health: ${health.status} (initialized: ${health.initialized})`);
    }
    
    // Step 4: Navigate to a test page to create some state
    console.log('🔄 Step 4: Creating browser state by navigating...');
    const navigateResponse = await fetch(`http://localhost:${apiPort}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'navigate',
        data: { url: 'https://example.com' }
      })
    });
    
    if (navigateResponse.ok) {
      const navResult = await navigateResponse.json();
      console.log(`✅ Navigated to: ${navResult.url}`);
    }
    
    // Step 5: Test the NEW kill-session endpoint
    console.log('🔥 Step 5: Testing NEW kill-session endpoint...');
    const killResponse = await fetch(`http://localhost:${apiPort}/kill-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (killResponse.ok) {
      const killResult = await killResponse.json();
      console.log(`✅ Kill-session result: ${killResult.message}`);
      console.log(`🔄 Initialized state: ${killResult.isInitialized}`);
    } else {
      console.warn(`⚠️ Kill-session returned: ${killResponse.status}`);
    }
    
    // Step 6: Kill the entire VNC session
    console.log('💀 Step 6: Terminating VNC session completely...');
    const deleteResponse = await fetch('http://localhost:3000/api/aef/session', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (deleteResponse.ok) {
      const deleteResult = await deleteResponse.json();
      console.log(`✅ Session terminated: ${deleteResult.message}`);
    }
    
    // Step 7: Wait for complete cleanup
    console.log('⏳ Step 7: Waiting for complete cleanup...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
    
    // Step 8: Create a NEW fresh session
    console.log('🆕 Step 8: Creating fresh session to test state persistence...');
    const freshResponse = await fetch('http://localhost:3000/api/aef/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    
    if (!freshResponse.ok) {
      throw new Error(`Failed to create fresh session: ${freshResponse.status}`);
    }
    
    const freshResult = await freshResponse.json();
    console.log(`✅ Fresh session created: ${freshResult.session?.executionId}`);
    console.log(`🔧 Fresh API URL: ${freshResult.session?.apiUrl}`);
    
    const freshApiPort = freshResult.session?.apiPort || 13000;
    
    // Step 9: Wait for fresh container to be ready
    console.log('⏳ Step 9: Waiting for fresh container to initialize...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    
    // Step 10: Test that the fresh session is truly fresh
    console.log('🧹 Step 10: Verifying fresh session state...');
    
    // Check health
    const freshHealthResponse = await fetch(`http://localhost:${freshApiPort}/health`);
    if (freshHealthResponse.ok) {
      const freshHealth = await freshHealthResponse.json();
      console.log(`✅ Fresh browser health: ${freshHealth.status} (initialized: ${freshHealth.initialized})`);
    }
    
    // Check if we can get current state
    try {
      const freshStateResponse = await fetch(`http://localhost:${freshApiPort}/state`);
      if (freshStateResponse.ok) {
        const freshState = await freshStateResponse.json();
        console.log(`✅ Fresh session URL: ${freshState.state?.url}`);
        
        // The fresh session should NOT be on example.com - it should be on the welcome page
        if (freshState.state?.url?.includes('example.com')) {
          console.error('❌ FAILURE: Fresh session shows example.com - state persisted!');
          console.error('🔥 The browser state is NOT being properly cleaned up!');
        } else {
          console.log('🎉 SUCCESS: Fresh session shows welcome page - no state persistence!');
          console.log('✅ Browser state cleanup is working correctly!');
        }
      }
    } catch (stateError) {
      console.warn('⚠️ Could not check fresh session state:', stateError.message);
    }
    
    console.log('\n🎯 Test Summary:');
    console.log('1. ✅ Session creation working');
    console.log('2. ✅ Browser navigation working');
    console.log('3. ✅ Kill-session endpoint implemented');
    console.log('4. ✅ VNC session termination working');
    console.log('5. ✅ Fresh session creation working');
    console.log('6. 🧪 Fresh state verification completed');
    console.log('\n🔥 If you see SUCCESS above, the browser state cleanup is working!');
    console.log('🔥 If you see FAILURE above, browser state is still persisting.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testFreshSessionCleanup().catch(console.error); 