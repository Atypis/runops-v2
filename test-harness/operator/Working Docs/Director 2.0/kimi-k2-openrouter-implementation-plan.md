# KIMI K2 OpenRouter Implementation Plan

## Overview
This document provides a detailed, step-by-step implementation plan for integrating KIMI K2 into Director 2.0 using the OpenRouter approach. This is the recommended approach due to minimal code changes and unified API management.

## Implementation Phases

### Phase 1: Setup & Configuration (Day 1)

#### 1.1 OpenRouter Account Setup
- [ ] Create OpenRouter account at https://openrouter.ai
- [ ] Generate API key from dashboard
- [ ] Add credits to account (start with $20 for testing)
- [ ] Verify KIMI K2 model availability in model list

#### 1.2 Environment Configuration
```bash
# Add to test-harness/operator/backend/.env
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
OPENROUTER_SITE_URL=http://localhost:5173  # Frontend URL
OPENROUTER_SITE_NAME=Director 2.0

# Optional: Add specific KIMI model version
KIMI_MODEL_ID=moonshotai/kimi-k2
```

#### 1.3 Test OpenRouter Connection
Create a test script `test-harness/operator/backend/scripts/test-openrouter.js`:
```javascript
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

async function testOpenRouter() {
  const client = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_SITE_URL,
      'X-Title': process.env.OPENROUTER_SITE_NAME
    }
  });

  try {
    const response = await client.chat.completions.create({
      model: 'moonshotai/kimi-k2',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: 'Hello, can you confirm you are KIMI K2?' }
      ],
      temperature: 0.6,
      max_tokens: 100
    });

    console.log('Success! Response:', response.choices[0].message.content);
    console.log('Usage:', response.usage);
  } catch (error) {
    console.error('Error:', error);
  }
}

testOpenRouter();
```

### Phase 2: Backend Integration (Day 2-3)

#### 2.1 Update Model Constants
File: `test-harness/operator/backend/services/director.js`

```javascript
// Add to the top with other constants
const KIMI_MODELS = ['kimi-k2', 'moonshotai/kimi-k2'];

// Update model detection functions
const isKimiModel = (model) => {
  return KIMI_MODELS.some(kimiModel => 
    model.toLowerCase().includes(kimiModel.toLowerCase())
  );
};

// Update getSelectedModel function
getSelectedModel(inputModel) {
  const allowedModels = [
    'gpt-4',
    'gpt-4-turbo-preview',
    'gpt-4-turbo',
    'gpt-3.5-turbo',
    'o4-mini',
    'o3',
    'kimi-k2',  // Add KIMI K2
    'moonshotai/kimi-k2'  // Alternative format
  ];
  
  // ... rest of the function
}
```

#### 2.2 Add OpenRouter Client Initialization
In DirectorService constructor:

```javascript
constructor(workflowId) {
  // ... existing code ...
  
  // Initialize OpenRouter client for KIMI models
  if (isKimiModel(this.selectedModel)) {
    this.openRouterClient = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
        'X-Title': process.env.OPENROUTER_SITE_NAME || 'Director 2.0'
      }
    });
    
    // Log for debugging
    logger.info('Initialized OpenRouter client for KIMI K2', {
      model: this.selectedModel,
      workflowId: this.workflowId
    });
  }
}
```

#### 2.3 Create KIMI Processing Method
Add new method to DirectorService:

