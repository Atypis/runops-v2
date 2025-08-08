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
    console.log('[DEBUG] extract called with instruction:', instruction);
    console.log('[DEBUG] extract called with schema:', JSON.stringify(schema, null, 2));
    
    // Convert simple JSON schema to Zod if provided
    let zodSchema = null;
    
    if (schema && typeof schema === 'object') {
      console.log('[DEBUG] Converting schema to Zod...');
      zodSchema = this.convertJsonSchemaToZod(schema);
      console.log('[DEBUG] Converted zodSchema:', zodSchema);
    } else {
      console.log('[DEBUG] No schema provided or schema is not an object');
    }
    
    // Use StageHand's AI extraction on the current page
    console.log('[DEBUG] Calling StageHand extract with zodSchema:', zodSchema);
    let result;
    try {
      result = await this.currentPage.extract({ 
        instruction, 
        schema: zodSchema 
      });
      console.log('[DEBUG] StageHand extract returned:', result);
    } catch (error) {
      console.error('[DEBUG] StageHand extract error:', error);
      console.error('[DEBUG] Error stack:', error.stack);
      throw error;
    }
    
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