#!/usr/bin/env node

import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import UnifiedExecutor from './workflows/executor/index.js';
import workflow from './workflows/definitions/gmail-airtable-advanced.js';

dotenv.config();

async function testWorkflow() {
  let stagehand = null;
  
  try {
    console.log('🚀 Starting Gmail to Airtable workflow test...\n');
    
    // Initialize Stagehand
    console.log('📋 Initializing Stagehand...');
    stagehand = new Stagehand({
      env: 'LOCAL',
      apiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini',
      headless: false,
      verbose: 1,
      debugDom: true
    });
    
    await stagehand.init();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    // Create executor
    const executor = new UnifiedExecutor({ 
      stagehand, 
      openai,
      pages: { main: stagehand.page },
      currentPage: stagehand.page
    });
    
    console.log('✅ Stagehand initialized!\n');
    
    // Test different execution modes
    const testMode = process.argv[2] || 'full';
    
    switch (testMode) {
      case 'auth':
        console.log('🔐 Testing authentication flows only...');
        const authResult = await executor.run(workflow, {
          only: ['phase:gmailAuth', 'phase:airtableAuth']
        });
        console.log('\nAuth Result:', JSON.stringify(authResult, null, 2));
        break;
        
      case 'extract':
        console.log('📧 Testing email extraction only...');
        const extractResult = await executor.run(workflow, {
          only: ['phase:emailExtraction']
        });
        console.log('\nExtraction Result:', JSON.stringify(extractResult, null, 2));
        break;
        
      case 'single':
        console.log('🔧 Testing single node execution...');
        const nodeName = process.argv[3] || 'navigateGmail';
        const nodeResult = await executor.run(workflow, {
          only: [`node:${nodeName}`]
        });
        console.log(`\nNode ${nodeName} Result:`, JSON.stringify(nodeResult, null, 2));
        break;
        
      case 'debug':
        console.log('🐛 Running in debug mode with breakpoints...');
        const debugResult = await executor.run(workflow, {
          debug: true,
          stopAt: 'phase:emailExtraction'
        });
        console.log('\nDebug Result:', JSON.stringify(debugResult, null, 2));
        break;
        
      case 'full':
      default:
        console.log('🚀 Running full workflow...');
        const fullResult = await executor.run(workflow);
        console.log('\nFull Result:', JSON.stringify(fullResult, null, 2));
        break;
    }
    
    // Show final state
    console.log('\n📊 Final State:');
    console.log(JSON.stringify(executor.getState(), null, 2));
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    if (stagehand) {
      console.log('\n🧹 Cleaning up...');
      await stagehand.close();
    }
  }
}

// Usage instructions
if (process.argv.includes('--help')) {
  console.log(`
Gmail to Airtable Workflow Test Script

Usage: node test-gmail-airtable.js [mode] [options]

Modes:
  full    - Run the complete workflow (default)
  auth    - Test only authentication flows
  extract - Test only email extraction
  single  - Test a single node (specify node name as second argument)
  debug   - Run with debug breakpoints

Examples:
  node test-gmail-airtable.js                    # Run full workflow
  node test-gmail-airtable.js auth               # Test auth only
  node test-gmail-airtable.js single navigateGmail  # Test single node
  node test-gmail-airtable.js debug              # Debug mode
`);
  process.exit(0);
}

// Run the test
testWorkflow().catch(console.error);