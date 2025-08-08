import { SOPDocument, SOPNode, BrowserInstruction } from '../../lib/types/sop';
import { singleVNCSessionManager } from '@/lib/vnc/SingleVNCSessionManager';
import { CredentialInjectionService, ExecutionCredentials } from '@/lib/credentials/injection';
import { WorkflowCredential } from '@/lib/types/aef';
import { VariableResolver, VariableContext } from '@/lib/workflow/VariableResolver';
import { NodeLogger } from '@/lib/logging/NodeLogger';
import { MemoryManager } from '@/lib/memory/MemoryManager';
import { 
  MemoryInputs, 
  MemoryProcessing, 
  MemoryOutputs, 
  ForwardingRules,
  ProcessingCapture,
  NodeExecutionContext 
} from '@/lib/memory/types';

// A placeholder for the more complex node structure from the JSON file
type WorkflowNode = SOPNode & {
    actions?: any[];
    [key: string]: any; 
};

type Workflow = {
    nodes: WorkflowNode[];
    flow: { from: string; to: string; condition?: string }[];
};

// A simplified type for the overall document
type WorkflowDocument = {
    execution: {
        environment: {
            required_tabs: { name: string; url: string }[];
        };
        workflow: Workflow;
    };
    [key: string]: any;
};

export class ExecutionEngine {
  private sop: WorkflowDocument;
  private state: Map<string, any>;
  private currentNode: WorkflowNode | undefined;
  private userId: string;
  private workflowId: string;
  private executionId: string; // REQUIRED: Single source of truth for execution ID
  private supabaseClient: any; // Service role Supabase client for credential access
  private loggers: Map<string, NodeLogger> = new Map(); // Node ID -> Logger
  private loopStates: Map<string, { index: number; length: number; queueKey: string }> = new Map(); // Loop state tracking
  private memoryManager?: MemoryManager; // Universal Memory Manager for complete memory visibility


  constructor(sop: WorkflowDocument, userId: string, executionId: string, workflowId?: string) {
    this.sop = sop;
    this.state = new Map<string, any>();
    this.userId = userId;
    this.executionId = executionId; // Store the database-provided execution ID
    this.workflowId = workflowId || (sop as any).meta?.id || 'unknown';
    
    console.log(`🎬 [ExecutionEngine] Initialized with execution ID: ${this.executionId}`);
  }
  
  /**
   * Initialize memory manager when Supabase client is available
   */
  private async initializeMemoryManager(): Promise<void> {
    if (!this.supabaseClient) {
      console.warn('Cannot initialize memory manager without Supabase client');
      return;
    }
    
    try {
      const { MemoryManager } = await import('@/lib/memory/MemoryManager');
      this.memoryManager = new MemoryManager(this.supabaseClient);
      console.log(`💾 [ExecutionEngine] Memory manager initialized for complete execution capture`);
    } catch (error) {
      console.warn('Failed to initialize memory manager:', error);
    }
  }

  /**
   * Set the Supabase client for credential access and initialize memory manager
   */
  public setSupabaseClient(supabaseClient: any): void {
    this.supabaseClient = supabaseClient;
    
    // Auto-initialize memory manager now that we have a Supabase client
    this.initializeMemoryManager();
  }

  /**
   * Set the Memory Manager for complete memory visibility
   * CRITICAL: Memory management controls information flow between nodes
   */
  public setMemoryManager(memoryManager: MemoryManager): void {
    this.memoryManager = memoryManager;
    console.log('🧠 Memory Manager enabled - complete execution visibility activated');
  }



  /**
   * Get or create a logger for a specific node
   */
  private getLogger(nodeId: string): NodeLogger {
    const key = `${this.executionId}-${nodeId}`;
    if (!this.loggers.has(key)) {
      this.loggers.set(key, new NodeLogger(this.executionId, nodeId, this.supabaseClient));
    }
    return this.loggers.get(key)!;
  }

  public async start() {
    console.log(`🚀 Starting execution for workflow ${this.workflowId}, user ${this.userId}, execution ${this.executionId}`);
    
    // Reset variable scopes to avoid bleed-over from previous runs
    VariableResolver.clearScopes();
    
    // Validate credentials before starting execution
    await this.validateCredentials();
    
    // Find the start node (first node in the workflow)
    this.currentNode = this.sop.execution.workflow.nodes[0];
    console.log(`🚀 Starting execution with node: ${this.currentNode?.label}`);
    await this.execute();
  }

  // New method: Execute a specific node by ID
  public async executeNodeById(nodeId: string): Promise<{ success: boolean; message: string; nextNodeId?: string }> {
    console.log(`🎯 Executing specific node: ${nodeId}`);
    
    const node = this.sop.execution.workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      const message = `Node ${nodeId} not found`;
      console.error(message);
      return { success: false, message };
    }

    const logger = this.getLogger(nodeId);
    const startTime = Date.now();

    try {
      // Log node start
      await logger.logNodeStart(node.label, node.type);
      
      this.currentNode = node;
      await this.executeNode(node);
      
      // Find the next node
      const nextNode = this.findNextNode(nodeId);
      const nextNodeId = nextNode?.id;
      
      const duration = Date.now() - startTime;
      const message = `Node ${nodeId} (${node.label}) executed successfully`;
      console.log(`✅ ${message}`);
      
      // Log node completion
      await logger.logNodeComplete(node.label, duration);
      
      return { 
        success: true, 
        message,
        nextNodeId 
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = `Failed to execute node ${nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(message);
      
      // Log node error
      await logger.logNodeError(node.label, error instanceof Error ? error : new Error(String(error)), duration);
      
      return { success: false, message };
    }
  }

  // New method: Execute multiple nodes consecutively
  public async executeNodesConsecutively(nodeIds: string[]): Promise<Map<string, { success: boolean; message: string; nextNodeId?: string }>> {
    console.log(`🎯 Executing ${nodeIds.length} nodes consecutively:`, nodeIds);
    
    const results = new Map<string, { success: boolean; message: string; nextNodeId?: string }>();
    
    for (const nodeId of nodeIds) {
      console.log(`🔄 Executing node ${nodeId}...`);
      
      const result = await this.executeNodeById(nodeId);
      results.set(nodeId, result);
      
      if (!result.success) {
        console.warn(`⚠️ Node ${nodeId} failed, continuing with next node...`);
        // Continue with next node even if current one fails
      }
      
      // Add delay between nodes for better observability
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Completed consecutive execution of ${nodeIds.length} nodes`);
    return results;
  }

