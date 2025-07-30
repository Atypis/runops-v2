# Record Management Tool Implementation Plan

## Overview

This document outlines the implementation plan for a consolidated `record_management` tool that provides comprehensive record manipulation capabilities for the Director system. This tool will enable testing, debugging, and manual record management through a single, unified interface.

## Motivation

Currently, the Director system lacks direct tools for record manipulation. Records can only be created through node execution with `create_records` configuration. This limitation makes it difficult to:
- Test iteration nodes with pre-existing records
- Debug record-based workflows
- Set up test scenarios with specific record states
- Clean up test data

## Tool Design

### Function Definition

```javascript
{
  type: 'function',
  function: {
    name: 'record_management',
    description: 'Comprehensive record management for testing and debugging. Supports create, update, delete, and query operations on workflow records.',
    parameters: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['set', 'get', 'delete', 'clear_all', 'query'],
          description: 'Operation to perform on records'
        },
        record_id: {
          type: 'string',
          description: 'Record ID for set/get/delete operations (e.g., "product_001", "email_042")'
        },
        pattern: {
          type: 'string',
          description: 'Pattern for query/clear_all operations (e.g., "product_*", "test_*")'
        },
        data: {
          type: 'object',
          description: 'Data for set operation. For new records, provide complete data. For updates, use dot notation like {"vars.classification": "spam"} or provide full structure.',
          additionalProperties: true
        },
        options: {
          type: 'object',
          properties: {
            mode: {
              type: 'string',
              enum: ['create', 'update', 'upsert'],
              description: 'Operation mode for set. create: fail if exists, update: fail if not exists, upsert: create or update (default)',
              default: 'upsert'
            },
            record_type: {
              type: 'string',
              description: 'Record type (e.g., "product", "email"). If not provided, extracted from record_id prefix.'
            },
            status: {
              type: 'string',
              enum: ['discovered', 'processing', 'complete', 'failed'],
              description: 'Record status (defaults to "discovered" for new records)'
            },
            error_message: {
              type: 'string',
              description: 'Error message to set (only valid with status="failed")'
            },
            iteration_node_alias: {
              type: 'string',
              description: 'Node that created/owns this record (defaults to "manual_record_management")',
              default: 'manual_record_management'
            },
            include_history: {
              type: 'boolean',
              description: 'For get operation: include full history array (default: false)',
              default: false
            },
            fields: {
              type: 'array',
              items: { type: 'string' },
              description: 'For get operation: specific fields to retrieve (e.g., ["fields.name", "vars.classification"])'
            }
          },
          additionalProperties: false
        },
        reason: {
          type: 'string',
          description: 'Audit trail reason (required for mutations: set, delete, clear_all)'
        }
      },
      required: ['operation'],
      additionalProperties: false
    },
    strict: true
  }
}
```

### Validation Rules

The tool will enforce different required parameters based on the operation:

```javascript
// Validation logic (conceptual)
if (operation === 'set') {
  required: ['record_id', 'data', 'reason']
}
if (operation === 'get') {
  required: ['record_id']
}
if (operation === 'delete') {
  required: ['record_id', 'reason']
}
if (operation === 'clear_all') {
  required: ['pattern', 'reason']
}
if (operation === 'query') {
  // pattern is optional - if not provided, returns all records
}
```

## Implementation Details

### 1. Tool Definition Addition

Add the tool definition to `/backend/tools/toolDefinitionsV2.js` in the `createToolDefinitions()` function array.

### 2. DirectorService Integration

Add case handler in `directorService.executeToolCall()`:

```javascript
case 'record_management':
  result = await this.recordManagement(args, workflowId);
  break;
```

### 3. Core Implementation

Add the `recordManagement` method to `directorService.js`:

```javascript
async recordManagement(args, workflowId) {
  const { operation, record_id, pattern, data, options = {}, reason } = args;
  
  try {
    switch (operation) {
      case 'set':
        return await this.setRecord(workflowId, record_id, data, options, reason);
      
      case 'get':
        return await this.getRecord(workflowId, record_id, options);
      
      case 'delete':
        return await this.deleteRecord(workflowId, record_id, reason);
      
      case 'clear_all':
        return await this.clearAllRecords(workflowId, pattern, reason);
      
      case 'query':
        return await this.queryRecords(workflowId, pattern);
      
      default:
        return { success: false, error: `Unknown operation: ${operation}` };
    }
  } catch (error) {
    return { 
      success: false, 
      error: error.message || 'Record management operation failed' 
    };
  }
}
```

