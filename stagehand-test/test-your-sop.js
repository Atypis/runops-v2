#!/usr/bin/env node

/**
 * Test Your SOP - Execute the Investor CRM Workflow
 * 
 * This script loads and executes your actual SOP (latest-sop-v0.8.json)
 * with secure credential management for Gmail and Airtable access.
 */

import SOPExecutor from './sop-executor.js';
import fs from 'fs';
import path from 'path';

async function loadSOP() {
  console.log('📄 Loading your Stagehand-optimized SOP...');
  
  // Try to find the SOP file in various locations
  const possiblePaths = [
    './stagehand-optimized-sop.json',  // Our new optimized SOP
    '../app_frontend/public/latest-sop-v0.8.json',
    '../app_frontend/latest-sop-v0.8.json',
    '../latest-sop-v0.8.json',
    './latest-sop-v0.8.json',
    '../app_frontend/sop-data/latest-sop-v0.8.json'
  ];
  
  for (const sopPath of possiblePaths) {
    try {
      const fullPath = path.resolve(sopPath);
      if (fs.existsSync(fullPath)) {
        console.log(`✅ Found SOP at: ${fullPath}`);
        const sopData = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        
        // Convert nodes structure to steps for compatibility
        if (sopData.public && sopData.public.nodes) {
          // Filter out non-executable nodes (start, end, loop containers)
          const executableNodes = sopData.public.nodes.filter(node => 
            node.type !== 'trigger' && 
            node.type !== 'end' && 
            node.type !== 'loop' &&
            node.stagehand_instruction // Only nodes with actual instructions
          );
          
          console.log(`🔄 Converted ${sopData.public.nodes.length} nodes to ${executableNodes.length} executable steps`);
          
          return {
            ...sopData,
            steps: executableNodes
          };
        }
        
        return sopData;
      }
    } catch (error) {
      console.log(`❌ Could not load SOP from ${sopPath}: ${error.message}`);
    }
  }
  
  throw new Error('Could not find your SOP file. Please ensure the Stagehand-optimized SOP is accessible.');
}

async function testYourSOP() {
  console.log('🎯 TESTING YOUR STAGEHAND-OPTIMIZED INVESTOR CRM SOP');
  console.log('='.repeat(70));
  console.log('📋 This will execute your Stagehand-optimized workflow:');
  console.log('   • 🔬 Atomic granularity steps (47 vs original 12)');
  console.log('   • 📧 Gmail email processing with detailed instructions');
  console.log('   • 🗃️  Airtable data entry with precise selectors');
  console.log('   • 🤖 Complete investor CRM workflow optimized for AI agents');
  console.log('='.repeat(70));
  
  const executor = new SOPExecutor();
  
  try {
    // Load the SOP
    const sopData = await loadSOP();
    console.log(`📊 SOP loaded: ${sopData.steps?.length || 0} steps found`);
    
    // Initialize Stagehand
    console.log('\n🚀 Initializing Stagehand...');
    await executor.init();
    
    // Initialize credentials
    console.log('\n🔐 Setting up credentials...');
    await executor.initCredentials();
    
    console.log('\n🎭 Browser window is now visible!');
    console.log('📺 You can watch the AI agent execute your workflow');
    console.log('');
    console.log('⏳ Starting SOP execution in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Execute the SOP steps
    const steps = sopData.steps || [];
    if (steps.length === 0) {
      throw new Error('No steps found in SOP');
    }
    
    console.log(`\n🎬 Executing ${steps.length} SOP steps...`);
    console.log('='.repeat(50));
    
    const results = await executor.executeSteps(steps);
    
    // Show execution summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 SOP EXECUTION COMPLETE!');
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
    
    if (summary.successRate >= 80) {
      console.log('\n🎉 EXCELLENT! Your SOP executed successfully!');
      console.log('✅ AI agents can reliably execute your recorded workflow');
    } else if (summary.successRate >= 60) {
      console.log('\n⚠️  PARTIAL SUCCESS - Some steps failed');
      console.log('🔧 Consider refining the SOP or adding error recovery');
    } else {
      console.log('\n❌ EXECUTION CHALLENGES - Many steps failed');
      console.log('🔧 The SOP may need optimization for AI agent execution');
    }
    
    // Keep browser open for review
    console.log('\n⏳ Keeping browser open for 10 seconds for review...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    
  } catch (error) {
    console.error('\n💥 SOP execution failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Ensure your SOP file (latest-sop-v0.8.json) is accessible');
    console.log('2. Check your Gmail and Airtable credentials');
    console.log('3. Verify your internet connection');
    console.log('4. Make sure Gmail and Airtable are accessible');
  } finally {
    await executor.close();
    console.log('\n🔒 Browser closed. Test complete!');
  }
}

// Run the SOP test
testYourSOP().catch(console.error); 