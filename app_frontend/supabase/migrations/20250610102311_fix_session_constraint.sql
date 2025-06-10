-- Fix session registry unique constraint to only apply to active sessions
-- This prevents the constraint violation when cleaning up and recreating sessions

-- Drop the existing problematic constraint
ALTER TABLE session_registry DROP CONSTRAINT IF EXISTS unique_active_session_per_user;

-- Create a partial unique index that only applies to active sessions
-- This allows multiple 'cleanup' or 'error' records per user but only one active session
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_session_per_user_idx 
ON session_registry (user_id) 
WHERE status IN ('creating', 'active', 'idle');

-- Add a comment explaining the constraint
COMMENT ON INDEX unique_active_session_per_user_idx IS 
'Ensures only one active/creating/idle session per user, allows multiple cleanup/error records';
