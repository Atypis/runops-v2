// Test to understand iteration variable resolution in nth parameter

import { NodeExecutor } from '../services/nodeExecutor.js';
import { supabase } from '../config/supabase.js';

async function testIterationVariableResolution() {
  const nodeExecutor = new NodeExecutor();
  const workflowId = '550e8400-e29b-41d4-a716-446655440001'; // Valid UUID
  
  console.log('\n=== Testing Iteration Variable Resolution ===\n');
  
  // Step 1: Set up iteration context
  console.log('1. Setting up iteration context...');
  const iterateNodePos = 10;
  const currentIndex = 2;
  const variable = 'email';
  const total = 5;
  
  nodeExecutor.pushIterationContext(iterateNodePos, currentIndex, variable, total);
  console.log(`   Pushed context: node ${iterateNodePos}, index ${currentIndex}, variable "${variable}"`);
  
  // Step 2: Store iteration variables in memory
  console.log('\n2. Storing iteration variables...');
  const varKey = nodeExecutor.getStorageKey(variable);
  const indexKey = nodeExecutor.getStorageKey(`${variable}Index`);
  const totalKey = nodeExecutor.getStorageKey(`${variable}Total`);
  
  console.log(`   Variable key: ${varKey}`);
  console.log(`   Index key: ${indexKey}`);
  console.log(`   Total key: ${totalKey}`);
  
  await supabase
    .from('workflow_memory')
    .upsert([
      { workflow_id: workflowId, key: varKey, value: { subject: 'Test Email', sender: 'test@example.com' } },
      { workflow_id: workflowId, key: indexKey, value: currentIndex },
      { workflow_id: workflowId, key: totalKey, value: total }
    ]);
  
  // Step 3: Test template variable resolution
  console.log('\n3. Testing template variable resolution...');
  
  const testCases = [
    '{{emailIndex}}',
    '{{email.subject}}',
    '{{emailTotal}}',
    '{{email}}',
    '2',  // Static value
    '{{emailIndex * 2}}',  // Expression
  ];
  
  for (const testCase of testCases) {
    try {
      console.log(`\n   Testing: "${testCase}"`);
      const resolved = await nodeExecutor.resolveTemplateVariables(testCase, workflowId);
      console.log(`   Resolved to: ${JSON.stringify(resolved)} (type: ${typeof resolved})`);
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
  }
  
  // Step 4: Test in browser action context
  console.log('\n4. Testing browser action with nth parameter...');
  
  const browserActionNode = {
    type: 'browser_action',
    params: {
      action: 'click',
      selector: 'tr.zA',
      nth: '{{emailIndex}}'
    }
  };
  
  try {
    console.log(`   Original nth value: "${browserActionNode.params.nth}"`);
    const resolvedParams = await nodeExecutor.resolveNodeParams(browserActionNode.params, workflowId);
    console.log(`   Resolved nth value: ${JSON.stringify(resolvedParams.nth)} (type: ${typeof resolvedParams.nth})`);
    
    // Test what happens in resolveIndex
    if (resolvedParams.nth !== undefined) {
      const index = nodeExecutor.resolveIndex(resolvedParams.nth, 10);
      console.log(`   Final index from resolveIndex: ${index}`);
    }
  } catch (error) {
    console.log(`   ERROR: ${error.message}`);
    console.log(`   Stack: ${error.stack}`);
  }
  
  // Step 5: Clean up
  console.log('\n5. Cleaning up...');
  nodeExecutor.popIterationContext();
  
  await supabase
    .from('workflow_memory')
    .delete()
    .eq('workflow_id', workflowId);
  
  console.log('\n=== Test Complete ===\n');
}

// Run the test
testIterationVariableResolution().catch(console.error);