### 4. Operation Implementations

#### Set Record (Create/Update)

```javascript
async setRecord(workflowId, recordId, data, options, reason) {
  const { 
    mode = 'upsert',
    record_type,
    status,
    error_message,
    iteration_node_alias = 'manual_record_management'
  } = options;

  // Extract record type from ID if not provided
  const actualRecordType = record_type || recordId.split('_')[0];
  
  // Check if record exists
  const existingRecord = await this.variableManagementService.getRecord(workflowId, recordId);
  
  // Mode validation
  if (mode === 'create' && existingRecord) {
    return { success: false, error: `Record ${recordId} already exists` };
  }
  if (mode === 'update' && !existingRecord) {
    return { success: false, error: `Record ${recordId} does not exist` };
  }

  if (existingRecord) {
    // UPDATE path
    const updates = { ...data };
    
    // Add system fields if provided
    if (status !== undefined) updates.status = status;
    if (error_message !== undefined) updates.error_message = error_message;
    
    // Add history entry for manual update
    const historyUpdate = {
      'history[+]': {
        action: 'manual_update',
        timestamp: new Date().toISOString(),
        sourceNode: 'record_management',
        reason,
        changes: Object.keys(updates)
      }
    };
    
    await this.variableManagementService.updateRecord(
      workflowId, 
      recordId, 
      { ...updates, ...historyUpdate },
      null
    );
    
    return {
      success: true,
      operation: 'updated',
      record_id: recordId,
      message: `Record ${recordId} updated successfully`,
      updates: Object.keys(updates),
      reason
    };
  } else {
    // CREATE path
    let structuredData = data;
    
    // Ensure proper data structure
    if (!data.fields && !data.vars && !data.targets) {
      structuredData = {
        fields: data,
        vars: {},
        targets: {},
        history: [{
          action: 'created_manually',
          timestamp: new Date().toISOString(),
          sourceNode: 'record_management',
          reason
        }]
      };
    } else {
      // Add creation history to existing structure
      if (!structuredData.history) {
        structuredData.history = [];
      }
      structuredData.history.push({
        action: 'created_manually',
        timestamp: new Date().toISOString(),
        sourceNode: 'record_management',
        reason
      });
    }
    
    await this.variableManagementService.createRecord(
      workflowId,
      recordId,
      actualRecordType,
      structuredData,
      iteration_node_alias
    );
    
    // Set status if provided
    if (status || error_message) {
      const statusUpdate = {};
      if (status) statusUpdate.status = status;
      if (error_message) statusUpdate.error_message = error_message;
      
      await this.variableManagementService.updateRecord(
        workflowId,
        recordId,
        statusUpdate,
        null
      );
    }
    
    return {
      success: true,
      operation: 'created',
      record_id: recordId,
      record_type: actualRecordType,
      message: `Record ${recordId} created successfully`,
      reason
    };
  }
}
```

#### Get Record

```javascript
async getRecord(workflowId, recordId, options = {}) {
  const { include_history = false, fields } = options;
  
  const record = await this.variableManagementService.getRecord(workflowId, recordId);
  
  if (!record) {
    return { 
      success: false, 
      error: `Record ${recordId} not found` 
    };
  }
  
  // Format record data
  let formattedRecord = {
    record_id: record.record_id,
    record_type: record.record_type,
    status: record.status,
    created_at: record.created_at,
    updated_at: record.updated_at,
    data: {
      fields: record.data.fields || {},
      vars: record.data.vars || {},
      targets: record.data.targets || {}
    }
  };
  
  // Include optional data
  if (include_history) {
    formattedRecord.data.history = record.data.history || [];
  }
  
  if (record.error_message) {
    formattedRecord.error_message = record.error_message;
  }
  
  // Filter specific fields if requested
  if (fields && fields.length > 0) {
    const filtered = { record_id: recordId };
    for (const field of fields) {
      const value = this.getNestedValue(formattedRecord, field);
      if (value !== undefined) {
        this.setNestedValue(filtered, field, value);
      }
    }
    formattedRecord = filtered;
  }
  
  return {
    success: true,
    record: formattedRecord
  };
}
```

#### Delete Record

