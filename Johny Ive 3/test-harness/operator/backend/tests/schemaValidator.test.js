import { SchemaValidator } from '../services/schemaValidator.js';

// Simple test runner since we're using ES modules
function describe(name, fn) {
  console.log(`\n${name}`);
  fn();
}

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
  } catch (error) {
    console.log(`  ❌ ${name}`);
    console.error(`     ${error.message}`);
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
    },
    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toHaveProperty(prop, value) {
      if (!(prop in actual)) {
        throw new Error(`Expected property ${prop} to exist`);
      }
      if (value !== undefined && actual[prop] !== value) {
        throw new Error(`Expected property ${prop} to be ${value} but got ${actual[prop]}`);
      }
    }
  };
}

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

    it('should coerce string booleans to booleans', () => {
      const result = SchemaValidator.validateAndCoerce(
        { isActive: "true", isDeleted: "false" },
        { type: 'object', properties: { isActive: { type: 'boolean' }, isDeleted: { type: 'boolean' } } }
      );
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
      expect(result.data.isDeleted).toBe(false);
    });

    it('should handle case correction for object properties', () => {
      const result = SchemaValidator.validateAndCoerce(
        { UserName: 'john', EmailAddress: 'john@example.com' },
        { type: 'object', properties: { username: { type: 'string' }, emailaddress: { type: 'string' } } }
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('username', 'john');
      expect(result.data).toHaveProperty('emailaddress', 'john@example.com');
    });

    it('should wrap single value in array when expecting array', () => {
      const result = SchemaValidator.validateAndCoerce(
        "single-email@example.com",
        { type: 'array', items: { type: 'string' } }
      );
      expect(result.success).toBe(true);
      expect(result.coerced).toBe(true);
      expect(result.data).toEqual(['single-email@example.com']);
    });

    it('should handle simple schema format', () => {
      const result = SchemaValidator.validateAndCoerce(
        { name: 'John', count: "5" },
        { name: 'string', count: 'number' }
      );
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John');
      expect(result.data.count).toBe(5);
    });

    it('should fail when coercion is not possible', () => {
      const result = SchemaValidator.validateAndCoerce(
        { data: "This is a string that cannot become an array" },
        { type: 'object', properties: { data: { type: 'array' } } }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Schema validation failed for undefined node "undefined": ' +
        'Expected object, received object. ' +
        'Validation errors: Expected array, received string. ' +
        'Automatic coercion was attempted but failed.'
      );
    });

    it('should parse JSON string to array when possible', () => {
      const result = SchemaValidator.validateAndCoerce(
        '["item1", "item2", "item3"]',
        { type: 'array', items: { type: 'string' } }
      );
      expect(result.success).toBe(true);
      expect(result.coerced).toBe(true);
      expect(result.data).toEqual(['item1', 'item2', 'item3']);
    });
  });

  describe('Real-world AI extraction scenarios', () => {
    it('should handle Gmail-style object-instead-of-array response', () => {
      // This is the exact scenario from the Director's problem
      const aiResponse = {
        "0": "email1@example.com",
        "1": "email2@example.com",
        "2": "email3@example.com"
      };
      
      const schema = {
        type: 'array',
        items: { type: 'string' }
      };
      
      const result = SchemaValidator.validateAndCoerce(aiResponse, schema, {
        nodeType: 'BROWSER_AI_EXTRACT',
        nodeAlias: 'email_list'
      });
      
      expect(result.success).toBe(true);
      expect(result.coerced).toBe(true);
      expect(result.data).toEqual([
        'email1@example.com',
        'email2@example.com',
        'email3@example.com'
      ]);
    });

    it('should handle nested object with array property', () => {
      const aiResponse = {
        company: "Acme Corp",
        employees: {
          "0": { name: "John", role: "CEO" },
          "1": { name: "Jane", role: "CTO" }
        }
      };
      
      const schema = {
        type: 'object',
        properties: {
          company: { type: 'string' },
          employees: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                role: { type: 'string' }
              }
            }
          }
        }
      };
      
      const result = SchemaValidator.validateAndCoerce(aiResponse, schema);
      
      expect(result.success).toBe(true);
      expect(result.coerced).toBe(true);
      expect(result.data.employees).toEqual([
        { name: "John", role: "CEO" },
        { name: "Jane", role: "CTO" }
      ]);
    });
  });
});

// Run tests
console.log('Running SchemaValidator tests...');
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

    it('should coerce string booleans to booleans', () => {
      const result = SchemaValidator.validateAndCoerce(
        { isActive: "true", isDeleted: "false" },
        { type: 'object', properties: { isActive: { type: 'boolean' }, isDeleted: { type: 'boolean' } } }
      );
      expect(result.success).toBe(true);
      expect(result.data.isActive).toBe(true);
      expect(result.data.isDeleted).toBe(false);
    });

    it('should handle case correction for object properties', () => {
      const result = SchemaValidator.validateAndCoerce(
        { UserName: 'john', EmailAddress: 'john@example.com' },
        { type: 'object', properties: { username: { type: 'string' }, emailaddress: { type: 'string' } } }
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('username', 'john');
      expect(result.data).toHaveProperty('emailaddress', 'john@example.com');
    });

    it('should wrap single value in array when expecting array', () => {
      const result = SchemaValidator.validateAndCoerce(
        "single-email@example.com",
        { type: 'array', items: { type: 'string' } }
      );
      expect(result.success).toBe(true);
      expect(result.coerced).toBe(true);
      expect(result.data).toEqual(['single-email@example.com']);
    });

    it('should handle simple schema format', () => {
      const result = SchemaValidator.validateAndCoerce(
        { name: 'John', count: "5" },
        { name: 'string', count: 'number' }
      );
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('John');
      expect(result.data.count).toBe(5);
    });

    it('should parse JSON string to array when possible', () => {
      const result = SchemaValidator.validateAndCoerce(
        '["item1", "item2", "item3"]',
        { type: 'array', items: { type: 'string' } }
      );
      expect(result.success).toBe(true);
      expect(result.coerced).toBe(true);
      expect(result.data).toEqual(['item1', 'item2', 'item3']);
    });
  });

  describe('Real-world AI extraction scenarios', () => {
    it('should handle Gmail-style object-instead-of-array response', () => {
      const aiResponse = {
        "0": "email1@example.com",
        "1": "email2@example.com",
        "2": "email3@example.com"
      };
      
      const schema = {
        type: 'array',
        items: { type: 'string' }
      };
      
      const result = SchemaValidator.validateAndCoerce(aiResponse, schema, {
        nodeType: 'BROWSER_AI_EXTRACT',
        nodeAlias: 'email_list'
      });
      
      expect(result.success).toBe(true);
      expect(result.coerced).toBe(true);
      expect(result.data).toEqual([
        'email1@example.com',
        'email2@example.com',
        'email3@example.com'
      ]);
    });
  });
});

console.log('\nTests completed!');