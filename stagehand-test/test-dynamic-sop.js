#!/usr/bin/env node

/**
 * Test Dynamic SOP - Execute with On-Demand Authentication
 * 
 * This script demonstrates a more flexible approach where the AI agent
 * requests credentials dynamically when it encounters login screens,
 * rather than pre-configuring everything upfront.
 */

import DynamicAuthExecutor from './dynamic-auth-executor.js';
import fs from 'fs';
import path from 'path';

async function loadSOP() {
  console.log('📄 Loading Stagehand-optimized SOP...');
  
  const sopPath = './stagehand-optimized-sop.json';
  const fullPath = path.resolve(sopPath);
  
  if (!fs.existsSync(fullPath)) {
    throw new Error('SOP file not found. Please ensure stagehand-optimized-sop.json exists.');
  }
  
  const sopData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  
  // Convert nodes structure to steps for compatibility
  if (sopData.public && sopData.public.nodes) {
    const executableNodes = sopData.public.nodes.filter(node => 
      node.type !== 'trigger' && 
      node.type !== 'end' && 
      node.type !== 'loop' &&
      node.stagehand_instruction
    );
    
    console.log(`🔄 Converted ${sopData.public.nodes.length} nodes to ${executableNodes.length} executable steps`);
    
    return {
      ...sopData,
      steps: executableNodes
    };
  }
  
  return sopData;
}

// Create a simplified SOP with dynamic auth placeholders
function createDynamicAuthSOP() {
  return {
    meta: {
      title: "Dynamic Auth Demo - Gmail to Airtable",
      version: "dynamic-v1.0"
    },
    steps: [
      {
        id: "navigate_gmail",
        type: "task",
        label: "Navigate to Gmail",
        stagehand_instruction: "Navigate to https://mail.google.com",
        confidence_level: "high"
      },
      {
        id: "gmail_login_if_needed",
        type: "task", 
        label: "Login to Gmail if Required",
        stagehand_instruction: "If you see a login screen, enter {{email}} in the email field and click Next, then enter {{password}} in the password field and click Sign In",
        confidence_level: "medium"
      },
      {
        id: "check_inbox",
        type: "extract",
        label: "Check Inbox Status",
        extract_instruction: "Check if the Gmail inbox is visible and count how many unread emails are shown",
        extract_schema: "z.object({inboxVisible: z.boolean(), unreadCount: z.number().optional()})",
        confidence_level: "high"
      },
      {
        id: "open_first_email",
        type: "task",
        label: "Open First Email",
        stagehand_instruction: "Click on the first email in the inbox list to open it",
        confidence_level: "high"
      },
      {
        id: "extract_email_info",
        type: "extract", 
        label: "Extract Email Information",
        extract_instruction: "Extract the sender name, sender email, and subject from the currently open email",
        extract_schema: "z.object({senderName: z.string(), senderEmail: z.string(), subject: z.string()})",
        confidence_level: "medium"
      },
      {
        id: "navigate_airtable",
        type: "task",
        label: "Navigate to Airtable",
        stagehand_instruction: "Open a new tab and navigate to https://airtable.com",
        confidence_level: "high"
      },
      {
        id: "airtable_login_if_needed",
        type: "task",
        label: "Login to Airtable if Required", 
        stagehand_instruction: "If you see a login screen, enter {{email}} in the email field and {{password}} in the password field, then click Sign In",
        confidence_level: "medium"
      },
      {
        id: "verify_airtable_access",
        type: "extract",
        label: "Verify Airtable Access",
        extract_instruction: "Check if you can see the Airtable dashboard with bases or workspaces",
        extract_schema: "z.object({dashboardVisible: z.boolean(), basesCount: z.number().optional()})",
        confidence_level: "high"
      }
    ]
  };
}

async function testDynamicSOP() {
  console.log('🎯 TESTING DYNAMIC AUTHENTICATION SOP');
  console.log('='.repeat(60));
  console.log('🚀 This approach is much more flexible:');
  console.log('   • 🎭 Browser opens immediately (no upfront auth)');
  console.log('   • 🔐 AI requests credentials only when needed');
  console.log('   • 🤖 More natural "conversation" with the AI');
  console.log('   • ⚡ Faster startup and more responsive');
  console.log('='.repeat(60));
  
  const executor = new DynamicAuthExecutor();
  
  try {
    // Initialize browser immediately - no credential setup needed!
    console.log('\n🚀 Initializing browser (no auth required yet)...');
    await executor.init();
    
    console.log('\n🎭 Browser should be visible now!');
    console.log('📺 Watch the AI work - it will ask for credentials when needed');
    console.log('');
    console.log('⏳ Starting in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Load SOP - but use simplified version for demo
    console.log('\n📋 Using simplified dynamic auth demo...');
    const sopData = createDynamicAuthSOP();
    
    console.log(`\n🎬 Executing ${sopData.steps.length} steps with dynamic auth...`);
    console.log('='.repeat(50));
    
    const results = await executor.executeSteps(sopData.steps);
    
    // Show execution summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DYNAMIC SOP EXECUTION COMPLETE!');
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
    
    console.log('\n🎉 BENEFITS OF DYNAMIC AUTH:');
    console.log('✅ No upfront credential setup required');
    console.log('✅ Browser opens immediately for observation');
    console.log('✅ AI requests auth only when encountering login screens');
    console.log('✅ More natural and flexible workflow');
    console.log('✅ Credentials cached for the session');
    
    // Keep browser open for review
    console.log('\n⏳ Keeping browser open for 10 seconds for review...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('\n💥 Dynamic SOP execution failed:', error.message);
    console.log('\n🔧 This is normal for a demo - the AI will request auth when needed!');
  } finally {
    await executor.close();
    console.log('\n🔒 Browser closed. Dynamic auth demo complete!');
  }
}

// Run the dynamic SOP test
testDynamicSOP().catch(console.error); 