# Record System Design Decisions

## The Director's Journey

Let's walk through a typical workflow creation process from the Director's perspective:

### Scenario: Gmail to Airtable Workflow

"I need to process investor emails from June 2nd and update our CRM"

## Key Design Decisions

### 1. Schema Definition: Upfront vs Progressive

#### Option A: Upfront Schema Declaration
```javascript
// Director defines schema at the beginning
{
  alias: "define_email_schema",
  type: "record_schema",
  config: {
    type: "email",
    fields: {
      subject: { type: "string", required: true },
      sender: { type: "string", required: true },
      content: { type: "string" },
      classification: { type: "string", enum: ["investor", "customer", "internal", "other"] },
      airtableId: { type: "string" },
      processedAt: { type: "timestamp" }
    }
  }
}
```

**Pros:**
- Clear contract from the start
- Type safety and validation
- Better error messages ("missing required field: subject")
- Easier debugging (know what to expect)

**Cons:**
- Requires upfront planning
- Less flexible for exploratory workflows
- Might define fields that aren't used
- Cognitive overhead before starting

#### Option B: Progressive Field Addition
```javascript
// Fields are added as workflow progresses
{
  alias: "extract_emails",
  type: "browser_query",
  config: {
    create_records: "email",  // Just specify type
    // Schema emerges from extraction
  }
}
```

**Pros:**
- Natural, exploratory workflow building
- No upfront cognitive load
- Flexible - add fields as needed
- Matches Director's iterative process

**Cons:**
- No type safety
- Harder to debug ("what fields does this record have?")
- Potential field name conflicts
- Less predictable

#### **Recommendation: Hybrid Approach**
```javascript
// Optional schema with progressive enhancement
{
  alias: "setup_email_records",
  type: "record_config",
  config: {
    type: "email",
    initial_schema: {  // Optional starting point
      subject: "string",
      sender: "string"
    },
    allow_additional_fields: true  // Default: true
  }
}
```

### 2. Record Creation Timing

#### Option A: Explicit Record Creation
```javascript
// Step 1: Create empty records
{
  alias: "create_email_records",
  type: "create_records",
  config: {
    type: "email",
    count: "{{email_count}}"
  }
}

// Step 2: Populate them
{
  alias: "populate_records",
  type: "browser_query",
  config: {
    populate_records: "email_*"
  }
}
```

#### Option B: Implicit During Extraction
```javascript
// Records created automatically when extracting
{
  alias: "extract_emails",
  type: "browser_query",
  config: {
    create_records: "email",  // Creates on the fly
    extract: {...}
  }
}
```

#### Option C: On-Demand During Iteration
```javascript
// Records created when iteration starts
{
  alias: "process_items",
  type: "iterate",
  config: {
    over: "{{extracted_data}}",
    create_records: "email"  // Convert to records here
  }
}
```

#### **Recommendation: Context-Dependent**
- **Extraction scenarios**: Create during extraction (Option B)
- **External input**: Create explicitly (Option A)
- **Legacy compatibility**: Create during iteration (Option C)

### 3. Record Naming and Identity

#### Option A: Auto-Generated Sequential
```
email_001, email_002, email_003...
```

#### Option B: Content-Based
```
email_john_doe_2024_01_15
email_investor_sequoia
```

#### Option C: UUID-Based
```
email_f47ac10b-58cc-4372-a567-0e02b2c3d479
```

#### Option D: User-Defined Pattern
```javascript
{
  record_id_pattern: "email_{{sender}}_{{date}}"
}
```

#### **Recommendation: Smart Defaults with Override**
```javascript
{
  create_records: "email",  // Default: email_001, email_002
  // OR
  create_records: {
    type: "email",
    id_from: "{{sender}}_{{subject_slug}}"  // Custom pattern
  }
}
```

### 4. Variable Access Patterns

#### Inside Iteration Context
```javascript
// How to reference current record?

// Option A: Implicit "current"
"{{current.subject}}"
"{{current.sender}}"

// Option B: Named by iterator
"{{email.subject}}"  // If iterator variable is "email"

// Option C: Explicit record reference
"{{record.email_001.subject}}"
```

#### Outside Iteration Context
```javascript
// How to reference specific records?

// Option A: Direct access
"{{records.email_001.subject}}"

// Option B: Query syntax
"{{records.where(type='email', classification='investor').first()}}"

// Option C: Array index
"{{email_records[0].subject}}"
```

#### **Recommendation: Context-Aware Resolution**
- Inside iteration: `{{current.field}}` or `{{iteratorName.field}}`
- Outside iteration: `{{records.email_001.field}}` or query helpers

