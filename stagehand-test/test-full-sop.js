import SOPExecutor from './sop-executor.js';
import fs from 'fs';

/**
 * Test Full SOP Execution
 * 
 * This loads the actual Stagehand-optimized SOP from a JSON file
 * and executes it step by step
 */

async function loadSOPFromFile(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    const sop = JSON.parse(data);
    return sop;
  } catch (error) {
    console.error('Failed to load SOP:', error);
    return null;
  }
}

async function testFullSOP() {
  const executor = new SOPExecutor();
  
  try {
    console.log('🧪 Testing Full Stagehand-optimized SOP\n');
    console.log('=' .repeat(60));
    
    // Load SOP from file (you can save the SOP JSON here)
    const sopPath = './sample-sop.json';
    
    // Create a sample SOP if file doesn't exist
    if (!fs.existsSync(sopPath)) {
      console.log('📝 Creating sample SOP file...');
      const sampleSOP = {
        "meta": {
          "title": "Investor CRM Workflow - Email to Airtable",
          "goal": "Process investor emails and update CRM records",
          "version": "stagehand-optimized-v0.91"
        },
        "public": {
          "nodes": [
            {
              "id": "step_1",
              "type": "task",
              "label": "Navigate to Gmail",
              "stagehand_instruction": "Navigate to https://gmail.com",
              "confidence_level": "high"
            },
            {
              "id": "step_2",
              "type": "decision",
              "label": "Check Gmail login status",
              "stagehand_instruction": "Check if Gmail inbox is visible. Return true if logged in, false if on login page.",
              "confidence_level": "high"
            },
            {
              "id": "step_3",
              "type": "task",
              "label": "Open first unread email",
              "stagehand_instruction": "Click on the first unread email in the inbox",
              "confidence_level": "medium",
              "error_recovery": [
                "Look for emails with bold text indicating unread status",
                "If no unread emails, click on the first email"
              ]
            },
            {
              "id": "step_4",
              "type": "extract",
              "label": "Extract email details",
              "extract_instruction": "Extract the sender name, sender email, subject, and email body text",
              "extract_schema": "z.object({ senderName: z.string(), senderEmail: z.string().email(), subject: z.string(), bodyText: z.string() })",
              "confidence_level": "high"
            },
            {
              "id": "step_5",
              "type": "task",
              "label": "Open new tab for Airtable",
              "stagehand_instruction": "Open a new tab and navigate to https://airtable.com",
              "confidence_level": "high"
            },
            {
              "id": "step_6",
              "type": "decision",
              "label": "Check Airtable login status",
              "stagehand_instruction": "Check if Airtable workspace is visible. Return true if logged in, false if on login page.",
              "confidence_level": "high"
            },
            {
              "id": "step_7",
              "type": "task",
              "label": "Navigate to Investors base",
              "stagehand_instruction": "Click on the 'Investors' base or workspace",
              "confidence_level": "medium",
              "error_recovery": [
                "Look for a base named 'Investors' or 'CRM'",
                "Check if already in the correct base"
              ]
            },
            {
              "id": "step_8",
              "type": "task",
              "label": "Add new record",
              "stagehand_instruction": "Click the '+' button or 'Add record' to create a new row",
              "confidence_level": "high"
            },
            {
              "id": "step_9",
              "type": "task",
              "label": "Fill investor name",
              "stagehand_instruction": "Click in the 'Name' field and enter the sender name: {{senderName}}",
              "confidence_level": "high"
            },
            {
              "id": "step_10",
              "type": "task",
              "label": "Fill investor email",
              "stagehand_instruction": "Click in the 'Email' field and enter the sender email: {{senderEmail}}",
              "confidence_level": "high"
            },
            {
              "id": "step_11",
              "type": "task",
              "label": "Fill email subject",
              "stagehand_instruction": "Click in the 'Last Contact Subject' field and enter: {{subject}}",
              "confidence_level": "medium"
            },
            {
              "id": "step_12",
              "type": "task",
              "label": "Save record",
              "stagehand_instruction": "Press Enter or click outside the fields to save the new record",
              "confidence_level": "high"
            }
          ]
        }
      };
      
      fs.writeFileSync(sopPath, JSON.stringify(sampleSOP, null, 2));
      console.log('✅ Sample SOP created');
    }
    
    const sop = await loadSOPFromFile(sopPath);
    if (!sop) {
      throw new Error('Failed to load SOP');
    }
    
    console.log(`📋 Loaded SOP: ${sop.meta.title}`);
    console.log(`🎯 Goal: ${sop.meta.goal}`);
    console.log(`📊 Steps: ${sop.public.nodes.length}`);
    console.log('');
    
    await executor.init();
    
    // Execute all steps
    const results = await executor.executeSteps(sop.public.nodes);
    
    // Print execution summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 FULL SOP EXECUTION SUMMARY');
    console.log('='.repeat(60));
    
    const summary = executor.getExecutionSummary();
    console.log(`SOP: ${sop.meta.title}`);
    console.log(`Total Steps: ${summary.total}`);
    console.log(`Successful: ${summary.successful}`);
    console.log(`Failed: ${summary.failed}`);
    console.log(`Success Rate: ${summary.successRate}%`);
    console.log(`Average Duration: ${summary.avgDuration}ms`);
    
    console.log('\n📋 STEP-BY-STEP RESULTS:');
    summary.log.forEach((entry, index) => {
      const status = entry.success ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${entry.label} (${entry.duration}ms)`);
      if (entry.error) {
        console.log(`   ❌ Error: ${entry.error}`);
      }
      if (entry.result && entry.result.data) {
        console.log(`   📊 Extracted: ${JSON.stringify(entry.result.data, null, 2)}`);
      }
      if (entry.result && entry.result.recovered) {
        console.log(`   🔄 Recovered from error`);
      }
    });

    console.log('\n🎯 FINAL EXTRACTED VARIABLES:');
    console.log(JSON.stringify(executor.variables, null, 2));
    
    // Analysis
    console.log('\n🔍 ANALYSIS:');
    if (summary.successRate >= 80) {
      console.log('🎉 EXCELLENT: High success rate indicates atomic steps work well with Stagehand!');
    } else if (summary.successRate >= 60) {
      console.log('⚠️  MODERATE: Some steps failed, may need refinement of instructions');
    } else {
      console.log('❌ POOR: Many steps failed, prompt optimization needed');
    }
    
    const failedSteps = summary.log.filter(log => !log.success);
    if (failedSteps.length > 0) {
      console.log('\n🔧 FAILED STEPS TO INVESTIGATE:');
      failedSteps.forEach(step => {
        console.log(`- ${step.label}: ${step.error}`);
      });
    }
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  } finally {
    await executor.close();
  }
}

// Run the test
testFullSOP().catch(console.error); 