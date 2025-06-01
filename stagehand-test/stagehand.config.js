import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from both current directory and parent directory
dotenv.config(); // Load from current directory first
dotenv.config({ path: path.join(process.cwd(), '../.env') }); // Then from parent directory

// Map GOOGLE_API_KEY to GEMINI_API_KEY if needed (for compatibility)
if (process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
  process.env.GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
}

// Model configuration based on environment variable
function getModelConfig() {
  const provider = process.env.LLM_PROVIDER || 'google'; // Default to Google since you have the key
  
  switch (provider.toLowerCase()) {
    case 'anthropic':
    case 'claude':
      return {
        modelName: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
        modelClientOptions: {
          apiKey: process.env.ANTHROPIC_API_KEY,
        }
      };
    
    case 'google':
    case 'gemini':
      return {
        modelName: `google/${process.env.GOOGLE_MODEL || "gemini-2.5-flash-preview-05-20"}`, // Add provider prefix
        modelClientOptions: {
          apiKey: process.env.GEMINI_API_KEY, // Uses the correct variable name
        }
      };
    
    case 'openai':
      return {
        modelName: process.env.OPENAI_MODEL || "gpt-4o",
        modelClientOptions: {
          apiKey: process.env.OPENAI_API_KEY,
        }
      };
    
    case 'ollama':
      return {
        modelName: process.env.OLLAMA_MODEL || "llama3.2",
        modelClientOptions: {
          baseURL: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
        }
      };
    
    default:
      // If no provider specified but we have Gemini API key, use Gemini
      if (process.env.GEMINI_API_KEY) {
        return {
          modelName: "google/gemini-2.5-flash-preview-05-20", // Add provider prefix
          modelClientOptions: {
            apiKey: process.env.GEMINI_API_KEY,
          }
        };
      }
      
      // Fallback to OpenAI if available
      if (process.env.OPENAI_API_KEY) {
        return {
          modelName: "gpt-4o",
          modelClientOptions: {
            apiKey: process.env.OPENAI_API_KEY,
          }
        };
      }
      
      throw new Error('No LLM API key found. Please set GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or configure Ollama.');
  }
}

const modelConfig = getModelConfig();

// Log which model is being used
console.log(`🤖 Using LLM: ${modelConfig.modelName} (Provider: ${process.env.LLM_PROVIDER || 'auto-detected'})`);
if (process.env.GEMINI_API_KEY) {
  console.log(`✅ Gemini API Key detected - ready for Gemini 2.5 Flash Preview!`);
}

export default {
  env: process.env.NODE_ENV || 'development',
  
  // Browser configuration
  browserConfig: {
    headless: false, // Always visible
    devtools: true,  // Open DevTools automatically
    slowMo: 750,     // Slow down actions by 750ms for better visibility
    args: [
      '--start-maximized',              // Start browser maximized
      '--no-first-run',                 // Skip first run setup
      '--disable-web-security',         // Allow cross-origin for testing
      '--disable-features=VizDisplayCompositor', // Better rendering
      '--force-device-scale-factor=1',  // Consistent scaling
      '--disable-background-timer-throttling', // Keep animations smooth
      '--disable-renderer-backgrounding', // Keep rendering active
      '--disable-backgrounding-occluded-windows', // Keep window active
    ],
    viewport: {
      width: 1280,
      height: 720,
    },
  },
  
  // LLM configuration
  llmConfig: modelConfig,
  
  // Stagehand configuration
  stagehandConfig: {
    env: process.env.NODE_ENV || 'development',
    verbose: parseInt(process.env.VERBOSE) || 1,
    debugDom: process.env.DEBUG_DOM === 'true',
    
    // Use Browserbase if credentials are provided, otherwise use local browser
    ...(process.env.BROWSERBASE_API_KEY && process.env.BROWSERBASE_PROJECT_ID ? {
      browserbaseApiKey: process.env.BROWSERBASE_API_KEY,
      browserbaseProjectId: process.env.BROWSERBASE_PROJECT_ID,
    } : {
      // Local browser settings
      headless: false,
      devtools: true,
    })
  }
}; 