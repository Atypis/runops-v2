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
   * @param {Object} params.browserState - Current browser state (tabs, active tab, etc.)
   * @returns {Object} Scout findings
   */
  async deployScout({ instruction, tabName, workflowId, nodeExecutor, browserState }) {
    try {
      console.log(`[SCOUT] Deploying scout with mission: ${instruction}`);
      
      // Build Scout messages with browser state
      const messages = [
        { role: 'system', content: this.getScoutSystemPrompt() },
        { 
          role: 'user', 
          content: `Mission: ${instruction}\n\nTarget Tab: ${tabName || 'main'}\n\n${this.formatBrowserState(browserState)}`
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
        nodeExecutor,
        browserState
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
  async processScoutWithResponsesAPI(model, messages, workflowId, tabName, nodeExecutor, browserState) {
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
        nodeExecutor,
        browserState
      );

    } catch (error) {
      console.error('[SCOUT] Responses API Error:', error);
      throw error;
    }
  }

  /**
   * Scout control loop for handling tool calls within reasoning
   */
  async runScoutControlLoop(model, instructions, initialInput, workflowId, tabName, nodeExecutor, browserState, recursionDepth = 0) {
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
            nodeExecutor,
            browserState
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
        browserState,
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
  async executeScoutTool(toolName, args, workflowId, tabName, nodeExecutor, browserState) {
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
        // Get the appropriate page based on tab
        const targetTabNav = args.tabName || tabName || 'main';
        let pageNav;
        
        if (targetTabNav === 'main') {
          pageNav = nodeExecutor.mainPage || nodeExecutor.page;
        } else if (nodeExecutor.stagehandPages?.[targetTabNav]) {
          pageNav = nodeExecutor.stagehandPages[targetTabNav];
        }
        
        if (!pageNav) {
          // No page exists - Scout needs to report this
          return { 
            success: false, 
            error: 'No browser page available. The Director needs to create a browser session first.' 
          };
        }
        
        return await pageNav.goto(args.url, { waitUntil: 'domcontentloaded' })
          .then(() => ({ success: true, navigated_to: args.url }))
          .catch(err => ({ success: false, error: err.message }));
        
      case 'debug_click':
        // Get the appropriate page based on tab
        const targetTabClick = args.tabName || tabName || 'main';
        let pageClick;
        
        if (targetTabClick === 'main') {
          pageClick = nodeExecutor.mainPage || nodeExecutor.page;
        } else if (nodeExecutor.stagehandPages?.[targetTabClick]) {
          pageClick = nodeExecutor.stagehandPages[targetTabClick];
        }
        
        if (!pageClick) {
          return { 
            success: false, 
            error: 'No browser page available for clicking.' 
          };
        }
        
        return await pageClick.click(args.selector, { timeout: 10000 })
          .then(() => ({ success: true, clicked: args.selector }))
          .catch(err => ({ success: false, error: err.message }));
      
      case 'debug_type':
        // Get the appropriate page based on tab
        const targetTabType = args.tabName || tabName || 'main';
        let pageType;
        
        if (targetTabType === 'main') {
          pageType = nodeExecutor.mainPage || nodeExecutor.page;
        } else if (nodeExecutor.stagehandPages?.[targetTabType]) {
          pageType = nodeExecutor.stagehandPages[targetTabType];
        }
        
        if (!pageType) {
          return { 
            success: false, 
            error: 'No browser page available for typing.' 
          };
        }
        
        return await pageType.type(args.selector, args.text, { delay: 100 })
          .then(() => ({ success: true, typed: args.text }))
          .catch(err => ({ success: false, error: err.message }));
      
      case 'debug_wait':
        // Get the appropriate page based on tab
        const targetTabWait = args.tabName || tabName || 'main';
        let pageWait;
        
        if (targetTabWait === 'main') {
          pageWait = nodeExecutor.mainPage || nodeExecutor.page;
        } else if (nodeExecutor.stagehandPages?.[targetTabWait]) {
          pageWait = nodeExecutor.stagehandPages[targetTabWait];
        }
        
        if (!pageWait) {
          return { 
            success: false, 
            error: 'No browser page available for waiting.' 
          };
        }
        
        if (args.type === 'time') {
          const ms = parseInt(args.value);
          await new Promise(resolve => setTimeout(resolve, ms));
          return { success: true, waited: `${ms}ms` };
        } else {
          return await pageWait.waitForSelector(args.value, { timeout: 30000 })
            .then(() => ({ success: true, found: args.value }))
            .catch(err => ({ success: false, error: err.message }));
        }
      
      case 'debug_open_tab':
        // Initialize stagehandPages if needed
        if (!nodeExecutor.stagehandPages) {
          nodeExecutor.stagehandPages = {};
        }
        
        // Check if tab already exists
        if (nodeExecutor.stagehandPages[args.tabName]) {
          return {
            success: false,
            error: `Tab "${args.tabName}" already exists`
          };
        }
        
        try {
          // Get browser context from stagehand
          const stagehand = await nodeExecutor.getStagehand();
          const context = stagehand.context;
          
          if (!context) {
            return {
              success: false,
              error: 'No browser context available. The Director needs to create a browser session first.'
            };
          }
          
          // Create new page
          const newPage = await context.newPage();
          await newPage.goto(args.url, { waitUntil: 'domcontentloaded' });
          
          // Store the new page
          nodeExecutor.stagehandPages[args.tabName] = newPage;
          
          // Update stagehand's current page to the new tab
          stagehand.page = newPage;
          
          return {
            success: true,
            tabName: args.tabName,
            url: args.url
          };
        } catch (err) {
          return {
            success: false,
            error: err.message
          };
        }
      
      case 'debug_close_tab':
        if (!args.tabName || args.tabName === 'main') {
          return {
            success: false,
            error: 'Cannot close the main tab'
          };
        }
        
        if (!nodeExecutor.stagehandPages?.[args.tabName]) {
          return {
            success: false,
            error: `Tab "${args.tabName}" does not exist`
          };
        }
        
        try {
          await nodeExecutor.stagehandPages[args.tabName].close();
          delete nodeExecutor.stagehandPages[args.tabName];
          
          // Switch back to main tab
          const stagehand = await nodeExecutor.getStagehand();
          stagehand.page = nodeExecutor.mainPage || nodeExecutor.page;
          
          return {
            success: true,
            closed: args.tabName
          };
        } catch (err) {
          return {
            success: false,
            error: err.message
          };
        }
      
      case 'debug_switch_tab':
        const targetTab = args.tabName;
        let pageToSwitch;
        
        if (targetTab === 'main') {
          pageToSwitch = nodeExecutor.mainPage || nodeExecutor.page;
        } else if (nodeExecutor.stagehandPages?.[targetTab]) {
          pageToSwitch = nodeExecutor.stagehandPages[targetTab];
        } else {
          return {
            success: false,
            error: `Tab "${targetTab}" not found`
          };
        }
        
        try {
          // Bring tab to front
          await pageToSwitch.bringToFront();
          
          // Update stagehand's current page
          const stagehand = await nodeExecutor.getStagehand();
          stagehand.page = pageToSwitch;
          
          return {
            success: true,
            switched_to: targetTab
          };
        } catch (err) {
          return {
            success: false,
            error: err.message
          };
        }
        
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
            },
            tabName: {
              type: 'string',
              description: 'Tab to click in (defaults to active tab)'
            }
          },
          required: ['selector']
        }
      },
      {
        type: 'function',
        name: 'debug_type',
        description: 'Type text into form fields to test inputs',
        parameters: {
          type: 'object',
          properties: {
            selector: {
              type: 'string',
              description: 'CSS selector of the input element'
            },
            text: {
              type: 'string',
              description: 'Text to type'
            },
            tabName: {
              type: 'string',
              description: 'Tab to type in (defaults to active tab)'
            }
          },
          required: ['selector', 'text']
        }
      },
      {
        type: 'function',
        name: 'debug_wait',
        description: 'Wait for elements to appear or for a specific time',
        parameters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['time', 'selector'],
              description: 'Type of wait - time in ms or selector to wait for'
            },
            value: {
              type: 'string',
              description: 'Milliseconds to wait or CSS selector to wait for'
            },
            tabName: {
              type: 'string',
              description: 'Tab to wait in (defaults to active tab)'
            }
          },
          required: ['type', 'value']
        }
      },
      {
        type: 'function',
        name: 'debug_open_tab',
        description: 'Open a new browser tab for multi-tab exploration',
        parameters: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'URL to open in new tab'
            },
            tabName: {
              type: 'string',
              description: 'Name for the new tab'
            }
          },
          required: ['url', 'tabName']
        }
      },
      {
        type: 'function',
        name: 'debug_close_tab',
        description: 'Close a browser tab',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Name of the tab to close (cannot close main tab)'
            }
          },
          required: ['tabName']
        }
      },
      {
        type: 'function',
        name: 'debug_switch_tab',
        description: 'Switch to a different browser tab',
        parameters: {
          type: 'object',
          properties: {
            tabName: {
              type: 'string',
              description: 'Name of the tab to switch to'
            }
          },
          required: ['tabName']
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

BROWSER STATE AWARENESS:
- You'll receive the current browser state at the start of your mission
- If no tabs are open, you MUST navigate somewhere first using debug_navigate
- If tabs are open, you can start with inspect_tab
- Always be aware of which tab you're working in

RECONNAISSANCE METHODOLOGY:
1. Check browser state - if no tabs open, navigate first
2. Use inspect_tab to see page structure (only after ensuring a page is loaded)
3. Use expand_dom_selector multiple times to investigate relevant elements
4. Use debug_navigate and debug_click to explore multi-page flows if needed
5. Focus on the specific mission objectives
6. Build comprehensive understanding through multiple tool calls

AVAILABLE TOOLS:
- inspect_tab: Get DOM snapshot (requires a loaded page)
- expand_dom_selector: Get detailed selector info
- debug_navigate: Navigate to URLs
- debug_click: Click elements
- debug_type: Type into forms
- debug_wait: Wait for elements/time
- debug_open_tab: Create new tabs
- debug_close_tab: Close tabs
- debug_switch_tab: Switch between tabs

WHAT TO LOOK FOR:
- Stable selectors (IDs, data-testid, data-qa, aria-label)
- Element patterns and structures
- Form fields and their attributes  
- Interactive elements and their selectors
- Navigation patterns

ERROR HANDLING:
- If a tool fails, report the failure - don't guess
- If you can't inspect because no page is loaded, navigate first
- Include all errors in your final report
- NEVER hallucinate or make up findings

TRUTHFUL REPORTING:
- ONLY report elements and selectors you've actually found
- Base ALL findings on successful tool executions
- If you couldn't complete the mission, explain why
- Include tool failures in your report

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
- Warnings about potential issues
- Any errors or failures encountered`;
  }

  /**
   * Format browser state for Scout's context
   */
  formatBrowserState(browserState) {
    if (!browserState || !browserState.tabs || browserState.tabs.length === 0) {
      return "BROWSER STATE:\nNo tabs open. You'll need to navigate somewhere first.";
    }
    
    const tabCount = browserState.tabs.length;
    const tabList = browserState.tabs.map(tab => 
      `- ${tab.name}${tab.name === browserState.active_tab_name ? ' (Active)' : ''} = ${tab.url}`
    ).join('\n');
    
    return `BROWSER STATE:\n${tabCount} tab${tabCount !== 1 ? 's' : ''} open:\n${tabList}`;
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
      errors: [],  // New field for errors
      reasoning_summary: completion.reasoning_summary,
      token_usage: completion.usage,
      tools_executed: completion.executedTools ? completion.executedTools.length : 0,
      execution_log: []
    };

    // Check for tool failures and build execution log
    if (completion.executedTools) {
      const failures = completion.executedTools.filter(t => 
        t.result?.error || t.result?.success === false
      );
      
      if (failures.length > 0) {
        findings.success = false;
        findings.errors = failures.map(f => ({
          tool: f.name,
          error: f.result.error || f.result.message || 'Tool execution failed'
        }));
      }
      
      // Add execution log
      findings.execution_log = completion.executedTools.map(tool => ({
        tool: tool.name,
        args: JSON.parse(tool.arguments || '{}'),
        success: !tool.result?.error && tool.result?.success !== false,
        result_summary: this.summarizeToolResult(tool.name, tool.result)
      }));
      
      findings.exploration_depth = completion.executedTools.filter(t => t.name === 'expand_dom_selector').length;
    }
    
    // If no tools executed successfully, mark as failure
    if (findings.tools_executed === 0 || 
        (findings.execution_log.length > 0 && 
         !findings.execution_log.some(e => e.success))) {
      findings.success = false;
      findings.summary = 'Scout mission failed - no tools executed successfully';
    }
    
    console.log(`[SCOUT] Mission ${findings.success ? 'complete' : 'failed'}. Executed ${findings.tools_executed} tools.`);
    
    return findings;
  }

  /**
   * Generate summary for tool results
   */
  summarizeToolResult(toolName, result) {
    if (!result) return 'No result';
    if (result.error) return `Error: ${result.error}`;
    if (result.success === false) return `Failed: ${result.message || 'Unknown error'}`;
    
    switch(toolName) {
      case 'inspect_tab':
        const elementCount = result.elements?.length || 0;
        return `Found ${elementCount} elements`;
      
      case 'expand_dom_selector':
        const selector = result.selectors?.[0] || 'no stable selector';
        return `Element ${result.elementId}: ${selector}`;
      
      case 'debug_click':
        return result.success ? 
          `Clicked ${result.clicked || 'element'}` : 
          `Failed to click`;
      
      case 'debug_navigate':
        return result.success ?
          `Navigated to ${result.navigated_to}` :
          `Failed to navigate`;
      
      case 'debug_type':
        return `Typed into element`;
      
      case 'debug_wait':
        return `Waited successfully`;
      
      case 'debug_switch_tab':
        return result.success ?
          `Switched to ${result.switched_to} tab` :
          `Failed to switch tabs`;
      
      case 'debug_open_tab':
        return result.success ?
          `Opened new tab: ${result.tabName}` :
          `Failed to open tab`;
      
      case 'debug_close_tab':
        return result.success ?
          `Closed tab` :
          `Failed to close tab`;
        
      default:
        return 'Tool executed';
    }
  }
}

// Export the class
export default ScoutService;