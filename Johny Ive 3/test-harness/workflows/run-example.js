#!/usr/bin/env node

/**
 * Example script showing how to use the UnifiedExecutor programmatically
 */

import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import UnifiedExecutor from './executor/index.js';
import gmailAirtableWorkflow from './definitions/gmail-airtable.js';
import dotenv from 'dotenv';

dotenv.config();

async function runExamples() {
  // Initialize services
  console.log('🚀 Initializing services...');
  const stagehand = new Stagehand({
    env: 'LOCAL',
    apiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4o-mini',
    headless: false,
    verbose: 1
  });
  
  await stagehand.init();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  // Create executor
  const executor = new UnifiedExecutor({ stagehand, openai });
  
  console.log('\n📚 Example 1: Run only the setup phase');
  console.log('━'.repeat(50));
  
  // Example 1: Run just the setup phase
  await executor.run(gmailAirtableWorkflow, {
    only: ['phase:setupPlatforms']
  });
  
  console.log('\n✅ Setup complete! Current state:');
  console.log(executor.getState());
  
  console.log('\n📚 Example 2: Run a single node');
  console.log('━'.repeat(50));
  
  // Example 2: Run a single node
  await executor.runNode(gmailAirtableWorkflow, 'navigateGmail');
  
  console.log('\n📚 Example 3: Run with range');
  console.log('━'.repeat(50));
  
  // Example 3: Run from extractEmails to the end
  await executor.run(gmailAirtableWorkflow, {
    startAt: 'phase:extractEmails'
  });
  
  console.log('\n📚 Example 4: Debug mode for a phase');
  console.log('━'.repeat(50));
  
  // Example 4: Debug mode
  await executor.run(gmailAirtableWorkflow, {
    only: ['phase:extractEmails'],
    debug: true
  });
  
  console.log('\n📚 Example 5: Validate workflow');
  console.log('━'.repeat(50));
  
  // Example 5: Validate
  const validation = executor.validateWorkflow(gmailAirtableWorkflow);
  console.log('Validation result:', validation);
  
  // Cleanup
  await stagehand.page.context().browser().close();
  
  console.log('\n✨ Examples complete!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runExamples().catch(console.error);
}

export { runExamples };