-- Enhanced AEF Execution Metadata and Analytics Tables
-- This migration creates comprehensive logging infrastructure for the AEF system

-- 1. Create execution metadata table for comprehensive execution tracking
CREATE TABLE aef_execution_metadata (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL UNIQUE,
  workflow_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration INTEGER, -- Duration in milliseconds
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'paused', 'cancelled')),
  success BOOLEAN,
  total_nodes INTEGER DEFAULT 0,
  completed_nodes INTEGER DEFAULT 0,
  failed_nodes INTEGER DEFAULT 0,
  
  -- Metrics tracking
  total_actions INTEGER DEFAULT 0,
  successful_actions INTEGER DEFAULT 0,
  failed_actions INTEGER DEFAULT 0,
  average_action_duration INTEGER, -- milliseconds
  total_tokens_used INTEGER DEFAULT 0,
  
  -- Artifacts storage
  artifacts JSONB DEFAULT '{
    "screenshots": [],
    "conversation_logs": [],
    "extracted_data": [],
    "final_summary": null
  }',
  
  -- Enhanced metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create node execution analytics table
CREATE TABLE aef_node_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES aef_execution_metadata(execution_id),
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  
  -- Timing data
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER, -- milliseconds
  
  -- Execution status
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'skipped')),
  success BOOLEAN,
  
  -- Performance metrics
  action_count INTEGER DEFAULT 0,
  token_usage INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  
  -- Results
  result_data JSONB DEFAULT '{}',
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(execution_id, node_id)
);

-- 3. Create action execution analytics table
CREATE TABLE aef_action_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES aef_execution_metadata(execution_id),
  node_id TEXT NOT NULL,
  action_id UUID NOT NULL DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL,
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER, -- milliseconds
  
  -- Status
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'retrying')),
  success BOOLEAN,
  
  -- Details
  action_details JSONB DEFAULT '{}',
  result_data JSONB DEFAULT '{}',
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Performance
  tokens_used INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create error tracking table
CREATE TABLE aef_error_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES aef_execution_metadata(execution_id),
  node_id TEXT,
  action_id UUID,
  
  -- Error details
  error_type TEXT NOT NULL,
  error_code TEXT,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  
  -- Context
  context_data JSONB DEFAULT '{}',
  user_agent TEXT,
  browser_version TEXT,
  
  -- Classification
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  category TEXT NOT NULL DEFAULT 'unknown' CHECK (category IN ('network', 'parsing', 'authentication', 'ui_interaction', 'timeout', 'permission', 'unknown')),
  
  -- Resolution
  resolved BOOLEAN DEFAULT FALSE,
  resolution_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create performance analytics table for trends
CREATE TABLE aef_performance_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES aef_execution_metadata(execution_id),
  
  -- Performance metrics snapshot
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cpu_usage DECIMAL(5,2), -- percentage
  memory_usage DECIMAL(10,2), -- MB
  browser_memory DECIMAL(10,2), -- MB
  
  -- Network metrics
  network_requests INTEGER DEFAULT 0,
  network_errors INTEGER DEFAULT 0,
  total_download_size BIGINT DEFAULT 0, -- bytes
  
  -- Browser metrics
  dom_nodes INTEGER DEFAULT 0,
  javascript_errors INTEGER DEFAULT 0,
  page_load_time INTEGER, -- milliseconds
  
  -- System metrics
  disk_usage DECIMAL(10,2), -- MB
  
  -- Metadata
  metadata JSONB DEFAULT '{}'
);

-- Create indexes for optimal query performance
CREATE INDEX idx_aef_execution_metadata_execution_id ON aef_execution_metadata (execution_id);
CREATE INDEX idx_aef_execution_metadata_user_id ON aef_execution_metadata (user_id);
CREATE INDEX idx_aef_execution_metadata_workflow_id ON aef_execution_metadata (workflow_id);
CREATE INDEX idx_aef_execution_metadata_start_time ON aef_execution_metadata (start_time DESC);
CREATE INDEX idx_aef_execution_metadata_status ON aef_execution_metadata (status);
CREATE INDEX idx_aef_execution_metadata_user_start ON aef_execution_metadata (user_id, start_time DESC);

CREATE INDEX idx_aef_node_analytics_execution_id ON aef_node_analytics (execution_id);
CREATE INDEX idx_aef_node_analytics_node_id ON aef_node_analytics (node_id);
CREATE INDEX idx_aef_node_analytics_start_time ON aef_node_analytics (start_time DESC);
CREATE INDEX idx_aef_node_analytics_status ON aef_node_analytics (status);
CREATE INDEX idx_aef_node_analytics_execution_node ON aef_node_analytics (execution_id, node_id);

CREATE INDEX idx_aef_action_analytics_execution_id ON aef_action_analytics (execution_id);
CREATE INDEX idx_aef_action_analytics_node_id ON aef_action_analytics (node_id);
CREATE INDEX idx_aef_action_analytics_action_type ON aef_action_analytics (action_type);
CREATE INDEX idx_aef_action_analytics_start_time ON aef_action_analytics (start_time DESC);
CREATE INDEX idx_aef_action_analytics_status ON aef_action_analytics (status);

