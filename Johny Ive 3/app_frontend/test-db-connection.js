const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Test Supabase connection
async function testConnection() {
  console.log('Testing Supabase connection...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  console.log('URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('Key:', supabaseKey ? 'Set' : 'Missing');
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  try {
    // Test connection by listing recent jobs
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (error) {
      console.error('Database error:', error);
    } else {
      console.log('Recent jobs:', data);
    }
  } catch (err) {
    console.error('Connection error:', err);
  }
}

testConnection(); 