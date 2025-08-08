import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function testKimiFree() {
  console.log('Testing KIMI K2 Free model...\n');
  
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': 'http://localhost:5173',
      'X-Title': 'Director 2.0'
    }
  });

  // Test 1: Basic completion
  console.log('=== Test 1: Basic Completion ===');
  try {
    const response = await client.chat.completions.create({
      model: 'moonshotai/kimi-k2:free',
      messages: [
        { role: 'user', content: 'Say hello in 3 languages' }
      ],
      temperature: 0.6,
      max_tokens: 100
    });
    
    console.log('✅ Success!');
    console.log('Response:', response.choices[0].message.content);
    console.log('Model:', response.model);
    console.log();
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }

  // Test 2: With system prompt
  console.log('=== Test 2: With System Prompt ===');
  try {
    const response = await client.chat.completions.create({
      model: 'moonshotai/kimi-k2:free',
      messages: [
        { role: 'system', content: 'You are a helpful coding assistant.' },
        { role: 'user', content: 'Write a Python function to reverse a string' }
      ],
      temperature: 0.6,
      max_tokens: 200
    });
    
    console.log('✅ Success!');
    console.log('Response:', response.choices[0].message.content);
    console.log();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  // Test 3: Simple tool use (may not work on free tier)
  console.log('=== Test 3: Tool Use (Testing Limits) ===');
  try {
    const tools = [{
      type: 'function',
      function: {
        name: 'calculate',
        description: 'Calculate a math expression',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Math expression to calculate' }
          },
          required: ['expression']
        }
      }
    }];

    const response = await client.chat.completions.create({
      model: 'moonshotai/kimi-k2:free',
      messages: [
        { role: 'user', content: 'What is 25 + 17?' }
      ],
      tools: tools,
      tool_choice: 'auto',
      temperature: 0.6,
      max_tokens: 100
    });
    
    console.log('✅ Tool calling works on free tier!');
    if (response.choices[0].message.tool_calls) {
      console.log('Tool calls:', JSON.stringify(response.choices[0].message.tool_calls, null, 2));
    } else {
      console.log('Response:', response.choices[0].message.content);
    }
  } catch (error) {
    console.error('❌ Tool calling not supported on free tier');
    console.error('Error:', error.message);
  }

  // Get model list to see what's available
  console.log('\n=== Available KIMI Models ===');
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
      }
    });
    const data = await response.json();
    
    const kimiModels = data.data.filter(model => 
      model.id.toLowerCase().includes('kimi') || 
      model.id.toLowerCase().includes('moonshot')
    );
    
    console.log('KIMI models available:');
    kimiModels.forEach(model => {
      console.log(`- ${model.id}: ${model.name || 'N/A'} (Context: ${model.context_length || 'N/A'})`);
      if (model.pricing) {
        console.log(`  Pricing: $${model.pricing.prompt || 0}/token input, $${model.pricing.completion || 0}/token output`);
      }
    });
  } catch (error) {
    console.error('Could not fetch model list');
  }
}

testKimiFree().catch(console.error);