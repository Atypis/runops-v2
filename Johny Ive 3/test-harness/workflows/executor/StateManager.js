/**
 * StateManager - Manages workflow state with nested value support
 */
class StateManager {
  constructor(initialState = {}) {
    this.state = { ...initialState };
  }

  /**
   * Get a value from state, supporting nested paths
   * @param {string} key - The key or path (e.g., 'user' or 'user.email')
   * @returns {any} The value at the specified path
   */
  get(key) {
    if (!key) return this.state;
    
    // Handle nested paths
    if (key.includes('.')) {
      return this.getNestedValue(this.state, key);
    }
    
    return this.state[key];
  }

  /**
   * Set a value in state, supporting nested paths
   * @param {string} key - The key or path
   * @param {any} value - The value to set
   */
  set(key, value) {
    if (key.includes('.')) {
      this.setNestedValue(this.state, key, value);
    } else {
      this.state[key] = value;
    }
  }

  /**
   * Update multiple values at once
   * @param {object} updates - Object with key-value pairs to update
   */
  update(updates) {
    Object.entries(updates).forEach(([key, value]) => {
      this.set(key, value);
    });
  }

  /**
   * Clear all state
   */
  clear() {
    this.state = {};
  }

  /**
   * Get all state
   * @returns {object} The entire state object
   */
  getAll() {
    return { ...this.state };
  }

  /**
   * Create a snapshot of the current state
   * @returns {object} A deep copy of the state
   */
  createSnapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Resolve template strings with state values
   * @param {string} template - Template string with {{variable}} placeholders
   * @returns {string} Resolved template
   */
  resolveTemplate(template) {
    if (typeof template !== 'string') return template;
    
    return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const trimmedPath = path.trim();
      const cleanPath = trimmedPath.startsWith('state.') ? 
        trimmedPath.replace('state.', '') : trimmedPath;
      const result = this.get(cleanPath);
      return result !== undefined ? result : '';
    });
  }

  /**
   * Resolve a variable that might contain template expressions
   * @param {any} value - The value to resolve
   * @returns {any} The resolved value
   */
  resolveVariable(value) {
    if (typeof value !== 'string') return value;
    
    // Handle template variables like {{currentEmail.subject}} or {{state.currentEmail.subject}}
    if (value.includes('{{') && value.includes('}}')) {
      return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        const trimmedPath = path.trim();
        // If path starts with state., remove it
        const cleanPath = trimmedPath.startsWith('state.') ? 
          trimmedPath.replace('state.', '') : trimmedPath;
        const result = this.get(cleanPath);
        console.log(`   Resolved {{${trimmedPath}}} to:`, result);
        return result !== undefined ? result : '';
      });
    }
    
    // Handle state references
    if (value.startsWith('state.')) {
      const path = value.replace('state.', '');
      return this.get(path);
    }
    
    return value;
  }

  /**
   * Helper to get nested value from object
   * @private
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Helper to set nested value in object
   * @private
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    
    // Navigate to the nested object, creating objects as needed
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    
    target[lastKey] = value;
  }
}

export default StateManager;
