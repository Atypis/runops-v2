/**
 * Universal Memory Artifacts System Types
 * 
 * TypeScript interfaces matching the database schema for complete memory visibility.
 * Works universally across all 31+ action/node types in AEF.
 * 
 * Captures every conceivable piece of information for surgical debugging:
 * - Exact LLM prompts and responses
 * - DOM snapshots and accessibility trees  
 * - Element selection reasoning
 * - Context flow between nodes
 * - Browser interactions and state changes
 */

// === CORE MEMORY ARTIFACT INTERFACES ===

/**
 * Input artifacts - what flows INTO a node/action
 */
export interface MemoryInputs {
  // Execution context from previous nodes
  previousState: Record<string, any>;
  nodeVariables: Record<string, any>;
  credentials: Record<string, any>;
  
  // Environment context
  environment: {
    currentUrl?: string;
    domSnapshot?: string;           // Raw DOM snapshot (no compression initially)
    activeTab?: string;
    accessibilityTree?: any;        // Accessibility tree that LLM sees (for debugging)
    sessionState?: Record<string, any>;
  };
  
  // Loop/parent context
  contextData: {
    loopContext?: LoopContext;
    parentContext?: Record<string, any>;
  };
  
  // Action-specific inputs
  actionInputs: {
    instruction?: string;           // Natural language instruction
    schema?: any;                  // Extraction/validation schema
    target?: any;                  // Action target (URL, selector, etc.)
    data?: any;                    // Action data payload
    timeout?: number;              // Action timeout
    config?: any;                  // Action configuration
    actionCount?: number;          // Number of actions in this node
    actionTypes?: string[];        // Types of actions to be executed
  };
}

/**
 * Processing artifacts - what happens DURING execution
 */
export interface MemoryProcessing {
  // LLM interactions (for AI-powered actions)
  llmInteractions: LLMInteraction[];
  
  // Actions performed during execution
  actions: ProcessingAction[];
  
  // Browser interactions and events
  browserEvents: BrowserEvent[];
  
  // Errors and recovery attempts
  errors: ProcessingError[];
}

/**
 * Output artifacts - what comes OUT of a node/action
 */
export interface MemoryOutputs {
  // Primary result data
  primaryData: any;
  
  // State changes made by this node
  stateChanges: Record<string, any>;
  
  // Type-specific outputs
  extractedData?: Record<string, any>;    // For extraction nodes
  decisionResult?: DecisionResult;        // For decision nodes
  loopResult?: LoopResult;               // For loop nodes
  navigationResult?: NavigationResult;    // For navigation actions
  
  // Execution metadata
  executionMetadata: ExecutionMetadata;
}

/**
 * Memory forwarding rules - how information flows to next nodes
 */
export interface ForwardingRules {
  // What to forward to next nodes
  forwardToNext: string[];
  
  // Loop-specific forwarding
  keepInLoop?: string[];
  aggregateAcrossIterations?: string[];
  
  // Memory management
  clearFromMemory?: string[];
  compressLargeData?: boolean;
  
  // Conditional forwarding rules
  conditionalForwarding?: ConditionalForwarding[];
}

/**
 * Complete memory artifact - matches database schema
 */
export interface MemoryArtifact {
  id: string;
  executionId: string;
  nodeId: string;
  actionIndex?: number;              // For multi-action nodes
  userId: string;
  timestamp: Date;
  
  // Core memory data
  inputs: MemoryInputs;
  processing: MemoryProcessing;
  outputs: MemoryOutputs;
  forwardingRules: ForwardingRules;
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
}

// === SUPPORTING INTERFACES ===

/**
 * Loop context for iteration tracking
 */
export interface LoopContext {
  currentItem: any;
  iteration: number;
  totalItems: number;
  accumulatedResults: any[];
}

/**
 * LLM interaction during processing
 */
export interface LLMInteraction {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tokens?: number;
  model?: string;
}

/**
 * Action performed during processing
 */
export interface ProcessingAction {
  type: string;
  instruction: string;
  target?: any;
  data?: any;
  result?: any;
  timestamp: Date;
  duration?: number;
  retryCount?: number;
}

