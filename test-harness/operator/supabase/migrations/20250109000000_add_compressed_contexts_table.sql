-- Create table for storing compressed conversation contexts
CREATE TABLE compressed_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  original_message_count INTEGER NOT NULL,
  compression_ratio FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'manual' -- 'manual' or 'automatic'
);

-- Add index for efficient queries
CREATE INDEX idx_compressed_contexts_workflow 
ON compressed_contexts(workflow_id, created_at DESC);

-- Add RLS policy
ALTER TABLE compressed_contexts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on compressed_contexts" ON compressed_contexts
  FOR ALL USING (true);