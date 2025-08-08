-- Add metadata column to conversations table for storing tool calls, reasoning, etc.
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';

-- Add index on workflow_id and timestamp for efficient querying
CREATE INDEX IF NOT EXISTS idx_conversations_workflow_timestamp 
ON conversations(workflow_id, timestamp DESC);

-- Update RLS policy to allow all operations
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on conversations" ON conversations;
CREATE POLICY "Allow all operations on conversations" ON conversations
  FOR ALL USING (true);