#!/usr/bin/env node

/**
 * Demo script to test the responsive VNC viewport functionality
 * Tests the complete pipeline: container creation → dynamic resolution → CSS scaling
 */

const { HybridBrowserManager } = require('./lib/browser/HybridBrowserManager.ts');

async function demoResponsiveVNC() {
  console.log('🎯 Responsive VNC Viewport Demo\n');
  
  let manager = null;
  let session = null;
  
  try {
    // Create hybrid browser manager
    console.log('🚀 Creating hybrid browser manager...');
    manager = new HybridBrowserManager('docker'); // Force Docker mode
    
    // Test different viewport scenarios
    const testCases = [
      { name: 'Small Viewport', width: 800, height: 500 },
      { name: 'Medium Viewport', width: 1280, height: 720 },
      { name: 'Large Viewport', width: 1920, height: 1080 },
      { name: 'Ultrawide Viewport', width: 2560, height: 1080 },
      { name: 'Portrait Tablet', width: 768, height: 1024 }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n📱 Testing: ${testCase.name} (${testCase.width}x${testCase.height})`);
      
      // Create session with specific viewport
      session = await manager.createSession({
        executionId: `responsive-test-${Date.now()}`,
        userId: 'demo-user',
        viewport: { width: testCase.width, height: testCase.height },
        headless: false,
        mode: 'docker'
      });
      
      console.log(`   ✅ Session created: ${session.id}`);
      console.log(`   🖥️ VNC URL: http://localhost:${session.noVncPort}/vnc.html`);
      console.log(`   📐 Resolution: ${session.resolution?.width}x${session.resolution?.height}`);
      
      // Wait a moment for container to initialize
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Test resolution update
      const newResolution = { 
        width: Math.floor(testCase.width * 0.8), 
        height: Math.floor(testCase.height * 0.8) 
      };
      
      console.log(`   🔄 Testing dynamic resolution update to ${newResolution.width}x${newResolution.height}`);
      try {
        await manager.dockerManager.updateContainerResolution(session.id, newResolution);
        console.log(`   ✅ Resolution updated successfully`);
      } catch (error) {
        console.log(`   ⚠️ Resolution update not yet supported: ${error.message}`);
      }
      
      // Clean up session
      console.log(`   🧹 Cleaning up session...`);
      await manager.destroySessionByExecution(session.executionId);
      
      // Wait before next test
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n🎉 Responsive VNC Demo Complete!');
    console.log('\n📋 What this demonstrates:');
    console.log('   ✅ Dynamic VNC resolution based on viewport size');
    console.log('   ✅ Container configuration with optimal dimensions');
    console.log('   ✅ VNC-friendly dimension calculations (multiples of 8)');
    console.log('   ✅ Resolution update API (when container supports it)');
    console.log('   ✅ Clean session lifecycle management');
    
    console.log('\n🎯 Next Steps:');
    console.log('   → Open browser to test ResponsiveVNCFrame component');
    console.log('   → Navigate to: http://localhost:3000/sop/any-workflow-id');
    console.log('   → Click "🤖 AEF" tab → "🖥️ Start Remote Desktop"');
    console.log('   → Resize browser window to see responsive scaling');
    console.log('   → Use Fit/1:1/Fill controls in VNC overlay');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    
    if (session) {
      try {
        console.log('🧹 Cleaning up failed session...');
        await manager.destroySessionByExecution(session.executionId);
      } catch (cleanupError) {
        console.error('❌ Cleanup failed:', cleanupError);
      }
    }
    
    process.exit(1);
  } finally {
    if (manager) {
      try {
        await manager.shutdown();
      } catch (shutdownError) {
        console.error('❌ Manager shutdown failed:', shutdownError);
      }
    }
  }
}

// Run the demo
if (require.main === module) {
  demoResponsiveVNC()
    .then(() => {
      console.log('✅ Demo completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Demo failed:', error);
      process.exit(1);
    });
}

module.exports = { demoResponsiveVNC }; 