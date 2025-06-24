import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, 'operator', '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false
  }
});

async function createWorkflowMemoryTable() {
  console.log('Creating workflow_memory table...');
  
  // First, let's check if the table already exists
  const { data: existingTable, error: checkError } = await supabase
    .from('workflow_memory')
    .select('id')
    .limit(1);
  
  if (!checkError) {
    console.log('Table workflow_memory already exists');
    return;
  }
  
  // If table doesn't exist, we'll need to use raw SQL
  // Unfortunately, Supabase JS client doesn't support DDL operations directly
  // We'll need to use a different approach
  
  console.log('Table does not exist. To create it, please run the following SQL in the Supabase dashboard:');
  console.log('');
  console.log('-- Create workflow_memory table');
  console.log(`CREATE TABLE IF NOT EXISTS workflow_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_id, key)
);`);
  console.log('');
  console.log('-- Create an index on workflow_id for faster lookups');
  console.log('CREATE INDEX IF NOT EXISTS idx_workflow_memory_workflow_id ON workflow_memory(workflow_id);');
  console.log('');
  console.log('-- Create updated_at trigger');
  console.log(`CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';`);
  console.log('');
  console.log(`CREATE TRIGGER update_workflow_memory_updated_at
  BEFORE UPDATE ON workflow_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();`);
  console.log('');
  console.log('You can access the SQL editor at:');
  console.log(`${supabaseUrl.replace('.supabase.co', '.supabase.com')}/project/_/sql/new`);
}

createWorkflowMemoryTable();