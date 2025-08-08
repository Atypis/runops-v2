-- Create AEF Node Logs table for real-time logging
CREATE TABLE aef_node_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL,
  node_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  type TEXT NOT NULL CHECK (type IN ('prompt', 'accessibility_tree', 'llm_response', 'action', 'screenshot', 'error', 'success')),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_aef_node_logs_execution_id ON aef_node_logs (execution_id);
CREATE INDEX idx_aef_node_logs_node_id ON aef_node_logs (node_id);
CREATE INDEX idx_aef_node_logs_timestamp ON aef_node_logs (timestamp DESC);
CREATE INDEX idx_aef_node_logs_type ON aef_node_logs (type);
CREATE INDEX idx_aef_node_logs_execution_node ON aef_node_logs (execution_id, node_id, timestamp DESC);

-- Add RLS (Row Level Security) policies
ALTER TABLE aef_node_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see logs for their own executions
-- We'll need to join with the jobs table to check ownership
CREATE POLICY "Users can view their own execution logs" ON aef_node_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.job_id = aef_node_logs.execution_id 
      AND (jobs.metadata->>'user_id')::text = auth.uid()::text
    )
  );

-- Policy: Service role can insert logs
CREATE POLICY "Service role can insert logs" ON aef_node_logs
  FOR INSERT WITH CHECK (true);

-- Policy: Service role can update logs  
CREATE POLICY "Service role can update logs" ON aef_node_logs
  FOR UPDATE USING (true); 