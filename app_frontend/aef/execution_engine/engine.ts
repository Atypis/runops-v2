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
    
    // Execute actions for this node
    if (node.actions && Array.isArray(node.actions)) {
        console.log(`  🎬 Executing ${node.actions.length} actions`);
        
        for (const action of node.actions) {
            console.log(`    - Action: ${action.type}`);
            
            switch (action.type) {
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
                    console.log(`    - Clicking element: ${action.target?.selector}`);
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
                    
                // We will add more action handlers here, like visual_scan, extract_data, etc.
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