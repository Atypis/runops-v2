const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function testQuery() {
  try {
    console.log('Testing Supabase connection...');
    console.log('URL:', SUPABASE_URL);
    console.log('Service Key length:', SUPABASE_SERVICE_KEY.length > 0 ? 'OK' : 'MISSING');

    // Query for the specific job
    const { data: job, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', 'd29d7038-e956-4570-a82b-164a550c770a')
      .single();

    if (error) {
      console.error('Error fetching job:', error);
      return;
    }

    console.log('Job data:', job);
    console.log('Status:', job.status);
    
    // Also test the same query we use in the API endpoint
    console.log('\nTesting exact API query:');
    const { data: jobs, error: apiError } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', 'd29d7038-e956-4570-a82b-164a550c770a')
      .single();
      
    if (apiError) {
      console.error('API query error:', apiError);
      return;
    }
    
    console.log('API query result:', jobs);
    console.log('API status:', jobs.status);
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

testQuery(); 