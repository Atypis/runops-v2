import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple locations for .env file
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config(); // Try default location as fallback

// Prefer operator-specific Supabase if provided, else fall back to default
const supabaseUrl =
  process.env.OPERATOR_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://ghheisbmwwikpvwqjuyn.supabase.co';

const supabaseAnonKey =
  process.env.OPERATOR_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY;

let supabase;

if (!supabaseAnonKey) {
  console.error('[SUPABASE] Warning: SUPABASE_ANON_KEY not found in environment variables');
  console.error('[SUPABASE] Will retry when first accessed...');
  
  // Create a lazy-initialized proxy that will try to get the client when first accessed
  supabase = new Proxy({}, {
    get(target, prop) {
      if (!target._client) {
        const key = process.env.SUPABASE_ANON_KEY;
        if (!key) {
          throw new Error('SUPABASE_ANON_KEY is still not available. Please ensure environment variables are loaded.');
        }
        target._client = createClient(supabaseUrl, key);
        console.log('[SUPABASE] Successfully initialized client on first access');
      }
      return target._client[prop];
    }
  });
} else {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };

// Log initialization status to stderr to avoid polluting stdout (important for MCP stdio)
console.error('[SUPABASE] Supabase module loaded');
console.error('[SUPABASE] URL:', supabaseUrl);
console.error('[SUPABASE] Key:', supabaseAnonKey ? 'Present' : 'Missing - will lazy initialize');
console.error('[SUPABASE] Source:', process.env.OPERATOR_SUPABASE_URL || process.env.OPERATOR_SUPABASE_ANON_KEY ? 'operator-specific env' : 'default env');