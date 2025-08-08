#!/usr/bin/env node

// Simple test to verify browser opens with visible window
const { Stagehand } = require('@browserbasehq/stagehand');

async function testBrowserWindow() {
  console.log('🧪 Testing browser window visibility...');
  
  const config = {
    env: 'LOCAL',
    headless: false, // Force windowed mode
    verbose: 1,
    browserLaunchOptions: {
      headless: false, // Explicitly force windowed mode
      args: [
        '--start-maximized',
        '--no-first-run',
        '--disable-web-security',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--remote-debugging-port=9222',
        '--remote-debugging-address=0.0.0.0',
        '--display=:99'
      ],
      env: {
        ...process.env,
        DISPLAY: ':99'
      }
    }
  };
  
  try {
    console.log('🚀 Initializing Stagehand with windowed browser...');
    const stagehand = new Stagehand(config);
    await stagehand.init();
    
    console.log('🌐 Navigating to test page...');
    await stagehand.page.goto('data:text/html,<html><head><title>🤖 AEF Browser Test</title><style>body{font-family:Arial;background:linear-gradient(45deg,#667eea,#764ba2);color:white;text-align:center;padding:100px;font-size:24px;}</style></head><body><h1>✅ Browser Window is Visible!</h1><p>This browser is ready for automation</p><p>Time: ' + new Date().toLocaleTimeString() + '</p></body></html>');
    
    console.log('✅ Browser window should now be visible in VNC!');
    console.log('📍 URL:', stagehand.page.url());
    
    // Keep browser open for testing
    console.log('🔄 Keeping browser open for 60 seconds for testing...');
    setTimeout(async () => {
      console.log('🛑 Closing browser...');
      await stagehand.close();
      process.exit(0);
    }, 60000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testBrowserWindow(); 