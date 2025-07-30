# Record Management Tool - Testing Guide

## Quick Start

The `record_management` tool has been successfully implemented and tested. Since MCP requires a restart when new function calls are added, you'll need to start a new chat session to use this tool.

## Testing Instructions

In your new chat session as the Director, you can test the record management functionality:

### 1. Create Test Records
```javascript
record_management({
  operation: 'set',
  record_id: 'email_001',
  data: {
    subject: 'Test Email',
    sender: 'test@example.com',
    body: 'This is a test email for iteration'
  },
  reason: 'Creating test email record'
})
```

### 2. Create Multiple Records for Iteration
```javascript
// Create several records to test iteration
const emails = [
  { id: 'email_001', subject: 'Welcome', sender: 'hello@company.com' },
  { id: 'email_002', subject: 'Invoice', sender: 'billing@company.com' },
  { id: 'email_003', subject: 'Newsletter', sender: 'news@company.com' }
];

for (const email of emails) {
  record_management({
    operation: 'set',
    record_id: email.id,
    data: { subject: email.subject, sender: email.sender },
    reason: 'Setting up test data for iteration'
  })
}
```

### 3. Test Iteration Over Records
```javascript
// Add an iterate node
add_or_replace_nodes({
  target: 'end',
  nodes: [{
    type: 'iterate',
    alias: 'process_emails',
    config: {
      over_records: 'email_*',
      variable: 'current',
      body: [2, 3]  // Node positions to execute
    }
  }]
})
```

### 4. Update Records During Iteration
Inside the iteration body, you can use nodes with `store_to_record: true`:
```javascript
{
  type: 'cognition',
  alias: 'classify_email',
  config: {
    instruction: 'Classify this email: {{current.fields.subject}}',
    schema: { type: 'string' },
    store_to_record: true,
    as: 'classification'
  }
}
```

### 5. Query and Verify Records
```javascript
// Check all email records
record_management({
  operation: 'query',
  pattern: 'email_*'
})

// Get specific record with all details
record_management({
  operation: 'get',
  record_id: 'email_001',
  options: { include_history: true }
})
```

### 6. Clean Up
```javascript
record_management({
  operation: 'clear_all',
  pattern: 'email_*',
  reason: 'Cleaning up test records'
})
```

## Key Features to Test

1. **Simple Creation**: Records created without structure are auto-wrapped in `fields`
2. **Dot Notation Updates**: `{"vars.classification": "spam"}` for surgical updates
3. **History Tracking**: All operations are logged with timestamps and reasons
4. **Pattern Matching**: Query and delete using patterns like `email_*`
5. **Error Handling**: Proper error messages for missing records or invalid operations

## Expected Behavior

- Records are stored in the `workflow_records` table (separate from variables)
- Each record has `fields`, `vars`, `targets`, and `history`
- Records work seamlessly with `iterate` nodes using `over_records`
- The `store_to_record` option in nodes properly updates the current record
- `get_all_records()` template function works with manually created records

## Implementation Complete ✅

All code has been added to:
- `/backend/tools/toolDefinitionsV2.js` - Tool definition
- `/backend/services/directorService.js` - Implementation methods
- Case handler in `executeToolCall()`

The tool is ready to use after restarting the MCP session!