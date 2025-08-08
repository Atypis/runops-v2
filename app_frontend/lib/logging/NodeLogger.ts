import { createClient } from '@supabase/supabase-js';

export interface NodeLogEntry {
  timestamp: string;
  type: 'prompt' | 'accessibility_tree' | 'llm_response' | 'action' | 'screenshot' | 'error' | 'success';
  title: string;
  content: string;
  metadata?: Record<string, any>;
}

export class NodeLogger {
  private supabase: any;
  private executionId: string;
  private nodeId: string;

  constructor(executionId: string, nodeId: string, supabaseClient?: any) {
    this.executionId = executionId;
    this.nodeId = nodeId;
    
    // Use provided client or create service role client
    this.supabase = supabaseClient || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Log an entry for this node
   */
  async log(entry: NodeLogEntry): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('aef_node_logs')
        .insert({
          execution_id: this.executionId,
          node_id: this.nodeId,
          timestamp: entry.timestamp,
          type: entry.type,
          title: entry.title,
          content: entry.content,
          metadata: entry.metadata || {}
        });

      if (error) {
        console.error(`[NodeLogger] Failed to log entry for node ${this.nodeId}:`, error);
      } else {
        console.log(`[NodeLogger] Logged ${entry.type} for node ${this.nodeId}: ${entry.title}`);
      }
    } catch (error) {
      console.error(`[NodeLogger] Exception while logging for node ${this.nodeId}:`, error);
    }
  }

  /**
   * Log node start
   */
  async logNodeStart(nodeLabel: string, nodeType: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'action',
      title: `Node Started: ${nodeLabel}`,
      content: `Starting execution of ${nodeType} node: ${nodeLabel}`,
      metadata: {
        nodeType,
        event: 'node_start'
      }
    });
  }

  /**
   * Log node completion
   */
  async logNodeComplete(nodeLabel: string, duration: number): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'success',
      title: `Node Completed: ${nodeLabel}`,
      content: `Successfully completed node execution in ${duration}ms`,
      metadata: {
        duration,
        event: 'node_complete'
      }
    });
  }

  /**
   * Log node error
   */
  async logNodeError(nodeLabel: string, error: Error, duration: number): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'error',
      title: `Node Failed: ${nodeLabel}`,
      content: `Node execution failed: ${error.message}\n\nStack trace:\n${error.stack}`,
      metadata: {
        duration,
        errorName: error.name,
        errorMessage: error.message,
        event: 'node_error'
      }
    });
  }

  /**
   * Log action start
   */
  async logActionStart(actionType: string, instruction: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'action',
      title: `Action: ${actionType}`,
      content: `Executing ${actionType} action: ${instruction}`,
      metadata: {
        actionType,
        instruction,
        event: 'action_start'
      }
    });
  }

  /**
   * Log action result
   */
  async logActionResult(actionType: string, result: any, duration: number): Promise<void> {
    const success = result?.success !== false;
    
    await this.log({
      timestamp: new Date().toISOString(),
      type: success ? 'success' : 'error',
      title: `${actionType} ${success ? 'Completed' : 'Failed'}`,
      content: success 
        ? `Action completed successfully in ${duration}ms\n\nResult: ${JSON.stringify(result, null, 2)}`
        : `Action failed after ${duration}ms\n\nError: ${result?.error || 'Unknown error'}`,
      metadata: {
        actionType,
        duration,
        success,
        result: success ? result : undefined,
        error: success ? undefined : result?.error,
        event: 'action_result'
      }
    });
  }

  /**
   * Log LLM prompt
   */
  async logPrompt(prompt: string, model?: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'prompt',
      title: 'LLM Prompt Generated',
      content: prompt,
      metadata: {
        model,
        promptLength: prompt.length,
        event: 'llm_prompt'
      }
    });
  }

  /**
   * Log LLM response
   */
  async logLLMResponse(response: string, duration: number, model?: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'llm_response',
      title: 'LLM Response Received',
      content: response,
      metadata: {
        model,
        duration,
        responseLength: response.length,
        event: 'llm_response'
      }
    });
  }

  /**
   * Log accessibility tree extraction
   */
  async logAccessibilityTree(tree: string, url?: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'accessibility_tree',
      title: 'Accessibility Tree Extracted',
      content: tree,
      metadata: {
        url,
        treeLength: tree.length,
        event: 'accessibility_tree'
      }
    });
  }

  /**
   * Log screenshot capture
   */
  async logScreenshot(screenshotPath: string, url?: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'screenshot',
      title: 'Screenshot Captured',
      content: `Screenshot saved: ${screenshotPath}`,
      metadata: {
        screenshotPath,
        url,
        event: 'screenshot'
      }
    });
  }

  /**
   * Log extraction result
   */
  async logExtraction(instruction: string, schema: any, result: any, duration: number): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'success',
      title: 'Data Extraction Completed',
      content: `Extraction completed in ${duration}ms\n\nInstruction: ${instruction}\n\nResult:\n${JSON.stringify(result, null, 2)}`,
      metadata: {
        instruction,
        schema,
        result,
        duration,
        event: 'extraction'
      }
    });
  }

  /**
   * Log decision result
   */
  async logDecision(condition: any, result: any, nextNode?: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: 'success',
      title: 'Decision Node Evaluated',
      content: `Decision evaluated\n\nCondition: ${JSON.stringify(condition, null, 2)}\n\nResult: ${JSON.stringify(result, null, 2)}\n\nNext node: ${nextNode || 'None'}`,
      metadata: {
        condition,
        result,
        nextNode,
        event: 'decision'
      }
    });
  }

  /**
   * Log assertion result
   */
  async logAssertion(conditions: any[], success: boolean, details?: string): Promise<void> {
    await this.log({
      timestamp: new Date().toISOString(),
      type: success ? 'success' : 'error',
      title: `Assertion ${success ? 'Passed' : 'Failed'}`,
      content: `Assertion ${success ? 'passed' : 'failed'}\n\nConditions: ${JSON.stringify(conditions, null, 2)}\n\n${details || ''}`,
      metadata: {
        conditions,
        success,
        details,
        event: 'assertion'
      }
    });
  }
} 