const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const executionId = process.argv[2] || 'single-vnc-1750272874948';

(async () => {
  console.log(`🔍 Debugging Memory Data for Execution: ${executionId}\n`);
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Check total memory artifacts
    const { data: allArtifacts, error: allError } = await supabase
      .from('memory_artifacts')
      .select('*')
      .eq('execution_id', executionId);

    if (allError) {
      console.error('❌ Error fetching memory artifacts:', allError);
      return;
    }

    console.log(`📊 Total Memory Artifacts: ${allArtifacts.length}`);
    
    if (allArtifacts.length === 0) {
      console.log('🔍 No memory artifacts found for this execution.');
      return;
    }

    // 2. Check extract_email_candidates specifically
    const extractNode = allArtifacts.find(a => a.node_id === 'extract_email_candidates');
    if (extractNode) {
      console.log('\n🎯 EXTRACT_EMAIL_CANDIDATES Analysis:');
      console.log(`   - Node ID: ${extractNode.node_id}`);
      console.log(`   - Timestamp: ${extractNode.timestamp}`);
      console.log(`   - User ID: ${extractNode.user_id}`);
      
      // Check outputs.extractedData
      if (extractNode.outputs?.extractedData) {
        console.log(`   ✅ extractedData found:`, extractNode.outputs.extractedData);
      } else {
        console.log(`   ❌ extractedData missing in outputs`);
      }
      
      // Check outputs.primaryData
      if (extractNode.outputs?.primaryData) {
        console.log(`   ✅ primaryData found:`, extractNode.outputs.primaryData);
      } else {
        console.log(`   ❌ primaryData missing in outputs`);
      }
      
      // Check processing.llmInteractions for actual data
      if (extractNode.processing?.llmInteractions) {
        console.log(`   🧠 LLM Interactions: ${extractNode.processing.llmInteractions.length}`);
        const assistantResponses = extractNode.processing.llmInteractions.filter(i => i.role === 'assistant');
        if (assistantResponses.length > 0) {
          console.log(`   📝 Assistant Response Sample:`, assistantResponses[0].content.substring(0, 200) + '...');
        }
      }
    } else {
      console.log('\n❌ extract_email_candidates node not found');
    }

    // 3. Check filter_investor_emails
    const filterNode = allArtifacts.find(a => a.node_id === 'filter_investor_emails');
    if (filterNode) {
      console.log('\n🔍 FILTER_INVESTOR_EMAILS Analysis:');
      console.log(`   - Node ID: ${filterNode.node_id}`);
      console.log(`   - Timestamp: ${filterNode.timestamp}`);
      
      // Check if it found input data
      if (filterNode.inputs?.actionInputs) {
        console.log(`   📥 Action Inputs:`, Object.keys(filterNode.inputs.actionInputs));
      }
      
      if (filterNode.outputs?.extractedData) {
        console.log(`   ✅ Filtered data found:`, filterNode.outputs.extractedData);
      }
    } else {
      console.log('\n❌ filter_investor_emails node not found');
    }

    // 4. Show all node IDs for reference
    console.log('\n📋 All Node IDs in Memory:');
    allArtifacts.forEach(artifact => {
      console.log(`   - ${artifact.node_id} (${artifact.timestamp})`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
})(); 