### 5. Record Persistence and Lifecycle

#### When are records saved?
- After each field update?
- At end of iteration?
- At checkpoints?

#### When are records cleared?
- Never (permanent storage)?
- On workflow completion?
- On explicit clear?

#### **Recommendation: Progressive Persistence**
```javascript
// Save after each node that modifies record
// But batch within tight loops for performance
// Provide explicit lifecycle controls

{
  type: "record_lifecycle",
  config: {
    action: "clear",  // clear, archive, export
    records: "email_*",
    after: "workflow_complete"
  }
}
```

### 6. UI/UX Considerations

#### Record Visibility
```
Current Workflow Records:
┌─────────────────────────────────────┐
│ 📧 email_001 (complete)             │
│   • subject: "Investment Interest"   │
│   • classification: "investor" ✓     │
│   • airtableId: "rec123" ✓         │
│                                     │
│ 📧 email_002 (processing)           │
│   • subject: "Team Update"          │
│   • classification: [pending]       │
│                                     │
│ 📧 email_003 (queued)              │
│   • subject: "Invoice #1234"        │
└─────────────────────────────────────┘
```

#### Interactive Record Inspector
- Click record to see full state
- Edit record values for testing
- Replay workflow from specific record

### 7. Error Handling and Recovery

#### Failed Record Processing
```javascript
// Option A: Fail entire iteration
// Option B: Mark record as failed, continue
// Option C: Retry logic

{
  type: "iterate",
  config: {
    over_records: "email_*",
    on_error: "mark_failed_continue",  // or "stop", "retry"
    max_retries: 3
  }
}
```

#### **Recommendation: Flexible Error Strategies**
Default to "mark_failed_continue" with optional retry logic

### 8. Backwards Compatibility

#### Supporting Legacy Workflows
```javascript
// Automatic conversion layer
if (node.type === "iterate" && !node.config.over_records) {
  // Convert array iteration to temporary records
  const tempRecords = createTempRecords(node.config.over);
  node.config.over_records = tempRecords;
}
```

## Design Principles

### 1. **Progressive Disclosure**
- Simple workflows stay simple
- Advanced features available when needed
- Smart defaults for common patterns

### 2. **Intuitive Mental Model**
- Records = persistent entities with identity
- Fields = properties that accumulate over time
- Iteration = processing each record through steps

### 3. **Fail Gracefully**
- Clear error messages
- Partial progress is preserved
- Can resume from failure point

### 4. **Debugging First**
- Every record has a story
- Can inspect state at any point
- Clear audit trail

## Recommended Implementation Phases

### Phase 1: Core Record System
- Basic record creation during extraction
- Simple field addition
- Current record access in iteration

### Phase 2: Enhanced Features
- Schema validation
- Custom ID patterns
- Query syntax for records

### Phase 3: Advanced Workflows
- Record relationships
- Nested records
- Cross-workflow record sharing

## Example: Complete Gmail Workflow

Here's how the Director would build the workflow with our recommended approach:

```javascript
// 1. Extract emails (records created implicitly)
{
  alias: "find_june_emails",
  type: "browser_query",
  config: {
    create_records: "email",  // Simple case
    selector: "tr.email",
    filter: "date = June 2",
    extract: {
      subject: ".subject",
      sender: ".sender",
      _element: "@element"
    }
  }
}

// 2. Process each email
{
  alias: "process_emails",
  type: "iterate",
  config: {
    over_records: "email_*",
    as: "email",  // Natural name
    on_error: "continue",  // Don't stop for one bad email
    body: [
      {
        alias: "open_email",
        type: "browser_action",
        action: "click",
        target: "{{email._element}}"  // Natural reference
      },
      {
        alias: "extract_content",
        type: "browser_ai_extract",
        instruction: "Extract email body",
        store_to_record: true,  // Automatic storage
        as: "content"
      },
      {
        alias: "classify",
        type: "cognition",
        instruction: "Classify as investor/customer/internal/other",
        input: "{{email.content}}",  // Clear data flow
        store_to_record: true,
        as: "classification"
      },
      {
        alias: "update_crm",
        type: "route",
        condition: "{{email.classification}} == 'investor'",
        true_branch: [
          {
            alias: "add_to_airtable",
            type: "airtable_create",
            store_to_record: true,
            as: "airtableId"
          }
        ]
      }
    ]
  }
}

// 3. Summary (optional)
{
  alias: "summarize",
  type: "cognition",
  instruction: "Summarize processing results",
  input: "{{records.email_*}}"  // Access all records
}
```

This feels natural, progressive, and maintains clear data flow throughout.