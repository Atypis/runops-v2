-- Operator Prototype Database Schema

-- Workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal TEXT NOT NULL,
  status TEXT DEFAULT 'building', -- building, ready, executing, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Nodes table  
CREATE TABLE nodes (
  id SERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  type TEXT NOT NULL, -- navigate, click, type, extract, wait, etc
  params JSONB NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending, executing, success, failed, modified
  result JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  executed_at TIMESTAMP WITH TIME ZONE
);

-- Execution logs
CREATE TABLE execution_logs (
  id SERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  node_id INTEGER REFERENCES nodes(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  level TEXT NOT NULL, -- info, error, success, warning
  message TEXT NOT NULL,
  details JSONB
);

-- Conversation history (for context)
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user, assistant, system
  content TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Learned patterns (for future)
CREATE TABLE patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_phrase TEXT NOT NULL, -- "Gmail login page", "Airtable auth", etc
  solution JSONB NOT NULL, -- Reusable node sequence
  confidence FLOAT DEFAULT 0.5,
  usage_count INTEGER DEFAULT 0,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_nodes_workflow_id ON nodes(workflow_id);
CREATE INDEX idx_nodes_position ON nodes(workflow_id, position);
CREATE INDEX idx_logs_workflow_id ON execution_logs(workflow_id);
CREATE INDEX idx_logs_timestamp ON execution_logs(timestamp);
CREATE INDEX idx_conversations_workflow_id ON conversations(workflow_id);

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();