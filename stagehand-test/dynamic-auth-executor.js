import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import config from "./stagehand.config.js";
import { createInterface } from 'readline';

/**
 * Dynamic Auth SOP Executor
 * 
 * This executor allows the AI agent to dynamically request credentials
 * when it encounters login screens, rather than pre-configuring everything.
 */
class DynamicAuthExecutor {
  constructor() {
    this.stagehand = null;
    this.page = null;
    this.executionLog = [];
    this.variables = {};
    this.authCache = {}; // Cache credentials during session
  }

  async init() {
    console.log('🚀 Initializing Stagehand with dynamic authentication...');
    
    const stagehandConfig = {
      modelName: config.llmConfig.modelName,
      modelClientOptions: config.llmConfig.modelClientOptions,
      env: 'LOCAL',
      headless: false,
      devtools: true,
      slowMo: 1000, // Slower for better observation like the visibility test
      localBrowserLaunchOptions: {
        headless: false,
        devtools: true,
        args: [
          // Window management (same as enhanced visibility test)
          '--start-maximized',
          '--start-fullscreen=false',
          '--auto-open-devtools-for-tabs',
          '--new-window',
          '--activate-on-open',
          
          // macOS specific
          '--force-device-scale-factor=1',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-background-media-suspend',
          
          // Visibility and focus
          '--no-first-run',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          
          // Window positioning (same as visibility test)
          '--window-position=100,100',
          '--window-size=1400,900',
          
          // Prevent hiding
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-popup-blocking',
        ],
        viewport: { width: 1400, height: 900 },
        defaultViewport: { width: 1400, height: 900 },
        ignoreDefaultArgs: ['--enable-automation'],
      },
      verbose: 2, // Maximum verbosity like visibility test
      enableCaching: false,
      domSettleTimeoutMs: 30000,
    };
    
    this.stagehand = new Stagehand(stagehandConfig);
    await this.stagehand.init();
    this.page = this.stagehand.page;
    console.log('✅ Stagehand initialized - browser should be visible now!');
    
    // Add extra wait and navigation to ensure visibility like the test
    console.log('⏳ Waiting 3 seconds for browser window to fully appear...');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async close() {
    if (this.stagehand) {
      await this.stagehand.close();
      console.log('🔒 Stagehand closed');
    }
    this.authCache = {}; // Clear auth cache
  }

  /**
   * Prompt user for credentials when needed
   */
  async promptForCredential(service, field, description, mask = false) {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      console.log(`\n🔐 ${service} Authentication Required`);
      console.log('='.repeat(40));
      console.log(`The AI agent encountered a login screen and needs your ${field}.`);
      
      if (mask) {
        process.stdout.write(`${description}: `);
        process.stdin.setRawMode(true);
        process.stdin.resume();
        
        let password = '';
        process.stdin.on('data', (char) => {
          char = char.toString();
          
          if (char === '\n' || char === '\r' || char === '\u0004') {
            process.stdin.setRawMode(false);
            process.stdin.pause();
            process.stdout.write('\n');
            rl.close();
            resolve(password);
          } else if (char === '\u0003') {
            process.stdout.write('\n');
            process.exit(1);
          } else if (char === '\u007f') {
            if (password.length > 0) {
              password = password.slice(0, -1);
              process.stdout.write('\b \b');
            }
          } else {
            password += char;
            process.stdout.write('*');
          }
        });
      } else {
        rl.question(`${description}: `, (answer) => {
          rl.close();
          resolve(answer);
        });
      }
    });
  }

  /**
   * Smart authentication handler - detects login screens and requests credentials
   */
  async handleAuthentication(instruction) {
    // Check if this looks like a login instruction
    const loginKeywords = ['login', 'sign in', 'email', 'password', 'username', 'authenticate'];
    const isLoginStep = loginKeywords.some(keyword => 
      instruction.toLowerCase().includes(keyword)
    );

    if (!isLoginStep) {
      return instruction; // No auth needed, return original instruction
    }

    // Detect which service we're logging into
    let service = 'Unknown Service';
    if (instruction.toLowerCase().includes('gmail') || instruction.toLowerCase().includes('google')) {
      service = 'Gmail';
    } else if (instruction.toLowerCase().includes('airtable')) {
      service = 'Airtable';
    }

    // Check if we need email/username
    if (instruction.includes('{{email}}') || instruction.includes('{{username}}')) {
      if (!this.authCache[`${service}_email`]) {
        const email = await this.promptForCredential(
          service, 
          'email', 
          `${service} Email Address`
        );
        this.authCache[`${service}_email`] = email;
        console.log(`✅ ${service} email cached for this session`);
      }
      instruction = instruction.replace(/\{\{email\}\}/g, this.authCache[`${service}_email`]);
      instruction = instruction.replace(/\{\{username\}\}/g, this.authCache[`${service}_email`]);
    }

    // Check if we need password
    if (instruction.includes('{{password}}')) {
      if (!this.authCache[`${service}_password`]) {
        const password = await this.promptForCredential(
          service, 
          'password', 
          `${service} Password (or App Password)`, 
          true
        );
        this.authCache[`${service}_password`] = password;
        console.log(`✅ ${service} password cached for this session`);
      }
      instruction = instruction.replace(/\{\{password\}\}/g, this.authCache[`${service}_password`]);
    }

    // Check if we need API key
    if (instruction.includes('{{api_key}}')) {
      if (!this.authCache[`${service}_api_key`]) {
        const apiKey = await this.promptForCredential(
          service, 
          'API key', 
          `${service} API Key`, 
          true
        );
        this.authCache[`${service}_api_key`] = apiKey;
        console.log(`✅ ${service} API key cached for this session`);
      }
      instruction = instruction.replace(/\{\{api_key\}\}/g, this.authCache[`${service}_api_key`]);
    }

    return instruction;
  }

  /**
   * Execute a single step with dynamic authentication
   */
  async executeStep(step) {
    const startTime = Date.now();
    console.log(`\n🎯 Executing: ${step.label}`);
    console.log(`   Type: ${step.type}`);
    
    try {
      let result = null;

      switch (step.type) {
        case 'task':
          result = await this.executeTask(step);
          break;
        case 'extract':
          result = await this.executeExtract(step);
          break;
        case 'decision':
          result = await this.executeDecision(step);
          break;
        default:
          console.log(`   ⚠️  Skipping unsupported step type: ${step.type}`);
          result = { success: true, skipped: true };
      }

      const duration = Date.now() - startTime;
      const logEntry = {
        step: step.id,
        label: step.label,
        type: step.type,
        success: result.success,
        duration,
        result,
        timestamp: new Date().toISOString()
      };

      this.executionLog.push(logEntry);

      if (result.success) {
        console.log(`   ✅ Success (${duration}ms)`);
        if (result.data) {
          console.log(`   📊 Data:`, result.data);
        }
      } else {
        console.log(`   ❌ Failed (${duration}ms): ${result.error}`);
      }

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`   💥 Exception (${duration}ms): ${error.message}`);
      
      const logEntry = {
        step: step.id,
        label: step.label,
        type: step.type,
        success: false,
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.executionLog.push(logEntry);
      return { success: false, error: error.message };
    }
  }

  /**
   * Execute a task step with dynamic authentication
   */
  async executeTask(step) {
    if (!step.stagehand_instruction) {
      return { success: false, error: 'No stagehand_instruction provided' };
    }

    // Handle dynamic authentication
    let instruction = await this.handleAuthentication(step.stagehand_instruction);
    
    // Replace other variables
    instruction = this.replaceVariables(instruction);
    
    console.log(`   🤖 AI Instruction: "${instruction}"`);
    
    try {
      await this.page.act(instruction);
      return { success: true, instruction };
    } catch (error) {
      // Try error recovery if available
      if (step.error_recovery && step.error_recovery.length > 0) {
        console.log(`   🔄 Attempting error recovery...`);
        for (const recovery of step.error_recovery) {
          try {
            await this.page.act(recovery);
            await this.page.act(instruction); // Retry original instruction
            return { success: true, instruction, recovered: true };
          } catch (recoveryError) {
            console.log(`   ⚠️  Recovery failed: ${recoveryError.message}`);
          }
        }
      }
      throw error;
    }
  }

  /**
   * Execute an extract step
   */
  async executeExtract(step) {
    if (!step.extract_instruction || !step.extract_schema) {
      return { success: false, error: 'Missing extract_instruction or extract_schema' };
    }

    try {
      // Parse the Zod schema string
      const schemaStr = step.extract_schema;
      let schema;
      
      if (schemaStr.includes('senderName') && schemaStr.includes('senderEmail')) {
        schema = z.object({
          senderName: z.string(),
          senderEmail: z.string().email(),
          subject: z.string(),
          body: z.string()
        });
      } else if (schemaStr.includes('savedSuccessfully')) {
        schema = z.object({
          savedSuccessfully: z.boolean(),
          message: z.string().optional()
        });
      } else {
        schema = z.object({
          data: z.string()
        });
      }

      const result = await this.page.extract({
        instruction: step.extract_instruction,
        schema: schema
      });

      // Store extracted data in variables
      if (result) {
        Object.assign(this.variables, result);
      }

      return { success: true, data: result };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute a decision step
   */
  async executeDecision(step) {
    if (!step.stagehand_instruction) {
      return { success: false, error: 'No stagehand_instruction for decision' };
    }

    try {
      const result = await this.page.extract({
        instruction: step.stagehand_instruction,
        schema: z.object({
          decision: z.boolean(),
          reason: z.string().optional()
        })
      });

      return { success: true, decision: result.decision, reason: result.reason };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Replace variables in instructions
   */
  replaceVariables(instruction) {
    let result = instruction;
    for (const [key, value] of Object.entries(this.variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

  /**
   * Execute a sequence of steps
   */
  async executeSteps(steps) {
    console.log(`\n🎬 Starting execution of ${steps.length} steps...\n`);
    
    const results = [];
    for (const step of steps) {
      const result = await this.executeStep(step);
      results.push(result);
      
      // Stop on failure unless it's a skipped step
      if (!result.success && !result.skipped) {
        console.log(`\n🛑 Stopping execution due to failure in step: ${step.label}`);
        break;
      }
      
      // Small delay between steps
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
  }

  /**
   * Get execution summary
   */
  getExecutionSummary() {
    const total = this.executionLog.length;
    const successful = this.executionLog.filter(log => log.success).length;
    const failed = total - successful;
    const avgDuration = this.executionLog.reduce((sum, log) => sum + log.duration, 0) / total;

    return {
      total,
      successful,
      failed,
      successRate: (successful / total * 100).toFixed(1),
      avgDuration: Math.round(avgDuration),
      log: this.executionLog
    };
  }
}

export default DynamicAuthExecutor; 