-- Add metadata columns to browser_sessions table for enhanced session management

-- Add scope column to track whether session is for current origin or entire browser
ALTER TABLE browser_sessions 
ADD COLUMN IF NOT EXISTS scope TEXT DEFAULT 'origin' CHECK (scope IN ('origin', 'browser'));

-- Add persist_strategy column to track storage method
ALTER TABLE browser_sessions 
ADD COLUMN IF NOT EXISTS persist_strategy TEXT DEFAULT 'storageState' CHECK (persist_strategy IN ('storageState', 'profileDir'));

-- Add origin column to store the origin URL when scope is 'origin'
ALTER TABLE browser_sessions 
ADD COLUMN IF NOT EXISTS origin TEXT;

-- Add metadata column for extensibility
ALTER TABLE browser_sessions 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add comment to table
COMMENT ON TABLE browser_sessions IS 'Stores browser session data for Director 2.0 session management feature';

-- Add comments to new columns
COMMENT ON COLUMN browser_sessions.scope IS 'Session scope: origin (current domain only) or browser (all domains)';
COMMENT ON COLUMN browser_sessions.persist_strategy IS 'Storage strategy: storageState (JSON) or profileDir (Chrome profile)';
COMMENT ON COLUMN browser_sessions.origin IS 'Origin URL when scope is origin';
COMMENT ON COLUMN browser_sessions.metadata IS 'Additional metadata for future extensibility';