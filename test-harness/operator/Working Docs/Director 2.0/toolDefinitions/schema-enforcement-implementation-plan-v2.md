# Schema Enforcement Implementation Plan V2
## Based on Deep Codebase Analysis

### Executive Summary

After deep analysis of the codebase, I've identified the exact changes needed to implement automatic schema validation and type coercion for AI node outputs. The core issue is that AI outputs are stored without validation, causing silent failures in downstream nodes (especially iterate) that expect specific types.

## Current State Analysis

### Key Findings

1. **No Runtime Validation**: AI outputs from browser_ai_extract and cognition are stored directly without validation
2. **Silent Failures**: The iterate node returns empty results for non-arrays instead of throwing errors
3. **Stagehand Validation Exists**: Stagehand has internal validation but we don't leverage it in nodeExecutor
4. **Basic Zod Conversion**: Current convertJsonSchemaToZod is functional but doesn't use Zod's coercion features
5. **Variable Storage**: workflow_memory stores JSONB values without type checking

### Critical Code Paths

```
AI Node Execution:
1. nodeExecutor.executeBrowserAIExtract() → 
2. stagehandPage.extract() → 
3. Store result in workflow_memory (NO VALIDATION)
4. Downstream node accesses variable →
5. Type mismatch causes silent failure or cryptic error
```

## Implementation Plan

### Phase 1: Core Validation Infrastructure (Priority: HIGH)

#### 1.1 Create Validation Module
**File**: `/test-harness/operator/backend/services/schemaValidator.js`

```javascript
import { z } from 'zod';

export class SchemaValidator {
  /**
   * Validates and coerces AI output against expected schema
   * @returns {Object} { success: boolean, data?: any, error?: string, coerced: boolean }
   */
  static validateAndCoerce(rawOutput, jsonSchema, context = {}) {
    try {
      // Step 1: Convert JSON schema to Zod with coercion
      const zodSchema = this.convertJsonSchemaToZodWithCoercion(jsonSchema);
      
      // Step 2: Attempt direct validation
      const directResult = zodSchema.safeParse(rawOutput);
      if (directResult.success) {
        return { success: true, data: directResult.data, coerced: false };
      }
      
      // Step 3: Apply custom coercion rules
      const coercedData = this.applyCustomCoercion(rawOutput, jsonSchema);
      const coercedResult = zodSchema.safeParse(coercedData);
      
      if (coercedResult.success) {
        console.log(`[SCHEMA] Coercion applied for ${context.nodeAlias || context.nodeType}:`, {
          from: this.describeType(rawOutput),
          to: jsonSchema.type,
          context
        });
        return { success: true, data: coercedResult.data, coerced: true };
      }
      
      // Step 4: Return detailed error
      return {
        success: false,
        error: this.formatValidationError(directResult.error, rawOutput, jsonSchema, context),
        coerced: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Schema validation error: ${error.message}`,
        coerced: false
      };
    }
  }

  /**
   * Enhanced JSON to Zod conversion with built-in coercion
   */
  static convertJsonSchemaToZodWithCoercion(jsonSchema) {
    const convertType = (schema) => {
      if (!schema || typeof schema !== 'object') {
        return z.any();
      }
      
      switch (schema.type) {
        case 'string':
          // Use coerce for automatic type conversion
          return z.coerce.string();
          
        case 'number':
          return z.coerce.number();
          
        case 'boolean':
          return z.coerce.boolean();
          
        case 'array':
          if (schema.items) {
            return z.array(convertType(schema.items));
          }
          return z.array(z.any());
          
        case 'object':
          if (schema.properties) {
            const shape = {};
            for (const [key, value] of Object.entries(schema.properties)) {
              shape[key] = convertType(value);
            }
            // Make all properties optional during validation
            return z.object(shape).passthrough();
          }
          return z.object({}).passthrough();
          
        case 'null':
          return z.null();
          
        default:
          return z.any();
      }
    };
    
    // Handle both simple and full JSON schema formats
    if (typeof jsonSchema === 'object' && !jsonSchema.type) {
      // Simple format: {"field": "type"}
      const shape = {};
      for (const [key, value] of Object.entries(jsonSchema)) {
        if (typeof value === 'string') {
          shape[key] = convertType({ type: value });
        } else {
          shape[key] = convertType(value);
        }
      }
      return z.object(shape).passthrough();
    }
    
    return convertType(jsonSchema);
  }

  /**
   * Custom coercion rules for common AI mistakes
   */
  static applyCustomCoercion(value, schema) {
    const targetType = schema.type;
    
    // Rule 1: Object with numeric keys → Array
    if (targetType === 'array' && this.isObjectWithNumericKeys(value)) {
      return this.objectToArray(value);
    }
    
    // Rule 2: String array representation → Array
    if (targetType === 'array' && typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    
    // Rule 3: Single value → Array
    if (targetType === 'array' && !Array.isArray(value) && value !== null && value !== undefined) {
      return [value];
    }
    
    // Rule 4: Case correction for object properties
    if (targetType === 'object' && schema.properties && typeof value === 'object' && value !== null) {
      return this.correctPropertyCasing(value, schema.properties);
    }
    
    return value;
  }

  static isObjectWithNumericKeys(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const keys = Object.keys(value);
    return keys.length > 0 && keys.every(key => /^\d+$/.test(key));
  }

  static objectToArray(obj) {
    return Object.keys(obj)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .map(key => obj[key]);
  }

  static correctPropertyCasing(obj, schemaProperties) {
    const corrected = {};
    const schemaPropLower = Object.fromEntries(
      Object.entries(schemaProperties).map(([k, v]) => [k.toLowerCase(), k])
    );
    
    for (const [key, value] of Object.entries(obj)) {
      const correctKey = schemaPropLower[key.toLowerCase()] || key;
      corrected[correctKey] = value;
    }
    
    return corrected;
  }

  static describeType(value) {
    if (Array.isArray(value)) return 'array';
    if (value === null) return 'null';
    if (this.isObjectWithNumericKeys(value)) return 'object-with-numeric-keys';
    return typeof value;
  }

  static formatValidationError(zodError, received, expected, context) {
    const issues = zodError.issues.slice(0, 3).map(i => i.message).join(', ');
    const receivedType = this.describeType(received);
    const expectedType = expected.type || 'object';
    
    return `Schema validation failed for ${context.nodeType} node "${context.nodeAlias || context.position}": ` +
           `Expected ${expectedType}, received ${receivedType}. ` +
           `Validation errors: ${issues}. ` +
           `Automatic coercion was attempted but failed.`;
  }
}
```

#### 1.2 Integration Points

**File**: `/test-harness/operator/backend/services/nodeExecutor.js`

Add validation to AI nodes:

```javascript
// Import the validator
import { SchemaValidator } from './schemaValidator.js';

