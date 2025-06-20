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