#!/usr/bin/env node

/**
 * Enhanced Browser Visibility Test
 * 
 * This test focuses specifically on making the browser window visible
 * and properly activated on macOS with enhanced window management.
 */

import { Stagehand } from "@browserbasehq/stagehand";
import config from "./stagehand.config.js";

async function testEnhancedBrowserVisibility() {
  console.log('🎭 ENHANCED BROWSER VISIBILITY TEST');
  console.log('='.repeat(50));
  console.log('🎯 Goal: Make browser window clearly visible and active');
  console.log('🖥️  Platform: macOS optimized');
  console.log('='.repeat(50));

  let stagehand = null;

  try {
    console.log('\n🚀 Initializing Stagehand with enhanced visibility settings...');
    
    const enhancedConfig = {
      modelName: config.llmConfig.modelName,
      modelClientOptions: config.llmConfig.modelClientOptions,
      env: 'LOCAL',
      headless: false,
      devtools: true,
      slowMo: 1000, // Even slower for better observation
      localBrowserLaunchOptions: {
        headless: false,
        devtools: true,
        args: [
          // Window management
          '--start-maximized',
          '--start-fullscreen=false',
          '--auto-open-devtools-for-tabs',
          '--new-window',
          '--activate-on-open',
          
          // macOS specific
          '--force-device-scale-factor=1',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-background-media-suspend',
          
          // Visibility and focus
          '--no-first-run',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          
          // Window positioning
          '--window-position=100,100',
          '--window-size=1400,900',
          
          // Prevent hiding
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-popup-blocking',
        ],
        viewport: { width: 1400, height: 900 },
        defaultViewport: { width: 1400, height: 900 },
        ignoreDefaultArgs: ['--enable-automation'],
      },
      verbose: 2, // Maximum verbosity
      enableCaching: false,
      domSettleTimeoutMs: 30000,
    };

    stagehand = new Stagehand(enhancedConfig);
    await stagehand.init();
    
    console.log('✅ Stagehand initialized!');
    console.log('\n🔍 BROWSER WINDOW CHECK:');
    console.log('   1. Look for a Chrome/Chromium window');
    console.log('   2. It should be maximized or large');
    console.log('   3. DevTools should be open on the right');
    console.log('   4. Window should be in the foreground');
    
    console.log('\n⏳ Waiting 5 seconds for window to appear...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Navigate to a visible page
    console.log('\n🌐 Navigating to Google to test visibility...');
    await stagehand.page.goto('https://www.google.com');
    
    console.log('✅ Navigation complete!');
    console.log('\n📺 You should now see:');
    console.log('   • Google homepage loaded');
    console.log('   • Browser window clearly visible');
    console.log('   • DevTools panel on the right side');
    
    console.log('\n⏳ Waiting 5 seconds for observation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test a simple interaction
    console.log('\n🤖 Testing AI interaction - searching for "hello world"...');
    await stagehand.page.act('Type "hello world" in the search box and press Enter');
    
    console.log('✅ AI interaction complete!');
    console.log('\n📊 VISIBILITY TEST RESULTS:');
    console.log('   ✅ Browser window should be clearly visible');
    console.log('   ✅ Google search should have been performed');
    console.log('   ✅ You should see search results for "hello world"');
    
    console.log('\n⏳ Keeping browser open for 10 seconds for final review...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n🎉 ENHANCED VISIBILITY TEST COMPLETE!');
    console.log('If you could see the browser window and interactions, the setup is working correctly.');
    
  } catch (error) {
    console.error('\n💥 Enhanced visibility test failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Check if Chrome/Chromium is installed');
    console.log('   2. Try running: brew install --cask google-chrome');
    console.log('   3. Check macOS permissions for automation');
    console.log('   4. Look in all desktop spaces/windows');
  } finally {
    if (stagehand) {
      console.log('\n🔒 Closing browser...');
      await stagehand.close();
    }
  }
}

// Add npm script info
console.log('💡 TIP: Add this to package.json scripts:');
console.log('   "test-visibility": "node test-browser-visibility-enhanced.js"');
console.log('');

// Run the test
testEnhancedBrowserVisibility().catch(console.error); 