const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkExecution() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // The execution ID you're currently using
  const executionId = 'vnc-env-04f29758-7904-44d1-be93-a968cfc00f8b';
  const databaseId = executionId.replace('vnc-env-', ''); // Extract UUID part
  
  console.log('Looking for execution:', executionId);
  console.log('Database ID:', databaseId);
  
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('job_id', databaseId)
    .single();
    
  if (error) {
    console.error('Error:', error);
    console.log('❌ This execution does not exist in the database');
  } else {
    console.log('✅ Found execution:', data);
  }
}

checkExecution(); 