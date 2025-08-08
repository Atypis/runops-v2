-- Add workflow_descriptions table for high-fidelity workflow specifications
CREATE TABLE workflow_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  description_version integer DEFAULT 1,
  description_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_workflow_descriptions_workflow_id ON workflow_descriptions(workflow_id);
CREATE INDEX idx_workflow_descriptions_version ON workflow_descriptions(workflow_id, description_version DESC);

-- Add updated_at trigger
CREATE TRIGGER update_workflow_descriptions_updated_at BEFORE UPDATE ON workflow_descriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies (if RLS is enabled)
ALTER TABLE workflow_descriptions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (can be restricted later)
CREATE POLICY "Allow all operations on workflow_descriptions" ON workflow_descriptions
  FOR ALL USING (true);