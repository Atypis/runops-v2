/**
 * Central exports for all AEF (Agentic Execution Framework) types
 * 
 * This file provides a single import point for all AEF-related types,
 * making it easy for other parts of the application to use them.
 */

// Core SOP types (existing)
export * from './sop';

// New AEF types
export * from './aef';
export * from './execution';
export * from './checkpoint';
export * from './browser';
export * from './analytics';

// Memory Management types
export * from '../memory/types';

// Re-export commonly used types and values
export type {
  AEFDocument,
  AEFExecutionConfig,
  AEFTransformResult
} from './aef';

export type {
  CheckpointConfig,
  CheckpointData,
  CheckpointType,
  CheckpointAction,
  WorkflowCheckpointConfig
} from './checkpoint';

export type {
  BrowserSession,
  BrowserActionRequest,
  BrowserActionResult,
  BrowserSessionManager
} from './browser';

export type {
  ExecutionState,
  ExecutionContext,
  StepResult,
  ProgressInfo,
  ExecutionCommand
} from './execution';

export type {
  ExecutionAnalytics,
  WorkflowAnalytics,
  SystemMetrics
} from './analytics';

export type {
  MemoryArtifact,
  MemoryInputs,
  MemoryProcessing,
  MemoryOutputs,
  NodeExecutionContext,
  MemorySearchFilters,
  ExecutionMemorySummary
} from '../memory/types'; 