/**
 * Browser event during processing
 */
export interface BrowserEvent {
  type: 'navigation' | 'click' | 'type' | 'wait' | 'extract' | 'screenshot';
  details: any;
  timestamp: Date;
  success: boolean;
  error?: string;
}

/**
 * Error during processing
 */
export interface ProcessingError {
  type: string;
  message: string;
  timestamp: Date;
  recovered?: boolean;
  recoveryAction?: string;
  stack?: string;
}

/**
 * Decision node result
 */
export interface DecisionResult {
  condition: string;
  result: boolean;
  nextNode: string;
  confidence?: number;
}

/**
 * Loop node result
 */
export interface LoopResult {
  currentIteration: number;
  totalIterations: number;
  itemResult: any;
  continueLoop: boolean;
  aggregatedResults?: any[];
}

/**
 * Navigation result
 */
export interface NavigationResult {
  finalUrl: string;
  loadTime: number;
  success: boolean;
  statusCode?: number;
}

/**
 * Execution metadata
 */
export interface ExecutionMetadata {
  status: 'success' | 'error' | 'partial' | 'skipped' | 'pending';
  duration: number;                 // Total execution time (ms)
  retryCount?: number;              // Number of retries performed
  finalState?: Record<string, any>; // Final execution state
  resourceUsage?: {
    tokens?: number;
    apiCalls?: number;
    memoryUsage?: number;
  };
}

/**
 * Conditional forwarding rule
 */
export interface ConditionalForwarding {
  condition: string;
  forwardKeys: string[];
}

// === MEMORY MANAGER INTERFACES ===

/**
 * Node execution context built from memory artifacts
 */
export interface NodeExecutionContext {
  // Context from previous nodes
  previousNodeOutputs: Record<string, any>;
  
  // Variables available to this node
  availableVariables: Record<string, any>;
  
  // Environment state
  environmentState: {
    currentUrl?: string;
    sessionData?: Record<string, any>;
    browserState?: any;
  };
  
  // Loop context (if in a loop)
  loopContext?: LoopContext;
  
  // Memory artifacts from previous nodes (for debugging)
  memoryHistory: MemoryArtifact[];
}

/**
 * Memory search filters
 */
export interface MemorySearchFilters {
  executionId?: string;
  nodeId?: string;
  userId?: string;
  status?: string;
  timestampFrom?: Date;
  timestampTo?: Date;
  hasErrors?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Execution memory summary
 */
export interface ExecutionMemorySummary {
  executionId: string;
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  totalDuration: number;
  totalTokens: number;
  totalApiCalls: number;
  memorySize: number;                // Total memory artifacts size
  errorCount: number;
  startTime: Date;
  endTime?: Date;
}

/**
 * Memory capture configuration
 */
export interface MemoryCaptureConfig {
  captureInputs: boolean;
  captureProcessing: boolean;
  captureOutputs: boolean;
  captureFullDOM: boolean;           // Whether to capture complete DOM snapshots
  compressLargeData: boolean;        // Whether to compress large artifacts
  maxArtifactSize: number;          // Maximum size before truncation (bytes)
}

/**
 * Processing capture helper for real-time memory tracking
 */
export class ProcessingCapture {
  private llmInteractions: LLMInteraction[] = [];
  private actions: ProcessingAction[] = [];
  private browserEvents: BrowserEvent[] = [];
  private errors: ProcessingError[] = [];
  
  addLLMInteraction(interaction: LLMInteraction): void {
    this.llmInteractions.push(interaction);
  }
  
  addAction(action: ProcessingAction): void {
    this.actions.push(action);
  }
  
  addBrowserEvent(event: BrowserEvent): void {
    this.browserEvents.push(event);
  }
  
  addError(error: ProcessingError): void {
    this.errors.push(error);
  }
  
  getProcessingData(): MemoryProcessing {
    return {
      llmInteractions: [...this.llmInteractions],
      actions: [...this.actions],
      browserEvents: [...this.browserEvents],
      errors: [...this.errors]
    };
  }
  
  clear(): void {
    this.llmInteractions = [];
    this.actions = [];
    this.browserEvents = [];
    this.errors = [];
  }
} 