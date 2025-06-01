#!/usr/bin/env node

/**
 * Test Dynamic Auth Executor Visibility
 * 
 * This test verifies that the dynamic auth executor uses the same
 * enhanced browser visibility settings as the visibility test.
 */

import DynamicAuthExecutor from './dynamic-auth-executor.js';

async function testDynamicAuthVisibility() {
  console.log('🎭 TESTING DYNAMIC AUTH EXECUTOR VISIBILITY');
  console.log('='.repeat(55));
  console.log('🎯 Goal: Verify browser visibility matches enhanced test');
  console.log('='.repeat(55));

  const executor = new DynamicAuthExecutor();

  try {
    console.log('\n🚀 Initializing Dynamic Auth Executor...');
    await executor.init();
    
    console.log('\n🔍 BROWSER WINDOW CHECK:');
    console.log('   1. Look for a Chrome/Chromium window');
    console.log('   2. It should be maximized (1400x900)');
    console.log('   3. DevTools should be open on the right');
    console.log('   4. Window should be in the foreground');
    
    console.log('\n⏳ Waiting 5 seconds for window observation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Navigate to Google to test visibility
    console.log('\n🌐 Navigating to Google to test visibility...');
    await executor.page.goto('https://www.google.com');
    
    console.log('✅ Navigation complete!');
    console.log('\n📺 You should now see:');
    console.log('   • Google homepage loaded');
    console.log('   • Browser window clearly visible');
    console.log('   • DevTools panel on the right side');
    console.log('   • Same appearance as enhanced visibility test');
    
    console.log('\n⏳ Waiting 5 seconds for observation...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Test a simple AI interaction
    console.log('\n🤖 Testing AI interaction - searching for "dynamic auth test"...');
    await executor.page.act('Type "dynamic auth test" in the search box and press Enter');
    
    console.log('✅ AI interaction complete!');
    console.log('\n📊 VISIBILITY COMPARISON:');
    console.log('   ✅ Browser window visibility should match enhanced test');
    console.log('   ✅ Google search should have been performed');
    console.log('   ✅ You should see search results');
    
    console.log('\n⏳ Keeping browser open for 10 seconds for comparison...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n🎉 DYNAMIC AUTH VISIBILITY TEST COMPLETE!');
    console.log('If the browser looks the same as the enhanced visibility test, we fixed the issue!');
    
  } catch (error) {
    console.error('\n💥 Dynamic auth visibility test failed:', error.message);
    console.log('\n🔧 If you still see a blank page, the configurations might still differ.');
  } finally {
    await executor.close();
    console.log('\n🔒 Browser closed. Visibility comparison complete!');
  }
}

// Run the test
testDynamicAuthVisibility().catch(console.error); 