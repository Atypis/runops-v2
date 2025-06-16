-- Universal Memory Artifacts System for AEF
-- This migration creates the complete memory visibility infrastructure
-- 
-- Captures every conceivable piece of information for debugging:
-- - Exact LLM prompts and responses
-- - DOM snapshots and accessibility trees  
-- - Element selection reasoning
-- - Context flow between nodes
-- - Browser interactions and state changes
--
-- Universal schema works for all 31+ action/node types in AEF

-- 1. Create universal memory artifacts table
CREATE TABLE memory_artifacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id TEXT NOT NULL, -- Supports both "vnc-env-xxx" and plain UUIDs
  node_id TEXT NOT NULL,
  action_index INTEGER, -- Sequential action numbering within node (nullable for single-action nodes)
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- === UNIVERSAL MEMORY ARTIFACT DATA (JSONB) ===
  
  -- INPUT ARTIFACTS: What goes INTO the action/node
  inputs JSONB NOT NULL DEFAULT '{
    "previousState": {},
    "nodeVariables": {},
    "credentials": {},
    "environment": {
      "currentUrl": null,
      "domSnapshot": null,
      "activeTab": null,
      "sessionState": {}
    },
    "contextData": {
      "loopContext": null,
      "parentContext": {}
    },
    "actionInputs": {
      "instruction": null,
      "schema": null,
      "target": null,
      "data": null,
      "timeout": null,
      "config": {}
    }
  }',
  
  -- PROCESSING ARTIFACTS: What happens DURING execution  
  processing JSONB NOT NULL DEFAULT '{
    "llmInteractions": [],
    "actions": [],
    "browserEvents": [],
    "errors": []
  }',
  
  -- OUTPUT ARTIFACTS: What comes OUT of the action/node
  outputs JSONB NOT NULL DEFAULT '{
    "primaryData": null,
    "stateChanges": {},
    "extractedData": {},
    "decisionResult": null,
    "loopResult": null,
    "navigationResult": null,
    "executionMetadata": {
      "status": "pending",
      "duration": 0,
      "retryCount": 0,
      "finalState": {},
      "resourceUsage": {}
    }
  }',
  
  -- MEMORY FORWARDING CONFIG: How information flows to next nodes
  forwarding_rules JSONB NOT NULL DEFAULT '{
    "forwardToNext": [],
    "keepInLoop": [],
    "aggregateAcrossIterations": [],
    "clearFromMemory": [],
    "compressLargeData": false,
    "conditionalForwarding": []
  }',
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure unique artifacts per execution/node/action combination
  UNIQUE(execution_id, node_id, action_index)
);

-- 2. Create performance-optimized indexes for sub-100ms queries
CREATE INDEX idx_memory_artifacts_execution_id ON memory_artifacts (execution_id);
CREATE INDEX idx_memory_artifacts_user_id ON memory_artifacts (user_id);
CREATE INDEX idx_memory_artifacts_node_id ON memory_artifacts (node_id);
CREATE INDEX idx_memory_artifacts_timestamp ON memory_artifacts (timestamp DESC);

-- Composite indexes for common query patterns
CREATE INDEX idx_memory_artifacts_user_execution ON memory_artifacts (user_id, execution_id);
CREATE INDEX idx_memory_artifacts_execution_node ON memory_artifacts (execution_id, node_id);
CREATE INDEX idx_memory_artifacts_execution_timestamp ON memory_artifacts (execution_id, timestamp ASC);
CREATE INDEX idx_memory_artifacts_user_timestamp ON memory_artifacts (user_id, timestamp DESC);

-- JSONB indexes for efficient queries on memory artifact data
CREATE INDEX idx_memory_artifacts_inputs_gin ON memory_artifacts USING GIN (inputs);
CREATE INDEX idx_memory_artifacts_outputs_gin ON memory_artifacts USING GIN (outputs);
CREATE INDEX idx_memory_artifacts_processing_gin ON memory_artifacts USING GIN (processing);

