require('dotenv').config({ path: './operator/.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

// Extract project ID from URL
const projectId = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
if (!projectId) {
  console.error('Could not extract project ID from Supabase URL');
  process.exit(1);
}

const sql = `
CREATE TABLE IF NOT EXISTS workflow_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(workflow_id, key)
);

-- Create an index on workflow_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_workflow_memory_workflow_id ON workflow_memory(workflow_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflow_memory_updated_at
  BEFORE UPDATE ON workflow_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
`;

// Use fetch to call Supabase Management API
async function createWorkflowMemoryTable() {
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}/database/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('Error creating table:', result);
      process.exit(1);
    } else {
      console.log('Successfully created workflow_memory table');
      console.log('Result:', result);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createWorkflowMemoryTable();