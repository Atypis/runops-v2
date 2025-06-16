import { WorkflowAction, WorkflowNode } from './WorkflowLoader';

export interface HybridExecutionResult {
  success: boolean;
  source: 'primary' | 'fallback';
  result?: any;
  error?: string;
  retryCount: number;
}

export interface ExecutionContext {
  nodeId: string;
  actionIndex: number;
  variables: Record<string, any>;
  credentials: Record<string, any>;
}

/**
 * HybridActionMapper handles the primary/fallback execution pattern for AEF workflows
 * It first attempts to execute actions using cached selectors (primary), then falls back to AI
 */
export class HybridActionMapper {
  private retryAttempts: number;
  private hybridMode: boolean;

  constructor(retryAttempts: number = 3, hybridMode: boolean = true) {
    this.retryAttempts = retryAttempts;
    this.hybridMode = hybridMode;
  }

  /**
   * Execute a workflow action with hybrid primary/fallback logic
   */
  async executeAction(
    action: WorkflowAction,
    context: ExecutionContext,
    primaryExecutor: (action: WorkflowAction, context: ExecutionContext) => Promise<any>,
    fallbackExecutor: (action: WorkflowAction, context: ExecutionContext) => Promise<any>
  ): Promise<HybridExecutionResult> {
    let lastError: string = '';
    
    for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
      try {
        // First attempt: Use primary executor (cached selectors)
        if (attempt === 0 || !this.hybridMode) {
          try {
            const result = await primaryExecutor(action, context);
            return {
              success: true,
              source: 'primary',
              result,
              retryCount: attempt
            };
          } catch (primaryError) {
            lastError = primaryError instanceof Error ? primaryError.message : String(primaryError);
            
            // If hybrid mode is disabled, don't fall back to AI
            if (!this.hybridMode) {
              throw primaryError;
            }
            
            console.log(`Primary execution failed (attempt ${attempt + 1}): ${lastError}`);
          }
        }

        // Fallback: Use AI executor
        try {
          const result = await fallbackExecutor(action, context);
          return {
            success: true,
            source: 'fallback',
            result,
            retryCount: attempt
          };
        } catch (fallbackError) {
          lastError = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          console.log(`Fallback execution failed (attempt ${attempt + 1}): ${lastError}`);
        }

      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.log(`Execution attempt ${attempt + 1} failed: ${lastError}`);
      }
    }

    return {
      success: false,
      source: 'fallback',
      error: lastError,
      retryCount: this.retryAttempts
    };
  }

  /**
   * Execute a sequence of actions for a workflow node
   */
  async executeNode(
    node: WorkflowNode,
    context: ExecutionContext,
    primaryExecutor: (action: WorkflowAction, context: ExecutionContext) => Promise<any>,
    fallbackExecutor: (action: WorkflowAction, context: ExecutionContext) => Promise<any>
  ): Promise<HybridExecutionResult[]> {
    const results: HybridExecutionResult[] = [];
    
    for (let i = 0; i < node.actions.length; i++) {
      const action = node.actions[i];
      const actionContext = {
        ...context,
        actionIndex: i
      };

      const result = await this.executeAction(action, actionContext, primaryExecutor, fallbackExecutor);
      results.push(result);

      // Stop execution if action failed and pauseOnErrors is enabled
      if (!result.success) {
        console.error(`Action failed in node ${node.id}, action ${i}: ${result.error}`);
        break;
      }
    }

    return results;
  }

  /**
   * Process credential placeholders in action data
   */
  processCredentials(action: WorkflowAction, credentials: Record<string, any>): WorkflowAction {
    const processedAction = JSON.parse(JSON.stringify(action)); // Deep clone
    
    // Process credential placeholders in instruction
    if (processedAction.instruction) {
      processedAction.instruction = this.replacePlaceholders(processedAction.instruction, credentials);
    }

    // Process credential placeholders in target URL
    if (processedAction.target?.url) {
      processedAction.target.url = this.replacePlaceholders(processedAction.target.url, credentials);
    }

    // Process credential placeholders in data
    if (processedAction.data) {
      processedAction.data = this.processObjectPlaceholders(processedAction.data, credentials);
    }

    return processedAction;
  }

  /**
   * Replace credential placeholders in a string
   */
  private replacePlaceholders(text: string, credentials: Record<string, any>): string {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return credentials[key] || match;
    });
  }

  /**
   * Process placeholders in an object recursively
   */
  private processObjectPlaceholders(obj: any, credentials: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.replacePlaceholders(obj, credentials);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.processObjectPlaceholders(item, credentials));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const processed: any = {};
      for (const [key, value] of Object.entries(obj)) {
        processed[key] = this.processObjectPlaceholders(value, credentials);
      }
      return processed;
    }
    
    return obj;
  }

  /**
   * Validate action compatibility with executors
   */
  validateAction(action: WorkflowAction): boolean {
    const requiredFields = ['type', 'instruction'];
    return requiredFields.every(field => action[field as keyof WorkflowAction] !== undefined);
  }

  /**
   * Get action execution strategy based on action type
   */
  getExecutionStrategy(action: WorkflowAction): 'primary_only' | 'fallback_only' | 'hybrid' {
    // Some actions work better with specific executors
    switch (action.type) {
      case 'extract':
      case 'visual_scan':
        return 'fallback_only'; // AI is better at complex extraction
      case 'navigate':
      case 'wait':
        return 'primary_only'; // Simple actions don't need AI
      default:
        return 'hybrid'; // Most actions benefit from hybrid approach
    }
  }
} 