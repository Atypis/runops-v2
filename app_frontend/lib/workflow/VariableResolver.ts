export interface VariableContext {
  userId: string;
  workflowId: string;
  executionId: string;
  nodeId: string;
  timestamp: Date;
  [key: string]: any;
}

export class VariableResolver {
  private static readonly VARIABLE_PATTERN = /\{\{([^}]+)\}\}/g;
  private static scopeStack: Record<string, any>[] = [];

  /**
   * Resolve all variables in a text string
   */
  public static resolveVariables(text: string, context: VariableContext): string {
    if (!text || typeof text !== 'string') {
      return text;
    }

    return text.replace(this.VARIABLE_PATTERN, (match, variableName) => {
      const trimmedName = variableName.trim();
      const resolvedValue = this.resolveVariable(trimmedName, context);
      
      if (resolvedValue === undefined) {
        console.warn(`[VariableResolver] Unresolved variable: ${trimmedName}`);
        return match; // Return original placeholder if unresolved
      }
      
      return String(resolvedValue);
    });
  }

  /**
   * Resolve variables in an object recursively
   */
  public static resolveObjectVariables(obj: any, context: VariableContext): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.resolveVariables(obj, context);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveObjectVariables(item, context));
    }

    if (typeof obj === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = this.resolveObjectVariables(value, context);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Resolve a single variable by name
   */
  private static resolveVariable(variableName: string, context: VariableContext): any {
    switch (variableName) {
      // Date/Time variables
      case 'today_date':
        return context.timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
      case 'today_datetime':
        return context.timestamp.toISOString();
      case 'today_timestamp':
        return context.timestamp.getTime();
      case 'today_formatted':
        return context.timestamp.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

      // Execution context variables
      case 'execution_id':
        return context.executionId;
      case 'workflow_id':
        return context.workflowId;
      case 'user_id':
        return context.userId;
      case 'node_id':
        return context.nodeId;

      // Gmail search patterns
      case 'gmail_search_today':
        return `after:${context.timestamp.toISOString().split('T')[0]}`;
      case 'gmail_search_this_week':
        const weekAgo = new Date(context.timestamp);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return `after:${weekAgo.toISOString().split('T')[0]}`;
      case 'gmail_search_this_month':
        const monthStart = new Date(context.timestamp.getFullYear(), context.timestamp.getMonth(), 1);
        return `after:${monthStart.toISOString().split('T')[0]}`;

      // Investor email patterns
      case 'investor_email_patterns':
        return [
          'investment',
          'funding',
          'venture capital',
          'angel investor',
          'seed round',
          'series a',
          'pitch deck',
          'startup',
          'equity',
          'valuation'
        ].join(' OR ');

      // AEF labels
      case 'aef_processed_label':
        return 'AEF-Processed';
      case 'aef_error_label':
        return 'AEF-Error';
      case 'aef_pending_label':
        return 'AEF-Pending';

      // Random/unique identifiers
      case 'random_id':
        return Math.random().toString(36).substring(2, 15);
      case 'uuid':
        return crypto.randomUUID();

      // Check if it's a context variable
      default:
        // First check scope stack (most recent scope first)
        for (let i = this.scopeStack.length - 1; i >= 0; i--) {
          const scope = this.scopeStack[i];
          if (variableName in scope) {
            return scope[variableName];
          }
          
          // Check for nested scope variables (e.g., "currentItem.email")
          const parts = variableName.split('.');
          let value: any = scope;
          for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
              value = value[part];
            } else {
              value = undefined;
              break;
            }
          }
          if (value !== undefined) {
            return value;
          }
        }
        
        // Then check context variables
        if (variableName in context) {
          return context[variableName];
        }
        
        // Check for nested context variables (e.g., "user.email")
        const parts = variableName.split('.');
        let value: any = context;
        for (const part of parts) {
          if (value && typeof value === 'object' && part in value) {
            value = value[part];
          } else {
            return undefined;
          }
        }
        return value;
    }
  }

  /**
   * Extract all variable names from a text string
   */
  public static extractVariables(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    const variables: string[] = [];
    let match;
    
    while ((match = this.VARIABLE_PATTERN.exec(text)) !== null) {
      variables.push(match[1].trim());
    }
    
    return variables;
  }

  /**
   * Check if a text contains any unresolved variables
   */
  public static hasUnresolvedVariables(text: string): boolean {
    return this.VARIABLE_PATTERN.test(text);
  }

  /**
   * Validate that all variables in a text can be resolved
   */
  public static validateVariables(text: string, context: VariableContext): { valid: boolean; missing: string[] } {
    const variables = this.extractVariables(text);
    const missing: string[] = [];

    for (const variable of variables) {
      const resolved = this.resolveVariable(variable, context);
      if (resolved === undefined) {
        missing.push(variable);
      }
    }

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Create a variable context for workflow execution
   */
  public static createContext(
    userId: string,
    workflowId: string,
    executionId: string,
    nodeId: string,
    additionalContext: Record<string, any> = {}
  ): VariableContext {
    return {
      userId,
      workflowId,
      executionId,
      nodeId,
      timestamp: new Date(),
      ...additionalContext
    };
  }

  /**
   * Push a new scope onto the scope stack for list iteration
   */
  public static pushScope(scope: Record<string, any>): void {
    this.scopeStack.push(scope);
  }

  /**
   * Pop the most recent scope from the scope stack
   */
  public static popScope(): Record<string, any> | undefined {
    return this.scopeStack.pop();
  }

  /**
   * Clear all scopes from the scope stack
   */
  public static clearScopes(): void {
    this.scopeStack = [];
  }
} 