```javascript
async processWithKIMI() {
  try {
    // Build messages array (same as OpenAI)
    const messages = [
      { role: 'system', content: this.systemPrompt },
      ...this.conversationHistory
    ];

    // Convert tools to OpenAI format (KIMI uses the same format)
    const tools = this.getDirectorTools().map(tool => ({
      type: 'function',
      function: tool.function
    }));

    // Make the API call
    const response = await this.openRouterClient.chat.completions.create({
      model: 'moonshotai/kimi-k2',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.6,  // Recommended for KIMI
      stream: false,
      max_tokens: this.maxTokens || 4096
    });

    // Process the response using existing OpenAI handler
    return await this.processOpenAIStyleResponse(response, messages);
    
  } catch (error) {
    logger.error('Error in KIMI processing:', error);
    
    // Fallback to GPT-4 if KIMI fails
    if (this.enableFallback) {
      logger.info('Falling back to GPT-4 due to KIMI error');
      this.selectedModel = 'gpt-4-turbo';
      return await this.processMessage();
    }
    
    throw error;
  }
}

// Extract common OpenAI response processing
async processOpenAIStyleResponse(response, messages) {
  const assistantMessage = response.choices[0].message;
  
  // Handle tool calls if present
  if (assistantMessage.tool_calls?.length > 0) {
    const toolResults = await this.executeToolCalls(assistantMessage.tool_calls);
    
    // Add assistant message and tool results to messages
    messages.push(assistantMessage);
    messages.push({
      role: 'tool',
      content: JSON.stringify(toolResults),
      tool_call_id: assistantMessage.tool_calls[0].id
    });
    
    // Make follow-up call to get final response
    const finalResponse = await this.openRouterClient.chat.completions.create({
      model: 'moonshotai/kimi-k2',
      messages,
      temperature: 0.6,
      stream: false,
      max_tokens: this.maxTokens || 4096
    });
    
    return {
      content: finalResponse.choices[0].message.content,
      usage: {
        input_tokens: response.usage.prompt_tokens + finalResponse.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens + finalResponse.usage.completion_tokens,
        total_tokens: response.usage.total_tokens + finalResponse.usage.total_tokens
      },
      toolCalls: assistantMessage.tool_calls,
      model: 'kimi-k2'
    };
  }
  
  // No tool calls, return direct response
  return {
    content: assistantMessage.content,
    usage: {
      input_tokens: response.usage.prompt_tokens,
      output_tokens: response.usage.completion_tokens,
      total_tokens: response.usage.total_tokens
    },
    model: 'kimi-k2'
  };
}
```

#### 2.4 Update processMessage Router
In the main `processMessage` method:

```javascript
async processMessage() {
  try {
    // ... existing validation ...
    
    // Route to appropriate processor
    if (isKimiModel(this.selectedModel)) {
      logger.info('Routing to KIMI processor');
      return await this.processWithKIMI();
    } else if (isReasoningModel) {
      logger.info('Using Responses API for reasoning model');
      return await this.processWithResponsesAPI();
    } else {
      logger.info('Using standard Chat Completions API');
      // ... existing OpenAI code ...
    }
  } catch (error) {
    // ... error handling ...
  }
}
```

### Phase 3: Frontend Integration (Day 3)

#### 3.1 Update Model Configuration
File: `test-harness/operator/src/config/models.js`

```javascript
export const AVAILABLE_MODELS = [
  {
    id: 'o4-mini',
    name: 'O4 Mini',
    provider: 'openai',
    category: 'reasoning',
    description: 'Advanced reasoning model'
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    category: 'standard',
    description: 'Latest GPT-4 model'
  },
  {
    id: 'kimi-k2',
    name: 'KIMI K2',
    provider: 'moonshot',
    category: 'standard',
    description: 'Cost-effective model with excellent tool calling',
    badge: 'NEW',
    costInfo: '5x cheaper than GPT-4'
  }
];

export const MODEL_PROVIDERS = {
  openai: { name: 'OpenAI', icon: 'openai-icon' },
  moonshot: { name: 'Moonshot AI', icon: 'moonshot-icon' }
};
```

#### 3.2 Update Model Toggle Component
File: `test-harness/operator/src/components/ModelToggle.jsx`