  private async execute() {
    let nodeCount = 0;
    const maxNodes = 20; // Safety limit
    
    while (this.currentNode && nodeCount < maxNodes) {
      console.log(`📋 Executing node ${nodeCount + 1}: ${this.currentNode.label} (${this.currentNode.id})`);
      
      await this.executeNode(this.currentNode);
      
      // Find the next node to execute
      const nextNode = this.findNextNode(this.currentNode.id);
      this.currentNode = nextNode;
      
      nodeCount++;
      
      if (!nextNode) {
        console.log('🏁 Workflow execution completed - no more nodes to execute');
        break;
      }
      
      // Add a small delay between nodes for better observability
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (nodeCount >= maxNodes) {
      console.warn('⚠️ Execution stopped - maximum node limit reached');
    }
  }

  private async executeNode(node: WorkflowNode) {
    console.log(`  🔍 Node type: ${node.type}`);
    console.log(`  💭 Intent: ${node.intent}`);
    
    const logger = this.getLogger(node.id);
    const nodeStartTime = Date.now();
    
    // Create variable context for this node
    const variableContext = VariableResolver.createContext(
      this.userId,
      this.workflowId,
      this.executionId,
      node.id,
      { state: Object.fromEntries(this.state) }
    );
    
    // Resolve variables in the node before execution
    let resolvedNode = VariableResolver.resolveObjectVariables(node, variableContext) as WorkflowNode;
    
    // === MEMORY CAPTURE 1: INPUTS (BLOCKING) ===
    let processingCapture: ProcessingCapture | undefined;
    if (this.memoryManager) {
      console.log(`🧠 Capturing inputs for node ${node.id}...`);
      
      // Build context for next node if memory manager is available
      const nextNode = this.findNextNode(node.id);
      if (nextNode) {
        try {
          const nodeContext = await this.memoryManager.getContextForNextNode(
            this.executionId, node.id, 
            nextNode.id
          );
          
          // Update node with memory context
          resolvedNode = {
            ...resolvedNode,
            memoryContext: nodeContext
          };
          
          console.log(`🔄 Memory context loaded: ${Object.keys(nodeContext.availableVariables).length} variables available`);
        } catch (error) {
          console.warn(`⚠️ Could not load memory context for node ${node.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      const inputs: MemoryInputs = {
        previousState: Object.fromEntries(this.state),
        nodeVariables: resolvedNode.variables || {},
        credentials: this.extractWorkflowCredentials().reduce((acc, cred) => {
          acc[cred.id] = { type: cred.type, configured: !!cred.isSet };
          return acc;
        }, {} as Record<string, any>),
        environment: {
          currentUrl: await this.getCurrentUrl(),
          domSnapshot: await this.getDOMSnapshot(),
          activeTab: await this.getActiveTab(),
          accessibilityTree: await this.getAccessibilityTree(),
          sessionState: {
            executionId: this.executionId,
            userId: this.userId,
            workflowId: this.workflowId,
            nodeType: node.type,
            nodeLabel: node.label
          }
        },
        contextData: {
          loopContext: this.getLoopContext(node.id),
          parentContext: resolvedNode.memoryContext?.previousNodeOutputs || {}
        },
        actionInputs: {
          instruction: node.intent,
          schema: (resolvedNode as any).schema,
          target: (resolvedNode as any).target,
          data: (resolvedNode as any).data,
          timeout: (resolvedNode as any).timeout,
          config: resolvedNode,
          actionCount: resolvedNode.actions?.length || 0,
          actionTypes: resolvedNode.actions?.map(a => a.type) || []
        }
      };
      
      try {
        await this.memoryManager.captureNodeInputs(this.executionId, node.id, this.userId, inputs);
        console.log(`✅ Inputs captured for node ${node.id}`);
      } catch (error) {
        const message = `CRITICAL: Input capture failed for node ${node.id}`;
        console.error(`❌ ${message}:`, error);
        throw new Error(`${message}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Initialize processing capture
      processingCapture = new ProcessingCapture();
    }
    
    // === NODE EXECUTION (NO EARLY RETURNS) ===
    try {
      // Handle new bulletproof node types
      switch (resolvedNode.type) {
        case 'decision':
          await this.executeDecisionNode(resolvedNode);
          break;
        case 'assert':
          await this.executeAssertNode(resolvedNode);
          break;
        case 'error_handler':
          await this.executeErrorHandlerNode(resolvedNode);
          break;
        case 'data_transform':
          await this.executeDataTransformNode(resolvedNode);
          break;
        case 'generator':
          await this.executeGeneratorNode(resolvedNode);
          break;
        case 'explore':
          await this.executeExploreNode(resolvedNode);
          break;
        case 'filter_list':
          await this.executeFilterListNode(resolvedNode);
          break;
        case 'llm_call':
          await this.executeLLMCallNode(resolvedNode);
          break;
        case 'list_iterator':
          console.log(`  🔄 Loop node detected: ${resolvedNode.label}`);
          // For MVP, we'll just log that we're entering the loop
          // In a full implementation, this would set up loop state
          break;
        case 'compound_task':
          console.log(`  📦 Compound task detected: ${resolvedNode.label}`);
          console.log(`  👶 Children: ${resolvedNode.children?.join(', ')}`);
          
          // Check if this compound task should execute all children
          if (resolvedNode.canExecuteAsGroup && resolvedNode.children) {
              console.log(`  🎬 Executing all children sequentially for compound task`);
              
              for (const childId of resolvedNode.children) {
                  const childNode = this.sop.execution.workflow.nodes.find(n => n.id === childId);
                  if (childNode) {
                      console.log(`    ▶️ Executing child: ${childNode.label} (${childId})`);
                      await this.executeNode(childNode);
                      
                      // Add delay between child executions
                      await new Promise(resolve => setTimeout(resolve, 1000));
                  } else {
                      console.warn(`    ⚠️ Child node ${childId} not found`);
                  }
              }
              
              console.log(`  ✅ Compound task completed: ${resolvedNode.label}`);
          } else {
              console.log(`  ℹ️ Compound task defined but not executing children (canExecuteAsGroup: ${resolvedNode.canExecuteAsGroup})`);
          }
          break;
        default:
          // Execute actions for atomic tasks - this is where most nodes will go
          break;
      }
    } catch (error) {
      console.error(`  ❌ Node execution failed:`, error);
      // Continue to memory capture even on error
    }
    
    // Execute actions for atomic tasks
    if (resolvedNode.actions && Array.isArray(resolvedNode.actions)) {
        console.log(`  🎬 Executing ${resolvedNode.actions.length} actions`);
        
        for (const action of resolvedNode.actions) {
            console.log(`    - Action: ${action.type}`);
            
            switch (action.type) {
                case 'navigate':
                case 'navigate_or_switch_tab':
                    console.log(`    - Navigating to: ${action.target?.url}`);
                    await logger.logActionStart('navigate', action.instruction || `Navigate to ${action.target?.url}`);
                    const navStartTime = Date.now();
                    try {
                        const result = await singleVNCSessionManager.executeAction({
                            type: 'navigate',
                            data: { url: action.target?.url },
                            stepId: node.id
                        });
                        console.log(`    ✅ Navigation completed:`, result);
                        await logger.logActionResult('navigate', result, Date.now() - navStartTime);
                        
                        // === CAPTURE NAVIGATION IN PROCESSING ===
                        if (this.memoryManager && processingCapture) {
                          const navDuration = Date.now() - navStartTime;
                          processingCapture.addAction({
                            type: 'navigate',
                            instruction: action.instruction || `Navigate to ${action.target?.url}`,
                            target: action.target,
                            data: action.data,
                            result: result,
                            timestamp: new Date(navStartTime),
                            duration: navDuration,
                            retryCount: 0
                          });
                          
                          processingCapture.addBrowserEvent({
                            type: 'navigation',
                            details: {
                              fromUrl: await this.getCurrentUrl(),
                              toUrl: action.target?.url,
                              finalUrl: result.url,
                              redirects: result.redirectCount || 0
                            },
                            timestamp: new Date(),
                            success: result.success
                          });
                        }
                    } catch (error) {
                        console.error(`    ❌ Navigation failed:`, error);
                        await logger.logActionResult('navigate', { success: false, error: error instanceof Error ? error.message : String(error) }, Date.now() - navStartTime);
                        
                        // === CAPTURE NAVIGATION ERROR IN PROCESSING ===
                        if (this.memoryManager && processingCapture) {
                          const navDuration = Date.now() - navStartTime;
                          processingCapture.addError({
                            type: 'navigation_error',
                            message: error instanceof Error ? error.message : String(error),
                            timestamp: new Date(),
                            recovered: false,
                            stack: error instanceof Error ? error.stack : undefined
                          });
                          
                          processingCapture.addAction({
                            type: 'navigate',
                            instruction: action.instruction || `Navigate to ${action.target?.url}`,
                            target: action.target,
                            data: action.data,
                            result: { success: false, error: error instanceof Error ? error.message : String(error) },
                            timestamp: new Date(navStartTime),
                            duration: navDuration,
                            retryCount: 0
                          });
                        }
                    }
                    break;
                    
                case 'click':
                    console.log(`    - Clicking element: ${action.target?.selector || 'using instruction'}`);
                    await logger.logActionStart('click', action.instruction || `Click ${action.target?.selector}`);
                    const clickStartTime = Date.now();
                    try {
                        const result = await singleVNCSessionManager.executeAction({
                            type: 'click',
                            data: { 
                                selector: action.target?.selector,
                                instruction: action.instruction 
                            },
                            stepId: node.id
                        });
                        console.log(`    ✅ Click completed:`, result);
                        await logger.logActionResult('click', result, Date.now() - clickStartTime);
                        
                        // === CAPTURE CLICK IN PROCESSING ===
                        if (this.memoryManager && processingCapture) {
                          const clickDuration = Date.now() - clickStartTime;
                          processingCapture.addAction({
                            type: 'click',
                            instruction: action.instruction || `Click ${action.target?.selector}`,
                            target: action.target,
                            data: action.data,
                            result: result,
                            timestamp: new Date(clickStartTime),
                            duration: clickDuration,
                            retryCount: 0
                          });
                          
                          processingCapture.addBrowserEvent({
                            type: 'click',
                            details: {
                              selector: action.target?.selector,
                              instruction: action.instruction,
                              elementFound: result.success,
                              coordinates: result.coordinates,
                              elementText: result.elementText
                            },
                            timestamp: new Date(),
                            success: result.success
                          });
                        }
                    } catch (error) {
                        console.error(`    ❌ Click failed:`, error);
                        
                        // === CAPTURE CLICK ERROR IN PROCESSING ===
                        if (this.memoryManager && processingCapture) {
                          const clickDuration = Date.now() - clickStartTime;
                          processingCapture.addError({
                            type: 'click_error',
                            message: error instanceof Error ? error.message : String(error),
                            timestamp: new Date(),
                            recovered: false,
                            stack: error instanceof Error ? error.stack : undefined
                          });
                          
                          processingCapture.addAction({
                            type: 'click',
                            instruction: action.instruction || `Click ${action.target?.selector}`,
                            target: action.target,
                            data: action.data,
                            result: { success: false, error: error instanceof Error ? error.message : String(error) },
                            timestamp: new Date(clickStartTime),
                            duration: clickDuration,
                            retryCount: 0
                          });
                        }

                        // 🔄 Fallback to Stagehand act
                        try {
                          console.log(`    🔄 Falling back to Stagehand act for click`);
                          const fallbackResult = await singleVNCSessionManager.executeAction({
                            type: 'act',
                            data: { instruction: action.instruction || `Click the element ${action.target?.selector}` },
                            stepId: node.id
                          });
                          console.log(`    ✅ Fallback act completed:`, fallbackResult);
                          await logger.logActionResult('click_fallback', fallbackResult, Date.now() - clickStartTime);
                        } catch (fallbackErr) {
                          console.error(`    ❌ Fallback act failed:`, fallbackErr);
                          await logger.logActionResult('click', { success: false, error: String(fallbackErr) }, Date.now() - clickStartTime);
                        }
                    }
                    break;

                case 'type':
                    console.log(`    - Typing text into: ${action.target?.selector}`);
                    try {
                        // Create the browser action
                        let browserAction = {
                            type: 'type' as const,
                            data: { 
                                selector: action.target?.selector,
                                text: action.data?.text 
                            },
                            stepId: node.id
                        };
                        
                        // Inject credentials if needed
                        browserAction = await this.injectCredentialsIntoAction(browserAction, resolvedNode);
                        
                        const result = await singleVNCSessionManager.executeAction(browserAction);
                        console.log(`    ✅ Type completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Type failed:`, error);

                        // 🔄 Fallback to Stagehand act
                        try {
                          console.log(`    🔄 Falling back to Stagehand act for type`);
                          const fallbackResult = await singleVNCSessionManager.executeAction({
                            type: 'act',
                            data: { instruction: action.instruction || `Type the required text` },
                            stepId: node.id
                          });
                          console.log(`    ✅ Fallback act completed:`, fallbackResult);
                        } catch (fallbackErr) {
                          console.error(`    ❌ Fallback act failed:`, fallbackErr);
                          throw fallbackErr;
                        }
                    }
                    break;

                case 'wait':
                    console.log(`    - Waiting for element: ${action.target?.selector}`);
                    try {
                        const result = await singleVNCSessionManager.executeAction({
                            type: 'wait',
                            data: { 
                                selector: action.target?.selector,
                                timeout: action.timeout || 5000
                            },
                            stepId: node.id
                        });
                        console.log(`    ✅ Wait completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Wait failed:`, error);
                    }
                    break;

                case 'wait_for_navigation':
                    console.log(`    - Waiting for navigation to: ${action.target?.url_contains}`);
                    try {
                        const result = await singleVNCSessionManager.executeAction({
                            type: 'wait_for_navigation',
                            data: { 
                                url_contains: action.target?.url_contains,
                                timeout: action.timeout || 10000
                            },
                            stepId: node.id
                        });
                        console.log(`    ✅ Navigation wait completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Navigation wait failed:`, error);
                    }
                    break;

                case 'extract':
                    console.log(`    - Extracting data: ${action.instruction}`);
                    const extractStartTime = Date.now();
                    try {
                        const result = await singleVNCSessionManager.executeAction({
                            type: 'extract',
                            data: { 
                                instruction: action.instruction,
                                schema: action.schema
                            },
                            stepId: node.id
                        });
                        console.log(`    ✅ Extract completed:`, result);
                        
                        // === FIX: PARSE EXTRACTED DATA FROM LLM RESPONSE ===
                        let extractedData = result;
                        
                        // If result has trace with LLM interactions, parse the assistant response
                        if (result.trace && Array.isArray(result.trace)) {
                            const extractResponse = result.trace.find((item: any) => 
                                item.role === 'assistant' && 
                                item.metadata?.actionType === 'extract'
                            );
                            
                            if (extractResponse && extractResponse.content) {
                                try {
                                    // Try to parse JSON from the LLM response
                                    const contentMatch = extractResponse.content.match(/\{[\s\S]*?\]/);
                                    if (contentMatch) {
                                        const parsedData = JSON.parse(contentMatch[0]);
                                        extractedData = parsedData;
                                        console.log(`    🎯 Parsed extracted data from LLM:`, parsedData);
                                    }
                                } catch (parseError) {
                                    console.warn(`    ⚠️ Could not parse LLM response as JSON:`, parseError);
                                    // Fall back to original result
                                }
                            }
                        }
                        
                        // === STORE EXTRACTED DATA IN STATE FOR INTER-NODE COMMUNICATION ===
                        this.state.set(`${node.id}_extracted_data`, extractedData);
                        this.state.set(`${node.id}_result`, extractedData);
                        
                        // Also store the result directly under the node ID for convenience
                        this.state.set(node.id, extractedData);
                        
                        console.log(`    💾 Stored extracted data in state:`, extractedData);
                        console.log(`    🗂️ Current state keys after storage:`, Array.from(this.state.keys()));
                        console.log(`    🔍 State content for ${node.id}:`, this.state.get(node.id));
                        
                        // === CAPTURE EXTRACT ACTION IN PROCESSING ===
                        if (this.memoryManager && processingCapture) {
                          const extractDuration = Date.now() - extractStartTime;
                          processingCapture.addAction({
                            type: 'extract',
                            instruction: action.instruction || 'Data extraction',
                            target: action.target,
                            data: { schema: action.schema, ...action.data },
                            result: extractedData, // Use parsed data
                            timestamp: new Date(extractStartTime),
                            duration: extractDuration,
                            retryCount: 0
                          });
                          
                          // === EXTRACT LLM TRACE FROM STAGEHAND RESPONSE (NO EXTRA CALLS) ===
                          if (result.trace && Array.isArray(result.trace)) {
                            console.log(`    🧠 Captured ${result.trace.length} LLM interactions from extract action`);
                            for (const traceItem of result.trace) {
                              processingCapture.addLLMInteraction({
                                role: traceItem.role,
                                content: traceItem.content,
                                timestamp: new Date(traceItem.timestamp),
                                tokens: traceItem.tokens || 0,
                                model: traceItem.metadata?.actionType || 'extract'
                              });
                            }
                          }
                          
                          processingCapture.addBrowserEvent({
                            type: 'extract',
                            details: {
                              instruction: action.instruction,
                              schema: action.schema,
                              extractedFields: extractedData ? Object.keys(extractedData).length : 0,
                              result: extractedData,
                              aiPowered: true
                            },
                            timestamp: new Date(),
                            success: !!extractedData
                          });
                        }
                    } catch (error) {
                        console.error(`    ❌ Extract failed:`, error);
                        
                        // === CAPTURE EXTRACT ERROR IN PROCESSING ===
                        if (this.memoryManager && processingCapture) {
                          const extractDuration = Date.now() - extractStartTime;
                          processingCapture.addError({
                            type: 'extract_error',
                            message: error instanceof Error ? error.message : String(error),
                            timestamp: new Date(),
                            recovered: false,
                            stack: error instanceof Error ? error.stack : undefined
                          });
                          
                          processingCapture.addAction({
                            type: 'extract',
                            instruction: action.instruction || 'Data extraction',
                            target: action.target,
                            data: { schema: action.schema, ...action.data },
                            result: { success: false, error: error instanceof Error ? error.message : String(error) },
                            timestamp: new Date(extractStartTime),
                            duration: extractDuration,
                            retryCount: 0
                          });
                        }
                    }
                    break;

                case 'act':
                    console.log(`    - AI-powered action: ${action.instruction}`);
                    const actStartTime = Date.now();
                    try {
                        // Create the browser action
                        let browserAction = {
                            type: 'act' as const,
                            data: { 
                                instruction: action.instruction,
                                ...action.data  // Include any additional data from the workflow
                            },
                            stepId: node.id
                        };
                        
                        // Inject credentials if needed (this handles {{gmail_email}} replacement)
                        browserAction = await this.injectCredentialsIntoAction(browserAction, resolvedNode);
                        
                        const result = await singleVNCSessionManager.executeAction(browserAction);
                        console.log(`    ✅ Act completed:`, result);
                        
                        // === CAPTURE ACT ACTION IN PROCESSING ===
                        if (this.memoryManager && processingCapture) {
                          const actDuration = Date.now() - actStartTime;
                          processingCapture.addAction({
                            type: 'act',
                            instruction: action.instruction || 'AI-powered action',
                            target: action.target,
                            data: action.data,
                            result: result,
                            timestamp: new Date(actStartTime),
                            duration: actDuration,
                            retryCount: 0
                          });
                          
                          // === EXTRACT LLM TRACE FROM STAGEHAND RESPONSE (NO EXTRA CALLS) ===
                          if (result.trace && Array.isArray(result.trace)) {
                            console.log(`    🧠 Captured ${result.trace.length} LLM interactions from act action`);
                            for (const traceItem of result.trace) {
                              processingCapture.addLLMInteraction({
                                role: traceItem.role,
                                content: traceItem.content,
                                timestamp: new Date(traceItem.timestamp),
                                tokens: traceItem.tokens || 0,
                                model: traceItem.metadata?.actionType || 'stagehand'
                              });
                            }
                          }
                          
                          processingCapture.addBrowserEvent({
                            type: 'extract',
                            details: {
                              instruction: action.instruction,
                              useVision: action.useVision,
                              result: result,
                              aiPowered: true
                            },
                            timestamp: new Date(),
                            success: result?.success !== false
                          });
                        }
                    } catch (error) {
                        console.error(`    ❌ Act failed:`, error);
                        
                        // === CAPTURE ACT ERROR IN PROCESSING ===
                        if (this.memoryManager && processingCapture) {
                          const actDuration = Date.now() - actStartTime;
                          processingCapture.addError({
                            type: 'act_error',
                            message: error instanceof Error ? error.message : String(error),
                            timestamp: new Date(),
                            recovered: false,
                            stack: error instanceof Error ? error.stack : undefined
                          });
                          
                          processingCapture.addAction({
                            type: 'act',
                            instruction: action.instruction || 'AI-powered action',
                            target: action.target,
                            data: action.data,
                            result: { success: false, error: error instanceof Error ? error.message : String(error) },
                            timestamp: new Date(actStartTime),
                            duration: actDuration,
                            retryCount: 0
                          });
                        }
                        throw error;
                    }
                    break;

                case 'visual_scan':
                    console.log(`    - Simulating visual scan: ${action.instruction}`);
                    // In a real implementation, this would involve more complex AI vision processing.
                    // For now, we just log and continue.
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
                    break;

                case 'observe':
                    console.log(`    - Observing action: ${action.instruction}`);
                    const observeStartTime = Date.now();
                    try {
                        const result = await singleVNCSessionManager.executeAction({
                            type: 'observe',
                            data: { 
                                instruction: action.instruction,
                                maxActions: action.maxActions || 1
                            },
                            stepId: node.id
                        });
                        console.log(`    ✅ Observe completed:`, result);
                        
                        // === CAPTURE OBSERVE ACTION IN PROCESSING ===
                        if (this.memoryManager && processingCapture) {
                          const observeDuration = Date.now() - observeStartTime;
                          
                          // === EXTRACT LLM TRACE FROM STAGEHAND RESPONSE (NO EXTRA CALLS) ===
                          if (result.trace && Array.isArray(result.trace)) {
                            console.log(`    🧠 Captured ${result.trace.length} LLM interactions from observe action`);
                            for (const traceItem of result.trace) {
                              processingCapture.addLLMInteraction({
                                role: traceItem.role,
                                content: traceItem.content,
                                timestamp: new Date(traceItem.timestamp),
                                tokens: traceItem.tokens || 0,
                                model: traceItem.metadata?.actionType || 'stagehand'
                              });
                            }
                          }
                          
                          processingCapture.addAction({
                            type: 'observe',
                            instruction: action.instruction || 'Page observation',
                            target: null,
                            data: { maxActions: action.maxActions || 1 },
                            result: result,
                            timestamp: new Date(observeStartTime),
                            duration: observeDuration,
                            retryCount: 0
                          });
                        }
                        
                        // Store observed actions for later use
                        this.state.set(`${node.id}_observed_actions`, result);
                    } catch (error) {
                        console.error(`    ❌ Observe failed:`, error);
                    }
                    break;

                case 'clear_memory':
                    console.log(`    - Clearing Stagehand memory`);
                    try {
                        const result = await singleVNCSessionManager.executeAction({
                            type: 'clear_memory',
                            data: {},
                            stepId: node.id
                        });
                        console.log(`    ✅ Memory cleared:`, result);
                    } catch (error) {
                        console.error(`    ❌ Memory clear failed:`, error);
                    }
                    break;

                case 'label_email':
                    console.log(`    - Labeling email: ${action.data?.label}`);
                    try {
                        const result = await singleVNCSessionManager.executeAction({
                            type: 'label_email',
                            data: { 
                                label: action.data?.label || 'AEF-Processed'
                            },
                            stepId: node.id
                        });
                        console.log(`    ✅ Email labeled:`, result);
                    } catch (error) {
                        console.error(`    ❌ Email labeling failed:`, error);
                    }
                    break;

                case 'search_airtable':
                    console.log(`    - Searching Airtable: ${action.data?.searchValue}`);
                    try {
                        const result = await singleVNCSessionManager.executeAction({
                            type: 'search_airtable',
                            data: { 
                                searchFields: action.data?.searchFields || ['name'],
                                searchValue: action.data?.searchValue
                            },
                            stepId: node.id
                        });
                        console.log(`    ✅ Airtable search completed:`, result);
                        // Store search results for decision nodes
                        this.state.set(`${node.id}_search_results`, result);
                    } catch (error) {
                        console.error(`    ❌ Airtable search failed:`, error);
                    }
                    break;

                case 'paginate_extract':
                    console.log(`    - Paginating and extracting: ${action.instruction}`);
                    try {
                        const result = await this.executePaginateExtract( action, resolvedNode);
                        console.log(`    ✅ Paginate extract completed:`, result);
                        // Store extracted data for processing
                        this.state.set(`${node.id}_extracted_data`, result);
                    } catch (error) {
                        console.error(`    ❌ Paginate extract failed:`, error);
                    }
                    break;

                case 'extract_list':
                    console.log(`    - Extracting list: ${action.instruction || 'List extraction'}`);
                    try {
                        const result = await this.executeExtractList( action, resolvedNode);
                        console.log(`    ✅ Extract list completed:`, result);
                        // Store extracted data for processing
                        this.state.set(`${node.id}_extracted_data`, result);
                    } catch (error) {
                        console.error(`    ❌ Extract list failed:`, error);
                    }
                    break;

                default:
                    console.log(`    - Delegating '${action.type}' to executeAction helper`);
                    await this.executeAction( action, resolvedNode);
                    
                    // === MEMORY CAPTURE 2: PROCESSING (BLOCKING) ===
                    if (this.memoryManager && processingCapture) {
                      processingCapture.addAction({
                        type: action.type,
                        instruction: action.instruction || `${action.type} action`,
                        target: action.target,
                        data: action.data,
                        result: null, // Would be populated with actual result
                        timestamp: new Date(),
                        duration: 0 // Would be calculated from actual execution
                      });
                    }
            }
        }
    }
    
    // === MEMORY CAPTURE 3: OUTPUTS (BLOCKING) ===
    if (this.memoryManager) {
      const nodeDuration = Date.now() - nodeStartTime;
      console.log(`🧠 Capturing outputs for node ${node.id}...`);
      
      const outputs: MemoryOutputs = {
        primaryData: this.state.get(`${node.id}_result`) || null,
        stateChanges: {
          [`${node.id}_completed`]: true,
          [`${node.id}_timestamp`]: new Date().toISOString(),
          [`${node.id}_final_url`]: await this.getCurrentUrl(),
          [`${node.id}_actions_executed`]: resolvedNode.actions?.length || 0
        },
        extractedData: this.state.get(`${node.id}_extracted_data`),
        decisionResult: this.state.get(`${node.id}_decision_result`) ? {
          condition: node.intent || 'decision',
          result: this.state.get(`${node.id}_decision_result`).decision || false,
          nextNode: this.findNextNode(node.id)?.id || 'none'
        } : undefined,
        navigationResult: node.actions?.some(a => a.type === 'navigate' || a.type === 'navigate_or_switch_tab') ? {
          finalUrl: await this.getCurrentUrl() || 'unknown',
          loadTime: nodeDuration,
          success: true,
          statusCode: 200
        } : undefined,
        executionMetadata: {
          status: 'success',
          duration: nodeDuration,
          retryCount: 0,
          finalState: Object.fromEntries(this.state),
          resourceUsage: {
            tokens: processingCapture?.getProcessingData().llmInteractions.length || 0,
            apiCalls: processingCapture?.getProcessingData().actions.length || 0,
                         memoryUsage: Math.round(JSON.stringify(processingCapture?.getProcessingData() || {}).length / 1024)
          }
        }
      };
      
      const forwardingRules: ForwardingRules = {
        forwardToNext: ['primaryData', 'extractedData'], // Forward main results
        keepInLoop: [], // No loop context for now
        aggregateAcrossIterations: [],
        clearFromMemory: [],
        compressLargeData: false
      };
      
      // Get inputs that were captured earlier
      const inputs: MemoryInputs = {
        previousState: Object.fromEntries(this.state),
        nodeVariables: resolvedNode.variables || {},
        credentials: {},
        environment: {
          currentUrl: await this.getCurrentUrl(),
          domSnapshot: await this.getDOMSnapshot(),
          activeTab: await this.getActiveTab(),
          accessibilityTree: await this.getAccessibilityTree(),
          sessionState: {}
        },
        contextData: {
          loopContext: this.getLoopContext(node.id),
          parentContext: {}
        },
        actionInputs: {
          instruction: node.intent,
          schema: (resolvedNode as any).schema,
          target: (resolvedNode as any).target,
          data: (resolvedNode as any).data,
          timeout: (resolvedNode as any).timeout,
          config: resolvedNode
        }
      };
      
      // === INTEGRATE STAGEHAND MEMORY HOOKS ===
      const llmConversations = await this.getLLMConversations();
      
      // Convert StagehandMemoryHooks conversations to our format
      for (const conversation of llmConversations) {
        if (processingCapture) {
          processingCapture.addLLMInteraction({
            role: 'user',
            content: conversation.prompt,
            timestamp: new Date(conversation.timestamp),
            tokens: conversation.prompt.length, // Rough estimate
            model: 'stagehand'
          });
          
          if (conversation.response) {
            processingCapture.addLLMInteraction({
              role: 'assistant', 
              content: conversation.response,
              timestamp: new Date(conversation.timestamp + 1000), // Slight offset
              tokens: conversation.response.length, // Rough estimate
              model: 'stagehand'
            });
          }
        }
      }
      
      const processing = processingCapture?.getProcessingData() || {
        llmInteractions: [],
        actions: [],
        browserEvents: [],
        errors: []
      };
      
      try {
        await this.memoryManager.captureNodeMemory(
          this.executionId, node.id, this.userId,
          inputs,
          processing,
          outputs,
          forwardingRules
        );
        console.log(`✅ Complete memory captured for node ${node.id} in ${nodeDuration}ms`);
        
        // === MEMORY CAPTURE 4: CONTEXT FORWARDING (BLOCKING) ===
        const nextNode = this.findNextNode(node.id);
        if (nextNode) {
          const nextContext = await this.memoryManager.getContextForNextNode(
            this.executionId, node.id,
            nextNode.id
          );
          
          // Update state with forwarded context for next node
          for (const [key, value] of Object.entries(nextContext.availableVariables)) {
            this.state.set(key, value);
          }
          
          console.log(`🔄 Context forwarded to next node ${nextNode.id}: ${Object.keys(nextContext.availableVariables).length} variables`);
        }
        
      } catch (error) {
        const message = `CRITICAL: Memory capture failed for node ${node.id}`;
        console.error(`❌ ${message}:`, error);
        throw new Error(`${message}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  // New node type handlers
  private async executeDecisionNode(node: WorkflowNode): Promise<void> {
    console.log(`  🔀 Decision node: ${node.label}`);
    
    if (!node.actions || node.actions.length === 0) {
      console.warn(`  ⚠️ Decision node ${node.id} has no actions to evaluate condition`);
      return;
    }

    // Execute the decision action (usually an extract)
    const action = node.actions[0];
    let decisionResult: any = null;

    try {
      if (action.type === 'extract') {
        const result = await singleVNCSessionManager.executeAction({
          type: 'extract',
          data: { 
            instruction: action.instruction,
            schema: action.schema
          },
          stepId: node.id
        });
        decisionResult = result;
      }

      // Store decision result for flow navigation
      this.state.set(`${node.id}_decision_result`, decisionResult);
      console.log(`  ✅ Decision evaluated:`, decisionResult);
    } catch (error) {
      console.error(`  ❌ Decision evaluation failed:`, error);
      // Default to 'N' path on error
      this.state.set(`${node.id}_decision_result`, { decision: false });
    }
  }

  private async executeAssertNode(node: WorkflowNode): Promise<void> {
    console.log(`  ✅ Assert node: ${node.label}`);
    
    // Check assert conditions
    if (node.assertConditions && Array.isArray(node.assertConditions)) {
      for (const condition of node.assertConditions) {
        console.log(`    - Checking condition: ${condition.type} = ${condition.value}`);
        
        try {
          let conditionMet = false;
          
          switch (condition.type) {
            case 'selectorVisible':
              const visibilityResult = await singleVNCSessionManager.executeAction({
                type: 'extract',
                data: { 
                  instruction: `Check if element with selector "${condition.value}" is visible`,
                  schema: { visible: 'boolean' }
                },
                stepId: node.id
              });
              conditionMet = visibilityResult?.visible === true;
              break;
              
            case 'urlMatch':
              const urlResult = await singleVNCSessionManager.executeAction({
                type: 'extract',
                data: { 
                  instruction: `Check if current URL contains "${condition.value}"`,
                  schema: { urlMatches: 'boolean' }
                },
                stepId: node.id
              });
              conditionMet = urlResult?.urlMatches === true;
              break;
              
            case 'textPresent':
              const textResult = await singleVNCSessionManager.executeAction({
                type: 'extract',
                data: { 
                  instruction: `Check if text "${condition.value}" is present on the page`,
                  schema: { textPresent: 'boolean' }
                },
                stepId: node.id
              });
              conditionMet = textResult?.textPresent === true;
              break;
          }
          
          if (!conditionMet) {
            throw new Error(`Assertion failed: ${condition.type} = ${condition.value}`);
          }
          
          console.log(`    ✅ Condition met: ${condition.type}`);
        } catch (error) {
          console.error(`    ❌ Assertion failed:`, error);
          throw error; // Re-throw to stop execution
        }
      }
    }

    // Execute any additional actions
    if (node.actions && node.actions.length > 0) {
      for (const action of node.actions) {
        await this.executeAction( action, node);
      }
    }
  }

  private async executeErrorHandlerNode(node: WorkflowNode): Promise<void> {
    console.log(`  🚨 Error handler node: ${node.label}`);
    
    if (node.humanEscalate) {
      console.log(`  👤 Human escalation required for: ${node.label}`);
      // In a real implementation, this would send notifications
      // For now, we'll pause execution and log
      console.log(`  ⏸️ Execution paused for human intervention`);
      
      // Execute any actions (like waiting for human input)
      if (node.actions && node.actions.length > 0) {
        for (const action of node.actions) {
          await this.executeAction( action, node);
        }
      }
    } else if (node.fallbackAction) {
      console.log(`  🔄 Executing fallback action: ${node.fallbackAction}`);
      // Execute fallback logic
    }
  }

  private async executeDataTransformNode(node: WorkflowNode): Promise<void> {
    console.log(`  🔄 Data transform node: ${node.label}`);
    
    if (node.transformFunction) {
      try {
        // Get input data from previous node or state
        const inputData = this.state.get(`${node.id}_input_data`) || {};
        
        // WARNING: This is a security risk in production - should use sandboxed execution
        const transformFn = new Function('data', `return (${node.transformFunction})(data);`);
        const transformedData = transformFn(inputData);
        
        // Store transformed data
        this.state.set(`${node.id}_transformed_data`, transformedData);
        console.log(`  ✅ Data transformed:`, transformedData);
      } catch (error) {
        console.error(`  ❌ Data transformation failed:`, error);
        throw error;
      }
    }
  }

  private async executeGeneratorNode(node: WorkflowNode): Promise<void> {
    console.log(`  📝 Generator node: ${node.label}`);
    
    // Execute actions (usually extract with generation instruction)
    if (node.actions && node.actions.length > 0) {
      for (const action of node.actions) {
        if (action.type === 'extract') {
          try {
            const result = await singleVNCSessionManager.executeAction({
              type: 'extract',
              data: { 
                instruction: action.instruction,
                schema: action.schema
              },
              stepId: node.id
            });
            
            // Store generated content
            this.state.set(`${node.id}_generated_content`, result);
            console.log(`  ✅ Content generated:`, result);
          } catch (error) {
            console.error(`  ❌ Content generation failed:`, error);
          }
        }
      }
    }
  }

  private async executeExploreNode(node: WorkflowNode): Promise<void> {
    console.log(`  🔍 Explore node: ${node.label}`);
    
    const maxActions = node.maxActions || 6;
    console.log(`  📊 Max exploration actions: ${maxActions}`);
    
    // Execute bounded exploration
    if (node.actions && node.actions.length > 0) {
      for (const action of node.actions) {
        if (action.type === 'observe') {
          try {
            const result = await singleVNCSessionManager.executeAction({
              type: 'observe',
              data: { 
                instruction: action.instruction,
                maxActions: maxActions
              },
              stepId: node.id
            });
            
            // Store exploration results
            this.state.set(`${node.id}_exploration_results`, result);
            console.log(`  ✅ Exploration completed:`, result);
          } catch (error) {
            console.error(`  ❌ Exploration failed:`, error);
          }
        }
      }
    }
  }

  /**
   * Execute a filter_list node: reads an input array from engine state, chunks it, sends each chunk to Stagehand via an `act` call,
   * expects a JSON boolean array back (same length as the chunk) and writes the kept items to state[outputKey].
   */
  private async executeFilterListNode(node: WorkflowNode): Promise<void> {
    console.log(`  🗂️  Filter-list node: ${node.label}`);
    console.log(`  🗂️ State keys at filter start:`, Array.from(this.state.keys()));
    console.log(`  🗂️ State size:`, this.state.size);

    const inputKey: string = node.inputKey || (node as any).listConfig?.inputKey || `${node.id}_input`;
    const outputKey: string = node.outputKey || (node as any).listConfig?.outputKey || `${node.id}_filtered`;
    const batchSize: number = node.batchSize || (node as any).listConfig?.batchSize || 25;
    const promptTemplate: string = node.promptTemplate || (node as any).listConfig?.promptTemplate ||
      'You will receive JSON array of items. Return a JSON array of booleans of equal length where true means keep.';

    // === ENHANCED: HANDLE DOT NOTATION IN INPUT KEY ===
    let sourceData: any = null;
    
    if (inputKey.includes('.')) {
      // Handle dot notation like "extract_email_candidates.emails"
      const [baseKey, ...propertyPath] = inputKey.split('.');
      const baseData = this.state.get(baseKey);
      
      if (baseData) {
        sourceData = baseData;
        // Navigate through the property path
        for (const prop of propertyPath) {
          if (sourceData && typeof sourceData === 'object' && prop in sourceData) {
            sourceData = sourceData[prop];
          } else {
            sourceData = null;
            break;
          }
        }
      }
      
      console.log(`  🔍 Resolved dot notation "${inputKey}":`, {
        baseKey,
        propertyPath,
        baseData: !!baseData,
        sourceData: Array.isArray(sourceData) ? `Array[${sourceData.length}]` : typeof sourceData
      });
    } else {
      // Simple key lookup
      sourceData = this.state.get(inputKey);
    }
    
    // Try .items field if sourceData is an object with items array
    if (sourceData && Array.isArray(sourceData.items)) {
      sourceData = sourceData.items;
    }

    if (!Array.isArray(sourceData)) {
      console.warn(`  ⚠️  Filter-list node ${node.id}: No array found at state[${inputKey}]. Available state keys:`, Array.from(this.state.keys()));
      console.warn(`  📊  Input key resolved to:`, typeof sourceData, sourceData);
      return;
    }

    const kept: any[] = [];
    const total = sourceData.length;
    let processed = 0;

    while (processed < total) {
      const batch = sourceData.slice(processed, processed + batchSize);

      // Use VariableResolver for consistent placeholder replacement
      const batchContext = VariableResolver.createContext(
        this.userId,
        this.workflowId,
        this.executionId, node.id,
        { 
          state: Object.fromEntries(this.state),
          batch_index: Math.floor(processed / batchSize),
          batch_size: batch.length,
          total_items: total
        }
      );
      const instruction = VariableResolver.resolveVariables(promptTemplate, batchContext);

      try {
        const result = await singleVNCSessionManager.executeAction({
          type: 'act',
          data: {
            instruction,
            payload: batch
          },
          stepId: node.id
        });

        console.log(`  🔍 Raw filter result for batch ${Math.floor(processed / batchSize)}:`, JSON.stringify(result, null, 2));

        // ENHANCED: Much more robust response parsing for filter lists
        let boolArray: boolean[] | null = null;
        
        // Try multiple extraction strategies
        const extractionStrategies = [
          // Strategy 1: Direct array result
          () => Array.isArray(result) ? result : null,
          
          // Strategy 2: Result in payload field
          () => Array.isArray(result?.payload) ? result.payload : null,
          
          // Strategy 3: String payload that needs JSON parsing
          () => {
            if (typeof result?.payload === 'string') {
              try {
                const parsed = JSON.parse(result.payload);
                return Array.isArray(parsed) ? parsed : null;
              } catch (_) { return null; }
            }
            return null;
          },
          
          // Strategy 4: String result that needs JSON parsing
          () => {
            if (typeof result === 'string') {
              try {
                const parsed = JSON.parse(result);
                return Array.isArray(parsed) ? parsed : null;
              } catch (_) { return null; }
            }
            return null;
          },
          
          // Strategy 5: Look for array in nested result structure
          () => {
            if (result?.result && Array.isArray(result.result)) {
              return result.result;
            }
            return null;
          },
          
          // Strategy 6: Extract from LLM response content
          () => {
            const content = result?.content || result?.response || result?.message;
            if (typeof content === 'string') {
              try {
                // Look for JSON array pattern in the string
                const arrayMatch = content.match(/\[[\s\S]*?\]/);
                if (arrayMatch) {
                  const parsed = JSON.parse(arrayMatch[0]);
                  return Array.isArray(parsed) ? parsed : null;
                }
              } catch (_) { return null; }
            }
            return null;
          }
        ];
        
        // Try each strategy until one works
        for (let i = 0; i < extractionStrategies.length; i++) {
          const strategy = extractionStrategies[i];
          const extracted = strategy();
          if (extracted && Array.isArray(extracted)) {
            console.log(`  ✅ Filter result extracted using strategy ${i + 1}`);
            boolArray = extracted;
            break;
          }
        }

        if (!boolArray) {
          console.error(`  ❌ No valid boolean array found in result. Raw result:`, result);
          throw new Error(`No boolean array found in LLM response. Expected format: [true, false, true, ...]`);
        }

        if (boolArray.length !== batch.length) {
          console.error(`  ❌ Length mismatch: expected ${batch.length}, got ${boolArray.length}`);
          console.error(`  📊 Batch content:`, batch.map((item, idx) => `${idx}: ${item.subject || item.name || 'Unknown'}`));
          console.error(`  📊 Bool array:`, boolArray);
          throw new Error(`Length mismatch: expected ${batch.length}, got ${boolArray.length}`);
        }

        // Validate and coerce boolean values
        const coercedBoolArray: boolean[] = [];
        let hasInvalidValues = false;
        
        for (let i = 0; i < boolArray.length; i++) {
          const val = boolArray[i];
          if (typeof val === 'boolean') {
            coercedBoolArray.push(val);
          } else if (val === 'true' || val === 1 || val === '1') {
            coercedBoolArray.push(true);
            hasInvalidValues = true;
          } else if (val === 'false' || val === 0 || val === '0' || val === null || val === undefined) {
            coercedBoolArray.push(false);
            hasInvalidValues = true;
          } else {
            console.error(`  ❌ Invalid boolean value at index ${i}:`, val);
            throw new Error(`Invalid response: expected boolean at index ${i}, got ${typeof val}: ${val}`);
          }
        }
        
        if (hasInvalidValues) {
          console.warn(`  ⚠️ Had to coerce some non-boolean values in filter response`);
        }

        // Keep items where boolArray[i] == true
        coercedBoolArray.forEach((keep, idx) => {
          if (keep) {
            console.log(`  ✅ Keeping item ${idx}: ${batch[idx].subject || batch[idx].name || 'Unknown'}`);
            kept.push(batch[idx]);
          } else {
            console.log(`  ❌ Filtering out item ${idx}: ${batch[idx].subject || batch[idx].name || 'Unknown'}`);
          }
        });

        console.log(`  📊 Batch ${Math.floor(processed / batchSize)} results: kept ${coercedBoolArray.filter(x => x).length}/${batch.length} items`);

      } catch (error) {
        console.error(`  ❌ Filter-list batch ${processed}-${processed + batch.length} failed:`, error);
        console.error(`  📊 Failed batch content:`, batch.map((item, idx) => `${idx}: ${item.subject || item.name || 'Unknown'}`));
        console.warn(`  ⚠️ Skipping failed batch and continuing with next batch`);
        // Don't retry - just skip this batch and continue
      }

      processed += batch.length;
    }

    this.state.set(outputKey, kept);
    console.log(`  ✅ Filter-list complete. Kept ${kept.length} / ${total} items. Stored at state[${outputKey}].`);
  }

  /**
   * Execute an llm_call node: calls an LLM directly with a prompt template and stores the result
   */
  private async executeLLMCallNode(node: WorkflowNode): Promise<void> {
    console.log(`  🤖 LLM-call node: ${node.label}`);
    
    const {
      inputKey,
      outputKey,
      promptTemplate,
      model = 'gpt-4o-mini',
      outputSchema,
      settings = {}
    } = node;

    if (!promptTemplate) {
      throw new Error(`LLM-call node ${node.id} missing promptTemplate`);
    }

    if (!outputKey) {
      throw new Error(`LLM-call node ${node.id} missing outputKey`);
    }

    try {
      // 1. Resolve input data
      let inputData: any = {};
      if (inputKey) {
        // Handle dot notation like "extract_email_candidates.emails"
        if (inputKey.includes('.')) {
          const [baseKey, ...propertyPath] = inputKey.split('.');
          const baseData = this.state.get(baseKey);
          
          if (baseData) {
            inputData = baseData;
            // Navigate through the property path
            for (const prop of propertyPath) {
              if (inputData && typeof inputData === 'object' && prop in inputData) {
                inputData = inputData[prop];
              } else {
                inputData = null;
                break;
              }
            }
          }
          
          console.log(`  🔍 Resolved dot notation "${inputKey}":`, {
            baseKey,
            propertyPath,
            baseData: !!baseData,
            sourceData: Array.isArray(inputData) ? `Array[${inputData.length}]` : typeof inputData
          });
        } else {
          // Simple key lookup
          inputData = this.state.get(inputKey);
        }
        
        console.log(`  📥 Input resolved from '${inputKey}':`, typeof inputData);
      } else {
        // Use entire state if no inputKey specified
        inputData = Object.fromEntries(this.state);
        console.log(`  📥 Using entire state as input (${Object.keys(inputData).length} keys)`);
      }

      // 2. Render prompt template
      let prompt = promptTemplate;
      if (typeof inputData === 'object' && inputData !== null) {
        // Simple template replacement for {{input}} and {{key.subkey}}
        prompt = prompt.replace(/\{\{input\}\}/g, JSON.stringify(inputData, null, 2));
        
        // Replace nested properties like {{input.emails}}
        prompt = prompt.replace(/\{\{([^}]+)\}\}/g, (match: string, key: string) => {
          try {
            const keys = key.split('.');
            let value = inputData;
            for (const k of keys) {
              value = value?.[k];
            }
            return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value || '');
          } catch {
            return match; // Keep original if resolution fails
          }
        });
      } else {
        prompt = prompt.replace(/\{\{input\}\}/g, String(inputData));
      }

      console.log(`  📝 Rendered prompt (${prompt.length} chars)`);

      // 3. Call OpenAI API directly
      const startTime = Date.now();
      
      // Read API key from environment
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY not found in environment');
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: settings.temperature || 0.1,
          max_tokens: settings.max_tokens || settings.maxTokens || 1000,
          ...settings
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
      }

      const apiResult = await response.json();
      const content = apiResult.choices?.[0]?.message?.content;
      
      if (!content) {
        throw new Error('No content returned from OpenAI API');
      }

      const duration = Date.now() - startTime;
      console.log(`  🚀 LLM response received (${duration}ms, ${apiResult.usage?.total_tokens || '?'} tokens)`);

      // 4. Parse response and validate
      let parsedResult: any = content;
      
      // Clean up common LLM response formats
      let cleanContent = content.trim();
      
      // Remove markdown code blocks
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to parse as JSON if it looks like JSON
      if (cleanContent.startsWith('{') || cleanContent.startsWith('[')) {
        try {
          parsedResult = JSON.parse(cleanContent);
          console.log(`  📄 LLM raw content (sanitised):`, cleanContent.length > 5000 ? cleanContent.slice(0, 5000) + '…' : cleanContent);
          console.log(`  📊 Parsed result:`, Array.isArray(parsedResult) || typeof parsedResult === 'object'
            ? JSON.stringify(parsedResult).slice(0, 5000)
            : parsedResult);
          console.log(`  📊 Parsed JSON response:`, typeof parsedResult);
        } catch (parseError) {
          console.log(`  📝 Response is raw text (JSON parse failed):`, parseError instanceof Error ? parseError.message : 'Unknown error');
          // Keep original content if parsing fails
          parsedResult = content;
        }
      } else {
        console.log(`  📝 Response is raw text`);
      }

      // Validate against schema if provided
      if (outputSchema) {
        try {
          // Simple validation for basic types
          if (outputSchema.type === 'boolean' && typeof parsedResult !== 'boolean') {
            throw new Error(`Expected boolean, got ${typeof parsedResult}`);
          }
          if (outputSchema.type === 'string' && typeof parsedResult !== 'string') {
            throw new Error(`Expected string, got ${typeof parsedResult}`);
          }
          if (outputSchema.type === 'array' && !Array.isArray(parsedResult)) {
            throw new Error(`Expected array, got ${typeof parsedResult}`);
          }
          console.log(`  ✅ Output schema validation passed`);
        } catch (validationError) {
          console.error(`  ❌ Output schema validation failed:`, validationError);
          throw validationError;
        }
      }

      // 5. Store result in state
      this.state.set(outputKey, parsedResult);
      console.log(`  💾 Result stored in state['${outputKey}']`);
      
      // Log for debugging
      console.log(`  ✅ LLM-call complete. Model: ${model}, Duration: ${duration}ms, Tokens: ${apiResult.usage?.total_tokens || '?'}`);

    } catch (error) {
      console.error(`  ❌ LLM-call failed:`, error);
      throw error;
    }
  }

  /**
   * Execute a list_iterator node: iterates through a list in state, injecting currentItem and index variables
   * for each iteration, then executes all child nodes for each item.
   */
  private async executeListIteratorNode(node: WorkflowNode): Promise<void> {
    console.log(`  🔄 List-iterator node: ${node.label}`);

    const config = node.iteratorConfig;
    if (!config) {
      throw new Error(`List iterator node ${node.id} missing iteratorConfig`);
    }

    const {
      listVariable,
      itemVariable = 'currentItem',
      indexVariable = 'currentIndex',
      maxIterations = 1000,
      continueOnError = false,
      batchSize = 1,
      delayMs = 0
    } = config;

    // Get the list from state
    let sourceList: any = this.state.get(listVariable);
    if (sourceList && Array.isArray(sourceList.items)) {
      sourceList = sourceList.items;
    }

    if (!Array.isArray(sourceList)) {
      console.warn(`  ⚠️  List-iterator node ${node.id}: No array found at state[${listVariable}]. Skipping.`);
      return;
    }

    const totalItems = sourceList.length;
    console.log(`  📊 Processing ${totalItems} items with iterator`);

    // Initialize or get existing loop state
    let loopState = this.loopStates.get(node.id);
    if (!loopState) {
      loopState = { index: 0, length: totalItems, queueKey: listVariable };
      this.loopStates.set(node.id, loopState);
    }

    // Process items
    let processedCount = 0;
    while (loopState.index < loopState.length && processedCount < maxIterations) {
      const currentItem = sourceList[loopState.index];
      
      console.log(`  🔄 Processing item ${loopState.index + 1}/${loopState.length}`);

      // Push scope with current item and index
      VariableResolver.pushScope({
        [itemVariable]: currentItem,
        [indexVariable]: loopState.index,
        length: loopState.length
      });

      try {
        // Execute child nodes if they exist
        if (node.children && node.children.length > 0) {
          for (const childId of node.children) {
            const childNode = this.sop.execution.workflow.nodes.find(n => n.id === childId);
            if (childNode) {
              console.log(`    ▶️ Executing child: ${childNode.label} (${childId})`);
              await this.executeNode(childNode);
            } else {
              console.warn(`    ⚠️ Child node ${childId} not found`);
            }
          }
        }

        console.log(`  ✅ Item ${loopState.index + 1} processed successfully`);
      } catch (error) {
        console.error(`  ❌ Error processing item ${loopState.index + 1}:`, error);
        
        if (!continueOnError) {
          throw error;
        } else {
          console.log(`  ⚠️ Continuing with next item due to continueOnError=true`);
        }
      } finally {
        // Always pop scope after processing item
        VariableResolver.popScope();
      }

      // Move to next item
      loopState.index++;
      processedCount++;

      // Add small delay between iterations for observability
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    // Clean up loop state
    this.loopStates.delete(node.id);
    
    if (processedCount >= maxIterations) {
      console.warn(`  ⚠️ List iterator stopped at maxIterations limit (${maxIterations})`);
    }

    console.log(`  ✅ List-iterator complete. Processed ${processedCount} items.`);
  }

  // Helper method to execute individual actions
  private async executeAction(action: any, node: WorkflowNode): Promise<void> {
    console.log(`    - Action: ${action.type}`);
    
    switch (action.type) {
      case 'extract':
        try {
          const result = await singleVNCSessionManager.executeAction({
            type: 'extract',
            data: { 
              instruction: action.instruction,
              schema: action.schema
            },
            stepId: node.id
          });
          
          // === PLAN A: EXTRACT LLM TRACE FOR EXTRACT ACTION ===
          if (result.trace && Array.isArray(result.trace) && this.memoryManager) {
            console.log(`    🧠 Captured ${result.trace.length} LLM interactions from extract action`);
            // Note: This will be captured when executeAction is called from main execution loop
          }
          
          console.log(`    ✅ Extract completed:`, result);
          return result;
        } catch (error) {
          console.error(`    ❌ Extract failed:`, error);
          throw error;
        }
        
      case 'act':
        try {
          let browserAction = {
            type: 'act' as const,
            data: { 
              instruction: action.instruction,
              ...action.data
            },
            stepId: node.id
          };
          
          browserAction = await this.injectCredentialsIntoAction(browserAction, node);
          
          const result = await singleVNCSessionManager.executeAction(browserAction);
          console.log(`    ✅ Act completed:`, result);
          return result;
        } catch (error) {
          console.error(`    ❌ Act failed:`, error);
          throw error;
        }
        
      case 'update_row':
      case 'create_row':
        try {
          const browserAction = {
            type: action.type,
            data: {
              rowConfig: action.rowConfig,
              variables: Object.fromEntries(this.state)
            },
            stepId: node.id
          } as any;

          const result = await singleVNCSessionManager.executeAction(browserAction);
          console.log(`    ✅ ${action.type} completed:`, result);
          return result;
        } catch (error) {
          console.error(`    ❌ ${action.type} failed:`, error);
          throw error;
        }
        
      default:
        console.log(`    - Action type '${action.type}' not handled in executeAction`);
    }
  }

  // Helper method for paginate_extract
  private async executePaginateExtract(action: any, node: WorkflowNode): Promise<any> {
    const allResults: any[] = [];
    let hasMorePages = true;
    let pageCount = 0;
    const maxPages = 10; // Safety limit
    
    while (hasMorePages && pageCount < maxPages) {
      console.log(`    📄 Processing page ${pageCount + 1}`);
      
      try {
        // Extract current page
        const pageResult = await singleVNCSessionManager.executeAction({
          type: 'extract',
          data: { 
            instruction: action.instruction,
            schema: action.schema
          },
          stepId: node.id
        });
        
        if (pageResult && pageResult.threads && Array.isArray(pageResult.threads)) {
          allResults.push(...pageResult.threads);
        }
        
        // Check for next page
        const hasNext = await singleVNCSessionManager.executeAction({
          type: 'extract',
          data: { 
            instruction: "Check if 'Older' or 'Next' button is enabled and visible",
            schema: { hasNextPage: 'boolean' }
          },
          stepId: node.id
        });
        
        if (hasNext?.hasNextPage) {
          // Click next page
          await singleVNCSessionManager.executeAction({
            type: 'act',
            data: { 
              instruction: "Click the 'Older' or 'Next' button to go to next page"
            },
            stepId: node.id
          });
          
          // Wait for page to load
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          hasMorePages = false;
        }
        
        pageCount++;
      } catch (error) {
        console.error(`    ❌ Page ${pageCount + 1} extraction failed:`, error);
        hasMorePages = false;
      }
    }
    
    console.log(`    📊 Extracted ${allResults.length} items from ${pageCount} pages`);
    return { threads: allResults, totalPages: pageCount };
  }

  // Helper method for extract_list
  private async executeExtractList(action: any, node: WorkflowNode): Promise<any> {
    console.log(`    📋 Starting extract_list for node ${node.id}`);
    
    try {
              // Execute extract_list action via SingleVNCSessionManager
      const result = await singleVNCSessionManager.executeAction({
        type: 'extract_list',
        data: {
          fields: action.fields || {},
          itemSelector: action.itemSelector,
          nextPageSelector: action.nextPageSelector,
          maxItems: action.maxItems || 300,
          maxPages: action.maxPages || 20,
          scrollStrategy: action.scrollStrategy || 'auto',
          deduplication: action.deduplication !== false,
          stream: action.stream || false,
          stopPredicate: action.stopPredicate,
          throttleMs: action.throttleMs || 250
        },
        stepId: node.id
      });

             console.log(`    ✅ Extract list completed: ${result.payload?.items?.length || 0} items, ${result.payload?.pagesVisited || 0} pages`);
       
       // Return the extracted data in a consistent format
       return {
         items: result.payload?.items || [],
         pagesVisited: result.payload?.pagesVisited || 0,
         totalItems: result.payload?.totalItems || 0,
         selectorCache: result.payload?.selectorCache
       };
    } catch (error) {
      console.error(`    ❌ Extract list failed for node ${node.id}:`, error);
      throw error;
    }
  }

  private findNextNode(currentId: string): WorkflowNode | undefined {
    const currentNode = this.sop.execution.workflow.nodes.find(node => node.id === currentId);
    if (!currentNode) return undefined;

    // Handle loop logic
    if (currentNode.type === 'iterative_loop' && currentNode.children && currentNode.children.length > 0) {
        const firstChildId = currentNode.children[0];
        console.log(`  - Entering loop, moving to first child: ${firstChildId}`);
        return this.sop.execution.workflow.nodes.find(node => node.id === firstChildId);
    }
    
    // Handle decision logic
    if (currentNode.type === 'decision' || currentNode.type === 'conditional_task') {
        const outgoingEdges = this.sop.execution.workflow.flow.filter(edge => edge.from === currentId);
        if (outgoingEdges.length > 0) {
            // For MVP, randomly pick a branch to show capability. A real implementation would evaluate conditions.
            const randomEdge = outgoingEdges[Math.floor(Math.random() * outgoingEdges.length)];
            console.log(`  - Decision node: randomly choosing path to ${randomEdge.to}`);
            return this.sop.execution.workflow.nodes.find(node => node.id === randomEdge.to);
        }
    }
    
    // Handle loop exit logic
    if (currentNode.parentId && this.isChildOfLoop(currentId)) {
        // Check if we should exit the loop or continue
        const shouldContinueLoop = Math.random() > 0.7; // 30% chance to exit for demo
        if (shouldContinueLoop) {
            // Go back to loop start
            const loopNode = this.sop.execution.workflow.nodes.find(node => 
                node.type === 'iterative_loop' && 
                node.children && 
                node.children.includes(currentId)
            );
            if (loopNode && loopNode.children) {
                const firstChildId = loopNode.children[0];
                console.log(`  - Continuing loop, going back to: ${firstChildId}`);
                return this.sop.execution.workflow.nodes.find(node => node.id === firstChildId);
            }
        } else {
            console.log(`  - Exiting loop`);
            // Find what comes after the loop
            const loopNode = this.sop.execution.workflow.nodes.find(node => 
                node.type === 'iterative_loop' && 
                node.children && 
                node.children.includes(currentId)
            );
            if (loopNode) {
                const outgoingEdges = this.sop.execution.workflow.flow.filter(edge => edge.from === loopNode.id);
                if (outgoingEdges.length > 0) {
                    return this.sop.execution.workflow.nodes.find(node => node.id === outgoingEdges[0].to);
                }
            }
        }
    }
    
    // Standard flow: find the next node via edges
    const outgoingEdges = this.sop.execution.workflow.flow.filter(edge => edge.from === currentId);
    if (outgoingEdges.length > 0) {
        return this.sop.execution.workflow.nodes.find(node => node.id === outgoingEdges[0].to);
    }
    
    return undefined;
  }
  
  private isChildOfLoop(nodeId: string): boolean {
    return this.sop.execution.workflow.nodes.some(node => 
        node.type === 'iterative_loop' && 
        node.children && 
        node.children.includes(nodeId)
    );
  }

  /**
   * Validate credentials before execution starts
   */
  private async validateCredentials(): Promise<void> {
    try {
      console.log(`🔍 [ExecutionEngine] Validating credentials for workflow ${this.workflowId}`);
      
      // Extract credential requirements from workflow nodes
      const requiredCredentials = this.extractWorkflowCredentials();
      
      if (requiredCredentials.length === 0) {
        console.log(`✅ [ExecutionEngine] No credentials required for workflow ${this.workflowId}`);
        return;
      }
      
      // Validate credentials using injection service
      const validation = await CredentialInjectionService.validateExecutionCredentials(
        this.workflowId,
        requiredCredentials
      );
      
      if (!validation.isValid) {
        const errorMessage = `Missing credentials: ${validation.missingCredentials.join(', ')}`;
        console.error(`❌ [ExecutionEngine] Credential validation failed: ${errorMessage}`);
        throw new Error(`Credential validation failed: ${errorMessage}`);
      }
      
      console.log(`✅ [ExecutionEngine] All credentials validated for workflow ${this.workflowId}`);
    } catch (error) {
      console.error(`❌ [ExecutionEngine] Credential validation error:`, error);
      throw error;
    }
  }

  /**
   * Inject credentials into a browser action if needed
   */
  private async injectCredentialsIntoAction(
    browserAction: any,
    node: WorkflowNode
  ): Promise<any> {
    try {
      // Check if action needs credential injection
      if (!CredentialInjectionService.actionRequiresCredentials(browserAction)) {
        return browserAction;
      }
      
      console.log(`🔐 [ExecutionEngine] Action requires credentials, injecting for step ${node.id}`);
      console.log(`🔐 [ExecutionEngine] User ID: ${this.userId}, Workflow ID: ${this.workflowId}`);
      
      // Get required credentials for this step
      const requiredCreds = CredentialInjectionService.extractRequiredCredentialsFromStep(
        node.id,
        this.sop.execution.workflow.nodes
      );
      
      console.log(`🔐 [ExecutionEngine] Required credentials for step ${node.id}:`, requiredCreds);
      
      // ✅ FIXED: Use the passed Supabase client for credential access
      if (!this.supabaseClient) {
        console.error(`❌ [ExecutionEngine] No Supabase client available for credential injection`);
        return browserAction;
      }
      
      console.log(`🔐 [ExecutionEngine] Using Supabase client for credential access`);
      
      // Get credentials for this step using authenticated Supabase client
      const credentials = await CredentialInjectionService.getCredentialsForStepWithSupabase(
        node.id,
        this.userId,
        this.workflowId,
        this.supabaseClient,
        requiredCreds
      );
      
      console.log(`🔐 [ExecutionEngine] Retrieved credentials:`, Object.keys(credentials || {}));
      
      // Inject credentials into action
      const injectedAction = CredentialInjectionService.injectCredentialsIntoAction(
        browserAction,
        credentials
      );
      
      // Clear credentials from memory for security
      CredentialInjectionService.clearCredentialsFromMemory(credentials);
      
      return injectedAction;
    } catch (error) {
      console.error(`❌ [ExecutionEngine] Failed to inject credentials:`, error);
      return browserAction; // Return original action if injection fails
    }
  }

  /**
   * Extract credential requirements from all workflow nodes
   */
  private extractWorkflowCredentials(): WorkflowCredential[] {
    const credentials: WorkflowCredential[] = [];
    const credentialMap = new Map<string, WorkflowCredential>();
    
    for (const node of this.sop.execution.workflow.nodes) {
      if (!node.credentialsRequired) continue;
      
      Object.entries(node.credentialsRequired).forEach(([service, fields]) => {
        if (!Array.isArray(fields)) return;
        
        fields.forEach(field => {
          const credentialId = `${service}_${field}`;
          
          if (!credentialMap.has(credentialId)) {
            credentialMap.set(credentialId, {
              id: credentialId,
              serviceType: service as any,
              label: `${service} ${field}`,
              description: `${service} ${field} for authentication`,
              type: field === 'email' ? 'email' as any : 
                    field === 'password' ? 'password' as any :
                    field === 'api_key' ? 'api_key' as any : 'text' as any,
              required: true,
              requiredForSteps: [node.id],
              placeholder: `Enter your ${field}`,
              helpText: `Required for ${service} authentication`,
              masked: field === 'password' || field === 'api_key'
            });
          } else {
            // Add this step to existing credential
            const existing = credentialMap.get(credentialId)!;
            existing.requiredForSteps.push(node.id);
          }
        });
      });
    }
    
    return Array.from(credentialMap.values());
  }

  // === MEMORY HELPER METHODS ===
  
  /**
   * Capture complete browser state for memory
   */
  private async captureBrowserState(): Promise<any> {
    try {
      console.log(`📸 [ExecutionEngine] Capturing browser state for ${this.executionId}`);
      
      const { BrowserStateCapture } = await import('@/lib/memory/BrowserStateCapture');
      
      const [currentUrl, domSnapshot, activeTab, sessionState, screenshot, accessibilityTree] = await Promise.all([
        BrowserStateCapture.getCurrentUrl(this.executionId),
        BrowserStateCapture.getDOMSnapshot(this.executionId),
        BrowserStateCapture.getActiveTab(this.executionId),
        BrowserStateCapture.getSessionState(this.executionId),
        BrowserStateCapture.takeScreenshot(this.executionId),
        BrowserStateCapture.getAccessibilityTree(this.executionId)
      ]);
      
      const browserState = {
        currentUrl,
        domSnapshot,
        activeTab,
        sessionState,
        screenshot,
        accessibilityTree,
        timestamp: Date.now()
      };
      
      console.log(`✅ [ExecutionEngine] Browser state captured: ${Object.keys(browserState).length} properties`);
      return browserState;
    } catch (error) {
      console.warn('Could not capture browser state:', error);
      return { timestamp: Date.now(), error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
  
  /**
   * Get LLM conversations for memory capture
   */
  private async getLLMConversations(): Promise<any[]> {
    try {
      console.log(`🤖 [ExecutionEngine] Getting LLM conversations for ${this.executionId}`);
      
      const { stagehandMemoryHooks } = await import('@/lib/memory/StagehandMemoryHooks');
      
      const conversations = stagehandMemoryHooks.getLLMConversations(this.executionId);
      
      console.log(`✅ [ExecutionEngine] LLM conversations retrieved: ${conversations.length} conversations`);
      return conversations;
    } catch (error) {
      console.warn('Could not get LLM conversations:', error);
      return [];
    }
  }
  
  /**
   * Get screenshots for memory capture
   */
  private async getScreenshots(): Promise<string[]> {
    try {
      console.log(`📷 [ExecutionEngine] Getting screenshots for ${this.executionId}`);
      
      const { BrowserStateCapture } = await import('@/lib/memory/BrowserStateCapture');
      
      const screenshot = await BrowserStateCapture.takeScreenshot(this.executionId);
      
      const screenshots = screenshot ? [screenshot] : [];
      
      console.log(`✅ [ExecutionEngine] Screenshots retrieved: ${screenshots.length} screenshots`);
      return screenshots;
    } catch (error) {
      console.warn('Could not get screenshots:', error);
      return [];
    }
  }
  
  /**
   * Get current URL from browser
   */
  private async getCurrentUrl(): Promise<string | undefined> {
    try {
      const { BrowserStateCapture } = await import('@/lib/memory/BrowserStateCapture');
      return await BrowserStateCapture.getCurrentUrl(this.executionId);
    } catch (error) {
      console.warn('Could not get current URL:', error);
      return undefined;
    }
  }
  
  /**
   * Get DOM snapshot for memory capture
   */
  private async getDOMSnapshot(): Promise<string | undefined> {
    try {
      const { BrowserStateCapture } = await import('@/lib/memory/BrowserStateCapture');
      return await BrowserStateCapture.getDOMSnapshot(this.executionId);
    } catch (error) {
      console.warn('Could not get DOM snapshot:', error);
      return undefined;
    }
  }
  
  /**
   * Get active browser tab info
   */
  private async getActiveTab(): Promise<string | undefined> {
    try {
      const { BrowserStateCapture } = await import('@/lib/memory/BrowserStateCapture');
      return await BrowserStateCapture.getActiveTab(this.executionId);
    } catch (error) {
      console.warn('Could not get active tab:', error);
      return undefined;
    }
  }
  
  /**
   * Get loop context for current node
   */
  private getLoopContext(nodeId: string): any {
    // Check if this node is part of a loop
    const loopState = this.loopStates.get(nodeId);
    if (loopState) {
      return {
        currentItem: null, // Would be populated from actual loop state
        iteration: loopState.index,
        totalItems: loopState.length,
        accumulatedResults: []
      };
    }
    return undefined;
  }

  /**
   * Get accessibility tree for memory capture
   */
  private async getAccessibilityTree(): Promise<string | undefined> {
    try {
      const { BrowserStateCapture } = await import('@/lib/memory/BrowserStateCapture');
      return await BrowserStateCapture.getAccessibilityTree(this.executionId);
    } catch (error) {
      console.warn('Could not get accessibility tree:', error);
      return undefined;
    }
  }
}

// To use this engine, you would do something like:
// const mySop: SOPDocument = { ... }; // Your hardcoded SOP
// const engine = new ExecutionEngine(mySop, userId, workflowId);
// engine.start(); 