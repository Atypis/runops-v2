-- Create table for storing OpenAI response IDs for background mode context
CREATE TABLE IF NOT EXISTS workflow_response_ids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  response_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  
  -- Index for fast lookups
  CONSTRAINT workflow_response_ids_workflow_id_idx UNIQUE (workflow_id, created_at DESC)
);

-- Create index for efficient querying
CREATE INDEX IF NOT EXISTS idx_workflow_response_ids_workflow_created 
ON workflow_response_ids(workflow_id, created_at DESC);

-- Add comment explaining the table
COMMENT ON TABLE workflow_response_ids IS 'Stores OpenAI response IDs for background mode (o3) to maintain stateful context via previous_response_id';