```javascript
import { AVAILABLE_MODELS, MODEL_PROVIDERS } from '../config/models';

// In the component
const ModelToggle = ({ selectedModel, onModelChange }) => {
  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModel) || AVAILABLE_MODELS[0];
  
  return (
    <div className="model-toggle">
      <select 
        value={selectedModel} 
        onChange={(e) => onModelChange(e.target.value)}
        className="model-select"
      >
        {AVAILABLE_MODELS.map(model => (
          <option key={model.id} value={model.id}>
            {model.name} 
            {model.badge && <span className="badge">{model.badge}</span>}
            {model.costInfo && <span className="cost-info">({model.costInfo})</span>}
          </option>
        ))}
      </select>
      
      <div className="model-info">
        <span className="provider">{MODEL_PROVIDERS[currentModel.provider].name}</span>
        <span className="description">{currentModel.description}</span>
      </div>
    </div>
  );
};
```

#### 3.3 Update API Calls
Ensure the frontend passes the selected model correctly:

```javascript
// In the chat API call
const response = await fetch('/api/director/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: userMessage,
    workflowId,
    conversationHistory,
    selectedModel: 'kimi-k2',  // From model toggle
    mockMode: false
  })
});
```

### Phase 4: Testing & Validation (Day 4-5)

#### 4.1 Unit Tests
Create `test-harness/operator/backend/tests/kimi-integration.test.js`:

```javascript
import { DirectorService } from '../services/director.js';
import { jest } from '@jest/globals';

describe('KIMI K2 Integration', () => {
  let directorService;
  
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    directorService = new DirectorService('test-workflow-id');
    directorService.selectedModel = 'kimi-k2';
  });
  
  test('should initialize OpenRouter client for KIMI model', () => {
    expect(directorService.openRouterClient).toBeDefined();
    expect(directorService.openRouterClient.baseURL).toBe('https://openrouter.ai/api/v1');
  });
  
  test('should correctly identify KIMI models', () => {
    expect(isKimiModel('kimi-k2')).toBe(true);
    expect(isKimiModel('moonshotai/kimi-k2')).toBe(true);
    expect(isKimiModel('gpt-4')).toBe(false);
  });
  
  // Add more tests for tool calling, error handling, etc.
});
```

#### 4.2 Integration Test Checklist
- [ ] Basic message processing without tools
- [ ] Single tool call execution
- [ ] Multiple sequential tool calls
- [ ] Parallel tool calls
- [ ] Error handling and fallback to GPT-4
- [ ] Token counting accuracy
- [ ] Long context handling (test with 100k+ tokens)
- [ ] Response time comparison

#### 4.3 Test Scenarios
Create test workflows for:

1. **Simple Navigation**
   ```javascript
   // Test: Navigate to a website and extract title
   const testCase1 = {
     message: "Navigate to https://example.com and get the page title",
     expectedTools: ['debug_navigate', 'browser_query']
   };
   ```

2. **Complex Tool Chain**
   ```javascript
   // Test: Multi-step workflow with iterations
   const testCase2 = {
     message: "Create a workflow that extracts all email subjects from Gmail and saves them",
     expectedTools: ['create_workflow_sequence', 'create_node', 'execute_nodes']
   };
   ```

3. **Error Recovery**
   ```javascript
   // Test: Handle missing elements gracefully
   const testCase3 = {
     message: "Click the non-existent button and handle the error",
     expectedBehavior: "Should provide helpful error message and suggestions"
   };
   ```

### Phase 5: Optimization & Monitoring (Day 6-7)

#### 5.1 Performance Monitoring
Add logging for KIMI-specific metrics:

```javascript
// In processWithKIMI method
const startTime = Date.now();
const response = await this.openRouterClient.chat.completions.create(...);
const responseTime = Date.now() - startTime;

logger.info('KIMI K2 performance metrics', {
  responseTime,
  inputTokens: response.usage.prompt_tokens,
  outputTokens: response.usage.completion_tokens,
  cost: calculateCost(response.usage),
  toolCallsCount: response.choices[0].message.tool_calls?.length || 0
});
```

#### 5.2 Cost Tracking
Implement cost calculation:

