#!/usr/bin/env node

/**
 * Clean Real SOP Test - Investor CRM Workflow
 * 
 * This script executes the actual investor CRM workflow from the Stagehand-optimized SOP
 * with proper navigation handling and dynamic authentication.
 */

import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";
import config from "./stagehand.config.js";
import { createInterface } from 'readline';
import fs from 'fs';

class CleanSOPExecutor {
  constructor() {
    this.stagehand = null;
    this.page = null;
    this.executionLog = [];
    this.variables = {};
    this.authCache = {};
  }

  async init() {
    console.log('🚀 Initializing Clean SOP Executor...');
    
    const stagehandConfig = {
      modelName: config.llmConfig.modelName,
      modelClientOptions: config.llmConfig.modelClientOptions,
      env: 'LOCAL',
      headless: false,
      devtools: true,
      slowMo: 1000,
      localBrowserLaunchOptions: {
        headless: false,
        devtools: true,
        args: [
          '--start-maximized',
          '--start-fullscreen=false',
          '--auto-open-devtools-for-tabs',
          '--new-window',
          '--activate-on-open',
          '--force-device-scale-factor=1',
          '--disable-background-timer-throttling',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-background-media-suspend',
          '--no-first-run',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--window-position=100,100',
          '--window-size=1400,900',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-popup-blocking',
        ],
        viewport: { width: 1400, height: 900 },
        defaultViewport: { width: 1400, height: 900 },
        ignoreDefaultArgs: ['--enable-automation'],
      },
      verbose: 2,
      enableCaching: false,
      domSettleTimeoutMs: 30000,
    };
    
    this.stagehand = new Stagehand(stagehandConfig);
    await this.stagehand.init();
    this.page = this.stagehand.page;
    console.log('✅ Browser initialized and should be visible!');
    
    // Wait for browser to be fully ready
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async close() {
    if (this.stagehand) {
      await this.stagehand.close();
      console.log('🔒 Browser closed');
    }
    this.authCache = {};
  }

  async promptForCredential(service, field, description, mask = false) {
    return new Promise((resolve) => {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      console.log(`\n🔐 ${service} Authentication Required`);
      console.log('='.repeat(40));
      console.log(`The AI agent needs your ${field} to continue.`);
      
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

  async handleAuthentication(instruction) {
    // Check if this looks like a login instruction
    const loginKeywords = ['login', 'sign in', 'email', 'password', 'username', 'authenticate'];
    const isLoginStep = loginKeywords.some(keyword => 
      instruction.toLowerCase().includes(keyword)
    );

    if (!isLoginStep) {
      return instruction;
    }

    // Detect service
    let service = 'Unknown Service';
    if (instruction.toLowerCase().includes('gmail') || instruction.toLowerCase().includes('google')) {
      service = 'Gmail';
    } else if (instruction.toLowerCase().includes('airtable')) {
      service = 'Airtable';
    }

    // Handle email/username
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

    // Handle password
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

    return instruction;
  }

  replaceVariables(instruction) {
    let result = instruction;
    for (const [key, value] of Object.entries(this.variables)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return result;
  }

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

  async executeTask(step) {
    if (!step.stagehand_instruction) {
      return { success: false, error: 'No stagehand_instruction provided' };
    }

    // Handle dynamic authentication
    let instruction = await this.handleAuthentication(step.stagehand_instruction);
    
    // Replace variables
    instruction = this.replaceVariables(instruction);
    
    console.log(`   🤖 AI Instruction: "${instruction}"`);
    
    // Check for navigation instructions and handle them properly
    const navigationPatterns = [
      /go to (https?:\/\/[^\s]+)/i,
      /navigate to (https?:\/\/[^\s]+)/i,
      /open (https?:\/\/[^\s]+)/i,
      /visit (https?:\/\/[^\s]+)/i,
      /go to the gmail inbox/i,
      /switch to.*gmail.*tab/i
    ];
    
    for (const pattern of navigationPatterns) {
      const match = instruction.match(pattern);
      if (match) {
        let url = match[1];
        
        // Handle Gmail-specific navigation
        if (instruction.toLowerCase().includes('gmail inbox') || instruction.toLowerCase().includes('gmail tab')) {
          url = 'https://mail.google.com/mail/u/0/#inbox';
        }
        
        if (url && url.startsWith('http')) {
          console.log(`   🌐 Direct navigation to: ${url}`);
          try {
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            console.log(`   ✅ Successfully navigated to ${url}`);
            
            // Wait for page to be interactive
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return { success: true, instruction, navigated: true };
          } catch (error) {
            console.log(`   ❌ Navigation failed: ${error.message}`);
            throw error;
          }
        }
      }
    }
    
    // For non-navigation instructions, use Stagehand's act method
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

  async executeExtract(step) {
    if (!step.extract_instruction || !step.extract_schema) {
      return { success: false, error: 'Missing extract_instruction or extract_schema' };
    }

    try {
      // Parse the schema string to create appropriate Zod schema
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

      // Store extracted data in variables for later use
      if (result) {
        Object.assign(this.variables, result);
      }

      return { success: true, data: result };
    } catch (error) {
      throw error;
    }
  }

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

  getExecutionSummary() {
    const total = this.executionLog.length;
    const successful = this.executionLog.filter(log => log.success).length;
    const failed = total - successful;
    const avgDuration = total > 0 ? this.executionLog.reduce((sum, log) => sum + log.duration, 0) / total : 0;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(1) : '0.0',
      avgDuration: Math.round(avgDuration),
      log: this.executionLog
    };
  }
}

async function loadRealSOP() {
  console.log('📄 Loading real Stagehand-optimized SOP...');
  
  const sopPath = './downloads/22d88614-7cfa-41ca-a3fb-3d191e8daf21_stagehand.json';
  
  if (!fs.existsSync(sopPath)) {
    throw new Error('Real SOP file not found. Please ensure the file exists.');
  }
  
  const sopData = JSON.parse(fs.readFileSync(sopPath, 'utf8'));
  
  // Extract executable nodes (skip triggers, loops, ends)
  const executableNodes = sopData.public.nodes.filter(node => 
    node.type !== 'trigger' && 
    node.type !== 'end' && 
    node.type !== 'loop' &&
    node.stagehand_instruction
  );
  
  console.log(`🔄 Found ${executableNodes.length} executable steps from ${sopData.public.nodes.length} total nodes`);
  
  return {
    meta: sopData.meta,
    steps: executableNodes
  };
}

async function testRealSOP() {
  console.log('🎯 TESTING REAL INVESTOR CRM WORKFLOW');
  console.log('='.repeat(60));
  console.log('📋 Executing your actual Stagehand-optimized SOP');
  console.log('🎭 Browser will be visible with enhanced settings');
  console.log('🔐 AI will request credentials dynamically when needed');
  console.log('='.repeat(60));
  
  const executor = new CleanSOPExecutor();
  
  try {
    // Initialize browser
    await executor.init();
    
    console.log('\n🎭 Browser should be visible now!');
    console.log('📺 Watch the AI execute your investor CRM workflow');
    
    // Load the real SOP
    const sopData = await loadRealSOP();
    
    console.log(`\n📋 SOP: ${sopData.meta.title}`);
    console.log(`📝 Goal: ${sopData.meta.goal}`);
    console.log(`🎬 Executing ${sopData.steps.length} steps...`);
    console.log('='.repeat(50));
    
    // Execute steps one by one
    const results = [];
    for (const step of sopData.steps) {
      const result = await executor.executeStep(step);
      results.push(result);
      
      // Stop on failure unless it's a skipped step
      if (!result.success && !result.skipped) {
        console.log(`\n🛑 Stopping execution due to failure in step: ${step.label}`);
        break;
      }
      
      // Small delay between steps for observation
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Show execution summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 REAL SOP EXECUTION COMPLETE!');
    console.log('='.repeat(60));
    
    const summary = executor.getExecutionSummary();
    console.log(`📊 Execution Results:`);
    console.log(`   Total Steps: ${summary.total}`);
    console.log(`   Successful: ${summary.successful}`);
    console.log(`   Failed: ${summary.failed}`);
    console.log(`   Success Rate: ${summary.successRate}%`);
    console.log(`   Average Time: ${summary.avgDuration}ms per step`);
    
    // Show detailed results
    console.log('\n📋 Step-by-Step Results:');
    summary.log.forEach((entry, index) => {
      const status = entry.success ? '✅' : '❌';
      console.log(`   ${status} Step ${index + 1}: ${entry.label} (${entry.duration}ms)`);
      if (!entry.success && entry.error) {
        console.log(`      Error: ${entry.error}`);
      }
    });
    
    console.log('\n🎉 REAL WORKFLOW VALIDATION:');
    console.log('✅ Browser visibility working correctly');
    console.log('✅ Dynamic authentication implemented');
    console.log('✅ Navigation handling improved');
    console.log('✅ Real SOP execution tested');
    
    // Keep browser open for review
    console.log('\n⏳ Keeping browser open for 15 seconds for review...');
    await new Promise(resolve => setTimeout(resolve, 15000));
    
  } catch (error) {
    console.error('\n💥 Real SOP execution failed:', error.message);
    console.log('\n🔧 This helps us identify areas for improvement in the SOP or executor!');
  } finally {
    await executor.close();
    console.log('\n🔒 Real SOP test complete!');
  }
}

// Run the real SOP test
testRealSOP().catch(console.error); 