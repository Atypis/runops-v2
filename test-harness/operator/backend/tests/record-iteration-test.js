// Test record iteration with direct record access
import { NodeExecutor } from '../services/nodeExecutor.js';
import { VariableManagementService } from '../services/variableManagementService.js';

async function testRecordIteration() {
  const nodeExecutor = new NodeExecutor();
  const variableService = new VariableManagementService();
  const workflowId = '8a776d4f-fbef-4607-afe7-3d5a281b452a'; // Use our actual workflow ID
  
  console.log('\n=== Testing Record Iteration with Direct Access ===\n');
  
  // Step 1: Use existing website records
  console.log('1. Using existing website records...');
  
  const records = await variableService.queryRecords(workflowId, 'website_*');
  console.log(`   Found ${records.length} website records`);
  
  if (records.length === 0) {
    console.log('   No records found! Please create website records first.');
    return;
  }
  
  const testRecords = records.slice(0, 2); // Use first 2 records for testing
  
  // Step 2: Test record context management
  console.log('\n2. Testing record context...');
  
  const firstRecord = testRecords[0];
  nodeExecutor.pushRecordContext(firstRecord.record_id, firstRecord.data);
  
  const currentRecord = nodeExecutor.getCurrentRecord();
  console.log(`   Current record ID: ${currentRecord ? currentRecord.recordId : 'null'}`);
  console.log(`   Record context stack length: ${nodeExecutor.recordContext.length}`);
  
  // Step 3: Test template resolution with current record
  console.log('\n3. Testing template resolution for current record...');
  
  const testTemplates = [
    '{{current.fields.url}}',
    '{{current.fields.title}}',
    '{{current.vars.classification}}', // Should return undefined
    '{{current}}'
  ];
  
  for (const template of testTemplates) {
    try {
      console.log(`\n   Testing template: "${template}"`);
      const resolved = await nodeExecutor.resolveTemplateVariables(template, workflowId);
      console.log(`   Resolved to: ${JSON.stringify(resolved)}`);
    } catch (error) {
      console.log(`   ERROR: ${error.message}`);
    }
  }
  
  // Step 4: Test during simulated iteration
  console.log('\n4. Testing during simulated record iteration...');
  
  // Pop current context
  nodeExecutor.popRecordContext();
  
  // Simulate iteration over both records
  for (let i = 0; i < testRecords.length; i++) {
    const record = testRecords[i];
    console.log(`\n   --- Processing record ${i + 1}: ${record.record_id} ---`);
    
    // Push record context (simulating iteration)
    nodeExecutor.pushRecordContext(record.record_id, record.data);
    
    // Test template resolution
    const url = await nodeExecutor.resolveTemplateVariables('{{current.fields.url}}', workflowId);
    console.log(`   Resolved URL: ${url}`);
    
    // Pop context
    nodeExecutor.popRecordContext();
  }
  
  // Step 5: Clean up
  console.log('\n5. Test complete - no cleanup needed (using existing records)');
  
  console.log('\n=== Record Iteration Test Complete ===\n');
}

// Run the test
testRecordIteration().catch(console.error);