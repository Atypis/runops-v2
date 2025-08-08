const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function testWorker() {
  console.log('Testing worker setup and functionality...');

  // Step 1: Check if sops table exists
  console.log('Checking sops table...');
  try {
    const { data, error } = await supabase
      .from('sops')
      .select('count(*)', { count: 'exact', head: true });
    
    if (error && error.code === '42P01') {
      console.error('Error: sops table does not exist. Please run the database migration first.');
      return;
    } else if (error) {
      console.error('Error checking sops table:', error);
      return;
    }
    
    console.log('✅ sops table exists');
  } catch (err) {
    console.error('Error checking sops table:', err);
    return;
  }

  // Step 2: Check if storage folders exist
  console.log('Checking storage folders...');
  for (const folder of ['raw', 'slim', 'sops']) {
    const { data: folderFiles, error: folderError } = await supabase.storage
      .from('videos')
      .list(folder, { limit: 1 });
      
    if (folderError) {
      console.error(`Error: ${folder} folder does not exist:`, folderError);
      console.log('Please run the worker once to create required folders');
      return;
    }
    
    console.log(`✅ ${folder} folder exists`);
  }

  // Step 3: Query existing jobs to check status
  console.log('Checking existing jobs...');
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (jobsError) {
    console.error('Error fetching jobs:', jobsError);
    return;
  }
  
  if (jobs.length === 0) {
    console.log('No jobs found. Worker should create new ones when videos are uploaded.');
  } else {
    console.log(`Found ${jobs.length} recent jobs:`);
    jobs.forEach(job => {
      console.log(`- Job ${job.job_id}: ${job.status} (Created: ${new Date(job.created_at).toLocaleString()})`);
      if (job.error) {
        console.log(`  Error: ${job.error}`);
      }
    });
  }

  // Step 4: Check if any sops have been created
  console.log('Checking if any SOPs have been created...');
  const { data: sops, error: sopsError } = await supabase
    .from('sops')
    .select('id, job_id, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (sopsError) {
    console.error('Error fetching SOPs:', sopsError);
    return;
  }
  
  if (sops.length === 0) {
    console.log('No SOPs found yet. Worker should create them when processing videos.');
  } else {
    console.log(`Found ${sops.length} SOPs:`);
    sops.forEach(sop => {
      console.log(`- SOP ID ${sop.id}: Job ${sop.job_id} (Created: ${new Date(sop.created_at).toLocaleString()})`);
    });
  }

  console.log('\nDiagnostic checks complete.');
  console.log('To run the worker, use: npm run worker');
}

testWorker().catch(err => {
  console.error('Unhandled error in test:', err);
}); 