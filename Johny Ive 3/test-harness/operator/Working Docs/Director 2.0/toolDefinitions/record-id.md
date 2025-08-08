# Record-Centric Iteration Model

## 1. The Problem

### Current Iteration Confusion

The current iteration system creates significant cognitive overhead and technical confusion:

#### A. **Index Arithmetic Doesn't Work**
```javascript
// What seems intuitive but fails:
selector: "tr:nth-child({{emailIndex + 1}})"  // ❌ No arithmetic support

// Current workaround is non-obvious:
selector: "tr", nth: "{{emailIndex}}"  // Requires discovering 'nth' parameter
```

#### B. **Scattered Variable Management**
During iteration, variables proliferate without clear ownership:
```javascript
// Which email does this belong to?
emailContent: "Dear investor..."
emailClassification: "investor"
airtableId: "rec123"

// Mental mapping required:
// "Oh right, this is for index 3, which was... which email again?"
```

#### C. **Lost Context Between Nodes**
Each node in an iteration operates in isolation:
- Extract email → stores in global variable
- Classify email → which email are we classifying?
- Update Airtable → which record are we updating?

#### D. **No Persistent Identity**
Items being iterated are ephemeral:
- Can't track what happened to specific items
- Can't debug individual record processing
- Can't resume failed iterations

## 2. The Thought Process

### The Two-Phase Nature of Iteration

Through our discussion, we identified that iteration has two distinct phases:

1. **Discovery Phase**: "What are my records?"
   - External input: HR provides 5 employee names
   - Dynamic discovery: Find 14 emails from June 2nd

2. **Processing Phase**: "What do I do with each record?"
   - Click the email
   - Extract content
   - Classify it
   - Update Airtable

### The Key Insight

**Each iteration item should be a persistent entity with its own namespace**, not a temporary variable. This matches how we naturally think:

- "Process these 5 emails" → 5 distinct email records
- "Onboard these 3 employees" → 3 distinct employee records
- Each record accumulates data as it flows through the workflow

## 3. The Solution: Record-Centric Model

### Core Concept

Every iterable item becomes a **record** with:
- A unique, persistent ID
- Its own variable namespace
- Progressive data accumulation
- Complete processing history

### How It Works

#### A. **Record Creation**
```javascript
{
  alias: "discover_emails",
  type: "browser_query",
  config: {
    create_records: true,  // Enable record creation
    record_type: "email",  // Type prefix for IDs
    extract: {
      selector: "tr.email",
      fields: {
        subject: ".subject-line",
        sender: ".sender",
        _element: "@element"  // Preserved element reference
      }
    }
  }
}

// Creates records:
// email_001: {subject: "Investment", sender: "vc@fund.com", _element: <ref>}
// email_002: {subject: "Update", sender: "team@co.com", _element: <ref>}
// email_003: {subject: "Invoice", sender: "billing@saas.com", _element: <ref>}
```

#### B. **Record-Aware Iteration**
```javascript
{
  alias: "process_emails",
  type: "iterate",
  config: {
    over_records: "email_*",  // Iterate over all email records
    as: "current",  // Reference name in iteration
    body: [10, 11, 12]
  }
}
```

#### C. **Progressive Data Accumulation**
Inside the iteration, each node adds data to the current record:

```javascript
// Node 10: Click email
{
  type: "browser_action",
  action: "click",
  target: "{{current._element}}"  // Use preserved element
}

// Node 11: Extract content
{
  type: "browser_ai_extract",
  config: {
    instruction: "Extract email body",
    store_to_record: true,  // Auto-stores to current record
    as: "content"
  }
}

// Node 12: Classify
{
  type: "cognition",
  config: {
    instruction: "Is this investor-related?",
    input: "{{current.content}}",
    store_to_record: true,
    as: "classification"
  }
}
```

#### D. **Record State Evolution**
After processing, each record contains its complete history:

```javascript
email_001: {
  // Initial discovery data
  subject: "Investment Opportunity",
  sender: "vc@sequoia.com",
  _element: <element_ref>,
  
  // Added during processing
  content: "We'd like to invest $2M in your Series A...",
  classification: "investor",
  airtableId: "rec123ABC",
  processed_at: "2024-01-15T10:30:00Z",
  processing_status: "complete"
}
```

### Benefits

