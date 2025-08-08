# Record System Bug Fixes - Implementation Plan

## Critical Bugs Found

### 1. Config Resolution Bug (HIGHEST PRIORITY)
**Issue**: `node.config` does NOT get template variable resolution, while `node.params` does.
- Location: `/test-harness/operator/backend/services/nodeExecutor.js` line 847-851
- Impact: `create_records` configuration cannot use template variables
- Example failure: `create_records: { type: "email", id_pattern: "{{thread_id}}_{{index}}" }` fails because `{{thread_id}}` is never resolved

### 2. Partial ID Pattern Resolution
**Issue**: `createRecordsFromResult` only replaces `{{index}}` but ignores other template variables
- Location: `/test-harness/operator/backend/services/nodeExecutor.js` line 151
- Impact: Custom ID patterns with workflow variables don't work
- Example: `email_{{thread_id}}_{{index}}` becomes `email_{{thread_id}}_001` (thread_id unresolved)

## Implementation Order

### Phase 1: Fix Config Resolution (IMMEDIATE)
**File**: `/test-harness/operator/backend/services/nodeExecutor.js`

1. **Add config resolution in executeNode**:
   ```javascript
   // Line 847-852 currently:
   let resolvedParams = node.params;
   if (node.params) {
     console.log(`[EXECUTE] Resolving template variables`);
     resolvedParams = await this.resolveNodeParams(node.params, workflowId);
     console.log(`[EXECUTE] Resolved params:`, JSON.stringify(resolvedParams, null, 2));
   }
   
   // ADD AFTER:
   let resolvedConfig = node.config;
   if (node.config) {
     console.log(`[EXECUTE] Resolving config template variables`);
     resolvedConfig = await this.resolveNodeParams(node.config, workflowId);
     console.log(`[EXECUTE] Resolved config:`, JSON.stringify(resolvedConfig, null, 2));
   }
   ```

2. **Update all node.config references to use resolvedConfig**:
   - Line 1047: Change `node.config?.create_records` to `resolvedConfig?.create_records`
   - Line 1049: Change `node.config.create_records` to `resolvedConfig.create_records`
   - Line 1055: Pass `resolvedConfig.create_records` instead of `node.config.create_records`

### Phase 2: Fix ID Pattern Resolution
**File**: `/test-harness/operator/backend/services/nodeExecutor.js`

1. **Update createRecordsFromResult method** (line 133):
   ```javascript
   async createRecordsFromResult(result, createConfig, workflowId, nodeAlias) {
     let recordType, idPattern;
     
     if (typeof createConfig === 'string') {
       recordType = createConfig;
       idPattern = `${recordType}_{{index}}`;
     } else {
       recordType = createConfig.type || 'record';
       idPattern = createConfig.id_pattern || `${recordType}_{{index}}`;
     }
     
     // Handle array results
     if (Array.isArray(result)) {
       console.log(`[RECORD_CREATION] Creating ${result.length} ${recordType} records from array result`);
       
       for (let i = 0; i < result.length; i++) {
         // First replace {{index}} with the actual index
         let recordId = idPattern.replace('{{index}}', String(i + 1).padStart(3, '0'));
         
         // NEW: Resolve any remaining template variables from the current item
         if (recordId.includes('{{')) {
           // Create a context object with the current item data
           const itemContext = {
             ...result[i],
             index: String(i + 1).padStart(3, '0')
           };
           
           // Resolve template variables using item data
           recordId = await this.resolveTemplateString(recordId, itemContext, workflowId);
         }
         
         // Rest of the method...
       }
     }
   }
   ```

2. **Add helper method for template string resolution**:
   ```javascript
   async resolveTemplateString(template, context, workflowId) {
     // Replace {{key}} patterns with values from context
     return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
       // First check context object
       if (context && context[key] !== undefined) {
         return context[key];
       }
       
       // Fall back to workflow variables
       // This would need async handling - simplified for now
       return match; // Keep unresolved for now
     });
   }
   ```

### Phase 3: Implement Store Configuration (MEDIUM PRIORITY)
**Purpose**: Replace automatic `store_variable: true` with explicit field mapping

1. **Update node execution to handle new store config**:
   ```javascript
   // Instead of dumping entire result with store_variable: true
   if (resolvedConfig?.store) {
     // Store only specified fields
     for (const [targetKey, sourceKey] of Object.entries(resolvedConfig.store)) {
       const value = getNestedValue(result, sourceKey);
       await this.variableService.setVariable(
         workflowId, 
         `${node.alias}.${targetKey}`,
         value
       );
     }
   }
   ```

### Phase 4: Update Template Resolver (MEDIUM PRIORITY)
**File**: `/test-harness/operator/backend/services/nodeExecutor.js`

1. **Enhance resolveTemplatesWithRecords** to handle record patterns:
   ```javascript
   // Add record pattern detection
   if (path.match(/^[a-z]+_\d{3}\./)) {
     const [recordId, ...rest] = path.split('.');
     const record = await this.variableService.getRecord(workflowId, recordId);
     if (record) {
       return getNestedValue(record.data, rest.join('.'));
     }
   }
   ```

## Testing Plan

### Test Case 1: Basic Record Creation
```javascript
{
  type: "browser_ai_extract",
  alias: "extract_emails",
  config: {
    create_records: "email",
    store_variable: true
  }
}
```

### Test Case 2: Custom ID Pattern with Variables
```javascript
{
  type: "browser_ai_extract", 
  alias: "extract_threads",
  config: {
    create_records: {
      type: "thread",
      id_pattern: "thread_{{thread_id}}_{{index}}"
    }
  }
}
```

### Test Case 3: Explicit Store Configuration
```javascript
{
  type: "browser_ai_extract",
  alias: "extract_emails",
  config: {
    store: {
      "count": "total_emails",
      "items": "emails"
    }
  }
}
```

## Success Criteria

1. ✅ `create_records` works with template variables in config
2. ✅ Custom ID patterns fully resolve all template variables
3. ✅ No regression in existing functionality
4. ✅ Clear error messages when resolution fails
5. ✅ Records are created with proper structure and data

## Rollback Plan

If issues arise:
1. Revert nodeExecutor.js changes
2. Keep backward compatibility for `store_variable: true`
3. Add feature flag for new store configuration

## Next Steps After Fixes

1. Update documentation with examples
2. Add unit tests for config resolution
3. Update Director tools to show available record patterns
4. Consider migration tool for existing workflows