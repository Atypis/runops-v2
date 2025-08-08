import { BasePrimitive } from './base-primitive.js';

/**
 * Context Primitive - Manages workflow execution context
 * 
 * Purpose: Explicit control over the workflow's execution context/state
 * Operations: set, get, clear, merge
 * 
 * Note: Context is automatically populated by other nodes:
 * - browser_query stores extracted data
 * - iterate creates iteration variables
 * - handle stores error information
 * This primitive provides explicit control when needed.
 */
export class ContextPrimitive extends BasePrimitive {
  execute({ operation, data, key, value }) {
    switch (operation) {
      case 'set':
        return this.setContext(data || { [key]: value });
      
      case 'get':
        return this.getContext(data || [key]);
      
      case 'clear':
        return this.clearContext(data || key);
      
      case 'merge':
        return this.mergeContext(key, value);
      
      default:
        throw new Error(`Unknown context operation: ${operation}`);
    }
  }

  setContext(data) {
    Object.entries(data).forEach(([key, value]) => {
      // Resolve value if it's a state reference
      const resolvedValue = this.resolveVariable(value);
      this.stateManager.set(key, resolvedValue);
    });
    return { updated: Object.keys(data) };
  }

  getContext(keys) {
    if (Array.isArray(keys)) {
      return keys.map(key => this.stateManager.get(key));
    } else {
      return this.stateManager.get(keys);
    }
  }

  clearContext(keys) {
    if (!keys) {
      // Clear all if no keys specified
      this.stateManager.clear();
      return { cleared: 'all' };
    } else if (Array.isArray(keys)) {
      // Clear multiple keys
      keys.forEach(key => this.stateManager.delete(key));
      return { cleared: keys };
    } else {
      // Clear single key
      this.stateManager.delete(keys);
      return { cleared: keys };
    }
  }

  mergeContext(key, value) {
    // Get existing value
    const existing = this.stateManager.get(key) || {};
    
    // Merge with new value
    const merged = { ...existing, ...value };
    
    // Store merged result
    this.stateManager.set(key, merged);
    
    return { merged: key, result: merged };
  }
}