/**
 * Mock AEF Data Generation
 * 
 * This utility creates realistic mock AEF transformations for demonstration purposes.
 * It takes any SOP and creates a believable automation framework version.
 */

import { SOPDocument } from '@/lib/types/sop';
import { AEFDocument, ExecutionMethod, DEFAULT_AEF_CONFIG } from '@/lib/types/aef';
import { CheckpointConfig, CheckpointType, CheckpointCondition } from '@/lib/types/checkpoint';

/**
 * Mock execution state for demonstration
 */
export interface MockExecutionState {
  executionId: string;
  currentStep: number;
  totalSteps: number;
  isRunning: boolean;
  currentStepName: string;
  progress: number;
  logs: MockLogEntry[];
  browserUrl: string;
  lastActivity: Date;
}

export interface MockLogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'system' | 'step' | 'browser' | 'checkpoint';
  message: string;
  details?: string;
  stepName?: string;
}

/**
 * Transform any SOP into a mock AEF with realistic automation configuration
 */
export function createMockAEFTransformation(sopData: SOPDocument): AEFDocument {
  const steps = sopData.public?.nodes || [];
  
  // Create checkpoint configuration for each step
  const checkpoints: CheckpointConfig[] = steps.map(step => ({
    id: `checkpoint-${step.id}`,
    stepId: step.id,
    type: CheckpointType.BEFORE_EXECUTION,
    condition: CheckpointCondition.ALWAYS,
    required: true,
    title: `Approve: ${step.label}`,
    description: `About to execute: ${step.intent || step.label}`,
    timeout: 300, // 5 minutes
    showContext: true,
    showPreview: true
  }));

  // Create mock AEF configuration
  const aefConfig = {
    ...DEFAULT_AEF_CONFIG,
    checkpoints,
    estimatedDuration: Math.max(15, steps.length * 3), // 3 minutes per step minimum
    secrets: [
      {
        id: 'gmail_credentials',
        name: 'Gmail Access',
        description: 'Gmail account credentials for email automation',
        type: 'oauth_token' as const,
        required: true,
        stepIds: steps.filter(s => 
          s.label.toLowerCase().includes('email') || 
          s.label.toLowerCase().includes('gmail')
        ).map(s => s.id)
      },
      {
        id: 'airtable_api',
        name: 'Airtable API Key',
        description: 'Airtable API access for CRM operations',
        type: 'api_key' as const,
        required: true,
        stepIds: steps.filter(s => 
          s.label.toLowerCase().includes('airtable') || 
          s.label.toLowerCase().includes('crm') ||
          s.label.toLowerCase().includes('database')
        ).map(s => s.id)
      }
    ].filter(secret => secret.stepIds.length > 0), // Only include secrets that are actually used
  };

  // Create the AEF document
  const aefDocument: AEFDocument = {
    ...sopData,
    aef: {
      config: aefConfig,
      transformedAt: new Date(),
      transformedBy: 'user',
      version: '1.0'
    }
  };

  return aefDocument;
}

/**
 * Create mock execution state for demonstration
 */
