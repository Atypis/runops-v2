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

## Implementation Tasks

### 1. Codebase Change
- **File**: `/test-harness/operator/backend/services/nodeExecutor.js`
- **Task**: Ensure cognition execution handles required schema properly
- **Verify**: Error handling when schema validation fails

### 2. Tool Definitions Change
- **File**: `/test-harness/operator/backend/tools/toolDefinitionsV2.js`
- **Task**: Move `schema` from optional to required in cognition node definition
- **Change**: `required: ['instruction', 'schema']` in cognition schema

### 3. System Prompt Update
- **File**: `/test-harness/operator/backend/prompts/directorPromptV3.js`
- **Tasks**:
  - Update all cognition examples to include schema
  - Remove any examples without schema
  - Add clear explanation that schema is required
  - Include common schema patterns

## Migration Notes

This is a breaking change. All existing cognition nodes without schema will fail validation. Consider adding helpful error message when schema is missing.

## No Downside

There's no legitimate use case for unstructured output:
- Want free text? Use `schema: {type: "string"}`
- Want any JSON? Use `schema: {type: "object", additionalProperties: true}`

This change eliminates an entire class of bugs while losing no functionality.