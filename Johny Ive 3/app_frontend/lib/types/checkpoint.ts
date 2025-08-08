/**
 * Checkpoint System Types
 * 
 * Defines the interfaces for human intervention points in AEF workflows,
 * allowing users to maintain control over automation execution.
 */

/**
 * Types of checkpoints that can be configured
 */
export enum CheckpointType {
  BEFORE_EXECUTION = 'before_execution',   // MVP: Default checkpoint type
  AFTER_EXECUTION = 'after_execution',     // Future enhancement
  ON_ERROR = 'on_error',                   // Future enhancement
  DATA_VALIDATION = 'data_validation',     // Future enhancement
  MANUAL_REVIEW = 'manual_review',         // Future enhancement
  CUSTOM = 'custom'                        // Future enhancement
}

/**
 * Conditions that can trigger checkpoints
 */
export enum CheckpointCondition {
  ALWAYS = 'always',                       // MVP: Always require approval
  ON_RISK = 'on_risk',                     // Future: Risk-based checkpoints
  ON_NEW_DATA = 'on_new_data',             // Future: When new data is encountered
  ON_PATTERN_CHANGE = 'on_pattern_change', // Future: When workflow deviates
  CUSTOM_RULE = 'custom_rule'              // Future: User-defined rules
}

/**
 * Actions a user can take at a checkpoint
 */
export enum CheckpointAction {
  APPROVE = 'approve',       // Continue execution
  REJECT = 'reject',         // Stop execution
  SKIP = 'skip',             // Skip this step and continue
  MODIFY = 'modify',         // Modify step parameters (future)
  RETRY = 'retry',           // Retry the step (for error checkpoints)
  PAUSE = 'pause'            // Pause execution for later
}

/**
 * Configuration for an individual checkpoint
 */
export interface CheckpointConfig {
  id: string;
  stepId: string;                          // Which step this checkpoint applies to
  type: CheckpointType;
  condition: CheckpointCondition;
  
  // Timing configuration
  timeout?: number;                        // Seconds to wait for user response
  defaultAction?: CheckpointAction;        // What to do if timeout occurs
  
  // Display configuration
  title?: string;                          // Custom checkpoint title
  description?: string;                    // Custom checkpoint description
  showContext?: boolean;                   // Show execution context
  showPreview?: boolean;                   // Show preview of next action
  
  // Advanced configuration (future enhancement)
  required?: boolean;                      // Can this checkpoint be bypassed?
  delegatable?: boolean;                   // Can approval be delegated?
  requiredApprovers?: string[];            // Who can approve this checkpoint
}

/**
 * Real-time checkpoint data presented to user
 */
export interface CheckpointData {
  id: string;
  stepId: string;
  stepName: string;
  executionId: string;
  
  // Checkpoint configuration
  config: CheckpointConfig;
  
  // Current context information
  description: string;
  currentContext: any;                     // Current execution variables
  previewData?: any;                       // What will happen next
  browserState?: {
    url?: string;
    screenshot?: string;                   // Base64 encoded screenshot
    pageTitle?: string;
  };
  
  // Risk and impact assessment
  risksAndImpacts?: string[];
  suggestedAction?: CheckpointAction;
  
  // Timing information
  createdAt: Date;
  expiresAt?: Date;
  
  // Status tracking
  status: CheckpointStatus;
  responseAction?: CheckpointAction;
  responseData?: any;
  respondedAt?: Date;
  respondedBy?: string;
}

/**
 * Current status of a checkpoint
 */
export enum CheckpointStatus {
  PENDING = 'pending',                     // Waiting for user response
  APPROVED = 'approved',                   // User approved continuation
  REJECTED = 'rejected',                   // User rejected/stopped execution
  SKIPPED = 'skipped',                     // User chose to skip this step
  TIMEOUT = 'timeout',                     // Checkpoint timed out
  EXPIRED = 'expired'                      // Checkpoint expired/cleaned up
}

/**
 * Checkpoint response from user
 */
export interface CheckpointResponse {
  checkpointId: string;
  action: CheckpointAction;
  data?: any;                              // Additional data for modify actions
  comment?: string;                        // Optional user comment
  timestamp: Date;
}

/**
 * Checkpoint queue for managing multiple pending checkpoints
 */
export interface CheckpointQueue {
  executionId: string;
  checkpoints: CheckpointData[];
  maxPending?: number;                     // Maximum pending checkpoints
  totalProcessed: number;
  totalApproved: number;
  totalRejected: number;
}

/**
 * Checkpoint configuration for workflow-level settings
 */
export interface WorkflowCheckpointConfig {
  enabled: boolean;                        // Global checkpoint toggle
  mode: 'all_steps' | 'risky_steps' | 'custom'; // MVP: 'all_steps'
  defaultType: CheckpointType;             // Default checkpoint type for steps
  defaultTimeout: number;                  // Default timeout in seconds
  defaultAction: CheckpointAction;         // Default action on timeout
  bulkApprovalEnabled?: boolean;           // Future: Allow bulk approvals
}

/**
 * Default checkpoint configurations for MVP
 */
export const DEFAULT_CHECKPOINT_CONFIG: CheckpointConfig = {
  id: '',
  stepId: '',
  type: CheckpointType.BEFORE_EXECUTION,
  condition: CheckpointCondition.ALWAYS,
  timeout: 300,                            // 5 minutes
  defaultAction: CheckpointAction.REJECT,  // Safe default: stop if no response
  showContext: true,
  showPreview: true,
  required: true
};

export const DEFAULT_WORKFLOW_CHECKPOINT_CONFIG: WorkflowCheckpointConfig = {
  enabled: true,
  mode: 'all_steps',
  defaultType: CheckpointType.BEFORE_EXECUTION,
  defaultTimeout: 300,
  defaultAction: CheckpointAction.REJECT,
  bulkApprovalEnabled: false
}; 