import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

console.log('=== Testing OpenAI Token Usage ===\n');

// Test 1: Chat Completions API
console.log('1. Testing Chat Completions API (gpt-4o-mini)...');
try {
  const chatResponse = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'Write a short poem about coding.' }
    ]
  });
  
  console.log('Chat Completions Response:');
  console.log('- Message:', chatResponse.choices[0].message.content.substring(0, 100) + '...');
  console.log('- Usage:', JSON.stringify(chatResponse.usage, null, 2));
  console.log();
} catch (error) {
  console.error('Chat Completions Error:', error.message);
}

// Test 2: Responses API with o4-mini
console.log('2. Testing Responses API (o4-mini)...');
try {
  const response = await openai.responses.create({
    model: 'o4-mini',
    instructions: 'You are a helpful assistant.',
    input: [
      {
        type: 'message',
        role: 'user',
        content: 'Write a short poem about coding.'
      }
    ],
    reasoning: { 
      effort: 'medium', 
      summary: 'detailed'
    },
    stream: false // Non-streaming first to see structure
  });
  
  console.log('Responses API Response:');
  console.log('- Message:', response.output[0]?.content?.[0]?.text?.substring(0, 100) + '...');
  console.log('- Usage:', JSON.stringify(response.usage, null, 2));
  console.log('- Full Response Structure:', JSON.stringify(response, null, 2));
  console.log();
} catch (error) {
  console.error('Responses API Error:', error.message);
}

// Test 3: Streaming Responses API
console.log('3. Testing Streaming Responses API (o4-mini)...');
try {
  const streamResponse = await openai.responses.create({
    model: 'o4-mini',
    instructions: 'You are a helpful assistant.',
    input: [
      {
        type: 'message',
        role: 'user',
        content: 'Write a short poem about coding.'
      }
    ],
    reasoning: { 
      effort: 'medium', 
      summary: 'detailed'
    },
    stream: true
  });
  
  let tokenUsage = null;
  const events = [];
  
  for await (const event of streamResponse) {
    events.push(event.type);
    
    // Check multiple event types for token usage
    if (event.type === 'response.done') {
      console.log('Streaming response.done event:', JSON.stringify(event, null, 2));
      tokenUsage = event.response?.usage;
    } else if (event.type === 'response.completed' || event.type === 'response.complete') {
      console.log('Streaming completion event:', JSON.stringify(event, null, 2));
      tokenUsage = event.response?.usage || event.usage;
    } else if (event.usage) {
      console.log(`Token usage found in ${event.type}:`, JSON.stringify(event.usage, null, 2));
      tokenUsage = event.usage;
    }
    
    // Log a few sample events to see structure
    if (events.length <= 5) {
      console.log(`Event ${events.length} (${event.type}):`, JSON.stringify(event, null, 2));
    }
  }
  
  console.log('Streaming Events:', events);
  console.log('Final Token Usage:', JSON.stringify(tokenUsage, null, 2));
  
} catch (error) {
  console.error('Streaming Responses API Error:', error.message);
}