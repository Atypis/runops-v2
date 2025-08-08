/**
 * Execution State and Control Types
 * 
 * Defines the interfaces for managing AEF workflow execution state,
 * progress tracking, and runtime control.
 */

import { CheckpointData } from './checkpoint';
import { BrowserSession } from './browser';

/**
 * Individual step execution status
 */
export enum StepStatus {
  PENDING = 'pending',                     // Not yet executed
  PREPARING = 'preparing',                 // Setting up for execution
  RUNNING = 'running',                     // Currently executing
  WAITING_CHECKPOINT = 'waiting_checkpoint', // Paused for human approval
  COMPLETED = 'completed',                 // Successfully completed
  FAILED = 'failed',                       // Failed with error
  SKIPPED = 'skipped',                     // Skipped by user or condition
  BLOCKED = 'blocked',                     // Blocked by dependency
  TIMEOUT = 'timeout',                     // Step timed out
  CANCELLED = 'cancelled'                  // Cancelled by user
}

/**
 * Execution context that flows between steps
 * This provides the global variable scope for workflow execution
 */
export interface ExecutionContext {
  // Core identification
  executionId: string;
  userId: string;
  workflowId: string;
  
  // Global variables accessible to all steps
  variables: Map<string, any>;
  
  // Browser automation state
  browserSession?: BrowserSession;
  
  // Current execution state
  currentStepId?: string;
  previousStepId?: string;
  nextStepId?: string;
  
  // Timing information
  startedAt: Date;
  lastActivityAt: Date;
  
  // Configuration
  enableDetailedLogging?: boolean;
  stepTimeout?: number;
  
  // Security context
  availableSecrets: string[];              // IDs of secrets this execution can access
  
  // Runtime metadata
  metadata: Record<string, any>;           // Additional execution metadata
}

/**
 * Result of executing a single step
 */
export interface StepResult {
  stepId: string;
  status: StepStatus;
  
  // Execution timing
  startedAt: Date;
  completedAt?: Date;
  duration?: number;                       // milliseconds
  
  // Success/failure information
  success: boolean;
  error?: {
    code: string;
    message: string;
    details?: any;
    recoverable?: boolean;
  };
  
  // Data produced by the step
  outputs?: Record<string, any>;          // Variables set by this step
  
  // Browser automation details
  browserActions?: BrowserAction[];       // Actions performed
  screenshots?: string[];                 // Base64 encoded screenshots
  
  // Logging and debugging
  logs?: string[];
  warnings?: string[];
  
  // Checkpoint information
  checkpointRequired?: boolean;
  checkpointData?: CheckpointData;
}

/**
 * Browser action performed during step execution
 */
export interface BrowserAction {
  id: string;
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'wait' | 'screenshot';
  selector?: string;
  value?: string;
  url?: string;
  timestamp: Date;
  duration?: number;
  success: boolean;
  error?: string;
}

/**
 * Progress information for execution tracking
 */
export interface ProgressInfo {
  // Step counting
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  
  // Progress percentage (0-100)
  percentage: number;
  
  // Time estimation
  estimatedDuration?: number;              // minutes
  elapsedTime: number;                     // minutes
  remainingTime?: number;                  // minutes
  
  // Current activity
  currentStepName?: string;
  currentActivity?: string;
  
  // Checkpoint status
  pendingCheckpoints: number;
  totalCheckpoints: number;
}

/**
 * Overall execution state for a workflow
 */
export interface ExecutionState {
  // Core identification
  id: string;
  workflowId: string;
  userId: string;
  
  // Current status
  status: ExecutionStatus;
  currentStepId?: string;
  
  // Progress tracking
  progress: ProgressInfo;
  
  // Step tracking
  completedSteps: Set<string>;
  failedSteps: Map<string, StepResult>;
  skippedSteps: Set<string>;
  
  // Execution context
  context: ExecutionContext;
  
  // Browser session
  browserSessionId?: string;
  
  // Timing information
  startedAt: Date;
  pausedAt?: Date;
  completedAt?: Date;
  lastActivityAt: Date;
  
  // Error information
  lastError?: {
    stepId: string;
    error: any;
    timestamp: Date;
  };
  
  // Checkpoint tracking
  pendingCheckpoints: CheckpointData[];
  
  // Execution metadata
  metadata: {
    version: string;                       // AEF version used
    transformedFrom: string;               // Original SOP ID
    executionMode: 'checkpoint' | 'automatic';
    retryCount?: number;
    pauseCount?: number;
  };
}

/**
 * Overall execution status (from aef.ts, but redefined here to avoid circular imports)
 */
export enum ExecutionStatus {
  IDLE = 'idle',
  PREPARING = 'preparing',
  RUNNING = 'running',
  PAUSED = 'paused',
  WAITING_CHECKPOINT = 'waiting_checkpoint',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

/**
 * Execution control commands
 */
export enum ExecutionCommand {
  START = 'start',
  PAUSE = 'pause',
  RESUME = 'resume',
  STOP = 'stop',
  CANCEL = 'cancel',
  RETRY_STEP = 'retry_step',
  SKIP_STEP = 'skip_step',
  RESTART = 'restart'
}

/**
 * Execution control request
 */
export interface ExecutionControlRequest {
  executionId: string;
  command: ExecutionCommand;
  stepId?: string;                         // For step-specific commands
  data?: any;                              // Additional command data
  userId: string;
  timestamp: Date;
}

/**
 * Helper functions for execution state management
 */
export class ExecutionStateHelper {
  /**
   * Calculate progress percentage based on step completion
   */
  static calculateProgress(state: ExecutionState): number {
    const { totalSteps, completedSteps, skippedSteps } = state.progress;
    if (totalSteps === 0) return 0;
    return Math.round(((completedSteps + skippedSteps) / totalSteps) * 100);
  }
  
  /**
   * Check if execution is in a running state
   */
  static isActive(state: ExecutionState): boolean {
    return [
      ExecutionStatus.RUNNING,
      ExecutionStatus.WAITING_CHECKPOINT,
      ExecutionStatus.PAUSED
    ].includes(state.status);
  }
  
  /**
   * Check if execution can be resumed
   */
  static canResume(state: ExecutionState): boolean {
    return [
      ExecutionStatus.PAUSED,
      ExecutionStatus.WAITING_CHECKPOINT,
      ExecutionStatus.FAILED
    ].includes(state.status);
  }
  
  /**
   * Get the next step ID to execute
   */
  static getNextStepId(state: ExecutionState, allStepIds: string[]): string | null {
    // Simple sequential execution for MVP
    const currentIndex = allStepIds.indexOf(state.currentStepId || '');
    const nextIndex = currentIndex + 1;
    return nextIndex < allStepIds.length ? allStepIds[nextIndex] : null;
  }
} 