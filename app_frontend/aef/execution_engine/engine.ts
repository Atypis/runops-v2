import { SOPDocument, SOPNode, BrowserInstruction } from '../../lib/types/sop';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';

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

  constructor(sop: WorkflowDocument) {
    this.sop = sop;
    this.state = new Map<string, any>();
  }

  public async start(executionId: string) {
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
    
    // Handle different node types
    if (node.type === 'iterative_loop') {
        console.log(`  🔄 Loop node detected: ${node.label}`);
        // For MVP, we'll just log that we're entering the loop
        // In a full implementation, this would set up loop state
        return;
    }
    
    if (node.type === 'compound_task') {
        console.log(`  📦 Compound task detected: ${node.label}`);
        console.log(`  👶 Children: ${node.children?.join(', ')}`);
        
        // Check if this compound task should execute all children
        if (node.canExecuteAsGroup && node.children) {
            console.log(`  🎬 Executing all children sequentially for compound task`);
            
            for (const childId of node.children) {
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
            
            console.log(`  ✅ Compound task completed: ${node.label}`);
            return;
        } else {
            console.log(`  ℹ️ Compound task defined but not executing children (canExecuteAsGroup: ${node.canExecuteAsGroup})`);
            return;
        }
    }
    
    // Execute actions for atomic tasks
    if (node.actions && Array.isArray(node.actions)) {
        console.log(`  🎬 Executing ${node.actions.length} actions`);
        
        for (const action of node.actions) {
            console.log(`    - Action: ${action.type}`);
            
            switch (action.type) {
                case 'navigate':
                case 'navigate_or_switch_tab':
                    console.log(`    - Navigating to: ${action.target?.url}`);
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'navigate',
                            data: { url: action.target?.url },
                            stepId: node.id
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
                            stepId: node.id
                        });
                        console.log(`    ✅ Click completed:`, result);
                    } catch (error) {
                        console.error(`    ❌ Click failed:`, error);
                    }
                    break;

                case 'type':
                    console.log(`    - Typing text into: ${action.target?.selector}`);
                    try {
                        const result = await hybridBrowserManager.executeAction(executionId, {
                            type: 'type',
                            data: { 
                                selector: action.target?.selector,
                                text: action.data?.text 
                            },
                            stepId: node.id
                        });
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
                        const result = await hybridBrowserManager.executeAction(executionId, {
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
                    } catch (error) {
                        console.error(`    ❌ Extract failed:`, error);
                    }
                    break;
                    
                case 'visual_scan':
                    console.log(`    - Simulating visual scan: ${action.instruction}`);
                    // In a real implementation, this would involve more complex AI vision processing.
                    // For now, we just log and continue.
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate work
                    break;

                default:
                    console.log(`    - Action type '${action.type}' is not yet implemented.`);
            }
        }
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
}

// To use this engine, you would do something like:
// const mySop: SOPDocument = { ... }; // Your hardcoded SOP
// const engine = new ExecutionEngine(mySop);
// engine.start(); 