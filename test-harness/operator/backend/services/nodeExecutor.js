import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { dirname, join } from 'path';
import BrowserStateService from './browserStateService.js';
import visualObservationService from './visualObservationService.js';

export class NodeExecutor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.stagehandInstance = null;
    // Track iteration context for nested loops
    this.iterationContext = [];
    // Track group context for nested groups
    this.groupContext = [];
    // Store recent node values for frontend polling
    this.recentNodeValues = new Map(); // nodeId -> { position, value, storageKey, timestamp }
    // Store group definitions
    this.groupDefinitions = new Map();
    // Browser state service for Director 2.0 real-time context
    this.browserStateService = new BrowserStateService();
    // Track current workflow ID for browser state updates
    this.currentWorkflowId = null;
  }

  // StageHand logging control:
  // - Set STAGEHAND_VERBOSE=0 for minimal logging
  // - Set STAGEHAND_VERBOSE=2 for debug logging (includes OpenAI logs)
  // - Default filters out noisy OpenAI DOM snapshots

  // Helper methods for iteration context
  pushIterationContext(iterateNodePos, index, variable, total) {
    this.iterationContext.push({
      iterateNodePos,
      index,
      variable,
      total
    });
    console.log(`[ITERATION_CONTEXT] Pushed context: iterate node ${iterateNodePos}, index ${index}`);
  }

  popIterationContext() {
    const context = this.iterationContext.pop();
    console.log(`[ITERATION_CONTEXT] Popped context: iterate node ${context?.iterateNodePos}, index ${context?.index}`);
    return context;
  }

  getCurrentIterationContext() {
    return this.iterationContext[this.iterationContext.length - 1] || null;
  }

  // Helper methods for group context
  pushGroupContext(groupNodePos, groupId, params) {
    this.groupContext.push({
      groupNodePos,
      groupId,
      params
    });
    console.log(`[GROUP_CONTEXT] Pushed context: group node ${groupNodePos}, id ${groupId}`);
  }

  popGroupContext() {
    const context = this.groupContext.pop();
    console.log(`[GROUP_CONTEXT] Popped context: group node ${context?.groupNodePos}, id ${context?.groupId}`);
    return context;
  }

  getCurrentGroupContext() {
    return this.groupContext[this.groupContext.length - 1] || null;
  }

  // Build storage key with iteration context
  getStorageKey(baseKey) {
    if (this.iterationContext.length === 0) {
      return baseKey;
    }
    
    // Build iteration suffix: @iter:28:0:35:2
    const iterSuffix = this.iterationContext
      .map(ctx => `${ctx.iterateNodePos}:${ctx.index}`)
      .join(':');
    
    return `${baseKey}@iter:${iterSuffix}`;
  }

  // Store node value update for frontend
  sendNodeValueUpdate(nodeId, position, value, storageKey) {
    const simplifiedValue = this.simplifyValue(value);
    this.recentNodeValues.set(nodeId, {
      position,
      value: simplifiedValue,
      storageKey,
      timestamp: Date.now()
    });
    
    // Clean up old values (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    for (const [id, data] of this.recentNodeValues.entries()) {
      if (data.timestamp < fiveMinutesAgo) {
        this.recentNodeValues.delete(id);
      }
    }
  }

  // Simplify complex values for display
  simplifyValue(value) {
    if (value === null || value === undefined) return value;
    
    // For boolean values
    if (typeof value === 'boolean') return value;
    
    // For simple strings/numbers
    if (typeof value === 'string' || typeof value === 'number') return value;
    
    // For objects, try to extract key fields
    if (typeof value === 'object') {
      // Arrays
      if (Array.isArray(value)) {
        return `Array[${value.length}]`;
      }
      
      // Objects - try to show key fields
      const keys = Object.keys(value);
      if (keys.length <= 3) {
        // Show small objects inline
        return value;
      } else {
        // For larger objects, just show key count
        return `Object{${keys.length} fields}`;
      }
    }
    
    return value;
  }

  // Get recent node values (for polling)
  getRecentNodeValues() {
    const values = {};
    for (const [nodeId, data] of this.recentNodeValues.entries()) {
      values[nodeId] = data;
    }
    return values;
  }

  // Browser state management for Director 2.0
  async updateBrowserStateInDB() {
    console.log(`[BROWSER_STATE] updateBrowserStateInDB called. Workflow ID: ${this.currentWorkflowId}, Active tab: ${this.activeTabName}`);
    
    if (!this.currentWorkflowId) {
      console.log('[BROWSER_STATE] No workflow ID set, skipping browser state update');
      return;
    }

    try {
      // Collect current tab information
      const tabs = await this.getCurrentTabsInfo();
      
      // Update browser state in database
      await this.browserStateService.updateBrowserState(this.currentWorkflowId, {
        tabs,
        activeTabName: this.activeTabName
      });
      
      console.log(`[BROWSER_STATE] Successfully updated browser state for workflow ${this.currentWorkflowId}: ${tabs.length} tabs, active: ${this.activeTabName}`);
    } catch (error) {
      console.error(`[BROWSER_STATE] Failed to update browser state:`, error);
    }
  }

  async getCurrentTabsInfo() {
    const tabs = [];
    
    try {
      console.log(`[BROWSER_STATE] Collecting current tab info. MainPage exists: ${!!this.mainPage}, StagehandPages exists: ${!!this.stagehandPages}`);
      
      // Add main tab if it exists
      if (this.mainPage) {
        try {
          const mainUrl = this.mainPage.url();
          console.log(`[BROWSER_STATE] Found main tab with URL: ${mainUrl}`);
          tabs.push({
            name: 'main',
            url: mainUrl || 'about:blank'
          });
        } catch (error) {
          console.warn(`[BROWSER_STATE] Could not get URL for main tab:`, error.message);
          tabs.push({
            name: 'main',
            url: 'about:blank'
          });
        }
      } else {
        console.log(`[BROWSER_STATE] No main tab found`);
      }
      
      // Add named tabs
      if (this.stagehandPages) {
        const namedTabNames = Object.keys(this.stagehandPages);
        console.log(`[BROWSER_STATE] Found ${namedTabNames.length} named tabs: ${namedTabNames.join(', ')}`);
        
        for (const [name, page] of Object.entries(this.stagehandPages)) {
          try {
            const url = page.url();
            console.log(`[BROWSER_STATE] Named tab ${name} has URL: ${url}`);
            tabs.push({
              name,
              url: url || 'about:blank'
            });
          } catch (error) {
            console.warn(`[BROWSER_STATE] Could not get URL for tab ${name}:`, error.message);
            tabs.push({
              name,
              url: 'about:blank'
            });
          }
        }
      } else {
        console.log(`[BROWSER_STATE] No named tabs found`);
      }
      
      console.log(`[BROWSER_STATE] Collected ${tabs.length} total tabs:`, tabs.map(t => `${t.name}=${t.url?.substring(0, 30)}...`));
      
    } catch (error) {
      console.error('[BROWSER_STATE] Error collecting tab info:', error);
    }
    
    return tabs;
  }

  // Set workflow ID for browser state tracking
  setWorkflowId(workflowId) {
    console.log(`[BROWSER_STATE] Setting workflow ID from ${this.currentWorkflowId} to ${workflowId}`);
    this.currentWorkflowId = workflowId;
    console.log(`[BROWSER_STATE] Workflow ID set: ${workflowId}`);
  }

  // Resolve template variables in a value
  async resolveTemplateVariables(value, workflowId) {
    if (typeof value !== 'string') return value;
    
    // Pattern to match {{variable}} or {{node.property}}
    const templatePattern = /\{\{([^}]+)\}\}/g;
    
    let resolved = value;
    let match;
    
    while ((match = templatePattern.exec(value)) !== null) {
      const expression = match[1].trim();
      let replacementValue = '';
      
      try {
        // Handle group parameter references (e.g., {{param.email}})
        const groupContext = this.getCurrentGroupContext();
        if (groupContext && expression.startsWith('param.')) {
          const paramName = expression.substring(6); // Remove 'param.' prefix
          replacementValue = groupContext.params[paramName];
          if (replacementValue !== undefined) {
            // Convert to string if needed
            if (typeof replacementValue === 'object') {
              replacementValue = JSON.stringify(replacementValue);
            } else {
              replacementValue = String(replacementValue);
            }
            resolved = resolved.replace(match[0], replacementValue);
            continue;
          }
        }
        
        // Handle iteration context variables (e.g., email, email.selector)
        const currentContext = this.getCurrentIterationContext();
        if (currentContext && expression.startsWith(currentContext.variable)) {
          const itemData = await this.getStateValue(currentContext.variable, workflowId);
          
          if (expression === currentContext.variable) {
            // Just the variable name (e.g., {{email}})
            replacementValue = itemData;
          } else {
            // Property access (e.g., {{email.selector}})
            const propertyPath = expression.substring(currentContext.variable.length + 1);
            replacementValue = this.getNestedProperty(itemData, propertyPath);
          }
        } else {
          // Handle other references (e.g., {{node27.emails}})
          replacementValue = await this.getStateValue(expression, workflowId);
        }
        
        // Convert to string if needed
        if (typeof replacementValue === 'object') {
          replacementValue = JSON.stringify(replacementValue);
        } else if (replacementValue === undefined || replacementValue === null) {
          console.warn(`[TEMPLATE] Could not resolve variable: ${expression}`);
          replacementValue = match[0]; // Keep original
        } else {
          replacementValue = String(replacementValue);
        }
        
        resolved = resolved.replace(match[0], replacementValue);
      } catch (error) {
        console.error(`[TEMPLATE] Error resolving ${expression}:`, error);
      }
    }
    
    return resolved;
  }

  // Helper to get nested property from object
  getNestedProperty(obj, path) {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return undefined;
      }
    }
    
    return result;
  }

  // Resolve all template variables in node params
  async resolveNodeParams(params, workflowId) {
    if (!params) return params;
    
    const resolved = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = await this.resolveTemplateVariables(value, workflowId);
      } else if (Array.isArray(value)) {
        resolved[key] = await Promise.all(
          value.map(item => {
            // Skip null/undefined items in arrays
            if (item === null || item === undefined) {
              return item;
            }
            return this.resolveTemplateVariables(item, workflowId);
          })
        );
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = await this.resolveNodeParams(value, workflowId);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  async getStagehand() {
    if (!this.stagehandInstance) {
      this.stagehandInstance = new Stagehand({
        env: 'LOCAL',
        headless: false,
        enableCaching: true,
        modelName: 'gpt-4.1-mini-2025-04-14', // Using gpt-4.1-mini-2025-04-14 for browser actions (act, extract, observe)
        modelClientOptions: {
          apiKey: process.env.OPENAI_API_KEY
        },
        verbose: process.env.STAGEHAND_VERBOSE ? parseInt(process.env.STAGEHAND_VERBOSE) : 1,
        logger: (logLine) => {
          // Filter out noisy stagehand:openai logs with DOM snapshots
          if (logLine.category === 'stagehand:openai') {
            // Only log errors from OpenAI
            if (logLine.level === 0 || logLine.message.includes('error')) {
              console.log(`[${logLine.category}] ${logLine.message.substring(0, 200)}...`);
            }
            return; // Skip normal OpenAI logs
          }
          
          // Log everything else normally
          const timestamp = new Date().toISOString();
          console.log(`${timestamp}::[${logLine.category || 'stagehand'}] ${logLine.message}`);
        }
      });
      await this.stagehandInstance.init();
      
      // Initialize tab tracking and store the main page reference
      if (!this.stagehandPages) {
        this.stagehandPages = {};
      }
      // IMPORTANT: Store the initial page as 'main' because stagehandInstance.page changes when new tabs are created
      this.mainPage = this.stagehandInstance.page;
      this.activeTabName = 'main';
      console.log(`[STAGEHAND INIT] StageHand initialized with main tab`);
    }
    return this.stagehandInstance;
  }

  async execute(nodeId, workflowId, options = {}) {
    console.log(`\n[EXECUTE] Starting execution for node ${nodeId} in workflow ${workflowId}`);
    
    const { data: node, error } = await supabase
      .from('nodes')
      .select('*')
      .eq('id', nodeId)
      .single();
      
    if (error) {
      console.error(`[EXECUTE] Error fetching node:`, error);
      throw error;
    }
    
    console.log(`[EXECUTE] Node type: ${node.type}`);
    console.log(`[EXECUTE] Node params:`, JSON.stringify(node.params, null, 2));
    
    // Debug: Check what's already in workflow_memory for this position
    if (node.position) {
      const { data: existingMemory } = await supabase
        .from('workflow_memory')
        .select('key, value')
        .eq('workflow_id', workflowId)
        .eq('key', `node${node.position}`)
        .single();
      
      if (existingMemory) {
        console.log(`[EXECUTE] WARNING: Found existing memory for node${node.position}:`, existingMemory.value);
      }
    }

    // Log execution start
    await this.logExecution(nodeId, workflowId, 'info', 'Node execution started');

    try {
      let result;
      
      // Always resolve template variables in params
      let resolvedParams = node.params;
      if (node.params) {
        console.log(`[EXECUTE] Resolving template variables`);
        resolvedParams = await this.resolveNodeParams(node.params, workflowId);
        console.log(`[EXECUTE] Resolved params:`, JSON.stringify(resolvedParams, null, 2));
      }
      
      switch (node.type) {
        case 'browser_action':
          console.log(`[EXECUTE] Executing browser action...`);
          result = await this.executeBrowserAction(resolvedParams, workflowId);
          break;
        case 'browser_query':
          result = await this.executeBrowserQuery(resolvedParams);
          break;
        case 'transform':
          result = await this.executeTransform(resolvedParams, workflowId);
          break;
        case 'cognition':
          result = await this.executeCognition(resolvedParams, options.inputData);
          break;
        case 'memory':
          result = await this.executeMemory(resolvedParams, workflowId);
          break;
        case 'context':
          console.log(`[EXECUTE] Executing context operation...`);
          result = await this.executeContext(resolvedParams, workflowId);
          break;
        case 'route':
          console.log(`[EXECUTE] Executing route...`);
          result = await this.executeRoute(resolvedParams, workflowId);
          break;
        case 'iterate':
          console.log(`[EXECUTE] Executing iterate...`);
          result = await this.executeIterate(resolvedParams, workflowId, node.position, options);
          break;
        case 'group':
          console.log(`[EXECUTE] Executing group...`);
          result = await this.executeGroup(resolvedParams, workflowId, node.position);
          break;
        case 'agent':
          result = await this.executeAgent(resolvedParams);
          break;
        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }

      // Log successful execution
      await this.logExecution(nodeId, workflowId, 'success', 'Node executed successfully', result);
      
      // Add visual observation for UI-affecting nodes
      if (visualObservationService.shouldObserveNode(node.type, this.getNodeDescription(node)) && 
          visualObservationService.isEnabled()) {
        try {
          console.log(`[EXECUTE] Capturing visual observation for node ${node.position}`);
          
          // Get the current page
          const stagehand = await this.getStagehand();
          const activePage = this.activeTabName === 'main' ? this.mainPage : 
                           (this.stagehandPages?.[this.activeTabName] || this.mainPage);
          
          const visualObservation = await visualObservationService.captureAndAnalyze(
            activePage,
            node.type,
            this.getNodeDescription(node),
            result
          );
          
          // Embed observation in the result
          if (visualObservation.success && visualObservation.observation) {
            result = {
              ...(typeof result === 'object' ? result : { value: result }),
              _page_observation: visualObservation.observation
            };
            console.log(`[EXECUTE] Visual observation captured: ${visualObservation.observation.substring(0, 100)}...`);
          }
        } catch (obsError) {
          console.error('[EXECUTE] Failed to capture visual observation:', obsError);
          // Don't fail the node execution
        }
      }
      
      // Update node status AND result
      const { data: updatedNode, error: updateError } = await supabase
        .from('nodes')
        .update({
          status: 'success',
          result,
          executed_at: new Date().toISOString()
        })
        .eq('id', nodeId)
        .select()
        .single();
      
      if (updateError) {
        console.error(`[EXECUTE] Failed to update node result:`, updateError);
      } else {
        console.log(`[EXECUTE] Successfully updated node ${nodeId} with result:`, updatedNode?.result);
      }
      
      // Also store the result in workflow memory for easy access by subsequent nodes
      // Store by both position (legacy) and alias (new)
      if (result !== null && result !== undefined) {
        try {
          const upserts = [];
          
          // Store by position for backward compatibility
          if (node.position) {
            const positionKey = this.getStorageKey(`node${node.position}`);
            upserts.push({
              workflow_id: workflowId,
              key: positionKey,
              value: result
            });
            console.log(`[EXECUTE] Storing by position key: ${positionKey}`);
          }
          
          // Store by alias for new reference system
          if (node.alias) {
            const aliasKey = this.getStorageKey(node.alias);
            upserts.push({
              workflow_id: workflowId,
              key: aliasKey,
              value: result
            });
            console.log(`[EXECUTE] Storing by alias key: ${aliasKey}`);
          }
          
          if (upserts.length > 0) {
            await supabase
              .from('workflow_memory')
              .upsert(upserts);
            console.log(`[EXECUTE] Stored node ${node.alias || `position ${node.position}`} result in workflow memory`);
          }
          
          // Send real-time update to frontend
          this.sendNodeValueUpdate(nodeId, node.position, result, node.alias || `node${node.position}`);
        } catch (memError) {
          console.error(`[EXECUTE] Failed to store node result in memory:`, memError);
          // Don't fail the execution if memory storage fails
        }
      }
      
      return { success: true, data: result };
    } catch (error) {
      // Log failed execution
      await this.logExecution(nodeId, workflowId, 'error', error.message, { error: error.stack });
      
      // Update node status
      await supabase
        .from('nodes')
        .update({
          status: 'failed',
          result: { error: error.message },
          executed_at: new Date().toISOString()
        })
        .eq('id', nodeId);
      
      throw error;
    }
  }

  async executeBrowserAction(config, workflowId) {
    console.log(`[BROWSER ACTION] Action: ${config.action}, Active tab: ${this.activeTabName}`);
    console.log(`[BROWSER ACTION] Available tabs:`, this.stagehandPages ? Object.keys(this.stagehandPages) : 'none');
    
    const stagehand = await this.getStagehand();
    const page = stagehand.page;
    const context = page.context();
    
    // Helper to get the current active StagehandPage
    const getActiveStagehandPage = async () => {
      // Special handling for 'main' tab
      if (this.activeTabName === 'main') {
        console.log(`[BROWSER ACTION] Using main tab (stored main page reference)`);
        return this.mainPage;
      }
      // If we have named tabs and one is marked as active, use it
      if (this.activeTabName && this.stagehandPages && this.stagehandPages[this.activeTabName]) {
        console.log(`[BROWSER ACTION] Using active tab: ${this.activeTabName}`);
        return this.stagehandPages[this.activeTabName];
      }
      // Otherwise, use the stored main page
      console.log(`[BROWSER ACTION] Using default main page`);
      return this.mainPage;
    };

    switch (config.action) {
      case 'navigate':
        const navigatePage = await getActiveStagehandPage();
        await navigatePage.goto(config.url);
        
        // Update browser state for Director 2.0 (URL might have changed)
        await this.updateBrowserStateInDB();
        
        return { navigated: config.url };
        
      case 'click':
        // Support multiple selector strategies with fallback
        let clicked = false;
        let lastError = null;
        
        // Handle array of selectors (try each until one works)
        const selectors = Array.isArray(config.selector) ? config.selector : [config.selector];
        
        for (const selector of selectors) {
          try {
            if (selector.startsWith('text=')) {
              console.log(`[CLICK] Trying text selector: ${selector}`);
              const activePage = await getActiveStagehandPage();
              await activePage.act({ action: `click on ${selector.slice(5)}` });
              clicked = true;
              break;
            } else if (selector.startsWith('act:')) {
              console.log(`[CLICK] Using natural language: ${selector.slice(4)}`);
              const activePage = await getActiveStagehandPage();
              await activePage.act({ action: selector.slice(4) });
              clicked = true;
              break;
            } else {
              console.log(`[CLICK] Trying CSS selector: ${selector}`);
              const activePage = await getActiveStagehandPage();
              
              // Handle jQuery-style :contains() selectors
              if (selector.includes(':contains(')) {
                console.log(`[CLICK] Detected jQuery-style :contains() selector, converting to Playwright format`);
                
                // Extract the text from :contains('text') or :contains("text")
                const containsMatch = selector.match(/:contains\(['"]([^'"]+)['"]\)/);
                if (containsMatch) {
                  const searchText = containsMatch[1];
                  const baseSelector = selector.substring(0, selector.indexOf(':contains'));
                  
                  // Use Playwright's text selector
                  const playwrightSelector = `${baseSelector}:has-text("${searchText}")`;
                  console.log(`[CLICK] Converted to Playwright selector: ${playwrightSelector}`);
                  
                  try {
                    await activePage.click(playwrightSelector, { timeout: 3000 });
                    clicked = true;
                    break;
                  } catch (textSelectorError) {
                    console.log(`[CLICK] Text selector failed, trying XPath as fallback`);
                    // Try XPath as fallback
                    const xpathSelector = `//${baseSelector.includes('.') ? 'div' : '*'}[contains(text(), "${searchText}")]`;
                    try {
                      await activePage.click(xpathSelector, { timeout: 3000 });
                      clicked = true;
                      break;
                    } catch (xpathError) {
                      console.log(`[CLICK] XPath also failed: ${xpathError.message}`);
                    }
                  }
                }
              }
              
              // Escape CSS selector if it contains special characters
              let escapedSelector = selector;
              if (selector.includes(':') && !selector.includes('\\:') && !selector.includes(':contains')) {
                // For ID selectors with colons, we need to escape them
                if (selector.startsWith('#')) {
                  const id = selector.slice(1);
                  escapedSelector = `[id="${id}"]`; // Use attribute selector instead
                  console.log(`[CLICK] Escaped selector: ${escapedSelector}`);
                }
              }
              
              try {
                await activePage.click(escapedSelector, { timeout: 3000 });
                clicked = true;
                break;
              } catch (cssError) {
                // If CSS selector fails for Gmail thread, try using act as a fallback
                if (selector.includes('thread-f:')) {
                  console.log(`[CLICK] CSS selector failed for Gmail thread, trying act fallback`);
                  
                  // Try to get email data from the current iteration context
                  if (this.iterationContext.length > 0) {
                    const iterContext = this.iterationContext[this.iterationContext.length - 1];
                    const emailData = await this.getStateValue(iterContext.variable, workflowId);
                    
                    if (emailData && emailData.subject) {
                      console.log(`[CLICK] Using act to click on email with subject: "${emailData.subject}"`);
                      await activePage.act({ action: `click on the email with subject "${emailData.subject}"` });
                      clicked = true;
                      break;
                    } else if (emailData && emailData.senderName) {
                      console.log(`[CLICK] Using act to click on email from: "${emailData.senderName}"`);
                      await activePage.act({ action: `click on the email from "${emailData.senderName}"` });
                      clicked = true;
                      break;
                    }
                  }
                }
                throw cssError; // Re-throw if not a Gmail thread or fallback failed
              }
            }
          } catch (error) {
            console.log(`[CLICK] Selector failed: ${selector}, error: ${error.message}`);
            lastError = error;
          }
        }
        
        if (!clicked && config.fallback) {
          console.log(`[CLICK] All selectors failed, using fallback instruction: ${config.fallback}`);
          const activePage = await getActiveStagehandPage();
          await activePage.act({ action: config.fallback });
          clicked = true;
        }
        
        if (!clicked) {
          throw lastError || new Error('Click failed - no selectors worked');
        }
        
        return { clicked: config.selector };
        
      case 'type':
        // Resolve variables in the text
        console.log(`[TYPE ACTION] Original text: "${config.text || config.value}"`);
        console.log(`[TYPE ACTION] Workflow ID: ${workflowId}`);
        console.log(`[TYPE ACTION] Selector: ${config.selector}`);
        
        let textToType = config.text || config.value;
        
        // Check if it's a state reference (e.g., state.gmailCreds.email)
        if (typeof textToType === 'string' && textToType.startsWith('state.')) {
          const path = textToType.substring(6); // Remove 'state.' prefix
          textToType = await this.getStateValue(path, workflowId);
          console.log(`[TYPE ACTION] Resolved from state: "${textToType}"`);
        } else {
          // Try template resolution for backward compatibility
          textToType = await this.resolveVariable(textToType, workflowId);
          console.log(`[TYPE ACTION] Resolved text: "${textToType}"`);
        }
        
        if (!textToType || textToType === 'undefined') {
          console.error(`[TYPE ACTION] No text to type!`);
          console.error(`[TYPE ACTION] Original value: "${config.text || config.value}"`);
          console.error(`[TYPE ACTION] This usually means the state variable doesn't exist.`);
          throw new Error(`No text to type. Tried to access: "${config.text || config.value}" but got undefined`);
        }
        
        // Support multiple selector strategies with fallback
        let typed = false;
        let lastTypeError = null;
        
        // Handle array of selectors (try each until one works)
        const typeSelectors = Array.isArray(config.selector) ? config.selector : [config.selector];
        
        for (const selector of typeSelectors) {
          try {
            if (selector.startsWith('text=')) {
              console.log(`[TYPE ACTION] Using text selector: ${selector}`);
              const activePage = await getActiveStagehandPage();
              await activePage.act({ action: `type "${textToType}" into ${selector.slice(5)}` });
              typed = true;
              break;
            } else if (selector.startsWith('act:')) {
              console.log(`[TYPE ACTION] Using natural language: ${selector.slice(4)}`);
              const activePage = await getActiveStagehandPage();
              await activePage.act({ action: `${selector.slice(4)} and type "${textToType}"` });
              typed = true;
              break;
            } else {
              console.log(`[TYPE ACTION] Using CSS selector: ${selector}`);
              const activePage = await getActiveStagehandPage();
              await activePage.type(selector, textToType, { timeout: 5000 });
              typed = true;
              break;
            }
          } catch (error) {
            console.log(`[TYPE ACTION] Selector failed: ${selector}, error: ${error.message}`);
            lastTypeError = error;
          }
        }
        
        if (!typed && config.fallback) {
          console.log(`[TYPE ACTION] All selectors failed, using fallback: ${config.fallback}`);
          const activePage = await getActiveStagehandPage();
          await activePage.act({ action: `${config.fallback} and type "${textToType}"` });
          typed = true;
        }
        
        if (!typed) {
          throw lastTypeError || new Error('Type failed - no selectors worked');
        }
        
        console.log(`[TYPE ACTION] Successfully typed text`);
        return { typed: textToType };
        
      case 'wait':
        const waitPage = await getActiveStagehandPage();
        await waitPage.waitForTimeout(config.duration || 1000);
        return { waited: config.duration || 1000 };
        
      case 'openNewTab':
        // Get StageHand instance to access its context
        const stagehandForNewTab = await this.getStagehand();
        
        // Create new page through StageHand's context
        // This returns a Page object with act/extract/observe methods
        const newPage = await stagehandForNewTab.context.newPage();
        
        if (config.url) {
          await newPage.goto(config.url);
        }
        
        // Store the Page reference if a name is provided
        if (config.name) {
          if (!this.stagehandPages) {
            this.stagehandPages = {};
          }
          this.stagehandPages[config.name] = newPage;
          // Mark this tab as active
          this.activeTabName = config.name;
        }
        
        // Make the new tab visually active
        // newPage is already a Page object with bringToFront method
        await newPage.bringToFront();
        
        console.log(`[OPEN NEW TAB] Created new tab: ${config.name || 'unnamed'}`);
        console.log(`[OPEN NEW TAB] StageHand automatically wrapped it with act/extract/observe capabilities`);
        console.log(`[OPEN NEW TAB] Tab is now active for subsequent operations`);
        
        // Update browser state for Director 2.0
        await this.updateBrowserStateInDB();
        
        return { openedTab: config.name || 'unnamed', url: config.url, active: true };
        
      case 'switchTab':
        console.log(`[SWITCH TAB] Attempting to switch to tab: ${config.tabName}`);
        console.log(`[SWITCH TAB] Created tabs:`, this.stagehandPages ? Object.keys(this.stagehandPages) : 'none');
        
        // Initialize stagehandPages if it doesn't exist
        if (!this.stagehandPages) {
          this.stagehandPages = {};
        }
        
        let targetPage;
        
        // Special handling for 'main' tab - use the stored main page reference
        if (config.tabName === 'main') {
          console.log(`[SWITCH TAB] Switching to main tab (stored main page reference)`);
          targetPage = this.mainPage;
        } else if (this.stagehandPages[config.tabName]) {
          console.log(`[SWITCH TAB] Switching to named tab: ${config.tabName}`);
          // stagehandPages now stores Page objects directly
          targetPage = this.stagehandPages[config.tabName];
        } else {
          throw new Error(`Tab with name "${config.tabName}" not found. Available tabs: main, ${Object.keys(this.stagehandPages).join(', ')}`);
        }
        
        // Bring the page to front
        await targetPage.bringToFront();
        
        // Mark this tab as the active one
        this.activeTabName = config.tabName;
        
        console.log(`[SWITCH TAB] Successfully switched to tab: ${config.tabName}`);
        console.log(`[SWITCH TAB] StagehandPage is active and ready for commands`);
        
        // Update browser state for Director 2.0
        await this.updateBrowserStateInDB();
        
        return { switchedTo: config.tabName };
        
      case 'back':
        const backPage = await getActiveStagehandPage();
        await backPage.goBack();
        return { action: 'navigated back' };
        
      case 'forward':
        const forwardPage = await getActiveStagehandPage();
        await forwardPage.goForward();
        return { action: 'navigated forward' };
        
      case 'refresh':
        const refreshPage = await getActiveStagehandPage();
        await refreshPage.reload();
        return { action: 'page refreshed' };
        
      case 'screenshot':
        const screenshotPage = await getActiveStagehandPage();
        const screenshotOptions = { 
          path: config.path,
          fullPage: config.fullPage !== false  // Default to true
        };
        if (config.selector) {
          const element = await screenshotPage.$(config.selector);
          if (element) {
            await element.screenshot(screenshotOptions);
          }
        } else {
          await screenshotPage.screenshot(screenshotOptions);
        }
        return { screenshot: config.path || 'taken' };
        
      case 'listTabs':
        const pages = context.pages();
        const tabList = [];
        // Add the main tab
        tabList.push({
          name: 'main',
          url: this.mainPage.url(),
          title: this.mainPage.title(),
          active: this.activeTabName === 'main'
        });
        // Add named tabs
        for (const [name, stagehandPage] of Object.entries(this.stagehandPages || {})) {
          tabList.push({
            name: name,
            url: stagehandPage.url(),
            title: stagehandPage.title(),
            active: this.activeTabName === name
          });
        }
        return { tabs: tabList };
        
      case 'getCurrentTab':
        const currentPage = await getActiveStagehandPage();
        return {
          url: currentPage.url(),
          title: await currentPage.title()
        };
        
      case 'keypress':
        // Native keyboard press - faster than using act for simple keys
        console.log(`[KEYPRESS] Pressing key: ${config.key}`);
        const keypressPage = await getActiveStagehandPage();
        await keypressPage.keyboard.press(config.key);
        console.log(`[KEYPRESS] Key pressed: ${config.key}`);
        return { pressed: config.key };
        
      case 'act':
        // Use StageHand's natural language action capability
        console.log(`[ACT] Executing natural language action: ${config.instruction}`);
        const activePage = await getActiveStagehandPage();
        console.log(`[ACT] Current URL before action: ${activePage.url()}`);
        const result = await activePage.act({ action: config.instruction });
        console.log(`[ACT] Action completed, result:`, result);
        console.log(`[ACT] Current URL after action: ${activePage.url()}`);
        return { acted: config.instruction, result };
        
      default:
        throw new Error(`Unknown browser action: ${config.action}`);
    }
  }

  async executeBrowserQuery(config) {
    console.log(`[BROWSER_QUERY] Executing ${config.method} with instruction: ${config.instruction}`);
    console.log(`[BROWSER_QUERY] Schema:`, JSON.stringify(config.schema, null, 2));
    
    const stagehand = await this.getStagehand();
    
    // Helper to get the active StagehandPage
    const getActiveStagehandPage = async () => {
      // Special handling for 'main' tab
      if (this.activeTabName === 'main') {
        return this.mainPage;
      }
      // If we have named tabs and one is marked as active, use it
      if (this.activeTabName && this.stagehandPages && this.stagehandPages[this.activeTabName]) {
        return this.stagehandPages[this.activeTabName];
      }
      // Fallback to main page if no active tab
      return this.mainPage;
    };

    if (config.method === 'extract') {
      // Convert simple JSON schema to Zod if provided
      let zodSchema = undefined;
      if (config.schema && typeof config.schema === 'object') {
        zodSchema = this.convertJsonSchemaToZod(config.schema);
      }
      
      // Use the active StagehandPage's extract method
      const activePage = await getActiveStagehandPage();
      console.log(`[BROWSER_QUERY] Current URL: ${activePage.url()}`);
      
      const enhancedInstruction = `${config.instruction}

CRITICAL: You must ONLY extract data that is actually visible on the page. DO NOT hallucinate, make up, or generate example data. If no data matching the criteria is found, return an empty array or null values. Never create fictional data.`;
      
      const result = await activePage.extract({
        instruction: enhancedInstruction,
        schema: zodSchema
      });
      
      console.log(`[BROWSER_QUERY] Extract result:`, JSON.stringify(result, null, 2));
      
      // If extracting emails, log more details
      if (config.instruction && config.instruction.toLowerCase().includes('email')) {
        console.log(`[BROWSER_QUERY] Email extraction detected`);
        if (result && result.emails && Array.isArray(result.emails)) {
          console.log(`[BROWSER_QUERY] Found ${result.emails.length} emails`);
          result.emails.forEach((email, idx) => {
            console.log(`[BROWSER_QUERY] Email ${idx + 1}: ${email.subject || 'No subject'} from ${email.senderEmail || 'Unknown'} on ${email.date || 'Unknown date'}`);
          });
        }
      }
      
      return result;
    } else if (config.method === 'observe') {
      // Use the active StagehandPage's observe method
      const activePage = await getActiveStagehandPage();
      const result = await activePage.observe({
        instruction: config.instruction
      });
      return result;
    } else if (config.method === 'validate') {
      // New validation method - supports deterministic and AI validation
      const activePage = await getActiveStagehandPage();
      console.log(`[BROWSER_QUERY] Validating ${config.rules?.length || 0} rules`);
      
      const results = {
        passed: true,
        errors: [],
        details: {
          rule_results: [],
          validated_url: activePage.url(),
          timestamp: new Date().toISOString()
        }
      };
      
      for (const rule of config.rules || []) {
        console.log(`[BROWSER_QUERY] Checking rule: ${rule.type} - ${rule.description || 'No description'}`);
        
        const ruleResult = {
          type: rule.type,
          description: rule.description || '',
          passed: false,
          error: null
        };
        
        try {
          switch (rule.type) {
            case 'element_exists':
              // Check if element exists using Playwright
              const elementExists = await activePage.$(rule.selector);
              ruleResult.passed = !!elementExists;
              if (!ruleResult.passed) {
                ruleResult.error = `Element not found: ${rule.selector}`;
              }
              break;
              
            case 'element_absent':
              // Check if element does NOT exist
              const elementAbsent = await activePage.$(rule.selector);
              ruleResult.passed = !elementAbsent;
              if (!ruleResult.passed) {
                ruleResult.error = `Element should not exist but found: ${rule.selector}`;
              }
              break;
              
            case 'ai_assessment':
              // Use Stagehand's observe for AI-powered validation
              const aiResult = await activePage.observe({
                instruction: rule.instruction
              });
              
              // Check if result matches expected value
              if (rule.expected) {
                ruleResult.passed = aiResult === rule.expected || 
                  (typeof aiResult === 'string' && aiResult.toLowerCase().includes(rule.expected.toLowerCase()));
              } else {
                // If no expected value, assume true result means passed
                ruleResult.passed = !!aiResult;
              }
              
              if (!ruleResult.passed) {
                ruleResult.error = `AI assessment failed. Expected: ${rule.expected}, Got: ${aiResult}`;
              }
              ruleResult.ai_result = aiResult;
              break;
              
            default:
              ruleResult.error = `Unknown validation rule type: ${rule.type}`;
              break;
          }
        } catch (error) {
          ruleResult.error = `Validation error: ${error.message}`;
          console.error(`[BROWSER_QUERY] Rule validation error:`, error);
        }
        
        results.details.rule_results.push(ruleResult);
        
        if (!ruleResult.passed) {
          results.passed = false;
          results.errors.push(ruleResult.error);
          console.log(`[BROWSER_QUERY] Rule failed: ${ruleResult.error}`);
        } else {
          console.log(`[BROWSER_QUERY] Rule passed: ${rule.description || rule.type}`);
        }
      }
      
      console.log(`[BROWSER_QUERY] Validation complete. Overall result: ${results.passed ? 'PASSED' : 'FAILED'}`);
      
      // Handle failure behavior
      if (!results.passed && config.onFailure === 'stop_workflow') {
        const errorSummary = results.errors.join('; ');
        throw new Error(`Validation failed: ${errorSummary}`);
      }
      
      return results;
    } else {
      throw new Error(`Unknown browser_query method: ${config.method}`);
    }
  }

  async executeTransform(config, inputData) {
    // Simple transform implementation
    switch (config.operation) {
      case 'map':
        return inputData.map(item => eval(config.expression));
        
      case 'filter':
        return inputData.filter(item => eval(config.expression));
        
      case 'format':
        return eval(config.expression);
        
      default:
        throw new Error(`Unknown transform operation: ${config.operation}`);
    }
  }

  async executeCognition(config, inputData) {
    // If agentTask is provided, delegate to StagehandAgent.ensure()
    if (config.agentTask) {
      const stagehand = await this.getStagehand();
      // Reuse the active page (main or switched)
      const page = stagehand.page;
      const agent = new (await import('@browserbasehq/stagehand')).StagehandAgent(page);
      console.log(`[AGENT] Running agent task:`, JSON.stringify(config.agentTask, null, 2));
      const ok = await agent.ensure(config.agentTask);
      return { ok };
    }

    const prompt = config.prompt.replace('{{input}}', JSON.stringify(inputData));
    
    // OpenAI requires the word "JSON" to appear in the messages when using
    // `response_format: {type: 'json_object'}`.  Append a one-liner if the
    // caller didn't already mention it.
    const needsJsonHint = !!config.schema && !/json/i.test(prompt);
    const safePrompt   = needsJsonHint
      ? `${prompt}\n\nRespond ONLY in valid JSON format.`
      : prompt;

    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini-2025-04-14',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that processes data according to instructions.' },
        { role: 'user', content: safePrompt }
      ],
      temperature: 1,
      response_format: config.schema ? { type: 'json_object' } : undefined
    });

    const response = completion.choices[0].message.content;
    
    return config.schema ? JSON.parse(response) : response;
  }

  async executeMemory(config, workflowId) {
    console.log(`[MEMORY] Operation: ${config.operation}, Key: ${config.key}`);
    console.log(`[MEMORY] Value:`, JSON.stringify(config.value, null, 2));
    
    switch (config.operation) {
      case 'set':
        // Resolve environment variables AND template variables (e.g., {{node23.investors}})
        let resolvedValue = config.value;
        if (typeof resolvedValue === 'object') {
          resolvedValue = this.resolveEnvVarsInObject(resolvedValue);
        } else if (typeof resolvedValue === 'string') {
          // First resolve env vars like {{ENV}}
          resolvedValue = this.resolveEnvVar(resolvedValue);
          // Then resolve workflow template vars such as {{node23.investors}}
          resolvedValue = await this.resolveTemplateVariables(resolvedValue, workflowId);
          // If the resulting string is valid JSON, parse it so we store real arrays/objects
          try {
            resolvedValue = JSON.parse(resolvedValue);
          } catch (_) {
            /* leave as string */
          }
        }
        
        console.log(`[MEMORY] Resolved value:`, JSON.stringify(resolvedValue, null, 2));
        
        const { data: upsertData, error } = await supabase
          .from('workflow_memory')
          .upsert(
            {
              workflow_id: workflowId,
              key: config.key,
              value: resolvedValue
            },
            { onConflict: 'workflow_id,key' }
          )
          .select();
        
        if (error) {
          console.error(`[MEMORY] Error setting value:`, JSON.stringify(error, null, 2));
          console.error(`[MEMORY] Error type:`, error.constructor.name);
          console.error(`[MEMORY] Error code:`, error.code);
          console.error(`[MEMORY] Error message:`, error.message);
          console.error(`[MEMORY] Error details:`, error.details);
          console.error(`[MEMORY] Error hint:`, error.hint);
          console.error(`[MEMORY] Full error object:`, error);
          
          // Check if it's a missing table error
          if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            console.error(`[MEMORY] Table 'workflow_memory' does not exist in the database!`);
            console.error(`[MEMORY] Please create the table using the following SQL:`);
            console.error(`
CREATE TABLE workflow_memory (
  id SERIAL PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workflow_id, key)
);

CREATE INDEX idx_workflow_memory_workflow_id ON workflow_memory(workflow_id);
CREATE INDEX idx_workflow_memory_key ON workflow_memory(key);
            `);
          }
          throw error;
        }
        
        console.log(`[MEMORY] Successfully set ${config.key}, data:`, upsertData);
        return { set: config.key };
        
      case 'get':
        const { data, error: getError } = await supabase
          .from('workflow_memory')
          .select('value')
          .eq('workflow_id', workflowId)
          .eq('key', config.key)
          .single();
        
        if (getError) {
          console.error(`[MEMORY] Error getting value:`, JSON.stringify(getError, null, 2));
          console.error(`[MEMORY] Get error code:`, getError.code);
          console.error(`[MEMORY] Get error message:`, getError.message);
          
          // Check if it's a missing table error
          if (getError.code === '42P01' || getError.message?.includes('relation') || getError.message?.includes('does not exist')) {
            console.error(`[MEMORY] Table 'workflow_memory' does not exist!`);
          }
          
          // Don't throw on get errors, just return null
          return null;
        }
        
        console.log(`[MEMORY] Retrieved value for key '${config.key}':`, data?.value);
        return data?.value || null;
        
      default:
        throw new Error(`Unknown memory operation: ${config.operation}`);
    }
  }

  async executeContext(config, workflowId) {
    // Context is the new name for memory, same functionality
    return this.executeMemory(config, workflowId);
  }

  async executeRoute(config, workflowId) {
    console.log(`[ROUTE] Evaluating route with value path: ${config.value}`);
    
    // Get the value to check
    let valueToCheck;
    if (config.value && typeof config.value === 'string') {
      // Try to resolve any path-like value
      if (config.value.includes('.') || config.value.startsWith('node') || config.value.startsWith('state')) {
        // Remove 'state.' prefix if present for consistency
        const path = config.value.startsWith('state.') ? config.value.substring(6) : config.value;
        valueToCheck = await this.getStateValue(path, workflowId);
        console.log(`[ROUTE] Retrieved value: ${valueToCheck}`);
      } else {
        // Direct value
        valueToCheck = config.value;
      }
    } else {
      valueToCheck = config.value;
    }
    
    // Determine which path to take
    let selectedPath = null;
    let selectedBranch = null;
    
    if (config.paths) {
      // Simple value routing
      const pathKey = String(valueToCheck);
      if (config.paths[pathKey]) {
        selectedPath = pathKey;
        selectedBranch = config.paths[pathKey];
        console.log(`[ROUTE] Taking path: ${pathKey}`);
      } else if (config.paths.default) {
        selectedPath = 'default';
        selectedBranch = config.paths.default;
        console.log(`[ROUTE] Taking default path`);
      }
    } else if (config.conditions) {
      // Condition-based routing
      for (const condition of config.conditions) {
        const conditionMet = await this.evaluateCondition(condition, workflowId);
        if (conditionMet) {
          selectedPath = `condition_${config.conditions.indexOf(condition)}`;
          selectedBranch = condition.branch;
          console.log(`[ROUTE] Condition met: ${JSON.stringify(condition)}`);
          break;
        }
      }
      
      if (!selectedBranch && config.default) {
        selectedPath = 'default';
        selectedBranch = config.default;
        console.log(`[ROUTE] No conditions met, taking default path`);
      }
    }
    
    // Execute the selected branch
    if (selectedBranch) {
      // Check if this is the new format (array of positions) or old format (array of node objects)
      if (Array.isArray(selectedBranch)) {
        if (selectedBranch.length > 0 && typeof selectedBranch[0] === 'number') {
          // New format: array of node positions
          console.log(`[ROUTE] Executing branch with ${selectedBranch.length} node positions: ${selectedBranch.join(', ')}`);
          const results = [];
          
          for (const nodePosition of selectedBranch) {
            // Fetch the node by position
            const { data: node } = await supabase
              .from('nodes')
              .select('*')
              .eq('workflow_id', workflowId)
              .eq('position', nodePosition)
              .single();
              
            if (node) {
              console.log(`[ROUTE] Executing node at position ${nodePosition}: ${node.type} - ${node.description}`);
              const result = await this.execute(node.id, workflowId);
              results.push(result);
            } else {
              console.log(`[ROUTE] Warning: Could not find node at position ${nodePosition}`);
            }
          }
          return { path: selectedPath, results };
        } else {
          // Old format: array of node objects (for backward compatibility)
          console.log(`[ROUTE] Executing branch with ${selectedBranch.length} inline nodes`);
          const results = [];
          
          for (let i = 0; i < selectedBranch.length; i++) {
            const node = selectedBranch[i];
            console.log(`[ROUTE] Executing nested node: ${node.type} - ${node.description}`);
            const result = await this.executeNodeConfig(node, workflowId);
            results.push(result);
          }
          return { path: selectedPath, results };
        }
      } else if (typeof selectedBranch === 'number') {
        // New format: single node position
        console.log(`[ROUTE] Executing single node at position ${selectedBranch}`);
        
        // Fetch the node by position
        const { data: node } = await supabase
          .from('nodes')
          .select('*')
          .eq('workflow_id', workflowId)
          .eq('position', selectedBranch)
          .single();
          
        if (node) {
          console.log(`[ROUTE] Executing node at position ${selectedBranch}: ${node.type} - ${node.description}`);
          const result = await this.execute(node.id, workflowId);
          return { path: selectedPath, result };
        } else {
          console.log(`[ROUTE] Warning: Could not find node at position ${selectedBranch}`);
          return { path: selectedPath, result: null };
        }
      } else if (selectedBranch && typeof selectedBranch === 'object') {
        // Old format: single node object
        console.log(`[ROUTE] Executing nested node: ${selectedBranch.type}`);
        const result = await this.executeNodeConfig(selectedBranch, workflowId);
        return { path: selectedPath, result };
      }
    }
    
    console.log(`[ROUTE] No matching path found`);
    return { path: null, message: 'No matching path found' };
  }
  
  async executeNodeConfig(nodeConfig, workflowId) {
    // Execute a node configuration directly (used by route, iterate, and group)
    console.log(`[EXECUTE_CONFIG] Executing ${nodeConfig.type} node`);
    
    // Map the config to params based on node type
    const params = nodeConfig.config || nodeConfig.params || {};
    
    let result;
    switch (nodeConfig.type) {
      case 'browser_action':
        result = await this.executeBrowserAction(params, workflowId);
        break;
      case 'browser_query':
        result = await this.executeBrowserQuery(params);
        break;
      case 'transform':
        result = await this.executeTransform(params);
        break;
      case 'cognition':
        result = await this.executeCognition(params);
        break;
      case 'context':
        result = await this.executeContext(params, workflowId);
        break;
      case 'route':
        result = await this.executeRoute(params, workflowId);
        break;
      case 'iterate':
        result = await this.executeIterate(params, workflowId);
        break;
      case 'group':
        result = await this.executeGroup(params, workflowId);
        break;
      default:
        throw new Error(`Unsupported node type: ${nodeConfig.type}`);
    }
    
    // Store nested node result in workflow memory if it has a position
    if (result !== null && result !== undefined && nodeConfig.position) {
      try {
        await supabase
          .from('workflow_memory')
          .upsert({
            workflow_id: workflowId,
            key: `node${nodeConfig.position}`,
            value: result
          });
        console.log(`[EXECUTE_CONFIG] Stored nested node position ${nodeConfig.position} result in workflow memory`);
      } catch (memError) {
        console.error(`[EXECUTE_CONFIG] Failed to store nested node result in memory:`, memError);
        // Don't fail the execution if memory storage fails
      }
    }
    
    return result;
  }
  
  async getStateValue(path, workflowId) {
    // Get value from workflow memory or previous node results
    console.log(`[STATE] Getting value for path: ${path}`);
    
    // Handle different path formats
    let normalizedPath = path;
    
    // Convert "nodes.88.result" to "node88.result" for consistency
    if (path.startsWith('nodes.')) {
      normalizedPath = path.replace('nodes.', 'node');
    }
    
    // Check if it's a node result reference (e.g., node82.loginRequired or node88.result.needsLogin)
    if (normalizedPath.includes('.')) {
      const parts = normalizedPath.split('.');
      const nodeRef = parts[0];
      
      // Try to get from node results
      if (nodeRef.startsWith('node')) {
        const nodeIdentifier = nodeRef.replace('node', '');
        
        // First try to get from workflow memory (faster)
        // This will work for position-based references (node1, node2, etc.)
        // Use iteration-aware storage key
        const storageKey = this.getStorageKey(`node${nodeIdentifier}`);
        console.log(`[STATE] Looking for key: ${storageKey}`);
        
        const { data: memoryData, error: memError } = await supabase
          .from('workflow_memory')
          .select('value')
          .eq('workflow_id', workflowId)
          .eq('key', storageKey)
          .single();
          
        if (!memoryData) {
          // If not found in memory, look up node by alias
          console.log(`[STATE] Not found in memory, looking up node by alias: ${nodeRef}`);
          const { data: nodeByAlias } = await supabase
            .from('nodes')
            .select('id, position, result')
            .eq('workflow_id', workflowId)
            .eq('alias', nodeRef)
            .single();
          
          if (nodeByAlias) {
            // Store in memory for future reference
            if (nodeByAlias.result) {
              await this.storeNodeResult(nodeByAlias.id, workflowId, nodeByAlias.result);
            }
            memoryData = { value: nodeByAlias.result };
          }
        }
        
        if (memoryData && memoryData.value !== null) {
          // Log a summary instead of the full value to avoid spam
          const valueType = Array.isArray(memoryData.value) ? `array[${memoryData.value.length}]` : typeof memoryData.value;
          console.log(`[STATE] Found node ${nodeIdentifier} result in memory with key ${storageKey} (type: ${valueType})`);
          
          // Navigate to the nested property
          let value = memoryData.value;
          
          // Skip "result" in the path if present (node88.result.needsLogin -> just needsLogin)
          const propertyPath = parts.slice(1);
          if (propertyPath[0] === 'result' && propertyPath.length > 1) {
            propertyPath.shift();
          }
          
          for (const prop of propertyPath) {
            value = value?.[prop];
          }
          
          // Log summary of resolved value too
          const resolvedType = Array.isArray(value) ? `array[${value.length}]` : typeof value;
          console.log(`[STATE] Resolved to value of type: ${resolvedType}`);
          return value;
        }
        
        // Fall back to direct node lookup if not in memory
        // Try by position first (if it's a number), then by ID
        let node;
        if (!isNaN(nodeIdentifier)) {
          // It's a number, so try position first
          const { data: nodeByPosition } = await supabase
            .from('nodes')
            .select('result')
            .eq('position', parseInt(nodeIdentifier))
            .eq('workflow_id', workflowId)
            .single();
          node = nodeByPosition;
        }
        
        if (!node) {
          // Try by ID as fallback
          const { data: nodeById } = await supabase
            .from('nodes')
            .select('result')
            .eq('id', nodeIdentifier)
            .eq('workflow_id', workflowId)
            .single();
          node = nodeById;
        }
          
        if (node && node.result) {
          console.log(`[STATE] Found node ${nodeIdentifier} result from database:`, node.result);
          
          // Navigate to the nested property
          let value = node.result;
          
          // Skip "result" in the path if present (node88.result.needsLogin -> just needsLogin)
          const propertyPath = parts.slice(1);
          if (propertyPath[0] === 'result' && propertyPath.length > 1) {
            propertyPath.shift();
          }
          
          for (const prop of propertyPath) {
            value = value?.[prop];
          }
          console.log(`[STATE] Resolved to value:`, value);
          return value;
        }
      }
    }
    
    // Try workflow memory with iteration-aware key
    const storageKey = this.getStorageKey(path);
    const { data } = await supabase
      .from('workflow_memory')
      .select('value')
      .eq('workflow_id', workflowId)
      .eq('key', storageKey)
      .single();
      
    console.log(`[STATE] Found in memory:`, data?.value);
    
    if (!data) {
      // Try to resolve nested paths for any variable (not just nodes)
      if (normalizedPath.includes('.')) {
        const parts = normalizedPath.split('.');
        const baseKey = parts[0];
        
        // Try to get the base variable
        const baseStorageKey = this.getStorageKey(baseKey);
        console.log(`[STATE] Trying to resolve nested path. Base key: ${baseStorageKey}`);
        
        const { data: baseData } = await supabase
          .from('workflow_memory')
          .select('value')
          .eq('workflow_id', workflowId)
          .eq('key', baseStorageKey)
          .single();
          
        if (baseData && baseData.value !== null) {
          console.log(`[STATE] Found base variable ${baseKey}`);
          
          // Navigate through the nested path
          let value = baseData.value;
          const propertyPath = parts.slice(1);
          
          // Skip "result" in the path if present (for consistency with node references)
          if (propertyPath[0] === 'result' && propertyPath.length > 1) {
            propertyPath.shift();
          }
          
          // Navigate through each property
          for (const prop of propertyPath) {
            if (value === null || value === undefined) {
              console.log(`[STATE] Cannot access property '${prop}' of null/undefined`);
              return undefined;
            }
            value = value[prop];
          }
          
          const resolvedType = Array.isArray(value) ? `array[${value.length}]` : typeof value;
          console.log(`[STATE] Resolved nested path to value of type: ${resolvedType}`);
          return value;
        }
      }
      
      // Original fallback logic for iteration-specific keys
      if (storageKey.includes('@iter:')) {
        const parts = normalizedPath.split('.');
        const nodeRef = parts[0];
        
        const globalKey = nodeRef.startsWith('node') ? nodeRef : path;
        console.log(`[STATE] Iteration-specific key not found, trying global key: ${globalKey}`);
        const { data: globalData } = await supabase
          .from('workflow_memory')
          .select('value')
          .eq('workflow_id', workflowId)
          .eq('key', globalKey)
          .single();
        if (globalData) {
          console.log(`[STATE] Fallback found global key ${globalKey}`);
          return globalData.value;
        }
      }
    }
    
    // If not found, log available keys for debugging
    if (!data) {
      const { data: allMemory } = await supabase
        .from('workflow_memory')
        .select('key')
        .eq('workflow_id', workflowId);
      
      console.log(`[STATE] Variable '${path}' not found. Available variables:`, allMemory?.map(m => m.key) || []);
    }
    
    return data?.value;
  }
  
  async evaluateCondition(condition, workflowId) {
    // Evaluate a single condition
    const value = await this.getStateValue(condition.path, workflowId);
    const expected = condition.value;
    
    switch (condition.operator) {
      case 'equals':
        return value === expected;
      case 'notEquals':
        return value !== expected;
      case 'contains':
        return String(value).includes(String(expected));
      case 'exists':
        return value !== null && value !== undefined && value !== '';
      case 'greater':
        return Number(value) > Number(expected);
      case 'less':
        return Number(value) < Number(expected);
      case 'greaterOrEqual':
        return Number(value) >= Number(expected);
      case 'lessOrEqual':
        return Number(value) <= Number(expected);
      case 'matches':
        return new RegExp(expected).test(String(value));
      default:
        console.warn(`[ROUTE] Unknown operator: ${condition.operator}`);
        return false;
    }
  }
  
  async executeIteration(nodeId, workflowId, iterationIndex, iterationData) {
    console.log(`[EXECUTE_ITERATION] Executing single iteration ${iterationIndex} for node ${nodeId}`);
    
    // Get the iterate node
    const { data: node, error } = await supabase
      .from('nodes')
      .select('*')
      .eq('id', nodeId)
      .single();
      
    if (error || !node) {
      throw new Error(`Node ${nodeId} not found`);
    }
    
    if (node.type !== 'iterate') {
      throw new Error(`Node ${nodeId} is not an iterate node`);
    }
    
    const config = node.params;
    const variable = config.variable || 'item';
    const indexVariable = config.index || `${variable}Index`;
    
    // Push iteration context for this single iteration
    this.pushIterationContext(node.position, iterationIndex, variable, 1);
    
    try {
      // Set iteration variables in memory (these use the current context)
      const varKey = this.getStorageKey(variable);
      const indexKey = this.getStorageKey(indexVariable);
      const totalKey = this.getStorageKey(`${variable}Total`);
      
      await supabase
        .from('workflow_memory')
        .upsert([
          { workflow_id: workflowId, key: varKey, value: iterationData },
          { workflow_id: workflowId, key: indexKey, value: iterationIndex },
          { workflow_id: workflowId, key: totalKey, value: 1 } // Single iteration
        ]);
      
      // Execute body
      let result;
      
      if (Array.isArray(config.body)) {
        if (config.body.length > 0 && typeof config.body[0] === 'number') {
          // New format: array of node positions
          result = [];
          console.log(`[EXECUTE_ITERATION] Executing body with ${config.body.length} node positions`);
          
          for (const nodePosition of config.body) {
            const { data: bodyNode } = await supabase
              .from('nodes')
              .select('*')
              .eq('workflow_id', workflowId)
              .eq('position', nodePosition)
              .single();
              
            if (bodyNode) {
              console.log(`[EXECUTE_ITERATION] Executing node at position ${nodePosition}: ${bodyNode.type}`);
              const nodeResult = await this.execute(bodyNode.id, workflowId);
              result.push(nodeResult);
            } else {
              console.log(`[EXECUTE_ITERATION] Warning: Could not find node at position ${nodePosition}`);
            }
          }
        }
      }
      
      console.log(`[EXECUTE_ITERATION] Iteration ${iterationIndex} completed successfully`);
      return { success: true, result, iterationIndex };
      
    } catch (error) {
      console.error(`[EXECUTE_ITERATION] Error in iteration ${iterationIndex}:`, error);
      return { success: false, error: error.message, iterationIndex };
    } finally {
      // Always pop the iteration context
      this.popIterationContext();
    }
  }

  async executeIterate(config, workflowId, iterateNodePosition, options = {}) {
    // Validate required fields
    if (!config.over) {
      throw new Error('Iterate node missing required "over" field. Please specify the path to the array to iterate over (e.g., "state.items" or "node4.emails")');
    }
    
    if (!config.variable) {
      throw new Error('Iterate node missing required "variable" field. Please specify the variable name for the current item in each iteration (e.g., "currentItem")');
    }
    
    console.log(`[ITERATE] Starting iteration over: ${config.over}`);
    
    // Get the collection to iterate over
    const collection = await this.getStateValue(config.over.replace('state.', ''), workflowId);
    if (!Array.isArray(collection)) {
      console.warn(`[ITERATE] Value at ${config.over} is not an array:`, collection);
      return { results: [], errors: [], processed: 0, total: 0 };
    }
    
    console.log(`[ITERATE] Found ${collection.length} items to iterate over`);
    
    // If preview mode, return iteration structure without executing
    if (options.previewOnly !== false) {  // Default to preview mode
      console.log(`[ITERATE] Preview mode - preparing iteration structure`);
      
      // Get body node information for display
      let bodyNodes = [];
      if (Array.isArray(config.body) && config.body.length > 0 && typeof config.body[0] === 'number') {
        // Fetch actual nodes by position
        const { data: nodes } = await supabase
          .from('nodes')
          .select('*')
          .eq('workflow_id', workflowId)
          .in('position', config.body)
          .order('position');
        
        bodyNodes = nodes || [];
      }
      
      return {
        iterationCount: collection.length,
        items: collection.map((item, idx) => ({
          index: idx,
          data: item,
          status: 'pending',
          results: []
        })),
        variable: config.variable || 'item',
        bodyNodePositions: config.body,
        bodyNodes: bodyNodes,
        status: 'ready',
        processed: 0,
        total: collection.length
      };
    }
    
    // Full execution mode (when explicitly requested)
    console.log(`[ITERATE] Full execution mode - processing all ${collection.length} items`);
    
    const results = [];
    const errors = [];
    const variable = config.variable || 'item';
    const indexVariable = config.index || `${variable}Index`;
    
    // Process each item
    for (let i = 0; i < collection.length; i++) {
      if (config.limit && i >= config.limit) {
        console.log(`[ITERATE] Reached limit of ${config.limit} items`);
        break;
      }
      
      const item = collection[i];
      console.log(`[ITERATE] Processing item ${i + 1}/${collection.length}`);
      
      // Push iteration context
      this.pushIterationContext(iterateNodePosition, i, variable, collection.length);
      
      try {
        // Set iteration variables in memory (these use the current context)
        const varKey = this.getStorageKey(variable);
        const indexKey = this.getStorageKey(indexVariable);
        const totalKey = this.getStorageKey(`${variable}Total`);
        
        await supabase
          .from('workflow_memory')
          .upsert([
            { workflow_id: workflowId, key: varKey, value: item },
            { workflow_id: workflowId, key: indexKey, value: i },
            { workflow_id: workflowId, key: totalKey, value: collection.length }
          ]);
        
        // Execute body (single node or array of nodes)
        let result;
        
        // Check if this is the new format (array of positions) or old format (array of node objects)
        if (Array.isArray(config.body)) {
          if (config.body.length > 0 && typeof config.body[0] === 'number') {
            // New format: array of node positions
            result = [];
            console.log(`[ITERATE] Executing body with ${config.body.length} node positions: ${config.body.join(', ')}`);
            
            for (const nodePosition of config.body) {
              // Fetch the node by position
              const { data: node } = await supabase
                .from('nodes')
                .select('*')
                .eq('workflow_id', workflowId)
                .eq('position', nodePosition)
                .single();
                
              if (node) {
                console.log(`[ITERATE] Executing node at position ${nodePosition}: ${node.type} - ${node.description}`);
                const nodeResult = await this.execute(node.id, workflowId);
                result.push(nodeResult);
              } else {
                console.log(`[ITERATE] Warning: Could not find node at position ${nodePosition}`);
              }
            }
          } else {
            // Old format: array of node objects
            result = [];
            console.log(`[ITERATE] Executing body with ${config.body.length} inline nodes`);
            
            for (let j = 0; j < config.body.length; j++) {
              const node = config.body[j];
              console.log(`[ITERATE] Executing nested node: ${node.type}`);
              const nodeResult = await this.executeNodeConfig(node, workflowId);
              result.push(nodeResult);
            }
          }
        } else if (typeof config.body === 'number') {
          // New format: single node position
          console.log(`[ITERATE] Executing single node at position ${config.body}`);
          
          // Fetch the node by position
          const { data: node } = await supabase
            .from('nodes')
            .select('*')
            .eq('workflow_id', workflowId)
            .eq('position', config.body)
            .single();
            
          if (node) {
            result = await this.execute(node.id, workflowId);
          } else {
            console.log(`[ITERATE] Warning: Could not find node at position ${config.body}`);
            result = null;
          }
        } else if (config.body && typeof config.body === 'object') {
          // Old format: single node object
          console.log(`[ITERATE] Executing nested node: ${config.body.type}`);
          result = await this.executeNodeConfig(config.body, workflowId);
        }
        
        results.push({ index: i, item, result });
      } catch (error) {
        console.error(`[ITERATE] Error processing item ${i}:`, error);
        errors.push({ index: i, item, error: error.message });
        
        if (!config.continueOnError) {
          console.log(`[ITERATE] Stopping due to error (continueOnError: false)`);
          // Pop context before breaking
          this.popIterationContext();
          break;
        }
      } finally {
        // Always pop the iteration context
        this.popIterationContext();
      }
    }
    
    // Clean up iteration variables
    await supabase
      .from('workflow_memory')
      .delete()
      .eq('workflow_id', workflowId)
      .in('key', [variable, indexVariable, `${variable}Total`]);
    
    return {
      results,
      errors,
      processed: results.length,
      total: collection.length
    };
  }

  async executeGroup(config, workflowId, groupNodePosition) {
    console.log(`[GROUP] Executing group at position ${groupNodePosition}`);
    console.log(`[GROUP] Config:`, JSON.stringify(config, null, 2));
    
    // Handle node range groups (e.g., nodeRange: "1-25" or nodeRange: [1, 25])
    if (config.nodeRange) {
      let startPos, endPos;
      
      // Parse the range
      if (typeof config.nodeRange === 'string') {
        const [start, end] = config.nodeRange.split('-').map(n => parseInt(n.trim()));
        startPos = start;
        endPos = end;
      } else if (Array.isArray(config.nodeRange)) {
        [startPos, endPos] = config.nodeRange;
      } else {
        throw new Error('Invalid nodeRange format. Use "1-25" or [1, 25]');
      }
      
      console.log(`[GROUP] Executing nodes from position ${startPos} to ${endPos}`);
      
      // Get all nodes in the range
      const { data: nodes, error } = await supabase
        .from('nodes')
        .select('*')
        .eq('workflow_id', workflowId)
        .gte('position', startPos)
        .lte('position', endPos)
        .order('position', { ascending: true });
        
      if (error) throw error;
      
      console.log(`[GROUP] Found ${nodes.length} nodes to execute`);
      
      const results = [];
      const errors = [];
      const skippedNodes = new Set(); // Track nodes that should be skipped
      
      // Execute each node in sequence
      for (const node of nodes) {
        // Check if this node should be skipped (it's nested in a route that wasn't taken)
        if (skippedNodes.has(node.position)) {
          console.log(`[GROUP] Skipping node at position ${node.position} (inside unexecuted route branch)`);
          continue;
        }
        
        // Check if this node has a parent position (meaning it's nested)
        if (node.params?._parent_position) {
          console.log(`[GROUP] Skipping nested node at position ${node.position} (will be executed by parent)`);
          continue;
        }
        
        console.log(`[GROUP] Executing node at position ${node.position}: ${node.type} - ${node.description}`);
        
        try {
          const result = await this.execute(node.id, workflowId);
          results.push({
            nodeId: node.id,
            position: node.position,
            type: node.type,
            description: node.description,
            result
          });
          
          // If this was a route node, track which branches were NOT taken
          if (node.type === 'route' && result.path && node.params?.paths) {
            // Find all node positions in branches that were NOT taken
            for (const [branchName, branchNodes] of Object.entries(node.params.paths)) {
              if (branchName !== result.path) {
                // This branch was not taken, mark its nodes as skipped
                if (Array.isArray(branchNodes)) {
                  branchNodes.forEach(pos => {
                    if (typeof pos === 'number') {
                      skippedNodes.add(pos);
                      console.log(`[GROUP] Marking position ${pos} as skipped (${branchName} branch not taken)`);
                    }
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error(`[GROUP] Error executing node ${node.position}:`, error);
          errors.push({
            nodeId: node.id,
            position: node.position,
            error: error.message
          });
          
          // Stop on first error unless continueOnError is set
          if (!config.continueOnError) {
            break;
          }
        }
      }
      
      return {
        groupId: config.groupId || config.name,
        nodeRange: `${startPos}-${endPos}`,
        executed: results.length,
        total: nodes.length,
        skipped: skippedNodes.size,
        results,
        errors: errors.length > 0 ? errors : undefined,
        success: errors.length === 0
      };
    }
    
    // Legacy path for groups with embedded nodes
    throw new Error('Group must specify nodeRange (e.g., "1-25" or [1, 25])');
  }

  async getGroupDefinition(groupId, workflowId) {
    // First check in-memory definitions
    if (this.groupDefinitions.has(groupId)) {
      return this.groupDefinitions.get(groupId);
    }
    
    // Check workflow memory for group definitions
    const { data: groupData } = await supabase
      .from('workflow_memory')
      .select('value')
      .eq('workflow_id', workflowId)
      .eq('key', `group_def_${groupId}`)
      .single();
      
    if (groupData?.value) {
      this.groupDefinitions.set(groupId, groupData.value);
      return groupData.value;
    }
    
    return null;
  }

  setGroupDefinition(groupId, definition) {
    this.groupDefinitions.set(groupId, definition);
  }

  async logExecution(nodeId, workflowId, level, message, details = null) {
    await supabase
      .from('execution_logs')
      .insert({
        workflow_id: workflowId,
        node_id: nodeId,
        level,
        message,
        details,
        timestamp: new Date().toISOString()
      });
  }

  /**
   * Resolve variables in text using template syntax {{variable}}
   */
  async resolveVariable(text, workflowId) {
    console.log(`[RESOLVE] Input text: "${text}", type: ${typeof text}`);
    if (!text || typeof text !== 'string') return text;
    
    // Handle template syntax {{variable}} or {{nested.path}}
    if (text.includes('{{') && text.includes('}}')) {
      console.log(`[RESOLVE] Found template syntax, fetching context for workflow: ${workflowId}`);
      
      // Get workflow context (stored in workflow_memory table)
      const { data: contextData, error } = await supabase
        .from('workflow_memory')
        .select('*')
        .eq('workflow_id', workflowId);
      
      if (error) {
        console.error(`[RESOLVE] Error fetching context:`, error);
        return text;
      }
      
      console.log(`[RESOLVE] Context data from DB:`, contextData);
      
      // Build context object from database rows
      const context = {};
      if (contextData) {
        contextData.forEach(row => {
          context[row.key] = row.value;
        });
      }
      console.log(`[RESOLVE] Built context object:`, JSON.stringify(context, null, 2));
      
      // Replace all {{variable}} patterns
      const result = text.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        // Remove any spaces and resolve the path
        let cleanPath = path.trim();
        console.log(`[RESOLVE] Resolving path: "${cleanPath}"`);
        
        // Handle state. prefix - remove it since context already represents state
        if (cleanPath.startsWith('state.')) {
          cleanPath = cleanPath.substring(6);
          console.log(`[RESOLVE] Stripped 'state.' prefix, new path: "${cleanPath}"`);
        }
        
        const resolved = this.getNestedValue(context, cleanPath);
        console.log(`[RESOLVE] Resolved value:`, resolved);
        return resolved !== undefined ? resolved : match;
      });
      
      console.log(`[RESOLVE] Final result: "${result}"`);
      return result;
    }
    
    console.log(`[RESOLVE] No template syntax found, returning original text`);
    return text;
  }
  
  /**
   * Get nested value from object using dot notation
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }
  
  /**
   * Resolve environment variable references in a string
   */
  resolveEnvVar(value) {
    if (typeof value !== 'string') return value;
    
    // Replace ${ENV_VAR} or {{ENV_VAR}} patterns with actual environment variable values
    // Support both formats for flexibility
    let result = value;
    
    // First handle ${ENV_VAR} format
    result = result.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
      const envValue = process.env[envVar];
      console.log(`[ENV] Resolving ${envVar} = ${envValue ? '[REDACTED]' : 'undefined'}`);
      return envValue !== undefined ? envValue : match;
    });
    
    // Then handle {{ENV_VAR}} format (commonly used in templates)
    result = result.replace(/\{\{([A-Z_]+)\}\}/g, (match, envVar) => {
      const envValue = process.env[envVar];
      console.log(`[ENV] Resolving {{${envVar}}} = ${envValue ? '[REDACTED]' : 'undefined'}`);
      return envValue !== undefined ? envValue : match;
    });
    
    return result;
  }
  
  /**
   * Recursively resolve environment variables in an object
   */
  resolveEnvVarsInObject(obj) {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const resolved = Array.isArray(obj) ? [] : {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        resolved[key] = this.resolveEnvVar(value);
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveEnvVarsInObject(value);
      } else {
        resolved[key] = value;
      }
    }
    
    return resolved;
  }

  /**
   * Convert JSON schema to Zod schema
   * Supports both simple and nested formats
   */
  convertJsonSchemaToZod(jsonSchema) {
    // Handle null/undefined
    if (!jsonSchema) return undefined;
    
    // If it's a string type descriptor, convert to Zod type
    if (typeof jsonSchema === 'string') {
      switch (jsonSchema) {
        case 'string': return z.string();
        case 'number': return z.number();
        case 'boolean': return z.boolean();
        case 'array': return z.array(z.any());
        default: return z.any();
      }
    }
    
    // Handle nested object with 'type' property
    if (jsonSchema.type) {
      switch (jsonSchema.type) {
        case 'string': return z.string();
        case 'number': return z.number();
        case 'boolean': return z.boolean();
        case 'array':
          // Handle array with items schema
          if (jsonSchema.items) {
            const itemSchema = this.convertJsonSchemaToZod(jsonSchema.items);
            return z.array(itemSchema || z.any());
          }
          return z.array(z.any());
        case 'object':
          // Handle object with properties
          if (jsonSchema.properties) {
            const shape = {};
            for (const [key, propSchema] of Object.entries(jsonSchema.properties)) {
              shape[key] = this.convertJsonSchemaToZod(propSchema) || z.any();
            }
            return z.object(shape);
          }
          return z.object({});
        default:
          return z.any();
      }
    }
    
    // Handle simple flat format ({"field": "type"})
    if (typeof jsonSchema === 'object') {
      const shape = {};
      let isSimpleFormat = true;
      
      // Check if all values are type strings or nested schemas
      for (const [key, value] of Object.entries(jsonSchema)) {
        if (typeof value === 'string') {
          // Simple type string
          shape[key] = this.convertJsonSchemaToZod(value);
        } else if (typeof value === 'object') {
          // Could be nested schema
          const converted = this.convertJsonSchemaToZod(value);
          if (converted) {
            shape[key] = converted;
          } else {
            isSimpleFormat = false;
            break;
          }
        } else {
          isSimpleFormat = false;
          break;
        }
      }
      
      if (isSimpleFormat && Object.keys(shape).length > 0) {
        return z.object(shape);
      }
    }
    
    // Return undefined if no valid schema format
    return undefined;
  }

  async cleanup() {
    if (this.stagehandInstance) {
      await this.stagehandInstance.close();
      this.stagehandInstance = null;
      // Clear tab tracking
      this.stagehandPages = {};
      this.mainPage = null;
      this.activeTabName = 'main';
    }
  }

  // Browser session management methods
  async saveBrowserSession(name, description = null) {
    if (!this.stagehandInstance) {
      throw new Error('No browser instance to save');
    }

    try {
      // Get cookies from the browser context
      const cookies = await this.stagehandInstance.page.context().cookies();
      
      // Get localStorage and sessionStorage from the main page
      const storageData = await this.stagehandInstance.page.evaluate(() => {
        const local = {};
        const session = {};
        
        // Extract localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          local[key] = localStorage.getItem(key);
        }
        
        // Extract sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          session[key] = sessionStorage.getItem(key);
        }
        
        return { localStorage: local, sessionStorage: session };
      });

      // Upsert to database
      const { data, error } = await supabase
        .from('browser_sessions')
        .upsert({
          name,
          description,
          cookies,
          local_storage: storageData.localStorage,
          session_storage: storageData.sessionStorage,
          last_used_at: new Date()
        }, { onConflict: 'name' })
        .select()
        .single();

      if (error) {
        console.error('[BROWSER_SESSION] Error saving session:', error);
        throw error;
      }

      console.log(`[BROWSER_SESSION] Saved session "${name}" with ${cookies.length} cookies`);
      return data;
    } catch (error) {
      console.error('[BROWSER_SESSION] Failed to save browser session:', error);
      throw error;
    }
  }

  async loadBrowserSession(name) {
    try {
      // Get session from database
      const { data: session, error } = await supabase
        .from('browser_sessions')
        .select('*')
        .eq('name', name)
        .single();

      if (error) {
        console.error('[BROWSER_SESSION] Error loading session:', error);
        throw error;
      }

      if (!session) {
        throw new Error(`Session "${name}" not found`);
      }

      // Clean up existing browser
      await this.cleanup();

      // Start new browser
      const stagehand = await this.getStagehand();

      // Add cookies to the browser context
      if (session.cookies && session.cookies.length > 0) {
        await stagehand.page.context().addCookies(session.cookies);
        console.log(`[BROWSER_SESSION] Loaded ${session.cookies.length} cookies`);
      }

      // Navigate to a page to set localStorage/sessionStorage
      // We need to be on a page to set storage
      if (session.cookies && session.cookies.length > 0) {
        // Navigate to the domain of the first cookie to set storage
        const firstCookie = session.cookies[0];
        const url = `${firstCookie.secure ? 'https' : 'http'}://${firstCookie.domain}`;
        await stagehand.page.goto(url, { waitUntil: 'domcontentloaded' });

        // Restore localStorage and sessionStorage
        await stagehand.page.evaluate((storageData) => {
          // Clear existing storage
          localStorage.clear();
          sessionStorage.clear();

          // Restore localStorage
          if (storageData.local_storage) {
            Object.entries(storageData.local_storage).forEach(([key, value]) => {
              localStorage.setItem(key, value);
            });
          }

          // Restore sessionStorage
          if (storageData.session_storage) {
            Object.entries(storageData.session_storage).forEach(([key, value]) => {
              sessionStorage.setItem(key, value);
            });
          }
        }, session);
      }

      // Update last used timestamp
      await supabase
        .from('browser_sessions')
        .update({ last_used_at: new Date() })
        .eq('id', session.id);

      console.log(`[BROWSER_SESSION] Loaded session "${name}"`);
      return session;
    } catch (error) {
      console.error('[BROWSER_SESSION] Failed to load browser session:', error);
      throw error;
    }
  }

  async listBrowserSessions() {
    try {
      const { data: sessions, error } = await supabase
        .from('browser_sessions')
        .select('id, name, description, created_at, updated_at, last_used_at')
        .order('last_used_at', { ascending: false });

      if (error) {
        console.error('[BROWSER_SESSION] Error listing sessions:', error);
        throw error;
      }

      return sessions || [];
    } catch (error) {
      console.error('[BROWSER_SESSION] Failed to list browser sessions:', error);
      throw error;
    }
  }

  async deleteBrowserSession(name) {
    try {
      const { error } = await supabase
        .from('browser_sessions')
        .delete()
        .eq('name', name);

      if (error) {
        console.error('[BROWSER_SESSION] Error deleting session:', error);
        throw error;
      }

      console.log(`[BROWSER_SESSION] Deleted session "${name}"`);
      return true;
    } catch (error) {
      console.error('[BROWSER_SESSION] Failed to delete browser session:', error);
      throw error;
    }
  }

  async restartBrowser() {
    console.log('[BROWSER_SESSION] Restarting browser with fresh state');
    await this.cleanup();
    // Next getStagehand() call will create a new instance
    return { success: true };
  }

  // Execute Stagehand Agent task
  async executeAgent(config) {
    const stagehand = await this.getStagehand();
    const page = stagehand.page;
    const { StagehandAgent } = await import('@browserbasehq/stagehand/lib/agent/StagehandAgent.js');
    const agent = new StagehandAgent(page);
    console.log(`[AGENT] ensure() with task:`, JSON.stringify(config, null, 2));
    const ok = await agent.ensure(config);
    return { ok };
  }

  // Helper to generate human-readable node description for visual observation
  getNodeDescription(node) {
    const { type, params } = node;
    
    switch (type) {
      case 'browser_action':
        if (params?.action === 'click') {
          return `Click on ${params.selector}`;
        } else if (params?.action === 'type') {
          return `Type text into ${params.selector}`;
        } else if (params?.action === 'navigate') {
          return `Navigate to ${params.url}`;
        } else if (params?.action === 'wait') {
          return `Wait for ${params.duration}ms`;
        } else if (params?.action === 'openNewTab') {
          return `Open new tab: ${params.name}`;
        } else if (params?.action === 'switchTab') {
          return `Switch to tab: ${params.tabName}`;
        }
        return `Browser action: ${params?.action}`;
        
      case 'browser_query':
        if (params?.method === 'extract') {
          return `Extract data: ${params?.instruction?.substring(0, 50)}...`;
        } else if (params?.method === 'observe') {
          return `Observe page: ${params?.instruction?.substring(0, 50)}...`;
        } else if (params?.method === 'validate') {
          return `Validate page state`;
        }
        return `Browser query: ${params?.method}`;
        
      case 'iterate':
        return `Iterate over ${params?.over || 'items'}`;
        
      case 'route':
        return `Conditional routing based on ${params?.value || 'conditions'}`;
        
      default:
        return `Execute ${type} node`;
    }
  }
}