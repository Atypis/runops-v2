# Schema Enforcement Implementation Plan

## Executive Summary

Implement automatic schema validation and type coercion for AI node outputs (browser_ai_extract, cognition) to prevent silent type mismatches that break downstream nodes like iterate and route.

## Problem Statement

### Current Issues
1. **Silent Type Mismatches**: AI returns wrong types (e.g., object instead of array)
2. **Downstream Failures**: Errors surface in iterate/route nodes with cryptic messages
3. **No Validation**: AI outputs are trusted blindly without schema checking
4. **Poor DX**: Debugging requires manual inspection of stored variables

### Example Failure
```javascript
// Expected: ["selector1", "selector2"]
// AI Returns: {"0": "selector1", "1": "selector2"}
// Result: iterate node fails with "Unsupported token '{'"
```

## Solution Overview

Add a validation and coercion layer after AI execution that:
1. Validates output against declared schema using Zod
2. Attempts automatic coercion for common mismatches
3. Fails fast with clear error messages when coercion impossible
4. Provides detailed debugging information

## Implementation Design

### 1. Core Validation Function

Create `validateAndCoerceAIOutput()` in nodeExecutor.js:

```javascript
async validateAndCoerceAIOutput(rawOutput, jsonSchema, zodSchema, nodeType, nodeAlias) {
  // Step 1: Try direct validation
  const directResult = zodSchema.safeParse(rawOutput);
  if (directResult.success) {
    return directResult.data;
  }

  // Step 2: Attempt coercion based on common patterns
  const coercedOutput = this.attemptCoercion(rawOutput, jsonSchema);
  
  // Step 3: Validate coerced output
  const coercedResult = zodSchema.safeParse(coercedOutput);
  if (coercedResult.success) {
    console.log(`[${nodeType}] Applied coercion for ${nodeAlias}:`, {
      from: typeof rawOutput,
      to: jsonSchema.type,
      details: this.getCoercionDetails(rawOutput, coercedOutput)
    });
    return coercedResult.data;
  }

  // Step 4: Fail with detailed error
  throw new SchemaValidationError({
    nodeType,
    nodeAlias,
    expected: jsonSchema,
    received: rawOutput,
    zodError: directResult.error,
    coercionAttempted: true
  });
}
```

### 2. Coercion Rules

Implement `attemptCoercion()` with these transformations:

#### A. Object → Array
```javascript
// Input: {"0": "a", "1": "b", "2": "c"}
// Output: ["a", "b", "c"]
if (expectedType === 'array' && isObjectWithNumericKeys(value)) {
  return Object.keys(value)
    .sort((a, b) => parseInt(a) - parseInt(b))
    .map(key => value[key]);
}
```

#### B. String → Number
```javascript
// Input: "42"
// Output: 42
if (expectedType === 'number' && typeof value === 'string') {
  const num = parseFloat(value);
  if (!isNaN(num)) return num;
}
```

#### C. String → Boolean
```javascript
// Input: "true" or "false"
// Output: true or false
if (expectedType === 'boolean' && typeof value === 'string') {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
}
```

#### D. Case Correction
```javascript
// Input: {IsInvestor: true}
// Output: {isInvestor: true}
if (expectedType === 'object' && properties) {
  return correctPropertyCasing(value, properties);
}
```

#### E. Missing Optional Properties
```javascript
// Add null/default values for missing optional properties
if (expectedType === 'object' && properties) {
  return addMissingOptionalProperties(value, properties);
}
```

### 3. Integration Points

#### A. Browser AI Extract
```javascript
async executeBrowserAIExtract(config) {
  // ... existing code ...
  
  try {
    const extractResult = await activePage.extract(extractOptions);
    
    // NEW: Validate and coerce
    const validatedResult = await this.validateAndCoerceAIOutput(
      extractResult,
      config.schema,
      zodSchema,
      'BROWSER_AI_EXTRACT',
      config.alias || 'browser_ai_extract'
    );
    
    // Handle unwrapping if needed
    if (isPrimitiveOrArraySchema && validatedResult && 'value' in validatedResult) {
      return validatedResult.value;
    }
    
    return validatedResult;
  } catch (error) {
    // Enhanced error handling
    if (error instanceof SchemaValidationError) {
      console.error(`[BROWSER_AI_EXTRACT] Schema validation failed:`, error.details);
      throw new Error(
        `AI extraction returned invalid data format. Expected ${error.expected.type} but got ${typeof error.received}. ` +
        `Details: ${error.getDetailedMessage()}`
      );
    }
    throw error;
  }
}
```

