const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

async function debugMemorySystem() {
  console.log('🔍 Debug: Memory System Investigation\n');

  // Check environment variables
  console.log('1. Environment Variables:');
  console.log(`   SUPABASE_URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   SUPABASE_SERVICE_ROLE_KEY: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing'}\n`);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log('❌ Missing required environment variables!');
    return;
  }

  // Create Supabase client with service role
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // Check if memory_artifacts table exists
    console.log('2. Database Table Check:');
    const { data: tables, error: tableError } = await supabase
      .from('memory_artifacts')
      .select('id')
      .limit(1);

    if (tableError) {
      console.log(`   ❌ memory_artifacts table: ${tableError.message}`);
      return;
    } else {
      console.log('   ✅ memory_artifacts table exists');
    }

    // Check how many memory artifacts exist
    const { count, error: countError } = await supabase
      .from('memory_artifacts')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.log(`   ❌ Count query failed: ${countError.message}`);
    } else {
      console.log(`   📊 Total memory artifacts: ${count || 0}`);
    }

    // Get recent memory artifacts
    console.log('\n3. Recent Memory Artifacts:');
    const { data: recentArtifacts, error: recentError } = await supabase
      .from('memory_artifacts')
      .select('id, execution_id, node_id, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentError) {
      console.log(`   ❌ Recent artifacts query failed: ${recentError.message}`);
    } else if (!recentArtifacts || recentArtifacts.length === 0) {
      console.log('   📭 No memory artifacts found');
      console.log('   💡 This suggests memory capture is not working');
    } else {
      console.log(`   📋 Found ${recentArtifacts.length} recent artifacts:`);
      recentArtifacts.forEach(artifact => {
        console.log(`     - ${artifact.execution_id}/${artifact.node_id} (${artifact.created_at})`);
      });
    }

    // Check for executions in general
    console.log('\n4. Recent Executions (from metadata):');
    const { data: executions, error: execError } = await supabase
      .from('workflow_executions_metadata')
      .select('execution_id, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (execError) {
      console.log(`   ❌ Executions query failed: ${execError.message}`);
    } else if (!executions || executions.length === 0) {
      console.log('   📭 No recent executions found');
    } else {
      console.log(`   📋 Found ${executions.length} recent executions:`);
      executions.forEach(execution => {
        console.log(`     - ${execution.execution_id} (${execution.status}) - ${execution.created_at}`);
      });
    }

  } catch (error) {
    console.error('💥 Debug failed:', error.message);
  }
}

debugMemorySystem().catch(console.error); 