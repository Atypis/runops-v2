/**
 * AEF Utility Functions
 * 
 * Utility functions for working with AEF documents and execution states.
 * This file also serves as a validation test for our new type system.
 */

import { 
  SOPDocument, 
  AEFDocument, 
  AEFExecutionConfig,
  ExecutionMethod,
  ExecutionStatus,
  CheckpointType,
  CheckpointCondition,
  ExecutionContext,
  ExecutionState,
  ProgressInfo,
  StepStatus
} from './types';

import { DEFAULT_AEF_CONFIG } from './types/aef';
import { DEFAULT_CHECKPOINT_CONFIG } from './types/checkpoint';
import { DEFAULT_BROWSER_CONFIG } from './types/browser';

/**
 * Transform a regular SOP document into an AEF document
 * This is a basic implementation for MVP - full transformation logic comes later
 */
export function transformSopToAef(sopDocument: SOPDocument, userId: string): AEFDocument {
  // Calculate estimated step count and duration
  const totalSteps = sopDocument.public.nodes.length;
  const estimatedDuration = Math.max(totalSteps * 2, 10); // 2 minutes per step, minimum 10 minutes
  
  // Create checkpoint configuration for all steps (MVP: before execution only)
  const checkpoints = sopDocument.public.nodes.map(node => ({
    ...DEFAULT_CHECKPOINT_CONFIG,
    id: `checkpoint_${node.id}`,
    stepId: node.id,
    title: `Approve: ${node.label}`,
    description: `About to execute: ${node.intent || node.label}`
  }));
  
  // Create AEF configuration
  const aefConfig: AEFExecutionConfig = {
    ...DEFAULT_AEF_CONFIG,
    checkpoints,
    estimatedDuration
  };
  
  // Create AEF document
  const aefDocument: AEFDocument = {
    ...sopDocument,
    aef: {
      config: aefConfig,
      transformedAt: new Date(),
      transformedBy: userId,
      version: '1.0.0'
    }
  };
  
  return aefDocument;
}

/**
 * Create initial execution state for a workflow
 */
export function createExecutionState(
  aefDocument: AEFDocument, 
  userId: string
): ExecutionState {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const workflowId = aefDocument.meta.id;
  
  // Calculate progress info
  const totalSteps = aefDocument.public.nodes.length;
  const totalCheckpoints = aefDocument.aef?.config.checkpoints.length || 0;
  
  const progress: ProgressInfo = {
    totalSteps,
    completedSteps: 0,
    failedSteps: 0,
    skippedSteps: 0,
    percentage: 0,
    estimatedDuration: aefDocument.aef?.config.estimatedDuration,
    elapsedTime: 0,
    pendingCheckpoints: 0,
    totalCheckpoints
  };
  
  // Create execution context
  const context: ExecutionContext = {
    executionId,
    userId,
    workflowId,
    variables: new Map(),
    startedAt: new Date(),
    lastActivityAt: new Date(),
    availableSecrets: [],
    metadata: {}
  };
  
  // Create initial execution state
  const executionState: ExecutionState = {
    id: executionId,
    workflowId,
    userId,
    status: ExecutionStatus.IDLE,
    progress,
    completedSteps: new Set(),
    failedSteps: new Map(),
    skippedSteps: new Set(),
    context,
    startedAt: new Date(),
    lastActivityAt: new Date(),
    pendingCheckpoints: [],
    metadata: {
      version: '1.0.0',
      transformedFrom: aefDocument.meta.id,
      executionMode: aefDocument.aef?.config.checkpoints.length ? 'checkpoint' : 'automatic'
    }
  };
  
  return executionState;
}

/**
 * Update execution progress based on step completion
 */
