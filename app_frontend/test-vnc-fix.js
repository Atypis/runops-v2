#!/usr/bin/env node

/**
 * Test script to verify the VNC container recovery fix
 * Tests that DockerBrowserManager can find existing containers after restart
 */

const { register } = require('ts-node');
register({ 
  transpileOnly: true, 
  compilerOptions: { 
    module: 'commonjs',
    moduleResolution: 'node'
  } 
});

const { DockerBrowserManager } = require('./lib/browser/DockerBrowserManager.ts');

async function testContainerRecovery() {
  console.log('🔍 Testing VNC Container Recovery Fix\n');
  
  try {
    // Create a fresh DockerBrowserManager instance
    console.log('1. Creating fresh DockerBrowserManager...');
    const manager = new DockerBrowserManager();
    
    // Wait a moment for initialization to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check what containers are registered
    console.log('2. Checking registered containers...');
    const stats = manager.getStats();
    console.log(`   - Active containers: ${stats.activeContainers}`);
    console.log(`   - Available ports: ${stats.availablePorts}`);
    
    // Test finding container by execution ID
    console.log('3. Testing container lookup by execution ID...');
    const executionId = 'vnc-env-e68b0753-626f43c2-2967-433a-a87b-1f32cdc533ed';
    const session = manager.getSessionByExecution(executionId);
    
    if (session) {
      console.log('✅ SUCCESS: Container found!');
      console.log(`   - Session ID: ${session.id}`);
      console.log(`   - Execution ID: ${session.executionId}`);
      console.log(`   - Main Port: ${session.port}`);
      console.log(`   - VNC Port: ${session.vncPort}`);
      console.log(`   - noVNC Port: ${session.noVncPort}`);
      console.log(`   - Status: ${session.status}`);
      return true;
    } else {
      console.log('❌ FAILED: Container not found');
      console.log('   This means the syncWithDockerState fix didn\'t work properly');
      return false;
    }
    
  } catch (error) {
    console.error('❌ ERROR during test:', error.message);
    return false;
  }
}

// Run the test
testContainerRecovery().then(success => {
  console.log(`\n🏁 Test ${success ? 'PASSED' : 'FAILED'}`);
  process.exit(success ? 0 : 1);
}); 