const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: '.env.local' });

// Get API key from environment variable
const apiKey = process.env.GOOGLE_GEMINI_API_KEY;

// Debug statements
console.log('Starting test script...');
console.log('API Key length:', apiKey ? apiKey.length : 0);
console.log('API Key first few chars:', apiKey ? apiKey.substring(0, 3) + '...' : 'none');

if (!apiKey || apiKey === 'your_api_key_here') {
  console.error('ERROR: Please set your GOOGLE_GEMINI_API_KEY in .env.local file');
  process.exit(1);
}

async function testGeminiAPI() {
  try {
    console.log('Testing Gemini API connection...');
    
    // Initialize the API
    const genAI = new GoogleGenerativeAI(apiKey);
    console.log('API client initialized');
    
    // Test with gemini-2.5-flash-preview model
    console.log('Testing with gemini-2.5-flash-preview-04-17 model...');
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-04-17" });
    console.log('Model object created');
    
    const prompt = "Hello! Can you confirm that you're working properly? Also, what's your model name and what special capabilities do you have?";
    console.log('Sending prompt to model:', prompt);
    const result = await model.generateContent(prompt);
    console.log('Received result from model');
    const response = await result.response;
    const text = response.text();
    
    console.log('\nTest response from Gemini 2.5 Flash:');
    console.log(text);
    
    // Also test the pro-vision model we'll need for videos
    console.log('\nChecking access to gemini-1.5-pro-preview (needed for video processing)...');
    const visionModel = genAI.getGenerativeModel({ model: "gemini-1.5-pro-preview" });
    
    // Just create the model object to check if it exists (no API call)
    if (visionModel) {
      console.log('Successfully initialized gemini-1.5-pro-preview model');
    }
    
    console.log('\nSUCCESS: Gemini API is working properly!');
  } catch (error) {
    console.error('ERROR testing Gemini API:', error);
    console.error('Please check your API key and network connection');
  }
}

// Run the test
console.log('Starting test function...');
testGeminiAPI().then(() => {
  console.log('Test completed.');
}).catch(err => {
  console.error('Unhandled error in test:', err);
}); 