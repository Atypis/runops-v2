-- Add support for message editing and conversation forking
-- This allows users to edit their messages and fork the conversation from any point

-- Add response_id to link messages to their OpenAI response IDs
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS response_id TEXT,
ADD COLUMN IF NOT EXISTS previous_response_id TEXT,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_conversations_response_id 
ON conversations(workflow_id, response_id) 
WHERE response_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_active 
ON conversations(workflow_id, is_active) 
WHERE is_active = TRUE;

-- Add comments to explain the new columns
COMMENT ON COLUMN conversations.response_id IS 'The OpenAI response ID that generated this message (for assistant messages)';
COMMENT ON COLUMN conversations.previous_response_id IS 'The response ID this message was generated from (for tracking forks)';
COMMENT ON COLUMN conversations.is_active IS 'Whether this message is part of the active conversation path (false for forked-over messages)';