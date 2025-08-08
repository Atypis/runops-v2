import { createClient } from '@supabase/supabase-js';
import { NodeLogger, NodeLogEntry } from './NodeLogger';
import path from 'path';
import fs from 'fs/promises';

export interface ExecutionMetadata {
  executionId: string;
  workflowId: string;
  userId: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  success?: boolean;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  artifacts: {
    screenshots: string[];
    conversationLogs: string[];
    extractedData: Record<string, any>[];
    finalSummary?: string;
  };
  metrics: {
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    averageActionDuration: number;
    totalTokensUsed?: number;
  };
}

export interface WorkflowExecutionConfig {
  workflowId: string;
  generateScreenshots: boolean;
  generateConversationLogs: boolean;
  enableRealTimeLogging: boolean;
  artifactRetentionDays: number;
  saveExecutionFolder: boolean;
}

/**
 * Enhanced execution logger that combines database logging with file-based 
 * execution folders similar to the agent system
 */
export class EnhancedExecutionLogger {
  private supabase: any;
  private config: WorkflowExecutionConfig;
  private metadata: ExecutionMetadata;
  private nodeLoggers: Map<string, NodeLogger> = new Map();
  private executionFolderPath?: string;
  private startTime: Date;

  constructor(
    executionId: string,
    workflowId: string,
    userId: string,
    config: Partial<WorkflowExecutionConfig> = {},
    supabaseClient?: any
  ) {
    this.supabase = supabaseClient || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    this.config = {
      workflowId,
      generateScreenshots: true,
      generateConversationLogs: true,
      enableRealTimeLogging: true,
      artifactRetentionDays: 30,
      saveExecutionFolder: true,
      ...config
    };

    this.startTime = new Date();
    this.metadata = {
      executionId,
      workflowId,
      userId,
      startTime: this.startTime.toISOString(),
      status: 'running',
      totalNodes: 0,
      completedNodes: 0,
      failedNodes: 0,
      artifacts: {
        screenshots: [],
        conversationLogs: [],
        extractedData: [],
      },
      metrics: {
        totalActions: 0,
        successfulActions: 0,
        failedActions: 0,
        averageActionDuration: 0,
      }
    };
  }

  /**
   * Initialize the enhanced execution logging
   */
  async startExecution(workflowDefinition: any): Promise<void> {
    console.log(`🚀 [EnhancedLogger] Starting execution: ${this.metadata.executionId}`);

    // Create execution folder if enabled
    if (this.config.saveExecutionFolder) {
      await this.createExecutionFolder();
    }

    // Update metadata with workflow info
    this.metadata.totalNodes = workflowDefinition.execution?.workflow?.nodes?.length || 0;

    // Save initial execution record to database
    await this.saveExecutionMetadata();

    // Log execution start
    await this.logExecutionEvent('execution_start', 'Execution Started', 
      `Starting execution of workflow ${this.config.workflowId} with ${this.metadata.totalNodes} nodes`);

    console.log(`📁 [EnhancedLogger] Execution folder: ${this.executionFolderPath}`);
  }

  /**
   * Get or create a NodeLogger for a specific node
   */
  getNodeLogger(nodeId: string): NodeLogger {
    if (!this.nodeLoggers.has(nodeId)) {
      const nodeLogger = new NodeLogger(this.metadata.executionId, nodeId, this.supabase);
      this.nodeLoggers.set(nodeId, nodeLogger);
    }
    return this.nodeLoggers.get(nodeId)!;
  }

  /**
   * Log node execution start
   */
  async logNodeStart(nodeId: string, nodeLabel: string, nodeType: string): Promise<void> {
    const logger = this.getNodeLogger(nodeId);
    await logger.logNodeStart(nodeLabel, nodeType);
    
    // Update execution metadata
    this.metadata.status = 'running';
    await this.saveExecutionMetadata();
  }

