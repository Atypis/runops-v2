-- Create browser_sessions table for storing browser cookie sessions
CREATE TABLE IF NOT EXISTS browser_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  cookies JSONB NOT NULL DEFAULT '[]'::jsonb,
  local_storage JSONB,
  session_storage JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Add indexes for performance
CREATE INDEX idx_browser_sessions_name ON browser_sessions(name);
CREATE INDEX idx_browser_sessions_last_used ON browser_sessions(last_used_at DESC);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_browser_sessions_updated_at BEFORE UPDATE
  ON browser_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies (if RLS is enabled)
ALTER TABLE browser_sessions ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (can be restricted later)
CREATE POLICY "Allow all operations on browser_sessions" ON browser_sessions
  FOR ALL USING (true);