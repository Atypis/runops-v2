import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createWorkflowMemoryTable() {
  console.log('Creating workflow_memory table...');
  
  // Note: The anon key doesn't have permissions to create tables
  // This will only work if you have the service role key
  const { data, error } = await supabase.rpc('create_workflow_memory_table', {
    sql: `
      CREATE TABLE IF NOT EXISTS workflow_memory (
        id SERIAL PRIMARY KEY,
        workflow_id UUID NOT NULL,
        key TEXT NOT NULL,
        value JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(workflow_id, key)
      );
      
      CREATE INDEX IF NOT EXISTS idx_workflow_memory_workflow_id ON workflow_memory(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_memory_key ON workflow_memory(key);
    `
  });

  if (error) {
    console.error('Error creating table:', error);
    console.log('\nThe anon key cannot create tables. Please either:');
    console.log('1. Use the Supabase dashboard SQL editor');
    console.log('2. Add your service role key to .env as SUPABASE_SERVICE_KEY');
    console.log('\nSQL to run in dashboard:');
    console.log(fs.readFileSync('./create-workflow-memory-table.sql', 'utf8'));
  } else {
    console.log('Table created successfully!');
  }
}

createWorkflowMemoryTable();