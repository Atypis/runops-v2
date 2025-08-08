#!/usr/bin/env node

/**
 * Simple Stagehand test to debug initialization issues
 */

const { Stagehand } = require('@browserbasehq/stagehand');

async function testStagehand() {
  try {
    console.log('Testing Stagehand initialization...');
    console.log('Node version:', process.version);
    console.log('Platform:', process.platform);
    console.log('ANTHROPIC_API_KEY set:', !!process.env.ANTHROPIC_API_KEY);
    
    // Minimal configuration
    const config = {
      modelName: 'claude-3-5-sonnet-20241022',
      modelClientOptions: {
        apiKey: process.env.ANTHROPIC_API_KEY,
      },
      env: 'LOCAL',
      headless: false,
      verbose: 1
    };
    
    console.log('Creating Stagehand instance...');
    const stagehand = new Stagehand(config);
    
    console.log('Initializing Stagehand...');
    await stagehand.init();
    
    console.log('✅ Stagehand initialized successfully!');
    
    // Test basic navigation
    console.log('Testing navigation...');
    await stagehand.page.goto('data:text/html,<html><body><h1>Test Page</h1></body></html>');
    
    console.log('✅ Navigation successful!');
    
    // Cleanup
    await stagehand.close();
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testStagehand(); 