import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || 'https://ghheisbmwwikpvwqjuyn.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error('Missing SUPABASE_ANON_KEY environment variable');
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Test the connection
console.log('[SUPABASE] Initializing Supabase client...');
console.log('[SUPABASE] URL:', supabaseUrl);
console.log('[SUPABASE] Key:', supabaseAnonKey ? 'Present' : 'Missing');

// Optional: Test connection by attempting to fetch workflows
supabase
  .from('workflows')
  .select('count', { count: 'exact', head: true })
  .then(({ count, error }) => {
    if (error) {
      console.error('[SUPABASE] Connection test failed:', error);
      console.error('[SUPABASE] Error code:', error.code);
      console.error('[SUPABASE] Error message:', error.message);
    } else {
      console.log('[SUPABASE] Connection successful! Workflows count:', count);
    }
  });