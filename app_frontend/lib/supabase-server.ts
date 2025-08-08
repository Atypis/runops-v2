import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { CookieOptions } from '@supabase/ssr'

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * Creates a Supabase server client
 * ONLY use this in server contexts like API routes
 * @returns Supabase client for server usage
 */
export const createSupabaseServerClient = () => {
  const cookieStore = cookies()
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  );
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