# Cognition Node Schema Requirement Plan

## Current Issue

The cognition node currently treats `schema` as optional, leading to confusion:
- Without schema: Returns raw string (even if it looks like JSON)
- With schema: Returns parsed and typed data

This caused a real bug where:
1. Director created: `instruction: "Return {\"hasHot\":true,\"hasWarm\":false}"`
2. Expected to access: `{{check_posts.hasHot}}`
3. Failed because result was string `'{"hasHot":true,"hasWarm":false}'`, not object

## Proposed Change

Make `schema` **required** for all cognition nodes.

### Implementation

1. **Update toolDefinitionsV2.js**:
```javascript
// Change from:
required: ['instruction'],

// To:
required: ['instruction', 'schema'],
```

2. **Common Schema Patterns**:
```javascript
// Simple text
schema: {type: "string"}

// Number
schema: {type: "number"}

// Boolean
schema: {type: "boolean"}

// Object with properties
schema: {
  type: "object",
  properties: {
    hasHot: {type: "boolean"},
    hasWarm: {type: "boolean"}
  },
  required: ["hasHot", "hasWarm"]
}

// Array
schema: {
  type: "array",
  items: {type: "string"}
}
```

## Benefits

1. **Type Safety**: Always know what type you're getting
2. **No Confusion**: Can't accidentally create string that looks like JSON
3. **Better Validation**: Schema ensures AI returns expected format
4. **Clear Intent**: Forces Director to think about data structure

## Migration

This is a breaking change. All existing cognition nodes without schema will fail validation. Need to:
1. Update all examples in directorPromptV3.js
2. Add migration note in changelog
3. Consider adding helpful error message when schema is missing

## No Downside

There's no legitimate use case for unstructured output:
- Want free text? Use `schema: {type: "string"}`
- Want any JSON? Use `schema: {type: "object", additionalProperties: true}`

This change eliminates an entire class of bugs while losing no functionality.