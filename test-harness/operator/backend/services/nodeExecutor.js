import { Stagehand } from '@browserbasehq/stagehand';

import OpenAI from 'openai';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { dirname, join } from 'path';
import path from 'path';
import fs from 'fs/promises';
import BrowserStateService from './browserStateService.js';
import visualObservationService from './visualObservationService.js';
import { SchemaValidator } from './schemaValidator.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class NodeExecutor {
  constructor(sharedBrowserStateService = null) {
    // Generate unique instance ID for tracking
    this.instanceId = Math.random().toString(36).substring(7);
    console.log(`[NodeExecutor-${this.instanceId}] Creating new NodeExecutor instance`);
    
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
    // Use shared instance if provided, otherwise create new one
    this.browserStateService = sharedBrowserStateService || new BrowserStateService();
    console.log(`[NodeExecutor-${this.instanceId}] Using ${sharedBrowserStateService ? 'shared' : 'new'} BrowserStateService instance`);
    // Track current workflow ID for browser state updates
    this.currentWorkflowId = null;
    // Track current profile name and strategy for session management
    this.currentProfileName = null;
    this.persistStrategy = 'storageState';
  }

  /**
   * Resolve index value supporting numbers, negative indices, and keywords
   * @param {number|string} nth - The index value
   * @param {number} totalElements - Total number of elements
   * @returns {number} The resolved index
   */
  resolveIndex(nth, totalElements) {
    // Handle keywords
    if (nth === 'first') return 0;
    if (nth === 'last') return totalElements - 1;
    
    // Handle numeric indices
    const index = typeof nth === 'number' ? nth : parseInt(nth);
    
    if (isNaN(index)) {
      throw new Error(`Invalid index value: ${nth}. Expected number, "first", or "last".`);
    }
    
    // Handle negative indices (from end)
    if (index < 0) {
      return totalElements + index;
    }
    
    return index;
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

  // Get the correct browser profiles base path regardless of where the code is running from
  getBrowserProfilesBasePath() {
    // The browser profiles are stored in test-harness/operator/browser-profiles
    // We are at: /Users/a1984/runops-v2/Johny Ive 3/test-harness/operator/backend/services/
    // So we need to go up 2 levels to reach operator, then into browser-profiles
    const basePath = path.join(__dirname, '..', '..', 'browser-profiles');
    console.log(`[NodeExecutor] Browser profiles base path: ${basePath}`);
    console.log(`[NodeExecutor] Resolved to: ${path.resolve(basePath)}`);
    return basePath;
  }

  // Resolve template variables in a value
  async resolveTemplateVariables(value, workflowId) {
    if (typeof value !== 'string') {
      return value;
    }
    
    // Special case: if the entire value is a single template variable, return the actual resolved value
    const singleTemplatePattern = /^\{\{([^}]+)\}\}$/;
    const singleMatch = value.match(singleTemplatePattern);
    if (singleMatch) {
      const expression = singleMatch[1].trim();
      try {
        const resolvedValue = await this.getStateValue(expression, workflowId);
        // Special handling: if resolved to undefined, return the original template
        // This prevents conditions from being lost when variables don't exist
        if (resolvedValue === undefined) {
          console.warn(`Template '${value}' resolved to undefined, keeping original`);
          return value;
        }
        return resolvedValue; // Return the actual value, not stringified
      } catch (error) {
        console.error(`Template resolution error: ${error.message}`);
        return value; // Return original on error
      }
    }
    
    // Pattern to match {{variable}} or {{node.property}}
    const templatePattern = /\{\{([^}]+)\}\}/g;
    
    let resolved = value;
    let match;
    let replacementCount = 0;
    
    while ((match = templatePattern.exec(value)) !== null) {
      const expression = match[1].trim();
      let replacementValue = '';
      replacementCount++;
      
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
        
        // Convert to string if needed, with proper quoting for expressions
        if (typeof replacementValue === 'object') {
          replacementValue = JSON.stringify(replacementValue);
        } else if (replacementValue === undefined || replacementValue === null) {
          console.warn(`[TEMPLATE] Could not resolve variable: ${expression}`);
          replacementValue = match[0]; // Keep original
        } else if (typeof replacementValue === 'string') {
          // Check if this is being used in an expression context (contains operators)
          const expressionOperators = ['equals', 'contains', 'matches', '===', '!==', '==', '!=', '>', '<', '>=', '<='];
          const isInExpression = expressionOperators.some(op => value.includes(op));
          
          if (isInExpression) {
            // Escape any quotes in the string and wrap in single quotes
            replacementValue = "'" + String(replacementValue).replace(/'/g, "\\'") + "'";
          } else {
            replacementValue = String(replacementValue);
          }
        } else {
          replacementValue = String(replacementValue);
        }
        
        resolved = resolved.replace(match[0], replacementValue);
      } catch (error) {
        console.error(`Template variable error: ${error.message}`);
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
    
    // Handle array params (like route node configs)
    if (Array.isArray(params)) {
      return Promise.all(
        params.map(async item => {
          if (item === null || item === undefined) {
            return item;
          } else if (typeof item === 'string') {
            return this.resolveTemplateVariables(item, workflowId);
          } else if (typeof item === 'object') {
            return this.resolveNodeParams(item, workflowId);
          } else {
            return item;
          }
        })
      );
    }
    
    // Handle object params (most node types)
    const resolved = {};
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = await this.resolveTemplateVariables(value, workflowId);
      } else if (Array.isArray(value)) {
        resolved[key] = await Promise.all(
          value.map(async item => {
            // Skip null/undefined items in arrays
            if (item === null || item === undefined) {
              return item;
            } else if (typeof item === 'string') {
              return this.resolveTemplateVariables(item, workflowId);
            } else if (typeof item === 'object') {
              // Recursively resolve objects within arrays
              return this.resolveNodeParams(item, workflowId);
            } else {
              return item;
            }
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

  async getStagehand(options = {}) {
    const { profileName, persistStrategy } = options;
    
    console.log(`[GETSSTAGEHAND-${this.instanceId}] Called with options:`, {
      profileName,
      persistStrategy,
      currentProfileName: this.currentProfileName,
      hasExistingInstance: !!this.stagehandInstance
    });
    
    // Clean up existing instance if switching profiles
    // Only cleanup if we're explicitly requesting a different profile (not when profileName is undefined)
    if (this.stagehandInstance && profileName !== undefined && profileName !== this.currentProfileName) {
      console.log(`[GETSSTAGEHAND-${this.instanceId}] Cleanup triggered - profile switch detected:`, {
        requestedProfile: profileName,
        currentProfile: this.currentProfileName
      });
      await this.cleanup();
    }
    
    if (!this.stagehandInstance) {
      console.log(`[GETSSTAGEHAND-${this.instanceId}] Creating new Stagehand instance`);
      const stagehandConfig = {
        env: 'LOCAL',
        headless: false,
        enableCaching: true,
        modelName: 'o4-mini', // Using o4-mini for browser actions (act, extract, observe)
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
      };
      
      // Add profile directory support
      if (profileName && persistStrategy === 'profileDir') {
        const profilePath = path.join(
          this.getBrowserProfilesBasePath(),
          profileName
        );
        
        console.log(`[NodeExecutor] Full profile path: ${profilePath}`);
        
        stagehandConfig.localBrowserLaunchOptions = {
          userDataDir: profilePath,
          preserveUserDataDir: true,
          args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
            "--allow-file-access-from-files",
            "--allow-file-access",
            "--allow-cross-origin-auth-prompt"
          ]
        };
        
        this.currentProfileName = profileName;
        this.persistStrategy = 'profileDir';
        console.log(`[NodeExecutor] Using profile directory: ${profilePath}`);
      }
      
      this.stagehandInstance = new Stagehand(stagehandConfig);
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
        case 'browser_ai_action':
          console.log(`[EXECUTE] Executing browser AI action...`);
          result = await this.executeBrowserAIAction(resolvedParams, workflowId);
          break;
        case 'browser_query':
          result = await this.executeBrowserQuery(resolvedParams);
          break;
        case 'browser_ai_query':
          result = await this.executeBrowserAIQuery(resolvedParams);
          break;
        case 'browser_ai_extract':
          result = await this.executeBrowserAIExtract(resolvedParams);
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
          result = await this.executeIterate(resolvedParams, workflowId, node.position, { ...options, previewOnly: false });
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
      // Store the unwrapped result in the nodes table to avoid confusion
      // Handle two cases of wrapped primitives:
      // 1. Visual observations: {value: primitive, _page_observation: "..."}
      // 2. Cognition results: {result: primitive} when schema is {type: "boolean/string/number"}
      let nodeResult = result;
      
      // Check for visual observation wrapper
      if (result && typeof result === 'object' && '_page_observation' in result && 'value' in result) {
        // This is a wrapped primitive from visual observations
        nodeResult = result.value;
        console.log(`[EXECUTE] Storing unwrapped visual observation result in nodes table: ${JSON.stringify(nodeResult)}`);
      }
      // Check for cognition result wrapper when expecting a primitive
      else if (result && typeof result === 'object' && 'result' in result && Object.keys(result).length === 1) {
        // This looks like a wrapped primitive from cognition (e.g., {result: true})
        // Only unwrap if the schema suggests it should be a primitive
        const primitiveTypes = ['boolean', 'string', 'number'];
        if (node.type === 'cognition' && node.params?.schema?.type && primitiveTypes.includes(node.params.schema.type)) {
          nodeResult = result.result;
          console.log(`[EXECUTE] Storing unwrapped cognition result in nodes table for ${node.params.schema.type}: ${JSON.stringify(nodeResult)}`);
        }
      }
      
      const { data: updatedNode, error: updateError } = await supabase
        .from('nodes')
        .update({
          status: 'success',
          result: nodeResult,
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
      
      // Store result as variable ONLY if explicitly requested
      if (result !== null && result !== undefined && node.store_variable) {
        try {
          // Use alias as the storage key (with iteration context if applicable)
          const storageKey = this.getStorageKey(node.alias);
          
          // Extract the actual value for storage (remove wrappers for primitives)
          // Handle two cases of wrapped primitives:
          // 1. Visual observations: {value: primitive, _page_observation: "..."}
          // 2. Cognition results: {result: primitive} when schema is {type: "boolean/string/number"}
          let storageValue = result;
          
          // Check for visual observation wrapper
          if (result && typeof result === 'object' && '_page_observation' in result && 'value' in result) {
            // This is a wrapped primitive from visual observations
            storageValue = result.value;
            console.log(`[EXECUTE] Unwrapping visual observation wrapper: ${JSON.stringify(storageValue)}`);
          }
          // Check for cognition result wrapper when expecting a primitive
          else if (result && typeof result === 'object' && 'result' in result && Object.keys(result).length === 1) {
            // This looks like a wrapped primitive from cognition (e.g., {result: true})
            // Only unwrap if the schema suggests it should be a primitive
            const primitiveTypes = ['boolean', 'string', 'number'];
            if (node.type === 'cognition' && node.params?.schema?.type && primitiveTypes.includes(node.params.schema.type)) {
              storageValue = result.result;
              console.log(`[EXECUTE] Unwrapping cognition result wrapper for ${node.params.schema.type}: ${JSON.stringify(storageValue)}`);
            }
          }
          
          const { data: memData, error: memError } = await supabase
            .from('workflow_memory')
            .upsert({
              workflow_id: workflowId,
              key: storageKey,
              value: storageValue
            }, { onConflict: 'workflow_id,key' })
            .select()
            .single();
          
          if (memError) {
            console.error(`Failed to store variable: ${memError.message}`);
            throw memError;
          }
          
          // Still send real-time update for UI
          this.sendNodeValueUpdate(nodeId, node.position, result, node.alias);
          
          // Emit SSE event for variable storage
          console.log(`[EXECUTE] Checking browserStateService availability for SSE emit...`);
          if (this.browserStateService) {
            console.log(`[EXECUTE] BrowserStateService is available, emitting variable update via SSE`);
            console.log(`[EXECUTE] Current workflow ID: ${workflowId}`);
            console.log(`[EXECUTE] Storage key: ${storageKey}`);
            console.log(`[EXECUTE] Node alias: ${node.alias}`);
            await this.browserStateService.emitVariableUpdate(workflowId, storageKey, storageValue, node.alias);
          } else {
            console.log(`[EXECUTE] WARNING: BrowserStateService is not available!`);
          }
        } catch (memError) {
          console.error(`[EXECUTE] Failed to store variable for ${node.alias}:`, memError);
          console.error(`[EXECUTE] Full error details:`, JSON.stringify(memError, null, 2));
          // Don't fail the execution if memory storage fails
        }
      }
      // If store_variable is false, result is NOT stored - only available in node.result column
      
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
        // Support deterministic CSS selector clicks (for browser_action tool)
        if (!config.selector) {
          throw new Error('click action requires selector parameter');
        }
        
        // Check for pseudo-selectors that won't work with native querySelector
        const clickPseudos = [':has-text(', ':text(', ':visible', ':hidden', ':contains('];
        const foundClickPseudo = clickPseudos.find(pseudo => config.selector.includes(pseudo));
        if (foundClickPseudo) {
          throw new Error(
            `Playwright/jQuery pseudo-selectors like "${foundClickPseudo}" are not supported. ` +
            `Use standard CSS selectors that work with document.querySelector(). ` +
            `For text-based selection, use dom_search first to find the element.`
          );
        }
        
        const clickPage = await getActiveStagehandPage();
        
        // If nth is specified, handle element selection by index
        if (config.nth !== undefined) {
          const elements = await clickPage.$$(config.selector);
          const index = this.resolveIndex(config.nth, elements.length);
          
          if (!elements[index]) {
            throw new Error(
              `No element at index ${config.nth} for selector: ${config.selector}. Found ${elements.length} elements.`
            );
          }
          
          await elements[index].click();
          return { clicked: config.selector, nth: index };
        }
        
        await clickPage.waitForSelector(config.selector, { 
          timeout: config.timeout || 10000,
          state: 'visible'
        });
        await clickPage.click(config.selector);
        return { clicked: config.selector };
        
      case 'type':
        // Support deterministic typing (for browser_action tool)
        if (!config.selector || config.text === undefined) {
          throw new Error('type action requires selector and text parameters');
        }
        
        // Check for pseudo-selectors that won't work with native querySelector
        const typePseudos = [':has-text(', ':text(', ':visible', ':hidden', ':contains('];
        const foundTypePseudo = typePseudos.find(pseudo => config.selector.includes(pseudo));
        if (foundTypePseudo) {
          throw new Error(
            `Playwright/jQuery pseudo-selectors like "${foundTypePseudo}" are not supported. ` +
            `Use standard CSS selectors that work with document.querySelector(). ` +
            `For text-based selection, use dom_search first to find the element.`
          );
        }
        
        const typePage = await getActiveStagehandPage();
        
        // If nth is specified, handle element selection by index
        if (config.nth !== undefined) {
          const elements = await typePage.$$(config.selector);
          const index = this.resolveIndex(config.nth, elements.length);
          
          if (!elements[index]) {
            throw new Error(
              `No element at index ${config.nth} for selector: ${config.selector}. Found ${elements.length} elements.`
            );
          }
          
          // Clear existing value and type new text
          await elements[index].fill(config.text);
          return { typed: config.text, selector: config.selector, nth: index };
        }
        
        await typePage.waitForSelector(config.selector, { 
          timeout: config.timeout || 10000,
          state: 'visible' 
        });
        // Clear existing text and type new
        await typePage.click(config.selector, { clickCount: 3 });
        await typePage.type(config.selector, config.text);
        return { typed: config.text, selector: config.selector };
        
      case 'wait':
        const waitPage = await getActiveStagehandPage();
        
        // Support both new format (waitType/waitValue) and legacy format (duration)
        if (config.waitType && config.waitValue !== undefined) {
          switch (config.waitType) {
            case 'time':
              const ms = parseInt(config.waitValue);
              await waitPage.waitForTimeout(ms);
              return { waited: `${ms}ms` };
              
            case 'selector':
              await waitPage.waitForSelector(config.waitValue, { timeout: 30000 });
              return { waited: `for selector "${config.waitValue}"` };
              
            case 'navigation':
              await waitPage.waitForNavigation({ 
                waitUntil: config.waitValue || 'domcontentloaded' 
              });
              return { waited: 'for navigation' };
              
            default:
              throw new Error(`Unknown wait type: ${config.waitType}`);
          }
        } else {
          // Legacy duration-based wait for backward compatibility
          await waitPage.waitForTimeout(config.duration || 1000);
          return { waited: config.duration || 1000 };
        }
        
      case 'openNewTab':
        // Validate that name is provided - required for tab tracking
        if (!config.name) {
          throw new Error('openNewTab requires a "name" parameter. Example: {action: "openNewTab", url: "https://example.com", name: "example"}. This name is used to reference the tab in switchTab actions and browser state tracking.');
        }
        
        // Get StageHand instance to access its context
        const stagehandForNewTab = await this.getStagehand();
        
        // Create new page through StageHand's context
        // This returns a Page object with act/extract/observe methods
        const newPage = await stagehandForNewTab.context.newPage();
        
        if (config.url) {
          await newPage.goto(config.url);
        }
        
        // Store the Page reference with the provided name
        if (!this.stagehandPages) {
          this.stagehandPages = {};
        }
        
        // Check if tab name already exists and auto-suffix if needed
        let finalTabName = config.name;
        if (this.stagehandPages[finalTabName]) {
          // Tab with this name already exists, find a unique suffix
          let suffix = 2;
          while (this.stagehandPages[`${config.name}_${suffix}`]) {
            suffix++;
          }
          finalTabName = `${config.name}_${suffix}`;
          console.log(`[OPEN NEW TAB] Tab name "${config.name}" already exists, using "${finalTabName}" instead`);
        }
        
        this.stagehandPages[finalTabName] = newPage;
        // Mark this tab as active
        this.activeTabName = finalTabName;
        
        // Make the new tab visually active
        // newPage is already a Page object with bringToFront method
        await newPage.bringToFront();
        
        console.log(`[OPEN NEW TAB] Created new tab: ${finalTabName}`);
        console.log(`[OPEN NEW TAB] StageHand automatically wrapped it with act/extract/observe capabilities`);
        console.log(`[OPEN NEW TAB] Tab is now active for subsequent operations`);
        
        // Update browser state for Director 2.0
        await this.updateBrowserStateInDB();
        
        return { openedTab: finalTabName, url: config.url, active: true, originalName: config.name };
        
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
        // Enhanced keyboard press with modifier support and focus management
        const { key, modifiers = [] } = config;
        const keyCombo = modifiers.length > 0 ? `${modifiers.join('+')}+${key}` : key;
        console.log(`[KEYPRESS] Pressing key combination: ${keyCombo}`);
        
        const keypressPage = await getActiveStagehandPage();
        
        // Ensure page has focus for reliable key event handling
        await keypressPage.bringToFront();
        
        // Try to focus body as fallback if no element is focused
        const currentFocus = await keypressPage.evaluate(() => document.activeElement?.tagName);
        if (!currentFocus || currentFocus === 'HTML') {
          try {
            await keypressPage.focus('body');
          } catch (focusError) {
            // Fallback: click body to ensure focus
            await keypressPage.click('body');
          }
        }
        
        // Multi-tier approach for maximum headless compatibility
        console.log(`[KEYPRESS] Attempting keypress: ${keyCombo}`);
        
        try {
          // Method 1: Locator-based approach (recommended by Playwright)
          const bodyLocator = keypressPage.locator('body');
          await bodyLocator.press(keyCombo);
          console.log('[KEYPRESS] Locator press succeeded');
        } catch (locatorError) {
          console.log('[KEYPRESS] Locator press failed, trying page keyboard:', locatorError.message);
          
          try {
            // Method 2: Page-level keyboard press
            await keypressPage.keyboard.press(keyCombo);
            console.log('[KEYPRESS] Page keyboard press succeeded');
          } catch (keyboardError) {
            console.log('[KEYPRESS] Page keyboard failed, using direct event dispatch:', keyboardError.message);
            
            // Method 3: CDP Raw Input (generates trusted events)
            try {
              console.log('[KEYPRESS] Using CDP Raw Input for trusted events');
              const client = await keypressPage.context().newCDPSession(keypressPage);
              
              // Parse the key combination
              const parts = keyCombo.split('+');
              const key = parts[parts.length - 1];
              const modifiers = parts.slice(0, -1);
              
              // Build modifier flags for CDP
              const modifierFlags = [];
              if (modifiers.includes('Alt')) modifierFlags.push('Alt');
              if (modifiers.includes('Control') || modifiers.includes('ControlOrMeta')) modifierFlags.push('Ctrl');
              if (modifiers.includes('Meta') || modifiers.includes('ControlOrMeta')) modifierFlags.push('Meta');
              if (modifiers.includes('Shift')) modifierFlags.push('Shift');
              
              // Map key to CDP key code
              const getKeyCode = (key) => {
                if (key.length === 1) {
                  return key.toUpperCase().charCodeAt(0);
                }
                const keyMap = {
                  'Enter': 13, 'Escape': 27, 'Tab': 9, 'Space': 32,
                  'ArrowUp': 38, 'ArrowDown': 40, 'ArrowLeft': 37, 'ArrowRight': 39,
                  'F1': 112, 'F2': 113, 'F3': 114, 'F4': 115, 'F5': 116,
                  'F6': 117, 'F7': 118, 'F8': 119, 'F9': 120, 'F10': 121,
                  'F11': 122, 'F12': 123
                };
                return keyMap[key] || key.charCodeAt(0);
              };
              
              const keyCode = getKeyCode(key);
              const keyText = key.length === 1 ? key : '';
              
              const modifierBits = modifierFlags.reduce((acc, mod) => {
                const modMap = { Alt: 1, Ctrl: 2, Meta: 4, Shift: 8 };
                return acc | (modMap[mod] || 0);
              }, 0);
              
              const code = key.length === 1 ? `Key${key.toUpperCase()}` : key;
              
              // 1️⃣ rawKeyDown → becomes DOM keydown (CRITICAL FIX)
              await client.send('Input.dispatchKeyEvent', {
                type: 'rawKeyDown',  // Changed from 'keyDown' to 'rawKeyDown'
                key: key,
                code: code,
                keyCode: keyCode,
                windowsVirtualKeyCode: keyCode,
                modifiers: modifierBits
              });
              
              // 2️⃣ char → becomes DOM keypress (for printable characters)
              if (key.length === 1) {
                await client.send('Input.dispatchKeyEvent', {
                  type: 'char',
                  key: key,
                  code: code,
                  text: keyText,
                  unmodifiedText: keyText,  // Added unmodifiedText field
                  keyCode: keyCode,
                  windowsVirtualKeyCode: keyCode,
                  modifiers: modifierBits
                });
              }
              
              // 3️⃣ keyUp → becomes DOM keyup
              await client.send('Input.dispatchKeyEvent', {
                type: 'keyUp',
                key: key,
                code: code,
                keyCode: keyCode,
                windowsVirtualKeyCode: keyCode,
                modifiers: modifierBits
              });
              
              await client.detach();
              console.log('[KEYPRESS] CDP Raw Input completed successfully');
              
            } catch (cdpError) {
              console.log('[KEYPRESS] CDP failed, falling back to direct dispatch:', cdpError.message);
              
              // Method 4: Enhanced JavaScript event dispatch (with full sequence)
              await keypressPage.evaluate((keyCombo) => {
                // Parse the key combination
                const parts = keyCombo.split('+');
                const key = parts[parts.length - 1];
                const modifiers = parts.slice(0, -1);
                
                const eventOptions = {
                  key: key,
                  code: key.length === 1 ? `Key${key.toUpperCase()}` : key,
                  keyCode: key.length === 1 ? key.toUpperCase().charCodeAt(0) : 
                          key === 'Enter' ? 13 : key === 'Escape' ? 27 : 0,
                  ctrlKey: modifiers.includes('Control') || modifiers.includes('ControlOrMeta'),
                  altKey: modifiers.includes('Alt'),
                  shiftKey: modifiers.includes('Shift'),
                  metaKey: modifiers.includes('Meta') || modifiers.includes('ControlOrMeta'),
                  bubbles: true,
                  cancelable: true
                };
                
                const target = document.activeElement || document.body;
                
                // Dispatch full three-phase sequence
                target.dispatchEvent(new KeyboardEvent('keydown', eventOptions));
                
                // Add keypress for character keys (deprecated but some sites still use)
                if (key.length === 1) {
                  target.dispatchEvent(new KeyboardEvent('keypress', eventOptions));
                }
                
                target.dispatchEvent(new KeyboardEvent('keyup', eventOptions));
                
                console.log('Enhanced keyboard events dispatched to:', target.tagName, eventOptions);
              }, keyCombo);
              console.log('[KEYPRESS] Enhanced event dispatch completed');
            }
          }
        }
        
        // Capture debugging information
        const debugInfo = await keypressPage.evaluate(() => ({
          activeElement: {
            tag: document.activeElement?.tagName || 'none',
            id: document.activeElement?.id || '',
            className: document.activeElement?.className || ''
          },
          hasFocus: document.hasFocus(),
          url: window.location.href
        }));
        
        console.log(`[KEYPRESS] Key combination pressed: ${keyCombo}`, debugInfo);
        return { 
          pressed: keyCombo, 
          key, 
          modifiers: modifiers || [],
          focus: debugInfo
        };
        
      case 'act':
        throw new Error('act action has been moved to browser_ai_action node type. Use browser_ai_action with action:"act" instead.');
        
      case 'loadSession':
        const loadSessionName = config.sessionName;
        const loadPersistStrategy = config.persistStrategy || 'storageState';
        if (!loadSessionName) {
          throw new Error('loadSession requires sessionName parameter');
        }
        try {
          const loadResult = await this.loadBrowserSession(loadSessionName, loadPersistStrategy);
          return { 
            loaded: true, 
            sessionName: loadSessionName,
            ...loadResult
          };
        } catch (error) {
          return { 
            loaded: false, 
            sessionName: loadSessionName,
            error: error.message 
          };
        }
        
      case 'saveSession':
        throw new Error('saveSession is only available through the Director browser_action tool, not as a workflow node. Use the Director to save sessions before building workflows.');
        
      case 'listSessions':
        throw new Error('listSessions is only available through the Director browser_action tool, not as a workflow node. Use the Director to list available sessions.');
        
      case 'loadProfile':
        // Load profile - checks local first, then cloud
        const profileName = config.profileName;
        if (!profileName) {
          throw new Error('loadProfile requires profileName parameter');
        }
        
        console.log(`[BROWSER ACTION] Loading profile "${profileName}"...`);
        
        // Check if profile exists locally
        const localProfiles = await this.listBrowserProfiles();
        const existsLocally = localProfiles.includes(profileName);
        
        if (existsLocally) {
          console.log(`[BROWSER ACTION] Profile "${profileName}" found locally, switching to it`);
          
          // Profile exists locally, restart browser with it
          await this.cleanup();
          await this.getStagehand({
            profileName,
            persistStrategy: 'profileDir'
          });
          
          return {
            profile: profileName,
            source: 'local',
            message: `Loaded profile "${profileName}" from local storage`
          };
        } else {
          console.log(`[BROWSER ACTION] Profile "${profileName}" not found locally, attempting cloud restore`);
          
          try {
            // Try to restore from cloud
            const result = await this.restoreBrowserProfile(profileName);
            
            // Restart browser with restored profile
            await this.cleanup();
            await this.getStagehand({
              profileName,
              persistStrategy: 'profileDir'
            });
            
            return {
              profile: profileName,
              source: 'cloud',
              message: `Restored profile "${profileName}" from cloud snapshot`,
              snapshotFile: result.snapshotFile
            };
          } catch (error) {
            // Profile doesn't exist locally or in cloud
            throw new Error(`Profile "${profileName}" not found locally or in cloud. Create it first with setProfile.`);
          }
        }
        
      case 'scrollIntoView':
        // Import BrowserActionService to delegate scroll actions
        const { BrowserActionService } = await import('./browserActionService.js');
        const browserActionServiceForScroll = new BrowserActionService(this, workflowId, this.browserStateService);
        return await browserActionServiceForScroll.scrollIntoView(config);
        
      case 'scrollToRow':
        // Import BrowserActionService to delegate scroll actions
        const { BrowserActionService: BAS } = await import('./browserActionService.js');
        const browserActionServiceForRow = new BAS(this, workflowId, this.browserStateService);
        return await browserActionServiceForRow.scrollToRow(config);
        
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
      throw new Error('extract method has been moved to browser_ai_query node type. Use browser_ai_query with method:"extract" instead.');
    } else if (config.method === 'observe') {
      throw new Error('observe method has been moved to browser_ai_query node type. Use browser_ai_query with method:"observe" instead.');
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
              // Handle shadow DOM if useShadowDOM is enabled
              let elementSelector = rule.selector;
              if (rule.useShadowDOM && !rule.selector.includes('>>')) {
                // Convert selector to pierce shadow DOM
                elementSelector = rule.selector.split(' ').join(' >> ');
              }
              const elementExists = await activePage.$(elementSelector);
              ruleResult.passed = !!elementExists;
              if (!ruleResult.passed) {
                ruleResult.error = `Element not found: ${rule.selector}${rule.useShadowDOM ? ' (with shadow DOM piercing)' : ''}`;
              }
              break;
              
            case 'element_absent':
              // Check if element does NOT exist
              // Handle shadow DOM if useShadowDOM is enabled
              let absentSelector = rule.selector;
              if (rule.useShadowDOM && !rule.selector.includes('>>')) {
                // Convert selector to pierce shadow DOM
                absentSelector = rule.selector.split(' ').join(' >> ');
              }
              const elementAbsent = await activePage.$(absentSelector);
              ruleResult.passed = !elementAbsent;
              if (!ruleResult.passed) {
                ruleResult.error = `Element should not exist but found: ${rule.selector}${rule.useShadowDOM ? ' (with shadow DOM piercing)' : ''}`;
              }
              break;
              
            case 'ai_assessment':
              throw new Error('ai_assessment rule has been moved to browser_ai_query node type. Use browser_ai_query with method:"assess" instead.');
              
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
    } else if (config.method === 'count') {
      // Count elements matching selector with enhanced visibility stats
      const activePage = await getActiveStagehandPage();
      console.log(`[BROWSER_QUERY] Counting elements with selector: ${config.selector}`);
      
      try {
        // Get all elements and their visibility stats
        const elements = await activePage.$$(config.selector);
        const count = elements.length;
        
        // Check visibility for each element
        let visibleCount = 0;
        let zeroHeightCount = 0;
        let hiddenCount = 0;
        
        for (const element of elements) {
          const boundingBox = await element.boundingBox();
          const isVisible = await element.isVisible();
          
          if (boundingBox && boundingBox.height > 0 && boundingBox.width > 0) {
            visibleCount++;
          } else if (boundingBox && boundingBox.height === 0) {
            zeroHeightCount++;
          } else if (!isVisible) {
            hiddenCount++;
          }
        }
        
        const result = {
          count,
          visibleCount,
          hiddenCount,
          zeroHeightCount
        };
        
        // Add warning if there's a mismatch
        if (visibleCount < count) {
          result.warning = `Found ${count} elements but only ${visibleCount} are visible. ${zeroHeightCount} have zero height (likely virtual scrolling).`;
        }
        
        console.log(`[BROWSER_QUERY] Count results:`, result);
        return result;
      } catch (error) {
        console.error('[BROWSER_QUERY] Count error:', error);
        throw new Error(`Failed to count elements: ${error.message}`);
      }
    } else if (config.method === 'debug_element') {
      // Debug element actionability
      const activePage = await getActiveStagehandPage();
      console.log(`[BROWSER_QUERY] Debugging element: ${config.selector}`);
      
      try {
        const elements = await activePage.$$(config.selector);
        
        if (elements.length === 0) {
          return {
            found: false,
            error: `No elements found matching selector: ${config.selector}`,
            suggestions: [
              'Check if selector is correct',
              'Element may not be loaded yet - try wait action first',
              'Element may be in a different frame or shadow DOM'
            ]
          };
        }
        
        // Get detailed info about first element (or nth if specified)
        const index = config.nth || 0;
        const element = elements[index] || elements[0];
        
        const boundingBox = await element.boundingBox();
        const isVisible = await element.isVisible();
        const isEnabled = await element.isEnabled();
        
        // Get computed styles and parent info
        const elementInfo = await activePage.evaluate((sel, idx) => {
          const elements = document.querySelectorAll(sel);
          const el = elements[idx] || elements[0];
          
          if (!el) return null;
          
          const rect = el.getBoundingClientRect();
          const styles = getComputedStyle(el);
          
          // Find scrollable parent
          let scrollParent = null;
          let parent = el.parentElement;
          while (parent) {
            const pStyle = getComputedStyle(parent);
            if (pStyle.overflow === 'auto' || pStyle.overflow === 'scroll') {
              scrollParent = {
                selector: parent.className ? `.${parent.className.split(' ')[0]}` : 
                         parent.id ? `#${parent.id}` : parent.tagName.toLowerCase(),
                overflow: pStyle.overflow
              };
              break;
            }
            parent = parent.parentElement;
          }
          
          return {
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            display: styles.display,
            visibility: styles.visibility,
            opacity: styles.opacity,
            position: styles.position,
            zIndex: styles.zIndex,
            rect: {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height
            },
            scrollParent
          };
        }, config.selector, index);
        
        const result = {
          found: true,
          selector: config.selector,
          totalElements: elements.length,
          elementIndex: index,
          element: elementInfo,
          actionability: {
            clickable: false,
            reasons: [],
            suggestions: []
          },
          dimensions: boundingBox || { x: 0, y: 0, width: 0, height: 0 },
          visible: isVisible,
          enabled: isEnabled
        };
        
        // Determine clickability and reasons
        if (!boundingBox || boundingBox.height === 0) {
          result.actionability.reasons.push('Element has zero height');
          result.actionability.suggestions.push(
            elementInfo?.scrollParent ? 
              `Use scrollIntoView with scrollContainer: "${elementInfo.scrollParent.selector}"` :
              'Use scrollIntoView to make element visible'
          );
          
          if (elements.length > 20) {
            result.actionability.reasons.push('Many elements found - likely virtual scrolling');
            result.actionability.suggestions.push('This appears to be a virtualized list');
          }
        } else if (!isVisible) {
          result.actionability.reasons.push('Element is not visible');
          result.actionability.suggestions.push('Check CSS display/visibility properties');
        } else if (!isEnabled) {
          result.actionability.reasons.push('Element is disabled');
        } else {
          result.actionability.clickable = true;
        }
        
        // Add pattern-specific suggestions
        if (config.selector.includes('tr.zA') && elements.length > 30) {
          result.pattern = 'Gmail virtual scrolling detected';
          result.actionability.suggestions.push(
            'Gmail search results use virtual scrolling',
            'Use scrollContainer: "div.Cp" with scrollIntoView'
          );
        }
        
        return result;
        
      } catch (error) {
        console.error('[BROWSER_QUERY] Debug error:', error);
        return {
          found: false,
          error: error.message
        };
      }
    } else if (config.method === 'deterministic_extract') {
      // Deterministic data extraction using CSS selectors
      const activePage = await getActiveStagehandPage();
      console.log(`[BROWSER_QUERY] Extracting elements with selector: ${config.selector}`);
      
      try {
        // Use page.evaluate for deterministic extraction - wrap arguments in single object
        const extractedData = await activePage.evaluate((args) => {
          const { selector, fields, limit, useShadowDOM } = args;
          const items = [];
          
          // Helper function to query with shadow DOM support
          const queryElements = (sel) => {
            if (!useShadowDOM || !sel.includes('>>')) {
              return document.querySelectorAll(sel);
            }
            
            // Handle shadow DOM piercing with >> syntax
            const parts = sel.split('>>').map(p => p.trim());
            let elements = [document];
            
            for (const part of parts) {
              const newElements = [];
              for (const el of elements) {
                const root = el.shadowRoot || el;
                newElements.push(...root.querySelectorAll(part));
              }
              elements = newElements;
            }
            
            return elements;
          };
          
          const elements = queryElements(selector);
          const count = elements.length;
          const maxItems = limit || elements.length;
          
          for (let i = 0; i < Math.min(elements.length, maxItems); i++) {
            const element = elements[i];
            const item = {};
            
            if (fields) {
              // Extract specified fields
              for (const [fieldName, fieldSelector] of Object.entries(fields)) {
                try {
                  let value = '';
                  
                  if (fieldSelector.startsWith('@')) {
                    // Attribute extraction
                    const attrParts = fieldSelector.substring(1).split('~');
                    const attrName = attrParts[0];
                    const attrValue = element.getAttribute(attrName) || '';
                    
                    if (attrParts.length > 1) {
                      // Contains check (e.g., @class~active)
                      value = attrValue.includes(attrParts[1]);
                    } else {
                      value = attrValue;
                    }
                  } else if (fieldSelector === '.' || fieldSelector === '') {
                    // Current element's text
                    value = element.textContent?.trim() || '';
                  } else {
                    // Sub-element selector
                    const subElement = element.querySelector(fieldSelector);
                    value = subElement?.textContent?.trim() || '';
                  }
                  
                  item[fieldName] = value;
                } catch (fieldError) {
                  console.warn(`Failed to extract field ${fieldName}:`, fieldError);
                  item[fieldName] = '';
                }
              }
            } else {
              // No fields specified - extract text and index
              item.text = element.textContent?.trim() || '';
              item.index = i;
            }
            
            items.push(item);
          }
          
          return { items, count };
        }, { selector: config.selector, fields: config.fields || null, limit: config.limit || null, useShadowDOM: config.useShadowDOM || false });
        
        console.log(`[BROWSER_QUERY] Extracted ${extractedData.items.length} items (total found: ${extractedData.count})`);
        
        return extractedData;
      } catch (error) {
        console.error(`[BROWSER_QUERY] Extraction error:`, error);
        throw new Error(`Failed to extract elements: ${error.message}`);
      }
    } else {
      throw new Error(`Unknown browser_query method: ${config.method}`);
    }
  }

  async executeBrowserAIAction(config, workflowId) {
    console.log(`[BROWSER_AI_ACTION] Action: ${config.action}, Active tab: ${this.activeTabName}`);
    
    const stagehand = await this.getStagehand();
    const page = stagehand.page;
    
    // Helper to get the current active StagehandPage
    const getActiveStagehandPage = async () => {
      if (this.activeTabName === 'main') {
        return this.mainPage;
      }
      if (this.activeTabName && this.stagehandPages && this.stagehandPages[this.activeTabName]) {
        return this.stagehandPages[this.activeTabName];
      }
      return this.mainPage;
    };

    const activePage = await getActiveStagehandPage();

    switch (config.action) {
      case 'click':
        console.log(`[AI_CLICK] Using AI to: ${config.instruction}`);
        await activePage.act({ action: config.instruction });
        return { clicked: config.instruction };
        
      case 'type':
        // Resolve variables in the text
        let textToType = config.text;
        if (typeof textToType === 'string' && textToType.startsWith('state.')) {
          const path = textToType.substring(6);
          textToType = await this.getStateValue(path, workflowId);
        } else {
          textToType = await this.resolveVariable(textToType, workflowId);
        }
        
        if (!textToType || textToType === 'undefined') {
          throw new Error(`No text to type. Tried to access: "${config.text}" but got undefined`);
        }
        
        console.log(`[AI_TYPE] Using AI to: ${config.instruction} with text: "${textToType}"`);
        await activePage.act({ action: `${config.instruction} and type "${textToType}"` });
        return { typed: textToType };
        
      case 'act':
        console.log(`[AI_ACT] Executing: ${config.instruction}`);
        const result = await activePage.act({ action: config.instruction });
        return { acted: config.instruction, result };
        
      default:
        throw new Error(`Unknown browser_ai_action: ${config.action}`);
    }
  }

  async executeBrowserAIExtract(config) {
    console.log(`[BROWSER_AI_EXTRACT] Extracting text with instruction: ${config.instruction}`);
    
    const stagehand = await this.getStagehand();
    
    // Helper to get the active StagehandPage
    const getActiveStagehandPage = async () => {
      if (this.activeTabName === 'main') {
        return this.mainPage;
      }
      if (this.activeTabName && this.stagehandPages && this.stagehandPages[this.activeTabName]) {
        return this.stagehandPages[this.activeTabName];
      }
      return this.mainPage;
    };

    const activePage = await getActiveStagehandPage();

    // Schema is always required
    if (!config.schema || typeof config.schema !== 'object') {
      throw new Error('Schema is required for browser_ai_extract. Use {type: "string"} for simple text extraction, or define an object with properties for structured content.');
    }
    
    console.log(`[BROWSER_AI_EXTRACT] Schema provided:`, JSON.stringify(config.schema, null, 2));
    
    // Handle primitive schemas and arrays by wrapping them in an object
    // Stagehand only supports object schemas, so we auto-wrap non-objects
    let effectiveSchema = config.schema;
    let isPrimitiveOrArraySchema = false;
    
    // Check for primitive types or arrays
    const nonObjectTypes = ['string', 'number', 'boolean', 'array'];
    if (config.schema.type && nonObjectTypes.includes(config.schema.type)) {
      console.log(`[BROWSER_AI_EXTRACT] Detected ${config.schema.type} schema. Wrapping in object for Stagehand compatibility.`);
      isPrimitiveOrArraySchema = true;
      effectiveSchema = {
        type: 'object',
        properties: {
          value: config.schema
        },
        required: ['value']
      };
    }
    
    // Convert schema to Zod
    let zodSchema;
    try {
      zodSchema = this.convertJsonSchemaToZod(effectiveSchema);
      if (!zodSchema) {
        throw new Error('Failed to convert schema to Zod format');
      }
    } catch (error) {
      console.error(`[BROWSER_AI_EXTRACT] Schema conversion error:`, error);
      throw new Error(`Invalid schema format: ${error.message}`);
    }
    
    // Enhanced instruction emphasizing text extraction, not DOM navigation
    const enhancedInstruction = `${config.instruction}

IMPORTANT: Extract only the human-readable text content that is visible on the page. This is for content extraction, not for finding DOM elements or selectors. DO NOT hallucinate or generate example data. If no matching content is found, return null or empty strings.`;
    
    const extractOptions = {
      instruction: enhancedInstruction,
      schema: zodSchema
    };
    
    // If targetElement is specified, we could potentially scope the extraction
    // For now, Stagehand's extract works on the whole page
    if (config.targetElement) {
      console.log(`[BROWSER_AI_EXTRACT] Note: targetElement selector provided (${config.targetElement}) but Stagehand extract currently works on full page`);
    }
    
    console.log(`[BROWSER_AI_EXTRACT] Calling extract with Zod schema`);
    
    try {
      let extractResult = await activePage.extract(extractOptions);
      console.log(`[BROWSER_AI_EXTRACT] Extract result:`, JSON.stringify(extractResult, null, 2));
      
      // NEW: Validate and coerce if schema exists
      if (config.schema) {
        const validation = SchemaValidator.validateAndCoerce(
          extractResult,
          effectiveSchema, // Use effectiveSchema since we may have wrapped it
          {
            nodeType: 'BROWSER_AI_EXTRACT',
            nodeAlias: config.alias,
            position: this.currentNodePosition
          }
        );
        
        if (!validation.success) {
          throw new Error(validation.error);
        }
        
        // Log coercion if it happened
        if (validation.coerced) {
          console.log(`[BROWSER_AI_EXTRACT] Type coercion applied for ${config.alias || `node${this.currentNodePosition}`}`);
        }
        
        extractResult = validation.data;
      }
      
      // If we wrapped a primitive or array schema, unwrap the result
      if (isPrimitiveOrArraySchema && extractResult && typeof extractResult === 'object' && 'value' in extractResult) {
        console.log(`[BROWSER_AI_EXTRACT] Unwrapping result from object wrapper`);
        return extractResult.value;
      }
      
      return extractResult;
    } catch (error) {
      // Enhanced error message for schema validation failures
      if (error.message && error.message.includes('Schema validation failed')) {
        throw error; // Already formatted
      }
      console.error(`[BROWSER_AI_EXTRACT] Extract failed:`, error);
      console.error(`[BROWSER_AI_EXTRACT] Error stack:`, error.stack);
      throw new Error(`Failed to extract content: ${error.message}`);
    }
  }

  async executeBrowserAIQuery(config) {
    console.log(`[BROWSER_AI_QUERY] Instruction: ${config.instruction}`);
    
    const stagehand = await this.getStagehand();
    
    // Helper to get the active StagehandPage
    const getActiveStagehandPage = async () => {
      if (this.activeTabName === 'main') {
        return this.mainPage;
      }
      if (this.activeTabName && this.stagehandPages && this.stagehandPages[this.activeTabName]) {
        return this.stagehandPages[this.activeTabName];
      }
      return this.mainPage;
    };

    const activePage = await getActiveStagehandPage();

    // Schema is always required
    if (!config.schema || typeof config.schema !== 'object') {
      throw new Error('Schema is required for browser_ai_query. Examples: {"content": "string"} for text, {"isVisible": "boolean"} for checks, {"title": "string", "price": "number"} for structured data.');
    }
    
    console.log(`[BROWSER_AI_QUERY] Schema provided:`, JSON.stringify(config.schema, null, 2));
    
    // Handle primitive schemas and arrays by wrapping them in an object
    // Stagehand only supports object schemas, so we auto-wrap non-objects
    let effectiveSchema = config.schema;
    let isPrimitiveOrArraySchema = false;
    
    // Check for primitive types or arrays
    const nonObjectTypes = ['string', 'number', 'boolean', 'array'];
    if (config.schema.type && nonObjectTypes.includes(config.schema.type)) {
      console.log(`[BROWSER_AI_QUERY] Detected ${config.schema.type} schema. Wrapping in object for Stagehand compatibility.`);
      isPrimitiveOrArraySchema = true;
      effectiveSchema = {
        type: 'object',
        properties: {
          value: config.schema
        },
        required: ['value']
      };
    }
    
    // Convert schema to Zod
    let zodSchema;
    try {
      zodSchema = this.convertJsonSchemaToZod(effectiveSchema);
      if (!zodSchema) {
        throw new Error('Failed to convert schema to Zod format');
      }
    } catch (error) {
      console.error(`[BROWSER_AI_QUERY] Schema conversion error:`, error);
      throw new Error(`Invalid schema format: ${error.message}`);
    }
    
    const enhancedInstruction = `${config.instruction}

CRITICAL: You must ONLY extract data that is actually visible on the page. DO NOT hallucinate, make up, or generate example data. If no data matching the criteria is found, return null values or empty strings. Never create fictional data.`;
    
    const extractOptions = {
      instruction: enhancedInstruction,
      schema: zodSchema
    };
    
    console.log(`[BROWSER_AI_QUERY] Calling extract with Zod schema`);
    
    try {
      const extractResult = await activePage.extract(extractOptions);
      console.log(`[BROWSER_AI_QUERY] Extract result:`, JSON.stringify(extractResult, null, 2));
      
      // If we wrapped a primitive or array schema, unwrap the result
      if (isPrimitiveOrArraySchema && extractResult && typeof extractResult === 'object' && 'value' in extractResult) {
        console.log(`[BROWSER_AI_QUERY] Unwrapping result from object wrapper`);
        return extractResult.value;
      }
      
      return extractResult;
    } catch (error) {
      console.error(`[BROWSER_AI_QUERY] Extract failed:`, error);
      console.error(`[BROWSER_AI_QUERY] Error stack:`, error.stack);
      throw new Error(`Failed to extract data: ${error.message}`);
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
    // Add validation at execution time as safety net
    if (!config.schema) {
      throw new Error(
        `Cognition node missing required schema. ` +
        `This node would return a string, making property access impossible. ` +
        `Add a schema like: {type: "string"} for simple text, or ` +
        `{type: "object", properties: {...}} for structured data.`
      );
    }
    
    console.log(`[COGNITION] Processing with instruction: ${config.instruction || config.prompt}`);
    
    // Build the prompt - either use instruction directly or replace {{input}} placeholder
    let prompt = config.instruction || config.prompt || '';
    if (inputData && prompt.includes('{{input}}')) {
      prompt = prompt.replace('{{input}}', JSON.stringify(inputData));
    }
    
    // OpenAI requires the word "JSON" to appear in the messages when using
    // `response_format: {type: 'json_object'}`.  Append a one-liner if the
    // caller didn't already mention it.
    const needsJsonHint = !!config.schema && !/json/i.test(prompt);
    const safePrompt = needsJsonHint
      ? `${prompt}\n\nRespond ONLY in valid JSON format.`
      : prompt;

    const completion = await this.openai.chat.completions.create({
      model: 'o4-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that processes data according to instructions.' },
        { role: 'user', content: safePrompt }
      ],
      temperature: 1,
      response_format: config.schema ? { type: 'json_object' } : undefined
    });

    const response = completion.choices[0].message.content;
    
    // Parse JSON response if schema is provided
    let parsedResponse = response;
    if (config.schema) {
      try {
        parsedResponse = JSON.parse(response);
      } catch (error) {
        throw new Error(`Failed to parse JSON response from cognition: ${error.message}`);
      }
      
      // NEW: Validate and coerce
      const validation = SchemaValidator.validateAndCoerce(
        parsedResponse,
        config.schema,
        {
          nodeType: 'COGNITION',
          nodeAlias: config.alias,
          position: this.currentNodePosition
        }
      );
      
      if (!validation.success) {
        throw new Error(validation.error);
      }
      
      if (validation.coerced) {
        console.log(`[COGNITION] Type coercion applied for ${config.alias || `node${this.currentNodePosition}`}`);
      }
      
      parsedResponse = validation.data;
    }
    
    return parsedResponse;
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
    // Simplified context node - only stores variables
    if (!config.variables) {
      throw new Error('Context node requires variables object');
    }

    console.log(`[CONTEXT] Storing variables:`, config.variables);

    // Store each variable individually for backward compatibility
    // Variables are stored flat in the workflow_memory table
    const results = {};
    
    for (const [key, value] of Object.entries(config.variables)) {
      const memoryConfig = {
        operation: 'set',
        key,
        value
      };
      
      const result = await this.executeMemory(memoryConfig, workflowId);
      results[key] = result;
    }
    
    return {
      success: true,
      message: `Stored ${Object.keys(config.variables).length} variables`,
      stored: config.variables
    };
  }

  async executeRoute(config, workflowId) {
    console.log(`[ROUTE] Evaluating route with ${config.length} branches`);
    
    // Config is now simply an array of branches
    if (!Array.isArray(config)) {
      throw new Error('Route config must be an array of branches');
    }
    
    // Determine which path to take
    let selectedPath = null;
    let selectedBranch = null;
    
    // Evaluate each branch condition in order
    for (const branch of config) {
      console.log(`[ROUTE] Evaluating branch '${branch.name}' with condition: ${branch.condition}`);
      
      try {
        const conditionMet = await this.evaluateExpression(branch.condition, workflowId);
        
        if (conditionMet) {
          selectedPath = branch.name;
          selectedBranch = branch.branch;
          console.log(`[ROUTE] Taking branch '${branch.name}'`);
          break;
        }
      } catch (error) {
        console.error(`[ROUTE] Error evaluating condition for branch '${branch.name}':`, error);
        // Continue to next branch on error
      }
    }
    
    // If no branch matched, look for a default (condition: 'true')
    if (!selectedBranch) {
      const defaultBranch = config.find(b => b.condition === 'true' || b.name === 'default');
      if (defaultBranch) {
        selectedPath = defaultBranch.name;
        selectedBranch = defaultBranch.branch;
        console.log(`[ROUTE] No specific conditions met, taking default branch '${defaultBranch.name}'`);
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
    const ms = Date.now();
    // Get value from workflow memory or previous node results
    // Handle malformed template references - strip any remaining braces
    if (typeof path === 'string' && (path.includes('{{') || path.includes('}}'))) {
      path = path.replace(/\{\{|\}\}/g, '');
    }
    
    // Check for position-based references (e.g., node25 or node25.property)
    const positionMatch = path.match(/^node(\d+)(?:\.(.+))?$/);
    if (positionMatch) {
      const position = positionMatch[1];
      const propertyPath = positionMatch[2];
      
      console.log(`[STATE] WARNING: Using deprecated position-based reference: ${path}`);
      console.log(`[STATE] Looking up node at position ${position}...`);
      
      // First try to find the node by position to get its alias
      const { data: node } = await supabase
        .from('nodes')
        .select('alias, result, store_variable')
        .eq('workflow_id', workflowId)
        .eq('position', parseInt(position))
        .single();
        
      if (!node) {
        throw new Error(`Node at position ${position} not found`);
      }
      
      // If the node has store_variable: true and an alias, try to get from workflow_memory
      if (node.store_variable && node.alias) {
        const storageKey = this.getStorageKey(node.alias);
        const { data: memoryData } = await supabase
          .from('workflow_memory')
          .select('value')
          .eq('workflow_id', workflowId)
          .eq('key', storageKey)
          .single();
          
        if (memoryData) {
          let value = memoryData.value;
          
          // Navigate nested properties if specified
          if (propertyPath) {
            const parts = propertyPath.split('.');
            for (const part of parts) {
              value = value?.[part];
            }
            
            if (value === undefined) {
              throw new Error(`Property '${path}' not found. Node at position ${position} exists but doesn't have property '${propertyPath}'`);
            }
          }
          
          console.log(`[STATE] Found value from workflow_memory for position ${position}: ${JSON.stringify(value)}`);
          return value;
        }
      }
      
      // Fallback: get result from nodes table
      let value = node.result;
      
      // IMPORTANT: Handle visual observation wrapper
      // When visual observations are enabled, primitive values get wrapped as {value: primitive, _page_observation: "..."}
      if (value && typeof value === 'object' && '_page_observation' in value && 'value' in value) {
        console.log(`[STATE] Unwrapping visual observation wrapper for position ${position}`);
        value = value.value;
      }
      
      // Navigate nested properties if specified
      if (propertyPath) {
        const parts = propertyPath.split('.');
        for (const part of parts) {
          value = value?.[part];
        }
        
        if (value === undefined) {
          throw new Error(`Property '${path}' not found. Node at position ${position} exists but doesn't have property '${propertyPath}'`);
        }
      }
      
      console.log(`[STATE] Found value from node result for position ${position}: ${JSON.stringify(value)}`);
      return value;
    }
    
    // Handle property access (e.g., search_results.emails)
    if (path.includes('.')) {
      const parts = path.split('.');
      const aliasRef = parts[0];
      // Look up by alias with iteration context
      const storageKey = this.getStorageKey(aliasRef);
      const { data: memoryData } = await supabase
        .from('workflow_memory')
        .select('value')
        .eq('workflow_id', workflowId)
        .eq('key', storageKey)
        .single();
      
      if (!memoryData) {
        throw new Error(`Variable '${aliasRef}' not found. Did you forget to set store_variable: true?`);
      }
      
      // Navigate nested properties
      let value = memoryData.value;
      
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        value = value?.[part];
      }
      
      // If value is undefined after navigation, it means the property doesn't exist
      if (value === undefined) {
        throw new Error(`Property '${path}' not found. The variable '${aliasRef}' exists but doesn't have property '${parts.slice(1).join('.')}'`);
      }
      
      return value;
    }
    
    // Simple variable lookup
    const storageKey = this.getStorageKey(path);
    console.log(`[STATE] Looking up variable '${path}' with storage key: ${storageKey}`);
    
    const { data } = await supabase
      .from('workflow_memory')
      .select('value')
      .eq('workflow_id', workflowId)
      .eq('key', storageKey)
      .single();
      
    if (!data) {
      console.log(`[STATE] Variable '${path}' not found with key '${storageKey}'. Checking all keys for this workflow...`);
      const { data: allVars } = await supabase
        .from('workflow_memory')
        .select('key, value')
        .eq('workflow_id', workflowId);
      console.log(`[STATE] All variables in workflow:`, allVars?.map(v => `${v.key}=${JSON.stringify(v.value)}`));
      throw new Error(`Variable '${path}' not found. Did you forget to set store_variable: true?`);
    }
    
    console.log(`[STATE] Found variable '${path}' with value: ${JSON.stringify(data.value)}`);
    return data.value;
  }
  
  /**
   * Parse and evaluate complex expressions for enhanced routing
   * Supports: &&, ||, !, (), comparison operators, ternary operator
   */
  async evaluateExpression(expression, workflowId) {
    console.log(`[EXPRESSION] Evaluating: ${expression}`);
    
    try {
      // First, resolve all template variables
      const resolvedExpression = await this.resolveTemplateVariables(expression, workflowId);
      console.log(`[EXPRESSION] After variable resolution: ${resolvedExpression}`);
      
      // Parse and evaluate the expression
      const result = await this.parseAndEvaluate(resolvedExpression, workflowId);
      console.log(`[EXPRESSION] Result: ${result}`);
      
      return result;
    } catch (error) {
      console.error(`[EXPRESSION] Error evaluating expression:`, error);
      return false; // Default to false on error to not break workflow
    }
  }

  /**
   * Parse and evaluate an expression with proper operator precedence
   */
  async parseAndEvaluate(expr, workflowId) {
    // Handle undefined or null expressions
    if (expr === undefined || expr === null) {
      console.warn(`[EXPRESSION] Expression is ${expr}, treating as false`);
      return false;
    }
    
    // Convert to string if needed
    if (typeof expr !== 'string') {
      expr = String(expr);
    }
    
    // Remove extra whitespace
    expr = expr.trim();
    
    // Handle ternary operator (lowest precedence)
    const ternaryMatch = this.findTernaryOperator(expr);
    if (ternaryMatch) {
      const condition = await this.parseAndEvaluate(ternaryMatch.condition, workflowId);
      return condition 
        ? await this.parseAndEvaluate(ternaryMatch.trueValue, workflowId)
        : await this.parseAndEvaluate(ternaryMatch.falseValue, workflowId);
    }
    
    // Handle logical OR (||)
    const orParts = this.splitByOperator(expr, '||');
    if (orParts.length > 1) {
      for (const part of orParts) {
        if (await this.parseAndEvaluate(part, workflowId)) {
          return true;
        }
      }
      return false;
    }
    
    // Handle logical AND (&&)
    const andParts = this.splitByOperator(expr, '&&');
    if (andParts.length > 1) {
      for (const part of andParts) {
        if (!await this.parseAndEvaluate(part, workflowId)) {
          return false;
        }
      }
      return true;
    }
    
    // Handle NOT operator (!)
    if (expr.startsWith('!')) {
      const innerExpr = expr.substring(1).trim();
      return !await this.parseAndEvaluate(innerExpr, workflowId);
    }
    
    // Handle parentheses
    if (expr.startsWith('(') && expr.endsWith(')')) {
      return await this.parseAndEvaluate(expr.slice(1, -1), workflowId);
    }
    
    // Handle comparison operators
    const comparisonResult = await this.evaluateComparison(expr, workflowId);
    if (comparisonResult !== null) {
      return comparisonResult;
    }
    
    // Handle boolean literals
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    
    // Handle single values (check for existence)
    const value = await this.resolveValue(expr, workflowId);
    return value !== null && value !== undefined && value !== '' && value !== false;
  }

  /**
   * Find ternary operator in expression, handling nested cases
   */
  findTernaryOperator(expr) {
    let depth = 0;
    let questionIndex = -1;
    let colonIndex = -1;
    
    for (let i = 0; i < expr.length; i++) {
      if (expr[i] === '(') depth++;
      else if (expr[i] === ')') depth--;
      else if (expr[i] === '?' && depth === 0 && questionIndex === -1) {
        questionIndex = i;
      } else if (expr[i] === ':' && depth === 0 && questionIndex !== -1 && colonIndex === -1) {
        colonIndex = i;
      }
    }
    
    if (questionIndex !== -1 && colonIndex !== -1) {
      return {
        condition: expr.substring(0, questionIndex).trim(),
        trueValue: expr.substring(questionIndex + 1, colonIndex).trim(),
        falseValue: expr.substring(colonIndex + 1).trim()
      };
    }
    
    return null;
  }

  /**
   * Split expression by operator, respecting parentheses
   */
  splitByOperator(expr, operator) {
    const parts = [];
    let current = '';
    let depth = 0;
    let i = 0;
    
    while (i < expr.length) {
      if (expr[i] === '(') {
        depth++;
        current += expr[i];
        i++;
      } else if (expr[i] === ')') {
        depth--;
        current += expr[i];
        i++;
      } else if (depth === 0 && expr.substring(i, i + operator.length) === operator) {
        parts.push(current.trim());
        current = '';
        i += operator.length;
      } else {
        current += expr[i];
        i++;
      }
    }
    
    if (current) {
      parts.push(current.trim());
    }
    
    return parts;
  }

  /**
   * Evaluate comparison expressions
   */
  async evaluateComparison(expr, workflowId) {
    // Check for comparison operators
    const operators = [
      { op: '===', fn: (a, b) => a === b },
      { op: '!==', fn: (a, b) => a !== b },
      { op: '==', fn: (a, b) => a == b },
      { op: '!=', fn: (a, b) => a != b },
      { op: '>=', fn: (a, b) => Number(a) >= Number(b) },
      { op: '<=', fn: (a, b) => Number(a) <= Number(b) },
      { op: '>', fn: (a, b) => Number(a) > Number(b) },
      { op: '<', fn: (a, b) => Number(a) < Number(b) },
      { op: ' contains ', fn: (a, b) => String(a).includes(String(b)) },
      { op: ' matches ', fn: (a, b) => new RegExp(b).test(String(a)) },
      { op: ' equals ', fn: (a, b) => a === b },
      { op: ' exists', fn: (a) => a !== null && a !== undefined && a !== '' }
    ];
    
    for (const { op, fn } of operators) {
      if (expr.includes(op)) {
        const parts = expr.split(op);
        if (parts.length === 2 || (op === ' exists' && parts.length === 1)) {
          const leftValue = await this.resolveValue(parts[0].trim(), workflowId);
          
          if (op === ' exists') {
            return fn(leftValue);
          }
          
          const rightValue = await this.resolveValue(parts[1].trim(), workflowId);
          return fn(leftValue, rightValue);
        }
      }
    }
    
    return null;
  }

  /**
   * Resolve a value - could be a variable reference, string literal, or number
   */
  async resolveValue(value, workflowId) {
    // String literals
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }
    
    // Numbers
    if (!isNaN(value)) {
      return Number(value);
    }
    
    // Boolean literals
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;
    
    // Variable reference - use getStateValue
    return await this.getStateValue(value, workflowId);
  }

  async evaluateCondition(condition, workflowId) {
    // Legacy condition evaluation for backward compatibility
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
    
    
    // Get the collection to iterate over
    let collection;
    const resolveStart = Date.now();
    if (Array.isArray(config.over)) {
      // Already resolved to an array by resolveTemplateVariables
      collection = config.over;
    } else if (typeof config.over === 'string') {
      // It's a path reference - resolve it
      const cleanPath = config.over.replace('state.', '');
      collection = await this.getStateValue(cleanPath, workflowId);
    } else {
      return { results: [], errors: [], processed: 0, total: 0 };
    }
    
    if (!Array.isArray(collection)) {
      const actualType = collection === null ? 'null' : 
                        collection === undefined ? 'undefined' :
                        Array.isArray(collection) ? 'array' : 
                        typeof collection;
      const variableInfo = config.over;
      
      throw new Error(
        `Iterate node expected an array but received ${actualType} for "${variableInfo}". ` +
        `This often happens when AI extraction returns an object instead of an array. ` +
        `Consider updating the extraction schema to ensure it returns an array, ` +
        `or check if the variable exists and contains the expected data structure. ` +
        `Received value: ${JSON.stringify(collection).substring(0, 100)}...`
      );
    }
    
    
    // If preview mode, return iteration structure without executing
    if (options.previewOnly !== false) {  // Default to preview mode
      const previewStart = Date.now();
      
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
      
      const previewDuration = Date.now() - previewStart;
      
      const result = {
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
      
      return result;
    }
    
    // Full execution mode (when explicitly requested)
    
    const results = [];
    const errors = [];
    const variable = config.variable || 'item';
    const indexVariable = config.index || `${variable}Index`;
    
    // Clean up any existing iteration variables for this iterate node
    const cleanupPattern = `%@iter:${iterateNodePosition}:%`;
    const { data: deletedVars, error: deleteError } = await supabase
      .from('workflow_memory')
      .delete()
      .eq('workflow_id', workflowId)
      .like('key', cleanupPattern)
      .select();
    
    if (deleteError) {
      console.error(`Failed to cleanup iteration variables:`, deleteError);
    }
    
    // Process each item
    for (let i = 0; i < collection.length; i++) {
      if (config.limit && i >= config.limit) {
        console.log(`[ITERATE] Reached limit of ${config.limit} items`);
        break;
      }
      
      const item = collection[i];
      const itemMs = Date.now();
      
      // Push iteration context
      this.pushIterationContext(iterateNodePosition, i, variable, collection.length);
      
      try {
        // Set iteration variables in memory (these use the current context)
        const varKey = this.getStorageKey(variable);
        const indexKey = this.getStorageKey(indexVariable);
        const totalKey = this.getStorageKey(`${variable}Total`);
        
        
        const storeStart = Date.now();
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
    
    // Note: Iteration variables are cleaned up at the start of the next iteration
    // to ensure they're available if needed after the loop completes
    
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
      console.log('[CLEANUP] Destroying StageHand instance', {
        currentProfile: this.currentProfileName,
        persistStrategy: this.persistStrategy
      });
      try {
        // Check if stagehand is initialized before trying to close
        if (this.stagehandInstance.page) {
          await this.stagehandInstance.close();
        }
      } catch (error) {
        console.log('[CLEANUP] Error closing StageHand instance:', error.message);
        // Continue with cleanup even if close fails
      }
      this.stagehandInstance = null;
      // Clear tab tracking
      this.stagehandPages = {};
      this.mainPage = null;
      this.activeTabName = 'main';
    }
  }

  // Browser session management methods
  /**
   * Save current browser session
   * @param {string} name - Unique session identifier
   * @param {string} scope - 'origin' or 'browser'
   * @param {string} persistStrategy - 'storageState' or 'profileDir'
   * @returns {Object} {sizeKB: number, expires: string|null}
   */
  async saveBrowserSession(name, scope = 'origin', persistStrategy = 'storageState') {
    if (!this.stagehandInstance) {
      throw new Error('No browser instance to save');
    }
    
    if (persistStrategy === 'profileDir') {
      // Check if browser is currently using a profile directory
      if (this.persistStrategy !== 'profileDir' || !this.currentProfileName) {
        // Browser is not using a profile - we need to restart it with one
        console.log(`[BROWSER_SESSION] Browser not using profile directory. Restarting with profile "${name}"...`);
        
        // Get current URL to navigate back to after restart
        const currentUrl = this.stagehandInstance.page.url();
        
        // Restart browser with profile directory
        await this.cleanup();
        await this.getStagehand({ 
          profileName: name, 
          persistStrategy: 'profileDir' 
        });
        
        // Navigate back to the original URL
        if (currentUrl && currentUrl !== 'about:blank') {
          await this.stagehandInstance.page.goto(currentUrl, { waitUntil: 'domcontentloaded' });
          console.log(`[BROWSER_SESSION] Navigated back to ${currentUrl}`);
        }
        
        // Create database record
        const origin = scope === 'origin' ? new URL(currentUrl).origin : null;
        const { error } = await supabase
          .from('browser_sessions')
          .upsert({
            name,
            cookies: [], // Profile stores cookies on disk
            local_storage: {}, // Profile stores localStorage on disk
            session_storage: {}, // Profile stores sessionStorage on disk
            scope,
            persist_strategy: persistStrategy,
            origin,
            metadata: {
              profile_path: `browser-profiles/${name}`,
              created_from_url: currentUrl
            }
          }, { onConflict: 'name' });
          
        if (error) {
          console.error('[BROWSER_SESSION] Failed to save profile session record:', error);
          throw error;
        }
        
        console.log(`[BROWSER_SESSION] Browser restarted with profile "${name}". Session will auto-save.`);
        console.log(`[BROWSER_SESSION] IMPORTANT: You need to log in again - the previous session was not saved.`);
        
        return {
          restarted: true,
          message: 'Browser restarted with profile directory. Please log in again to save your session.',
          sizeKB: 0,
          expires: null
        };
      }
      
      // Browser is already using the requested profile
      if (this.currentProfileName === name) {
        console.log(`[BROWSER_SESSION] Already using profile "${name}" - session continuously saves`);
        
        // Update database record
        const currentUrl = this.stagehandInstance.page.url();
        const origin = scope === 'origin' ? new URL(currentUrl).origin : null;
        
        const { error } = await supabase
          .from('browser_sessions')
          .upsert({
            name,
            scope,
            persist_strategy: persistStrategy,
            origin,
            last_used_at: new Date(),
            metadata: {
              profile_path: `browser-profiles/${name}`,
              last_url: currentUrl
            }
          }, { onConflict: 'name' });
          
        if (error) {
          console.error('[BROWSER_SESSION] Failed to update profile session record:', error);
          throw error;
        }
        
        return {
          sizeKB: 0,  // Profile size on disk (could calculate if needed)
          expires: null,  // Profiles don't expire
          message: `Profile "${name}" is active and auto-saving`
        };
      } else {
        // Browser is using a different profile
        throw new Error(`Cannot save to profile "${name}" - browser is currently using profile "${this.currentProfileName}"`);
      }
    }
    
    try {
      // Database storage implementation
      const currentUrl = this.stagehandInstance.page.url();
      const origin = new URL(currentUrl).origin;
      // Get browser state
      const context = this.stagehandInstance.page.context();
      let cookies = await context.cookies();
      
      // Apply scope filtering
      if (scope === 'origin') {
        const hostname = new URL(origin).hostname;
        cookies = cookies.filter(c => 
          c.domain.includes(hostname) || 
          c.domain === `.${hostname}`
        );
      }
      
      // Extract storage
      const localStorage = await this.stagehandInstance.page.evaluate((scope, origin) => {
        const storage = {};
        if (scope === 'origin') {
          storage[origin] = {...window.localStorage};
        } else {
          // For 'browser' scope, we only get current origin
          // (would need to visit all tabs to get all origins)
          storage[window.location.origin] = {...window.localStorage};
        }
        return storage;
      }, scope, origin);
      
      const sessionStorage = await this.stagehandInstance.page.evaluate((scope, origin) => {
        const storage = {};
        if (scope === 'origin') {
          storage[origin] = {...window.sessionStorage};
        } else {
          storage[window.location.origin] = {...window.sessionStorage};
        }
        return storage;
      }, scope, origin);
      
      // Calculate expiration (earliest cookie expiry)
      const expires = cookies
        .filter(c => c.expires > 0)
        .map(c => new Date(c.expires * 1000))
        .sort((a, b) => a - b)[0];

      // Save to database
      const sessionData = {
        name,
        cookies,
        local_storage: localStorage,
        session_storage: sessionStorage,
        scope,
        persist_strategy: persistStrategy,
        origin: scope === 'origin' ? origin : null,
        last_used_at: new Date()
      };
      
      const { data, error } = await supabase
        .from('browser_sessions')
        .upsert(sessionData, { onConflict: 'name' })
        .select()
        .single();

      if (error) {
        console.error('[BROWSER_SESSION] Error saving session:', error);
        throw error;
      }

      console.log(`[BROWSER_SESSION] Saved session "${name}" with ${cookies.length} cookies`);
      
      return {
        sizeKB: Math.round(JSON.stringify(sessionData).length / 1024),
        expires: expires ? expires.toISOString() : null
      };
    } catch (error) {
      console.error('[BROWSER_SESSION] Failed to save browser session:', error);
      throw error;
    }
  }

  /**
   * Load a saved browser session
   * @param {string} name - Session identifier to load
   * @param {string} persistStrategy - 'storageState' or 'profileDir'
   * @throws {Error} If session not found or load fails
   */
  async loadBrowserSession(name, persistStrategy = 'storageState') {
    console.log('[LOAD_SESSION] Loading browser session:', {
      name,
      persistStrategy
    });
    
    if (persistStrategy === 'profileDir') {
      // Switch to profile-based browser
      console.log('[LOAD_SESSION] Using profileDir strategy - switching to profile-based browser');
      await this.cleanup();
      await this.getStagehand({ 
        profileName: name, 
        persistStrategy: 'profileDir' 
      });
      if (this.initializeBrowser) {
        await this.initializeBrowser();
      }
      return { strategy: 'profileDir' };
    }
    
    try {
      // Load from database
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

      // Navigate to origin and restore storage
      if (session.cookies && session.cookies.length > 0) {
        const firstCookie = session.cookies[0];
        const url = `https://${firstCookie.domain.replace(/^\./, '')}`;
        await stagehand.page.goto(url, { waitUntil: 'domcontentloaded' });
      }
      
      // Restore storage
      if (session.local_storage) {
        await stagehand.page.evaluate((storage) => {
          Object.entries(storage).forEach(([origin, items]) => {
            if (window.location.origin === origin) {
              Object.entries(items).forEach(([key, value]) => {
                window.localStorage.setItem(key, value);
              });
            }
          });
        }, session.local_storage);
      }
      
      if (session.session_storage) {
        await stagehand.page.evaluate((storage) => {
          Object.entries(storage).forEach(([origin, items]) => {
            if (window.location.origin === origin) {
              Object.entries(items).forEach(([key, value]) => {
                window.sessionStorage.setItem(key, value);
              });
            }
          });
        }, session.session_storage);
      }

      // Update last used timestamp
      await supabase
        .from('browser_sessions')
        .update({ last_used_at: new Date() })
        .eq('name', name);

      console.log(`[BROWSER_SESSION] Loaded session "${name}"`);
      return { strategy: 'storageState' };
    } catch (error) {
      console.error('[BROWSER_SESSION] Failed to load browser session:', error);
      throw error;
    }
  }

  /**
   * List all saved browser sessions
   * @returns {Array} Array of session objects
   */
  async listBrowserSessions() {
    try {
      const { data: sessions, error } = await supabase
        .from('browser_sessions')
        .select('name, description, created_at, scope, persist_strategy, last_used_at')
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

  /**
   * List available browser profiles on disk
   * @returns {Array} List of profile names
   */
  async listBrowserProfiles() {
    const profilesPath = this.getBrowserProfilesBasePath();
    
    try {
      // Check if directory exists
      await fs.access(profilesPath);
      
      // Read directory contents
      const entries = await fs.readdir(profilesPath, { withFileTypes: true });
      
      // Filter for directories only
      const profiles = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
      
      console.log(`[BROWSER_PROFILES] Found ${profiles.length} profiles:`, profiles);
      return profiles;
    } catch (error) {
      console.log('[BROWSER_PROFILES] No profiles directory found');
      return [];
    }
  }

  /**
   * Create a snapshot of a browser profile
   * @param {string} profileName - Name of the profile to snapshot
   * @returns {Object} Snapshot metadata
   */
  async snapshotBrowserProfile(profileName) {
    const profilePath = path.join(this.getBrowserProfilesBasePath(), profileName);
    
    // Check if profile exists
    try {
      await fs.access(profilePath);
    } catch (error) {
      throw new Error(`Profile "${profileName}" does not exist`);
    }
    
    // For MVP, we'll use tar command (available on Mac/Linux)
    const tarPath = path.join(this.getBrowserProfilesBasePath(), `${profileName}-snapshot.tar.gz`);
    
    try {
      console.log(`[BROWSER_SNAPSHOT] Creating snapshot of profile "${profileName}"...`);
      
      // Create tar.gz archive
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync(`tar -czf "${tarPath}" -C "${path.dirname(profilePath)}" "${profileName}"`);
      
      // Get file size
      const stats = await fs.stat(tarPath);
      const sizeMB = Math.round(stats.size / 1024 / 1024);
      
      console.log(`[BROWSER_SNAPSHOT] Created snapshot: ${sizeMB}MB`);
      
      // Upload to Supabase Storage
      const fileBuffer = await fs.readFile(tarPath);
      const fileName = `${profileName}-${Date.now()}.tar.gz`;
      
      const { data, error } = await supabase.storage
        .from('browser-profiles')
        .upload(fileName, fileBuffer, {
          contentType: 'application/gzip',
          upsert: true
        });
      
      if (error) {
        console.error('[BROWSER_SNAPSHOT] Upload failed:', error);
        throw error;
      }
      
      // Clean up local tar file
      await fs.unlink(tarPath);
      
      // Save metadata to database
      const { error: dbError } = await supabase
        .from('browser_sessions')
        .upsert({
          name: profileName,
          persist_strategy: 'profileDir',
          metadata: {
            snapshot_file: fileName,
            size_mb: sizeMB,
            created_at: new Date()
          }
        }, { onConflict: 'name' });
      
      if (dbError) {
        console.error('[BROWSER_SNAPSHOT] Database update failed:', dbError);
      }
      
      return {
        success: true,
        profileName,
        sizeMB,
        fileName,
        message: `Profile snapshot created: ${sizeMB}MB`
      };
    } catch (error) {
      // Clean up tar file if it exists
      try {
        await fs.unlink(tarPath);
      } catch {}
      
      throw error;
    }
  }

  /**
   * Restore a browser profile from snapshot
   * @param {string} profileName - Name of the profile to restore
   * @returns {Object} Restore result
   */
  async restoreBrowserProfile(profileName) {
    // Get snapshot metadata from database
    const { data: session, error } = await supabase
      .from('browser_sessions')
      .select('*')
      .eq('name', profileName)
      .eq('persist_strategy', 'profileDir')
      .single();
    
    if (error || !session) {
      throw new Error(`No snapshot found for profile "${profileName}"`);
    }
    
    const fileName = session.metadata?.snapshot_file;
    if (!fileName) {
      throw new Error(`No snapshot file recorded for profile "${profileName}"`);
    }
    
    console.log(`[BROWSER_RESTORE] Restoring profile "${profileName}" from ${fileName}...`);
    
    // Download from Supabase Storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('browser-profiles')
      .download(fileName);
    
    if (downloadError) {
      throw downloadError;
    }
    
    // Save to temp file
    const tempPath = path.join(this.getBrowserProfilesBasePath(), `${profileName}-restore.tar.gz`);
    const buffer = await fileData.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(buffer));
    
    // Extract archive
    const profilePath = path.join(this.getBrowserProfilesBasePath(), profileName);
    
    try {
      // Remove existing profile if it exists
      try {
        await fs.rm(profilePath, { recursive: true, force: true });
      } catch {}
      
      // Extract tar.gz
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync(`tar -xzf "${tempPath}" -C "${path.dirname(profilePath)}"`);
      
      // Clean up temp file
      await fs.unlink(tempPath);
      
      console.log(`[BROWSER_RESTORE] Profile "${profileName}" restored successfully`);
      
      // Update last_used_at
      await supabase
        .from('browser_sessions')
        .update({ last_used_at: new Date() })
        .eq('name', profileName);
      
      return {
        success: true,
        profileName,
        message: `Profile restored from snapshot`
      };
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempPath);
      } catch {}
      
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