1. **Clear Mental Model**: One email = one record = one namespace
2. **No Variable Confusion**: `{{current.content}}` always refers to the current record
3. **Complete Audit Trail**: Each record tracks its entire journey
4. **Resumable Processing**: Can retry failed records
5. **Natural Debugging**: "Show me what happened to email_003"

## 4. Implementation Thoughts

### A. **Database Schema**

```sql
-- New table for persistent records
CREATE TABLE workflow_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES workflows(id),
  record_id VARCHAR(255) NOT NULL,  -- e.g., "email_001"
  record_type VARCHAR(50) NOT NULL,  -- e.g., "email"
  iteration_node_alias VARCHAR(255),  -- Which iterate node created this
  
  -- Record data
  data JSONB NOT NULL DEFAULT '{}',
  
  -- Processing metadata
  status VARCHAR(50) DEFAULT 'discovered',  -- discovered, processing, complete, failed
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  
  -- Unique constraint
  UNIQUE(workflow_id, record_id)
);

-- Index for efficient querying
CREATE INDEX idx_workflow_records_type ON workflow_records(workflow_id, record_type);
CREATE INDEX idx_workflow_records_status ON workflow_records(workflow_id, status);
```

### B. **Variable System Extension**

Extend the variable resolver to understand record references:

```javascript
// Current variable resolution
resolveVariable("{{email}}") → looks in workflow_memory

// New record-aware resolution
resolveVariable("{{current.content}}") → {
  1. Check if in iteration context
  2. Get current record_id from context
  3. Load record from workflow_records
  4. Return record.data.content
}
```

### C. **Node Execution Changes**

```javascript
// In nodeExecutor.js
async executeInIteration(node, recordId, workflowId) {
  // Set up record context
  const record = await this.loadRecord(workflowId, recordId);
  this.currentRecord = record;
  
  // Execute node
  const result = await this.execute(node);
  
  // If node has store_to_record flag, update record
  if (node.config.store_to_record && result) {
    const fieldName = node.config.as || node.alias;
    await this.updateRecord(recordId, { [fieldName]: result });
  }
  
  // Clear context
  this.currentRecord = null;
}
```

### D. **Iterate Node Enhancement**

```javascript
// In iterate node execution
async executeIterate(config) {
  let records;
  
  if (config.over_records) {
    // New record-based iteration
    records = await this.getRecords(config.over_records);
  } else if (config.over) {
    // Legacy array iteration (backwards compatible)
    const array = await this.resolveVariable(config.over);
    // Convert to temporary records for consistency
    records = array.map((item, i) => ({
      record_id: `temp_${i}`,
      data: { value: item }
    }));
  }
  
  // Process each record
  for (const record of records) {
    await this.processRecord(record, config.body);
  }
}
```

### E. **Tool Definition Updates**

Add record-aware flags to relevant node types:

```javascript
// browser_query enhancement
{
  type: 'browser_query',
  config: {
    create_records: {
      type: 'boolean',
      description: 'Create persistent records from extracted data'
    },
    record_type: {
      type: 'string',
      description: 'Type prefix for created records (e.g., "email", "employee")'
    }
  }
}

// All data-producing nodes get this option
{
  store_to_record: {
    type: 'boolean',
    description: 'Store result to current iteration record (only works inside iterate)'
  },
  as: {
    type: 'string', 
    description: 'Field name in record (defaults to node alias)'
  }
}
```

### F. **Migration Strategy**

1. **Phase 1**: Add record system alongside existing variables
   - New workflows can use records
   - Old workflows continue working

2. **Phase 2**: Automatic record creation for iterations
   - Even legacy iterations create temporary records
   - Gradual migration of existing workflows

3. **Phase 3**: Records become the default
   - Deprecate scattered variable approach
   - Migration tools for old workflows

### G. **UI/UX Enhancements**

Show record state in the UI:

```
🔄 Iteration 3 of 10: email_003
┌─ Record State ──────────────────┐
│ subject: "Team Update"          │
│ sender: "cto@startup.com"       │
│ content: "Weekly eng update..." │
│ classification: "internal" ✓     │
│ airtableId: [pending]           │
└─────────────────────────────────┘
```

## Conclusion

The record-centric model transforms iterations from a mechanical index-counting exercise into a natural data transformation pipeline. Each record tells its own story, accumulates its own state, and maintains its own identity throughout the workflow.

This aligns perfectly with how humans think about batch processing: "I have these 10 emails, and I need to process each one" rather than "I need to iterate with index 0 through 9 and manage variables carefully."