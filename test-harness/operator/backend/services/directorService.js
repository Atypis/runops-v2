import OpenAI from 'openai';
import { Stagehand } from '@browserbasehq/stagehand';
import { directorPromptV4 as DIRECTOR_SYSTEM_PROMPT } from '../prompts/directorPromptV4.js';
import { CLEAN_DIRECTOR_SYSTEM_PROMPT } from '../prompts/cleanDirectorPrompt.js';
import { createToolDefinitions } from '../tools/toolDefinitionsV2.js';
import { NodeExecutor } from './nodeExecutor.js';
import { PlanService } from './planService.js';
import { WorkflowDescriptionService } from './workflowDescriptionService.js';
import { VariableManagementService } from './variableManagementService.js';
import { TokenCounterService } from './tokenCounterService.js';
import BrowserStateService from './browserStateService.js';
import { ConversationService } from './conversationService.js';
import domToolkitService from './domToolkitService.js';
import { supabase } from '../config/supabase.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DirectorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    // Initialize OpenRouter client for KIMI models
    this.openRouterClient = null;
    if (process.env.OPENROUTER_API_KEY) {
      this.openRouterClient = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        defaultHeaders: {
          'HTTP-Referer': process.env.OPENROUTER_SITE_URL || 'http://localhost:5173',
          'X-Title': process.env.OPENROUTER_SITE_NAME || 'Director 2.0'
        }
      });
    }
    
    // Create shared instances
    this.browserStateService = new BrowserStateService();
    this.nodeExecutor = new NodeExecutor(this.browserStateService); // Pass shared instance
    this.planService = new PlanService();
    this.workflowDescriptionService = new WorkflowDescriptionService();
    this.variableManagementService = new VariableManagementService();
    this.tokenCounter = new TokenCounterService();
    this.conversationService = new ConversationService();
    this.supabase = supabase;
    
    // SSE connections for live tool call streaming
    this.toolCallSSEConnections = new Map(); // workflowId -> [response objects]
    
    // Track active executions for cancellation support
    this.activeExecutions = new Map(); // workflowId -> { abortController, startTime, responseId }
  }

  // SSE connection management methods for tool call streaming
  addToolCallSSEConnection(workflowId, res) {
    if (!this.toolCallSSEConnections.has(workflowId)) {
      this.toolCallSSEConnections.set(workflowId, []);
    }
    this.toolCallSSEConnections.get(workflowId).push(res);
  }

  removeToolCallSSEConnection(workflowId, res) {
    const connections = this.toolCallSSEConnections.get(workflowId);
    if (connections) {
      const index = connections.indexOf(res);
      if (index > -1) {
        connections.splice(index, 1);
      }
      if (connections.length === 0) {
        this.toolCallSSEConnections.delete(workflowId);
      }
    }
  }

  async emitToolCallEvent(workflowId, event) {
    const connections = this.toolCallSSEConnections.get(workflowId) || [];
    const deadConnections = [];
    
    for (const res of connections) {
      try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      } catch (error) {
        deadConnections.push(res);
      }
    }
    
    // Clean up dead connections
    deadConnections.forEach(conn => this.removeToolCallSSEConnection(workflowId, conn));
  }

  // Execution tracking methods for cancellation support
  startExecution(workflowId) {
    const abortController = new AbortController();
    this.activeExecutions.set(workflowId, {
      abortController,
      startTime: Date.now(),
      responseId: null
    });
    return abortController.signal;
  }

  cancelExecution(workflowId) {
    const execution = this.activeExecutions.get(workflowId);
    if (execution) {
      execution.abortController.abort();
      this.activeExecutions.delete(workflowId);
      return true;
    }
    return false;
  }

  getActiveExecution(workflowId) {
    return this.activeExecutions.get(workflowId);
  }

  async saveConversationMessages(workflowId, userMessage, assistantResponse) {
    try {
      // Save user message
      if (userMessage) {
        await this.conversationService.saveMessage(workflowId, 'user', userMessage);
      }
      
      // Save assistant response with metadata
      if (assistantResponse) {
        const metadata = {};
        if (assistantResponse.toolCalls) metadata.toolCalls = assistantResponse.toolCalls;
        if (assistantResponse.reasoning_summary) metadata.reasoning = assistantResponse.reasoning_summary;
        if (assistantResponse.input_tokens || assistantResponse.output_tokens) {
          metadata.tokenUsage = {
            input_tokens: assistantResponse.input_tokens,
            output_tokens: assistantResponse.output_tokens
          };
        }
        if (assistantResponse.debug_input) metadata.debug_input = assistantResponse.debug_input;
        
        await this.conversationService.saveMessage(
          workflowId, 
          'assistant', 
          assistantResponse.message,
          metadata,
          assistantResponse.responseId
        );
      }
    } catch (error) {
      console.error('Error saving conversation messages:', error);
      // Don't throw - we don't want to break the chat flow
    }
  }

  async processMessage({ message, workflowId, conversationHistory = [], mockMode = false, isCompressionRequest = false, selectedModel }) {
    // Check feature flag for Clean Context 2.0
    if (process.env.CLEAN_CONTEXT_ENABLED === 'true') {
      return this.processMessageClean({ message, workflowId, conversationHistory, mockMode, isCompressionRequest, selectedModel });
    } else {
      return this.legacyProcessMessage({ message, workflowId, conversationHistory, mockMode, isCompressionRequest, selectedModel });
    }
  }

  async legacyProcessMessage({ message, workflowId, conversationHistory = [], mockMode = false, isCompressionRequest = false, selectedModel }) {
    try {
      // Set workflow ID in node executor for browser state tracking
      this.nodeExecutor.setWorkflowId(workflowId);
      // Check for mock mode
      if (mockMode || process.env.MOCK_DIRECTOR_MODE === 'true') {
        console.log('\n[MOCK DIRECTOR] Received message:', message);
        console.log('[MOCK DIRECTOR] Workflow ID:', workflowId);
        console.log('[MOCK DIRECTOR] Reading response from mock-director/response.json\n');
        
        try {
          const mockResponsePath = path.join(__dirname, '../../mock-director/response.json');
          const mockResponseData = await fs.readFile(mockResponsePath, 'utf-8');
          const mockResponse = JSON.parse(mockResponseData);
          
          // Group definitions removed - using group node type instead
          
          // If there are tool calls in the mock response, process them
          if (mockResponse.toolCalls) {
            const processedToolCalls = await this.processToolCalls(
              mockResponse.toolCalls.map(tc => ({
                id: tc.toolCallId || `mock_${Date.now()}`,
                function: {
                  name: tc.toolName,
                  arguments: JSON.stringify(tc.result || {})
                }
              })),
              workflowId
            );
            
            const response = {
              message: mockResponse.message || 'Mock operator response',
              toolCalls: processedToolCalls,
              workflowId,
              mockMode: true
            };
            await this.saveConversationMessages(workflowId, message, response);
            return response;
          }
          
          const response = {
            message: mockResponse.message || 'Mock operator response',
            workflowId,
            mockMode: true
          };
          await this.saveConversationMessages(workflowId, message, response);
          return response;
        } catch (error) {
          console.error('[MOCK OPERATOR] Error reading mock response:', error);
          return {
            message: 'Mock operator error: Please check mock-operator/response.json',
            workflowId,
            mockMode: true,
            error: error.message
          };
        }
      }

      // Normal operation - Build Director 2.0 context if workflowId provided
      // Skip for compression requests as context is already in the prompt
      let director2Context = '';
      if (workflowId && !isCompressionRequest) {
        director2Context = await this.buildDirector2Context(workflowId);
      }

      // Clean conversation history to only include essential fields for AI
      // This prevents exponential token growth from debug_input and other UI-only fields
      const cleanHistory = conversationHistory
        .filter(msg => !msg.isArchived) // Filter out archived messages
        .map((msg, idx) => {
          // Log if we find director2Context in historical messages
          if (msg.content && msg.content.includes('(2) CURRENT PLAN')) {
            console.log(`[🔍 CONTEXT_STRIP] Found director2Context in history at index ${idx} (${msg.role}), stripping it...`);
            console.log(`[🔍 CONTEXT_STRIP] Original length: ${msg.content.length}, After strip: ${msg.content.split('\n\n(2) CURRENT PLAN')[0].trim().length}`);
          }
          
          return {
            role: msg.role,
            // CRITICAL: Strip any existing director2Context from historical messages to prevent duplication
            content: msg.content ? msg.content.split('\n\n(2) CURRENT PLAN')[0].trim() : msg.content
            // Intentionally exclude: toolCalls, reasoning, tokenUsage, debug_input
          };
        })
        .filter(msg => msg.content !== null && msg.content !== undefined);

      // Check if the current message already has director2Context
      if (message && message.includes('(2) CURRENT PLAN')) {
        console.log(`[🔍 CURRENT_MESSAGE_WARNING] Current message ALREADY contains director2Context!`);
        console.log(`[🔍 CURRENT_MESSAGE_WARNING] This should not happen - frontend may be sending modified messages`);
      }
      
      // Build messages array with cleaned history
      const messages = [
        { role: 'system', content: DIRECTOR_SYSTEM_PROMPT },
        ...cleanHistory,
        { role: 'user', content: message }
      ];

      // Add Director 2.0 context to the latest message if available
      if (director2Context) {
        console.log(`[🔍 DIRECTOR_CONTEXT_DEBUG] Adding director2Context of length ${director2Context.length} to message at index ${messages.length - 1}`);
        console.log(`[🔍 DIRECTOR_CONTEXT_DEBUG] Historical messages have been stripped of any previous director2Context`);
        messages[messages.length - 1].content += `\n\n${director2Context}`;
      }
      
      // Add available environment variables for Gmail
      if (message.toLowerCase().includes('gmail') || message.toLowerCase().includes('google')) {
        messages[messages.length - 1].content += `\n\nAvailable credentials:\nGMAIL_EMAIL: ${process.env.GMAIL_EMAIL}\nGMAIL_PASSWORD: ${process.env.GMAIL_PASSWORD}`;
      }

      // Get model for this workflow - default to o4-mini for reasoning capabilities
      const model = this.getSelectedModel(selectedModel);
      
      // 🔍 INTERCEPTOR: Log exact OpenAI input for debugging
      const debugInput = {
        messages: messages,
        model: model,
        modelSource: selectedModel ? 'ui' : (process.env.DIRECTOR_MODEL ? 'env' : 'default'),
        total_chars: JSON.stringify(messages).length,
        total_messages: messages.length,
        message_breakdown: messages.map((m, i) => ({
          index: i,
          role: m.role,
          content_length: m.content ? m.content.length : 0,
          content_preview: m.content ? m.content.substring(0, 200) + (m.content.length > 200 ? '...' : '') : 'null'
        })),
        timestamp: new Date().toISOString()
      };
      
      console.log('[🔍 OPENAI_INTERCEPTOR] Exact input being sent:');
      console.log('[🔍 OPENAI_INTERCEPTOR] Model:', model);
      console.log('[🔍 OPENAI_INTERCEPTOR] Model Source:', debugInput.modelSource);
      console.log('[🔍 OPENAI_INTERCEPTOR] Message count:', messages.length);
      console.log('[🔍 OPENAI_INTERCEPTOR] Total characters:', JSON.stringify(messages).length);
      console.log('[🔍 OPENAI_INTERCEPTOR] Message breakdown:');
      debugInput.message_breakdown.forEach(m => {
        console.log(`  [${m.index}] ${m.role}: ${m.content_length} chars - "${m.content_preview}"`);
      });
      
      // Route to appropriate API based on model type
      let completion;
      if (this.isKimiModel(model)) {
        console.log(`[DIRECTOR] Using OpenRouter for KIMI model: ${model}`);
        completion = await this.processWithKIMI(model, messages, workflowId);
      } else if (this.isReasoningModel(model)) {
        console.log(`[DIRECTOR] Using Responses API for reasoning model: ${model}`);
        if (model === 'o3') {
          console.log(`[DIRECTOR] Background mode will be enabled for o3 to handle rate limits gracefully`);
        }
        completion = await this.processWithResponsesAPI(model, messages, workflowId);
      } else {
        console.log(`[DIRECTOR] Using Chat Completions API for model: ${model}`);
        completion = await this.openai.chat.completions.create({
          model,
          messages,
          tools: createToolDefinitions(),
          tool_choice: 'auto',
          temperature: 1
        });
      }

      const responseMessage = completion.choices[0].message;
      
      // Record token usage for this conversation
      // NOTE: For reasoning models with tool execution, this only records the INITIAL message tokens
      // not the accumulated tokens from recursive tool execution calls
      if (workflowId && completion.usage) {
        this.tokenCounter.recordUserMessage(workflowId, message);
        this.tokenCounter.recordTokenUsage(workflowId, completion.usage, 'assistant');
        console.log('[DIRECTOR] Token usage recorded for initial message (excludes internal tool execution tokens)');
      }
      
      // Check if this is a reasoning model response (has reasoning token usage)
      const isReasoningResponse = completion.usage && completion.usage.reasoning_tokens > 0;
      
      // Process any tool calls from traditional Chat Completions API
      if (responseMessage.tool_calls) {
        const toolResults = await this.processToolCalls(responseMessage.tool_calls, workflowId);
        
        const response = {
          message: responseMessage.content || '',  // Default to empty string if null
          toolCalls: toolResults,
          workflowId,
          input_tokens: completion.usage?.input_tokens || 0,
          output_tokens: completion.usage?.output_tokens || 0,
          debug_input: debugInput
        };
        await this.saveConversationMessages(workflowId, message, response);
        return response;
      }
      
      // Handle tools executed during reasoning (from Responses API)
      if (completion.executedTools && completion.executedTools.length > 0) {
        console.log(`[DIRECTOR] Reasoning model executed ${completion.executedTools.length} tools`);
        
        // Convert executed tools to the expected format for consistent response
        const toolResults = completion.executedTools.map(tool => ({
          toolName: tool.name,
          result: tool.result || { error: tool.error },
          success: !tool.error
        }));
        
        // Enhance the message with tool execution details if content is generic
        let finalMessage = responseMessage.content;
        if (!finalMessage || finalMessage.includes("completed the necessary actions")) {
          const toolNames = completion.executedTools.map(t => t.name).join(', ');
          finalMessage = `I've executed the following tools during reasoning: ${toolNames}. ` + 
                        (responseMessage.content || "Check the workflow for updates.");
        }
        
        const response = {
          message: finalMessage,
          toolCalls: toolResults,
          workflowId,
          reasoning_summary: completion.reasoning_summary,
          input_tokens: completion.usage?.input_tokens || 0,
          output_tokens: completion.usage?.output_tokens || 0,
          debug_input: debugInput
        };
        await this.saveConversationMessages(workflowId, message, response);
        return response;
      }

      // For reasoning models, provide better feedback when no visible content
      let finalMessage = responseMessage.content;
      if (!finalMessage) {
        if (isReasoningResponse) {
          finalMessage = "I've analyzed the request and completed the necessary actions. Check the workflow for any new nodes or updates.";
        } else {
          finalMessage = "I've completed the requested actions.";
        }
      }

      const response = {
        message: finalMessage,
        workflowId,
        reasoning_summary: completion.reasoning_summary,
        // THIS IS THE TOTAL INPUT TOKENS SENT TO THE API (includes both cached and uncached)
        input_tokens: completion.usage?.input_tokens || 0,
        output_tokens: completion.usage?.output_tokens || 0,
        debug_input: debugInput
      };
      await this.saveConversationMessages(workflowId, message, response);
      return response;
    } catch (error) {
      console.error('Error processing message:', error);
      throw error;
    }
  }

  async processResponsesAPIWithControlLoop(response, workflowId, model, previousResponseId, accumulatedToolResults = [], signal, isCompressionRequest = false) {
    // Process the response from the Responses API
    const output = response.output || [];
    
    // Debug log the raw response structure (truncate if too long)
    const outputStr = JSON.stringify(output, null, 2);
    if (outputStr.length > 1000) {
      console.log('[RESPONSES API] Raw output structure (truncated):', outputStr.substring(0, 1000) + '...');
    } else {
      console.log('[RESPONSES API] Raw output structure:', outputStr);
    }
    
    // Extract assistant messages
    const assistantMessages = output.filter(item => item.type === 'message' && item.role === 'assistant');
    const assistantContent = assistantMessages
      .flatMap(msg => msg.content || [])
      .map(content => content.text || '')
      .join('');
    
    // Extract function calls - check for tool_calls in assistant messages
    let functionCallItems = [];
    
    // First check if function calls are in the output array directly
    functionCallItems = output.filter(item => item.type === 'function_call');
    
    // If not, check if they're nested in assistant messages
    if (functionCallItems.length === 0) {
      for (const msg of assistantMessages) {
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
          console.log('[RESPONSES API] Found tool_calls in assistant message:', JSON.stringify(msg.tool_calls, null, 2));
          functionCallItems = msg.tool_calls;
          break;
        }
      }
    }
    
    // Extract reasoning summary
    const reasoningItems = output.filter(item => item.type === 'reasoning' && item.summary);
    const reasoningSummary = reasoningItems.length > 0 ? 
      reasoningItems.map(item => item.summary.map(s => s.text).join('\n')).join('\n\n') : 
      null;
    
    // Get token usage
    const tokenUsage = {
      input_tokens: response.usage?.input_tokens || 0,
      output_tokens: response.usage?.output_tokens || 0,
      total_tokens: response.usage?.total_tokens || 0,
      reasoning_tokens: response.usage?.output_tokens_details?.reasoning_tokens || 0
    };
    
    // Process tool calls if any
    let toolResults = [];
    let toolOutputs = [];
    
    if (functionCallItems.length > 0) {
      console.log(`[CLEAN CONTEXT] Processing ${functionCallItems.length} tool calls`);
      
      // Execute tools and prepare outputs for Responses API
      for (const callItem of functionCallItems) {
        // Check for cancellation before each tool
        if (signal?.aborted) {
          console.log('[CLEAN CONTEXT] Tool execution cancelled by user');
          // Mark the response as cancelled before throwing
          if (responseId) {
            await this.saveResponseId(workflowId, responseId, 'cancelled');
          }
          throw new Error('Tool execution cancelled by user');
        }
        
        // Extract the correct fields based on the structure
        // IMPORTANT: Use call_id, not id!
        const callId = callItem.call_id;  // This is what OpenAI expects back
        const toolName = callItem.function?.name || callItem.name;
        const argumentsStr = callItem.function?.arguments || callItem.arguments;
        
        console.log(`[TOOL_EXECUTION] Processing tool call:`, {
          callId,
          toolName,
          argumentsStr,
          callItemStructure: JSON.stringify(callItem, null, 2)
        });
        
        // Guard against missing fields
        if (!callId || !toolName) {
          console.error(`[TOOL_EXECUTION] Missing required fields - callId: ${callId}, toolName: ${toolName}`);
          continue;
        }
        
        try {
          // Guard against undefined arguments
          if (!argumentsStr || argumentsStr.trim() === 'undefined' || argumentsStr.trim() === '') {
            throw new Error('Tool call has empty or undefined arguments');
          }
          
          const toolArgs = JSON.parse(argumentsStr);
          
          console.log(`[TOOL_EXECUTION] Executing ${toolName} with call_id ${callId}`);
          
          // Create tool call item in expected format for executeToolCall
          const toolCallItem = {
            name: toolName,
            arguments: argumentsStr,  // Pass the string, executeToolCall will parse it
            call_id: callId
          };
          
          // Use existing tool execution logic
          const result = await this.executeToolCall(toolCallItem, workflowId);
          
          // Add to results for our response
          toolResults.push({
            toolName,
            result,
            success: true
          });
          
          // Prepare tool output for Responses API
          // The output must be a string, max 512 tokens
          let outputString;
          
          // Check if result has a pre-formatted output string (DOM toolkit methods)
          if (result.output && typeof result.output === 'string') {
            outputString = result.output;
          } else {
            // Otherwise stringify the result
            outputString = JSON.stringify(result);
          }
          
          toolOutputs.push({
            type: 'function_call_output',
            call_id: callId,
            output: outputString
          });
        } catch (error) {
          console.error(`[CLEAN CONTEXT] Tool ${toolName} failed:`, error);
          
          // Add to results for our response
          toolResults.push({
            toolName,
            error: error.message,
            success: false
          });
          
          // Still need to provide output to Responses API even on error
          toolOutputs.push({
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({ error: error.message })
          });
        }
      }
      
      // If we have tool outputs, we need to continue the conversation with them
      if (toolOutputs.length > 0 && response.id) {
        // Check if we were cancelled during tool execution
        if (signal?.aborted) {
          console.log('[CLEAN CONTEXT] Skipping tool output submission due to cancellation');
          // Mark the original response as cancelled
          if (responseId) {
            await this.saveResponseId(workflowId, responseId, 'cancelled');
          }
          throw new Error('Tool execution cancelled by user');
        }
        
        try {
          console.log(`[CLEAN CONTEXT] Submitting ${toolOutputs.length} tool outputs`);
          // Log tool outputs (truncate if too long)
          const toolOutputsStr = JSON.stringify(toolOutputs, null, 2);
          if (toolOutputsStr.length > 1000) {
            console.log('[CLEAN CONTEXT] Tool outputs structure (truncated):', toolOutputsStr.substring(0, 1000) + '...');
          } else {
            console.log('[CLEAN CONTEXT] Tool outputs structure:', toolOutputsStr);
          }
          
          // Convert tools for Responses API
          const responsesTools = this.convertToolsForResponsesAPI(createToolDefinitions());
          
          // Create a new request with tool outputs
          const toolResponseParams = {
            model: model || 'o4-mini',
            instructions: CLEAN_DIRECTOR_SYSTEM_PROMPT,
            input: toolOutputs,
            tools: responsesTools,
            store: true,
            previous_response_id: response.id
          };
          
          // Make the follow-up request with tool outputs
          const toolResponse = await this.openai.responses.create(toolResponseParams);
          
          // Don't save intermediate response IDs - they will be saved at the top level
          // when the entire conversation turn is complete
          console.log(`[CLEAN CONTEXT] Processing tool response: ${toolResponse.id}`);
          
          // Process the response recursively, passing accumulated tool results
          const allToolResults = [...accumulatedToolResults, ...toolResults];
          return await this.processResponsesAPIWithControlLoop(toolResponse, workflowId, model, toolResponse.id, allToolResults, signal, isCompressionRequest);
        } catch (error) {
          console.error('[CLEAN CONTEXT] Error submitting tool outputs:', error);
          // Fall through to return current results
        }
      }
    }
    
    // Combine accumulated results with current results
    const allToolResults = [...accumulatedToolResults, ...toolResults];
    
    // Save response ID only if this is a final response (no pending tool calls) AND not a compression request
    // This prevents intermediate tool responses from being used as conversation checkpoints
    if (!isCompressionRequest) {
      if (response.id && functionCallItems.length === 0) {
        // This is a final response with no more tool calls
        await this.saveResponseId(workflowId, response.id, 'completed');
        console.log('[CLEAN CONTEXT] Saved final response ID (no pending tools):', response.id);
      } else if (response.id && functionCallItems.length > 0 && signal?.aborted) {
        // Cancelled during tool execution
        await this.saveResponseId(workflowId, response.id, 'cancelled');
        console.log('[CLEAN CONTEXT] Saved cancelled response ID:', response.id);
      }
    } else {
      console.log('[CLEAN CONTEXT] Skipping response ID save for compression request');
    }
    
    // Prepare response
    const finalResponse = {
      message: assistantContent || 'I completed the requested actions.',
      workflowId,
      reasoning_summary: reasoningSummary,
      input_tokens: tokenUsage.input_tokens,
      output_tokens: tokenUsage.output_tokens,
      reasoning_tokens: tokenUsage.reasoning_tokens,
      responseId: response.id  // Include the final response ID
    };
    
    if (allToolResults.length > 0) {
      finalResponse.toolCalls = allToolResults;
    }
    
    return finalResponse;
  }

  async processMessageClean({ message, workflowId, conversationHistory = [], mockMode = false, isCompressionRequest = false, selectedModel, forkFromResponseId = null }) {
    // Start execution tracking for cancellation support
    const signal = this.startExecution(workflowId);
    
    try {
      console.log('[CLEAN CONTEXT] Processing message with Clean Context 2.0');
      
      // Set workflow ID in node executor for browser state tracking
      this.nodeExecutor.setWorkflowId(workflowId);
      
      // Save the user message first (unless it's a compression request)
      if (!isCompressionRequest) {
        await this.saveConversationMessages(workflowId, message, null);
      }
      
      // Handle mock mode (same as legacy)
      if (mockMode || process.env.MOCK_DIRECTOR_MODE === 'true') {
        // ... mock mode handling (same as legacy)
        return this.legacyProcessMessage({ message, workflowId, conversationHistory, mockMode, isCompressionRequest, selectedModel });
      }

      // Check if this is a KIMI model that needs special handling
      if (this.isKimiModel(selectedModel)) {
        console.log('[CLEAN CONTEXT] KIMI model detected, routing to legacy handler');
        // KIMI models aren't supported by Responses API yet, use legacy handler
        return this.legacyProcessMessage({ message, workflowId, conversationHistory, mockMode, isCompressionRequest, selectedModel });
      }
      
      // Determine if using background mode
      const useBackgroundMode = selectedModel === 'o3';
      
      // Get previous response ID for stateful context
      // Use forkFromResponseId if provided (for message editing), otherwise get the last completed one
      let previousResponseId;
      if (isCompressionRequest) {
        // Compression requests should start fresh - no previous context
        previousResponseId = null;
        console.log('[CLEAN CONTEXT] Compression request - starting fresh with no previous response ID');
      } else {
        previousResponseId = forkFromResponseId || await this.getLastCompletedResponseId(workflowId);
        console.log('[CLEAN CONTEXT] Previous response ID:', previousResponseId || 'None (fresh start)');
        if (forkFromResponseId) {
          console.log('[CLEAN CONTEXT] Forking from specified response ID:', forkFromResponseId);
        }
      }
      
      // Convert tools to Responses API format
      const responsesTools = this.convertToolsForResponsesAPI(createToolDefinitions());
      
      // Build request params
      const requestParams = {
        model: selectedModel || 'gpt-4o',
        instructions: CLEAN_DIRECTOR_SYSTEM_PROMPT,
        input: [{ type: 'message', role: 'user', content: message }],
        tools: responsesTools,
        stream: false,
        store: true  // Always store for stateful context
      };
      
      // Check if we need to inject context after compression
      if (!previousResponseId && !isCompressionRequest) {
        console.log('[CLEAN CONTEXT] No previous response ID - checking for compression context');
        const enrichedContent = await this.buildPostCompressionContext(workflowId, message);
        if (enrichedContent) {
          requestParams.input[0].content = enrichedContent;
          console.log('[CLEAN CONTEXT] Injected post-compression context');
          console.log('[CLEAN CONTEXT] Original message length:', message.length);
          console.log('[CLEAN CONTEXT] Enriched content length:', enrichedContent.length);
        } else {
          console.log('[CLEAN CONTEXT] No compression context to inject');
        }
      }
      
      // Add previous response ID if available
      if (previousResponseId) {
        requestParams.previous_response_id = previousResponseId;
      }
      
      // Add background mode config for o3
      if (useBackgroundMode) {
        requestParams.background = true;
        console.log('[CLEAN CONTEXT] Using background mode for o3');
      }
      
      // Make API request with signal support
      const response = await this.callOpenAIWithSignal(requestParams, signal, 'responses');
      
      // Handle background job polling if needed
      let finalResponse = response;
      if (useBackgroundMode && response.id && response.status) {
        console.log('[CLEAN CONTEXT] Polling background job:', response.id);
        finalResponse = await this.pollBackgroundJob(response.id, workflowId);
      }
      
      // Process response with control loop
      const result = await this.processResponsesAPIWithControlLoop(finalResponse, workflowId, selectedModel, previousResponseId, [], signal, isCompressionRequest);
      
      // The response saving is now handled within processResponsesAPIWithControlLoop
      // to ensure we only save responses that don't have pending tool calls
      
      // Save the assistant response (unless it's a compression request)
      if (!isCompressionRequest) {
        await this.saveConversationMessages(workflowId, null, result);
      }
      
      return result;
    } catch (error) {
      if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('cancelled by user')) {
        console.log('[CLEAN CONTEXT] Request cancelled by user');
        
        // If we have a response ID from before the cancellation, mark it as cancelled
        if (response?.id) {
          await this.saveResponseId(workflowId, response.id, 'cancelled');
          console.log('[CLEAN CONTEXT] Marked response as cancelled:', response.id);
        }
        
        return {
          message: 'Request cancelled by user',
          cancelled: true,
          workflowId
        };
      }
      console.error('[CLEAN CONTEXT] Error in processMessageClean:', error);
      throw error;
    } finally {
      // Clean up execution tracking
      this.activeExecutions.delete(workflowId);
    }
  }

  // Removed processToolCalls method - all tool handling is now in executeToolCall
  // Removed createWorkflowSequence - use create_node with array instead

  generateNodeAlias(text) {
    // Convert to lowercase and replace non-alphanumeric with underscores
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .substring(0, 50); // Limit length
  }

  async insertNodeAt(args, workflowId) {
    // Handle multiple nodes insertion
    if (args.nodes && Array.isArray(args.nodes)) {
      const { position, nodes } = args;
      console.log(`[INSERT_NODE_AT] Inserting ${nodes.length} nodes starting at position ${position}`);
      
      // Calculate how many positions we need to shift
      const shiftAmount = nodes.length;
      
      // Get all nodes at or after the target position
      const { data: nodesToShift, error: fetchError } = await supabase
        .from('nodes')
        .select('id, position')
        .eq('workflow_id', workflowId)
        .gte('position', position)
        .order('position', { ascending: false });
      
      if (fetchError) {
        console.error('[INSERT_NODE_AT] Error fetching nodes:', fetchError);
        throw fetchError;
      }
      
      console.log(`[INSERT_NODE_AT] Found ${nodesToShift?.length || 0} nodes to shift by ${shiftAmount} positions`);
      
      // Shift each node up by the number of nodes we're inserting
      for (const nodeToShift of nodesToShift || []) {
        const { error: updateError } = await supabase
          .from('nodes')
          .update({ position: nodeToShift.position + shiftAmount })
          .eq('id', nodeToShift.id);
        
        if (updateError) {
          console.error(`[INSERT_NODE_AT] Error shifting node ${nodeToShift.id}:`, updateError);
          throw updateError;
        }
      }
      
      // Create all new nodes at consecutive positions
      const createdNodes = [];
      for (let i = 0; i < nodes.length; i++) {
        const node = await this.createNode({
          ...nodes[i],
          position: position + i
        }, workflowId);
        createdNodes.push(node);
      }
      
      console.log(`[INSERT_NODE_AT] Created ${createdNodes.length} nodes starting at position ${position}`);
      return {
        message: `Inserted ${createdNodes.length} nodes at position ${position}`,
        nodes: createdNodes
      };
    }
    
    // Single node insertion (original behavior)
    const { position, node } = args;
    console.log(`[INSERT_NODE_AT] Inserting node at position ${position}`);
    
    // First, get all nodes at or after the target position
    const { data: nodesToShift, error: fetchError } = await supabase
      .from('nodes')
      .select('id, position')
      .eq('workflow_id', workflowId)
      .gte('position', position)
      .order('position', { ascending: false }); // Start from highest position
    
    if (fetchError) {
      console.error('[INSERT_NODE_AT] Error fetching nodes:', fetchError);
      throw fetchError;
    }
    
    console.log(`[INSERT_NODE_AT] Found ${nodesToShift?.length || 0} nodes to shift`);
    
    // Shift each node up by 1
    for (const nodeToShift of nodesToShift || []) {
      const { error: updateError } = await supabase
        .from('nodes')
        .update({ position: nodeToShift.position + 1 })
        .eq('id', nodeToShift.id);
      
      if (updateError) {
        console.error(`[INSERT_NODE_AT] Error shifting node ${nodeToShift.id}:`, updateError);
        throw updateError;
      }
    }
    
    console.log(`[INSERT_NODE_AT] Successfully shifted ${nodesToShift?.length || 0} nodes`);
    
    // Create the new node at the specified position
    const result = await this.createNode({
      ...node,
      position
    }, workflowId);
    
    console.log(`[INSERT_NODE_AT] Created new node at position ${position}`);
    return result;
  }

  async createNode(args, workflowId) {
    // Handle multiple nodes passed in nodes array
    if (args.nodes && Array.isArray(args.nodes)) {
      const createdNodes = [];
      for (const nodeData of args.nodes) {
        const node = await this.createNode(nodeData, workflowId);
        createdNodes.push(node);
      }
      return {
        message: `Created ${createdNodes.length} nodes`,
        nodes: createdNodes
      };
    }
    
    // Single node creation
    const { type, config, position, description, parent_position, alias } = args;
    // Validate config based on node type
    if (!config || Object.keys(config).length === 0) {
      console.error(`Empty config provided for ${type} node`);
      throw new Error(`Node type '${type}' requires configuration parameters. See system prompt for examples.`);
    }
    
    // Type-specific validation
    switch (type) {
      case 'browser_action':
        if (!config.action) throw new Error('browser_action requires "action" field');
        break;
      case 'browser_query':
        if (!config.method) throw new Error('browser_query requires "method" field');
        if (!['validate', 'deterministic_extract'].includes(config.method)) {
          throw new Error('browser_query supports "validate" and "deterministic_extract" methods');
        }
        if (config.method === 'deterministic_extract' && !config.selector) {
          throw new Error('browser_query with deterministic_extract method requires "selector" field');
        }
        break;
      case 'browser_ai_extract':
        if (!config.instruction || !config.schema) throw new Error('browser_ai_extract requires "instruction" and "schema" fields');
        break;
      case 'memory':
        if (!config.operation || !config.key) throw new Error('memory requires "operation" and "key" fields');
        break;
      case 'group':
        if (!config.nodeRange) throw new Error('group requires "nodeRange" field (e.g., "1-25" or [1, 25])');
        break;
      case 'iterate':
        if (!config.over) throw new Error('iterate node requires "over" field - the path to the array to iterate over (e.g., "state.items" or "node4.emails")');
        if (!config.variable) throw new Error('iterate node requires "variable" field - the name for the current item in each iteration (e.g., "currentItem")');
        break;
      case 'context':
        if (!config.variables) throw new Error('context node requires "variables" field - an object containing the variables to store');
        break;
      case 'cognition':
        if (!config.instruction) throw new Error('cognition node requires "instruction" field');
        if (!config.schema) {
          throw new Error(
            `Cognition nodes require a schema to define output format.\n` +
            `Common patterns:\n` +
            `  - For text: schema: {type: "string"}\n` +
            `  - For yes/no: schema: {type: "boolean"}\n` +
            `  - For numbers: schema: {type: "number"}\n` +
            `  - For objects: schema: {type: "object", properties: {field1: {type: "string"}}}\n` +
            `  - For arrays: schema: {type: "array", items: {type: "string"}}`
          );
        }
        
        // Validate schema is an object
        if (typeof config.schema !== 'object' || config.schema === null) {
          throw new Error('Schema must be a valid JSON Schema object');
        }
        
        // Validate schema has at least 'type' property
        if (!config.schema.type) {
          throw new Error('Schema must have a "type" property (e.g., "string", "object", "array", "boolean", "number")');
        }
        
        // Validate type is valid
        const validTypes = ['string', 'number', 'boolean', 'object', 'array', 'null'];
        if (!validTypes.includes(config.schema.type)) {
          throw new Error(`Schema type must be one of: ${validTypes.join(', ')}. Got: ${config.schema.type}`);
        }
        
        // Validate object schemas have proper structure
        if (config.schema.type === 'object' && config.schema.properties) {
          if (typeof config.schema.properties !== 'object') {
            throw new Error('Schema properties must be an object defining the structure');
          }
          // Validate each property has a type
          for (const [key, value] of Object.entries(config.schema.properties)) {
            if (!value || typeof value !== 'object' || !value.type) {
              throw new Error(`Schema property "${key}" must have a type. Example: ${key}: {type: "string"}`);
            }
          }
        }
        
        // Validate array schemas have items definition
        if (config.schema.type === 'array' && !config.schema.items) {
          throw new Error('Array schema must have "items" property defining the array element type. Example: {type: "array", items: {type: "string"}}');
        }
        break;
    }
    
    // If position is provided, use it; otherwise get the next available position
    let nodePosition = position;
    
    if (!nodePosition) {
      // Get the max position for this workflow
      const { data: maxPositionNode } = await supabase
        .from('nodes')
        .select('position')
        .eq('workflow_id', workflowId)
        .order('position', { ascending: false })
        .limit(1)
        .single();
      
      nodePosition = (maxPositionNode?.position || 0) + 1;
    }
    
    // Validate alias is provided and valid
    if (!alias) {
      throw new Error('Alias is required for all nodes. Please provide a unique snake_case identifier (e.g. extract_emails, validate_login)');
    }
    
    // Validate alias format
    const aliasPattern = /^[a-z][a-z0-9_]*$/;
    if (!aliasPattern.test(alias)) {
      throw new Error(`Invalid alias format: '${alias}'. Alias must be snake_case starting with a letter (e.g. extract_emails, validate_login)`);
    }
    
    // Check for uniqueness within workflow
    const { data: existingNode } = await supabase
      .from('nodes')
      .select('id, alias')
      .eq('workflow_id', workflowId)
      .eq('alias', alias)
      .single();
    
    if (existingNode) {
      throw new Error(`Alias '${alias}' already exists in this workflow. Please choose a unique alias.`);
    }
    
    const nodeAlias = alias;
    
    // Extract store_variable from config before storing
    const storeVariable = config?.store_variable === true;
    
    // Handle both array and object configs properly
    let cleanConfig;
    if (Array.isArray(config)) {
      // For arrays (like route node configs), preserve the array structure
      cleanConfig = [...config];
    } else {
      // For objects, spread and clean
      cleanConfig = { ...(config || {}) };
      delete cleanConfig.store_variable;  // Remove from params to keep it clean
    }
    
    const nodeData = {
      workflow_id: workflowId,
      position: nodePosition,
      type,
      params: cleanConfig,  // Store config without store_variable
      description: description || `${type} node`,
      status: 'pending',
      alias: nodeAlias,
      store_variable: storeVariable  // Add as column value
    };
    
    // Add parent_position to params if provided (since we don't have a DB column for it)
    // Exception: Group nodes should always be top-level
    if (parent_position !== undefined && parent_position !== null && type !== 'group') {
      nodeData.params._parent_position = parent_position;
    }
    
    const { data: node, error } = await supabase
      .from('nodes')
      .insert(nodeData)
      .select()
      .single();
      
    if (error) throw error;
    return node;
  }

  async updateNode(args) {
    // Handle multiple node updates passed in updates array
    if (args.updates && Array.isArray(args.updates)) {
      const results = [];
      const errors = [];
      
      for (const update of args.updates) {
        if (!update.nodeId) {
          errors.push({ error: 'Missing nodeId in update object', update });
          continue;
        }
        
        try {
          const result = await this.updateNode({
            nodeId: update.nodeId,
            updates: update.updates
          });
          results.push({ nodeId: update.nodeId, success: true, node: result });
        } catch (error) {
          console.error(`[UPDATE_NODE] Failed to update node ${update.nodeId}:`, error);
          errors.push({ nodeId: update.nodeId, error: error.message });
        }
      }
      
      return {
        message: `Updated ${results.length} nodes${errors.length > 0 ? `, ${errors.length} errors` : ''}`,
        results,
        errors: errors.length > 0 ? errors : undefined
      };
    }
    
    // Single node update
    const { nodeId, updates } = args;
    console.log(`[UPDATE_NODE] Called with:`, JSON.stringify({ nodeId, updates }, null, 2));
    
    // Validate inputs
    if (!nodeId) {
      throw new Error('nodeId is required for update_node');
    }
    
    if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
      console.error('[UPDATE_NODE] Invalid updates object:', updates);
      throw new Error('updates must be a non-empty object');
    }
    
    // Map 'config' to 'params' to match database schema
    const mappedUpdates = { ...updates };
    if ('config' in mappedUpdates) {
      mappedUpdates.params = mappedUpdates.config;
      delete mappedUpdates.config;
      console.log('[UPDATE_NODE] Mapped "config" to "params" for database compatibility');
    }
    
    // Validate that only valid fields are being updated
    const validFields = ['type', 'params', 'description', 'status', 'result', 'position', 'alias'];
    const updateFields = Object.keys(mappedUpdates);
    const invalidFields = updateFields.filter(field => !validFields.includes(field));
    
    if (invalidFields.length > 0) {
      console.error('[UPDATE_NODE] Invalid fields detected:', invalidFields);
      console.log('[UPDATE_NODE] Valid fields are:', validFields);
      throw new Error(`Invalid update fields: ${invalidFields.join(', ')}. Valid fields are: ${validFields.join(', ')}`);
    }
    
    // Log what we're trying to update
    console.log('[UPDATE_NODE] Attempting to update node:', nodeId);
    console.log('[UPDATE_NODE] Mapped update payload:', JSON.stringify(mappedUpdates, null, 2));
    
    // Get the node before update to check if it's an iterate node
    const { data: nodeBeforeUpdate } = await supabase
      .from('nodes')
      .select('type, workflow_id, position')
      .eq('id', nodeId)
      .single();

    const { data: node, error } = await supabase
      .from('nodes')
      .update(mappedUpdates)
      .eq('id', nodeId)
      .select()
      .single();
      
    if (error) {
      console.error('[UPDATE_NODE] Supabase error:', error);
      throw error;
    }
    
    console.log('[UPDATE_NODE] Successfully updated node:', JSON.stringify(node, null, 2));
    
    // If we updated an iterate node's config, clean up stale iteration variables
    if (nodeBeforeUpdate?.type === 'iterate' && mappedUpdates.params) {
      console.log('[UPDATE_NODE] Updated iterate node config, triggering iteration variable cleanup');
      await this.variableManagementService.cleanupIterationVariables(
        nodeBeforeUpdate.workflow_id, 
        [nodeBeforeUpdate.position]
      );
    }
    
    return node;
  }

  /**
   * New 2-function design: Add or Replace Nodes
   * Handles create, insert, and update based on target type
   */
  async addOrReplaceNodes(args, workflowId) {
    const { target, nodes } = args;
    
    // Validate all nodes have aliases
    for (const node of nodes) {
      if (!node.alias) {
        throw new Error(`All nodes must have an alias. Node of type '${node.type}' is missing alias.`);
      }
      if (!node.alias.match(/^[a-z][a-z0-9_]*$/)) {
        throw new Error(`Invalid alias '${node.alias}'. Must be snake_case starting with lowercase letter.`);
      }
    }
    
    console.log(`[ADD_OR_REPLACE_NODES] Target: ${target}, Nodes: ${nodes.length}`);
    
    // Determine operation based on target type
    if (target === 'end') {
      // Append nodes to the end
      console.log('[ADD_OR_REPLACE_NODES] Appending nodes to end of workflow');
      const createdNodes = [];
      for (const nodeData of nodes) {
        const node = await this.createNode(nodeData, workflowId);
        createdNodes.push(node);
      }
      return {
        success: true,
        operation: 'append',
        nodes: createdNodes,
        message: `Added ${createdNodes.length} node(s) to the end of the workflow`
      };
      
    } else if (typeof target === 'number') {
      // Insert at position
      const position = target;
      console.log(`[ADD_OR_REPLACE_NODES] Inserting nodes at position ${position}`);
      
      // Use existing insertNodeAt logic
      const result = await this.insertNodeAt({ 
        position, 
        nodes 
      }, workflowId);
      
      return {
        success: true,
        operation: 'insert',
        nodes: result.nodes,
        message: `Inserted ${nodes.length} node(s) at position ${position}`
      };
      
    } else if (typeof target === 'string') {
      // Replace existing node(s) by alias or ID
      console.log(`[ADD_OR_REPLACE_NODES] Replacing node with identifier: ${target}`);
      
      // Find the node to replace
      let nodeToReplace;
      
      // First try by alias
      const { data: nodeByAlias } = await supabase
        .from('nodes')
        .select('*')
        .eq('workflow_id', workflowId)
        .eq('alias', target)
        .single();
        
      if (nodeByAlias) {
        nodeToReplace = nodeByAlias;
      } else {
        // Try by ID (if it's a numeric string)
        if (target.match(/^\d+$/)) {
          const { data: nodeById } = await supabase
            .from('nodes')
            .select('*')
            .eq('workflow_id', workflowId)
            .eq('id', parseInt(target))
            .single();
            
          if (nodeById) {
            nodeToReplace = nodeById;
          }
        }
      }
      
      if (!nodeToReplace) {
        throw new Error(`Node not found with identifier: ${target}`);
      }
      
      // For replacement, we only support single node (makes sense semantically)
      if (nodes.length !== 1) {
        throw new Error(`Node replacement requires exactly 1 node, got ${nodes.length}`);
      }
      
      const newNode = nodes[0];
      
      // Update the existing node
      const updatedNode = await this.updateNode({
        nodeId: nodeToReplace.id,
        updates: {
          type: newNode.type,
          config: newNode.config,
          description: newNode.description,
          alias: newNode.alias  // Can be same or different
        }
      });
      
      return {
        success: true,
        operation: 'replace',
        nodes: [updatedNode],
        message: `Replaced node '${target}' with new configuration`
      };
      
    } else {
      throw new Error(`Invalid target type: ${typeof target}. Expected 'end', number, or string.`);
    }
  }

  /**
   * New 2-function design: Delete Nodes
   * Enhanced version with alias support
   */
  async deleteNodesByIdOrAlias(args, workflowId) {
    const { nodeIds, options = {} } = args;
    const { handleDependencies = true, deleteChildren = false, dryRun = false } = options;
    
    console.log(`[DELETE_NODES_V2] Deleting nodes:`, { nodeIds, options });
    
    // Convert aliases to IDs
    const resolvedIds = [];
    for (const identifier of nodeIds) {
      if (typeof identifier === 'number') {
        resolvedIds.push(identifier);
      } else if (typeof identifier === 'string') {
        // Try to resolve alias
        const { data: nodeByAlias } = await supabase
          .from('nodes')
          .select('id')
          .eq('workflow_id', workflowId)
          .eq('alias', identifier)
          .single();
          
        if (nodeByAlias) {
          resolvedIds.push(nodeByAlias.id);
        } else if (identifier.match(/^\d+$/)) {
          // If it's a numeric string, treat as ID
          resolvedIds.push(parseInt(identifier));
        } else {
          throw new Error(`Node not found with identifier: ${identifier}`);
        }
      }
    }
    
    // Use the existing deleteNodes internal method
    return await this.deleteNodes({
      nodeIds: resolvedIds,
      handleDependencies,
      deleteChildren,
      dryRun
    });
  }

  async deleteNode(args) {
    // Handle multiple node deletes passed in nodeIds array
    if (args.nodeIds && Array.isArray(args.nodeIds)) {
      return await this.deleteNodes({
        nodeIds: args.nodeIds,
        handleDependencies: args.handleDependencies ?? true,
        deleteChildren: args.deleteChildren ?? false,
        dryRun: args.dryRun ?? false
      });
    }
    
    // Single node delete
    const { nodeId } = args;
    return await this.deleteNodes({ 
      nodeIds: [nodeId],
      handleDependencies: true,
      deleteChildren: false,
      dryRun: false
    });
  }

  // Internal function used by deleteNode - not exposed as a tool
  async deleteNodes({ nodeIds, handleDependencies = true, deleteChildren = false, dryRun = false }) {
    console.log(`[DELETE_NODES] Starting deletion:`, {
      nodeIds,
      handleDependencies,
      deleteChildren,
      dryRun
    });

    try {
      // Step 1: Validate all nodes exist and get their details
      const { data: nodesToDelete, error: fetchError } = await supabase
        .from('nodes')
        .select('*')
        .in('id', nodeIds);

      if (fetchError) throw fetchError;
      
      if (!nodesToDelete || nodesToDelete.length !== nodeIds.length) {
        const foundIds = nodesToDelete?.map(n => n.id) || [];
        const missingIds = nodeIds.filter(id => !foundIds.includes(id));
        throw new Error(`Some nodes not found: ${missingIds.join(', ')}`);
      }

      // Get workflow ID from first node (all should be in same workflow)
      const workflowId = nodesToDelete[0].workflow_id;
      
      // Step 2: Get all nodes in the workflow for dependency analysis
      const { data: allNodes, error: allNodesError } = await supabase
        .from('nodes')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('position');

      if (allNodesError) throw allNodesError;

      // Step 3: Find nodes that depend on the ones being deleted
      const deletedPositions = nodesToDelete.map(n => n.position);
      const affectedNodes = [];
      const childNodesToDelete = new Set();

      for (const node of allNodes) {
        // Skip if this node is being deleted
        if (nodeIds.includes(node.id)) continue;

        let needsUpdate = false;
        const updatedConfig = { ...node.config };

        // Check route nodes
        if (node.type === 'route' && node.config?.paths) {
          for (const [pathName, positions] of Object.entries(node.config.paths)) {
            if (Array.isArray(positions)) {
              const filteredPositions = positions.filter(pos => !deletedPositions.includes(pos));
              if (filteredPositions.length !== positions.length) {
                updatedConfig.paths[pathName] = filteredPositions;
                needsUpdate = true;
              }
            }
          }
        }

        // Check iterate nodes
        if (node.type === 'iterate' && node.config?.body) {
          if (Array.isArray(node.config.body)) {
            const filteredBody = node.config.body.filter(pos => !deletedPositions.includes(pos));
            if (filteredBody.length !== node.config.body.length) {
              updatedConfig.body = filteredBody;
              needsUpdate = true;
            }
          } else if (typeof node.config.body === 'number' && deletedPositions.includes(node.config.body)) {
            updatedConfig.body = [];
            needsUpdate = true;
          }
        }

        // Check handle nodes
        if (node.type === 'handle') {
          if (node.config?.try && Array.isArray(node.config.try)) {
            const filteredTry = node.config.try.filter(pos => !deletedPositions.includes(pos));
            if (filteredTry.length !== node.config.try.length) {
              updatedConfig.try = filteredTry;
              needsUpdate = true;
            }
          }
          if (node.config?.catch && Array.isArray(node.config.catch)) {
            const filteredCatch = node.config.catch.filter(pos => !deletedPositions.includes(pos));
            if (filteredCatch.length !== node.config.catch.length) {
              updatedConfig.catch = filteredCatch;
              needsUpdate = true;
            }
          }
          if (node.config?.finally && Array.isArray(node.config.finally)) {
            const filteredFinally = node.config.finally.filter(pos => !deletedPositions.includes(pos));
            if (filteredFinally.length !== node.config.finally.length) {
              updatedConfig.finally = filteredFinally;
              needsUpdate = true;
            }
          }
        }

        if (needsUpdate) {
          affectedNodes.push({
            id: node.id,
            position: node.position,
            type: node.type,
            oldConfig: node.config,
            newConfig: updatedConfig
          });
        }

        // Check if this node is a child of a deleted control flow node
        if (deleteChildren && node.parent_position) {
          if (deletedPositions.includes(node.parent_position)) {
            childNodesToDelete.add(node.id);
          }
        }
      }

      // Step 4: Build comprehensive result for dry run
      if (dryRun) {
        return {
          success: true,
          dryRun: true,
          wouldDelete: {
            direct: nodesToDelete.map(n => ({
              id: n.id,
              position: n.position,
              type: n.type,
              description: n.description
            })),
            children: deleteChildren ? Array.from(childNodesToDelete).map(id => {
              const node = allNodes.find(n => n.id === id);
              return {
                id: node.id,
                position: node.position,
                type: node.type,
                description: node.description
              };
            }) : []
          },
          wouldUpdate: affectedNodes,
          totalDeleted: nodesToDelete.length + (deleteChildren ? childNodesToDelete.size : 0),
          totalUpdated: affectedNodes.length
        };
      }

      // Step 5: Execute the deletion and updates in a transaction-like manner
      const allIdsToDelete = [...nodeIds];
      if (deleteChildren) {
        allIdsToDelete.push(...Array.from(childNodesToDelete));
      }

      // Update affected nodes first (before deletion)
      if (handleDependencies && affectedNodes.length > 0) {
        console.log(`[DELETE_NODES] Updating ${affectedNodes.length} dependent nodes`);
        
        for (const affected of affectedNodes) {
          const { error: updateError } = await supabase
            .from('nodes')
            .update({ config: affected.newConfig })
            .eq('id', affected.id);
            
          if (updateError) {
            throw new Error(`Failed to update dependent node ${affected.id}: ${updateError.message}`);
          }
        }
      }

      // Clean up iteration variables for any iterate nodes being deleted
      const iterateNodesToDelete = nodesToDelete.filter(n => n.type === 'iterate');
      if (deleteChildren) {
        // Also check children for iterate nodes
        for (const childId of childNodesToDelete) {
          const childNode = allNodes.find(n => n.id === childId);
          if (childNode?.type === 'iterate') {
            iterateNodesToDelete.push(childNode);
          }
        }
      }
      
      if (iterateNodesToDelete.length > 0) {
        console.log(`[DELETE_NODES] Cleaning up iteration variables for ${iterateNodesToDelete.length} iterate nodes`);
        const iteratePositions = iterateNodesToDelete.map(n => n.position);
        await this.variableManagementService.cleanupIterationVariables(workflowId, iteratePositions);
      }

      // Delete the nodes
      const { error: deleteError } = await supabase
        .from('nodes')
        .delete()
        .in('id', allIdsToDelete);

      if (deleteError) throw deleteError;

      // Step 6: Recalculate positions to eliminate gaps
      // Convert IDs to strings for comparison (database returns numbers, but nodeIds are strings)
      const allIdsToDeleteStr = allIdsToDelete.map(id => String(id));
      const remainingNodes = allNodes
        .filter(n => !allIdsToDeleteStr.includes(String(n.id)))
        .sort((a, b) => a.position - b.position);
      
      console.log(`[DELETE_NODES] Remaining nodes after deletion: ${remainingNodes.length} (from ${allNodes.length} total)`);

      const positionUpdates = [];
      let newPosition = 1;

      for (const node of remainingNodes) {
        if (node.position !== newPosition) {
          console.log(`[DELETE_NODES] Node ${node.id} needs position update: ${node.position} → ${newPosition}`);
          positionUpdates.push({
            id: node.id,
            oldPosition: node.position,
            newPosition: newPosition
          });
        }
        newPosition++;
      }

      // Apply position updates
      if (positionUpdates.length > 0) {
        console.log(`[DELETE_NODES] Recalculating ${positionUpdates.length} node positions`);
        
        for (const update of positionUpdates) {
          const { error: posUpdateError } = await supabase
            .from('nodes')
            .update({ position: update.newPosition })
            .eq('id', update.id);
            
          if (posUpdateError) {
            console.error(`[DELETE_NODES] Warning: Failed to update position for node ${update.id}`);
          }
        }

        // Update control flow references with new positions
        if (handleDependencies) {
          await this.updateControlFlowPositions(workflowId, positionUpdates);
        }
      }

      // Step 7: Return comprehensive result with refresh flag
      return {
        success: true,
        deleted: {
          direct: nodesToDelete.map(n => ({
            id: n.id,
            position: n.position,
            type: n.type,
            description: n.description
          })),
          children: deleteChildren ? Array.from(childNodesToDelete).map(id => {
            const node = allNodes.find(n => n.id === id);
            return {
              id: node.id,
              position: node.position,
              type: node.type,
              description: node.description
            };
          }) : []
        },
        updated: {
          dependencies: affectedNodes.map(n => ({
            id: n.id,
            position: n.position,
            type: n.type,
            changes: 'Updated references to deleted nodes'
          })),
          positions: positionUpdates
        },
        summary: {
          totalDeleted: allIdsToDelete.length,
          totalUpdated: affectedNodes.length + positionUpdates.length,
          gapsEliminated: positionUpdates.length > 0
        },
        // Add refresh hint for Director to communicate to user
        refreshRequired: true,
        message: `Successfully deleted ${allIdsToDelete.length} node(s) and updated ${affectedNodes.length + positionUpdates.length} references. The workflow has been reorganized with positions ${positionUpdates.length > 0 ? 'recalculated to eliminate gaps.' : 'maintained.'}`
      };

    } catch (error) {
      console.error('[DELETE_NODES] Error:', error);
      throw error;
    }
  }

  async updateControlFlowPositions(workflowId, positionUpdates) {
    console.log(`[UPDATE_CONTROL_FLOW] Updating control flow references with new positions`);
    
    // Create a map of old position to new position
    const positionMap = {};
    positionUpdates.forEach(update => {
      positionMap[update.oldPosition] = update.newPosition;
    });
    
    // Get all nodes that might have position references
    const { data: controlFlowNodes, error } = await supabase
      .from('nodes')
      .select('*')
      .eq('workflow_id', workflowId)
      .in('type', ['route', 'iterate', 'handle']);
    
    if (error) {
      console.error('[UPDATE_CONTROL_FLOW] Error fetching control flow nodes:', error);
      return;
    }
    
    for (const node of controlFlowNodes) {
      let needsUpdate = false;
      const updatedConfig = { ...node.config };
      
      // Update route paths
      if (node.type === 'route' && node.config?.paths) {
        for (const [pathName, positions] of Object.entries(node.config.paths)) {
          if (Array.isArray(positions)) {
            updatedConfig.paths[pathName] = positions.map(pos => 
              positionMap[pos] !== undefined ? positionMap[pos] : pos
            );
            needsUpdate = true;
          }
        }
      }
      
      // Update iterate body
      if (node.type === 'iterate' && node.config?.body) {
        if (Array.isArray(node.config.body)) {
          updatedConfig.body = node.config.body.map(pos => 
            positionMap[pos] !== undefined ? positionMap[pos] : pos
          );
          needsUpdate = true;
        } else if (typeof node.config.body === 'number') {
          const newPos = positionMap[node.config.body];
          if (newPos !== undefined) {
            updatedConfig.body = newPos;
            needsUpdate = true;
          }
        }
      }
      
      // Update handle blocks
      if (node.type === 'handle') {
        if (node.config?.try && Array.isArray(node.config.try)) {
          updatedConfig.try = node.config.try.map(pos => 
            positionMap[pos] !== undefined ? positionMap[pos] : pos
          );
          needsUpdate = true;
        }
        if (node.config?.catch && Array.isArray(node.config.catch)) {
          updatedConfig.catch = node.config.catch.map(pos => 
            positionMap[pos] !== undefined ? positionMap[pos] : pos
          );
          needsUpdate = true;
        }
        if (node.config?.finally && Array.isArray(node.config.finally)) {
          updatedConfig.finally = node.config.finally.map(pos => 
            positionMap[pos] !== undefined ? positionMap[pos] : pos
          );
          needsUpdate = true;
        }
      }
      
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('nodes')
          .update({ config: updatedConfig })
          .eq('id', node.id);
          
        if (updateError) {
          console.error(`[UPDATE_CONTROL_FLOW] Failed to update node ${node.id}:`, updateError);
        } else {
          console.log(`[UPDATE_CONTROL_FLOW] Updated position references in node ${node.id}`);
        }
      }
    }
  }

  // Removed updateNodes - use update_node with array instead

  // Removed connectNodes - connections are implicit through position ordering

  async executeNode(nodeId, workflowId) {
    return await this.nodeExecutor.execute(nodeId, workflowId);
  }

  async executeIteration(nodeId, workflowId, iterationIndex, iterationData) {
    return await this.nodeExecutor.executeIteration(nodeId, workflowId, iterationIndex, iterationData);
  }

  async executeWorkflow(workflowId) {
    // Get all nodes in the workflow
    const { data: nodes, error } = await supabase
      .from('nodes')
      .select('*, node_connections!source_node_id(*)')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    
    // Find starting nodes (nodes with no incoming connections)
    const startingNodes = nodes.filter(node => {
      const hasIncoming = nodes.some(n => 
        n.node_connections?.some(conn => conn.target_node_id === node.id)
      );
      return !hasIncoming;
    });
    
    // Execute from starting nodes
    const results = [];
    for (const startNode of startingNodes) {
      const result = await this.executeNodeChain(startNode, nodes);
      results.push(result);
    }
    
    return results;
  }

  async executeNodeChain(node, allNodes) {
    // Execute current node
    const result = await this.nodeExecutor.execute(node.id, node.workflow_id);
    
    // Find connected nodes
    const connectedNodes = node.node_connections?.map(conn => 
      allNodes.find(n => n.id === conn.target_node_id)
    ).filter(Boolean) || [];
    
    // Execute connected nodes
    const childResults = [];
    for (const childNode of connectedNodes) {
      const childResult = await this.executeNodeChain(childNode, allNodes);
      childResults.push(childResult);
    }
    
    return {
      nodeId: node.id,
      result,
      children: childResults
    };
  }

  // Removed testNode - use execute_nodes instead

  async getWorkflowContext(workflowId) {
    const { data: workflow } = await supabase
      .from('workflows')
      .select(`
        *,
        nodes (*)
      `)
      .eq('id', workflowId)
      .single();
      
    // Sort nodes by position
    if (workflow?.nodes) {
      workflow.nodes.sort((a, b) => a.position - b.position);
    }
      
    return workflow;
  }

  validateGroupNode(node, index) {
    const errors = [];
    
    // Required fields
    if (!node.type) {
      errors.push(`Node at index ${index}: Missing required field 'type'`);
    }
    
    if (!node.alias) {
      errors.push(`Node at index ${index}: Missing required field 'alias'`);
    }
    
    // Config validation
    if (!node.config || typeof node.config !== 'object') {
      errors.push(`Node at index ${index}: Missing or invalid 'config' object. Config must be an object.`);
    }
    
    // Check for malformed config (properties at root level)
    const knownFields = ['type', 'config', 'alias', 'description', 'id'];
    const rootLevelConfigFields = Object.keys(node).filter(key => !knownFields.includes(key));
    if (rootLevelConfigFields.length > 0) {
      // Check if this is a quoted property name issue
      const hasQuotedProperties = rootLevelConfigFields.some(key => key.includes('"'));
      if (hasQuotedProperties) {
        errors.push(`Node at index ${index}: Malformed property names detected. You have quotes in your property names (${rootLevelConfigFields.join(', ')}). Use JavaScript object literal syntax, not JSON string syntax. Property names should NOT have quotes.`);
      } else {
        errors.push(`Node at index ${index}: Config properties found at root level: ${rootLevelConfigFields.join(', ')}. These should be inside the 'config' object.`);
      }
    }
    
    // Check for quoted property names (indicates malformed JSON)
    const nodeStr = JSON.stringify(node);
    if (nodeStr.includes('"config":') && !node.config) {
      errors.push(`Node at index ${index}: Malformed node structure detected. Property names should not be quoted.`);
    }
    
    // Type-specific validation
    if (node.type && node.config) {
      switch (node.type) {
        case 'browser_action':
          if (!node.config.action) {
            errors.push(`Node at index ${index}: browser_action requires 'action' field in config`);
          }
          break;
        case 'browser_query':
          if (!node.config.method) {
            errors.push(`Node at index ${index}: browser_query requires 'method' field in config`);
          }
          if (!['validate', 'deterministic_extract'].includes(node.config.method)) {
            errors.push(`Node at index ${index}: browser_query supports 'validate' and 'deterministic_extract' methods`);
          }
          if (node.config.method === 'deterministic_extract' && !node.config.selector) {
            errors.push(`Node at index ${index}: browser_query with deterministic_extract method requires 'selector' field`);
          }
          break;
        case 'browser_ai_extract':
          if (!node.config.instruction || !node.config.schema) {
            errors.push(`Node at index ${index}: browser_ai_extract requires 'instruction' and 'schema' fields in config`);
          }
          break;
        case 'iterate':
          if (!node.config.over || !node.config.variable) {
            errors.push(`Node at index ${index}: iterate requires 'over' and 'variable' fields in config`);
          }
          break;
        case 'context':
          if (!node.config.operation) {
            errors.push(`Node at index ${index}: context requires 'operation' field in config`);
          }
          break;
      }
    }
    
    return errors;
  }

  // Group functionality is now handled by the 'group' node type which executes a range of nodes

  /**
   * Director 2.0: Build 7-part context structure
   */
  async buildCompressionContext(workflowId) {
    // Similar to buildDirector2Context but formatted for compression
    const parts = [];
    
    try {
      // Get all the persistent context
      const context = await this.buildDirector2Context(workflowId);
      parts.push("PERSISTENT CONTEXT (will remain after compression):");
      parts.push(context);
      parts.push("\n" + "=".repeat(80) + "\n");
      
      return parts.join('\n');
    } catch (error) {
      console.error('Error building compression context:', error);
      return `Compression Context Error: ${error.message}`;
    }
  }

  async buildDirector2Context(workflowId) {
    const parts = [];
    
    try {
      // Part 1: System Prompt - already included in messages, skip here
      
      // Part 2: Workflow Description (NEW)
      const currentDescription = await this.workflowDescriptionService.getCurrentDescription(workflowId);
      if (currentDescription) {
        parts.push(`(2) WORKFLOW DESCRIPTION\n${this.workflowDescriptionService.getDescriptionSummary(currentDescription.description_data)}`);
        
        // Check for missing elements and add suggestions
        const suggestions = this.workflowDescriptionService.suggestMissingElements(currentDescription.description_data);
        if (suggestions.length > 0) {
          parts[parts.length - 1] += `\n\nSuggested additions:\n${suggestions.map(s => `• ${s}`).join('\n')}`;
        }
      } else {
        parts.push(`(2) WORKFLOW DESCRIPTION\nNo description created yet. Use update_workflow_description to capture comprehensive requirements before building.`);
      }
      
      // Part 3: Current Plan
      const currentPlan = await this.planService.getCurrentPlan(workflowId);
      if (currentPlan) {
        parts.push(`(3) CURRENT PLAN\n${this.planService.getPlanSummary(currentPlan.plan_data)}`);
      } else {
        parts.push(`(3) CURRENT PLAN\nNo plan created yet. Use update_plan tool to create structured plan.`);
      }
      
      // Part 4: Workflow Snapshot
      const workflowContext = await this.getWorkflowContext(workflowId);
      if (workflowContext && workflowContext.nodes && workflowContext.nodes.length > 0) {
        const nodesSummary = workflowContext.nodes.map(node => 
          `  ${node.position}. ${node.type} - ${node.description || 'No description'} (${node.status})`
        ).join('\n');
        parts.push(`(4) WORKFLOW SNAPSHOT\nWorkflow: ${workflowContext.goal}\nNodes:\n${nodesSummary}`);
      } else {
        parts.push(`(4) WORKFLOW SNAPSHOT\nNo nodes created yet.`);
      }
      
      // Part 5: Workflow Variables
      const variableDisplay = await this.variableManagementService.getFormattedVariables(workflowId);
      parts.push(`(5) WORKFLOW VARIABLES\n${variableDisplay}`);
      
      // Part 6: Browser State
      console.log(`[DIRECTOR_CONTEXT] Fetching browser state context for workflow: ${workflowId}`);
      const browserStateContext = await this.browserStateService.getBrowserStateContext(workflowId);
      console.log(`[DIRECTOR_CONTEXT] Browser state context result: ${browserStateContext?.substring(0, 100)}...`);
      parts.push(`(6) ${browserStateContext}`);
      
      // Part 7: Compressed Context History
      // Load the latest compressed context if exists
      const { data: compressedContext } = await this.supabase
        .from('compressed_contexts')
        .select('summary, original_message_count, created_at')
        .eq('workflow_id', workflowId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (compressedContext) {
        parts.push(`(7) COMPRESSED CONVERSATION HISTORY\n[Context compressed on ${new Date(compressedContext.created_at).toISOString()} - ${compressedContext.original_message_count} messages summarized]\n\n${compressedContext.summary}`);
      } else {
        parts.push(`(7) CONVERSATION HISTORY\nNo compressed context found. Recent messages will be included in the conversation flow.`);
      }
      
      return parts.join('\n\n');
      
    } catch (error) {
      console.error('Error building Director 2.0 context:', error);
      return `Director 2.0 Context Error: ${error.message}`;
    }
  }

  /**
   * Handle update_plan tool calls
   */
  async updatePlan(args, workflowId) {
    try {
      const { plan, reason } = args;
      
      if (!plan) {
        throw new Error('Plan data is required');
      }
      
      if (!workflowId) {
        throw new Error('Workflow ID is required for plan updates');
      }
      
      // Update plan through PlanService
      const updatedPlan = await this.planService.updatePlan(workflowId, plan, reason);
      
      return {
        success: true,
        message: `Plan updated successfully (version ${updatedPlan.plan_version})`,
        plan_id: updatedPlan.id,
        version: updatedPlan.plan_version,
        updated_at: updatedPlan.updated_at
      };
      
    } catch (error) {
      console.error('Failed to update plan:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle update_workflow_description tool calls
   */
  async updateWorkflowDescription(args, workflowId) {
    try {
      const { description, reason } = args;
      
      if (!description) {
        throw new Error('Description data is required');
      }
      
      if (!workflowId) {
        throw new Error('Workflow ID is required for description updates');
      }
      
      // Update description through WorkflowDescriptionService
      const updatedDescription = await this.workflowDescriptionService.updateDescription(
        workflowId, 
        description, 
        reason
      );
      
      return {
        success: true,
        message: `Workflow description updated successfully (version ${updatedDescription.description_version})`,
        description_id: updatedDescription.id,
        version: updatedDescription.description_version,
        updated_at: updatedDescription.updated_at,
        suggestions: this.workflowDescriptionService.suggestMissingElements(description)
      };
      
    } catch (error) {
      console.error('Failed to update workflow description:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Variable Management Tool Handlers
   */
  
  async getWorkflowVariable(args, workflowId) {
    try {
      const { variableName, nodeId } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }

      let result;
      
      if (nodeId) {
        // Get all variables for a specific node
        result = await this.variableManagementService.getNodeVariables(workflowId, nodeId);
        return {
          success: true,
          nodeId,
          variables: result
        };
      } else if (variableName) {
        // Get specific variable or all variables
        result = await this.variableManagementService.getVariable(workflowId, variableName);
        
        if (variableName === 'all') {
          return {
            success: true,
            allVariables: result
          };
        } else {
          return {
            success: true,
            variableName,
            value: result
          };
        }
      } else {
        throw new Error('Either variableName or nodeId is required');
      }
      
    } catch (error) {
      console.error('Failed to get workflow variable:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async setVariable(args, workflowId) {
    try {
      const { variableName, value, reason, schema } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      if (!variableName || value === undefined) {
        throw new Error('variableName and value are required');
      }

      const result = await this.variableManagementService.setVariable(
        workflowId, 
        variableName, 
        value, 
        schema, 
        reason
      );
      
      return {
        success: true,
        message: `Variable '${variableName}' set successfully`,
        variable: variableName,
        value,
        reason: reason || 'No reason provided'
      };
      
    } catch (error) {
      console.error('Failed to set variable:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async clearVariable(args, workflowId) {
    try {
      const { variableName, reason } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      if (!variableName) {
        throw new Error('variableName is required');
      }

      const result = await this.variableManagementService.deleteVariable(workflowId, variableName);
      
      return {
        success: true,
        message: `Variable '${variableName}' cleared successfully`,
        variable: variableName,
        reason: reason || 'No reason provided'
      };
      
    } catch (error) {
      console.error('Failed to clear variable:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async clearAllVariables(args, workflowId) {
    try {
      const { reason } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }

      const result = await this.variableManagementService.clearAllVariables(workflowId);
      
      return {
        success: true,
        message: `All variables cleared successfully (${result.deletedCount} variables)`,
        deletedCount: result.deletedCount,
        deletedVariables: result.deletedKeys,
        reason: reason || 'No reason provided'
      };
      
    } catch (error) {
      console.error('Failed to clear all variables:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Inspect a browser tab to see page content and selectors
   */
  async inspectTab(args, workflowId) {
    try {
      const { tabName, inspectionType, instruction } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      if (!tabName) {
        throw new Error('Tab name is required');
      }
      
      if (!inspectionType) {
        throw new Error('Inspection type is required (dom_snapshot or lightweight_exploration)');
      }
      
      if (inspectionType === 'lightweight_exploration' && !instruction) {
        throw new Error('Instruction is required for lightweight exploration');
      }
      
      // Use the tab inspection service, passing nodeExecutor for browser access
      const tabInspectionService = (await import('./tabInspectionService.js')).default;
      const result = await tabInspectionService.inspectTab(
        workflowId,
        tabName,
        inspectionType,
        instruction,
        this.nodeExecutor  // Pass the nodeExecutor instance
      );
      
      return {
        success: true,
        ...result
      };
      
    } catch (error) {
      console.error('Failed to inspect tab:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async expandDomSelector(args, workflowId) {
    try {
      const { tabName, elementId } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      if (!tabName) {
        throw new Error('Tab name is required');
      }
      
      if (!elementId) {
        throw new Error('Element ID is required');
      }
      
      const tabInspectionService = (await import('./tabInspectionService.js')).default;
      const result = await tabInspectionService.expandDomSelector(
        workflowId,
        tabName,
        elementId
      );
      
      return {
        success: true,
        ...result
      };
      
    } catch (error) {
      console.error('Failed to expand DOM selector:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sendScout(args, workflowId) {
    try {
      const { instruction, tabName } = args;
      
      if (!workflowId) {
        throw new Error('Workflow ID is required');
      }
      
      if (!instruction) {
        throw new Error('Scout instruction is required');
      }
      
      console.log(`[DIRECTOR] Deploying Scout with mission: ${instruction}`);
      
      // Lazy load Scout service
      if (!this.scoutService) {
        const ScoutService = (await import('./scoutService.js')).default;
        this.scoutService = new ScoutService();
      }
      
      // Lazy load BrowserStateService if needed
      if (!this.browserStateService) {
        const BrowserStateService = (await import('./browserStateService.js')).default;
        this.browserStateService = new BrowserStateService();
      }
      
      // Get current browser state
      let browserState = await this.browserStateService.getBrowserState(workflowId);
      
      if (!browserState || !browserState.tabs || browserState.tabs.length === 0) {
        // Initialize browser state if it doesn't exist
        const stagehand = await this.nodeExecutor.getStagehand();
        if (stagehand && stagehand.page) {
          // Update browser state to reflect current reality
          await this.browserStateService.updateBrowserState(workflowId, {
            tabs: [{ name: 'main', url: stagehand.page.url() || 'about:blank' }],
            active_tab_name: 'main'
          });
          browserState = await this.browserStateService.getBrowserState(workflowId);
        }
      }
      
      // Deploy scout with node executor and browser state
      const findings = await this.scoutService.deployScout({
        instruction,
        tabName: tabName || 'main',
        workflowId,
        nodeExecutor: this.nodeExecutor,
        browserState: browserState || { tabs: [] }
      });
      
      console.log(`[DIRECTOR] Scout mission complete. Token usage:`, findings.token_usage);
      
      return findings;
      
    } catch (error) {
      console.error('Failed to deploy scout:', error);
      return {
        success: false,
        error: error.message,
        findings: 'Scout deployment failed'
      };
    }
  }

  /**
   * Consolidated browser action handler
   */
  async callBrowserAction(args, workflowId) {
    try {
      const { action, config = {}, reason } = args;
      
      console.log(`[BROWSER_ACTION] ${reason}: ${action} with config:`, config);
      
      // Import and create browser action service
      const { BrowserActionService } = await import('./browserActionService.js');
      const browserActionService = new BrowserActionService(
        this.nodeExecutor,
        workflowId,
        this.browserStateService
      );
      
      // Execute the action
      const result = await browserActionService.execute(action, config);
      
      return {
        success: true,
        ...result,
        reason
      };
      
    } catch (error) {
      console.error('[BROWSER_ACTION] Failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Debug navigation methods - for exploration without creating workflow nodes
   */
  
  async debugNavigate(args, workflowId) {
    try {
      const { url, tabName = 'main', reason } = args;
      
      console.log(`[DEBUG_NAV] ${reason}: Navigating to ${url} in tab "${tabName}"`);
      
      // Get stagehand instance
      const stagehand = await this.nodeExecutor.getStagehand();
      
      // Get the appropriate page
      let page;
      if (tabName === 'main') {
        page = this.nodeExecutor.mainPage || stagehand.page;
      } else {
        // Check if tab exists
        if (!this.nodeExecutor.stagehandPages || !this.nodeExecutor.stagehandPages[tabName]) {
          throw new Error(`Tab "${tabName}" does not exist. Use debug_open_tab first.`);
        }
        page = this.nodeExecutor.stagehandPages[tabName];
      }
      
      // Navigate
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      
      // Update browser state
      const browserState = await this.browserStateService.getBrowserState(workflowId);
      const tabs = browserState?.tabs || [];
      
      // Update or add tab
      const tabIndex = tabs.findIndex(t => t.name === tabName);
      if (tabIndex >= 0) {
        tabs[tabIndex].url = url;
      } else {
        tabs.push({ name: tabName, url });
      }
      
      await this.browserStateService.updateBrowserState(workflowId, {
        tabs,
        activeTabName: tabName
      });
      
      return { 
        success: true, 
        navigated_to: url,
        tab: tabName,
        reason 
      };
      
    } catch (error) {
      console.error('[DEBUG_NAV] Navigation failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async debugClick(args, workflowId) {
    try {
      const { selector, tabName = 'main', reason } = args;
      
      console.log(`[DEBUG_CLICK] ${reason}: Clicking "${selector}" in tab "${tabName}"`);
      
      // Get the appropriate page
      const stagehand = await this.nodeExecutor.getStagehand();
      let page;
      if (tabName === 'main') {
        page = this.nodeExecutor.mainPage || stagehand.page;
      } else {
        if (!this.nodeExecutor.stagehandPages || !this.nodeExecutor.stagehandPages[tabName]) {
          throw new Error(`Tab "${tabName}" does not exist.`);
        }
        page = this.nodeExecutor.stagehandPages[tabName];
      }
      
      // Perform click based on selector type
      if (selector.startsWith('text:')) {
        // Text-based click
        const text = selector.substring(5).trim();
        await stagehand.act({ action: `click on "${text}"` });
      } else if (selector.startsWith('act:')) {
        // Natural language click
        const instruction = selector.substring(4).trim();
        await stagehand.act({ action: instruction });
      } else {
        // CSS selector click
        await page.click(selector, { timeout: 10000 });
      }
      
      return {
        success: true,
        clicked: selector,
        tab: tabName,
        reason
      };
      
    } catch (error) {
      console.error('[DEBUG_CLICK] Click failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async debugType(args, workflowId) {
    try {
      const { selector, text, tabName = 'main', reason } = args;
      
      console.log(`[DEBUG_TYPE] ${reason}: Typing into "${selector}" in tab "${tabName}"`);
      
      // Get the appropriate page
      const stagehand = await this.nodeExecutor.getStagehand();
      let page;
      if (tabName === 'main') {
        page = this.nodeExecutor.mainPage || stagehand.page;
      } else {
        if (!this.nodeExecutor.stagehandPages || !this.nodeExecutor.stagehandPages[tabName]) {
          throw new Error(`Tab "${tabName}" does not exist.`);
        }
        page = this.nodeExecutor.stagehandPages[tabName];
      }
      
      // Clear and type
      await page.fill(selector, text);
      
      return {
        success: true,
        typed_into: selector,
        text: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
        tab: tabName,
        reason
      };
      
    } catch (error) {
      console.error('[DEBUG_TYPE] Type failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async debugWait(args, workflowId) {
    try {
      const { type, value, tabName = 'main', reason } = args;
      
      console.log(`[DEBUG_WAIT] ${reason}: Waiting for ${type} "${value}" in tab "${tabName}"`);
      
      // Get the appropriate page
      const stagehand = await this.nodeExecutor.getStagehand();
      let page;
      if (tabName === 'main') {
        page = this.nodeExecutor.mainPage || stagehand.page;
      } else {
        if (!this.nodeExecutor.stagehandPages || !this.nodeExecutor.stagehandPages[tabName]) {
          throw new Error(`Tab "${tabName}" does not exist.`);
        }
        page = this.nodeExecutor.stagehandPages[tabName];
      }
      
      if (type === 'time') {
        // Wait for specified time
        const ms = parseInt(value);
        await page.waitForTimeout(ms);
        return {
          success: true,
          waited_for: `${ms}ms`,
          tab: tabName,
          reason
        };
      } else if (type === 'selector') {
        // Wait for selector
        await page.waitForSelector(value, { timeout: 30000 });
        return {
          success: true,
          waited_for: `selector "${value}"`,
          tab: tabName,
          reason
        };
      } else {
        throw new Error(`Unknown wait type: ${type}`);
      }
      
    } catch (error) {
      console.error('[DEBUG_WAIT] Wait failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async debugOpenTab(args, workflowId) {
    try {
      const { url, tabName, reason } = args;
      
      console.log(`[DEBUG_OPEN_TAB] ${reason}: Opening new tab "${tabName}" with URL ${url}`);
      
      // Initialize stagehandPages if needed
      if (!this.nodeExecutor.stagehandPages) {
        this.nodeExecutor.stagehandPages = {};
      }
      
      // Check if tab already exists
      if (this.nodeExecutor.stagehandPages[tabName]) {
        throw new Error(`Tab "${tabName}" already exists`);
      }
      
      // Get browser context
      const stagehand = await this.nodeExecutor.getStagehand();
      const context = stagehand.context;
      
      // Create new page
      const newPage = await context.newPage();
      this.nodeExecutor.stagehandPages[tabName] = newPage;
      
      // Navigate if URL provided
      if (url && url !== 'about:blank') {
        await newPage.goto(url, { waitUntil: 'domcontentloaded' });
      }
      
      // Update browser state
      const browserState = await this.browserStateService.getBrowserState(workflowId);
      const tabs = browserState?.tabs || [];
      tabs.push({ name: tabName, url: url || 'about:blank' });
      
      await this.browserStateService.updateBrowserState(workflowId, {
        tabs,
        activeTabName: tabName
      });
      
      return {
        success: true,
        opened_tab: tabName,
        url: url || 'about:blank',
        reason
      };
      
    } catch (error) {
      console.error('[DEBUG_OPEN_TAB] Open tab failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async debugCloseTab(args, workflowId) {
    try {
      const { tabName, reason } = args;
      
      console.log(`[DEBUG_CLOSE_TAB] ${reason}: Closing tab "${tabName}"`);
      
      if (tabName === 'main') {
        throw new Error('Cannot close the main tab');
      }
      
      if (!this.nodeExecutor.stagehandPages || !this.nodeExecutor.stagehandPages[tabName]) {
        throw new Error(`Tab "${tabName}" does not exist`);
      }
      
      // Close the page
      const page = this.nodeExecutor.stagehandPages[tabName];
      await page.close();
      delete this.nodeExecutor.stagehandPages[tabName];
      
      // Update browser state
      const browserState = await this.browserStateService.getBrowserState(workflowId);
      const tabs = (browserState?.tabs || []).filter(t => t.name !== tabName);
      
      // Switch to main tab if we closed the active tab
      const activeTabName = browserState?.active_tab_name === tabName ? 'main' : browserState?.active_tab_name;
      
      await this.browserStateService.updateBrowserState(workflowId, {
        tabs,
        activeTabName
      });
      
      // Clear tab inspection cache
      if (this.tabInspectionService) {
        const tabInspectionService = (await import('./tabInspectionService.js')).default;
        tabInspectionService.clearCache(workflowId, tabName);
      }
      
      return {
        success: true,
        closed_tab: tabName,
        reason
      };
      
    } catch (error) {
      console.error('[DEBUG_CLOSE_TAB] Close tab failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async debugSwitchTab(args, workflowId) {
    try {
      const { tabName, reason } = args;
      
      console.log(`[DEBUG_SWITCH_TAB] ${reason}: Switching to tab "${tabName}"`);
      
      // Get the appropriate page
      const stagehand = await this.nodeExecutor.getStagehand();
      let targetPage;
      
      if (tabName === 'main') {
        targetPage = this.nodeExecutor.mainPage || stagehand.page;
      } else {
        if (!this.nodeExecutor.stagehandPages || !this.nodeExecutor.stagehandPages[tabName]) {
          throw new Error(`Tab "${tabName}" does not exist.`);
        }
        targetPage = this.nodeExecutor.stagehandPages[tabName];
      }
      
      // Bring the page to front
      await targetPage.bringToFront();
      
      // Update stagehand's current page
      stagehand.page = targetPage;
      
      // Update browser state to reflect the active tab
      const browserState = await this.browserStateService.getBrowserState(workflowId);
      if (browserState) {
        await this.browserStateService.updateBrowserState(workflowId, {
          ...browserState,
          active_tab_name: tabName
        });
      }
      
      console.log(`[DEBUG_SWITCH_TAB] Successfully switched to tab "${tabName}"`);
      
      return {
        success: true,
        switched_to: tabName,
        reason
      };
      
    } catch (error) {
      console.error('[DEBUG_SWITCH_TAB] Switch tab failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Parse node selection string into array of positions
   * Supports: "5", "3-5", "1-3,10,15-17,25", "all"
   */
  async parseNodeSelection(selectionString, workflowId) {
    if (selectionString === 'all') {
      // Get all node positions for this workflow
      const { data: nodes } = await this.supabase
        .from('nodes')
        .select('position')
        .eq('workflow_id', workflowId)
        .order('position');
      
      return nodes ? nodes.map(n => n.position) : [];
    }
    
    const positions = [];
    const parts = selectionString.split(',');
    
    for (const part of parts) {
      const trimmed = part.trim();
      
      if (trimmed.includes('-')) {
        // Handle range: "3-5" → [3,4,5]
        const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
        
        if (isNaN(start) || isNaN(end) || start > end) {
          throw new Error(`Invalid range: "${trimmed}". Range should be like "3-5"`);
        }
        
        for (let i = start; i <= end; i++) {
          positions.push(i);
        }
      } else {
        // Handle individual: "20" → [20]
        const position = parseInt(trimmed);
        
        if (isNaN(position)) {
          throw new Error(`Invalid position: "${trimmed}". Position should be a number`);
        }
        
        positions.push(position);
      }
    }
    
    // Remove duplicates and sort by position to maintain workflow order
    return [...new Set(positions)].sort((a, b) => a - b);
  }

  /**
   * Execute specific nodes by position selection
   * This gives Director the same execution capability as the frontend UI
   */
  async executeNodes(args, workflowId) {
    try {
      const { nodeSelection, resetBrowserFirst = false, mode = 'isolated' } = args;
      
      console.log(`[EXECUTE_NODES] Starting execution of: ${nodeSelection}`);
      console.log(`[EXECUTE_NODES] Reset browser first: ${resetBrowserFirst}`);
      console.log(`[EXECUTE_NODES] Execution mode: ${mode}`);
      
      // Parse node selection string into positions array
      const positions = await this.parseNodeSelection(nodeSelection, workflowId);
      console.log(`[EXECUTE_NODES] Parsed positions: [${positions.join(', ')}]`);
      
      if (positions.length === 0) {
        return {
          execution_results: [],
          summary: {
            total_requested: 0,
            successfully_executed: 0,
            failed: 0,
            execution_time: '0s'
          },
          message: 'No nodes to execute'
        };
      }
      
      // Get nodes for the specified positions
      const { data: availableNodes, error: nodesError } = await this.supabase
        .from('nodes')
        .select('id, position, type, description, params')
        .eq('workflow_id', workflowId)
        .in('position', positions)
        .order('position');
      
      if (nodesError) {
        throw new Error(`Failed to fetch nodes: ${nodesError.message}`);
      }
      
      console.log(`[EXECUTE_NODES] Found ${availableNodes.length} nodes out of ${positions.length} requested positions`);
      
      // Check for missing positions
      const foundPositions = availableNodes.map(n => n.position);
      const missingPositions = positions.filter(p => !foundPositions.includes(p));
      
      if (missingPositions.length > 0) {
        console.warn(`[EXECUTE_NODES] Missing positions: [${missingPositions.join(', ')}]`);
      }
      
      // Reset browser if requested
      if (resetBrowserFirst) {
        console.log(`[EXECUTE_NODES] Resetting browser session`);
        await this.nodeExecutor.cleanup();
        await this.nodeExecutor.getStagehand(); // This will create a fresh browser
      }
      
      // Execute each node
      const results = [];
      const startTime = Date.now();
      const skippedNodes = new Set(); // Track nodes to skip in flow mode
      
      for (const node of availableNodes) {
        // Flow mode: Check if this node should be skipped
        if (mode === 'flow') {
          // Skip nodes that are in unexecuted route branches
          if (skippedNodes.has(node.position)) {
            console.log(`[FLOW] Skipping node at position ${node.position} (inside unexecuted route branch)`);
            results.push({
              node_position: node.position,
              node_id: node.id,
              status: 'skipped',
              message: 'Skipped due to route decision',
              execution_time: '0s'
            });
            continue;
          }
          
          // Skip nested nodes (they'll be executed by their parent)
          if (node.params?._parent_position) {
            console.log(`[FLOW] Skipping nested node at position ${node.position} (will be executed by parent)`);
            results.push({
              node_position: node.position,
              node_id: node.id,
              status: 'skipped',
              message: 'Nested node - executed by parent',
              execution_time: '0s'
            });
            continue;
          }
        }
        
        const nodeStartTime = Date.now();
        console.log(`[EXECUTE_NODES] Executing node ${node.position}: ${node.type} - ${node.description}`);
        
        try {
          const result = await this.nodeExecutor.execute(node.id, workflowId);
          
          // Extract page observation if present
          let pageObservation = null;
          let cleanResult = result.data;
          
          if (result.data && typeof result.data === 'object' && result.data._page_observation) {
            pageObservation = result.data._page_observation;
            // Remove the _page_observation from the result to keep it clean
            const { _page_observation, ...restOfResult } = result.data;
            cleanResult = restOfResult;
          }
          
          results.push({
            node_position: node.position,
            node_id: node.id,
            status: 'success',
            result: cleanResult,
            execution_time: `${((Date.now() - nodeStartTime) / 1000).toFixed(1)}s`,
            page_observation: pageObservation
          });
          
          console.log(`[EXECUTE_NODES] ✅ Node ${node.position} executed successfully`);
          
          // In flow mode, track route decisions
          if (mode === 'flow' && node.type === 'route' && cleanResult?.path) {
            this.updateSkippedNodes(node, cleanResult, skippedNodes);
          }
        } catch (error) {
          console.error(`[EXECUTE_NODES] ❌ Node ${node.position} failed:`, error.message);
          
          results.push({
            node_position: node.position,
            node_id: node.id,
            status: 'error',
            error_details: error.message,
            execution_time: `${((Date.now() - nodeStartTime) / 1000).toFixed(1)}s`
          });
          
          // Stop execution on first error
          console.log(`[EXECUTE_NODES] 🛑 Stopping execution due to node failure`);
          break;
        }
      }
      
      // Add results for missing positions
      for (const missingPos of missingPositions) {
        results.push({
          node_position: missingPos,
          node_id: null,
          status: 'error',
          error_details: 'Node not found at this position',
          execution_time: '0s'
        });
      }
      
      // Sort results by position
      results.sort((a, b) => a.node_position - b.node_position);
      
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
      const successCount = results.filter(r => r.status === 'success').length;
      const failCount = results.filter(r => r.status === 'error').length;
      const skippedCount = results.filter(r => r.status === 'skipped').length;
      
      console.log(`[EXECUTE_NODES] Execution complete: ${successCount} success, ${failCount} failed, ${skippedCount} skipped, ${totalTime}s total`);
      
      return {
        execution_results: results,
        summary: {
          total_requested: positions.length,
          successfully_executed: successCount,
          failed: failCount,
          skipped: skippedCount,
          execution_time: `${totalTime}s`
        }
      };
      
    } catch (error) {
      console.error('Failed to execute nodes:', error);
      return {
        execution_results: [],
        summary: {
          total_requested: 0,
          successfully_executed: 0,
          failed: 1,
          execution_time: '0s'
        },
        error: error.message
      };
    }
  }

  /**
   * Update skippedNodes set based on route decision
   */
  updateSkippedNodes(routeNode, result, skippedNodes) {
    console.log(`[FLOW] Route at position ${routeNode.position} took path: ${result.path}`);
    
    // Handle new format (params array)
    if (Array.isArray(routeNode.params)) {
      routeNode.params.forEach(branch => {
        if (branch.name !== result.path) {
          // Mark all positions in non-taken branches
          const positions = Array.isArray(branch.branch) ? branch.branch : [branch.branch];
          positions.forEach(pos => {
            if (typeof pos === 'number') {
              skippedNodes.add(pos);
              console.log(`[FLOW] Marking position ${pos} as skipped (${branch.name} branch not taken)`);
            }
          });
        }
      });
    }
    // Handle old format (params.paths object) for backward compatibility
    else if (routeNode.params?.paths) {
      for (const [branchName, branchNodes] of Object.entries(routeNode.params.paths)) {
        if (branchName !== result.path) {
          if (Array.isArray(branchNodes)) {
            branchNodes.forEach(pos => {
              if (typeof pos === 'number') {
                skippedNodes.add(pos);
                console.log(`[FLOW] Marking position ${pos} as skipped (${branchName} branch not taken)`);
              }
            });
          }
        }
      }
    }
    
    console.log(`[FLOW] Total nodes marked for skipping: ${skippedNodes.size}`);
  }

  /**
   * Check if a model is a reasoning model that requires Responses API
   */
  isReasoningModel(model) {
    const reasoningModels = ['o4-mini', 'o3', 'o4-mini-2025-04-16', 'o3-2025-04-16'];
    return reasoningModels.includes(model);
  }

  /**
   * Check if a model is a KIMI model that requires OpenRouter
   */
  isKimiModel(model) {
    const kimiModels = ['kimi-k2', 'moonshotai/kimi-k2'];
    return kimiModels.some(kimiModel => 
      model.toLowerCase().includes(kimiModel.toLowerCase())
    );
  }

  /**
   * Get the selected model with validation and fallback logic
   */
  getSelectedModel(requestedModel) {
    const allowedModels = [
      'o4-mini', 
      'o3',
      'gpt-4',
      'gpt-4-turbo',
      'gpt-3.5-turbo',
      'kimi-k2',
      'moonshotai/kimi-k2'
    ];
    
    // Priority order:
    // 1. Valid requested model from UI
    // 2. Environment variable
    // 3. Default to o4-mini
    if (requestedModel && allowedModels.includes(requestedModel)) {
      console.log(`[DIRECTOR MODEL] Using UI-selected model: ${requestedModel}`);
      console.log(`[DIRECTOR MODEL] Source: Frontend UI Toggle`);
      return requestedModel;
    }
    
    const envModel = process.env.DIRECTOR_MODEL;
    if (envModel && (this.isReasoningModel(envModel) || this.isKimiModel(envModel) || allowedModels.includes(envModel))) {
      console.log(`[DIRECTOR MODEL] Using environment variable model: ${envModel}`);
      console.log(`[DIRECTOR MODEL] Source: DIRECTOR_MODEL environment variable`);
      return envModel;
    }
    
    console.log(`[DIRECTOR MODEL] Using default model: o4-mini`);
    console.log(`[DIRECTOR MODEL] Source: Default fallback`);
    return 'o4-mini';
  }

  /**
   * Poll background job until completion
   * @param {string} jobId - The background job ID to poll
   * @param {string} workflowId - The workflow ID for cancellation checking
   * @returns {Promise<Object>} The completed job response
   */
  async pollBackgroundJob(jobId, workflowId) {
    let pollInterval = 2000; // Start with 2 seconds
    const maxInterval = 30000; // Max 30 seconds between polls
    let attempts = 0;
    const maxAttempts = 300; // 5 minutes worth of 1-second polls initially
    
    console.log(`[BACKGROUND MODE] Starting to poll job ${jobId}`);
    
    while (attempts < maxAttempts) {
      // Check for cancellation
      const execution = this.getActiveExecution(workflowId);
      if (execution?.abortController.signal.aborted) {
        console.log(`[BACKGROUND MODE] Job polling cancelled by user for job ${jobId}`);
        throw new Error('Background job polling cancelled by user');
      }
      
      try {
        // Retrieve job status
        const job = await this.openai.responses.retrieve(jobId);
        
        console.log(`[BACKGROUND MODE] Job ${jobId} status: ${job.status} (attempt ${attempts + 1})`);
        
        if (job.status === 'completed') {
          console.log(`[BACKGROUND MODE] Job ${jobId} completed successfully after ${attempts + 1} polls`);
          return job;
        }
        
        if (job.status === 'failed') {
          const errorMsg = job.error?.message || 'Unknown error';
          const errorCode = job.error?.code || 'unknown';
          
          console.error(`[BACKGROUND MODE] Job ${jobId} failed: ${errorMsg} (code: ${errorCode})`);
          
          // Check if it's a rate limit error that we should retry
          if (errorCode === 'rate_limit_exceeded') {
            console.log(`[BACKGROUND MODE] Rate limit hit, but job failed. Consider retrying with a new job.`);
          }
          
          throw new Error(`Background job failed: ${errorMsg}`);
        }
        
        if (job.status === 'cancelled') {
          throw new Error(`Background job was cancelled`);
        }
        
        // Wait before next poll with exponential backoff
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        // Increase interval with exponential backoff (1.5x each time, capped at maxInterval)
        pollInterval = Math.min(pollInterval * 1.5, maxInterval);
        attempts++;
        
      } catch (error) {
        console.error(`[BACKGROUND MODE] Error polling job ${jobId}:`, error);
        throw error;
      }
    }
    
    throw new Error(`Background job ${jobId} timed out after ${attempts} attempts`);
  }

  /**
   * Call OpenAI API with abort signal support
   * @param {Object} params - API parameters
   * @param {AbortSignal} signal - Abort signal for cancellation
   * @param {string} apiType - 'responses' or 'chat' to determine which API to use
   * @returns {Promise<Object>} API response
   */
  async callOpenAIWithSignal(params, signal, apiType = 'chat') {
    try {
      // First try with the SDK if it supports signals
      if (apiType === 'responses') {
        // Try with signal parameter if supported
        const response = await this.openai.responses.create({
          ...params,
          signal
        });
        return response;
      } else {
        // For chat completions
        const response = await this.openai.chat.completions.create({
          ...params,
          signal
        });
        return response;
      }
    } catch (error) {
      // If signal is not supported by SDK, fallback to fetch
      if (error.message?.includes('signal') || !error.response) {
        console.log('[OPENAI] SDK does not support abort signal, falling back to fetch');
        return this.callOpenAIViaFetch(params, signal, apiType);
      }
      throw error;
    }
  }

  /**
   * Fallback method to call OpenAI API directly via fetch with abort signal
   * @param {Object} params - API parameters
   * @param {AbortSignal} signal - Abort signal for cancellation
   * @param {string} apiType - 'responses' or 'chat'
   * @returns {Promise<Object>} API response
   */
  async callOpenAIViaFetch(params, signal, apiType) {
    const endpoint = apiType === 'responses' 
      ? 'https://api.openai.com/v1/responses'
      : 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        ...(process.env.OPENAI_ORG_ID && { 'OpenAI-Organization': process.env.OPENAI_ORG_ID })
      },
      body: JSON.stringify(params),
      signal
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Broadcast reasoning updates to WebSocket clients via API (with fallback)
   */
  async broadcastReasoningUpdate(workflowId, data) {
    try {
      // Try multiple possible ports for the frontend server
      const ports = [3000, 3003, 3001];
      let success = false;
      
      for (const port of ports) {
        try {
          const response = await fetch(`http://localhost:${port}/api/reasoning/broadcast`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              executionId: workflowId,
              data
            })
          });

          if (response.ok) {
            console.log(`[DIRECTOR] Successfully broadcast reasoning update on port ${port}`);
            success = true;
            break;
          }
        } catch (portError) {
          // Try next port
          continue;
        }
      }
      
      if (!success) {
        console.log(`[DIRECTOR] Frontend API not available, reasoning update logged locally: ${data.type} - ${data.text || ''}`);
      }
    } catch (error) {
      console.error('[DIRECTOR] Error broadcasting reasoning update:', error);
    }
  }

  /**
   * Convert tool definitions from Chat Completions format to Responses API format
   * Chat Completions: { type: 'function', function: { name, description, parameters } }
   * Responses API: { type: 'function', name, description, parameters }
   */
  convertToolsForResponsesAPI(chatTools) {
    return chatTools.map(tool => {
      if (tool.type === 'function' && tool.function) {
        return {
          type: 'function',
          name: tool.function.name,
          description: tool.function.description,
          parameters: tool.function.parameters
        };
      }
      return tool; // Return as-is if already in correct format
    });
  }

  /**
   * Process message using OpenRouter for KIMI models
   */
  async processWithKIMI(model, messages, workflowId) {
    try {
      if (!this.openRouterClient) {
        throw new Error('OpenRouter client not initialized. Please set OPENROUTER_API_KEY in environment variables.');
      }

      const tools = createToolDefinitions();
      
      // Filter out any invalid message roles (like 'error')
      const validRoles = ['system', 'assistant', 'user', 'function', 'tool'];
      const filteredMessages = messages.filter(msg => validRoles.includes(msg.role));
      
      if (filteredMessages.length !== messages.length) {
        console.log(`[KIMI] Filtered out ${messages.length - filteredMessages.length} invalid messages`);
      }
      
      console.log('[KIMI] Making initial request to KIMI K2 via OpenRouter');
      console.log(`[KIMI] Messages: ${filteredMessages.length}, Tools: ${tools.length}`);
      console.log('[KIMI] Using PAID tier as default');
      
      // Try paid tier first (full tool support)
      const response = await this.openRouterClient.chat.completions.create({
        model: 'moonshotai/kimi-k2', // Paid version as default
        messages: filteredMessages,
        tools,
        tool_choice: 'auto',
        temperature: 0.6, // Recommended for KIMI
        stream: false,
        max_tokens: 4096
      });

      // Implement recursive tool execution loop (like Responses API)
      let currentMessages = [...filteredMessages];
      let currentResponse = response;
      let allToolCalls = [];
      let totalUsage = {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0
      };
      let iterations = 0;
      const MAX_ITERATIONS = 10; // Safety limit
      
      // Keep processing while KIMI wants to use tools
      while (currentResponse.choices[0].message.tool_calls?.length > 0 && iterations < MAX_ITERATIONS) {
        iterations++;
        const assistantMessage = currentResponse.choices[0].message;
        
        console.log(`[KIMI] Iteration ${iterations}: Processing ${assistantMessage.tool_calls.length} tool calls`);
        
        // Execute tool calls
        const toolResults = await this.processToolCalls(assistantMessage.tool_calls, workflowId);
        allToolCalls.push(...assistantMessage.tool_calls);
        
        // Update usage
        totalUsage.prompt_tokens += currentResponse.usage.prompt_tokens;
        totalUsage.completion_tokens += currentResponse.usage.completion_tokens;
        totalUsage.total_tokens += currentResponse.usage.total_tokens;
        
        // Build messages for next iteration
        currentMessages.push(assistantMessage);
        currentMessages.push({
          role: 'tool',
          content: JSON.stringify(toolResults),
          tool_call_id: assistantMessage.tool_calls[0].id
        });
        
        // Make next request to see if KIMI wants to call more tools
        console.log(`[KIMI] Checking if more tools needed (iteration ${iterations})`);
        currentResponse = await this.openRouterClient.chat.completions.create({
          model: 'moonshotai/kimi-k2',
          messages: currentMessages,
          tools,
          tool_choice: 'auto',
          temperature: 0.6,
          stream: false,
          max_tokens: 4096
        });
      }
      
      // Final usage calculation
      totalUsage.prompt_tokens += currentResponse.usage.prompt_tokens;
      totalUsage.completion_tokens += currentResponse.usage.completion_tokens;
      totalUsage.total_tokens += currentResponse.usage.total_tokens;
      
      // Calculate cost
      const inputCost = (totalUsage.prompt_tokens / 1_000_000) * 0.15;
      const outputCost = (totalUsage.completion_tokens / 1_000_000) * 2.50;
      const totalCost = inputCost + outputCost;
      
      console.log(`[KIMI] Completed after ${iterations} iterations`);
      console.log(`[KIMI] Total tool calls: ${allToolCalls.length}`);
      console.log(`[KIMI] Total tokens used: ${totalUsage.total_tokens} (cost: $${totalCost.toFixed(6)})`);
      
      if (iterations === 0) {
        console.log('[KIMI] No tool calls needed, returning direct response');
      } else if (iterations === MAX_ITERATIONS) {
        console.log('[KIMI] Warning: Hit maximum iteration limit');
      }
      
      // Return final response with all tool calls
      return {
        id: currentResponse.id,
        object: 'chat.completion',
        created: currentResponse.created,
        model: 'kimi-k2',
        choices: [{
          index: 0,
          message: {
            role: 'assistant',
            content: currentResponse.choices[0].message.content,
            tool_calls: allToolCalls.length > 0 ? allToolCalls : undefined
          },
          finish_reason: currentResponse.choices[0].finish_reason
        }],
        usage: totalUsage
      };
      
    } catch (error) {
      console.error('[KIMI] Error processing with KIMI:', error);
      
      // Try free tier as fallback if paid tier fails
      if (error.status && error.status !== 429) {
        console.log('[KIMI] Paid tier failed, trying free tier as fallback');
        try {
          const response = await this.openRouterClient.chat.completions.create({
            model: 'moonshotai/kimi-k2:free', // Free version as fallback
            messages: filteredMessages,
            // Note: Free tier doesn't support tools
            temperature: 0.6,
            stream: false,
            max_tokens: 4096
          });
          
          console.log('[KIMI-FREE] Free tier response received (no tool support)');
          return response;
        } catch (freeError) {
          console.error('[KIMI-FREE] Free tier also failed:', freeError);
          // Will re-throw original error
        }
      }
      
      // Re-throw error if both KIMI versions fail
      console.log('[KIMI] Both paid and free tiers failed, throwing error');
      throw error;
    }
  }

  /**
   * Process message using OpenAI Responses API for reasoning models with full control loop
   */
  async processWithResponsesAPI(model, messages, workflowId) {
    try {
      // Check if we're using background mode for o3
      const useBackgroundMode = model === 'o3';
      
      // Load context based on mode
      let encryptedContext = [];
      let previousResponseId = null;
      
      if (useBackgroundMode) {
        // For background mode, try to get the last response ID for this workflow
        previousResponseId = await this.getLastResponseId(workflowId);
        if (previousResponseId) {
          console.log(`[BACKGROUND MODE] Using previous_response_id: ${previousResponseId} for context`);
        } else {
          console.log(`[BACKGROUND MODE] No previous response found, starting fresh conversation`);
        }
      } else {
        // For non-background mode, load encrypted reasoning context
        encryptedContext = await this.loadReasoningContext(workflowId);
        console.log(`[🔍 ENCRYPTED_CONTEXT] Loaded ${encryptedContext.length} encrypted reasoning blobs from previous turns`);
      }
      
      // Convert messages to Responses API format
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');
      
      // Build initial input array - exclude encrypted context for background mode
      const initialInput = [
        ...(useBackgroundMode ? [] : encryptedContext),
        ...userMessages.map(msg => ({
          type: 'message',
          role: msg.role,
          content: msg.content
        }))
      ];

      // Enhanced logging for debugging token counts
      console.log('[🔍 RESPONSES_API_DEBUG] Initial input details:');
      console.log(`  - Encrypted context items: ${encryptedContext.length}`);
      console.log(`  - User/Assistant messages: ${userMessages.length}`);
      console.log(`  - Total input array length: ${initialInput.length}`);
      console.log(`  - Input stringified size: ${JSON.stringify(initialInput).length} characters`);
      console.log(`  - System prompt size: ${systemMessage?.content?.length || 0} characters`);
      
      // Log the actual content being sent (first 500 chars of each message)
      initialInput.forEach((item, idx) => {
        if (item.type === 'message') {
          const preview = item.content ? item.content.substring(0, 500) : 'null';
          console.log(`  - Input[${idx}] (${item.role}): ${preview}${item.content?.length > 500 ? '...' : ''}`);
          
          // Check for director2Context patterns in each message
          if (item.content && item.role === 'user') {
            const contextOccurrences = (item.content.match(/CURRENT PLAN/g) || []).length;
            if (contextOccurrences > 0) {
              console.log(`    [🔍 CONTEXT COUNT] This user message contains ${contextOccurrences} director2Context occurrence(s)`);
              console.log(`    [🔍 MESSAGE LENGTH] ${item.content.length} characters`);
            }
          }
        } else if (item.type === 'reasoning' && item.encrypted_content) {
          console.log(`  - Input[${idx}] (encrypted reasoning): ${JSON.stringify(item.encrypted_content).substring(0, 100)}... (${JSON.stringify(item).length} chars total)`);
        }
      });

      // Run the full control loop
      return await this.runDirectorControlLoop(model, systemMessage?.content || DIRECTOR_SYSTEM_PROMPT, initialInput, workflowId, 0, previousResponseId);

    } catch (error) {
      console.error('[RESPONSES_API] Error:', error);
      throw error;
    }
  }

  /**
   * Simplified non-streaming control loop for reasoning models with tool calling
   * Radically simplified approach - single blocking call per step with accurate token counts
   */
  async runDirectorControlLoop(model, instructions, initialInput, workflowId, recursionDepth = 0, previousResponseId = null) {
    console.log(`[CONTROL_LOOP] Starting blocking loop (depth ${recursionDepth}) with ${initialInput.length} input items`);
    
    // Convert tools from Chat Completions format to Responses API format
    const chatTools = createToolDefinitions();
    const responsesTools = this.convertToolsForResponsesAPI(chatTools);

    // Check if we should use background mode for o3
    const useBackgroundMode = model === 'o3';
    
    if (useBackgroundMode) {
      console.log(`[BACKGROUND MODE] Using background mode for ${model} to handle rate limits`);
    }

    // Make request with conditional background mode
    const requestParams = {
      model,
      instructions,
      input: initialInput,
      tools: responsesTools,
      stream: false  // KEY CHANGE: No streaming = accurate token counts immediately
    };

    // Configure for background mode (o3 only)
    if (useBackgroundMode) {
      // Background mode configuration
      requestParams.background = true;
      requestParams.store = true;  // Required by OpenAI for background mode
      
      // Add previous_response_id if available for context continuity
      if (previousResponseId) {
        requestParams.previous_response_id = previousResponseId;
        console.log(`[BACKGROUND MODE] Including previous_response_id: ${previousResponseId}`);
      } else {
        console.log(`[BACKGROUND MODE] No previous response ID available - starting fresh context`);
      }
      
      // Add reasoning summary for debugging
      requestParams.reasoning = { 
        effort: 'medium', 
        summary: 'detailed'  // Get human-readable summaries
      };
      
      console.log(`[BACKGROUND MODE] Enabling store=true for background job processing`);
      console.log(`[BACKGROUND MODE] Using stateful context via previous_response_id instead of encrypted blobs`);
    } else {
      // Non-background mode can use encrypted content
      requestParams.include = ['reasoning.encrypted_content'];
      requestParams.store = false;  // Required for encrypted content
    }

    const response = await this.openai.responses.create(requestParams);

    // Handle background job polling for o3
    let finalResponse;
    if (useBackgroundMode && response.id && response.status) {
      console.log(`[BACKGROUND MODE] Job queued with ID: ${response.id}, status: ${response.status}`);
      finalResponse = await this.pollBackgroundJob(response.id);
    } else {
      finalResponse = response;
    }

    console.log(`[CONTROL_LOOP] ${useBackgroundMode ? 'Background job completed' : 'Blocking response received'}. Processing...`);
    
    // Debug: Log response output types
    const outputTypes = finalResponse.output.map(item => item.type);
    console.log(`[RESPONSE_DEBUG] Output types in response:`, outputTypes);
    console.log(`[RESPONSE_DEBUG] Total output items:`, finalResponse.output.length);

    // Extract data from blocking response
    const assistantMessages = finalResponse.output.filter(item => item.type === 'message' && item.role === 'assistant');
    const functionCalls = finalResponse.output.filter(item => item.type === 'function_call');
    const encryptedBlobs = finalResponse.output.filter(item => item.type === 'reasoning' && item.encrypted_content);
    
    console.log(`[ENCRYPTED_BLOBS] Found ${encryptedBlobs.length} encrypted reasoning blobs in response`);
    if (encryptedBlobs.length > 0) {
      console.log(`[ENCRYPTED_BLOBS] First blob preview:`, JSON.stringify(encryptedBlobs[0]).substring(0, 200) + '...');
    }
    
    // Get assistant content
    const assistantContent = assistantMessages
      .flatMap(msg => msg.content || [])
      .map(content => content.text || '')
      .join('');
    
    // Extract reasoning summary from reasoning output items (available immediately with blocking response)
    const reasoningItems = finalResponse.output.filter(item => item.type === 'reasoning' && item.summary);
    const reasoningSummary = reasoningItems.length > 0 ? 
      reasoningItems.map(item => item.summary.map(s => s.text).join('\n')).join('\n\n') : 
      null;

    // Get accurate token usage immediately (no streaming = no retrieval needed!)
    // CRITICAL: Understanding OpenAI's token counting:
    // - input_tokens = TOTAL tokens sent to API (cached + uncached)
    // - cached_tokens = subset of input_tokens that were cached (75% discount)
    // - uncached tokens = input_tokens - cached_tokens (full price)
    const tokenUsage = {
      input_tokens: finalResponse.usage.input_tokens,  // <-- THIS IS THE TOTAL YOU WANT!
      output_tokens: finalResponse.usage.output_tokens,
      total_tokens: finalResponse.usage.total_tokens,
      output_tokens_details: {
        reasoning_tokens: finalResponse.usage.output_tokens_details?.reasoning_tokens || 0
      },
      // Cached tokens are a SUBSET of input_tokens, not additional
      cached_tokens: finalResponse.usage.input_tokens_details?.cached_tokens || 0,
      // For backwards compatibility, actual_input_tokens = input_tokens (the total)
      actual_input_tokens: finalResponse.usage.input_tokens
    };
    
    console.log('[RESPONSES_API] Accurate token usage (no streaming):', {
      TOTAL_INPUT_TOKENS_SENT_TO_API: tokenUsage.input_tokens,  // THIS IS WHAT YOU WANT!
      breakdown: {
        cached_portion: tokenUsage.cached_tokens,
        uncached_portion: tokenUsage.input_tokens - tokenUsage.cached_tokens
      },
      output: tokenUsage.output_tokens,
      reasoning: tokenUsage.output_tokens_details.reasoning_tokens,
      total: tokenUsage.total_tokens
    });
    
    // Debug: Log full usage details to understand caching
    if (tokenUsage.cached_tokens > 0) {
      console.log('[CACHE_DEBUG] Full usage object:', JSON.stringify(finalResponse.usage, null, 2));
      console.log('[CACHE_DEBUG] Unexpected caching at depth', recursionDepth, '- investigating...');
    }

    // Handle tool calls if present
    if (functionCalls.length > 0) {
      console.log(`[CONTROL_LOOP] ${functionCalls.length} function calls detected`);
      
      const executedTools = [];
      const followUps = [];
      
      // For background mode, we need to include ALL output items (including reasoning)
      // to maintain the required associations between function_calls and reasoning items
      if (useBackgroundMode) {
        console.log(`[BACKGROUND MODE] Including all output items for stateful context`);
        // Add all output items from the response (reasoning + function_calls)
        followUps.push(...finalResponse.output);
      }
      
      // Execute all tool calls
      for (const call of functionCalls) {
        try {
          console.log(`[CONTROL_LOOP] Executing tool: ${call.name}`);
          const toolResult = await this.executeToolCall(call, workflowId);
          
          executedTools.push({
            name: call.name,
            arguments: call.arguments,
            result: toolResult,
            call_id: call.call_id
          });
          
          // Add to follow-up input
          if (!useBackgroundMode) {
            // For non-background mode, only add the function call
            followUps.push(call);
          }
          followUps.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: (toolResult.output && typeof toolResult.output === 'string') 
              ? toolResult.output 
              : JSON.stringify(toolResult)
          });
          
        } catch (toolError) {
          console.error(`[CONTROL_LOOP] Tool execution failed:`, toolError);
          
          executedTools.push({
            name: call.name,
            arguments: call.arguments,
            error: toolError.message || 'Tool execution failed',
            call_id: call.call_id
          });
          
          // Add error to follow-up input
          if (!useBackgroundMode) {
            // For non-background mode, only add the function call
            followUps.push(call);
          }
          followUps.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({ error: true, message: toolError.message || 'Tool execution failed' })
          });
        }
      }
      
      // Continue the chain recursively with tool results
      const recursiveResult = await this.runDirectorControlLoop(
        model, 
        instructions, 
        initialInput.concat(followUps), 
        workflowId, 
        recursionDepth + 1,
        previousResponseId  // Pass through for consistency
      );
      
      // Merge executed tools from recursive call
      if (recursiveResult.executedTools) {
        executedTools.push(...recursiveResult.executedTools);
      }
      
      // IMPORTANT: For user-facing token counts, only return the INITIAL call's tokens
      // The recursive calls are internal implementation details
      const userFacingUsage = recursionDepth === 0 ? tokenUsage : recursiveResult.usage;
      
      // Log the actual total for debugging if needed
      if (recursionDepth === 0) {
        const totalUsage = this.mergeTokenUsage(tokenUsage, recursiveResult.usage);
        console.log(`[TOKEN_DEBUG] Initial message tokens: ${tokenUsage.input_tokens} in, ${tokenUsage.output_tokens} out`);
        console.log(`[TOKEN_DEBUG] Total with ${executedTools.length} tool executions: ${totalUsage.input_tokens} in, ${totalUsage.output_tokens} out`);
        
        // Store context based on mode
        if (useBackgroundMode && finalResponse.id) {
          // For background mode, store the response ID for next conversation
          console.log(`[BACKGROUND MODE] Storing response ID for future context: ${finalResponse.id}`);
          await this.saveResponseId(workflowId, finalResponse.id, 'completed');
        } else if (encryptedBlobs.length > 0 && tokenUsage) {
          // For non-background mode, store encrypted reasoning context
          console.log(`[REASONING_STORAGE] Storing ${encryptedBlobs.length} encrypted blobs from initial call`);
          await this.storeReasoningContextFromBlobs(workflowId, encryptedBlobs, tokenUsage);
        }
      }
      
      return {
        ...recursiveResult,
        executedTools,
        usage: userFacingUsage, // Only show the initial message tokens to user
        reasoning_summary: reasoningSummary || recursiveResult.reasoning_summary // Preserve reasoning summary
      };
    }
    
    // Store context based on mode
    if (useBackgroundMode && finalResponse.id) {
      // For background mode, store the response ID for next conversation
      console.log(`[BACKGROUND MODE] Storing response ID for future context: ${finalResponse.id}`);
      await this.saveResponseId(workflowId, finalResponse.id);
    } else if (encryptedBlobs.length > 0 && tokenUsage) {
      // For non-background mode, store encrypted reasoning context
      await this.storeReasoningContextFromBlobs(workflowId, encryptedBlobs, tokenUsage);
    }

    console.log(`[CONTROL_LOOP] Completed (depth ${recursionDepth}). Final response ready.`);

    // Return in format compatible with existing code
    return {
      choices: [{
        message: {
          content: assistantContent,
          tool_calls: null, // Tools were executed in the loop
          role: 'assistant',
          reasoning_summary: reasoningSummary // Include reasoning summary for immediate display
        }
      }],
      usage: tokenUsage,
      executedTools: [], // No tools executed at this level
      reasoning_summary: reasoningSummary // Also include at top level for compatibility
    };
  }

  /**
   * Merge token usage from multiple API calls (e.g., recursive calls)
   */
  mergeTokenUsage(usage1, usage2) {
    if (!usage1) return usage2;
    if (!usage2) return usage1;
    
    return {
      input_tokens: (usage1.input_tokens || 0) + (usage2.input_tokens || 0),
      output_tokens: (usage1.output_tokens || 0) + (usage2.output_tokens || 0),
      total_tokens: (usage1.total_tokens || 0) + (usage2.total_tokens || 0),
      output_tokens_details: {
        reasoning_tokens: 
          (usage1.output_tokens_details?.reasoning_tokens || 0) + 
          (usage2.output_tokens_details?.reasoning_tokens || 0)
      }
    };
  }

  /**
   * Execute a single tool call during the control loop
   */
  async executeToolCall(toolCallItem, workflowId) {
    const { name: toolName, arguments: toolArgs, call_id } = toolCallItem;
    const startTime = Date.now();
    
    console.log(`[TOOL_EXECUTION] Executing ${toolName} with call_id ${call_id}`);
    
    // Emit tool call start event
    await this.emitToolCallEvent(workflowId, {
      type: 'tool_call_start',
      callId: call_id,
      toolName,
      arguments: toolArgs,
      timestamp: new Date().toISOString()
    });
    
    try {
      
      const args = JSON.parse(toolArgs);
      let result;
      
      // Route to appropriate tool handler (same as existing processToolCalls)
      switch (toolName) {
        // New 2-function design
        case 'add_or_replace_nodes':
          result = await this.addOrReplaceNodes(args, workflowId);
          break;
        case 'delete_nodes':
          result = await this.deleteNodesByIdOrAlias(args, workflowId);
          break;
          
        // Legacy functions (to be removed)
        case 'create_node':
          result = await this.createNode(args, workflowId);
          break;
        case 'insert_node_at':
          result = await this.insertNodeAt(args, workflowId);
          break;
        case 'update_node':
          result = await this.updateNode(args, workflowId);
          break;
        case 'delete_node':
          result = await this.deleteNode(args);
          break;
        case 'execute_workflow':
          result = await this.executeWorkflow(workflowId);
          break;
        // Group tools removed - using group node type instead
        case 'update_plan':
          result = await this.updatePlan(args, workflowId);
          break;
        case 'update_workflow_description':
          result = await this.updateWorkflowDescription(args, workflowId);
          break;
        case 'execute_nodes':
          result = await this.executeNodes(args, workflowId);
          break;
        case 'get_workflow_variables':
          result = await this.getWorkflowVariable(args, workflowId);
          break;
        case 'set_variable':
          result = await this.setVariable(args, workflowId);
          break;
        case 'clear_variable':
          result = await this.clearVariable(args, workflowId);
          break;
        case 'clear_all_variables':
          result = await this.clearAllVariables(args, workflowId);
          break;
        case 'inspect_tab':
          result = await this.inspectTab(args, workflowId);
          break;
        case 'expand_dom_selector':
          result = await this.expandDomSelector(args, workflowId);
          break;
        case 'send_scout':
          result = await this.sendScout(args, workflowId);
          break;
        case 'debug_navigate':
          result = await this.debugNavigate(args, workflowId);
          break;
        case 'debug_click':
          result = await this.debugClick(args, workflowId);
          break;
        case 'debug_type':
          result = await this.debugType(args, workflowId);
          break;
        case 'debug_wait':
          result = await this.debugWait(args, workflowId);
          break;
        case 'debug_open_tab':
          result = await this.debugOpenTab(args, workflowId);
          break;
        case 'debug_close_tab':
          result = await this.debugCloseTab(args, workflowId);
          break;
        case 'debug_switch_tab':
          result = await this.debugSwitchTab(args, workflowId);
          break;
          
        // Consolidated Browser Action Tool
        case 'browser_action':
          result = await this.callBrowserAction(args, workflowId);
          break;
          
        // DOM Exploration Tools
        case 'dom_overview':
          result = await domToolkitService.domOverview(args, this.nodeExecutor);
          break;
        case 'dom_structure':
          result = await domToolkitService.domStructure(args, this.nodeExecutor);
          break;
        case 'dom_search':
          result = await domToolkitService.domSearch(args, this.nodeExecutor);
          break;
        case 'dom_inspect':
          result = await domToolkitService.domInspect(args, this.nodeExecutor);
          break;
        case 'dom_check_portals':
          result = await domToolkitService.domCheckPortals(args, this.nodeExecutor);
          break;
          
        // Clean Context 2.0 - Context Retrieval Tools
        case 'get_current_plan': {
          const plan = await this.planService.getCurrentPlan(workflowId);
          
          if (!plan || !plan.plan_data) {
            result = {
              status: 'no_plan',
              message: 'No plan exists yet. Use update_plan to create one.'
            };
          } else {
            result = {
              status: 'success',
              plan: plan.plan_data,
              lastUpdated: plan.updated_at,
              updateReason: plan.reason
            };
          }
          break;
        }
        
        case 'get_workflow_nodes': {
          const { range = 'all', type } = args;
          const workflowContext = await this.getWorkflowContext(workflowId);
          const nodes = workflowContext?.nodes || [];
          
          // Filter and format nodes
          let filteredNodes = nodes;
          if (type) {
            filteredNodes = filteredNodes.filter(n => n.type === type);
          }
          
          if (range !== 'all' && filteredNodes.length > 0) {
            if (range === 'recent') {
              filteredNodes = filteredNodes.slice(-10);
            } else if (range.includes('-')) {
              const [start, end] = range.split('-').map(Number);
              filteredNodes = filteredNodes.filter(n => n.position >= start && n.position <= end);
            }
          }
          
          result = filteredNodes.map(node => ({
            position: node.position,
            type: node.type,
            description: node.description || 'No description',
            status: node.status,
            alias: node.alias,
            result: node.result ? 'Has result' : 'No result'
          }));
          break;
        }
        
        case 'get_workflow_description': {
          const description = await this.workflowDescriptionService.getCurrentDescription(workflowId);
          if (description) {
            // Return both the structured data and a summary for context
            result = {
              version: description.description_version,
              created_at: description.created_at,
              updated_at: description.updated_at,
              data: description.description_data,
              summary: this.workflowDescriptionService.getDescriptionSummary(description.description_data)
            };
          } else {
            result = null;
          }
          break;
        }
        
        case 'get_browser_state': {
          result = await this.browserStateService.getBrowserStateContext(workflowId);
          break;
        }
          
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }
      
      console.log(`[TOOL_EXECUTION] ${toolName} completed successfully`);
      console.log(`[TOOL_EXECUTION] Result:`, JSON.stringify(result, null, 2));
      
      // Emit tool call complete event
      await this.emitToolCallEvent(workflowId, {
        type: 'tool_call_complete',
        callId: call_id,
        toolName,
        result,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
      
      return result;
      
    } catch (error) {
      console.error(`[TOOL_EXECUTION] ${toolName} failed:`, error);
      
      // Emit tool call error event
      await this.emitToolCallEvent(workflowId, {
        type: 'tool_call_error',
        callId: call_id,
        toolName,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Store encrypted reasoning context from blobs (used in control loop)
   */
  async storeReasoningContextFromBlobs(workflowId, encryptedBlobs, tokenUsage) {
    try {
      if (encryptedBlobs.length === 0) {
        console.log('[REASONING_CONTEXT] No encrypted reasoning blobs to store');
        return;
      }

      // Get next conversation turn number
      const { data: lastTurn } = await this.supabase
        .from('reasoning_context')
        .select('conversation_turn')
        .eq('workflow_id', workflowId)
        .order('conversation_turn', { ascending: false })
        .limit(1);

      const nextTurn = (lastTurn?.[0]?.conversation_turn || 0) + 1;

      // Store the context
      const { error } = await this.supabase
        .from('reasoning_context')
        .insert({
          workflow_id: workflowId,
          conversation_turn: nextTurn,
          encrypted_items: encryptedBlobs,
          token_counts: tokenUsage
        });

      if (error) {
        console.error('[REASONING_CONTEXT] Error storing context:', error);
      } else {
        console.log(`[REASONING_CONTEXT] Stored ${encryptedBlobs.length} encrypted blobs for turn ${nextTurn}`);
        console.log('[RESPONSES_API] Token usage:', tokenUsage);
      }

    } catch (error) {
      console.error('[REASONING_CONTEXT] Error storing context from blobs:', error);
    }
  }

  /**
   * Load encrypted reasoning context for a workflow
   */
  async loadReasoningContext(workflowId) {
    try {
      const { data: contexts, error } = await this.supabase
        .from('reasoning_context')
        .select('encrypted_items')
        .eq('workflow_id', workflowId)
        .order('conversation_turn', { ascending: false })
        .limit(5); // Load last 5 turns to maintain reasonable context

      if (error) {
        console.error('[REASONING_CONTEXT] Error loading context:', error);
        return [];
      }

      // Flatten all encrypted items from recent turns
      const allEncryptedItems = [];
      for (const context of contexts || []) {
        if (context.encrypted_items && Array.isArray(context.encrypted_items)) {
          allEncryptedItems.push(...context.encrypted_items);
        }
      }

      console.log(`[REASONING_CONTEXT] Loaded ${allEncryptedItems.length} encrypted items`);
      
      // Debug: Log size of encrypted context
      const contextSize = JSON.stringify(allEncryptedItems).length;
      console.log(`[REASONING_CONTEXT] Encrypted context size: ${contextSize} chars (~${Math.round(contextSize/4)} tokens)`);
      
      return allEncryptedItems;

    } catch (error) {
      console.error('[REASONING_CONTEXT] Error loading context:', error);
      return [];
    }
  }

  /**
   * Get the last response ID for a workflow (used for background mode context)
   */
  async getLastResponseId(workflowId) {
    try {
      const { data, error } = await this.supabase
        .from('workflow_response_ids')
        .select('response_id')
        .eq('workflow_id', workflowId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - this is expected for new conversations
          return null;
        }
        console.error('[BACKGROUND MODE] Error loading last response ID:', error);
        return null;
      }

      return data?.response_id || null;
    } catch (error) {
      console.error('[BACKGROUND MODE] Error getting last response ID:', error);
      return null;
    }
  }

  /**
   * Get the last completed response ID for a workflow (for forking after cancellation)
   */
  async getLastCompletedResponseId(workflowId) {
    try {
      // Get the most recent completed response
      const { data, error } = await this.supabase
        .from('workflow_response_ids')
        .select('response_id, status, created_at')
        .eq('workflow_id', workflowId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No completed rows found
          console.log('[FORK SUPPORT] No completed response found, falling back to any response');
          return this.getLastResponseId(workflowId);
        }
        console.error('[FORK SUPPORT] Error loading last completed response ID:', error);
        return null;
      }
      
      // Check if this is a compression marker
      if (data?.response_id?.startsWith('COMPRESSION_MARKER_')) {
        console.log('[COMPRESSION] Found compression marker - starting fresh');
        return null;
      }
      
      console.log(`[FORK SUPPORT] Found last completed response ID: ${data?.response_id || 'none'}`);
      return data?.response_id || null;
    } catch (error) {
      console.error('[FORK SUPPORT] Error getting last completed response ID:', error);
      return null;
    }
  }

  /**
   * Save response ID for future context (used for background mode)
   * @param {string} workflowId - The workflow ID
   * @param {string} responseId - The response ID from OpenAI
   * @param {string} status - The status of the response ('completed', 'incomplete', 'cancelled')
   */
  async saveResponseId(workflowId, responseId, status = 'completed') {
    try {
      const { error } = await this.supabase
        .from('workflow_response_ids')
        .insert({
          workflow_id: workflowId,
          response_id: responseId,
          status: status,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('[BACKGROUND MODE] Error saving response ID:', error);
      } else {
        console.log(`[BACKGROUND MODE] Saved response ID ${responseId} for workflow ${workflowId} with status ${status}`);
      }
    } catch (error) {
      console.error('[BACKGROUND MODE] Error saving response ID:', error);
    }
  }

  /**
   * Store encrypted reasoning context after API response
   */
  async storeReasoningContext(workflowId, response, tokenUsage) {
    try {
      // Extract encrypted reasoning items from response
      const encryptedItems = response.output?.filter(item => 
        item.type === 'reasoning' && item.encrypted_content
      ) || [];

      if (encryptedItems.length === 0) {
        console.log('[REASONING_CONTEXT] No encrypted reasoning items to store');
        return;
      }

      // Get next conversation turn number
      const { data: lastTurn } = await this.supabase
        .from('reasoning_context')
        .select('conversation_turn')
        .eq('workflow_id', workflowId)
        .order('conversation_turn', { ascending: false })
        .limit(1);

      const nextTurn = (lastTurn?.[0]?.conversation_turn || 0) + 1;

      // Store the context
      const { error } = await this.supabase
        .from('reasoning_context')
        .insert({
          workflow_id: workflowId,
          conversation_turn: nextTurn,
          encrypted_items: encryptedItems,
          token_counts: tokenUsage
        });

      if (error) {
        console.error('[REASONING_CONTEXT] Error storing context:', error);
      } else {
        console.log(`[REASONING_CONTEXT] Stored ${encryptedItems.length} encrypted items for turn ${nextTurn}`);
      }

    } catch (error) {
      console.error('[REASONING_CONTEXT] Error storing context:', error);
    }
  }

  /**
   * Extract tool calls from Responses API response
   */
  extractToolCallsFromResponse(response) {
    const toolCalls = [];
    
    for (const item of response.output || []) {
      if (item.type === 'function_call') {
        toolCalls.push({
          id: item.call_id,
          type: 'function',
          function: {
            name: item.name,
            arguments: item.arguments
          }
        });
      }
    }

    return toolCalls.length > 0 ? toolCalls : null;
  }

  /**
   * Extract assistant message content from Responses API response
   */
  extractAssistantContent(response) {
    for (const item of response.output || []) {
      if (item.type === 'message' && item.role === 'assistant') {
        return item.content?.[0]?.text || '';
      }
    }
    return '';
  }

  /**
   * Reset response tracking after compression to start fresh
   */
  async resetResponseTracking(workflowId) {
    try {
      // Insert special marker to indicate fresh start after compression
      // Use 'completed' status with special response_id pattern
      const { error } = await this.supabase
        .from('workflow_response_ids')
        .insert({
          workflow_id: workflowId,
          response_id: 'COMPRESSION_MARKER_' + Date.now(),
          status: 'completed',
          created_at: new Date().toISOString()
        });
      
      if (error) {
        console.error('[COMPRESSION] Error resetting response tracking:', error);
      } else {
        console.log(`[COMPRESSION] Reset response tracking for workflow ${workflowId}`);
      }
    } catch (error) {
      console.error('[COMPRESSION] Error resetting response tracking:', error);
    }
  }

  /**
   * Build context to inject after compression
   */
  async buildPostCompressionContext(workflowId, userMessage) {
    try {
      console.log('[COMPRESSION] Checking for compression context to inject...');
      
      // Check if there's a compression marker
      const { data: compressionMarker } = await this.supabase
        .from('workflow_response_ids')
        .select('response_id, status, created_at')
        .eq('workflow_id', workflowId)
        .like('response_id', 'COMPRESSION_MARKER_%')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      console.log('[COMPRESSION] Compression marker check:', compressionMarker);
      
      if (!compressionMarker) {
        console.log('[COMPRESSION] No compression marker found - no injection needed');
        return null; // No context injection needed
      }
      
      console.log('[COMPRESSION] Found compression marker - preparing context injection');
      
      // Get compressed summary
      const { data: compression } = await this.supabase
        .from('compressed_contexts')
        .select('summary')
        .eq('workflow_id', workflowId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!compression) {
        console.log('[COMPRESSION] No compressed context found');
        return null;
      }
      
      // Build context parts
      const parts = [`[COMPRESSED CONTEXT]\n${compression.summary}`];
      
      // Add workflow description
      const description = await this.workflowDescriptionService.getCurrentDescription(workflowId);
      if (description) {
        parts.push(`[WORKFLOW DESCRIPTION]\n${this.workflowDescriptionService.getDescriptionSummary(description.description_data)}`);
      }
      
      // Add current plan
      const plan = await this.planService.getCurrentPlan(workflowId);
      if (plan) {
        parts.push(`[CURRENT PLAN]\n${this.planService.getPlanSummary(plan.plan_data)}`);
      }
      
      // Add workflow nodes
      const workflowContext = await this.getWorkflowContext(workflowId);
      if (workflowContext?.nodes?.length > 0) {
        const nodesSummary = workflowContext.nodes
          .map(n => `${n.position}. ${n.type} - ${n.description || 'No description'} (${n.status})`)
          .join('\n');
        parts.push(`[WORKFLOW NODES]\n${nodesSummary}`);
      }
      
      // Combine with user message
      console.log(`[COMPRESSION] Injecting ${parts.length} context sections`);
      
      // Mark compression as consumed by deleting the marker
      // (we can't update the response_id, so we'll delete it)
      console.log('[COMPRESSION] Deleting compression marker to prevent re-use');
      const { error: deleteError } = await this.supabase
        .from('workflow_response_ids')
        .delete()
        .eq('workflow_id', workflowId)
        .like('response_id', 'COMPRESSION_MARKER_%');
      
      if (deleteError) {
        console.error('[COMPRESSION] Error deleting marker:', deleteError);
      }
      
      return parts.join('\n\n') + '\n\n[USER MESSAGE]\n' + userMessage;
    } catch (error) {
      console.error('[COMPRESSION] Error building post-compression context:', error);
      return null;
    }
  }
}