import { SOPDocument, SOPNode, BrowserInstruction } from '../../lib/types/sop';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';
import { CredentialInjectionService, ExecutionCredentials } from '@/lib/credentials/injection';
import { WorkflowCredential } from '@/lib/types/aef';
import { VariableResolver, VariableContext } from '@/lib/workflow/VariableResolver';

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
  private supabaseClient: any; // Service role Supabase client for credential access

  constructor(sop: WorkflowDocument, userId: string, workflowId?: string) {
    this.sop = sop;
    this.state = new Map<string, any>();
    this.userId = userId;
    this.workflowId = workflowId || (sop as any).meta?.id || 'unknown';
  }

  /**
   * Set the Supabase client for credential access
   */
  public setSupabaseClient(supabaseClient: any): void {
    this.supabaseClient = supabaseClient;
  }

  public async start(executionId: string) {
    console.log(`🚀 Starting execution for workflow ${this.workflowId}, user ${this.userId}`);
    
    // Validate credentials before starting execution
    await this.validateCredentials();
    
    // Find the start node (first node in the workflow)
    this.currentNode = this.sop.execution.workflow.nodes[0];
    console.log(`🚀 Starting execution with node: ${this.currentNode?.label}`);
    await this.execute(executionId);
  }

  // New method: Execute a specific node by ID
  public async executeNodeById(executionId: string, nodeId: string): Promise<{ success: boolean; message: string; nextNodeId?: string }> {
    console.log(`🎯 Executing specific node: ${nodeId}`);
    
    const node = this.sop.execution.workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      const message = `Node ${nodeId} not found`;
      console.error(message);
      return { success: false, message };
    }

    try {
      this.currentNode = node;
      await this.executeNode(executionId, node);
      
      // Find the next node
      const nextNode = this.findNextNode(nodeId);
      const nextNodeId = nextNode?.id;
      
      const message = `Node ${nodeId} (${node.label}) executed successfully`;
      console.log(`✅ ${message}`);
      
      return { 
        success: true, 
        message,
        nextNodeId 
      };
    } catch (error) {
      const message = `Failed to execute node ${nodeId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(message);
      return { success: false, message };
    }
  }

  // New method: Execute multiple nodes consecutively
  public async executeNodesConsecutively(executionId: string, nodeIds: string[]): Promise<Map<string, { success: boolean; message: string; nextNodeId?: string }>> {
    console.log(`🎯 Executing ${nodeIds.length} nodes consecutively:`, nodeIds);
    
    const results = new Map<string, { success: boolean; message: string; nextNodeId?: string }>();
    
    for (const nodeId of nodeIds) {
      console.log(`🔄 Executing node ${nodeId}...`);
      
      const result = await this.executeNodeById(executionId, nodeId);
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

  private async execute(executionId: string) {
    let nodeCount = 0;
    const maxNodes = 20; // Safety limit
    
    while (this.currentNode && nodeCount < maxNodes) {
      console.log(`📋 Executing node ${nodeCount + 1}: ${this.currentNode.label} (${this.currentNode.id})`);
      
      await this.executeNode(executionId, this.currentNode);
      
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

  private async executeNode(executionId: string, node: WorkflowNode) {
    console.log(`  🔍 Node type: ${node.type}`);
    console.log(`  💭 Intent: ${node.intent}`);
    
    // Create variable context for this node
    const variableContext = VariableResolver.createContext(
      this.userId,
      this.workflowId,
      executionId,
      node.id
    );
    
    // Resolve variables in the node before execution
    const resolvedNode = VariableResolver.resolveObjectVariables(node, variableContext) as WorkflowNode;
    
    // Handle new bulletproof node types
    switch (resolvedNode.type) {
      case 'decision':
        return await this.executeDecisionNode(executionId, resolvedNode);
      case 'assert':
        return await this.executeAssertNode(executionId, resolvedNode);
      case 'error_handler':
        return await this.executeErrorHandlerNode(executionId, resolvedNode);
      case 'data_transform':
        return await this.executeDataTransformNode(executionId, resolvedNode);
      case 'generator':
        return await this.executeGeneratorNode(executionId, resolvedNode);
      case 'explore':
        return await this.executeExploreNode(executionId, resolvedNode);
    }
    
    // Handle legacy node types
    if (resolvedNode.type === 'iterative_loop') {
        console.log(`  🔄 Loop node detected: ${resolvedNode.label}`);
        // For MVP, we'll just log that we're entering the loop
        // In a full implementation, this would set up loop state
        return;
    }
    
    if (resolvedNode.type === 'compound_task') {
        console.log(`  📦 Compound task detected: ${resolvedNode.label}`);
        console.log(`  👶 Children: ${resolvedNode.children?.join(', ')}`);
        
        // Check if this compound task should execute all children
        if (resolvedNode.canExecuteAsGroup && resolvedNode.children) {
            console.log(`  🎬 Executing all children sequentially for compound task`);
            
            for (const childId of resolvedNode.children) {
                const childNode = this.sop.execution.workflow.nodes.find(n => n.id === childId);
                if (childNode) {
                    console.log(`    ▶️ Executing child: ${childNode.label} (${childId})`);
                    await this.executeNode(executionId, childNode);
                    
                    // Add delay between child executions
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    console.warn(`    ⚠️ Child node ${childId} not found`);
                }
            }
            
            console.log(`  ✅ Compound task completed: ${resolvedNode.label}`);
            return;
        } else {
            console.log(`  ℹ️ Compound task defined but not executing children (canExecuteAsGroup: ${resolvedNode.canExecuteAsGroup})`);
            return;
        }
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
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'navigate',
                            data: { url: action.target?.url },
                            stepId: resolvedNode.id
                        });
                        console.log(`    ✅ Navigation completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Navigation failed:`, error);
                    }
                    break;
                    
                case 'click':
                    console.log(`    - Clicking element: ${action.target?.selector || 'using instruction'}`);
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'click',
                            data: { 
                                selector: action.target?.selector,
                                instruction: action.instruction 
                            },
                            stepId: resolvedNode.id
                        });
                        console.log(`    ✅ Click completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Click failed:`, error);
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
                            stepId: resolvedNode.id
                        };
                        
                        // Inject credentials if needed
                        browserAction = await this.injectCredentialsIntoAction(browserAction, resolvedNode);
                        
                        const result = await hybridBrowserManager.executeAction(executionId, browserAction);
                        console.log(`    ✅ Type completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Type failed:`, error);
                    }
                    break;

                case 'wait':
                    console.log(`    - Waiting for element: ${action.target?.selector}`);
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'wait',
                            data: { 
                                selector: action.target?.selector,
                                timeout: action.timeout || 5000
                            },
                            stepId: resolvedNode.id
                        });
                        console.log(`    ✅ Wait completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Wait failed:`, error);
                    }
                    break;

                case 'wait_for_navigation':
                    console.log(`    - Waiting for navigation to: ${action.target?.url_contains}`);
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'wait_for_navigation',
                            data: { 
                                url_contains: action.target?.url_contains,
                                timeout: action.timeout || 10000
                            },
                            stepId: resolvedNode.id
                        });
                        console.log(`    ✅ Navigation wait completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Navigation wait failed:`, error);
                    }
                    break;

                case 'extract':
                    console.log(`    - Extracting data: ${action.instruction}`);
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'extract',
                            data: { 
                                instruction: action.instruction,
                                schema: action.schema
                            },
                            stepId: resolvedNode.id
                        });
                        console.log(`    ✅ Extract completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Extract failed:`, error);
                    }
                    break;

                case 'act':
                    console.log(`    - AI-powered action: ${action.instruction}`);
                    try {
                        // Create the browser action
                        let browserAction = {
                            type: 'act' as const,
                            data: { 
                                instruction: action.instruction,
                                ...action.data  // Include any additional data from the workflow
                            },
                            stepId: resolvedNode.id
                        };
                        
                        // Inject credentials if needed (this handles {{gmail_email}} replacement)
                        browserAction = await this.injectCredentialsIntoAction(browserAction, resolvedNode);
                        
                        const result = await hybridBrowserManager.executeAction(executionId, browserAction);
                        console.log(`    ✅ Act completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Act failed:`, error);
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
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'observe',
                            data: { 
                                instruction: action.instruction,
                                maxActions: action.maxActions || 1
                            },
                            stepId: resolvedNode.id
                        });
                        console.log(`    ✅ Observe completed:`, result);
                        // Store observed actions for later use
                        this.state.set(`${resolvedNode.id}_observed_actions`, result);
                    } catch (error) {
                        console.error(`    ❌ Observe failed:`, error);
                    }
                    break;

                case 'clear_memory':
                    console.log(`    - Clearing Stagehand memory`);
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'clear_memory',
                            data: {},
                            stepId: resolvedNode.id
                        });
                        console.log(`    ✅ Memory cleared:`, result);
                    } catch (error) {
                        console.error(`    ❌ Memory clear failed:`, error);
                    }
                    break;

                case 'label_email':
                    console.log(`    - Labeling email: ${action.data?.label}`);
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'label_email',
                            data: { 
                                label: action.data?.label || 'AEF-Processed'
                            },
                            stepId: resolvedNode.id
                        });
                        console.log(`    ✅ Email labeled:`, result);
                    } catch (error) {
                        console.error(`    ❌ Email labeling failed:`, error);
                    }
                    break;

                case 'search_airtable':
                    console.log(`    - Searching Airtable: ${action.data?.searchValue}`);
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'search_airtable',
                            data: { 
                                searchFields: action.data?.searchFields || ['name'],
                                searchValue: action.data?.searchValue
                            },
                            stepId: resolvedNode.id
                        });
                        console.log(`    ✅ Airtable search completed:`, result);
                        // Store search results for decision nodes
                        this.state.set(`${resolvedNode.id}_search_results`, result);
                    } catch (error) {
                        console.error(`    ❌ Airtable search failed:`, error);
                    }
                    break;

                case 'paginate_extract':
                    console.log(`    - Paginating and extracting: ${action.instruction}`);
                    try {
                        const result = await this.executePaginateExtract(executionId, action, resolvedNode);
                        console.log(`    ✅ Paginate extract completed:`, result);
                        // Store extracted data for processing
                        this.state.set(`${resolvedNode.id}_extracted_data`, result);
                    } catch (error) {
                        console.error(`    ❌ Paginate extract failed:`, error);
                    }
                    break;

                default:
                    console.log(`    - Action type '${action.type}' is not yet implemented.`);
            }
        }
    }
  }

  // New node type handlers
  private async executeDecisionNode(executionId: string, node: WorkflowNode): Promise<void> {
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
        const result = await hybridBrowserManager.executeAction(executionId, {
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

  private async executeAssertNode(executionId: string, node: WorkflowNode): Promise<void> {
    console.log(`  ✅ Assert node: ${node.label}`);
    
    // Check assert conditions
    if (node.assertConditions && Array.isArray(node.assertConditions)) {
      for (const condition of node.assertConditions) {
        console.log(`    - Checking condition: ${condition.type} = ${condition.value}`);
        
        try {
          let conditionMet = false;
          
          switch (condition.type) {
            case 'selectorVisible':
              const visibilityResult = await hybridBrowserManager.executeAction(executionId, {
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
              const urlResult = await hybridBrowserManager.executeAction(executionId, {
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
              const textResult = await hybridBrowserManager.executeAction(executionId, {
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
        await this.executeAction(executionId, action, node);
      }
    }
  }

  private async executeErrorHandlerNode(executionId: string, node: WorkflowNode): Promise<void> {
    console.log(`  🚨 Error handler node: ${node.label}`);
    
    if (node.humanEscalate) {
      console.log(`  👤 Human escalation required for: ${node.label}`);
      // In a real implementation, this would send notifications
      // For now, we'll pause execution and log
      console.log(`  ⏸️ Execution paused for human intervention`);
      
      // Execute any actions (like waiting for human input)
      if (node.actions && node.actions.length > 0) {
        for (const action of node.actions) {
          await this.executeAction(executionId, action, node);
        }
      }
    } else if (node.fallbackAction) {
      console.log(`  🔄 Executing fallback action: ${node.fallbackAction}`);
      // Execute fallback logic
    }
  }

  private async executeDataTransformNode(executionId: string, node: WorkflowNode): Promise<void> {
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

  private async executeGeneratorNode(executionId: string, node: WorkflowNode): Promise<void> {
    console.log(`  📝 Generator node: ${node.label}`);
    
    // Execute actions (usually extract with generation instruction)
    if (node.actions && node.actions.length > 0) {
      for (const action of node.actions) {
        if (action.type === 'extract') {
          try {
            const result = await hybridBrowserManager.executeAction(executionId, {
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

  private async executeExploreNode(executionId: string, node: WorkflowNode): Promise<void> {
    console.log(`  🔍 Explore node: ${node.label}`);
    
    const maxActions = node.maxActions || 6;
    console.log(`  📊 Max exploration actions: ${maxActions}`);
    
    // Execute bounded exploration
    if (node.actions && node.actions.length > 0) {
      for (const action of node.actions) {
        if (action.type === 'observe') {
          try {
            const result = await hybridBrowserManager.executeAction(executionId, {
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

  // Helper method to execute individual actions
  private async executeAction(executionId: string, action: any, node: WorkflowNode): Promise<void> {
    console.log(`    - Action: ${action.type}`);
    
    switch (action.type) {
      case 'extract':
        try {
          const result = await hybridBrowserManager.executeAction(executionId, {
            type: 'extract',
            data: { 
              instruction: action.instruction,
              schema: action.schema
            },
            stepId: node.id
          });
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
          
          const result = await hybridBrowserManager.executeAction(executionId, browserAction);
          console.log(`    ✅ Act completed:`, result);
          return result;
        } catch (error) {
          console.error(`    ❌ Act failed:`, error);
          throw error;
        }
        
      default:
        console.log(`    - Action type '${action.type}' not handled in executeAction`);
    }
  }

  // Helper method for paginate_extract
  private async executePaginateExtract(executionId: string, action: any, node: WorkflowNode): Promise<any> {
    const allResults: any[] = [];
    let hasMorePages = true;
    let pageCount = 0;
    const maxPages = 10; // Safety limit
    
    while (hasMorePages && pageCount < maxPages) {
      console.log(`    📄 Processing page ${pageCount + 1}`);
      
      try {
        // Extract current page
        const pageResult = await hybridBrowserManager.executeAction(executionId, {
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
        const hasNext = await hybridBrowserManager.executeAction(executionId, {
          type: 'extract',
          data: { 
            instruction: "Check if 'Older' or 'Next' button is enabled and visible",
            schema: { hasNextPage: 'boolean' }
          },
          stepId: node.id
        });
        
        if (hasNext?.hasNextPage) {
          // Click next page
          await hybridBrowserManager.executeAction(executionId, {
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
}

// To use this engine, you would do something like:
// const mySop: SOPDocument = { ... }; // Your hardcoded SOP
// const engine = new ExecutionEngine(mySop, userId, workflowId);
// engine.start(); 