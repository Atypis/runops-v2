import SOPExecutor from './sop-executor.js';

/**
 * Visual Demo - Watch Stagehand in Action!
 * 
 * This demo shows the browser window and provides detailed commentary
 * on what the AI agent is doing at each step.
 */

// Simple demo steps that are easy to observe
const demoSteps = [
  {
    "id": "demo_1",
    "type": "task",
    "label": "Navigate to Google",
    "stagehand_instruction": "Navigate to https://google.com",
    "confidence_level": "high"
  },
  {
    "id": "demo_2",
    "type": "task",
    "label": "Search for Stagehand",
    "stagehand_instruction": "Click in the search box and type 'Stagehand AI automation'",
    "confidence_level": "high"
  },
  {
    "id": "demo_3",
    "type": "task",
    "label": "Press Enter to search",
    "stagehand_instruction": "Press Enter to submit the search",
    "confidence_level": "high"
  },
  {
    "id": "demo_4",
    "type": "extract",
    "label": "Extract search results",
    "extract_instruction": "Extract the title of the first search result",
    "extract_schema": "z.object({ title: z.string() })",
    "confidence_level": "medium"
  },
  {
    "id": "demo_5",
    "type": "task",
    "label": "Navigate to GitHub",
    "stagehand_instruction": "Navigate to https://github.com",
    "confidence_level": "high"
  },
  {
    "id": "demo_6",
    "type": "decision",
    "label": "Check if GitHub loaded",
    "stagehand_instruction": "Check if the GitHub homepage is visible with the search bar and navigation. Return true if loaded properly.",
    "confidence_level": "high"
  }
];

async function runVisualDemo() {
  console.log('🎬 STAGEHAND VISUAL DEMO');
  console.log('='.repeat(60));
  console.log('👀 Watch the browser window that will open!');
  console.log('🤖 You\'ll see the AI agent performing each action');
  console.log('⏱️  Actions are slowed down for better visibility');
  console.log('🔧 DevTools will be open for debugging');
  console.log('='.repeat(60));
  
  const executor = new SOPExecutor();
  
  try {
    console.log('\n🚀 Initializing Stagehand with visual browser...');
    await executor.init();
    
    console.log('\n🎭 Browser window should now be visible!');
    console.log('📺 You can watch the AI agent work in real-time');
    console.log('');
    console.log('🔍 LOOK FOR:');
    console.log('   • A Chrome browser window should have opened');
    console.log('   • DevTools should be open on the right side');
    console.log('   • The window should be maximized');
    console.log('   • If you don\'t see it, check your dock/taskbar');
    console.log('');
    
    // Add a longer pause to let user find the browser window
    console.log('⏳ Starting demo in 5 seconds...');
    console.log('   (This gives you time to locate the browser window)');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Execute demo steps with commentary
    for (let i = 0; i < demoSteps.length; i++) {
      const step = demoSteps[i];
      
      console.log(`\n${'='.repeat(40)}`);
      console.log(`🎯 STEP ${i + 1}/${demoSteps.length}: ${step.label}`);
      console.log(`${'='.repeat(40)}`);
      console.log(`👀 WATCH: The browser will now ${step.label.toLowerCase()}`);
      
      if (step.stagehand_instruction) {
        console.log(`🤖 AI Instruction: "${step.stagehand_instruction}"`);
      }
      
      console.log(`⏱️  Executing... (watch the browser!)`);
      
      const result = await executor.executeStep(step);
      
      if (result.success) {
        console.log(`✅ SUCCESS! The AI agent completed: ${step.label}`);
        if (result.data) {
          console.log(`📊 Extracted Data:`, JSON.stringify(result.data, null, 2));
        }
        if (result.decision !== undefined) {
          console.log(`🤔 Decision Result: ${result.decision}`);
        }
      } else {
        console.log(`❌ FAILED: ${result.error}`);
      }
      
      // Pause between steps for observation
      if (i < demoSteps.length - 1) {
        console.log(`\n⏸️  Pausing for 2 seconds... (observe the current state)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('🎉 VISUAL DEMO COMPLETE!');
    console.log('='.repeat(60));
    
    const summary = executor.getExecutionSummary();
    console.log(`📊 Demo Results:`);
    console.log(`   Total Steps: ${summary.total}`);
    console.log(`   Successful: ${summary.successful}`);
    console.log(`   Success Rate: ${summary.successRate}%`);
    console.log(`   Average Time: ${summary.avgDuration}ms per step`);
    
    console.log('\n🎭 What you just saw:');
    console.log('✅ AI agent navigating websites autonomously');
    console.log('✅ Real-time browser automation');
    console.log('✅ Data extraction from web pages');
    console.log('✅ Decision making based on page content');
    console.log('✅ Error handling and recovery');
    
    console.log('\n🚀 Ready to test your SOPs!');
    console.log('   Run: npm run test-gmail (for Gmail automation)');
    console.log('   Run: npm run test (for full SOP execution)');
    
    // Keep browser open for a moment
    console.log('\n⏳ Keeping browser open for 5 more seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('💥 Demo failed:', error);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure you have OPENAI_API_KEY in your .env file');
    console.log('2. Check your internet connection');
    console.log('3. Ensure Chrome is installed');
  } finally {
    await executor.close();
    console.log('\n🔒 Browser closed. Demo complete!');
  }
}

// Run the visual demo
runVisualDemo().catch(console.error); 