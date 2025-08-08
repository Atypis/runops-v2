-- Create user_credentials table for secure credential storage
-- Migration: 20250115000000_create_user_credentials.sql

-- Create the user_credentials table
CREATE TABLE IF NOT EXISTS user_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  workflow_id TEXT,
  service_type TEXT NOT NULL,
  auth_method TEXT NOT NULL DEFAULT 'email_password',
  credential_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique credentials per user/service/workflow combination
  UNIQUE(user_id, service_type, workflow_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_user_credentials_user_id ON user_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_service_type ON user_credentials(service_type);
CREATE INDEX IF NOT EXISTS idx_user_credentials_workflow_id ON user_credentials(workflow_id);
CREATE INDEX IF NOT EXISTS idx_user_credentials_created_at ON user_credentials(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can only access their own credentials
CREATE POLICY "Users can manage their own credentials"
  ON user_credentials FOR ALL
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own credentials
CREATE POLICY "Users can insert their own credentials"
  ON user_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own credentials
CREATE POLICY "Users can update their own credentials"
  ON user_credentials FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own credentials
CREATE POLICY "Users can delete their own credentials"
  ON user_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_credentials_updated_at
  BEFORE UPDATE ON user_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE user_credentials IS 'Stores encrypted user credentials for workflow automation';
COMMENT ON COLUMN user_credentials.user_id IS 'References the authenticated user';
COMMENT ON COLUMN user_credentials.workflow_id IS 'Optional workflow-specific credentials (null for global)';
COMMENT ON COLUMN user_credentials.service_type IS 'Service identifier (gmail, airtable, etc.)';
COMMENT ON COLUMN user_credentials.auth_method IS 'Authentication method (email_password, oauth, api_key, etc.)';
COMMENT ON COLUMN user_credentials.credential_data IS 'Encrypted credential data (JSON)';
COMMENT ON COLUMN user_credentials.metadata IS 'Additional metadata (creation source, validation status, etc.)'; 