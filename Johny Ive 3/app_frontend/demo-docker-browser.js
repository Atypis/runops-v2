#!/usr/bin/env node

/**
 * Docker Browser Automation Demo
 * 
 * Tests the containerized browser automation system
 */

// Setup TypeScript support
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    target: 'es2020',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true
  }
});

const { DockerBrowserManager } = require('./lib/browser/DockerBrowserManager.ts');

async function demoDockerBrowser() {
  console.log('🐳 Docker Browser Automation Demo\n');
  
  let manager = null;
  let container = null;
  
  try {
    // Create Docker browser manager
    console.log('🚀 Creating Docker browser manager...');
    manager = new DockerBrowserManager();
    
    // Create a containerized browser session
    console.log('📦 Creating containerized browser session...');
    container = await manager.createSession({
      executionId: 'demo-docker-execution',
      userId: 'demo-user',
      headless: false,
      viewport: { width: 1280, height: 720 }
    });
    
    console.log(`✅ Container created: ${container.id} on port ${container.port}`);
    
    // Wait a moment for container to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Demo 1: Take initial screenshot
    console.log('\n📸 Demo 1: Taking initial screenshot...');
    const state1 = await manager.getBrowserState(container.id);
    console.log('✅ Screenshot captured:', state1.screenshot ? `${state1.screenshot.length} chars` : 'failed');
    
    // Demo 2: Navigate to a website
    console.log('\n🌐 Demo 2: Navigate to example.com');
    const navResult = await manager.executeAction(container.id, {
      type: 'navigate',
      data: { url: 'https://example.com' },
      stepId: 'demo-step-1'
    });
    console.log('✅ Navigation completed:', navResult.result);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Demo 3: Take screenshot of loaded page
    console.log('\n📸 Demo 3: Screenshot of loaded page');
    const state2 = await manager.getBrowserState(container.id);
    console.log('✅ Screenshot captured:', state2.screenshot ? `${state2.screenshot.length} chars` : 'failed');
    console.log('📍 Current URL:', state2.currentUrl);
    
    // Demo 4: Execute screenshot action
    console.log('\n📷 Demo 4: Execute screenshot action');
    const screenshotResult = await manager.executeAction(container.id, {
      type: 'screenshot',
      data: {},
      stepId: 'demo-step-2'
    });
    console.log('✅ Screenshot action completed:', screenshotResult.result ? `${screenshotResult.result.length} chars` : 'failed');
    
    // Demo 5: Navigate to another site
    console.log('\n🌐 Demo 5: Navigate to Google');
    const googleResult = await manager.executeAction(container.id, {
      type: 'navigate',
      data: { url: 'https://google.com' },
      stepId: 'demo-step-3'
    });
    console.log('✅ Google navigation completed:', googleResult.result);
    
    // Wait for page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Demo 6: Final screenshot
    console.log('\n📸 Demo 6: Final screenshot');
    const finalState = await manager.getBrowserState(container.id);
    console.log('✅ Final screenshot captured:', finalState.screenshot ? `${finalState.screenshot.length} chars` : 'failed');
    console.log('📍 Final URL:', finalState.currentUrl);
    
    // Show manager stats
    console.log('\n📊 Manager Stats:');
    const stats = manager.getStats();
    console.log(JSON.stringify(stats, null, 2));
    
    console.log('\n🎉 Demo Results:');
    console.log('   - Docker container creation ✅');
    console.log('   - Browser automation in container ✅');
    console.log('   - Screenshot capture ✅');
    console.log('   - Multi-site navigation ✅');
    console.log('   - Container management ✅');
    
  } catch (error) {
    console.error('\n❌ Demo failed:', error.message);
    
    if (error.message.includes('Docker')) {
      console.log('\n💡 Docker issues detected. Make sure:');
      console.log('   1. Docker is installed and running');
      console.log('   2. Run: npm run build-browser-image');
      console.log('   3. Check Docker daemon is accessible');
    }
    
    if (error.message.includes('API') || error.message.includes('proxy')) {
      console.log('\n💡 API key issues detected. Make sure:');
      console.log('   1. ANTHROPIC_API_KEY is set in .env file');
      console.log('   2. Anthropic API key is valid and has credits');
      console.log('   3. Check the exact error:', error.message);
    }
    
  } finally {
    if (container && manager) {
      console.log('\n🔒 Cleaning up container...');
      try {
        await manager.destroySession(container.id);
        console.log('✅ Container destroyed');
      } catch (error) {
        console.error('⚠️  Cleanup error:', error.message);
      }
    }
    
    if (manager) {
      console.log('🔒 Shutting down manager...');
      try {
        await manager.shutdown();
        console.log('✅ Manager shut down');
      } catch (error) {
        console.error('⚠️  Shutdown error:', error.message);
      }
    }
    
    console.log('\n👋 Demo complete!');
    process.exit(0);
  }
}

demoDockerBrowser(); 