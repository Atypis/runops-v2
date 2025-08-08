-- Add status column to workflow_response_ids table for tracking completion state
ALTER TABLE workflow_response_ids 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed' 
CHECK (status IN ('completed', 'incomplete', 'cancelled'));

-- Add index for efficient queries on workflow_id and status
CREATE INDEX IF NOT EXISTS idx_workflow_response_status 
ON workflow_response_ids(workflow_id, status, created_at DESC);

-- Add column to track if this response was a fork point
ALTER TABLE workflow_response_ids 
ADD COLUMN IF NOT EXISTS is_fork_point BOOLEAN DEFAULT FALSE;

-- Comment on the new columns
COMMENT ON COLUMN workflow_response_ids.status IS 'Status of the response: completed (full response received), incomplete (partial/interrupted), cancelled (user cancelled)';
COMMENT ON COLUMN workflow_response_ids.is_fork_point IS 'Whether this response ID was used as a fork point after cancellation';