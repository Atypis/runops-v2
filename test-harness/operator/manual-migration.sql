-- Manual migration for Director 2.0 Planning Feature
-- Run this SQL in your Supabase SQL Editor

-- Create director_plans table
CREATE TABLE director_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  plan_version integer DEFAULT 1,
  plan_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX idx_director_plans_workflow_id ON director_plans(workflow_id);
CREATE INDEX idx_director_plans_version ON director_plans(workflow_id, plan_version DESC);

-- Add updated_at trigger (reuse existing function)
CREATE TRIGGER update_director_plans_updated_at BEFORE UPDATE ON director_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE director_plans ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (can be restricted later)
CREATE POLICY "Allow all operations on director_plans" ON director_plans
  FOR ALL USING (true);

-- Verify table creation
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'director_plans' 
ORDER BY ordinal_position;