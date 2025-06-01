import SOPExecutor from './sop-executor.js';
import fs from 'fs';

/**
 * Model Comparison Test
 * 
 * This script tests the same SOP steps with different LLM models
 * to compare their performance and reliability.
 */

// Simple test steps for model comparison
const comparisonSteps = [
  {
    "id": "comp_1",
    "type": "task",
    "label": "Navigate to example.com",
    "stagehand_instruction": "Navigate to https://example.com",
    "confidence_level": "high"
  },
  {
    "id": "comp_2",
    "type": "extract",
    "label": "Extract page title",
    "extract_instruction": "Extract the main heading text from the page",
    "extract_schema": "z.object({ title: z.string() })",
    "confidence_level": "high"
  },
  {
    "id": "comp_3",
    "type": "decision",
    "label": "Check if page loaded correctly",
    "stagehand_instruction": "Check if the page shows 'Example Domain' and has proper content. Return true if loaded correctly.",
    "confidence_level": "high"
  }
];

async function testModel(modelProvider, modelName) {
  console.log(`\n🤖 Testing Model: ${modelName} (${modelProvider})`);
  console.log('='.repeat(50));
  
  // Temporarily set environment variables for this test
  const originalProvider = process.env.LLM_PROVIDER;
  process.env.LLM_PROVIDER = modelProvider;
  
  const executor = new SOPExecutor();
  
  try {
    await executor.init();
    
    const startTime = Date.now();
    const results = await executor.executeSteps(comparisonSteps);
    const totalTime = Date.now() - startTime;
    
    const summary = executor.getExecutionSummary();
    
    return {
      model: modelName,
      provider: modelProvider,
      successRate: parseFloat(summary.successRate),
      totalTime,
      avgStepTime: summary.avgDuration,
      successful: summary.successful,
      failed: summary.failed,
      details: summary.log
    };
    
  } catch (error) {
    console.log(`❌ Model ${modelName} failed: ${error.message}`);
    return {
      model: modelName,
      provider: modelProvider,
      successRate: 0,
      totalTime: 0,
      avgStepTime: 0,
      successful: 0,
      failed: comparisonSteps.length,
      error: error.message
    };
  } finally {
    await executor.close();
    // Restore original provider
    process.env.LLM_PROVIDER = originalProvider;
  }
}

async function runModelComparison() {
  console.log('🏆 STAGEHAND MODEL COMPARISON TEST');
  console.log('='.repeat(60));
  console.log('Testing different LLM models on the same SOP tasks');
  console.log('This helps determine which model works best for your workflows');
  console.log('='.repeat(60));
  
  // Define models to test (only test if API keys are available)
  const modelsToTest = [];
  
  if (process.env.OPENAI_API_KEY) {
    modelsToTest.push({ provider: 'openai', name: 'gpt-4o' });
    modelsToTest.push({ provider: 'openai', name: 'gpt-4o-mini' });
  }
  
  if (process.env.ANTHROPIC_API_KEY) {
    modelsToTest.push({ provider: 'anthropic', name: 'claude-3-5-sonnet-20241022' });
    modelsToTest.push({ provider: 'anthropic', name: 'claude-3-haiku-20240307' });
  }
  
  if (process.env.GOOGLE_API_KEY) {
    modelsToTest.push({ provider: 'google', name: 'gemini-2.5-flash-preview-05-20' });
    modelsToTest.push({ provider: 'google', name: 'gemini-1.5-pro' });
    modelsToTest.push({ provider: 'google', name: 'gemini-1.5-flash' });
  }
  
  // Check for Ollama (local models)
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (response.ok) {
      modelsToTest.push({ provider: 'ollama', name: 'llama3.1:8b' });
    }
  } catch (error) {
    console.log('ℹ️  Ollama not detected (local models unavailable)');
  }
  
  if (modelsToTest.length === 0) {
    console.log('❌ No API keys found! Please add at least one:');
    console.log('   - OPENAI_API_KEY');
    console.log('   - ANTHROPIC_API_KEY'); 
    console.log('   - GOOGLE_API_KEY');
    console.log('   - Or install Ollama for local models');
    return;
  }
  
  console.log(`\n🎯 Testing ${modelsToTest.length} models on ${comparisonSteps.length} steps each\n`);
  
  const results = [];
  
  for (const model of modelsToTest) {
    try {
      const result = await testModel(model.provider, model.name);
      results.push(result);
      
      console.log(`✅ ${model.name}: ${result.successRate}% success rate`);
    } catch (error) {
      console.log(`❌ ${model.name}: Test failed - ${error.message}`);
    }
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Generate comparison report
  console.log('\n' + '='.repeat(60));
  console.log('📊 MODEL COMPARISON RESULTS');
  console.log('='.repeat(60));
  
  // Sort by success rate
  results.sort((a, b) => b.successRate - a.successRate);
  
  console.log('\n🏆 RANKING BY SUCCESS RATE:');
  results.forEach((result, index) => {
    const rank = index + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
    console.log(`${medal} ${result.model} (${result.provider})`);
    console.log(`   Success Rate: ${result.successRate}%`);
    console.log(`   Avg Step Time: ${result.avgStepTime}ms`);
    console.log(`   Total Time: ${result.totalTime}ms`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
    console.log('');
  });
  
  // Performance analysis
  const bestModel = results[0];
  if (bestModel && bestModel.successRate > 0) {
    console.log('🎯 RECOMMENDATIONS:');
    console.log(`✅ Best Overall: ${bestModel.model} (${bestModel.successRate}% success)`);
    
    const fastestModel = results.reduce((fastest, current) => 
      current.avgStepTime < fastest.avgStepTime ? current : fastest
    );
    console.log(`⚡ Fastest: ${fastestModel.model} (${fastestModel.avgStepTime}ms avg)`);
    
    const mostReliable = results.filter(r => r.successRate === 100);
    if (mostReliable.length > 0) {
      console.log(`🛡️  Most Reliable: ${mostReliable.map(r => r.model).join(', ')} (100% success)`);
    }
  }
  
  // Save results to file
  const reportPath = './model-comparison-results.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    testSteps: comparisonSteps.length,
    results: results
  }, null, 2));
  
  console.log(`\n📄 Detailed results saved to: ${reportPath}`);
  console.log('\n🚀 Use the best-performing model for your SOP execution!');
}

// Run the comparison
runModelComparison().catch(console.error); 