import { z } from 'zod';

export class SchemaValidator {
  /**
   * Validates and coerces AI output against expected schema
   * @returns {Object} { success: boolean, data?: any, error?: string, coerced: boolean }
   */
  static validateAndCoerce(rawOutput, jsonSchema, context = {}) {
    try {
      // Step 1: Apply custom coercion rules first (before Zod)
      const coercedData = this.applyCustomCoercion(rawOutput, jsonSchema);
      
      // Step 2: Convert JSON schema to Zod with coercion
      const zodSchema = this.convertJsonSchemaToZodWithCoercion(jsonSchema);
      
      // Step 3: Attempt validation on coerced data
      const result = zodSchema.safeParse(coercedData);
      
      if (result.success) {
        // Check if we actually did any coercion
        const wasCoerced = JSON.stringify(rawOutput) !== JSON.stringify(coercedData);
        if (wasCoerced) {
          console.log(`[SCHEMA] Coercion applied for ${context.nodeAlias || context.nodeType}:`, {
            from: this.describeType(rawOutput),
            to: jsonSchema.type,
            context
          });
        }
        return { success: true, data: result.data, coerced: wasCoerced };
      }
      
      // Step 4: Return detailed error
      return {
        success: false,
        error: this.formatValidationError(result.error, rawOutput, jsonSchema, context),
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
          // Enhanced number coercion to handle formatted numbers and prevent NaN
          return z.preprocess((val) => {
            if (typeof val === 'string') {
              // Handle formatted numbers like "$1,234.56", "1.5K", etc.
              const cleaned = val.replace(/[$,\s%]/g, '');
              const num = parseFloat(cleaned);
              if (!isNaN(num) && isFinite(num)) return num;
              // Return original value to let Zod handle the error gracefully
              return val;
            }
            if (typeof val === 'number' && (isNaN(val) || !isFinite(val))) {
              // Convert NaN/Infinity to a string so Zod can provide a clear error
              return val.toString();
            }
            return val;
          }, z.number());
          
        case 'boolean':
          // Custom boolean coercion to handle "true"/"false" strings
          return z.preprocess((val) => {
            if (typeof val === 'string') {
              if (val.toLowerCase() === 'true') return true;
              if (val.toLowerCase() === 'false') return false;
            }
            return val;
          }, z.boolean());
          
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
    
    // Rule 4: Case correction and nested coercion for object properties
    if (targetType === 'object' && schema.properties && typeof value === 'object' && value !== null) {
      const corrected = this.correctPropertyCasing(value, schema.properties);
      
      // Apply coercion recursively to nested properties
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (corrected[key] !== undefined && propSchema) {
          corrected[key] = this.applyCustomCoercion(corrected[key], propSchema);
        }
      }
      
      return corrected;
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
    if (Array.isArray(value)) return `array[${value.length}]`;
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (this.isObjectWithNumericKeys(value)) return 'object-with-numeric-keys';
    if (typeof value === 'object') {
      const keys = Object.keys(value);
      return `object{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
    }
    if (typeof value === 'string') return `string("${value.slice(0, 50)}${value.length > 50 ? '...' : ''}")`;
    if (typeof value === 'number') return `number(${value})`;
    return typeof value;
  }

  static formatValidationError(zodError, received, expected, context) {
    const issues = zodError.issues.slice(0, 3).map(i => i.message).join(', ');
    const receivedType = this.describeType(received);
    const expectedType = expected.type || 'object';
    
    // Show actual data snippet for debugging
    const receivedSample = JSON.stringify(received, null, 2).slice(0, 200);
    const expectedSample = JSON.stringify(expected, null, 2).slice(0, 150);
    
    return `Schema validation failed for ${context.nodeType} node "${context.nodeAlias || context.position}": ` +
           `Expected ${expectedType}, received ${receivedType}.\n` +
           `Validation errors: ${issues}\n` +
           `Received data: ${receivedSample}${receivedSample.length >= 200 ? '...' : ''}\n` +
           `Expected schema: ${expectedSample}${expectedSample.length >= 150 ? '...' : ''}\n` +
           `Automatic coercion was attempted but failed.`;
  }
}