-- Specific JSONB path indexes for common queries
CREATE INDEX idx_memory_artifacts_status ON memory_artifacts USING GIN ((outputs -> 'executionMetadata' -> 'status'));
CREATE INDEX idx_memory_artifacts_success ON memory_artifacts USING GIN ((outputs -> 'executionMetadata' -> 'success'));

-- 3. Create triggers for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_memory_artifacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_memory_artifacts_updated_at
  BEFORE UPDATE ON memory_artifacts
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_artifacts_updated_at();

-- 4. Enable Row Level Security (RLS)
ALTER TABLE memory_artifacts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for memory_artifacts
CREATE POLICY "Users can view their own memory artifacts" ON memory_artifacts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own memory artifacts" ON memory_artifacts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own memory artifacts" ON memory_artifacts
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own memory artifacts" ON memory_artifacts
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all memory artifacts (for system operations)
CREATE POLICY "Service role can manage all memory artifacts" ON memory_artifacts
  FOR ALL USING (true);

-- 5. Create helpful views for common memory queries

-- Memory flow view: Shows memory artifacts in execution order
CREATE VIEW memory_flow AS
SELECT 
  ma.execution_id,
  ma.node_id,
  ma.action_index,
  ma.timestamp,
  ma.inputs,
  ma.processing,
  ma.outputs,
  ma.forwarding_rules,
  -- Extract commonly queried fields for easier access
  (ma.outputs -> 'executionMetadata' -> 'status')::text as status,
  (ma.outputs -> 'executionMetadata' -> 'duration')::integer as duration,
  (ma.outputs -> 'executionMetadata' -> 'success')::boolean as success,
  -- Count LLM interactions
  jsonb_array_length(COALESCE(ma.processing -> 'llmInteractions', '[]'::jsonb)) as llm_interaction_count,
  -- Count browser events  
  jsonb_array_length(COALESCE(ma.processing -> 'browserEvents', '[]'::jsonb)) as browser_event_count
FROM memory_artifacts ma
ORDER BY ma.execution_id, ma.timestamp ASC;

-- Memory debugging view: Focused on error analysis and troubleshooting
CREATE VIEW memory_debug AS
SELECT 
  ma.execution_id,
  ma.node_id,
  ma.action_index,
  ma.timestamp,
  -- Input context
  ma.inputs -> 'actionInputs' -> 'instruction' as instruction,
  ma.inputs -> 'environment' -> 'currentUrl' as current_url,
  -- Processing details
  ma.processing -> 'errors' as errors,
  jsonb_array_length(COALESCE(ma.processing -> 'errors', '[]'::jsonb)) as error_count,
  -- Output status
  ma.outputs -> 'executionMetadata' -> 'status' as status,
  ma.outputs -> 'executionMetadata' -> 'duration' as duration,
  -- Primary result
  ma.outputs -> 'primaryData' as result
FROM memory_artifacts ma
WHERE 
  -- Focus on failed or error-prone executions
  (ma.outputs -> 'executionMetadata' -> 'status')::text IN ('error', 'failed', 'partial')
  OR jsonb_array_length(COALESCE(ma.processing -> 'errors', '[]'::jsonb)) > 0
ORDER BY ma.execution_id, ma.timestamp ASC;

-- Execution summary view: Aggregated memory statistics per execution
CREATE VIEW memory_execution_summary AS
SELECT 
  ma.execution_id,
  ma.user_id,
  COUNT(*) as total_artifacts,
  COUNT(DISTINCT ma.node_id) as unique_nodes,
  MIN(ma.timestamp) as first_artifact,
  MAX(ma.timestamp) as last_artifact,
  EXTRACT(EPOCH FROM (MAX(ma.timestamp) - MIN(ma.timestamp))) as execution_duration_seconds,
  
  -- Status breakdown
  SUM(CASE WHEN (ma.outputs -> 'executionMetadata' -> 'status')::text = 'success' THEN 1 ELSE 0 END) as successful_artifacts,
  SUM(CASE WHEN (ma.outputs -> 'executionMetadata' -> 'status')::text IN ('error', 'failed') THEN 1 ELSE 0 END) as failed_artifacts,
  
  -- Resource usage
  SUM((ma.outputs -> 'executionMetadata' -> 'resourceUsage' -> 'tokens')::integer) as total_tokens,
  SUM((ma.outputs -> 'executionMetadata' -> 'resourceUsage' -> 'apiCalls')::integer) as total_api_calls,
  
  -- Error analysis
  SUM(jsonb_array_length(COALESCE(ma.processing -> 'errors', '[]'::jsonb))) as total_errors,
  
  -- LLM interaction analysis
  SUM(jsonb_array_length(COALESCE(ma.processing -> 'llmInteractions', '[]'::jsonb))) as total_llm_interactions
  