```javascript
async deleteRecord(workflowId, recordId, reason) {
  const record = await this.variableManagementService.getRecord(workflowId, recordId);
  
  if (!record) {
    return { 
      success: false, 
      error: `Record ${recordId} not found` 
    };
  }
  
  await this.variableManagementService.deleteRecord(workflowId, recordId);
  
  return {
    success: true,
    operation: 'deleted',
    record_id: recordId,
    record_type: record.record_type,
    message: `Record ${recordId} deleted successfully`,
    reason
  };
}
```

#### Clear All Records

```javascript
async clearAllRecords(workflowId, pattern, reason) {
  const records = await this.variableManagementService.queryRecords(workflowId, pattern);
  
  if (!records || records.length === 0) {
    return {
      success: true,
      operation: 'clear_all',
      pattern,
      deleted_count: 0,
      message: `No records found matching pattern: ${pattern}`,
      reason
    };
  }
  
  const deletedRecords = [];
  const errors = [];
  
  for (const record of records) {
    try {
      await this.variableManagementService.deleteRecord(workflowId, record.record_id);
      deletedRecords.push(record.record_id);
    } catch (error) {
      errors.push({
        record_id: record.record_id,
        error: error.message
      });
    }
  }
  
  return {
    success: errors.length === 0,
    operation: 'clear_all',
    pattern,
    deleted_count: deletedRecords.length,
    deleted_records: deletedRecords,
    errors: errors.length > 0 ? errors : undefined,
    message: `Deleted ${deletedRecords.length} records matching pattern: ${pattern}`,
    reason
  };
}
```

#### Query Records

```javascript
async queryRecords(workflowId, pattern) {
  const records = await this.variableManagementService.queryRecords(
    workflowId, 
    pattern || '*'
  );
  
  const formattedRecords = records.map(record => ({
    record_id: record.record_id,
    record_type: record.record_type,
    status: record.status,
    created_at: record.created_at,
    fields_count: Object.keys(record.data.fields || {}).length,
    vars_count: Object.keys(record.data.vars || {}).length,
    has_error: !!record.error_message
  }));
  
  return {
    success: true,
    operation: 'query',
    pattern: pattern || '*',
    count: formattedRecords.length,
    records: formattedRecords
  };
}
```

### 5. Helper Methods

```javascript
// Helper to get nested values using dot notation
getNestedValue(obj, path) {
  return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
}

// Helper to set nested values using dot notation
setNestedValue(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  const target = parts.reduce((curr, prop) => {
    if (!curr[prop]) curr[prop] = {};
    return curr[prop];
  }, obj);
  target[last] = value;
}
```

## Usage Examples

### Creating Records

```javascript
// Simple record creation
record_management({
  operation: 'set',
  record_id: 'email_001',
  data: {
    subject: 'Test Email',
    sender: 'test@example.com',
    body: 'This is a test email'
  },
  reason: 'Setting up test data for email workflow'
})

// Create with specific status
record_management({
  operation: 'set',
  record_id: 'email_002',
  data: { subject: 'Failed Email' },
  options: {
    status: 'failed',
    error_message: 'Network timeout during processing'
  },
  reason: 'Testing error handling scenarios'
})

// Create with custom type
record_management({
  operation: 'set',
  record_id: 'custom_id_format',
  data: { name: 'Custom Record' },
  options: {
    record_type: 'special',
    mode: 'create'
  },
  reason: 'Testing custom record types'
})
```

### Updating Records

```javascript
// Update specific field using dot notation
record_management({
  operation: 'set',
  record_id: 'email_001',
  data: { 'vars.classification': 'spam' },
  options: { mode: 'update' },
  reason: 'Testing classification update'
})

// Update multiple fields
record_management({
  operation: 'set',
  record_id: 'email_001',
  data: {
    'vars.priority': 'high',
    'vars.processed': true,
    'fields.tags': ['urgent', 'customer']
  },
  options: { mode: 'update' },
  reason: 'Marking email as high priority'
})

// Update status
record_management({
  operation: 'set',
  record_id: 'email_001',
  data: {},
  options: {
    mode: 'update',
    status: 'complete'
  },
  reason: 'Marking record as complete'
})
```

### Querying Records

```javascript
// Get specific record
record_management({
  operation: 'get',
  record_id: 'email_001'
})

// Get record with history
record_management({
  operation: 'get',
  record_id: 'email_001',
  options: { include_history: true }
})

// Get specific fields only
record_management({
  operation: 'get',
  record_id: 'email_001',
  options: { 
    fields: ['fields.subject', 'vars.classification', 'status'] 
  }
})

// Query all email records
record_management({
  operation: 'query',
  pattern: 'email_*'
})

// Query all records
record_management({
  operation: 'query'
})
```

