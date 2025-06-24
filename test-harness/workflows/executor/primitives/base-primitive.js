import { z } from 'zod';

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
    this.z = z; // Store Zod reference for schema conversion
  }

  /**
   * Resolve a variable reference to its actual value
   * Handles both direct values and state path references
   * Supports formats:
   * - "state.emails" -> direct state reference
   * - "{{variable}}" -> template syntax
   * - "{{nested.path}}" -> nested template syntax
   */
  resolveVariable(value) {
    if (!value) return value;
    
    // Handle template syntax {{variable}} or {{nested.path}}
    if (typeof value === 'string' && value.includes('{{') && value.includes('}}')) {
      // Replace all {{variable}} patterns
      return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
        // Remove any spaces and resolve the path
        const cleanPath = path.trim();
        const resolved = this.stateManager.get(cleanPath);
        return resolved !== undefined ? resolved : match;
      });
    }
    
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
   * Supports two formats:
   * 1. Simple format: {"fieldName": "type"} 
   * 2. JSON Schema format: {"type": "object", "properties": {"fieldName": {"type": "string"}}}
   */
  convertJsonSchemaToZod(jsonSchema) {
    console.log('[DEBUG] convertJsonSchemaToZod called with:', JSON.stringify(jsonSchema, null, 2));
    const z = this.z;
    
    // Check if it's the simple format ({"field": "type"})
    if (jsonSchema && typeof jsonSchema === 'object' && !jsonSchema.type) {
      console.log('[DEBUG] Detected simple schema format');
      const shape = {};
      for (const [key, type] of Object.entries(jsonSchema)) {
        if (type === 'string') {
          shape[key] = z.string();
        } else if (type === 'number') {
          shape[key] = z.number();
        } else if (type === 'boolean') {
          shape[key] = z.boolean();
        } else if (type === 'array') {
          shape[key] = z.array(z.any());
        } else {
          // Default to any for unknown types
          shape[key] = z.any();
        }
      }
      console.log('[DEBUG] Created Zod shape for simple format:', shape);
      const zodSchema = z.object(shape);
      console.log('[DEBUG] Returning Zod schema:', zodSchema);
      return zodSchema;
    }
    
    // Handle standard JSON Schema format
    if (jsonSchema.type === 'object' && jsonSchema.properties) {
      console.log('[DEBUG] Detected standard JSON Schema format');
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
      console.log('[DEBUG] Created Zod shape for standard format:', shape);
      const zodSchema = z.object(shape);
      console.log('[DEBUG] Returning standard format Zod schema:', zodSchema);
      return zodSchema;
    }
    
    console.log('[DEBUG] Returning z.any() as fallback');
    return z.any();
  }
}