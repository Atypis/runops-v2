import { BasePrimitive } from './base-primitive.js';
import { z } from 'zod';

/**
 * Browser Query Primitive - Handles data extraction from pages
 * 
 * Purpose: Extract data from pages without side effects
 * Methods: extract (structured data), observe (find interactive elements)
 */
export class BrowserQueryPrimitive extends BasePrimitive {
  constructor(dependencies) {
    super(dependencies);
    this.z = z; // Store Zod reference
  }

  async execute({ method, instruction, schema }) {
    switch (method) {
      case 'extract':
        return await this.extract(instruction, schema);
      
      case 'observe':
        return await this.observe(instruction);
      
      default:
        throw new Error(`Unknown query method: ${method}`);
    }
  }

  async extract(instruction, schema) {
    // Convert simple JSON schema to Zod if provided
    let zodSchema = null;
    
    if (schema && typeof schema === 'object') {
      zodSchema = this.convertJsonSchemaToZod(schema);
    }
    
    // Use StageHand's AI extraction on the current page
    const result = await this.currentPage.extract({ 
      instruction, 
      schema: zodSchema 
    });
    
    // Store the result in state - automatically store all extracted properties
    if (result && typeof result === 'object') {
      Object.entries(result).forEach(([key, value]) => {
        this.stateManager.set(key, value);
      });
    }
    // Also store the full result
    this.stateManager.set('lastExtract', result);
    return result;
  }

  async observe(instruction) {
    // Use StageHand's AI observation on the current page
    const observations = await this.currentPage.observe({ instruction });
    this.stateManager.set('lastObserve', observations);
    return observations;
  }
}