// In executeBrowserAIExtract method, after getting extractResult:
async executeBrowserAIExtract(config, inputData) {
  // ... existing code ...
  
  try {
    const extractResult = await activePage.extract(extractOptions);
    
    // NEW: Validate and coerce if schema exists
    if (config.schema) {
      const validation = SchemaValidator.validateAndCoerce(
        extractResult,
        config.schema,
        {
          nodeType: 'BROWSER_AI_EXTRACT',
          nodeAlias: config.alias,
          position: this.currentNodePosition
        }
      );
      
      if (!validation.success) {
        throw new Error(validation.error);
      }
      
      // Log coercion if it happened
      if (validation.coerced) {
        console.log(`[BROWSER_AI_EXTRACT] Type coercion applied for ${config.alias || `node${this.currentNodePosition}`}`);
      }
      
      extractResult = validation.data;
    }
    
    // ... rest of existing code ...
  } catch (error) {
    // Enhanced error message
    if (error.message.includes('Schema validation failed')) {
      throw error; // Already formatted
    }
    throw new Error(`Failed to extract: ${error.message}`);
  }
}

// In executeCognition method, after parsing response:
async executeCognition(config, inputData) {
  // ... existing code ...
  
  let parsedResponse;
  try {
    parsedResponse = JSON.parse(response);
  } catch (error) {
    throw new Error(`Failed to parse JSON response: ${error.message}`);
  }
  
  // NEW: Validate and coerce if schema exists
  if (config.schema) {
    const validation = SchemaValidator.validateAndCoerce(
      parsedResponse,
      config.schema,
      {
        nodeType: 'COGNITION',
        nodeAlias: config.alias,
        position: this.currentNodePosition
      }
    );
    
    if (!validation.success) {
      throw new Error(validation.error);
    }
    
    if (validation.coerced) {
      console.log(`[COGNITION] Type coercion applied for ${config.alias || `node${this.currentNodePosition}`}`);
    }
    
    parsedResponse = validation.data;
  }
  
  return parsedResponse;
}
```

### Phase 2: Enhanced Error Messages (Priority: HIGH)

#### 2.1 Improve Iterate Node Error Handling

**File**: `/test-harness/operator/backend/services/nodeExecutor.js`

```javascript
async executeIterate(config, inputData) {
  // ... existing resolution code ...
  
  // CHANGE: Add validation with clear error message
  if (!Array.isArray(collection)) {
    const actualType = Array.isArray(collection) ? 'array' : typeof collection;
    const variableInfo = config.listVariable || config.list;
    
    throw new Error(
      `Iterate node expected an array but received ${actualType} for "${variableInfo}". ` +
      `This often happens when AI extraction returns an object instead of an array. ` +
      `Consider updating the extraction schema to ensure it returns an array, ` +
      `or check if the variable exists and contains the expected data structure.`
    );
  }
  
  // ... rest of existing code ...
}
```

### Phase 3: Configuration and Rollout (Priority: MEDIUM)

#### 3.1 Add Configuration Options

**File**: `/test-harness/operator/backend/services/nodeExecutor.js`

```javascript
constructor(options = {}) {
  // ... existing code ...
  
  // Schema validation configuration
  this.schemaValidation = {
    enabled: options.schemaValidationEnabled !== false, // Default: true
    mode: options.schemaValidationMode || 'coerce', // 'strict' | 'coerce' | 'lenient'
    logCoercions: options.logSchemaCoercions !== false, // Default: true
    coercionRules: options.customCoercionRules || null
  };
}
```

#### 3.2 Add Validation Mode Support

Update SchemaValidator to respect modes:
- **strict**: No coercion, fail on any mismatch
- **coerce**: Attempt automatic coercion (default)
- **lenient**: Log warnings but don't fail

### Phase 4: Testing Strategy (Priority: HIGH)

#### 4.1 Unit Tests

Create `/test-harness/operator/backend/tests/schemaValidator.test.js`:

```javascript
import { describe, it, expect } from '@jest/globals';
import { SchemaValidator } from '../services/schemaValidator.js';

