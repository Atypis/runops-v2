#!/usr/bin/env node

/**
 * Minimal Stagehand Test
 * Debug what's going wrong with Stagehand initialization
 */

console.log('🧪 Testing Stagehand initialization...');

// Check environment
console.log('Environment check:');
console.log('- Node version:', process.version);
console.log('- ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY);
console.log('- ANTHROPIC_API_KEY length:', process.env.ANTHROPIC_API_KEY?.length || 0);

try {
  console.log('\n📦 Loading Stagehand...');
  const { Stagehand } = require('@browserbasehq/stagehand');
  console.log('✅ Stagehand module loaded');

  console.log('\n🔧 Creating Stagehand config...');
  const config = {
    modelName: 'claude-3-5-sonnet-20241022',
    modelClientOptions: {
      apiKey: process.env.ANTHROPIC_API_KEY,
    },
    env: 'LOCAL',
    headless: false,
    verbose: 1,
    localBrowserLaunchOptions: {
      headless: false,
      viewport: { width: 1280, height: 720 },
      env: {
        ...process.env,
        DISPLAY: ':99'
      },
      args: [
        '--no-first-run',
        '--disable-web-security', 
        '--disable-features=VizDisplayCompositor',
        '--force-device-scale-factor=1',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--remote-debugging-port=9222',
        '--remote-debugging-address=0.0.0.0'
      ]
    }
  };
  
  console.log('✅ Config created:', JSON.stringify(config, null, 2));

  console.log('\n🚀 Initializing Stagehand...');
  const stagehand = new Stagehand(config);
  console.log('✅ Stagehand instance created');

  stagehand.init().then(() => {
    console.log('✅ Stagehand initialized successfully!');
    console.log('📍 Current URL:', stagehand.page.url());
    
    // Clean up
    stagehand.close().then(() => {
      console.log('✅ Stagehand closed');
      process.exit(0);
    });
    
  }).catch((error) => {
    console.error('❌ Stagehand initialization failed:', error);
    console.error('❌ Error details:', error.message);
    console.error('❌ Stack trace:', error.stack);
    process.exit(1);
  });

} catch (error) {
  console.error('❌ Failed to load or create Stagehand:', error);
  console.error('❌ Error details:', error.message);
  console.error('❌ Stack trace:', error.stack);
  process.exit(1);
} 