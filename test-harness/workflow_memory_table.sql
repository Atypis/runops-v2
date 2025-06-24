-- Create workflow_memory table
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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_workflow_memory_updated_at
  BEFORE UPDATE ON workflow_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add row level security (RLS)
ALTER TABLE workflow_memory ENABLE ROW LEVEL SECURITY;

-- Create policy for service role (full access)
CREATE POLICY "Service role has full access to workflow_memory" ON workflow_memory
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Add comment to table
COMMENT ON TABLE workflow_memory IS 'Stores key-value pairs for workflow state persistence';
COMMENT ON COLUMN workflow_memory.workflow_id IS 'ID of the workflow this memory belongs to';
COMMENT ON COLUMN workflow_memory.key IS 'Unique key within the workflow context';
COMMENT ON COLUMN workflow_memory.value IS 'JSON value stored for this key';