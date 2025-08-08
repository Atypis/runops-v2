import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables BEFORE importing services
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Now import DirectorService after env vars are loaded
import { DirectorService } from '../services/directorService.js';

async function testKIMIIntegration() {
  console.log('Testing KIMI K2 integration in DirectorService...\n');
  
  const director = new DirectorService();
  const workflowId = 'test-workflow-' + Date.now();
  
  // Test 1: Basic message without tools
  console.log('=== Test 1: Basic message without tools ===');
  try {
    const response = await director.processMessage({
      message: 'Hello, please confirm you are using KIMI K2 model and briefly describe your capabilities.',
      workflowId,
      conversationHistory: [],
      selectedModel: 'kimi-k2'
    });
    
    console.log('✅ Response:', response.message);
    console.log('Model:', response.model || 'kimi-k2');
    console.log('Tokens:', response.input_tokens + response.output_tokens);
    console.log();
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }
  
  // Test 2: Simple tool calling
  console.log('=== Test 2: Simple tool calling ===');
  try {
    const response = await director.processMessage({
      message: 'Create a simple browser_action node that navigates to https://example.com',
      workflowId,
      conversationHistory: [],
      selectedModel: 'kimi-k2'
    });
    
    console.log('✅ Response:', response.message);
    if (response.toolCalls?.length > 0) {
      console.log('Tool calls made:', response.toolCalls.length);
      response.toolCalls.forEach((tc, i) => {
        console.log(`  ${i + 1}. ${tc.toolName}: ${tc.status}`);
      });
    }
    console.log();
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }
  
  // Test 3: Complex tool chain
  console.log('=== Test 3: Complex tool chain ===');
  try {
    const response = await director.processMessage({
      message: 'Create a workflow sequence with 3 nodes: navigate to google.com, type "hello world" in the search box, and click the search button',
      workflowId,
      conversationHistory: [],
      selectedModel: 'kimi-k2'
    });
    
    console.log('✅ Response:', response.message);
    if (response.toolCalls?.length > 0) {
      console.log('Tool calls made:', response.toolCalls.length);
      response.toolCalls.forEach((tc, i) => {
        console.log(`  ${i + 1}. ${tc.toolName}: ${tc.status}`);
        if (tc.result && tc.toolName === 'create_workflow_sequence') {
          console.log(`     Created ${tc.result.nodeIds?.length || 0} nodes`);
        }
      });
    }
    console.log();
  } catch (error) {
    console.error('❌ Test 3 failed:', error.message);
  }
  
  // Test 4: Model detection
  console.log('=== Test 4: Model detection ===');
  const models = ['kimi-k2', 'moonshotai/kimi-k2', 'o4-mini', 'gpt-4'];
  models.forEach(model => {
    const selected = director.getSelectedModel(model);
    const isKimi = director.isKimiModel(model);
    const isReasoning = director.isReasoningModel(model);
    console.log(`Model: ${model}`);
    console.log(`  Selected: ${selected}`);
    console.log(`  Is KIMI: ${isKimi}`);
    console.log(`  Is Reasoning: ${isReasoning}`);
  });
  
  console.log('\n✅ All tests completed!');
}

testKIMIIntegration().catch(console.error);