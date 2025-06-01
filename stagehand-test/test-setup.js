import SOPExecutor from './sop-executor.js';
import { z } from 'zod';

/**
 * Test Setup Validation
 * 
 * This validates the test environment setup without requiring API keys
 */

console.log('🧪 Stagehand Test Environment Setup Validation\n');
console.log('='.repeat(60));

// Test 1: Class instantiation
console.log('1. Testing SOPExecutor instantiation...');
try {
  const executor = new SOPExecutor();
  console.log('   ✅ SOPExecutor created successfully');
} catch (error) {
  console.log('   ❌ Failed to create SOPExecutor:', error.message);
}

// Test 2: Zod schema validation
console.log('\n2. Testing Zod schema parsing...');
try {
  const testSchema = z.object({
    senderName: z.string(),
    senderEmail: z.string().email(),
    subject: z.string()
  });
  
  const testData = {
    senderName: "John Doe",
    senderEmail: "john@example.com", 
    subject: "Test Email"
  };
  
  const result = testSchema.parse(testData);
  console.log('   ✅ Zod schema validation working');
  console.log('   📊 Parsed data:', result);
} catch (error) {
  console.log('   ❌ Zod schema validation failed:', error.message);
}

// Test 3: Variable replacement
console.log('\n3. Testing variable replacement...');
try {
  const executor = new SOPExecutor();
  executor.variables = {
    senderName: "Jane Smith",
    senderEmail: "jane@example.com"
  };
  
  const instruction = "Enter {{senderName}} in the name field and {{senderEmail}} in the email field";
  const result = executor.replaceVariables(instruction);
  const expected = "Enter Jane Smith in the name field and jane@example.com in the email field";
  
  if (result === expected) {
    console.log('   ✅ Variable replacement working');
    console.log('   📝 Result:', result);
  } else {
    console.log('   ❌ Variable replacement failed');
    console.log('   📝 Expected:', expected);
    console.log('   📝 Got:', result);
  }
} catch (error) {
  console.log('   ❌ Variable replacement test failed:', error.message);
}

// Test 4: Step structure validation
console.log('\n4. Testing step structure validation...');
try {
  const sampleStep = {
    "id": "test_step",
    "type": "task",
    "label": "Test step",
    "stagehand_instruction": "Click the test button",
    "confidence_level": "high"
  };
  
  // Validate required fields
  const requiredFields = ['id', 'type', 'label'];
  const hasAllFields = requiredFields.every(field => sampleStep.hasOwnProperty(field));
  
  if (hasAllFields) {
    console.log('   ✅ Step structure validation working');
    console.log('   📋 Sample step:', JSON.stringify(sampleStep, null, 2));
  } else {
    console.log('   ❌ Step structure missing required fields');
  }
} catch (error) {
  console.log('   ❌ Step structure validation failed:', error.message);
}

console.log('\n' + '='.repeat(60));
console.log('🎯 SETUP VALIDATION COMPLETE');
console.log('='.repeat(60));

console.log('\n📋 NEXT STEPS:');
console.log('1. Add your OpenAI API key to .env file');
console.log('2. Run: npm run test-gmail (for atomic Gmail steps)');
console.log('3. Run: npm run test (for full SOP execution)');

console.log('\n🔧 ENVIRONMENT SETUP:');
console.log('- Copy env.example to .env');
console.log('- Add OPENAI_API_KEY=your_key_here');
console.log('- Optionally add Browserbase credentials for cloud execution');

console.log('\n🎉 Ready to test Stagehand execution of atomic SOP steps!'); 