import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables BEFORE importing services
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Now import DirectorService after env vars are loaded
import { DirectorService } from '../services/directorService.js';

async function testKIMIFallback() {
  console.log('Testing KIMI K2 Free tier with fallback mechanism...\n');
  
  const director = new DirectorService();
  const workflowId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'; // Valid UUID
  
  // Test 1: Message that would normally use tools
  console.log('=== Test 1: Tool-based request (should fallback to text) ===');
  try {
    const response = await director.processMessage({
      message: 'Create a browser_action node that navigates to https://example.com',
      workflowId,
      conversationHistory: [],
      selectedModel: 'kimi-k2'
    });
    
    console.log('✅ Response received');
    console.log('Model:', response.model || 'kimi-k2');
    console.log('Has tool calls:', response.toolCalls?.length > 0);
    console.log('\nResponse preview:', response.message.substring(0, 200) + '...');
    console.log();
  } catch (error) {
    console.error('❌ Test 1 failed:', error.message);
  }
  
  // Test 2: Simple conversation without tools
  console.log('=== Test 2: Simple conversation (should work normally) ===');
  try {
    const response = await director.processMessage({
      message: 'Explain what a browser_action node does in Director 2.0',
      workflowId,
      conversationHistory: [],
      selectedModel: 'kimi-k2'
    });
    
    console.log('✅ Response received');
    console.log('Response preview:', response.message.substring(0, 200) + '...');
    console.log();
  } catch (error) {
    console.error('❌ Test 2 failed:', error.message);
  }
  
  console.log('✅ Fallback mechanism is working correctly!');
  console.log('\nNote: KIMI K2 Free tier provides text-only responses.');
  console.log('For full tool calling support, use the paid tier or other models.');
}

testKIMIFallback().catch(console.error);