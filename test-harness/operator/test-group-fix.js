import { DirectorService } from './backend/services/directorService.js';

// Test the group functionality fix
async function testGroupFix() {
  const directorService = new DirectorService();
  const testWorkflowId = 'test-workflow-123';
  
  console.log('=== Testing Group Functionality Fix ===\n');
  
  try {
    // Step 1: Define a test group
    console.log('1. Defining a test group...');
    const defineResult = await directorService.defineGroup({
      groupId: 'test_login_flow',
      name: 'Test Login Flow',
      description: 'A test reusable login flow',
      parameters: ['username', 'password'],
      nodes: [
        {
          type: 'browser_action',
          config: {
            action: 'navigate',
            url: 'https://example.com/login'
          },
          description: 'Navigate to login page',
          alias: 'go_to_login'
        },
        {
          type: 'browser_action',
          config: {
            action: 'type',
            selector: '#username',
            text: '{{username}}'
          },
          description: 'Enter username',
          alias: 'enter_username'
        },
        {
          type: 'browser_action',
          config: {
            action: 'type',
            selector: '#password',
            text: '{{password}}'
          },
          description: 'Enter password',
          alias: 'enter_password'
        },
        {
          type: 'browser_action',
          config: {
            action: 'click',
            selector: '#submit'
          },
          description: 'Click submit button',
          alias: 'click_submit'
        }
      ]
    }, testWorkflowId);
    
    console.log('Define result:', defineResult);
    console.log('');
    
    // Step 2: Use the group
    console.log('2. Using the test group...');
    const useResult = await directorService.useGroup({
      groupId: 'test_login_flow',
      params: {
        username: 'testuser@example.com',
        password: 'testpass123'
      },
      description: 'Login with test credentials'
    }, testWorkflowId);
    
    console.log('Use result:', useResult);
    console.log('');
    
    // Step 3: List groups to verify
    console.log('3. Listing all groups...');
    const listResult = await directorService.listGroups(testWorkflowId);
    console.log('Groups:', listResult);
    
    console.log('\n=== Test completed successfully! ===');
    
  } catch (error) {
    console.error('\n=== Test failed! ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
  
  // Exit cleanly
  process.exit(0);
}

// Run the test
testGroupFix();