export function updateExecutionProgress(
  state: ExecutionState, 
  stepId: string, 
  status: StepStatus
): ExecutionState {
  const updatedState = { ...state };
  
  // Update step tracking
  switch (status) {
    case StepStatus.COMPLETED:
      updatedState.completedSteps.add(stepId);
      updatedState.progress.completedSteps = updatedState.completedSteps.size;
      break;
    case StepStatus.FAILED:
      updatedState.progress.failedSteps += 1;
      break;
    case StepStatus.SKIPPED:
      updatedState.skippedSteps.add(stepId);
      updatedState.progress.skippedSteps = updatedState.skippedSteps.size;
      break;
  }
  
  // Recalculate progress percentage
  const { totalSteps, completedSteps, skippedSteps } = updatedState.progress;
  updatedState.progress.percentage = Math.round(((completedSteps + skippedSteps) / totalSteps) * 100);
  
  // Update timing
  updatedState.lastActivityAt = new Date();
  updatedState.progress.elapsedTime = Math.round(
    (updatedState.lastActivityAt.getTime() - updatedState.startedAt.getTime()) / (1000 * 60)
  );
  
  return updatedState;
}

/**
 * Check if an SOP document has been transformed to AEF
 */
export function isAEFDocument(document: SOPDocument | AEFDocument): document is AEFDocument {
  return 'aef' in document && document.aef !== undefined;
}

/**
 * Get the next step to execute in a workflow
 * This is a simple sequential implementation for MVP
 */
export function getNextStep(state: ExecutionState, aefDocument: AEFDocument): string | null {
  const allSteps = aefDocument.public.nodes.map(node => node.id);
  const completedAndSkipped = new Set([
    ...Array.from(state.completedSteps),
    ...Array.from(state.skippedSteps)
  ]);
  
  // Find first step that hasn't been completed or skipped
  for (const stepId of allSteps) {
    if (!completedAndSkipped.has(stepId)) {
      return stepId;
    }
  }
  
  return null; // All steps completed
}

/**
 * Validate AEF document structure
 */
export function validateAEFDocument(document: AEFDocument): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check basic structure
  if (!document.aef) {
    errors.push('Missing AEF configuration');
    return { valid: false, errors };
  }
  
  if (!document.aef.config) {
    errors.push('Missing AEF execution configuration');
  }
  
  // Validate execution method
  if (!Object.values(ExecutionMethod).includes(document.aef.config.executionMethod)) {
    errors.push(`Invalid execution method: ${document.aef.config.executionMethod}`);
  }
  
  // Validate checkpoints reference valid steps
  const validStepIds = new Set(document.public.nodes.map(node => node.id));
  const invalidCheckpoints = document.aef.config.checkpoints.filter(
    checkpoint => !validStepIds.has(checkpoint.stepId)
  );
  
  if (invalidCheckpoints.length > 0) {
    errors.push(`Checkpoints reference invalid steps: ${invalidCheckpoints.map(c => c.stepId).join(', ')}`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a mock AEF document for testing
 */
export function createMockAEFDocument(): AEFDocument {
  const mockSOP: SOPDocument = {
    meta: {
      id: 'mock_workflow_001',
      title: 'Test Email Processing Workflow',
      version: '1.0',
      goal: 'Process daily emails efficiently',
      purpose: 'Automate email review and CRM updates',
      owner: ['test@example.com']
    },
    public: {
      triggers: [{
        type: 'cron',
        config: '0 9 * * *',
        description: 'Run every morning at 9 AM'
      }],
      nodes: [
        {
          id: 'step_1',
          type: 'task',
          label: 'Open Gmail',
          intent: 'Navigate to Gmail inbox',
          context: 'Click on Gmail tab or navigate to gmail.com'
        },
        {
          id: 'step_2', 
          type: 'task',
          label: 'Review Emails',
          intent: 'Check for new emails',
          context: 'Scan inbox for unread emails'
        },
        {
          id: 'step_3',
          type: 'decision',
          label: 'Is Email Important?',
          intent: 'Determine if email requires action',
          context: 'Check sender and subject line'
        }
      ],
      edges: [
        { source: 'step_1', target: 'step_2', condition: 'next' },
        { source: 'step_2', target: 'step_3', condition: 'next' }
      ],
      variables: {},
      clarification_requests: []
    },
    private: {
      skills: [],
      steps: [],
      artifacts: []
    }
  };
  
  return transformSopToAef(mockSOP, 'test_user');
}

/**
 * Re-export defaults for convenience
 */
export {
  DEFAULT_AEF_CONFIG,
  DEFAULT_CHECKPOINT_CONFIG, 
  DEFAULT_BROWSER_CONFIG
}; 