#### B. Cognition Node
```javascript
async executeCognition(config, inputData) {
  // ... existing code ...
  
  const response = completion.choices[0].message.content;
  const parsedResponse = config.schema ? JSON.parse(response) : response;
  
  if (config.schema) {
    // NEW: Convert schema and validate
    const zodSchema = this.convertJsonSchemaToZod(config.schema);
    return await this.validateAndCoerceAIOutput(
      parsedResponse,
      config.schema,
      zodSchema,
      'COGNITION',
      config.alias || 'cognition'
    );
  }
  
  return parsedResponse;
}
```

### 4. Error Handling

Create custom error class:

```javascript
class SchemaValidationError extends Error {
  constructor({ nodeType, nodeAlias, expected, received, zodError, coercionAttempted }) {
    super(`Schema validation failed for ${nodeType} node "${nodeAlias}"`);
    this.nodeType = nodeType;
    this.nodeAlias = nodeAlias;
    this.expected = expected;
    this.received = received;
    this.zodError = zodError;
    this.coercionAttempted = coercionAttempted;
  }

  getDetailedMessage() {
    const expectedType = this.expected.type || 'object';
    const receivedType = Array.isArray(this.received) ? 'array' : typeof this.received;
    
    let message = `Expected ${expectedType}, received ${receivedType}.`;
    
    if (this.zodError) {
      const issues = this.zodError.issues.slice(0, 3).map(i => i.message).join(', ');
      message += ` Validation errors: ${issues}`;
    }
    
    if (this.coercionAttempted) {
      message += ' (automatic coercion failed)';
    }
    
    return message;
  }

  get details() {
    return {
      nodeType: this.nodeType,
      nodeAlias: this.nodeAlias,
      expected: this.expected,
      received: this.received,
      validationErrors: this.zodError?.issues || [],
      coercionAttempted: this.coercionAttempted
    };
  }
}
```

### 5. Configuration Options

Add to node configs:

```javascript
{
  type: 'browser_ai_extract',
  config: {
    instruction: '...',
    schema: {...},
    validation: {
      mode: 'strict' | 'coerce' | 'lenient',  // default: 'coerce'
      coercionRules: ['object-to-array', 'string-to-number', ...],  // optional
      customTransforms: {...}  // optional
    }
  }
}
```

### 6. Testing Strategy

#### Unit Tests
1. Test each coercion rule individually
2. Test validation with various schema types
3. Test error messages and details

#### Integration Tests
1. Test full AI node execution with validation
2. Test downstream node compatibility (iterate, route)
3. Test error propagation and workflow stopping

#### Example Test Cases
```javascript
// Test: Object to Array coercion
input: {schema: {type: 'array'}, output: {"0": "a", "1": "b"}}
expected: ["a", "b"]

// Test: String to Number coercion
input: {schema: {type: 'number'}, output: "42"}
expected: 42

// Test: Failed validation
input: {schema: {type: 'array'}, output: "not an array"}
expected: SchemaValidationError
```

## Implementation Steps

### Phase 1: Core Implementation (2-3 days)
1. Create `validateAndCoerceAIOutput` function
2. Implement basic coercion rules
3. Create SchemaValidationError class
4. Add logging and debugging helpers

### Phase 2: Integration (1-2 days)
1. Integrate with executeBrowserAIExtract
2. Integrate with executeCognition
3. Update error handling throughout
4. Add configuration options

### Phase 3: Testing & Refinement (2-3 days)
1. Write comprehensive unit tests
2. Test with real workflows (Gmail example)
3. Refine coercion rules based on findings
4. Update documentation

### Phase 4: Director Experience (1 day)
1. Update Director prompt with validation behavior
2. Add examples of how validation helps
3. Document common error patterns and fixes

## Success Metrics

1. **Fail Fast**: Schema errors caught at AI node, not downstream
2. **Success Rate**: 90%+ of common mismatches auto-corrected
3. **DX Improvement**: Clear error messages with actionable fixes
4. **Performance**: <10ms overhead for validation

## Rollout Strategy

1. **Feature Flag**: Add `enableSchemaValidation` flag (default: true)
2. **Backwards Compatibility**: Log warnings but don't fail for first week
3. **Monitoring**: Track validation failures and coercion success rates
4. **Iteration**: Refine coercion rules based on real-world usage

## Future Enhancements

1. **Schema Preview Tool**: Test schemas before running workflows
2. **Visual Schema Builder**: UI for creating complex schemas
3. **Coercion Analytics**: Dashboard showing common mismatches
4. **Custom Coercion Rules**: User-defined transformations
5. **Schema Library**: Reusable schemas for common patterns

## Conclusion

This implementation will transform AI nodes from unpredictable "black boxes" into reliable, type-safe components that integrate seamlessly with deterministic nodes. The Director will spend less time debugging type mismatches and more time building robust workflows.