import { BasePrimitive } from './base-primitive.js';

/**
 * Iterate Primitive - Loops over arrays
 * 
 * Purpose: Execute a node for each item in a collection
 * Features: Variable scoping, index tracking, error handling
 * 
 * How Iterate Gets Its Data:
 * The 'over' parameter references arrays stored in state by previous nodes:
 * 1. browser_query extracts lists from pages → stores to state → iterate
 * 2. transform filters/maps data → outputs to state → iterate
 * 3. cognition categorizes items → outputs arrays to state → iterate
 * 
 * Example Flow:
 * browser_query.extract → state.emails → iterate over state.emails → process each
 */
export class IteratePrimitive extends BasePrimitive {
  constructor(dependencies) {
    super(dependencies);
    this.primitiveExecutor = dependencies.primitiveExecutor; // Reference to main executor
  }

  async execute({ over, variable, body, index, continueOnError = true, limit }) {
    console.log(`🔁 Iterating over ${over}`);
    const items = this.resolveVariable(over) || [];
    const results = [];
    const errors = [];
    
    // Index variable name (optional)
    const indexVar = index || `${variable}Index`;
    
    // Determine how many items to process
    const itemsToProcess = limit ? Math.min(items.length, limit) : items.length;
    
    // Store collection info in state
    this.stateManager.set(`${variable}Total`, items.length);
    
    for (let i = 0; i < itemsToProcess; i++) {
      console.log(`  → Processing item ${i + 1}/${itemsToProcess}`);
      
      // Set iteration variables
      this.stateManager.set(variable, items[i]);
      this.stateManager.set(indexVar, i);
      
      try {
        // Execute body - can be single node or array of nodes
        let result;
        if (Array.isArray(body)) {
          // Execute array of nodes sequentially
          const bodyResults = [];
          for (const node of body) {
            const nodeResult = await this.primitiveExecutor.execute(node);
            bodyResults.push(nodeResult);
            this.stateManager.set('lastResult', nodeResult);
          }
          result = bodyResults;
        } else {
          // Execute single node
          result = await this.primitiveExecutor.execute(body);
        }
        
        results.push({ index: i, success: true, result });
      } catch (error) {
        console.error(`Error in iteration ${i}:`, error);
        errors.push({ index: i, error: error.message });
        
        if (!continueOnError) {
          // Store error info before throwing
          this.stateManager.set(`${variable}Errors`, errors);
          throw new Error(`Iteration failed at index ${i}: ${error.message}`);
        }
      }
    }
    
    // Clean up iteration variables
    this.stateManager.delete(variable);
    this.stateManager.delete(indexVar);
    this.stateManager.delete(`${variable}Total`);
    
    // Store any errors that occurred
    if (errors.length > 0) {
      this.stateManager.set('lastIterationErrors', errors);
    }
    
    return { results, errors, processed: itemsToProcess, total: items.length };
  }
}