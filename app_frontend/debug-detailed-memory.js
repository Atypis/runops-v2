const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function debugDetailedMemory() {
  console.log('🔍 Debug: Detailed Memory Artifact Content\n');

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
    console.log(`   Created: ${recentArtifact.created_at}\n`);

    // Parse and display inputs in detail
    const inputs = recentArtifact.inputs || {};
    console.log('📥 DETAILED INPUTS:');
    console.log('   Previous State:', JSON.stringify(inputs.previousState || {}, null, 2));
    console.log('   Node Variables:', JSON.stringify(inputs.nodeVariables || {}, null, 2));
    console.log('   Credentials:', JSON.stringify(inputs.credentials || {}, null, 2));
    
    if (inputs.environment) {
      console.log('   Environment:');
      console.log(`     Current URL: ${inputs.environment.currentUrl || 'none'}`);
      console.log(`     DOM Snapshot: ${inputs.environment.domSnapshot ? inputs.environment.domSnapshot.substring(0, 200) + '...' : 'none'}`);
      console.log(`     Session State: ${JSON.stringify(inputs.environment.sessionState || {}, null, 2)}`);
    }
    
    if (inputs.actionInputs) {
      console.log('   Action Inputs:');
      console.log(`     Instruction: ${inputs.actionInputs.instruction || 'none'}`);
      console.log(`     Data: ${JSON.stringify(inputs.actionInputs.data || {}, null, 2)}`);
      console.log(`     Config: ${JSON.stringify(inputs.actionInputs.config || {}, null, 2)}`);
    }

    // Parse and display processing in detail
    const processing = recentArtifact.processing || {};
    console.log('\n⚙️ DETAILED PROCESSING:');
    console.log(`   LLM Interactions: ${(processing.llmInteractions || []).length}`);
    console.log(`   Actions: ${(processing.actions || []).length}`);
    if (processing.actions && processing.actions.length > 0) {
      console.log('   Action Details:');
      processing.actions.forEach((action, i) => {
        console.log(`     ${i + 1}. Type: ${action.type}`);
        console.log(`        Instruction: ${action.instruction || 'none'}`);
        console.log(`        Timestamp: ${action.timestamp}`);
      });
    }
    console.log(`   Browser Events: ${(processing.browserEvents || []).length}`);
    console.log(`   Errors: ${(processing.errors || []).length}`);

    // Parse and display outputs in detail
    const outputs = recentArtifact.outputs || {};
    console.log('\n📤 DETAILED OUTPUTS:');
    console.log('   Primary Data:', JSON.stringify(outputs.primaryData || {}, null, 2));
    console.log('   State Changes:', JSON.stringify(outputs.stateChanges || {}, null, 2));
    console.log('   Extracted Data:', JSON.stringify(outputs.extractedData || {}, null, 2));
    
    if (outputs.browserState) {
      console.log('   Browser State After:');
      console.log(`     Current URL: ${outputs.browserState.currentUrl || 'none'}`);
      console.log(`     DOM Snapshot: ${outputs.browserState.domSnapshot ? outputs.browserState.domSnapshot.substring(0, 200) + '...' : 'none'}`);
      console.log(`     Session State: ${JSON.stringify(outputs.browserState.sessionState || {}, null, 2)}`);
    }
    
    if (outputs.executionMetadata) {
      console.log('   Execution Metadata:');
      console.log(`     Status: ${outputs.executionMetadata.status}`);
      console.log(`     Duration: ${outputs.executionMetadata.duration}ms`);
    }

    // Parse and display forwarding rules
    const forwardingRules = recentArtifact.forwarding_rules || {};
    console.log('\n🔗 FORWARDING RULES:');
    console.log('   Forward to Next:', JSON.stringify(forwardingRules.forwardToNext || [], null, 2));
    console.log('   Keep in Loop:', JSON.stringify(forwardingRules.keepInLoop || [], null, 2));
    console.log(`   Compress Large Data: ${forwardingRules.compressLargeData || false}`);

  } catch (error) {
    console.error('❌ Debug failed:', error);
  }
}

debugDetailedMemory(); 