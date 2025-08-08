import { BasePrimitive } from './base-primitive.js';

/**
 * Handle Primitive - Error handling
 * 
 * Purpose: Try/catch/finally error boundaries
 * Features: Error recovery, cleanup operations, error state capture
 */
export class HandlePrimitive extends BasePrimitive {
  constructor(dependencies) {
    super(dependencies);
    this.primitiveExecutor = dependencies.primitiveExecutor; // Reference to main executor
  }

  async execute({ try: tryNode, catch: catchNode, finally: finallyNode }) {
    console.log(`🛡️ Executing with error handling`);
    let result;
    let error;
    
    try {
      result = await this.primitiveExecutor.execute(tryNode);
    } catch (e) {
      error = e;
      console.error('Caught error:', e.message);
      
      // Store error in state for catch block to use
      this.stateManager.set('lastError', {
        message: e.message,
        stack: e.stack,
        timestamp: new Date().toISOString()
      });
      
      if (catchNode) {
        try {
          result = await this.primitiveExecutor.execute(catchNode);
          // Clear error if catch succeeds
          error = null;
        } catch (catchError) {
          console.error('Error in catch block:', catchError);
          error = catchError;
        }
      }
    } finally {
      if (finallyNode) {
        try {
          await this.primitiveExecutor.execute(finallyNode);
        } catch (finallyError) {
          console.error('Error in finally block:', finallyError);
          // Don't override the original error
          if (!error) {
            error = finallyError;
          }
        }
      }
    }
    
    // Re-throw if there was an error and no successful recovery
    if (error) {
      throw error;
    }
    
    return result;
  }
}