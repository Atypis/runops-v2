import StateManager from './StateManager.js';
import Primitives from './Primitives.js';

/**
 * UnifiedExecutor - Main workflow execution engine
 * Supports granular execution of workflows, phases, and individual nodes
 */
export default class UnifiedExecutor {
  constructor(options = {}) {
    this.stagehand = options.stagehand;
    this.openai = options.openai;
    this.state = new StateManager({ trackMutations: true });
    this.options = options;
    this.executionHistory = [];
    this.debugMode = false;
    this.breakpoints = new Set();
    this.pages = options.pages || {};
    this.currentPage = options.currentPage;
    
    // Initialize primitives handler
    this.primitives = new Primitives({
      stagehand: this.stagehand,
      openai: this.openai,
      state: this.state,
      pages: this.pages,
      currentPage: this.currentPage
    });
  }

  /**
   * Main execution method with flexible options
   */
  async run(workflow, runOptions = {}) {
    const {
      only,      // Array of phases/nodes to run: ['phase:setup', 'node:extract-list']
      startAt,   // Start at specific phase/node: 'phase:extract-emails'
      stopAt,    // Stop after specific phase/node: 'phase:process-email'
      debug,     // Step-by-step mode with state inspection
      dryRun,    // Validate without executing
      state      // Initial state
    } = runOptions;

    // Initialize state if provided
    if (state) {
      Object.entries(state).forEach(([key, value]) => {
        this.state.set(key, value);
      });
    }

    this.debugMode = debug;
    
    // Validate workflow structure
    if (dryRun) {
      return this.validateWorkflow(workflow);
    }

    // Execute based on options
    if (only) {
      return await this.runOnly(workflow, only);
    } else if (startAt || stopAt) {
      return await this.runRange(workflow, startAt, stopAt);
    } else {
      return await this.runFlow(workflow, workflow.flow);
    }
  }

  /**
   * Run only specified phases/nodes
   */
  async runOnly(workflow, references) {
    const results = [];
    
    for (const ref of references) {
      if (ref.startsWith('phase:')) {
        const phaseName = ref.substring(6);
        const result = await this.runPhase(workflow, phaseName);
        results.push({ phase: phaseName, result });
      } else if (ref.startsWith('node:')) {
        const nodeName = ref.substring(5);
        const result = await this.runNode(workflow, nodeName);
        results.push({ node: nodeName, result });
      } else {
        throw new Error(`Invalid reference format: ${ref}`);
      }
    }
    
    return results;
  }

  /**
   * Run workflow within a range
   */
  async runRange(workflow, startAt, stopAt) {
    const flatNodes = this.flattenWorkflow(workflow);
    const startIndex = startAt ? flatNodes.findIndex(n => n.ref === startAt) : 0;
    const stopIndex = stopAt ? flatNodes.findIndex(n => n.ref === stopAt) + 1 : flatNodes.length;
    
    if (startIndex === -1) throw new Error(`Start reference not found: ${startAt}`);
    if (stopAt && stopIndex === 0) throw new Error(`Stop reference not found: ${stopAt}`);
    
    const results = [];
    for (let i = startIndex; i < stopIndex; i++) {
      const { ref, type } = flatNodes[i];
      const result = await this.runReference(workflow, ref);
      results.push({ ref, result });
      
      if (this.debugMode) {
        await this.debugBreak(ref);
      }
    }
    
    return results;
  }

