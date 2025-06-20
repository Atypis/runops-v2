#!/usr/bin/env node

import { Command } from 'commander';
import { chromium } from 'playwright';
import { Stagehand } from '@browserbasehq/stagehand';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';
import UnifiedExecutor from '../executor/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const program = new Command();

/**
 * Load workflow definition
 */
async function loadWorkflow(workflowId) {
  const workflowPath = join(__dirname, '..', 'definitions', `${workflowId}.js`);
  try {
    const module = await import(workflowPath);
    return module.default || module[workflowId];
  } catch (error) {
    console.error(`❌ Failed to load workflow: ${workflowId}`);
    console.error(error.message);
    process.exit(1);
  }
}

/**
 * Initialize StageHand and OpenAI
 */
async function initialize() {
  console.log('🚀 Initializing StageHand...');
  
  const stagehand = new Stagehand({
    env: 'LOCAL',
    apiKey: process.env.OPENAI_API_KEY,
    modelName: 'gpt-4o-mini',
    headless: false,
    verbose: 1,
    debugDom: true
  });
  
  await stagehand.init();
  
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  console.log('✅ StageHand initialized!');
  
  return { stagehand, openai };
}

/**
 * List available workflows, phases, and nodes
 */
async function listWorkflowComponents(workflowId) {
  const workflow = await loadWorkflow(workflowId);
  
  console.log(`\n📋 Workflow: ${workflow.name}`);
  console.log(`   ID: ${workflow.id}`);
  console.log(`   Version: ${workflow.version}`);
  console.log(`   Description: ${workflow.description}\n`);
  
  if (workflow.phases) {
    console.log('📁 Available Phases:');
    Object.entries(workflow.phases).forEach(([key, phase]) => {
      console.log(`   phase:${key} - ${phase.name}`);
      if (phase.description) {
        console.log(`      ${phase.description}`);
      }
      console.log(`      Nodes: ${phase.nodes.join(', ')}`);
    });
  }
  
  if (workflow.nodes) {
    console.log('\n🔧 Available Nodes:');
    Object.entries(workflow.nodes).forEach(([key, node]) => {
      console.log(`   node:${key} - ${node.description || node.type}`);
    });
  }
}

/**
 * Run workflow with options
 */
async function runWorkflow(workflowId, options) {
  const workflow = await loadWorkflow(workflowId);
  
  // List components if requested
  if (options.list) {
    await listWorkflowComponents(workflowId);
    return;
  }
  
  // Validate workflow if dry run
  if (options.dryRun) {
    console.log('🔍 Validating workflow...');
    const executor = new UnifiedExecutor();
    const validation = executor.validateWorkflow(workflow);
    
    if (validation.valid) {
      console.log('✅ Workflow is valid!');
    } else {
      console.log('❌ Workflow validation failed:');
      validation.errors.forEach(err => console.log(`   - ${err}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      validation.warnings.forEach(warn => console.log(`   - ${warn}`));
    }
    
    return;
  }
  
  // Initialize services
  const { stagehand, openai } = await initialize();
  
  // Create executor
  const executor = new UnifiedExecutor({ stagehand, openai });
  
  // Build run options
  const runOptions = {
    debug: options.debug
  };
  
  // Parse phase/node selections
  if (options.phases) {
    runOptions.only = options.phases.split(',').map(p => `phase:${p.trim()}`);
  } else if (options.nodes) {
    runOptions.only = options.nodes.split(',').map(n => `node:${n.trim()}`);
  } else if (options.only) {
    runOptions.only = options.only.split(',').map(ref => ref.trim());
  }
  
  if (options.start) {
    runOptions.startAt = options.start;
  }
  
  if (options.stop) {
    runOptions.stopAt = options.stop;
  }
  
  // Parse initial state
  if (options.state) {
    try {
      runOptions.state = JSON.parse(options.state);
    } catch (e) {
      console.error('❌ Invalid state JSON:', e.message);
      process.exit(1);
    }
  }
  
  // Run workflow
  console.log(`\n🚀 Running workflow: ${workflow.name}`);
  console.log('━'.repeat(50));
  
  try {
    const startTime = Date.now();
    const results = await executor.run(workflow, runOptions);
    const duration = Date.now() - startTime;
    
    console.log('━'.repeat(50));
    console.log(`\n✅ Workflow completed in ${(duration / 1000).toFixed(2)}s`);
    
    // Show final state if requested
    if (options.showState) {
      console.log('\n📊 Final State:');
      console.log(JSON.stringify(executor.getState(), null, 2));
    }
    
    // Save results if output specified
    if (options.output) {
      const output = {
        workflow: workflow.id,
        timestamp: new Date().toISOString(),
        duration,
        results,
        state: executor.getState(),
        history: options.history ? executor.getHistory() : undefined
      };
      
      await fs.writeFile(options.output, JSON.stringify(output, null, 2));
      console.log(`\n💾 Results saved to: ${options.output}`);
    }
    
  } catch (error) {
    console.error('\n❌ Workflow failed:', error.message);
    if (options.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    // Cleanup
    if (stagehand) {
      await stagehand.page.context().browser().close();
    }
  }
}

// Define CLI
program
  .name('workflow')
  .description('Run workflows with granular control')
  .version('1.0.0');

program
  .argument('<workflow>', 'Workflow ID to run (e.g., gmail-airtable)')
  .option('-l, --list', 'List available phases and nodes')
  .option('-p, --phases <phases>', 'Run specific phases (comma-separated)')
  .option('-n, --nodes <nodes>', 'Run specific nodes (comma-separated)')
  .option('-o, --only <refs>', 'Run only specified refs (e.g., phase:setup,node:extract)')
  .option('--start <ref>', 'Start at specific phase or node')
  .option('--stop <ref>', 'Stop after specific phase or node')
  .option('-d, --debug', 'Enable debug mode (step-by-step)')
  .option('--dry-run', 'Validate workflow without executing')
  .option('-s, --state <json>', 'Initial state as JSON')
  .option('--show-state', 'Show final state after execution')
  .option('--output <file>', 'Save results to file')
  .option('--history', 'Include execution history in output')
  .action(runWorkflow);

// Add list command for all workflows
program
  .command('list')
  .description('List all available workflows')
  .action(async () => {
    const definitionsDir = join(__dirname, '..', 'definitions');
    try {
      const files = await fs.readdir(definitionsDir);
      const workflows = files.filter(f => f.endsWith('.js'));
      
      console.log('\n📚 Available Workflows:');
      for (const file of workflows) {
        const workflowId = path.basename(file, '.js');
        try {
          const workflow = await loadWorkflow(workflowId);
          console.log(`\n   ${workflowId}`);
          console.log(`   Name: ${workflow.name}`);
          console.log(`   Description: ${workflow.description || 'No description'}`);
        } catch (e) {
          console.log(`\n   ${workflowId} (failed to load)`);
        }
      }
    } catch (error) {
      console.error('Failed to list workflows:', error.message);
    }
  });

// Parse arguments
program.parse();

// Show help if no arguments
if (process.argv.length === 2) {
  program.help();
}