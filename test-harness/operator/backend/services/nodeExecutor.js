import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import { supabase } from '../config/supabase.js';

export class NodeExecutor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    this.stagehandInstance = null;
  }

  async getStagehand() {
    if (!this.stagehandInstance) {
      this.stagehandInstance = new Stagehand({
        env: 'LOCAL',
        headless: false,
        enableCaching: true
      });
      await this.stagehandInstance.init();
    }
    return this.stagehandInstance;
  }

  async execute(nodeId, workflowId, options = {}) {
    const { data: node, error } = await supabase
      .from('nodes')
      .select('*')
      .eq('id', nodeId)
      .single();
      
    if (error) throw error;

    // Log execution start
    await this.logExecution(nodeId, workflowId, 'info', 'Node execution started');

    try {
      let result;
      
      switch (node.type) {
        case 'browser_action':
          result = await this.executeBrowserAction(node.params);
          break;
        case 'browser_query':
          result = await this.executeBrowserQuery(node.params);
          break;
        case 'transform':
          result = await this.executeTransform(node.params, options.inputData);
          break;
        case 'cognition':
          result = await this.executeCognition(node.params, options.inputData);
          break;
        case 'memory':
          result = await this.executeMemory(node.params, workflowId);
          break;
        case 'context':
          result = await this.executeContext(node.params, workflowId);
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

  async executeBrowserAction(config) {
    const stagehand = await this.getStagehand();
    const page = stagehand.page;
    const context = page.context();

    switch (config.action) {
      case 'navigate':
        await page.goto(config.url);
        return { navigated: config.url };
        
      case 'click':
        if (config.selector.startsWith('text=')) {
          await stagehand.act({ action: `click on ${config.selector.slice(5)}` });
        } else {
          await page.click(config.selector);
        }
        return { clicked: config.selector };
        
      case 'type':
        if (config.selector.startsWith('text=')) {
          await stagehand.act({ action: `type "${config.text || config.value}" into ${config.selector.slice(5)}` });
        } else {
          await page.type(config.selector, config.text || config.value);
        }
        return { typed: config.text || config.value };
        
      case 'wait':
        await page.waitForTimeout(config.duration || 1000);
        return { waited: config.duration || 1000 };
        
      case 'openNewTab':
        const newPage = await context.newPage();
        if (config.url) {
          await newPage.goto(config.url);
        }
        // Store the page reference if a name is provided
        if (config.name) {
          this.pages = this.pages || {};
          this.pages[config.name] = newPage;
        }
        return { openedTab: config.name || 'unnamed', url: config.url };
        
      case 'switchTab':
        if (this.pages && this.pages[config.tabName]) {
          await this.pages[config.tabName].bringToFront();
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
        
      default:
        throw new Error(`Unknown browser action: ${config.action}`);
    }
  }

  async executeBrowserQuery(config) {
    const stagehand = await this.getStagehand();

    if (config.method === 'extract') {
      // Use StageHand's extract for structured data extraction
      const result = await stagehand.extract({
        instruction: config.instruction,
        schema: config.schema || undefined
      });
      return result;
    } else if (config.method === 'observe') {
      // Use StageHand's observe to find interactive elements
      const result = await stagehand.observe({
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
    switch (config.operation) {
      case 'set':
        await supabase
          .from('workflow_memory')
          .upsert({
            workflow_id: workflowId,
            key: config.key,
            value: config.value
          });
        return { set: config.key };
        
      case 'get':
        const { data } = await supabase
          .from('workflow_memory')
          .select('value')
          .eq('workflow_id', workflowId)
          .eq('key', config.key)
          .single();
        return data?.value || null;
        
      default:
        throw new Error(`Unknown memory operation: ${config.operation}`);
    }
  }

  async executeContext(config, workflowId) {
    // Context is the new name for memory, same functionality
    return this.executeMemory(config, workflowId);
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

  async cleanup() {
    if (this.stagehandInstance) {
      await this.stagehandInstance.close();
      this.stagehandInstance = null;
    }
  }
}