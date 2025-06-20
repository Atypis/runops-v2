import { z } from 'zod';

/**
 * Primitives - Workflow execution primitives
 * Handles all primitive operations with StateManager integration
 */
export default class Primitives {
  constructor(dependencies = {}) {
    this.state = dependencies.state;
    this.stateManager = dependencies.state; // For backward compatibility
    this.stagehand = dependencies.stagehand;
    this.openai = dependencies.openai;
    this.pages = dependencies.pages || {};
    this.currentPage = dependencies.currentPage;
  }

  /**
   * Execute a single node based on its type
   */
  async execute(node, state = {}) {
    // Update state manager with any new state
    if (state && Object.keys(state).length > 0) {
      Object.entries(state).forEach(([key, value]) => {
        this.state.set(key, value);
      });
    }
    
    switch (node.type) {
      case 'browser_action':
        return await this.executeBrowserAction(node);
      
      case 'browser_query':
        return await this.executeBrowserQuery(node);
      
      case 'transform':
        return this.executeTransform(node);
      
      case 'cognition':
        return await this.executeCognition(node);
      
      case 'memory':
        return this.executeMemory(node);
      
      case 'wait':
        return await this.executeWait(node);
      
      case 'sequence':
        return await this.executeSequence(node);
      
      case 'iterate':
        return await this.executeIterate(node);
      
      case 'route':
        return await this.executeRoute(node);
      
      case 'handle':
        return await this.executeHandle(node);
      
      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Browser Action Primitive - Handles browser interactions
   */
  async executeBrowserAction({ method, target, data }) {
    console.log(`🌐 Browser action: ${method} on ${target || 'current page'}`);
    
    // Log current state for debugging
    if (this.currentPage) {
      console.log(`   Current tab URL: ${this.currentPage.url()}`);
    }
    
    switch (method) {
      case 'goto':
        console.log(`   Navigating to: ${target}`);
        try {
          await this.currentPage.goto(target, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
          });
          // Try networkidle but don't fail if it times out
          try {
            await this.currentPage.waitForLoadState('networkidle', { timeout: 10000 });
          } catch (e) {
            console.log('   Note: networkidle timeout, but page loaded');
          }
        } catch (error) {
          console.error(`   ❌ Navigation failed: ${error.message}`);
          throw error;
        }
        console.log(`   ✓ Navigation complete: ${this.currentPage.url()}`);
        return { success: true, url: this.currentPage.url() };
      
      case 'click':
        console.log(`   Click target: "${target}"`);
        // Use StageHand's AI-powered click on any page
        await this.currentPage.act(`click on ${target}`);
        return { success: true, action: 'clicked' };
      
      case 'type':
        const text = this.resolveVariable(data) || data;
        console.log(`   Type data: "${data}" resolved to: "${text}"`);
        // Use StageHand's AI-powered type on any page
        await this.currentPage.act(`type "${text}" into ${target}`);
        return { success: true, typed: text };
      
      case 'openNewTab':
        // Create new page using StageHand's context - it will have AI capabilities!
        const newPage = await this.stagehand.context.newPage();
        
        // Store the new page with a name
        const tabName = data?.name || `tab_${Date.now()}`;
        this.pages[tabName] = newPage;
        this.currentPage = newPage; // This becomes the active page
        console.log(`   ✓ New tab opened: ${tabName}`);
        
        // Navigate if URL provided
        if (target) {
          await newPage.goto(target);
          await newPage.waitForLoadState('networkidle');
        }
        
        return { success: true, tabName, url: newPage.url() };
      
      case 'switchTab':
        const targetTab = target || 'main';
        if (!this.pages[targetTab]) {
          console.error(`   ❌ Available tabs: ${Object.keys(this.pages).join(', ')}`);
          throw new Error(`Tab '${targetTab}' not found`);
        }
        this.currentPage = this.pages[targetTab];
        // Bring the tab to front for visibility
        await this.currentPage.bringToFront();
        console.log(`   ✓ Switched to tab: ${targetTab} (${this.currentPage.url()})`);
        return { success: true, currentTab: targetTab, url: this.currentPage.url() };
      
      default:
        throw new Error(`Unknown browser action: ${method}`);
    }
  }

  /**
   * Browser Query Primitive - Handles data extraction from pages
   */
  async executeBrowserQuery({ method, instruction, schema }) {
    switch (method) {
      case 'extract':
        // Convert schema to Zod if it's provided
        let zodSchema = null;
        
        if (schema) {
          if (typeof schema === 'string') {
            // If schema is a string like "z.object({...})", evaluate it
            try {
              zodSchema = eval(schema);
            } catch (e) {
              console.error('Failed to parse Zod schema string:', e);
              // Fall back to converting JSON schema to Zod
              zodSchema = this.convertJsonSchemaToZod(schema);
            }
          } else if (typeof schema === 'object') {
            // Convert JSON schema to Zod schema
            zodSchema = this.convertJsonSchemaToZod(schema);
          }
        }
        
        // Use StageHand's AI extraction on the current page - works on ALL pages!
        const result = await this.currentPage.extract({ 
          instruction, 
          schema: zodSchema 
        });
        
        // Store the result in state - automatically store all extracted properties
        if (result && typeof result === 'object') {
          Object.entries(result).forEach(([key, value]) => {
            this.stateManager.set(key, value);
          });
        }
        // Also store the full result
        this.stateManager.set('lastExtract', result);
        return result;
      
      case 'observe':
        // Use StageHand's AI observation on the current page
        const observations = await this.currentPage.observe({ instruction });
        this.stateManager.set('lastObserve', observations);
        return observations;
      
      default:
        throw new Error(`Unknown query method: ${method}`);
    }
  }

  /**
   * Transform Primitive - Handles data transformation
   */
  executeTransform({ input, function: fn, output }) {
    // Handle both single input and array of inputs
    let inputData;
    if (Array.isArray(input)) {
      inputData = input.map(i => this.resolveVariable(i));
    } else {
      inputData = this.resolveVariable(input);
    }
    
    // Safe evaluation for demo - use proper sandboxing in production!
    let result;
    try {
      const transformFn = eval(`(${fn})`);
      result = Array.isArray(inputData) ? transformFn(...inputData) : transformFn(inputData);
    } catch (error) {
      console.error('Transform execution error:', error);
      console.error('Input data:', inputData);
      console.error('Function:', fn);
      throw new Error(`Transform failed: ${error.message}`);
    }
    
    if (output) {
      this.setStateValue(output, result);
    }
    
    return result;
  }

  /**
   * Cognition Primitive - Handles AI-powered data processing
   */
  async executeCognition({ prompt, input, output, model = 'gpt-4o-mini', schema }) {
    const inputData = this.resolveVariable(input);
    
    // Enhanced system prompt to ensure clean JSON output
    const systemPrompt = `You are a data processing assistant. You MUST return ONLY valid JSON without any markdown formatting, code blocks, or explanations. 
Do not wrap the response in \`\`\`json\`\`\` tags.
Do not include any text before or after the JSON.
The response must be parseable by JSON.parse().

Examples of correct responses:
{"summary": "Investor interested in Series A, requesting runway details."}
{"stage": "In Diligence"}
[true, false, true, false]
{"investorName": "John Smith", "company": "Accel Partners"}`;
    
    const response = await this.openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${prompt}\n\nInput: ${JSON.stringify(inputData)}` }
      ],
      temperature: 0.3  // Lower temperature for more consistent JSON output
    });
    
    let content = response.choices[0].message.content;
    console.log('Raw cognition response:', content);
    
    // Clean up common formatting issues
    // Remove markdown code blocks if present
    content = content.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    content = content.replace(/^```\s*\n?/i, '').replace(/\n?```\s*$/i, '');
    // Remove any leading/trailing whitespace and newlines
    content = content.trim();
    
    // Try to parse the cleaned content
    let result;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse cognition response:', content);
      // Try to extract JSON from the response if it's embedded in text
      const jsonMatch = content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
          console.log('Successfully extracted JSON from response');
        } catch (e) {
          throw new Error(`Invalid JSON response from cognition: ${parseError.message}`);
        }
      } else {
        throw new Error(`Invalid JSON response from cognition: ${parseError.message}`);
      }
    }
    
    if (output) {
      this.setStateValue(output, result);
    }
    
    return result;
  }

  /**
   * Memory Primitive - Handles state management operations
   */
  executeMemory({ operation, data }) {
    switch (operation) {
      case 'set':
        Object.entries(data).forEach(([key, value]) => {
          // Resolve value if it's a state reference
          const resolvedValue = this.resolveVariable(value);
          this.stateManager.set(key, resolvedValue);
        });
        return { updated: Object.keys(data) };
      
      case 'get':
        return data.map(key => this.stateManager.get(key));
      
      case 'clear':
        this.stateManager.clear();
        return { cleared: true };
      
      default:
        throw new Error(`Unknown memory operation: ${operation}`);
    }
  }

  /**
   * Wait Primitive - Handles delays
   */
  async executeWait({ duration = 1000, reason }) {
    console.log(`⏳ Waiting ${duration}ms${reason ? `: ${reason}` : ''}`);
    await new Promise(resolve => setTimeout(resolve, duration));
    return { waited: duration };
  }

  /**
   * Sequence Primitive - Executes nodes in order
   */
  async executeSequence({ nodes, name }) {
    console.log(`📋 Executing sequence: ${name || 'unnamed'}`);
    const results = [];
    for (const node of nodes) {
      try {
        const result = await this.execute(node);
        results.push(result);
        // Store last result in state for next node
        this.stateManager.set('lastResult', result);
      } catch (error) {
        console.error(`Error in sequence at node ${results.length}:`, error);
        throw error;
      }
    }
    return results;
  }

  /**
   * Iterate Primitive - Loops over arrays
   */
  async executeIterate({ over, as, body }) {
    console.log(`🔁 Iterating over ${over}`);
    const items = this.resolveVariable(over) || [];
    const results = [];
    
    for (let i = 0; i < items.length; i++) {
      console.log(`  → Processing item ${i + 1}/${items.length}`);
      // Set iteration variables
      this.stateManager.set(as, items[i]);
      this.stateManager.set(`${as}Index`, i);
      
      try {
        const result = await this.executeNode(body);
        results.push(result);
      } catch (error) {
        console.error(`Error in iteration ${i}:`, error);
        // Continue on error for now
      }
    }
    return results;
  }

  /**
   * Route Primitive - Conditional branching
   */
  async executeRoute({ value, paths }) {
    const checkValue = String(this.resolveVariable(value));
    console.log(`🚦 Routing based on ${value} = ${checkValue}`);
    
    const selectedPath = paths[checkValue] || paths['false'] || paths.default;
    if (!selectedPath) {
      throw new Error(`No route found for value: ${checkValue}`);
    }
    
    return await this.execute(selectedPath);
  }

  /**
   * Handle Primitive - Error handling
   */
  async executeHandle({ try: tryNode, catch: catchNode, finally: finallyNode }) {
    console.log(`🛡️ Executing with error handling`);
    try {
      return await this.execute(tryNode);
    } catch (error) {
      console.error('Caught error:', error);
      if (catchNode) {
        return await this.execute(catchNode);
      }
      throw error;
    } finally {
      if (finallyNode) {
        await this.execute(finallyNode);
      }
    }
  }

  /**
   * Helper: Resolve variable from state
   */
  resolveVariable(value) {
    if (typeof value !== 'string') return value;
    
    // Handle template variables
    if (value.includes('{{') && value.includes('}}')) {
      return this.state.resolveTemplate(value);
    }
    
    // Handle state references
    if (value.startsWith('state.')) {
      const path = value.replace('state.', '');
      return this.state.get(path);
    }
    
    return value;
  }

  /**
   * Helper: Convert JSON Schema to Zod schema
   */
  convertJsonSchemaToZod(jsonSchema) {
    // Helper to convert a single JSON schema type to Zod
    const convertType = (schema) => {
      if (!schema || typeof schema !== 'object') {
        return z.any();
      }
      
      switch (schema.type) {
        case 'string':
          return z.string();
        case 'number':
          return z.number();
        case 'boolean':
          return z.boolean();
        case 'array':
          if (schema.items) {
            return z.array(convertType(schema.items));
          }
          return z.array(z.any());
        case 'object':
          if (schema.properties) {
            const shape = {};
            for (const [key, value] of Object.entries(schema.properties)) {
              shape[key] = convertType(value);
            }
            return z.object(shape);
          }
          return z.object({});
        default:
          return z.any();
      }
    };
    
    // Start conversion from the root
    if (typeof jsonSchema === 'object' && !jsonSchema.type) {
      // If the root doesn't have a type, assume it's the properties directly
      const shape = {};
      for (const [key, value] of Object.entries(jsonSchema)) {
        shape[key] = convertType(value);
      }
      return z.object(shape);
    }
    
    return convertType(jsonSchema);
  }

  /**
   * Helper: Set state value (preserves backward compatibility)
   */
  setStateValue(path, value) {
    const key = path.replace('state.', '');
    this.stateManager.set(key, value);
  }

  /**
   * Update dependencies (for managing pages and current page)
   */
  updateDependencies(updates) {
    if (updates.currentPage !== undefined) {
      this.currentPage = updates.currentPage;
    }
    if (updates.pages !== undefined) {
      this.pages = updates.pages;
    }
    if (updates.stagehand !== undefined) {
      this.stagehand = updates.stagehand;
    }
    if (updates.openai !== undefined) {
      this.openai = updates.openai;
    }
  }

  /**
   * Get current state
   */
  getState() {
    return this.stateManager.getAll();
  }
}

