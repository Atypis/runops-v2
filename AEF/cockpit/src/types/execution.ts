export type TaskType = 'navigate' | 'click' | 'type' | 'read' | 'wait' | 'decision' | 'loop';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type ExecutionStatus = 'pending' | 'running' | 'success' | 'warning' | 'error' | 'paused' | 'cancelled';

export interface ExecutionStep {
  id: string;
  type: TaskType;
  description: string;
  target?: string;
  input_data?: string;
  confidence: ConfidenceLevel;
  reasoning: string;
  fallback_options: string[];
  status: ExecutionStatus;
  start_time?: string;
  end_time?: string;
  execution_time?: number;
  error_message?: string;
  screenshot_url?: string;
  requires_approval?: boolean;
  approved?: boolean;
}

export interface ExecutionPlan {
  workflow_id: string;
  title: string;
  description: string;
  steps: ExecutionStep[];
  estimated_duration: number;
  risk_assessment: string;
  human_checkpoints: number[];
  status: ExecutionStatus;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  current_step_index: number;
  success_rate: number;
  total_execution_time: number;
}

export interface ExecutionMetrics {
  total_steps: number;
  completed_steps: number;
  successful_steps: number;
  failed_steps: number;
  pending_approvals: number;
  average_confidence: number;
  estimated_remaining_time: number;
}

export interface WorkflowContext {
  sop_id: string;
  sop_title: string;
  applications_used: string[];
  variables: Record<string, any>;
  goal: string;
  purpose: string;
}

export interface ApprovalRequest {
  step_id: string;
  step_index: number;
  description: string;
  confidence: ConfidenceLevel;
  reasoning: string;
  fallback_options: string[];
  context: string;
  timestamp: string;
  requires_immediate_attention: boolean;
}

export interface ExecutionLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  step_id?: string;
  details?: any;
}

export interface BrowserState {
  current_url: string;
  page_title: string;
  screenshot_url?: string;
  active_elements: string[];
  page_load_time: number;
  last_action: string;
  last_action_time: string;
} 