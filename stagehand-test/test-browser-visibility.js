#!/usr/bin/env node

/**
 * Browser Visibility Test
 * 
 * This script tests if the browser window opens visibly and comes to the foreground.
 * Use this to debug browser visibility issues.
 */

import { Stagehand } from "@browserbasehq/stagehand";
import config from "./stagehand.config.js";

async function testBrowserVisibility() {
  console.log('🧪 Testing Browser Visibility...\n');
  
  const stagehandConfig = {
    // LLM configuration
    modelName: config.llmConfig.modelName,
    modelClientOptions: config.llmConfig.modelClientOptions,
    
    // Force local browser with maximum visibility
    env: 'LOCAL',
    headless: false,
    devtools: true,
    verbose: 2,
    
    // Enhanced browser launch options for visibility
    localBrowserLaunchOptions: {
      headless: false,
      devtools: true,
      slowMo: 1000, // Very slow for visibility
      args: [
        '--start-maximized',
        '--auto-open-devtools-for-tabs',
        '--new-window',
        '--activate-on-open',
        '--no-first-run',
        '--disable-web-security',
        '--force-device-scale-factor=1',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
      ],
      viewport: {
        width: 1280,
        height: 720,
      },
    }
  };
  
  console.log('🔧 Configuration:', {
    modelName: stagehandConfig.modelName,
    headless: stagehandConfig.headless,
    devtools: stagehandConfig.devtools,
    env: stagehandConfig.env
  });
  
  let stagehand = null;
  
  try {
    console.log('\n🚀 Initializing Stagehand...');
    stagehand = new Stagehand(stagehandConfig);
    await stagehand.init();
    
    console.log('\n✅ Stagehand initialized successfully!');
    console.log('\n🎭 BROWSER WINDOW STATUS:');
    console.log('   • A Chrome browser window should now be visible');
    console.log('   • It should be maximized and in the foreground');
    console.log('   • DevTools should be open on the right side');
    console.log('   • If you don\'t see it, check your dock/taskbar');
    
    console.log('\n⏳ Keeping browser open for 10 seconds...');
    console.log('   (Look for the browser window now!)');
    
    // Navigate to a simple page to make it more obvious
    await stagehand.page.goto('https://example.com');
    console.log('📄 Navigated to example.com');
    
    // Wait and give user time to see the browser
    for (let i = 10; i > 0; i--) {
      console.log(`   ⏰ ${i} seconds remaining...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n🎯 Testing a simple action...');
    await stagehand.page.act('Click on the "More information..." link');
    
    console.log('\n⏳ Keeping browser open for another 5 seconds...');
    for (let i = 5; i > 0; i--) {
      console.log(`   ⏰ ${i} seconds remaining...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✅ Browser visibility test completed!');
    
  } catch (error) {
    console.error('\n❌ Error during browser visibility test:', error.message);
  } finally {
    if (stagehand) {
      console.log('\n🔒 Closing browser...');
      await stagehand.close();
    }
  }
}

// Run the test
testBrowserVisibility().catch(console.error); 