Defining Functions

Functions can be defined in the tools parameter of each API request.

A function is described by its schema, which tells the model what the function does and what input it expects. The schema includes the following fields:

Field	Description
type	This should always be "function"
name	The function’s name (e.g., get_weather)
description	A short explanation of when and how to use the function
parameters	JSON schema defining the function’s input arguments
strict	Whether to enforce strict mode for the function call

Example

{
  "type": "function",
  "name": "get_weather",
  "description": "Retrieves current weather for the given location.",
  "parameters": {
    "type": "object",
    "properties": {
      "location": {
        "type": "string",
        "description": "City and country e.g. Bogotá, Colombia"
      },
      "units": {
        "type": "string",
        "enum": [
          "celsius",
          "fahrenheit"
        ],
        "description": "Units the temperature will be returned in."
      }
    },
    "required": [
      "location",
      "units"
    ],
    "additionalProperties": false
  },
  "strict": true
}

Since function parameters are defined using a JSON Schema, you can take advantage of features like:
	•	Property types
	•	Enums
	•	Descriptions
	•	Nested and recursive objects

⸻

Best Practices for Defining Functions
	•	✅ Write clear and detailed function names, parameter descriptions, and usage instructions.
	•	✅ Explicitly describe the purpose of the function and each parameter (including format), and what the function returns.
	•	✅ Use the system prompt to define when (and when not) to use each function.
	•	✅ Include examples and edge cases to handle common failure points.
(Note: examples may reduce performance for reasoning models.)
	•	✅ Apply software engineering best practices.
	•	✅ Make functions obvious and intuitive — follow the Principle of Least Surprise.
	•	✅ Use enums and object structure to make invalid states unrepresentable.
(e.g., toggle_light(on: bool, off: bool) allows invalid combinations — avoid this!)
	•	✅ Pass the intern test:
Can a new developer understand and use the function with only your schema? If not, improve it.
	•	✅ Offload known arguments to your code — don’t make the model guess them.
(e.g., if you already have order_id, don’t ask the model to supply it again.)
	•	✅ Combine sequential calls into a single function when possible.
(e.g., if query_location() is always followed by mark_location(), merge them.)
	•	✅ Keep your function set small — fewer than 20 is ideal for higher accuracy.
	•	✅ Test performance with different numbers of functions.

⸻

Additional Tips
	•	Use the Playground to generate and refine function schemas.
	•	Consider fine-tuning to boost performance on complex or large-scale function sets.
(See OpenAI Cookbook for examples.)

⸻

## OpenAI Function Calling Implementation Learnings (July 2024)

### Key Updates in 2024

1. **Structured Outputs (June 2024)**: OpenAI introduced "Structured Outputs" feature. When you set `strict: true` in your function definition, it guarantees that the model's output will exactly match your JSON Schema. This is a significant improvement over the previous JSON mode which only guaranteed valid JSON but not schema compliance.

2. **JSON Schema Version**: OpenAI uses JSON Schema Draft 8 Patch 1 (not Draft 4). This is important for compatibility.

### Critical Schema Limitations

#### ❌ OpenAI Does NOT Support:
- **`oneOf`** - Will throw error: "In context=(), 'oneOf' is not permitted"
- **`allOf`** - Not supported in strict mode
- **`$ref`** - No schema references
- **`patternProperties`** - No regex-based property names
- **Complex regex patterns** - Limited pattern support

#### ✅ OpenAI DOES Support:
- **`anyOf`** - Use this instead of `oneOf`
- **`enum`** - For specific allowed values
- **`type`** - All basic types (string, number, boolean, object, array, null)
- **`properties`** - For object schemas
- **`items`** - For array schemas
- **`required`** - List of required properties
- **`additionalProperties`** - Must be `false` in strict mode

### Understanding anyOf vs oneOf

**anyOf**: Data is valid if it matches **one or more** schemas
```javascript
// Example: Contact info can have email, phone, or both
{
  anyOf: [
    { properties: { email: { type: "string" } } },
    { properties: { phone: { type: "string" } } }
  ]
}
// Valid: {email: "x@y.com"}, {phone: "555-1234"}, {email: "x@y.com", phone: "555-1234"}
```

**oneOf**: Data is valid if it matches **exactly one** schema (NOT SUPPORTED BY OPENAI)
```javascript
// Would be used for mutually exclusive options, but use anyOf with careful schema design instead
```

### Strict Mode Requirements

When using `strict: true`, you MUST:

1. **Set `additionalProperties: false`** on ALL object schemas
   ```javascript
   {
     type: "object",
     properties: { /* ... */ },
     additionalProperties: false  // Required!
   }
   ```

2. **Explicitly list ALL required fields**
   ```javascript
   {
     type: "object",
     properties: { /* ... */ },
     required: ["field1", "field2"],  // Must be explicit
     additionalProperties: false
   }
   ```

3. **Avoid ambiguous schemas** - Make sure your anyOf branches are clearly distinguishable

### Practical Implementation Pattern

For functions with variable parameters based on a type field (like our `create_node`):

```javascript
{
  type: "function",
  function: {
    name: "create_node",
    description: "...",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["browser_action", "browser_ai_action", "transform", ...],
          description: "The type of node to create"
        },
        config: {
          type: "object",
          description: "Configuration specific to the node type",
          // Don't use oneOf here! Instead, describe a general structure
          // and validate specific requirements in your backend
        },
        alias: {
          type: "string",
          pattern: "^[a-z][a-z0-9_]*$",
          description: "Unique identifier in snake_case"
        }
      },
      required: ["type", "config", "alias"],
      additionalProperties: false
    },
    strict: true  // Enable strict mode
  }
}
```

### Alternative Pattern Using anyOf

If you need type-specific validation at the schema level:

```javascript
{
  parameters: {
    anyOf: [
      {
        type: "object",
        properties: {
          type: { const: "browser_action" },
          config: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["navigate", "wait", ...] },
              // browser_action specific properties
            },
            required: ["action"],
            additionalProperties: false
          },
          alias: { type: "string" }
        },
        required: ["type", "config", "alias"],
        additionalProperties: false
      },
      {
        type: "object", 
        properties: {
          type: { const: "browser_ai_action" },
          config: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["click", "type", "act"] },
              instruction: { type: "string" },
              // browser_ai_action specific properties
            },
            required: ["action", "instruction"],
            additionalProperties: false
          },
          alias: { type: "string" }
        },
        required: ["type", "config", "alias"],
        additionalProperties: false
      }
      // ... more node types
    ]
  }
}
```

### Common Pitfalls to Avoid

1. **Don't use oneOf** - It will fail with OpenAI. Always use anyOf or restructure your schema.

2. **Don't forget additionalProperties: false** - Required for every object in strict mode.

3. **Don't assume optional fields** - If a field isn't in the `required` array, explicitly document it as optional in the description.

4. **Don't use complex regex** - Keep pattern validation simple or move it to backend validation.

5. **Don't nest too deeply** - Flatter schemas are more reliable and easier for the model to understand.

### Documentation Split

- **In toolDefinitions.js**: Document WHAT (parameter types, schemas, constraints)
- **In system prompt**: Document WHEN and WHY (use cases, decision logic, examples)

The function schema should be self-contained - the "intern test" applies: could a new developer use this function correctly with ONLY the schema?

⸻