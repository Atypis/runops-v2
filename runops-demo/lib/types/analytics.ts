/**
 * Analytics and Metrics Types
 * 
 * Defines the interfaces for tracking AEF execution performance,
 * user behavior, and system metrics for optimization and insights.
 */

/**
 * Execution analytics data
 */
export interface ExecutionAnalytics {
  // Core identification
  executionId: string;
  workflowId: string;
  userId: string;
  
  // Execution overview
  status: 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  totalDuration: number;                   // milliseconds
  
  // Step-level metrics
  steps: StepAnalytics[];
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  skippedSteps: number;
  
  // Checkpoint metrics
  checkpoints: CheckpointAnalytics[];
  totalCheckpoints: number;
  approvedCheckpoints: number;
  rejectedCheckpoints: number;
  timeoutCheckpoints: number;
  averageCheckpointTime: number;           // milliseconds
  
  // Browser automation metrics
  browserMetrics: BrowserAnalytics;
  
  // Performance metrics
  memoryUsage: MemoryMetrics;
  errorMetrics: ErrorMetrics;
  
  // User interaction patterns
  userBehavior: UserBehaviorAnalytics;
}

/**
 * Individual step performance analytics
 */
export interface StepAnalytics {
  stepId: string;
  stepName: string;
  stepType: string;                        // task, decision, loop, etc.
  
  // Execution timing
  startedAt: Date;
  completedAt?: Date;
  duration: number;                        // milliseconds
  status: 'completed' | 'failed' | 'skipped' | 'timeout';
  
  // Browser automation
  browserActions: number;                  // Number of browser actions
  screenshotsTaken: number;
  averageActionTime: number;               // milliseconds per action
  
  // Error information
  errors: Array<{
    code: string;
    message: string;
    timestamp: Date;
    recovered: boolean;
  }>;
  retryCount: number;
  
  // Performance metrics
  cpuUsage?: number;                       // Average CPU during step
  memoryUsage?: number;                    // Peak memory during step
  networkRequests: number;                 // Number of network requests
}

/**
 * Checkpoint interaction analytics
 */
export interface CheckpointAnalytics {
  checkpointId: string;
  stepId: string;
  type: string;                            // before_execution, after_execution, etc.
  
  // Timing metrics
  presentedAt: Date;
  respondedAt?: Date;
  responseTime: number;                    // milliseconds
  
  // User decision
  action: 'approved' | 'rejected' | 'skipped' | 'timeout';
  userComment?: string;
  
  // Context when presented
  contextSize: number;                     // Size of context data shown
  screenshotIncluded: boolean;
  previewIncluded: boolean;
  
  // User interaction
  modalViews: number;                      // How many times user viewed modal
  contextExpansions: number;               // How many times user expanded context
}

/**
 * Browser automation performance metrics
 */
export interface BrowserAnalytics {
  sessionId: string;
  
  // Session metrics
  sessionDuration: number;                 // milliseconds
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  
  // Action breakdown
  actionBreakdown: Array<{
    type: string;                          // navigate, click, type, etc.
    count: number;
    averageDuration: number;
    successRate: number;
  }>;
  
  // Page interaction
  pagesVisited: number;
  uniqueDomains: number;
  totalPageLoadTime: number;               // milliseconds
  averagePageLoadTime: number;
  
  // Resource usage
  peakMemoryUsage: number;                 // MB
  averageMemoryUsage: number;
  totalDataTransfer: number;               // bytes
  
  // Error patterns
  commonErrors: Array<{
    error: string;
    count: number;
    recoveryRate: number;
  }>;
}

/**
 * Memory usage tracking
 */
export interface MemoryMetrics {
  // System memory
  systemMemoryUsed: number;                // MB
  systemMemoryTotal: number;               // MB
  systemMemoryPercentage: number;
  
  // Browser memory
  browserMemoryUsed: number;               // MB
  peakBrowserMemory: number;               // MB
  
  // Node.js process memory
  heapUsed: number;                        // MB
  heapTotal: number;                       // MB
  external: number;                        // MB
  
  // Garbage collection
  gcEvents: number;
  gcTotalTime: number;                     // milliseconds
}

