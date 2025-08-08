import { BasePrimitive } from './base-primitive.js';

/**
 * Transform Primitive - Handles data transformation
 * 
 * Purpose: Pure JavaScript data manipulation with no side effects
 * Features: Deterministic transformations, multiple inputs support
 * 
 * SECURITY NOTE: Currently uses eval() for function execution.
 * This is acceptable for development/dog-fooding but MUST be replaced
 * with proper sandboxing (VM2, isolated-vm, or safe-eval) before production use.
 * 
 * TODO: Replace eval() with sandboxed execution for production
 */
export class TransformPrimitive extends BasePrimitive {
  execute({ input, function: fn, output }) {
    // Handle both single input and array of inputs
    let inputData;
    if (Array.isArray(input)) {
      inputData = input.map(i => this.resolveVariable(i));
    } else {
      inputData = this.resolveVariable(input);
    }
    
    // Safe evaluation for demo - use proper sandboxing in production!
    let result;
    try {
      const transformFn = eval(`(${fn})`);
      result = Array.isArray(inputData) ? transformFn(...inputData) : transformFn(inputData);
    } catch (error) {
      console.error('Transform execution error:', error);
      console.error('Input data:', inputData);
      console.error('Function:', fn);
      throw new Error(`Transform failed: ${error.message}`);
    }
    
    if (output) {
      this.setStateValue(output, result);
    }
    
    return result;
  }
}