CREATE INDEX idx_aef_error_analytics_execution_id ON aef_error_analytics (execution_id);
CREATE INDEX idx_aef_error_analytics_error_type ON aef_error_analytics (error_type);
CREATE INDEX idx_aef_error_analytics_severity ON aef_error_analytics (severity);
CREATE INDEX idx_aef_error_analytics_category ON aef_error_analytics (category);
CREATE INDEX idx_aef_error_analytics_created_at ON aef_error_analytics (created_at DESC);

CREATE INDEX idx_aef_performance_analytics_execution_id ON aef_performance_analytics (execution_id);
CREATE INDEX idx_aef_performance_analytics_timestamp ON aef_performance_analytics (timestamp DESC);

-- Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_aef_execution_metadata_updated_at
  BEFORE UPDATE ON aef_execution_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE aef_execution_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE aef_node_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE aef_action_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE aef_error_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE aef_performance_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for aef_execution_metadata
CREATE POLICY "Users can view their own execution metadata" ON aef_execution_metadata
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all execution metadata" ON aef_execution_metadata
  FOR ALL USING (true);

CREATE POLICY "Users can insert their own execution metadata" ON aef_execution_metadata
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for aef_node_analytics
CREATE POLICY "Users can view their own node analytics" ON aef_node_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM aef_execution_metadata 
      WHERE aef_execution_metadata.execution_id = aef_node_analytics.execution_id 
      AND aef_execution_metadata.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all node analytics" ON aef_node_analytics
  FOR ALL USING (true);

-- RLS Policies for aef_action_analytics
CREATE POLICY "Users can view their own action analytics" ON aef_action_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM aef_execution_metadata 
      WHERE aef_execution_metadata.execution_id = aef_action_analytics.execution_id 
      AND aef_execution_metadata.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all action analytics" ON aef_action_analytics
  FOR ALL USING (true);

-- RLS Policies for aef_error_analytics
CREATE POLICY "Users can view their own error analytics" ON aef_error_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM aef_execution_metadata 
      WHERE aef_execution_metadata.execution_id = aef_error_analytics.execution_id 
      AND aef_execution_metadata.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all error analytics" ON aef_error_analytics
  FOR ALL USING (true);

-- RLS Policies for aef_performance_analytics
CREATE POLICY "Users can view their own performance analytics" ON aef_performance_analytics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM aef_execution_metadata 
      WHERE aef_execution_metadata.execution_id = aef_performance_analytics.execution_id 
      AND aef_execution_metadata.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage all performance analytics" ON aef_performance_analytics
  FOR ALL USING (true);

-- Create helpful views for common queries
CREATE VIEW aef_execution_summary AS
SELECT 
  em.execution_id,
  em.workflow_id,
  em.user_id,
  em.start_time,
  em.end_time,
  em.duration,
  em.status,
  em.success,
  em.total_nodes,
  em.completed_nodes,
  em.failed_nodes,
  em.total_actions,
  em.successful_actions,
  em.failed_actions,
  em.average_action_duration,
  em.total_tokens_used,
  
  -- Count derived metrics
  COUNT(na.id) as node_analytics_count,
  COUNT(aa.id) as action_analytics_count,
  COUNT(ea.id) as error_count,
  
  -- Performance aggregates
  AVG(pa.cpu_usage) as avg_cpu_usage,
  AVG(pa.memory_usage) as avg_memory_usage,
  MAX(pa.memory_usage) as peak_memory_usage
  
FROM aef_execution_metadata em
LEFT JOIN aef_node_analytics na ON em.execution_id = na.execution_id
LEFT JOIN aef_action_analytics aa ON em.execution_id = aa.execution_id
LEFT JOIN aef_error_analytics ea ON em.execution_id = ea.execution_id
LEFT JOIN aef_performance_analytics pa ON em.execution_id = pa.execution_id
GROUP BY em.execution_id, em.workflow_id, em.user_id, em.start_time, em.end_time, 
         em.duration, em.status, em.success, em.total_nodes, em.completed_nodes, 
         em.failed_nodes, em.total_actions, em.successful_actions, em.failed_actions,
         em.average_action_duration, em.total_tokens_used;

-- Comments for documentation
COMMENT ON TABLE aef_execution_metadata IS 'Comprehensive execution tracking for AEF workflows';
COMMENT ON TABLE aef_node_analytics IS 'Per-node execution analytics and performance data';
COMMENT ON TABLE aef_action_analytics IS 'Individual action tracking within nodes';
COMMENT ON TABLE aef_error_analytics IS 'Error tracking and categorization for debugging';
COMMENT ON TABLE aef_performance_analytics IS 'System performance metrics during execution';

COMMENT ON VIEW aef_execution_summary IS 'Aggregated view of execution data with key metrics'; 