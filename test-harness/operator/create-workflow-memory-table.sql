-- Create workflow_memory table for storing workflow variables
-- This table is used by the context/memory nodes to store data that can be 
-- referenced later using {{variable}} syntax

CREATE TABLE IF NOT EXISTS workflow_memory (
  id SERIAL PRIMARY KEY,
  workflow_id UUID NOT NULL,
  key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workflow_id, key)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_memory_workflow_id ON workflow_memory(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_memory_key ON workflow_memory(key);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_workflow_memory_updated_at ON workflow_memory;
CREATE TRIGGER update_workflow_memory_updated_at 
BEFORE UPDATE ON workflow_memory 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Verify the table was created
SELECT 'workflow_memory table created successfully' as status;