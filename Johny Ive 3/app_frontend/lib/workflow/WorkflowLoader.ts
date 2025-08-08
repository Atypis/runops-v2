// Client-side workflow loader - uses API endpoints instead of direct file access

export interface WorkflowMeta {
  id: string;
  title: string;
  version: string;
  goal?: string;
  purpose?: string;
  owner?: string[];
  created?: string;
  updated?: string;
  aiGenerated?: boolean;
  tags?: string[];
}

export interface WorkflowAction {
  type: 'navigate' | 'navigate_or_switch_tab' | 'click' | 'type' | 'wait' | 'wait_for_navigation' | 'act' | 'extract' | 'visual_scan' | 'conditional_auth';
  instruction: string;
  target?: {
    url?: string;
    selector?: string;
    url_contains?: string;
  };
  data?: any;
  timeout?: number;
  schema?: any;
  credentialField?: string;
}

export interface WorkflowNode {
  id: string;
  type: 'atomic_task' | 'compound_task' | 'iterative_loop';
  label: string;
  intent: string;
  context?: string;
  parentId?: string;
  children?: string[];
  canExecuteAsGroup?: boolean;
  credentialsRequired?: Record<string, string[]>;
  preferredAuthMethods?: Record<string, string[]>;
  actions: WorkflowAction[];
}

export interface WorkflowFlow {
  from: string;
  to: string;
  condition?: string;
}

export interface WorkflowExecution {
  environment?: {
    required_tabs?: Array<{
      name: string;
      url: string;
    }>;
  };
  workflow: {
    nodes: WorkflowNode[];
    flow: WorkflowFlow[];
  };
}

export interface WorkflowConfig {
  executionTimeout?: number;
  retryAttempts?: number;
  hybridMode?: boolean;
  pauseOnErrors?: boolean;
}

export interface AEFWorkflow {
  meta: WorkflowMeta;
  execution: WorkflowExecution;
  config?: WorkflowConfig;
}

export class WorkflowValidationError extends Error {
  public validationErrors: any[];
  
  constructor(message: string, errors: any[]) {
    super(message);
    this.name = 'WorkflowValidationError';
    this.validationErrors = errors;
  }
}

export class WorkflowLoadError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'WorkflowLoadError';
  }
}

export class WorkflowLoader {
  private static cache = new Map<string, AEFWorkflow>();

  /**
   * Load a workflow by ID using API endpoint
   */
  async loadWorkflow(workflowId: string): Promise<AEFWorkflow> {
    try {
      // In development, skip cache to always get fresh data
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      // Check cache first (only in production)
      if (!isDevelopment && WorkflowLoader.cache.has(workflowId)) {
        return WorkflowLoader.cache.get(workflowId)!;
      }

      console.log(`🔄 [WorkflowLoader] Loading workflow via API: ${workflowId} ${isDevelopment ? '(dev mode - bypassing cache)' : ''}`);

      // Add cache busting in development
      const cacheBuster = isDevelopment ? `?t=${Date.now()}` : '';
      const response = await fetch(`/api/aef/workflow/${workflowId}${cacheBuster}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 404) {
          throw new WorkflowLoadError(`Workflow not found: ${workflowId}`);
        }
        if (response.status === 400 && errorData.validationErrors) {
          throw new WorkflowValidationError(
            errorData.error || 'Workflow validation failed',
            errorData.validationErrors
          );
        }
        throw new WorkflowLoadError(errorData.error || 'Failed to load workflow');
      }

      const result = await response.json();
      const workflow = result.workflow as AEFWorkflow;

      // Cache the workflow
      WorkflowLoader.cache.set(workflowId, workflow);

      console.log(`✅ [WorkflowLoader] Successfully loaded workflow: ${workflow.meta.title}`);
      return workflow;

    } catch (error) {
      if (error instanceof WorkflowValidationError || error instanceof WorkflowLoadError) {
        throw error;
      }
      console.error(`❌ [WorkflowLoader] Failed to load workflow ${workflowId}:`, error);
      throw new WorkflowLoadError(`Failed to load workflow: ${workflowId}`, error as Error);
    }
  }

  /**
   * Load a workflow from JSON string (client-side validation)
   */
  loadWorkflowFromJSON(jsonString: string): AEFWorkflow {
    try {
      const workflow = JSON.parse(jsonString);
      
      // Basic validation - full validation happens server-side
      if (!workflow.meta || !workflow.execution) {
        throw new WorkflowValidationError('Invalid workflow format: missing meta or execution section', []);
      }

      return workflow as AEFWorkflow;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new WorkflowLoadError('Invalid JSON format', error);
      }
      if (error instanceof WorkflowValidationError) {
        throw error;
      }
      throw new WorkflowLoadError('Failed to parse workflow JSON', error as Error);
    }
  }

  /**
   * List available workflows using API
   */
  async listWorkflows(): Promise<Array<{id: string, title: string, version: string, description: string}>> {
    try {
      const response = await fetch('/api/aef/workflow', { method: 'POST' });
      
      if (!response.ok) {
        throw new Error('Failed to fetch workflow list');
      }

      const result = await response.json();
      return result.workflows || [];
    } catch (error) {
      console.error('Failed to list workflows:', error);
      return [];
    }
  }

  /**
   * Get workflow metadata without loading full workflow
   */
  async getWorkflowMeta(workflowId: string): Promise<WorkflowMeta> {
    try {
      const workflow = await this.loadWorkflow(workflowId);
      return workflow.meta;
    } catch (error) {
      throw new WorkflowLoadError(`Failed to get metadata for workflow: ${workflowId}`, error as Error);
    }
  }

  /**
   * Clear cache
   */
  static clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const workflowLoader = new WorkflowLoader();

// In development, expose cache clearing globally for debugging
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).clearWorkflowCache = () => {
    WorkflowLoader.clearCache();
    console.log('🧹 Workflow cache cleared! Refresh the page to see changes.');
  };
} 