```javascript
function calculateKIMICost(usage) {
  const INPUT_COST_PER_M = 0.15;  // $0.15 per million input tokens
  const OUTPUT_COST_PER_M = 2.50; // $2.50 per million output tokens
  
  const inputCost = (usage.prompt_tokens / 1_000_000) * INPUT_COST_PER_M;
  const outputCost = (usage.completion_tokens / 1_000_000) * OUTPUT_COST_PER_M;
  
  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    savings: calculateSavingsVsGPT4(usage)
  };
}
```

#### 5.3 Error Handling & Fallbacks
Implement robust error handling:

```javascript
class KIMIError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'KIMIError';
    this.code = code;
    this.details = details;
  }
}

// In error handling
catch (error) {
  if (error.response?.status === 429) {
    // Rate limit - wait and retry or fallback
    logger.warn('KIMI rate limit hit, falling back to GPT-4');
    return await this.fallbackToGPT4();
  } else if (error.response?.status === 503) {
    // Service unavailable - immediate fallback
    return await this.fallbackToGPT4();
  } else {
    // Log and re-throw
    logger.error('Unexpected KIMI error', error);
    throw new KIMIError('KIMI processing failed', error.code, error);
  }
}
```

### Phase 6: Production Rollout (Day 8-10)

#### 6.1 Feature Flag Implementation
Add feature flag for gradual rollout:

```javascript
// In director service
const KIMI_ENABLED = process.env.FEATURE_KIMI_ENABLED === 'true';
const KIMI_ROLLOUT_PERCENTAGE = parseInt(process.env.KIMI_ROLLOUT_PERCENTAGE || '0');

function shouldUseKIMI(userId) {
  if (!KIMI_ENABLED) return false;
  
  // Percentage-based rollout
  const userHash = hashUserId(userId);
  return (userHash % 100) < KIMI_ROLLOUT_PERCENTAGE;
}
```

#### 6.2 Monitoring Dashboard
Set up monitoring for:
- Response times by model
- Error rates
- Cost comparison
- Tool calling success rates
- User satisfaction metrics

#### 6.3 Documentation Updates
- Update user documentation
- Add KIMI-specific troubleshooting guide
- Create internal runbook for KIMI issues

### Phase 7: Post-Launch Optimization (Week 2+)

#### 7.1 Prompt Optimization
Based on KIMI's behavior, optimize prompts:

```javascript
// KIMI-specific prompt adjustments
if (isKimiModel(this.selectedModel)) {
  systemPrompt = systemPrompt + '\n\n' + KIMI_SPECIFIC_INSTRUCTIONS;
}

const KIMI_SPECIFIC_INSTRUCTIONS = `
When using tools:
- Be precise with tool parameters
- Prefer single-purpose tool calls over complex chains
- Always validate tool outputs before proceeding
`;
```

#### 7.2 Advanced Features
- Implement KIMI-specific features (e.g., leveraging 128k context)
- Explore batch processing capabilities
- Test specialized use cases

## Success Criteria

### Technical Metrics
- [ ] Response time < 3s for standard requests
- [ ] Tool calling success rate > 95%
- [ ] Error rate < 1%
- [ ] Cost reduction > 50% vs GPT-4

### User Experience
- [ ] Seamless model switching
- [ ] No degradation in output quality
- [ ] Clear error messages when issues occur
- [ ] Consistent behavior across models

## Rollback Plan

If issues arise:
1. Disable KIMI via feature flag immediately
2. Revert to previous model selection
3. Analyze logs for root cause
4. Fix issues in staging environment
5. Re-test thoroughly before re-enabling

## Timeline Summary

- **Day 1**: Setup & Configuration
- **Day 2-3**: Backend Integration
- **Day 3**: Frontend Integration  
- **Day 4-5**: Testing & Validation
- **Day 6-7**: Optimization & Monitoring
- **Day 8-10**: Production Rollout
- **Week 2+**: Post-Launch Optimization

Total estimated time: 10 working days for full production rollout