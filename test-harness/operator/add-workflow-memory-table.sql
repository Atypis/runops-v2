-- Add workflow_memory table to existing database
-- Run this script if you're getting errors about the workflow_memory table not existing

-- Create the workflow_memory table
CREATE TABLE IF NOT EXISTS workflow_memory (
  id SERIAL PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workflow_id, key)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workflow_memory_workflow_id ON workflow_memory(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_memory_key ON workflow_memory(key);

-- Add update trigger for updated_at column
CREATE TRIGGER update_workflow_memory_updated_at BEFORE UPDATE ON workflow_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON workflow_memory TO authenticated;
-- GRANT ALL ON workflow_memory_id_seq TO authenticated;