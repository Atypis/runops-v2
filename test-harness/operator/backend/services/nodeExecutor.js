import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';

export class NodeExecutor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.stagehandInstance = null;
  }

  // StageHand logging control:
  // - Set STAGEHAND_VERBOSE=0 for minimal logging
  // - Set STAGEHAND_VERBOSE=2 for debug logging (includes OpenAI logs)
  // - Default filters out noisy OpenAI DOM snapshots

  async getStagehand() {
    if (!this.stagehandInstance) {
      this.stagehandInstance = new Stagehand({
        env: 'LOCAL',
        headless: false,
        enableCaching: true,
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
      
      switch (node.type) {
        case 'browser_action':
          console.log(`[EXECUTE] Executing browser action...`);
          result = await this.executeBrowserAction(node.params, workflowId);
          break;
        case 'browser_query':
          result = await this.executeBrowserQuery(node.params);
          break;
        case 'transform':
          result = await this.executeTransform(node.params, workflowId);
          break;
        case 'cognition':
          result = await this.executeCognition(node.params, options.inputData);
          break;
        case 'memory':
          result = await this.executeMemory(node.params, workflowId);
          break;
        case 'context':
          console.log(`[EXECUTE] Executing context operation...`);
          result = await this.executeContext(node.params, workflowId);
          break;
        case 'route':
          console.log(`[EXECUTE] Executing route...`);
          result = await this.executeRoute(node.params, workflowId);
          break;
        case 'iterate':
          console.log(`[EXECUTE] Executing iterate...`);
          result = await this.executeIterate(node.params, workflowId);
          break;
        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }

      // Log successful execution
      await this.logExecution(nodeId, workflowId, 'success', 'Node executed successfully', result);
      
      // Update node status
      await supabase
        .from('nodes')
        .update({
          status: 'success',
          result,
          executed_at: new Date().toISOString()
        })
        .eq('id', nodeId);
      
      // Also store the result in workflow memory for easy access by subsequent nodes
      // This allows referencing via state.node[position] or direct node[position]
      if (result !== null && result !== undefined && node.position) {
        try {
          await supabase
            .from('workflow_memory')
            .upsert({
              workflow_id: workflowId,
              key: `node${node.position}`,
              value: result
            });
          console.log(`[EXECUTE] Stored node position ${node.position} (id: ${nodeId}) result in workflow memory`);
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
    const stagehand = await this.getStagehand();
    const page = stagehand.page;
    const context = page.context();
    
    // Helper to get the current active StagehandPage
    const getActiveStagehandPage = async () => {
      // If we have named tabs and one is marked as active, use it
      if (this.activeTabName && this.stagehandPages && this.stagehandPages[this.activeTabName]) {
        return this.stagehandPages[this.activeTabName];
      }
      // Otherwise, use the main stagehand instance's page
      return stagehand.page;
    };

    switch (config.action) {
      case 'navigate':
        await page.goto(config.url);
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
              await activePage.click(selector, { timeout: 5000 });
              clicked = true;
              break;
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
        await page.waitForTimeout(config.duration || 1000);
        return { waited: config.duration || 1000 };
        
      case 'openNewTab':
        // Get StageHand instance to access its context
        const stagehandForNewTab = await this.getStagehand();
        
        // Create new page through StageHand's context
        // This automatically wraps it in a StagehandPage with act/extract/observe methods
        const newStagehandPage = await stagehandForNewTab.context.newPage();
        
        if (config.url) {
          await newStagehandPage.goto(config.url);
        }
        
        // Store the StagehandPage reference if a name is provided
        if (config.name) {
          this.stagehandPages = this.stagehandPages || {};
          this.stagehandPages[config.name] = newStagehandPage;
          // Mark this tab as active
          this.activeTabName = config.name;
        }
        
        // Make the new tab visually active
        await newStagehandPage.bringToFront();
        
        console.log(`[OPEN NEW TAB] Created new tab: ${config.name || 'unnamed'}`);
        console.log(`[OPEN NEW TAB] StageHand automatically wrapped it with act/extract/observe capabilities`);
        console.log(`[OPEN NEW TAB] Tab is now active for subsequent operations`);
        
        return { openedTab: config.name || 'unnamed', url: config.url, active: true };
        
      case 'switchTab':
        if (this.stagehandPages && this.stagehandPages[config.tabName]) {
          const targetStagehandPage = this.stagehandPages[config.tabName];
          
          // Bring the underlying Playwright page to front
          await targetStagehandPage.page.bringToFront();
          
          // Mark this tab as the active one
          this.activeTabName = config.tabName;
          
          // Note: StageHand manages its active page internally
          // The act/extract/observe methods should be called on the specific StagehandPage
          // not on the main stagehand instance
          
          console.log(`[SWITCH TAB] Switched to tab: ${config.tabName}`);
          console.log(`[SWITCH TAB] StagehandPage is active and ready for commands`);
          
          return { switchedTo: config.tabName };
        }
        throw new Error(`Tab with name "${config.tabName}" not found`);
        
      case 'back':
        await page.goBack();
        return { action: 'navigated back' };
        
      case 'forward':
        await page.goForward();
        return { action: 'navigated forward' };
        
      case 'refresh':
        await page.reload();
        return { action: 'page refreshed' };
        
      case 'screenshot':
        const screenshotOptions = { 
          path: config.path,
          fullPage: config.fullPage !== false  // Default to true
        };
        if (config.selector) {
          const element = await page.$(config.selector);
          if (element) {
            await element.screenshot(screenshotOptions);
          }
        } else {
          await page.screenshot(screenshotOptions);
        }
        return { screenshot: config.path || 'taken' };
        
      case 'listTabs':
        const pages = context.pages();
        return { 
          tabs: pages.map((p, i) => ({
            index: i,
            url: p.url(),
            title: p.title()
          }))
        };
        
      case 'getCurrentTab':
        return {
          url: page.url(),
          title: await page.title()
        };
        
      case 'act':
        // Use StageHand's natural language action capability
        console.log(`[ACT] Executing natural language action: ${config.instruction}`);
        const activePage = await getActiveStagehandPage();
        const result = await activePage.act({ action: config.instruction });
        console.log(`[ACT] Action completed`);
        return { acted: config.instruction, result };
        
      default:
        throw new Error(`Unknown browser action: ${config.action}`);
    }
  }

  async executeBrowserQuery(config) {
    const stagehand = await this.getStagehand();
    
    // Helper to get the active StagehandPage
    const getActiveStagehandPage = async () => {
      if (this.activeTabName && this.stagehandPages && this.stagehandPages[this.activeTabName]) {
        return this.stagehandPages[this.activeTabName];
      }
      // Fallback to main stagehand page if no active tab
      return stagehand.page;
    };

    if (config.method === 'extract') {
      // Convert simple JSON schema to Zod if provided
      let zodSchema = undefined;
      if (config.schema && typeof config.schema === 'object') {
        zodSchema = this.convertJsonSchemaToZod(config.schema);
      }
      
      // Use the active StagehandPage's extract method
      const activePage = await getActiveStagehandPage();
      const result = await activePage.extract({
        instruction: config.instruction,
        schema: zodSchema
      });
      return result;
    } else if (config.method === 'observe') {
      // Use the active StagehandPage's observe method
      const activePage = await getActiveStagehandPage();
      const result = await activePage.observe({
        instruction: config.instruction
      });
      return result;
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
    const prompt = config.prompt.replace('{{input}}', JSON.stringify(inputData));
    
    const completion = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that processes data according to instructions.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
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
        // Resolve environment variables in the value
        let resolvedValue = config.value;
        if (typeof resolvedValue === 'object') {
          resolvedValue = this.resolveEnvVarsInObject(resolvedValue);
        } else if (typeof resolvedValue === 'string') {
          resolvedValue = this.resolveEnvVar(resolvedValue);
        }
        
        console.log(`[MEMORY] Resolved value:`, JSON.stringify(resolvedValue, null, 2));
        
        const { data: upsertData, error } = await supabase
          .from('workflow_memory')
          .upsert({
            workflow_id: workflowId,
            key: config.key,
            value: resolvedValue
          })
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
    // Execute a node configuration directly (used by route and iterate)
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
      default:
        throw new Error(`Unsupported node type in route: ${nodeConfig.type}`);
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
        const { data: memoryData, error: memError } = await supabase
          .from('workflow_memory')
          .select('value')
          .eq('workflow_id', workflowId)
          .eq('key', `node${nodeIdentifier}`)
          .single();
          
        if (memoryData && memoryData.value !== null) {
          console.log(`[STATE] Found node ${nodeIdentifier} result in memory:`, memoryData.value);
          
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
          console.log(`[STATE] Resolved to value:`, value);
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
    
    // Try workflow memory
    const { data } = await supabase
      .from('workflow_memory')
      .select('value')
      .eq('workflow_id', workflowId)
      .eq('key', path)
      .single();
      
    console.log(`[STATE] Found in memory:`, data?.value);
    
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
  
  async executeIterate(config, workflowId) {
    console.log(`[ITERATE] Starting iteration over: ${config.over}`);
    
    // Get the collection to iterate over
    const collection = await this.getStateValue(config.over.replace('state.', ''), workflowId);
    if (!Array.isArray(collection)) {
      console.warn(`[ITERATE] Value at ${config.over} is not an array:`, collection);
      return { results: [], errors: [], processed: 0, total: 0 };
    }
    
    console.log(`[ITERATE] Iterating over ${collection.length} items`);
    
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
      
      try {
        // Set iteration variables in memory
        await supabase
          .from('workflow_memory')
          .upsert([
            { workflow_id: workflowId, key: variable, value: item },
            { workflow_id: workflowId, key: indexVariable, value: i },
            { workflow_id: workflowId, key: `${variable}Total`, value: collection.length }
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
          break;
        }
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
    }
  }
}