describe('SchemaValidator', () => {
  describe('validateAndCoerce', () => {
    it('should pass valid data without coercion', () => {
      const result = SchemaValidator.validateAndCoerce(
        { name: 'John', age: 30 },
        { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } } }
      );
      expect(result.success).toBe(true);
      expect(result.coerced).toBe(false);
    });

    it('should coerce object with numeric keys to array', () => {
      const result = SchemaValidator.validateAndCoerce(
        { "0": "first", "1": "second", "2": "third" },
        { type: 'array', items: { type: 'string' } }
      );
      expect(result.success).toBe(true);
      expect(result.coerced).toBe(true);
      expect(result.data).toEqual(['first', 'second', 'third']);
    });

    it('should coerce string numbers to numbers', () => {
      const result = SchemaValidator.validateAndCoerce(
        { count: "42" },
        { type: 'object', properties: { count: { type: 'number' } } }
      );
      expect(result.success).toBe(true);
      expect(result.data.count).toBe(42);
    });

    it('should handle case correction for object properties', () => {
      const result = SchemaValidator.validateAndCoerce(
        { UserName: 'john', EmailAddress: 'john@example.com' },
        { type: 'object', properties: { username: { type: 'string' }, emailaddress: { type: 'string' } } }
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('username', 'john');
    });
  });
});
```

### Design Decisions and Trade-offs

#### 1. **Validation Timing**
- **Decision**: Validate immediately after AI extraction
- **Trade-off**: Slight performance overhead vs early error detection
- **Reasoning**: Fail fast principle - catch errors at the source

#### 2. **Coercion Strategy**
- **Decision**: Use both Zod's built-in coercion and custom rules
- **Trade-off**: Complexity vs robustness
- **Reasoning**: Zod handles simple cases, custom rules handle AI-specific patterns

#### 3. **Error Handling**
- **Decision**: Throw errors with actionable messages
- **Trade-off**: Breaking change for existing workflows
- **Reasoning**: Silent failures cause more confusion than explicit errors

#### 4. **Backwards Compatibility**
- **Decision**: Enable by default with configuration to disable
- **Trade-off**: Potential breakage vs improved reliability
- **Reasoning**: Most workflows will benefit; edge cases can disable

#### 5. **Logging Strategy**
- **Decision**: Log all coercions with details
- **Trade-off**: Log volume vs debugging capability
- **Reasoning**: Essential for understanding AI behavior patterns

### Implementation Timeline

1. **Day 1-2**: Implement SchemaValidator class and tests
2. **Day 3**: Integrate with nodeExecutor for both AI nodes
3. **Day 4**: Add configuration options and iterate error handling
4. **Day 5**: Testing with real workflows (Gmail example)
5. **Day 6**: Documentation and Director prompt updates

### Success Metrics

1. **Type Mismatch Errors**: 90% reduction in iterate/route failures
2. **Coercion Success Rate**: >80% of mismatches auto-corrected
3. **Error Clarity**: 100% of schema errors have actionable messages
4. **Performance Impact**: <10ms overhead per validation

## Conclusion

This implementation plan addresses the core issue: AI outputs aren't validated, causing silent failures downstream. By adding validation at the source with intelligent coercion, we'll transform unreliable AI nodes into robust, type-safe components.