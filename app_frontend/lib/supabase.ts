import { createClient } from '@supabase/supabase-js';

// These environment variables will need to be set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Create Supabase client for browser usage (anon key)
export const createSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseAnonKey);
};

// Create Supabase server client (service role key)
// Only use this in server contexts like API routes
export const createSupabaseServerClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}; 