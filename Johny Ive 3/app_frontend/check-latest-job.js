const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function checkLatestJob() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  
  const { data, error } = await supabase
    .from('jobs')
    .select('job_id, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  if (data && data[0]) {
    console.log('Most recent job:', data[0].job_id);
    console.log('Created at:', data[0].created_at);
    console.log('Execution ID in metadata:', data[0].metadata?.execution_record?.execution_id);
    console.log('Session ID in metadata:', data[0].metadata?.vnc_session?.sessionId);
  }
}

checkLatestJob(); 