# Route Node Fix - Array Serialization Issue

## Problem Summary

When testing the new route node implementation, we discovered a critical serialization issue:

### What's Happening

1. **Director creates route with array config**:
   ```javascript
   config: [
     { name: "expected_site", condition: "{{get_title.title}} equals 'Example Domain'", branch: 5 },
     { name: "unexpected_site", condition: "true", branch: 6 }
   ]
   ```

2. **Database stores it as object with numeric keys**:
   ```javascript
   params: {
     "0": { name: "expected_site", condition: "{{get_title.title}} equals 'Example Domain'", branch: 5 },
     "1": { name: "unexpected_site", condition: "true", branch: 6 }
   }
   ```

3. **nodeExecutor.js expects array, gets object**:
   ```javascript
   // Line 1207-1208
   if (!Array.isArray(config)) {
     throw new Error('Route config must be an array of branches');
   }
   ```

### Root Cause

This is a classic JSON serialization issue. When arrays are stored in JSON columns in databases, they sometimes get converted to objects with numeric string keys. This happens because:
- JSON doesn't distinguish between arrays and objects with numeric keys
- Some database drivers/ORMs convert arrays to objects for consistency
- The params column might be treating all values as objects

### Evidence from Testing

The smart model (o3) correctly tried to create route nodes with array configs multiple times, but they all failed with the same error. The stored params show the array was converted to an object.

## Proposed Fixes

### Option 1: Make nodeExecutor Handle Both Formats (Quick Fix)

```javascript
async executeRoute(config, workflowId) {
  // Convert object with numeric keys back to array if needed
  if (!Array.isArray(config) && typeof config === 'object') {
    const keys = Object.keys(config);
    if (keys.every(key => /^\d+$/.test(key))) {
      // It's an object with numeric keys, convert to array
      config = keys.sort((a, b) => parseInt(a) - parseInt(b))
                   .map(key => config[key]);
    } else {
      throw new Error('Route config must be an array of branches');
    }
  }
  
  // Continue with existing logic...
}
```

### Option 2: Fix at the Storage Level (Better Long-term)

1. Check how nodes are stored in the database
2. Ensure arrays are preserved as arrays in the params column
3. Might need to update the node creation/storage logic

### Option 3: Change Config Structure (Nuclear Option)

Instead of using an array, explicitly use an object:
```javascript
config: {
  branches: [
    { name: "expected_site", ... },
    { name: "unexpected_site", ... }
  ]
}
```

## Additional Observations

1. **The model understood the format correctly** - It tried to create proper array configs
2. **The error message is clear** - "Route config must be an array of branches"
3. **The tool definition is correct** - It specifies array type
4. **The issue is in the persistence layer** - Between creation and execution

## Testing Notes

To reproduce:
1. Create a route node with array config via the Director API
2. Check the database to see how params are stored
3. Try to execute the workflow
4. See the "Route config must be an array of branches" error

## Next Steps

1. Implement Option 1 as immediate fix
2. Investigate database storage to understand why arrays become objects
3. Consider if this affects other node types that expect arrays
4. Add tests for both array and object formats
5. Update documentation if we support both formats

## Related Code Locations

- `/test-harness/operator/backend/services/nodeExecutor.js:1203-1242` - executeRoute method
- `/test-harness/operator/backend/tools/toolDefinitionsV2.js:391-439` - Route schema
- Database storage logic for nodes (need to find where params are serialized)
- Director API node creation endpoint

## Questions to Investigate

1. Does this affect other array-based configs (like iterate.body)?
2. Is this a Supabase-specific issue or general JSON storage problem?
3. Should we handle this at the API level before storage?
4. Are there other node types affected by this serialization issue?