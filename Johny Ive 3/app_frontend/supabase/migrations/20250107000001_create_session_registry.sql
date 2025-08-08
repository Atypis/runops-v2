-- Create session registry table for tracking active VNC sessions
CREATE TABLE IF NOT EXISTS session_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL UNIQUE, -- execution ID like vnc-env-xxxxx
    container_name VARCHAR(255) NOT NULL UNIQUE,
    container_id VARCHAR(255), -- Docker container ID
    status VARCHAR(50) NOT NULL DEFAULT 'creating', -- creating, active, idle, cleanup, error
    vnc_port INTEGER,
    api_port INTEGER,
    vnc_url TEXT,
    api_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Ensure one active session per user
    CONSTRAINT unique_active_session_per_user UNIQUE (user_id) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_session_registry_user_id ON session_registry(user_id);
CREATE INDEX IF NOT EXISTS idx_session_registry_status ON session_registry(status);
CREATE INDEX IF NOT EXISTS idx_session_registry_session_id ON session_registry(session_id);

-- Row Level Security
ALTER TABLE session_registry ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
CREATE POLICY "Users can view their own sessions" ON session_registry
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can create their own sessions" ON session_registry
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update their own sessions" ON session_registry
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions" ON session_registry
    FOR DELETE USING (auth.uid() = user_id);

-- Function to cleanup old sessions (for scheduled cleanup)
CREATE OR REPLACE FUNCTION cleanup_stale_sessions()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER;
BEGIN
    -- Mark sessions as cleanup if no heartbeat for 30+ minutes
    UPDATE session_registry 
    SET status = 'cleanup'
    WHERE status IN ('active', 'idle') 
    AND heartbeat_at < NOW() - INTERVAL '30 minutes';
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update session heartbeat
CREATE OR REPLACE FUNCTION update_session_heartbeat(session_id_param VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE session_registry 
    SET 
        heartbeat_at = NOW(),
        last_activity = NOW(),
        status = CASE 
            WHEN status = 'idle' THEN 'active'
            ELSE status
        END
    WHERE session_id = session_id_param 
    AND user_id = auth.uid();
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql; 