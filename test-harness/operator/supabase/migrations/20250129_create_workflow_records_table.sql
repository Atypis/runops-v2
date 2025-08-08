-- Create workflow_records table for record-centric iteration system
-- This enables persistent records with identity across workflow executions

CREATE TABLE IF NOT EXISTS workflow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  record_id VARCHAR(255) NOT NULL,        -- e.g., "email_001" or "temp:runId:nodeAlias:0001"
  record_type VARCHAR(50) NOT NULL,       -- e.g., "email", "employee", "temp"
  iteration_node_alias VARCHAR(255),      -- Which node created this record
  
  -- Record data with reserved structure
  -- { "fields": {}, "vars": {}, "targets": {}, "history": [] }
  data JSONB NOT NULL DEFAULT '{"fields": {}, "vars": {}, "targets": {}, "history": []}'::jsonb,
  
  -- Processing metadata (top-level fields)
  status VARCHAR(50) DEFAULT 'discovered', -- discovered, processing, complete, failed
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Audit trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Unique constraint for idempotent operations
  UNIQUE(workflow_id, record_id)
);

-- Performance indexes

-- Primary lookup pattern
CREATE INDEX idx_workflow_records_lookup 
  ON workflow_records(workflow_id, record_type);

-- Status queries (find failed records, etc)
CREATE INDEX idx_workflow_records_status 
  ON workflow_records(workflow_id, status);

-- Iteration source tracking
CREATE INDEX idx_workflow_records_iteration 
  ON workflow_records(workflow_id, iteration_node_alias) 
  WHERE iteration_node_alias IS NOT NULL;

-- JSONB GIN index for flexible queries on data
CREATE INDEX idx_workflow_records_data_gin
  ON workflow_records USING GIN (data jsonb_path_ops);

-- Fast label queries (common in email triage scenarios)
-- This is a partial index on the vars.label field for email records
CREATE INDEX idx_workflow_records_email_label
  ON workflow_records ((data->'vars'->>'label'))
  WHERE record_type = 'email';

-- Timestamp indexes for time-based queries
CREATE INDEX idx_workflow_records_created 
  ON workflow_records(created_at DESC);

CREATE INDEX idx_workflow_records_processed 
  ON workflow_records(processed_at DESC) 
  WHERE processed_at IS NOT NULL;

-- Update timestamp trigger
CREATE TRIGGER update_workflow_records_updated_at 
  BEFORE UPDATE ON workflow_records 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Helper function for deep merging JSONB with dot-path support
-- This will be used by the application for now, but having it in the DB
-- makes it available for future optimization
CREATE OR REPLACE FUNCTION jsonb_deep_merge_path(target JSONB, patch JSONB) 
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- For now, just do a shallow merge
  -- The application will handle dot-path merging
  -- This is a placeholder for future DB-side optimization
  result := target || patch;
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add comment for documentation
COMMENT ON TABLE workflow_records IS 'Persistent records for workflow iterations with identity and progressive data accumulation';
COMMENT ON COLUMN workflow_records.record_id IS 'Unique identifier within workflow (e.g., email_001 or temp:runId:nodeAlias:0001)';
COMMENT ON COLUMN workflow_records.data IS 'Record data with reserved structure: {"fields": {}, "vars": {}, "targets": {}, "history": []}';
COMMENT ON COLUMN workflow_records.status IS 'Record processing status: discovered, processing, complete, failed';