  /**
   * Run a complete flow
   */
  async runFlow(workflow, flow) {
    const results = [];
    
    if (flow.type === 'sequence') {
      for (const item of flow.items || flow.nodes || []) {
        const result = await this.runFlowItem(workflow, item);
        results.push(result);
      }
    } else {
      // Single node flow
      const result = await this.executePrimitive(flow);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Run a single flow item (could be a ref or a primitive)
   */
  async runFlowItem(workflow, item) {
    if (item.ref) {
      return await this.runReference(workflow, item.ref);
    } else {
      // Direct primitive execution
      return await this.executePrimitive(item);
    }
  }

  /**
   * Run a reference (phase:name or node:name)
   */
  async runReference(workflow, ref) {
    if (ref.startsWith('phase:')) {
      const phaseName = ref.substring(6);
      return await this.runPhase(workflow, phaseName);
    } else if (ref.startsWith('node:')) {
      const nodeName = ref.substring(5);
      return await this.runNode(workflow, nodeName);
    } else {
      throw new Error(`Invalid reference format: ${ref}`);
    }
  }

  /**
   * Run a phase (group of nodes)
   */
  async runPhase(workflow, phaseName) {
    const phase = workflow.phases[phaseName];
    if (!phase) {
      throw new Error(`Phase not found: ${phaseName}`);
    }
    
    console.log(`\n📋 Running phase: ${phase.name || phaseName}`);
    if (phase.description) {
      console.log(`   ${phase.description}`);
    }
    
    const results = [];
    for (const nodeRef of phase.nodes) {
      const result = await this.runNode(workflow, nodeRef);
      results.push({ node: nodeRef, result });
      
      if (this.debugMode) {
        await this.debugBreak(`node:${nodeRef}`);
      }
    }
    
    return results;
  }

  /**
   * Run a single node
   */
  async runNode(workflow, nodeName) {
    const node = workflow.nodes[nodeName];
    if (!node) {
      throw new Error(`Node not found: ${nodeName}`);
    }
    
    console.log(`🔧 Running node: ${nodeName}`);
    if (node.description) {
      console.log(`   ${node.description}`);
    }
    
    // Record execution
    this.executionHistory.push({
      type: 'node',
      name: nodeName,
      timestamp: new Date(),
      stateBefore: this.state.createSnapshot()
    });
    
    // Execute the node
    const result = await this.executePrimitive(node);
    
    // Record result
    this.executionHistory[this.executionHistory.length - 1].result = result;
    
    return result;
  }

  /**
   * Execute a primitive using the Primitives handler
   */
  async executePrimitive(node) {
    // Execute the primitive
    const result = await this.primitives.execute(node);
    
    // Sync pages back from primitives (in case new tabs were opened)
    this.pages = this.primitives.pages;
    this.currentPage = this.primitives.currentPage;
    
    return result;
  }

  /**
   * Flatten workflow into executable sequence
   */
  flattenWorkflow(workflow) {
    const nodes = [];
    
    const processFlow = (flow, prefix = '') => {
      if (flow.type === 'sequence') {
        for (const item of flow.items || flow.nodes || []) {
          if (item.ref) {
            nodes.push({ ref: item.ref, type: item.ref.split(':')[0] });
          } else {
            processFlow(item, prefix);
          }
        }
      }
    };
    
    processFlow(workflow.flow);
    return nodes;
  }

  /**
   * Validate workflow structure
   */
  validateWorkflow(workflow) {
    const errors = [];
    const warnings = [];
    
    // Check required fields
    if (!workflow.id) errors.push('Workflow missing required field: id');
    if (!workflow.flow) errors.push('Workflow missing required field: flow');
    
    // Validate all phase references
    if (workflow.flow) {
      const validateRefs = (item) => {
        if (item.ref) {
          if (item.ref.startsWith('phase:')) {
            const phaseName = item.ref.substring(6);
            if (!workflow.phases?.[phaseName]) {
              errors.push(`Phase reference not found: ${phaseName}`);
            }
          } else if (item.ref.startsWith('node:')) {
            const nodeName = item.ref.substring(5);
            if (!workflow.nodes?.[nodeName]) {
              errors.push(`Node reference not found: ${nodeName}`);
            }
          }
        }
        
        if (item.items) {
          item.items.forEach(validateRefs);
        }
        if (item.nodes) {
          item.nodes.forEach(validateRefs);
        }
      };
      
      if (workflow.flow.items) {
        workflow.flow.items.forEach(validateRefs);
      }
    }
    
    // Validate node types
    if (workflow.nodes) {
      Object.entries(workflow.nodes).forEach(([name, node]) => {
        const validTypes = [
          'browser_action', 'browser_query', 'transform', 'cognition',
          'memory', 'wait', 'sequence', 'iterate', 'route', 'handle'
        ];
        if (!validTypes.includes(node.type)) {
          errors.push(`Invalid node type in ${name}: ${node.type}`);
        }
      });
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Debug break - pause execution for inspection
   */
  async debugBreak(location) {
    if (!this.debugMode) return;
    
    console.log(`\n⏸️  Debug break at: ${location}`);
    console.log('Current state:', this.state.getAll());
    console.log('Press Enter to continue...');
    
    // In a real implementation, this would pause for user input
    // For now, just log the state
  }

  /**
   * Get execution history
   */
  getHistory() {
    return this.executionHistory;
  }

  /**
   * Get current state
   */
  getState() {
    return this.state.getAll();
  }

  /**
   * Set a breakpoint
   */
  setBreakpoint(ref) {
    this.breakpoints.add(ref);
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints() {
    this.breakpoints.clear();
  }
}