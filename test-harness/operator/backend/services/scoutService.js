/**
 * Scout Service - Lightweight reconnaissance agent for Director 2.0
 * 
 * Uses OpenAI Responses API (o4-mini) for efficient page exploration
 * with consecutive tool calling within reasoning chains.
 */

import OpenAI from 'openai';
import { supabase } from '../config/supabase.js';

export class ScoutService {
  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.supabase = supabase;
    this.tabInspectionService = null; // Lazy loaded
  }

  /**
   * Deploy a Scout on a reconnaissance mission
   * @param {Object} params
   * @param {string} params.instruction - Natural language mission description
   * @param {string} params.tabName - Tab to scout (defaults to 'main')
   * @param {string} params.workflowId - Workflow ID for context
   * @param {Object} params.nodeExecutor - Node executor instance for browser access
   * @returns {Object} Scout findings
   */
  async deployScout({ instruction, tabName, workflowId, nodeExecutor }) {
    try {
      console.log(`[SCOUT] Deploying scout with mission: ${instruction}`);
      
      // Build Scout messages
      const messages = [
        { role: 'system', content: this.getScoutSystemPrompt() },
        { 
          role: 'user', 
          content: `Mission: ${instruction}\n\nTarget Tab: ${tabName || 'main'}`
        }
      ];

      // Use o4-mini for Scout (same as Director)
      const model = process.env.SCOUT_MODEL || 'o4-mini';
      
      // Process with Responses API using same pattern as Director
      const completion = await this.processScoutWithResponsesAPI(
        model, 
        messages, 
        workflowId,
        tabName,
        nodeExecutor
      );

      // Extract findings from completion
      return this.extractScoutFindings(completion);
      
    } catch (error) {
      console.error('[SCOUT] Mission failed:', error);
      return {
        success: false,
        error: error.message,
        findings: 'Scout mission failed'
      };
    }
  }

  /**
   * Process Scout mission using Responses API
   */
  async processScoutWithResponsesAPI(model, messages, workflowId, tabName, nodeExecutor) {
    try {
      // Convert messages to Responses API format
      const systemMessage = messages.find(m => m.role === 'system');
      const userMessages = messages.filter(m => m.role === 'user');
      
      // Build initial input array (no encrypted context for Scout)
      const initialInput = userMessages.map(msg => ({
        type: 'message',
        role: msg.role,
        content: msg.content
      }));

      console.log(`[SCOUT] Starting reconnaissance with ${model}`);
      
      // Run Scout control loop (similar to Director)
      return await this.runScoutControlLoop(
        model, 
        systemMessage?.content || '', 
        initialInput, 
        workflowId,
        tabName,
        nodeExecutor
      );

    } catch (error) {
      console.error('[SCOUT] Responses API Error:', error);
      throw error;
    }
  }

  /**
   * Scout control loop for handling tool calls within reasoning
   */
  async runScoutControlLoop(model, instructions, initialInput, workflowId, tabName, nodeExecutor, recursionDepth = 0) {
    // Prevent infinite recursion
    if (recursionDepth > 5) {
      throw new Error('Maximum recursion depth reached in Scout control loop');
    }

    console.log(`[SCOUT_LOOP] Starting (depth ${recursionDepth})`);
    
    // Convert tools to Responses API format
    const scoutTools = this.getScoutToolsForResponsesAPI();

    // Make blocking request - same pattern as Director
    const response = await this.openai.responses.create({
      model,
      instructions,
      input: initialInput,
      tools: scoutTools,
      reasoning: { 
        effort: 'low',  // Scout uses lower effort for efficiency
        summary: 'detailed'  // o4-mini only supports 'detailed'
      },
      include: [],  // Scout doesn't need encrypted content
      store: false,
      stream: false  // No streaming for accurate token counts
    });

    console.log(`[SCOUT_LOOP] Response received`);
    
    // Extract data from response
    const assistantMessages = response.output.filter(item => item.type === 'message' && item.role === 'assistant');
    const functionCalls = response.output.filter(item => item.type === 'function_call');
    
    // Get assistant content
    const assistantContent = assistantMessages
      .flatMap(msg => msg.content || [])
      .map(content => content.text || '')
      .join('');
    
    // Get reasoning summary
    const reasoningItems = response.output.filter(item => item.type === 'reasoning' && item.summary);
    const reasoningSummary = reasoningItems.length > 0 ? 
      reasoningItems.map(item => item.summary.map(s => s.text).join('\n')).join('\n\n') : 
      null;

    // Token usage
    const tokenUsage = {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.total_tokens,
      reasoning_tokens: response.usage.output_tokens_details?.reasoning_tokens || 0
    };
    
    console.log('[SCOUT] Token usage:', tokenUsage);

    // Handle tool calls if present
    if (functionCalls.length > 0) {
      console.log(`[SCOUT_LOOP] ${functionCalls.length} function calls detected`);
      
      const executedTools = [];
      const followUps = [];
      
      // Execute all tool calls
      for (const call of functionCalls) {
        try {
          console.log(`[SCOUT_LOOP] Executing tool: ${call.name}`);
          const toolResult = await this.executeScoutTool(
            call.name, 
            JSON.parse(call.arguments),
            workflowId,
            tabName,
            nodeExecutor
          );
          
          executedTools.push({
            name: call.name,
            arguments: call.arguments,
            result: toolResult,
            call_id: call.call_id
          });
          
          // Add to follow-up input
          followUps.push(call);
          followUps.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify(toolResult)
          });
          
        } catch (toolError) {
          console.error(`[SCOUT_LOOP] Tool execution failed:`, toolError);
          
          followUps.push(call);
          followUps.push({
            type: 'function_call_output',
            call_id: call.call_id,
            output: JSON.stringify({ error: true, message: toolError.message })
          });
        }
      }
      
      // Continue recursively with tool results
      const recursiveResult = await this.runScoutControlLoop(
        model, 
        instructions, 
        initialInput.concat(followUps), 
        workflowId,
        tabName,
        nodeExecutor,
        recursionDepth + 1
      );
      
      // Merge executed tools
      if (recursiveResult.executedTools) {
        executedTools.push(...recursiveResult.executedTools);
      }
      
      return {
        ...recursiveResult,
        executedTools,
        usage: recursionDepth === 0 ? tokenUsage : recursiveResult.usage
      };
    }

    // Return final results
    return {
      content: assistantContent,
      reasoning_summary: reasoningSummary,
      usage: tokenUsage,
      executedTools: []
    };
  }

  /**
   * Execute Scout-specific tools
   */
  async executeScoutTool(toolName, args, workflowId, tabName, nodeExecutor) {
    // Import tab inspection service dynamically
    if (!this.tabInspectionService) {
      const TabInspectionService = (await import('./tabInspectionService.js')).default;
      this.tabInspectionService = TabInspectionService;
    }

    switch (toolName) {
      case 'inspect_tab':
        return await this.tabInspectionService.inspectTab(
          workflowId,
          args.tabName || tabName,
          args.inspectionType || 'dom_snapshot',
          args.instruction,
          nodeExecutor
        );
        
      case 'expand_dom_selector':
        return await this.tabInspectionService.expandDomSelector(
          workflowId,
          args.tabName || tabName,
          args.elementId
        );
        
      case 'debug_navigate':
        // Scout can navigate during exploration
        return await nodeExecutor.page.goto(args.url, { waitUntil: 'domcontentloaded' })
          .then(() => ({ success: true, navigated_to: args.url }))
          .catch(err => ({ success: false, error: err.message }));
        
      case 'debug_click':
        // Scout can click during exploration
        return await nodeExecutor.page.click(args.selector, { timeout: 10000 })
          .then(() => ({ success: true, clicked: args.selector }))
          .catch(err => ({ success: false, error: err.message }));
        
      default:
        throw new Error(`Unknown scout tool: ${toolName}`);
    }
  }

  /**
   * Get Scout tools in Responses API format
   */
  getScoutToolsForResponsesAPI() {
    // Tools in Responses API format (not Chat Completions format)
    return [
      {
        type: 'function',
        name: 'inspect_tab',
        description: 'Get DOM snapshot of current page for reconnaissance',
        parameters: {
          type: 'object',
          properties: {
            inspectionType: { 
              type: 'string',
              enum: ['dom_snapshot'],
              default: 'dom_snapshot'
            }
          }
        }
      },
      {
        type: 'function',
        name: 'expand_dom_selector',
        description: 'Get detailed selector information for specific elements. Call multiple times to explore different elements.',
        parameters: {
          type: 'object',
          properties: {
            elementId: { 
              type: 'string',
              description: 'Element ID from inspect_tab output (e.g., "1127")'
            }
          },
          required: ['elementId']
        }
      },
      {
        type: 'function',
        name: 'debug_navigate',
        description: 'Navigate to explore multi-page flows during reconnaissance',
        parameters: {
          type: 'object',
          properties: {
            url: { 
              type: 'string',
              description: 'URL to navigate to'
            }
          },
          required: ['url']
        }
      },
      {
        type: 'function',
        name: 'debug_click',
        description: 'Click elements to test interactions and explore flows',
        parameters: {
          type: 'object',
          properties: {
            selector: { 
              type: 'string',
              description: 'CSS selector or element to click'
            }
          },
          required: ['selector']
        }
      }
    ];
  }

  /**
   * Scout-specific system prompt
   */
  getScoutSystemPrompt() {
    return `You are a Scout - a lightweight reconnaissance agent using o4-mini reasoning to explore web pages efficiently.

Your mission is to gather specific intelligence requested by the Director through systematic exploration.

RECONNAISSANCE METHODOLOGY:
1. Always start with inspect_tab to see the page structure
2. Use expand_dom_selector multiple times to investigate relevant elements
3. Use debug_navigate and debug_click to explore multi-page flows if needed
4. Focus on the specific mission objectives
5. Build comprehensive understanding through multiple tool calls

WHAT TO LOOK FOR:
- Stable selectors (IDs, data-testid, data-qa, aria-label)
- Element patterns and structures
- Form fields and their attributes  
- Interactive elements and their selectors
- Navigation patterns

REASONING APPROACH:
- Think step-by-step about which elements to investigate
- Call expand_dom_selector on multiple similar elements to find patterns
- Reason about selector stability and reliability
- Consider edge cases and variations

FINAL REPORT:
Provide a concise, structured report with:
- Direct answers to the mission objectives
- Specific selectors for key elements
- Patterns discovered
- Warnings about potential issues`;
  }

  /**
   * Extract structured findings from Scout's completion
   */
  extractScoutFindings(completion) {
    // Extract structured findings from Scout's response
    const findings = {
      success: true,
      summary: completion.content || 'Scout completed reconnaissance',
      elements: [],
      patterns: [],
      warnings: [],
      reasoning_summary: completion.reasoning_summary,
      token_usage: completion.usage,
      tools_executed: completion.executedTools ? completion.executedTools.length : 0
    };

    // If we have executed tools, add a summary
    if (completion.executedTools && completion.executedTools.length > 0) {
      findings.exploration_depth = completion.executedTools.filter(t => t.name === 'expand_dom_selector').length;
      console.log(`[SCOUT] Mission complete. Explored ${findings.exploration_depth} elements in detail.`);
    }
    
    return findings;
  }
}

// Export the class
export default ScoutService;