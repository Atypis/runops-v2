import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from parent directory
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testOpenRouter() {
  console.log('Testing OpenRouter connection with KIMI K2...\n');
  
  // Verify API key is loaded
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('ERROR: OPENROUTER_API_KEY not found in environment variables');
    process.exit(1);
  }
  
  console.log('API Key found:', process.env.OPENROUTER_API_KEY.substring(0, 20) + '...');
  
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'Director 2.0'
    }
  });

  try {
    console.log('Sending test message to KIMI K2...\n');
    
    const response = await client.chat.completions.create({
      model: 'moonshotai/kimi-k2:free',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello! Can you confirm you are KIMI K2 and briefly describe your capabilities?' }
      ],
      temperature: 0.6,
      max_tokens: 200
    });

    console.log('✅ SUCCESS! Connection established.\n');
    console.log('Response:', response.choices[0].message.content);
    console.log('\nUsage:', {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens
    });
    
    // Calculate cost
    const inputCost = (response.usage.prompt_tokens / 1_000_000) * 0.15;
    const outputCost = (response.usage.completion_tokens / 1_000_000) * 2.50;
    const totalCost = inputCost + outputCost;
    
    console.log('\nCost estimate:', {
      inputCost: `$${inputCost.toFixed(6)}`,
      outputCost: `$${outputCost.toFixed(6)}`,
      totalCost: `$${totalCost.toFixed(6)}`
    });
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Test tool calling capability
async function testToolCalling() {
  console.log('\n\n--- Testing Tool Calling Capability ---\n');
  
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
      'X-Title': process.env.OPENROUTER_SITE_NAME || 'Director 2.0'
    }
  });
  
  const tools = [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and country, e.g. "San Francisco, USA"'
            }
          },
          required: ['location']
        }
      }
    }
  ];
  
  try {
    const response = await client.chat.completions.create({
      model: 'moonshotai/kimi-k2:free',
      messages: [
        { role: 'user', content: 'What\'s the weather like in New York?' }
      ],
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.6,
      max_tokens: 200
    });
    
    console.log('✅ Tool calling test successful!\n');
    
    const message = response.choices[0].message;
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log('Tool calls detected:', message.tool_calls.length);
      message.tool_calls.forEach((toolCall, index) => {
        console.log(`\nTool Call ${index + 1}:`);
        console.log('- Function:', toolCall.function.name);
        console.log('- Arguments:', toolCall.function.arguments);
      });
    } else {
      console.log('No tool calls in response (content only):', message.content);
    }
    
  } catch (error) {
    console.error('❌ Tool calling test failed:', error.message);
  }
}

// Run tests
async function runTests() {
  await testOpenRouter();
  await testToolCalling();
  console.log('\n✅ All tests completed!');
}

runTests().catch(console.error);