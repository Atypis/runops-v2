# Nested Variable Access Fix

## Problem Summary

The `getStateValue` method cannot resolve nested paths for aliased node results. When a node stores an object (e.g., `{title: "Apple Watch Series 10"}`), the system cannot access nested properties using dot notation (`{{extract_first_product_title.title}}`).

## Current Behavior

```javascript
// Node stores:
extract_first_product_title = { title: "Apple Watch Series 10" }

// Director tries:
{{extract_first_product_title.title}}

// System looks for:
A variable literally named "extract_first_product_title.title" ❌

// Should instead:
1. Find "extract_first_product_title" 
2. Access the "title" property ✅
```

## Implementation Plan

### 1. Modify `getStateValue` Method

**File**: `backend/services/nodeExecutor.js`  
**Method**: `getStateValue(path, workflowId)`

### 2. Logic Changes

The method needs to:
1. Split the path on dots (but handle edge cases)
2. Look up the base variable first
3. Navigate through nested properties
4. Return undefined for invalid paths (graceful failure)

### 3. Edge Cases to Handle

- Array access: `{{emails[0].subject}}`
- Deep nesting: `{{node.data.users.first.name}}`
- Missing properties: Return undefined, don't crash
- Non-object base values: Return undefined if trying to access property of string/number

## Code Solution

```javascript
async getStateValue(path, workflowId) {
  // First, try to get the complete path (for backward compatibility)
  let value = await getFromMemory(path);
  
  if (value !== undefined) {
    return value;
  }
  
  // If not found, try nested path resolution
  const parts = path.split('.');
  let current = await getFromMemory(parts[0]);
  
  if (current === undefined) {
    return undefined;
  }
  
  // Navigate through the path
  for (let i = 1; i < parts.length; i++) {
    if (current === null || typeof current !== 'object') {
      return undefined;
    }
    current = current[parts[i]];
  }
  
  return current;
}
```

## Benefits

1. **Natural Syntax**: Directors can use `{{node.property}}` as documented
2. **Backward Compatible**: Existing workflows continue to work
3. **Consistent**: Works everywhere templates are resolved
4. **Graceful**: Returns undefined for invalid paths instead of crashing

## Testing

Test cases:
1. `{{extract_first_product_title.title}}` → "Apple Watch Series 10"
2. `{{extract_first_product_title}}` → Full object (backward compatibility)
3. `{{extract_first_product_title.nonexistent}}` → undefined
4. `{{nonexistent.property}}` → undefined
5. `{{deep.nested.path.to.value}}` → Resolved value