### Deleting Records

```javascript
// Delete specific record
record_management({
  operation: 'delete',
  record_id: 'email_001',
  reason: 'Cleaning up test data'
})

// Clear all test records
record_management({
  operation: 'clear_all',
  pattern: 'test_*',
  reason: 'Resetting test environment'
})

// Clear all email records
record_management({
  operation: 'clear_all',
  pattern: 'email_*',
  reason: 'Starting fresh email processing test'
})
```

## Key Design Decisions

### 1. Consolidated vs Separate Tools

**Decision**: Single consolidated `record_management` tool

**Rationale**:
- Reduces tool sprawl (would need 5-6 separate tools otherwise)
- Consistent with `get_workflow_data` pattern of unified access
- All record operations are logically related
- Easier to discover and learn one tool vs many

**Trade-offs**:
- ✅ Cleaner tool list
- ✅ Single pattern to learn
- ✅ Extensible for future operations
- ❌ Slightly less discoverable than dedicated tools
- ❌ More complex parameter validation

### 2. Data Structure Flexibility

**Decision**: Auto-wrap simple data in proper record structure

**Rationale**:
- Simplifies testing and quick record creation
- Matches how nodes create records (they provide raw data)
- Users shouldn't need to know internal structure for basic usage

**Implementation**:
- If data lacks `fields/vars/targets`, wrap in `fields`
- Always maintain proper structure internally
- Add appropriate history entries

### 3. Update Patterns

**Decision**: Support both dot notation and full object updates

**Rationale**:
- Dot notation enables surgical updates: `{"vars.classification": "spam"}`
- Full object updates for complete replacement
- Consistent with existing `updateRecord` capabilities

**Examples**:
```javascript
// Dot notation (surgical update)
data: { "vars.priority": "high" }

// Full structure (complete replacement)
data: { 
  fields: { subject: "Updated" },
  vars: { priority: "high" }
}
```

### 4. Operation Modes

**Decision**: Explicit `mode` parameter with sensible defaults

**Rationale**:
- `upsert` as default matches most testing scenarios
- Explicit modes prevent accidental overwrites
- Clear intent in audit trail

**Options**:
- `create`: Fail if exists (safety)
- `update`: Fail if not exists (safety)
- `upsert`: Create or update (convenience)

### 5. History Tracking

**Decision**: Automatically add history entries for manual operations

**Rationale**:
- Maintains audit trail for all record changes
- Distinguishes manual operations from node-created data
- Useful for debugging workflow issues

**Implementation**:
- Add `created_manually` or `manual_update` actions
- Include timestamp, reason, and changed fields
- Preserve existing history on updates

## Testing Plan

1. **Unit Tests**:
   - Test each operation independently
   - Validate parameter validation
   - Test error conditions

2. **Integration Tests**:
   - Create records and verify with `get_workflow_data`
   - Test iteration over manually created records
   - Verify `store_to_record` works with manual records
   - Test `get_all_records()` template function

3. **Edge Cases**:
   - Invalid record IDs
   - Missing required fields
   - Malformed data structures
   - Pattern matching edge cases
   - Concurrent operations

## Migration & Compatibility

- No breaking changes to existing functionality
- Records created via this tool are identical to node-created records
- Full compatibility with existing record operations
- No database schema changes required

## Future Enhancements

1. **Batch Operations**:
   ```javascript
   record_management({
     operation: 'batch_set',
     records: [
       { record_id: 'email_001', data: {...} },
       { record_id: 'email_002', data: {...} }
     ],
     reason: 'Bulk test data creation'
   })
   ```

2. **Import/Export**:
   ```javascript
   record_management({
     operation: 'export',
     pattern: 'email_*',
     format: 'json'
   })
   ```

3. **Template Support**:
   ```javascript
   record_management({
     operation: 'create_from_template',
     template: 'email_template',
     count: 10,
     reason: 'Generate test emails'
   })
   ```

## Conclusion

The `record_management` tool provides a comprehensive solution for record manipulation in the Director system. By consolidating all record operations into a single tool, we maintain a clean API surface while providing powerful capabilities for testing and debugging workflows that use the record system.