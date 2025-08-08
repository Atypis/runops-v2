/**
 * StateManager - A comprehensive state management system for workflows
 * 
 * Features:
 * - Nested path access using dot notation
 * - State mutation tracking for debugging
 * - Template variable resolution
 * - Thread-safe operations
 * - Comprehensive error handling
 * 
 * @class StateManager
 */
class StateManager {
  constructor(initialState = {}) {
    this._state = this._deepClone(initialState);
    this._mutations = [];
    this._maxMutationHistory = 1000; // Prevent memory leaks
  }

  /**
   * Deep clone utility to prevent reference mutations
   * @private
   */
  _deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => this._deepClone(item));
    if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);
    
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = this._deepClone(obj[key]);
      }
    }
    return clonedObj;
  }

  /**
   * Parse a dot-notation path into segments
   * Handles array indices like "items[0].name"
   * @private
   */
  _parsePath(path) {
    if (typeof path !== 'string') {
      throw new TypeError('Path must be a string');
    }
    
    // Handle empty path
    if (!path) return [];
    
    // Convert array notation to dot notation: items[0] -> items.0
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');
    
    // Split by dots and filter out empty segments
    return normalizedPath.split('.').filter(segment => segment !== '');
  }

  /**
   * Navigate to a nested value using path segments
   * @private
   */
  _navigateToValue(obj, segments) {
    let current = obj;
    
    for (const segment of segments) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Handle array index
      if (!isNaN(segment) && Array.isArray(current)) {
        current = current[parseInt(segment, 10)];
      } else {
        current = current[segment];
      }
    }
    
    return current;
  }

  /**
   * Set a value at a nested path, creating intermediate objects as needed
   * @private
   */
  _setNestedValue(obj, segments, value) {
    if (segments.length === 0) {
      return value;
    }
    
    let current = obj;
    
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      const nextSegment = segments[i + 1];
      
      // If current segment doesn't exist, create it
      if (!(segment in current)) {
        // Determine if next segment is array index
        current[segment] = !isNaN(nextSegment) ? [] : {};
      }
      
      current = current[segment];
    }
    
    const lastSegment = segments[segments.length - 1];
    current[lastSegment] = value;
    
    return obj;
  }

  /**
   * Track a mutation for debugging purposes
   * @private
   */
  _trackMutation(operation, path, oldValue, newValue) {
    const mutation = {
      timestamp: new Date().toISOString(),
      operation,
      path,
      oldValue: this._deepClone(oldValue),
      newValue: this._deepClone(newValue)
    };
    
    this._mutations.push(mutation);
    
    // Prevent unbounded growth
    if (this._mutations.length > this._maxMutationHistory) {
      this._mutations.shift();
    }
  }

  /**
   * Get value at a specific path
   * @param {string} path - Dot notation path (e.g., "user.profile.name" or "items[0].id")
   * @returns {*} The value at the path, or undefined if not found
   */
  get(path) {
    try {
      if (!path) {
        return this._deepClone(this._state);
      }
      
      const segments = this._parsePath(path);
      const value = this._navigateToValue(this._state, segments);
      
      // Return deep clone to prevent external mutations
      return this._deepClone(value);
    } catch (error) {
      console.error(`Error getting value at path "${path}":`, error);
      return undefined;
    }
  }

  /**
   * Set value at a specific path
   * @param {string} path - Dot notation path
   * @param {*} value - Value to set
   * @returns {boolean} True if successful
   */
  set(path, value) {
    try {
      if (!path) {
        throw new Error('Path cannot be empty for set operation');
      }
      
      const segments = this._parsePath(path);
      const oldValue = this.get(path);
      
      // Clone state to ensure immutability
      const newState = this._deepClone(this._state);
      this._setNestedValue(newState, segments, this._deepClone(value));
      
      // Track mutation before updating state
      this._trackMutation('set', path, oldValue, value);
      
      // Update state
      this._state = newState;
      
      return true;
    } catch (error) {
      console.error(`Error setting value at path "${path}":`, error);
      return false;
    }
  }

  /**
   * Get the entire state object
   * @returns {Object} Deep clone of the current state
   */
  getAll() {
    return this._deepClone(this._state);
  }

  /**
   * Clear all state
   * @returns {boolean} True if successful
   */
  clear() {
    try {
      const oldState = this._deepClone(this._state);
      this._state = {};
      this._trackMutation('clear', '', oldState, {});
      return true;
    } catch (error) {
      console.error('Error clearing state:', error);
      return false;
    }
  }

  /**
   * Resolve template variables in a string
   * Supports {{variable}} and {{nested.path}} syntax
   * @param {string} template - Template string with variables
   * @returns {string} Resolved string
   */
  resolveTemplate(template) {
    if (typeof template !== 'string') {
      return template;
    }
    
    // Regular expression to match {{variable}} patterns
    const variablePattern = /\{\{([^}]+)\}\}/g;
    
    return template.replace(variablePattern, (match, variablePath) => {
      try {
        // Trim whitespace from variable path
        const path = variablePath.trim();
        
        // Special handling for common workflow variables
        if (path.startsWith('state.')) {
          // Remove 'state.' prefix as it's implicit
          const statePath = path.substring(6);
          const value = this.get(statePath);
          return value !== undefined ? String(value) : match;
        }
        
        // Direct path lookup
        const value = this.get(path);
        
        // Return stringified value or original match if not found
        return value !== undefined ? String(value) : match;
      } catch (error) {
        console.error(`Error resolving template variable "${variablePath}":`, error);
        return match;
      }
    });
  }

  /**
   * Resolve all template variables in an object recursively
   * @param {*} obj - Object containing template strings
   * @returns {*} Object with resolved templates
   */
  resolveTemplates(obj) {
    if (typeof obj === 'string') {
      return this.resolveTemplate(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.resolveTemplates(item));
    }
    
    if (obj !== null && typeof obj === 'object') {
      const resolved = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          resolved[key] = this.resolveTemplates(obj[key]);
        }
      }
      return resolved;
    }
    
    return obj;
  }

  /**
   * Check if a path exists in the state
   * @param {string} path - Dot notation path
   * @returns {boolean} True if path exists
   */
  has(path) {
    try {
      if (!path) return true; // Root always exists
      
      const segments = this._parsePath(path);
      let current = this._state;
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // Check if property exists (even if value is undefined)
        if (current !== null && typeof current === 'object' && segment in current) {
          current = current[segment];
        } else {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Delete a value at a specific path
   * @param {string} path - Dot notation path
   * @returns {boolean} True if successful
   */
  delete(path) {
    try {
      if (!path) {
        throw new Error('Path cannot be empty for delete operation');
      }
      
      const segments = this._parsePath(path);
      if (segments.length === 0) return false;
      
      const oldValue = this.get(path);
      const newState = this._deepClone(this._state);
      
      // Navigate to parent
      let current = newState;
      for (let i = 0; i < segments.length - 1; i++) {
        current = current[segments[i]];
        if (!current) return false;
      }
      
      // Delete the property
      const lastSegment = segments[segments.length - 1];
      if (Array.isArray(current) && !isNaN(lastSegment)) {
        current.splice(parseInt(lastSegment, 10), 1);
      } else {
        delete current[lastSegment];
      }
      
      this._trackMutation('delete', path, oldValue, undefined);
      this._state = newState;
      
      return true;
    } catch (error) {
      console.error(`Error deleting value at path "${path}":`, error);
      return false;
    }
  }

  /**
   * Merge an object into the state at a specific path
   * @param {string} path - Dot notation path (empty string for root)
   * @param {Object} obj - Object to merge
   * @returns {boolean} True if successful
   */
  merge(path, obj) {
    try {
      if (typeof obj !== 'object' || obj === null) {
        throw new TypeError('Merge value must be an object');
      }
      
      const currentValue = path ? this.get(path) : this.getAll();
      const mergedValue = { ...currentValue, ...obj };
      
      if (path) {
        return this.set(path, mergedValue);
      } else {
        this._trackMutation('merge', '', this._state, mergedValue);
        this._state = this._deepClone(mergedValue);
        return true;
      }
    } catch (error) {
      console.error(`Error merging object at path "${path}":`, error);
      return false;
    }
  }

  /**
   * Get mutation history for debugging
   * @param {number} limit - Maximum number of mutations to return
   * @returns {Array} Array of mutation records
   */
  getMutationHistory(limit = 50) {
    const start = Math.max(0, this._mutations.length - limit);
    return this._mutations.slice(start);
  }

  /**
   * Create a snapshot of the current state
   * @returns {Object} Snapshot object
   */
  createSnapshot() {
    return {
      timestamp: new Date().toISOString(),
      state: this._deepClone(this._state),
      mutationCount: this._mutations.length
    };
  }

  /**
   * Restore state from a snapshot
   * @param {Object} snapshot - Snapshot object
   * @returns {boolean} True if successful
   */
  restoreSnapshot(snapshot) {
    try {
      if (!snapshot || !snapshot.state) {
        throw new Error('Invalid snapshot');
      }
      
      const oldState = this._deepClone(this._state);
      this._state = this._deepClone(snapshot.state);
      this._trackMutation('restore', '', oldState, this._state);
      
      return true;
    } catch (error) {
      console.error('Error restoring snapshot:', error);
      return false;
    }
  }
}

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StateManager;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return StateManager; });
} else if (typeof window !== 'undefined') {
  window.StateManager = StateManager;
}