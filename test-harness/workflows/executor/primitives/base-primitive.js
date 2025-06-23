/**
 * Base class for all primitives
 * Provides common functionality like state management and variable resolution
 */
export class BasePrimitive {
  constructor(dependencies = {}) {
    this.state = dependencies.state;
    this.stateManager = dependencies.state; // For backward compatibility
    this.stagehand = dependencies.stagehand;
    this.openai = dependencies.openai;
    this.pages = dependencies.pages || {};
    this.currentPage = dependencies.currentPage;
  }

  /**
   * Resolve a variable reference to its actual value
   * Handles both direct values and state path references (e.g., "state.emails")
   */
  resolveVariable(value) {
    if (!value) return value;
    
    // If it's a string that looks like a state reference
    if (typeof value === 'string' && value.startsWith('state.')) {
      const path = value.substring(6); // Remove 'state.' prefix
      return this.stateManager.get(path);
    }
    
    return value;
  }

  /**
   * Set a value in state using a path reference
   */
  setStateValue(path, value) {
    if (!path) return;
    
    // Remove state. prefix if present
    const cleanPath = path.startsWith('state.') ? path.substring(6) : path;
    this.stateManager.set(cleanPath, value);
  }

  /**
   * Convert JSON schema to Zod schema
   * Used by browser_query and potentially other primitives
   */
  convertJsonSchemaToZod(jsonSchema) {
    const z = this.z;
    
    // Simple conversion - extend as needed
    if (jsonSchema.type === 'object' && jsonSchema.properties) {
      const shape = {};
      for (const [key, prop] of Object.entries(jsonSchema.properties)) {
        if (prop.type === 'string') {
          shape[key] = z.string();
        } else if (prop.type === 'number') {
          shape[key] = z.number();
        } else if (prop.type === 'boolean') {
          shape[key] = z.boolean();
        } else if (prop.type === 'array') {
          shape[key] = z.array(z.any());
        }
      }
      return z.object(shape);
    }
    
    return z.any();
  }
}