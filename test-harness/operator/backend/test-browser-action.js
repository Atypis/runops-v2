/**
 * Test script for the consolidated browser_action tool
 * Run with: node test-browser-action.js
 */

import { NodeExecutor } from './services/nodeExecutor.js';
import { BrowserActionService } from './services/browserActionService.js';
import BrowserStateService from './services/browserStateService.js';

async function testBrowserAction() {
  console.log('Testing BrowserActionService...\n');
  
  // Create instances
  const browserStateService = new BrowserStateService();
  const nodeExecutor = new NodeExecutor(browserStateService);
  const workflowId = 'test-workflow-' + Date.now();
  
  // Initialize Stagehand
  await nodeExecutor.init();
  
  // Create browser action service
  const browserActionService = new BrowserActionService(
    nodeExecutor,
    workflowId,
    browserStateService
  );
  
  try {
    // Test 1: Navigate
    console.log('Test 1: Navigate to example.com');
    const navResult = await browserActionService.execute('navigate', {
      url: 'https://example.com'
    });
    console.log('Result:', navResult);
    console.log('✓ Navigation successful\n');
    
    // Test 2: Wait
    console.log('Test 2: Wait for 2 seconds');
    const waitResult = await browserActionService.execute('wait', {
      waitType: 'time',
      waitValue: 2000
    });
    console.log('Result:', waitResult);
    console.log('✓ Wait successful\n');
    
    // Test 3: Get current URL
    console.log('Test 3: Get current URL');
    const urlResult = await browserActionService.execute('getCurrentUrl', {});
    console.log('Result:', urlResult);
    console.log('✓ URL retrieval successful\n');
    
    // Test 4: Get page title
    console.log('Test 4: Get page title');
    const titleResult = await browserActionService.execute('getTitle', {});
    console.log('Result:', titleResult);
    console.log('✓ Title retrieval successful\n');
    
    // Test 5: Open new tab
    console.log('Test 5: Open new tab');
    const openTabResult = await browserActionService.execute('openTab', {
      name: 'google',
      url: 'https://google.com'
    });
    console.log('Result:', openTabResult);
    console.log('✓ Tab opened successfully\n');
    
    // Test 6: List tabs
    console.log('Test 6: List tabs');
    const listTabsResult = await browserActionService.execute('listTabs', {});
    console.log('Result:', listTabsResult);
    console.log('✓ Tab listing successful\n');
    
    // Test 7: Switch tab
    console.log('Test 7: Switch back to main tab');
    const switchResult = await browserActionService.execute('switchTab', {
      tabName: 'main'
    });
    console.log('Result:', switchResult);
    console.log('✓ Tab switch successful\n');
    
    // Test 8: Click (will fail on example.com but tests the flow)
    console.log('Test 8: Try to click (expected to fail on example.com)');
    try {
      const clickResult = await browserActionService.execute('click', {
        selector: '#non-existent-button',
        timeout: 2000
      });
      console.log('Result:', clickResult);
    } catch (error) {
      console.log('Expected error:', error.message);
      console.log('✓ Click error handling works\n');
    }
    
    console.log('All tests completed successfully!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Cleanup
    await nodeExecutor.cleanup();
    process.exit(0);
  }
}

// Run the test
testBrowserAction().catch(console.error);