const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugSpecificMemory() {
  console.log('🔍 Debug: Specific Memory Artifact Investigation\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Get the most recent memory artifact
    const { data: recentArtifact, error } = await supabase
      .from('memory_artifacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.log(`❌ Failed to fetch artifact: ${error.message}`);
      return;
    }

    console.log('📊 Recent Memory Artifact:');
    console.log(`   ID: ${recentArtifact.id}`);
    console.log(`   Execution: ${recentArtifact.execution_id}`);
    console.log(`   Node: ${recentArtifact.node_id}`);
    console.log(`   User: ${recentArtifact.user_id}`);
    console.log(`   Created: ${recentArtifact.created_at}`);

    console.log('\n📥 INPUTS:');
    if (recentArtifact.inputs) {
      const inputs = recentArtifact.inputs;
      console.log(`   Previous State: ${Object.keys(inputs.previousState || {}).length} keys`);
      console.log(`   Node Variables: ${Object.keys(inputs.nodeVariables || {}).length} keys`);
      console.log(`   Credentials: ${Object.keys(inputs.credentials || {}).length} keys`);
      
      if (inputs.environment) {
        console.log(`   Current URL: ${inputs.environment.currentUrl || 'none'}`);
        console.log(`   DOM Snapshot: ${inputs.environment.domSnapshot ? (inputs.environment.domSnapshot.length / 1024).toFixed(1) + 'KB' : 'none'}`);
        console.log(`   Active Tab: ${inputs.environment.activeTab || 'none'}`);
      }
      
      if (inputs.actionInputs) {
        console.log(`   Instruction: ${inputs.actionInputs.instruction || 'none'}`);
        console.log(`   Target: ${inputs.actionInputs.target || 'none'}`);
      }
    } else {
      console.log('   ❌ No inputs captured');
    }

    console.log('\n⚙️ PROCESSING:');
    if (recentArtifact.processing) {
      const processing = recentArtifact.processing;
      console.log(`   LLM Interactions: ${processing.llmInteractions?.length || 0}`);
      console.log(`   Actions: ${processing.actions?.length || 0}`);
      console.log(`   Browser Events: ${processing.browserEvents?.length || 0}`);
      console.log(`   Errors: ${processing.errors?.length || 0}`);
      
      if (processing.llmInteractions?.length > 0) {
        console.log('\n   📝 LLM Conversations:');
        processing.llmInteractions.forEach((interaction, i) => {
          console.log(`     ${i + 1}. ${interaction.role}: ${(interaction.content || '').substring(0, 100)}...`);
        });
      }
    } else {
      console.log('   ❌ No processing captured');
    }

    console.log('\n📤 OUTPUTS:');
    if (recentArtifact.outputs) {
      const outputs = recentArtifact.outputs;
      console.log(`   Primary Data: ${outputs.primaryData ? 'Present' : 'None'}`);
      console.log(`   State Changes: ${Object.keys(outputs.stateChanges || {}).length} keys`);
      console.log(`   Extracted Data: ${Object.keys(outputs.extractedData || {}).length} keys`);
      
      if (outputs.executionMetadata) {
        console.log(`   Status: ${outputs.executionMetadata.status}`);
        console.log(`   Duration: ${outputs.executionMetadata.duration}ms`);
      }
    } else {
      console.log('   ❌ No outputs captured');
    }

    console.log('\n🔗 FORWARDING RULES:');
    if (recentArtifact.forwarding_rules) {
      const rules = recentArtifact.forwarding_rules;
      console.log(`   Forward to Next: ${rules.forwardToNext?.length || 0} keys`);
      console.log(`   Keep in Loop: ${rules.keepInLoop?.length || 0} keys`);
      console.log(`   Compress Large Data: ${rules.compressLargeData ? 'Yes' : 'No'}`);
    } else {
      console.log('   ❌ No forwarding rules captured');
    }

  } catch (error) {
    console.error('💥 Debug failed:', error.message);
  }
}

debugSpecificMemory().catch(console.error); 