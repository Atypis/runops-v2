/**
 * Main Primitives class that orchestrates all primitive types
 * This replaces the monolithic primitives.js file with a modular structure
 */

import { z } from 'zod';

// Import all primitive classes
import { CognitionPrimitive } from './cognition.js';
import { BrowserActionPrimitive } from './browser-action.js';
import { BrowserQueryPrimitive } from './browser-query.js';
import { TransformPrimitive } from './transform.js';
import { ContextPrimitive } from './context.js';
// Wait is handled as browser_action.wait
// Sequence removed - workflows execute sequentially by default
import { IteratePrimitive } from './iterate.js';
import { RoutePrimitive } from './route.js';
import { HandlePrimitive } from './handle.js';

export default class Primitives {
  constructor(dependencies = {}) {
    // Store dependencies
    this.dependencies = dependencies;
    
    // Add self-reference for control flow primitives
    dependencies.primitiveExecutor = this;
    
    // Initialize all primitive instances
    this.primitives = {
      cognition: new CognitionPrimitive(dependencies),
      browser_action: new BrowserActionPrimitive(dependencies),
      browser_query: new BrowserQueryPrimitive(dependencies),
      transform: new TransformPrimitive(dependencies),
      context: new ContextPrimitive(dependencies),
      // wait is handled as browser_action.wait
      // sequence removed - workflows are sequential by default
      iterate: new IteratePrimitive(dependencies),
      route: new RoutePrimitive(dependencies),
      handle: new HandlePrimitive(dependencies)
    };
    
    // Legacy support - expose dependencies at top level
    this.state = dependencies.state;
    this.stateManager = dependencies.state;
    this.stagehand = dependencies.stagehand;
    this.openai = dependencies.openai;
    this.pages = dependencies.pages || {};
    this.currentPage = dependencies.currentPage;
  }

  /**
   * Execute a single node based on its type
   */
  async execute(node, state = {}) {
    // Update state manager with any new state
    if (state && Object.keys(state).length > 0) {
      Object.entries(state).forEach(([key, value]) => {
        this.state.set(key, value);
      });
    }
    
    // Handle wait as browser_action for backwards compatibility
    if (node.type === 'wait') {
      return await this.primitives.browser_action.execute({
        ...node,
        type: 'browser_action',
        action: 'wait'
      });
    }
    
    // Handle memory as context for backwards compatibility
    if (node.type === 'memory') {
      return await this.primitives.context.execute(node);
    }
    
    // Get the appropriate primitive handler
    const primitive = this.primitives[node.type];
    if (!primitive) {
      throw new Error(`Unknown node type: ${node.type}`);
    }
    
    // Execute the primitive
    return await primitive.execute(node);
  }

  /**
   * Legacy method names for backwards compatibility
   */
  async executeBrowserAction(params) {
    return await this.primitives.browser_action.execute(params);
  }

  async executeBrowserQuery(params) {
    return await this.primitives.browser_query.execute(params);
  }

  async executeTransform(params) {
    return this.primitives.transform.execute(params);
  }

  async executeCognition(params) {
    return await this.primitives.cognition.execute(params);
  }

  async executeContext(params) {
    return this.primitives.context.execute(params);
  }

  // Legacy support for memory primitive
  async executeMemory(params) {
    return this.primitives.context.execute(params);
  }

  // Wait is handled as browser_action.wait

  // Sequence removed - workflows execute sequentially by default

  async executeIterate(params) {
    return await this.primitives.iterate.execute(params);
  }

  async executeRoute(params) {
    return await this.primitives.route.execute(params);
  }

  async executeHandle(params) {
    return await this.primitives.handle.execute(params);
  }

  // Legacy helper methods
  resolveVariable(value) {
    if (typeof value !== 'string') return value;
    
    // Handle template variables
    if (value.includes('{{') && value.includes('}}')) {
      return this.state.resolveTemplate(value);
    }
    
    // Handle state references
    if (value.startsWith('state.')) {
      const key = value.substring(6);
      return this.state.get(key);
    }
    
    return value;
  }

  setStateValue(path, value) {
    if (!path) return;
    
    // Remove state. prefix if present
    const cleanPath = path.startsWith('state.') ? path.substring(6) : path;
    this.stateManager.set(cleanPath, value);
  }
}