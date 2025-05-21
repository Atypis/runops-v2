import { createClient, SupabaseClient } from '@supabase/supabase-js';

// These environment variables will need to be set in .env.local
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Global client instances to prevent recreation on each request
let browserClient: SupabaseClient | null = null;
let serverClient: SupabaseClient | null = null;

/**
 * Creates a Supabase client for browser usage (anon key)
 * This client should only be used in browser contexts
 * @returns Supabase client with anon key
 */
export const createSupabaseClient = () => {
  if (typeof window !== 'undefined' && browserClient) {
    return browserClient;
  }
  
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { 
      persistSession: true, 
      autoRefreshToken: true 
    },
  });
  
  // Only store the instance in the browser
  if (typeof window !== 'undefined') {
    browserClient = client;
  }
  
  return client;
};

/**
 * Creates a Supabase server client (service role key)
 * ONLY use this in server contexts like API routes
 * This client has admin privileges so be careful
 * @returns Supabase client with service role key
 */
export const createSupabaseServerClient = () => {
  // Always create a fresh client on the server to prevent session mixing
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { 
      persistSession: false 
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: { 
        'x-client-info': 'server-api',
      },
    },
  });
};

/**
 * Creates a direct, standalone Supabase client that's safe to use in API routes
 * This is the recommended approach for API routes to avoid session/auth issues
 * @returns Supabase client that's properly configured for API routes
 */
export const createDirectSupabaseClient = () => {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { 
      persistSession: false 
    },
    db: {
      schema: 'public'
    },
    global: {
      headers: { 
        'x-client-info': 'direct-api',
      },
    },
  });
}; 