/**
 * Error tracking and patterns
 */
export interface ErrorMetrics {
  // Error counts
  totalErrors: number;
  criticalErrors: number;
  recoverableErrors: number;
  userErrors: number;                      // Errors caused by user actions
  
  // Error categories
  browserErrors: number;
  networkErrors: number;
  timeoutErrors: number;
  authenticationErrors: number;
  elementNotFoundErrors: number;
  
  // Recovery metrics
  automaticRecoveries: number;
  manualRecoveries: number;
  unrecoveredErrors: number;
  
  // Error patterns
  errorsByStep: Array<{
    stepId: string;
    errorCount: number;
    mostCommonError: string;
  }>;
}

/**
 * User behavior and interaction patterns
 */
export interface UserBehaviorAnalytics {
  // Checkpoint behavior
  averageCheckpointTime: number;           // milliseconds
  checkpointApprovalRate: number;          // percentage
  fastApprovals: number;                   // < 5 seconds
  slowApprovals: number;                   // > 30 seconds
  
  // User preferences
  preferredExecutionMode: 'checkpoint' | 'automatic';
  preferredCheckpointTypes: string[];
  mostSkippedSteps: string[];
  
  // Intervention patterns
  manualInterventions: number;
  executionPauses: number;
  executionCancellations: number;
  stepModifications: number;
  
  // Learning indicators
  improvingApprovalTime: boolean;          // Getting faster over time
  increasingAutomation: boolean;           // Using fewer checkpoints
  repeatedWorkflows: number;               // How many times this workflow run
}

/**
 * Aggregated analytics across multiple executions
 */
export interface WorkflowAnalytics {
  workflowId: string;
  workflowName: string;
  
  // Execution summary
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
  successRate: number;                     // percentage
  
  // Performance trends
  averageExecutionTime: number;            // milliseconds
  executionTimeImprovement: number;        // percentage improvement over time
  reliabilityTrend: 'improving' | 'stable' | 'degrading';
  
  // Step analysis
  problematicSteps: Array<{
    stepId: string;
    stepName: string;
    failureRate: number;
    averageTime: number;
    improvementOpportunity: string;
  }>;
  
  // User adoption
  uniqueUsers: number;
  averageUsageFrequency: number;           // executions per user
  userRetentionRate: number;               // percentage returning users
  
  // Business impact
  timesSaved: number;                      // hours saved vs manual execution
  errorReduction: number;                  // percentage reduction in manual errors
  consistencyImprovement: number;          // percentage improvement in consistency
}

/**
 * Real-time metrics for system monitoring
 */
export interface SystemMetrics {
  timestamp: Date;
  
  // Active sessions
  activeBrowserSessions: number;
  activeExecutions: number;
  queuedExecutions: number;
  
  // Resource usage
  systemLoad: MemoryMetrics;
  responseTime: number;                    // API response time in ms
  throughput: number;                      // Actions per minute
  
  // Error rates
  errorRate: number;                       // Errors per hour
  successRate: number;                     // Successful executions percentage
  
  // User activity
  activeUsers: number;
  pendingCheckpoints: number;
  
  // Performance indicators
  averageExecutionTime: number;
  p95ExecutionTime: number;                // 95th percentile
  p99ExecutionTime: number;                // 99th percentile
}

/**
 * Analytics query interface for retrieving metrics
 */
export interface AnalyticsQuery {
  // Time range
  startDate: Date;
  endDate: Date;
  
  // Filters
  workflowIds?: string[];
  userIds?: string[];
  executionStatus?: string[];
  
  // Grouping and aggregation
  groupBy?: 'day' | 'week' | 'month' | 'workflow' | 'user';
  metrics: string[];                       // Which metrics to include
  
  // Pagination
  limit?: number;
  offset?: number;
}

/**
 * Default analytics configuration
 */
export const DEFAULT_ANALYTICS_CONFIG = {
  enableDetailedTracking: true,
  trackUserBehavior: true,
  trackBrowserMetrics: true,
  trackSystemMetrics: true,
  retentionPeriod: 90,                     // days
  aggregationInterval: 'hourly',           // hourly, daily, weekly
  enableRealTimeMetrics: true
}; 