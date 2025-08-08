"use client"

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

// Global client instances to prevent recreation on each request
let browserClient: SupabaseClient | null = null;

/**
 * Creates a Supabase client for browser usage (anon key)
 * This client should only be used in browser contexts
 * @returns Supabase client with anon key
 */
export const createSupabaseClient = () => {
  if (typeof window !== 'undefined' && browserClient) {
    return browserClient;
  }
  
  const client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  
  // Only store the instance in the browser
  if (typeof window !== 'undefined') {
    browserClient = client;
  }
  
  return client;
}; 