FROM memory_artifacts ma
GROUP BY ma.execution_id, ma.user_id
ORDER BY last_artifact DESC;

-- 6. Create functions for common memory operations

-- Function to get memory flow for a specific execution
CREATE OR REPLACE FUNCTION get_execution_memory_flow(exec_id TEXT)
RETURNS TABLE (
  node_id TEXT,
  action_index INTEGER,
  timestamp TIMESTAMPTZ,
  instruction TEXT,
  status TEXT,
  duration INTEGER,
  llm_interactions INTEGER,
  browser_events INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ma.node_id,
    ma.action_index,
    ma.timestamp,
    (ma.inputs -> 'actionInputs' -> 'instruction')::text,
    (ma.outputs -> 'executionMetadata' -> 'status')::text,
    (ma.outputs -> 'executionMetadata' -> 'duration')::integer,
    jsonb_array_length(COALESCE(ma.processing -> 'llmInteractions', '[]'::jsonb)),
    jsonb_array_length(COALESCE(ma.processing -> 'browserEvents', '[]'::jsonb))
  FROM memory_artifacts ma
  WHERE ma.execution_id = exec_id
  ORDER BY ma.timestamp ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get detailed memory for specific node
CREATE OR REPLACE FUNCTION get_node_memory_details(exec_id TEXT, node_id_param TEXT)
RETURNS TABLE (
  action_index INTEGER,
  inputs JSONB,
  processing JSONB,
  outputs JSONB,
  forwarding_rules JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ma.action_index,
    ma.inputs,
    ma.processing,
    ma.outputs,
    ma.forwarding_rules
  FROM memory_artifacts ma
  WHERE ma.execution_id = exec_id 
    AND ma.node_id = node_id_param
  ORDER BY ma.action_index ASC NULLS FIRST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Add helpful comments for documentation
COMMENT ON TABLE memory_artifacts IS 'Universal memory visibility system capturing complete information flow for every action/node execution in AEF. Enables surgical debugging and AI workflow optimization.';

COMMENT ON COLUMN memory_artifacts.execution_id IS 'Execution identifier - supports both VNC prefixed IDs (vnc-env-xxx) and plain UUIDs';
COMMENT ON COLUMN memory_artifacts.node_id IS 'Node identifier within the workflow';
COMMENT ON COLUMN memory_artifacts.action_index IS 'Sequential action number within node (nullable for single-action nodes)';
COMMENT ON COLUMN memory_artifacts.inputs IS 'Input artifacts: previous state, variables, credentials, environment, context, and action-specific inputs';
COMMENT ON COLUMN memory_artifacts.processing IS 'Processing artifacts: LLM interactions, browser events, actions performed, errors encountered';
COMMENT ON COLUMN memory_artifacts.outputs IS 'Output artifacts: results, state changes, metadata, and type-specific outputs';
COMMENT ON COLUMN memory_artifacts.forwarding_rules IS 'Memory forwarding configuration: what information flows to next nodes and how';

COMMENT ON VIEW memory_flow IS 'Shows memory artifacts in execution order with extracted commonly-used fields';
COMMENT ON VIEW memory_debug IS 'Focused view for debugging failed executions and error analysis';
COMMENT ON VIEW memory_execution_summary IS 'Aggregated memory statistics and metrics per execution';

COMMENT ON FUNCTION get_execution_memory_flow IS 'Returns memory flow overview for a specific execution';
COMMENT ON FUNCTION get_node_memory_details IS 'Returns complete memory details for a specific node within an execution'; 