export function createMockExecutionState(aefDocument: AEFDocument): MockExecutionState {
  const steps = aefDocument.public?.nodes || [];
  const executionId = `exec-${Date.now().toString(36)}`;
  
  // Create realistic log entries
  const logs: MockLogEntry[] = [
    {
      id: '1',
      timestamp: new Date(Date.now() - 120000), // 2 minutes ago
      level: 'info',
      category: 'system',
      message: 'Execution initialized',
      details: `Starting workflow: ${aefDocument.meta?.title}`,
    },
    {
      id: '2',
      timestamp: new Date(Date.now() - 110000),
      level: 'info',
      category: 'browser',
      message: 'Browser session created',
      details: 'Chrome browser launched in automation mode',
    },
    {
      id: '3',
      timestamp: new Date(Date.now() - 100000),
      level: 'info',
      category: 'system',
      message: 'Credentials validated',
      details: 'All required secrets verified and loaded',
    },
    {
      id: '4',
      timestamp: new Date(Date.now() - 90000),
      level: 'success',
      category: 'step',
      message: 'Step completed successfully',
      stepName: steps[0]?.label || 'Initial setup',
      details: 'Navigation to target application completed',
    },
    {
      id: '5',
      timestamp: new Date(Date.now() - 60000),
      level: 'info',
      category: 'checkpoint',
      message: 'Checkpoint approved',
      stepName: steps[1]?.label || 'Data processing',
      details: 'Human operator approved step execution',
    },
    {
      id: '6',
      timestamp: new Date(Date.now() - 30000),
      level: 'info',
      category: 'browser',
      message: 'Page interaction completed',
      details: 'Form filled and submitted successfully',
    },
    {
      id: '7',
      timestamp: new Date(Date.now() - 15000),
      level: 'warning',
      category: 'step',
      message: 'Slow response detected',
      stepName: steps[2]?.label || 'Data verification',
      details: 'Page load taking longer than expected (15s)',
    },
    {
      id: '8',
      timestamp: new Date(Date.now() - 5000),
      level: 'info',
      category: 'browser',
      message: 'Screenshot captured',
      details: 'Current page state saved for audit trail',
    }
  ];

  return {
    executionId,
    currentStep: 3,
    totalSteps: steps.length,
    isRunning: true,
    currentStepName: steps[2]?.label || 'Processing data...',
    progress: Math.round((3 / steps.length) * 100),
    logs,
    browserUrl: getBrowserUrlForWorkflow(aefDocument.meta?.title || ''),
    lastActivity: new Date()
  };
}

/**
 * Generate realistic browser URL based on workflow type
 */
function getBrowserUrlForWorkflow(workflowTitle: string): string {
  const title = workflowTitle.toLowerCase();
  
  if (title.includes('email') || title.includes('gmail')) {
    return 'https://mail.google.com/mail/u/0/#inbox';
  } else if (title.includes('airtable') || title.includes('crm')) {
    return 'https://airtable.com/app/workspace/table';
  } else if (title.includes('calendar')) {
    return 'https://calendar.google.com/calendar/u/0/r';
  } else if (title.includes('slack')) {
    return 'https://app.slack.com/client/workspace/channel';
  } else if (title.includes('linkedin')) {
    return 'https://www.linkedin.com/in/profile-management';
  } else if (title.includes('sales') || title.includes('outreach')) {
    return 'https://app.salesforce.com/lightning/page/home';
  } else {
    return 'https://app.example.com/dashboard';
  }
}

/**
 * Get a mock screenshot URL for demonstration
 */
export function getMockScreenshotUrl(browserUrl: string): string {
  // Return a placeholder image that looks like a browser screenshot
  // In a real implementation, this would be actual browser screenshots
  return `https://via.placeholder.com/1200x800/f8f9fa/6c757d?text=Browser+View:+${encodeURIComponent(new URL(browserUrl).hostname)}`;
}

/**
 * Check if we should show mock AEF data for demonstration
 */
export function shouldShowMockAEF(sopId: string): boolean {
  // For demo purposes, show mock AEF for any SOP
  // In production, this would check if the SOP has been actually transformed
  return true;
}

/**
 * Mock workflow step configurations for different types of workflows
 */
export const MOCK_WORKFLOW_CONFIGS = {
  email: {
    browserUrl: 'https://mail.google.com/mail/u/0/#inbox',
    estimatedDuration: 25,
    primaryApps: ['Gmail', 'Google Workspace'],
    riskLevel: 'medium'
  },
  crm: {
    browserUrl: 'https://airtable.com/app/workspace',
    estimatedDuration: 35,
    primaryApps: ['Airtable', 'Salesforce'],
    riskLevel: 'low'
  },
  social: {
    browserUrl: 'https://www.linkedin.com/feed/',
    estimatedDuration: 15,
    primaryApps: ['LinkedIn', 'Twitter'],
    riskLevel: 'high'
  },
  default: {
    browserUrl: 'https://app.example.com/dashboard',
    estimatedDuration: 20,
    primaryApps: ['Web Application'],
    riskLevel: 'medium'
  }
}; 