  /**
   * Log node execution completion
   */
  async logNodeComplete(nodeId: string, nodeLabel: string, duration: number, result?: any): Promise<void> {
    const logger = this.getNodeLogger(nodeId);
    await logger.logNodeComplete(nodeLabel, duration);
    
    // Update execution metadata
    this.metadata.completedNodes++;
    
    // Store extracted data if any
    if (result?.extracted_data) {
      this.metadata.artifacts.extractedData.push({
        nodeId,
        nodeLabel,
        timestamp: new Date().toISOString(),
        data: result.extracted_data
      });
    }
    
    await this.saveExecutionMetadata();
  }

  /**
   * Log node execution failure
   */
  async logNodeError(nodeId: string, nodeLabel: string, error: Error, duration: number): Promise<void> {
    const logger = this.getNodeLogger(nodeId);
    await logger.logNodeError(nodeLabel, error, duration);
    
    // Update execution metadata
    this.metadata.failedNodes++;
    await this.saveExecutionMetadata();
  }

  /**
   * Log action execution with metrics tracking
   */
  async logActionExecution(
    nodeId: string, 
    actionType: string, 
    result: any, 
    duration: number
  ): Promise<void> {
    const logger = this.getNodeLogger(nodeId);
    await logger.logActionResult(actionType, result, duration);
    
    // Update metrics
    this.metadata.metrics.totalActions++;
    if (result?.success !== false) {
      this.metadata.metrics.successfulActions++;
    } else {
      this.metadata.metrics.failedActions++;
    }
    
    // Calculate average duration
    this.metadata.metrics.averageActionDuration = 
      (this.metadata.metrics.averageActionDuration * (this.metadata.metrics.totalActions - 1) + duration) / 
      this.metadata.metrics.totalActions;
    
    await this.saveExecutionMetadata();
  }

  /**
   * Complete the execution
   */
  async completeExecution(success: boolean, finalSummary?: string, error?: Error): Promise<void> {
    const endTime = new Date();
    const duration = endTime.getTime() - this.startTime.getTime();

    this.metadata.endTime = endTime.toISOString();
    this.metadata.duration = Math.round(duration / 1000);
    this.metadata.status = success ? 'completed' : 'failed';
    this.metadata.success = success;
    
    if (finalSummary) {
      this.metadata.artifacts.finalSummary = finalSummary;
    }

    await this.saveExecutionMetadata();

    if (this.executionFolderPath) {
      await this.createExecutionReport();
    }

    console.log(`${success ? '✅' : '❌'} [EnhancedLogger] Execution ${success ? 'completed' : 'failed'}: ${this.metadata.executionId}`);
  }

  /**
   * Create timestamped execution folder
   */
  private async createExecutionFolder(): Promise<void> {
    // Implementation would go here
  }

  /**
   * Save execution metadata to database
   */
  private async saveExecutionMetadata(): Promise<void> {
    // Implementation would go here
  }

  /**
   * Log general execution events
   */
  private async logExecutionEvent(
    eventType: string, 
    title: string, 
    content: string, 
    metadata?: Record<string, any>
  ): Promise<void> {
    // Implementation would go here
  }

  /**
   * Create execution report (similar to agent system)
   */
  private async createExecutionReport(): Promise<void> {
    // Implementation would go here
  }

  /**
   * Get execution metadata (for API endpoints)
   */
  getExecutionMetadata(): ExecutionMetadata {
    return { ...this.metadata };
  }

  /**
   * Get execution folder path
   */
  getExecutionFolderPath(): string | undefined {
    return this.executionFolderPath;
  }

  /**
   * Static method to get all executions for a user
   */
  static async getExecutionsForUser(userId: string, supabaseClient?: any): Promise<ExecutionMetadata[]> {
    const supabase = supabaseClient || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    try {
      const { data, error } = await supabase
        .from('aef_execution_metadata')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Failed to fetch user executions:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Exception fetching user executions:', error);
      return [];
    }
  }
} 