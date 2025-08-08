# Unified Variable & Record System Design - Director 2.0

## Executive Summary

This document captures the comprehensive design decisions for unifying the variable and record systems in Director 2.0. After extensive analysis of the current implementation challenges and user experience friction, we've designed a system that provides consistent data access patterns while maintaining clear provenance and enabling intuitive workflows.

## Background & Problem Statement

### Current State Issues

1. **Records Not Working**: The `create_records` functionality exists but fails due to unresolved template variables in `node.config`
2. **Inconsistent Access Patterns**: Different syntax for variables (`{{name}}`), node results (`{{alias.property}}`), and records (`{{record.field}}`)
3. **Mental Model Confusion**: Directors must remember where data is stored to know how to access it
4. **Storage Sprawl**: `store_variable: true` dumps entire node results, creating clutter

### Core Insight

The Director's fundamental need is simple: "Give me the data I stored earlier." They shouldn't need to understand the underlying storage mechanism or remember different access patterns for different data types.

## Locked Design Decisions

### 1. Two-Bucket Data Model with Consistent Namespacing

**Decision**: Maintain separate `global` and `records` buckets, but with parallel structure.

**Structure**:
```javascript
{
  global: {
    // Direct variables (no namespace)
    apiKey: "sk-123",
    emailCount: 45,
    
    // Node results (always namespaced by alias)
    extract_emails: {
      count: 45,
      emails: [...]
    },
    classify_summary: {
      total_investor: 7,
      total_other: 7
    }
  },
  
  records: {
    email_001: {
      // ALL data namespaced by source node (parallel to global pattern)
      extract_emails: {
        subject: "Investment Opportunity",
        sender: "vc@fund.com",
        thread_id: ":g8"
      },
      classify_email: {
        type: "investor",
        confidence: 0.95
      }
    }
  }
}
```

**Why**: 
- Records and variables serve fundamentally different purposes (entities vs state)
- Parallel structure makes the mental model consistent
- Node namespacing provides clear data provenance

### 2. Intentional Storage Pattern

**Decision**: Replace automatic `store_variable: true` with explicit storage configuration.

**Implementation**:
```javascript
// Instead of store_variable: true (stores everything)
{
  alias: "extract_emails",
  config: {
    store: {
      "count": "count",           // → {{extract_emails.count}}
      "items": "emails"           // → {{extract_emails.emails}}
      // execution_time NOT stored (we don't need it)
    }
  }
}

// For records
{
  alias: "extract_emails",
  config: {
    create_records: "email",
    store: {
      "subject": "subject",       // → {{email_001.extract_emails.subject}}
      "sender": "sender",         // → {{email_001.extract_emails.sender}}
      "thread_id": "thread"       // → {{email_001.extract_emails.thread}}
    }
  }
}
```

**Why**:
- Eliminates variable clutter (no more `{{extract_emails._meta}}`)
- Self-documenting (clear what data is important)
- Handles nested data elegantly
- Forces conscious decisions about data retention

### 3. Unified Access Syntax

**Decision**: Consistent dot notation across all data types.

**Patterns**:
```javascript
// Global direct variables
{{apiKey}}                              // → global.apiKey

// Global node results  
{{extract_emails.count}}                // → global.extract_emails.count
{{classify_summary.total}}              // → global.classify_summary.total

// Record data (ALWAYS includes source node)
{{email_001.extract_emails.subject}}    // → records.email_001.extract_emails.subject
{{email_001.classify_email.type}}       // → records.email_001.classify_email.type

// Iteration context
{{current.extract_emails.subject}}      // → current record's data
{{current.classify_email.type}}         // → current record's data
```

**Why**:
- Single mental model: "data is data, access it with dots"
- Predictable patterns reduce cognitive load
- Maintains provenance (always know where data came from)

### 4. Node Namespacing for All Record Data

**Decision**: Even initial extraction data is namespaced by the creating node.

**Example**:
```javascript
// NOT this (special treatment for initial data):
email_001: {
  subject: "Investment",      // Where did this come from?
  sender: "vc@fund.com",
  classify_email: {
    type: "investor"
  }
}

// But this (consistent namespacing):
email_001: {
  extract_emails: {           // Initial extraction node
    subject: "Investment",
    sender: "vc@fund.com"
  },
  classify_email: {           // Classification node
    type: "investor"
  }
}
```

**Why**:
- Complete consistency (no special cases)
- Clear data lineage
- Supports multiple nodes writing similar fields without collision

### 5. Smart Resolution Algorithm

**Decision**: Single resolver with clear precedence order.

**Algorithm**:
```javascript
resolveTemplate(path, context) {
  // 1. Iteration context (highest priority)
  if (path.startsWith('current.') && context.inIteration) {
    return resolveFromRecord(context.currentRecordId, path.substring(8));
  }
  
  // 2. Record pattern (record_id.path)
  if (path.match(/^[a-z]+_\d{3}\./)) {
    const [recordId, ...rest] = path.split('.');
    return resolveFromRecord(recordId, rest.join('.'));
  }
  
  // 3. Global node namespace (alias.property)
  if (path.includes('.')) {
    return resolveFromGlobal(path);
  }
  
  // 4. Global direct (simple names)
  return resolveFromGlobal(path);
}
```

**Why**:
- Predictable resolution order
- Handles common cases efficiently
- Supports explicit paths when needed

### 6. Developer Experience Features

**Decision**: Proactive guidance without being intrusive.

**Features**:
1. **Post-Creation Hints**:
   ```
   ✅ Node created: extract_emails
   
   Stored variables:
   • {{extract_emails.count}} - Total emails found
   • {{extract_emails.emails}} - Email array
   
   Records created: email_001 through email_045
   • {{email_001.extract_emails.subject}}
   • In iteration: {{current.extract_emails.subject}}
   ```

2. **Autocomplete with Context**
3. **Validation Warnings**
4. **Live Variable Inspector**

**Why**:
- Reduces errors through immediate feedback
- Accelerates learning of patterns
- Builds confidence in variable naming

### 7. Record Structure Standard

**Decision**: Consistent internal structure with clear sections.

**Structure**:
```javascript
{
  // Identity
  record_id: "email_001",
  record_type: "email",
  workflow_id: "uuid",
  
  // Data organized by source node
  data: {
    extract_emails: {        // Initial extraction
      subject: "...",
      sender: "..."
    },
    classify_email: {        // Added during iteration
      type: "investor",
      confidence: 0.95
    }
  },
  
  // Metadata
  status: "completed",
  created_at: "2024-01-20T10:00:00Z",
  processed_at: "2024-01-20T10:05:00Z"
}
```

**Why**:
- Clear separation of identity, data, and metadata
- Node namespacing within data prevents collisions
- Supports progressive data accumulation

### 8. Backwards Compatibility Strategy

**Decision**: Support old patterns with deprecation warnings.

**Implementation**:
- `store_variable: true` → treated as `store: {"*": "*"}`
- Old access patterns continue working with warnings
- Migration tools provided

**Why**:
- Prevents breaking existing workflows
- Allows gradual migration
- Maintains user trust

## Implementation Context

### The Bug That Started It All

The investigation revealed that `create_records` fails because:
1. `node.params` gets template variable resolution
2. `node.config` does NOT get resolution
3. `create_records` lives in config, so `{{thread_id}}` stays literal

This led to a deeper examination of the entire variable system.

### Key Technical Insights

1. **Variable Management Service** already supports records (in `workflow_records` table)
2. **NodeExecutor** has the infrastructure but missing config resolution
3. **Frontend** has no record visualization currently
4. **MCP Tools** only expose variables, not records

## Resolved Design Decisions

### 9. Storage Architecture
**Decision**: Keep separate tables with unified backend service
- Records stay in `workflow_records` table (already implemented)
- Variables stay in `workflow_memory` table
- Single service handles both with consistent interface
- No parallel/duplicate code paths to maintain

**Why**: Separation allows different lifecycle management and indexing strategies while maintaining code simplicity.

### 10. Frontend Display
**Decision**: Single "Data" panel with collapsible buckets
- Global bucket (expandable/collapsible) for variables
- One bucket per record (expandable/collapsible)
- Real-time updates via SSE (already implemented)
- No timeline or search needed initially

**Why**: Simple, clear visual hierarchy that matches the mental model of buckets.

### 11. Director Tools & Access
**Decision**: Enhanced unified `get_workflow_data` tool with flexible querying

**Query modes**:
- `bucket: "global"` - Show all global variables
- `bucket: "record_id"` - Show specific record (e.g., "email_001")
- `bucket: "all"` - Show everything
- `pattern: "email_*"` - Pattern matching for records
- `query: {type: "email", status: "failed"}` - Advanced filtering

**Output format**: Simple indented with smart truncation
```
Global:
  apiKey: "sk-123..."
  extract_emails:
    count: 45
    items: [...45 items]

Records (3 total):
  email_001:
    extract_emails:
      subject: "Investment Opportunity"
      sender: "vc@fund.com"
  [... 2 more records]
```

**Why**: Token-efficient, easily scannable, natural for LLMs to parse and reference.

### 12. Director System Prompt Update
**TODO**: Add comprehensive section about records as the fundamental working unit
- Records are the NEW WORKING UNIT - fundamental concept
- These are all units to be processed, whether in routes, partitions, or iterations
- Record is the CONTRACT for processing
- Must be crucial part of WORKFLOW DESCRIPTION and initial discovery
- Capture philosophy from record-id.md about persistent identity and progressive accumulation
- Mental model shift: from "iterate over array indices" to "process distinct records"

### 13. Route Node Enhancement - Collection Mode
**Decision**: Extend route node instead of creating separate partition node

**Current route node** (single context):
```javascript
{
  type: "route",
  config: [
    {
      name: "is_investor",
      condition: "{{email.classification}} === 'investor'",
      branch: [10, 11, 12]  // Process this one item
    }
  ]
}
```

**Enhanced route node** (collection mode):
```javascript
{
  type: "route", 
  config: {
    mode: "collection",     // New mode for batch routing
    over: "email_*",        // Which records to route
    routes: [
      {
        name: "investor_emails",
        condition: "{{record.classify_email.type}} === 'investor'",
        branch: [10, 11, 12]  // Process ALL matching records as a batch
      },
      {
        name: "customer_emails",
        condition: "{{record.classify_email.type}} === 'customer'", 
        branch: [20, 21, 22]  // Different processing path
      },
      {
        name: "other_emails",
        condition: "true",  // Default catch-all
        branch: [30, 31]
      }
    ]
  }
}
```

**Key differences**:
- **Single mode**: "Is THIS record X? → Do Y"
- **Collection mode**: "Which records are X? → Do Y with all of them"

**Benefits**:
- No new node type to learn
- Natural extension of existing mental model
- Reuses existing route infrastructure
- Enables powerful batch processing patterns

**Implementation notes**:
- In collection mode, downstream nodes receive array of matching record IDs
- Could reference as `{{route.investor_emails}}` → ["email_001", "email_007", ...]
- Iterate nodes can then process each partition

**Why**: Simpler mental model, fewer concepts, natural evolution of existing functionality.

## Open Questions & Outstanding Design Decisions

### 1. Backend Architecture Details
- Caching strategy for frequently accessed records?
- Transaction boundaries for record updates?

### 2. Workflow Builder UI
- How to show available variables/records in node configuration UI?
- Visual indicators for data flow between nodes?
- Debugging view for data transformations?

### 3. Performance Optimization
- Lazy loading for large record sets?
- Memory limits for workflow execution?

### 4. Advanced Features (Future)
- Record relationships/linking?
- Cross-workflow record sharing?
- Record versioning beyond current history array?

### 5. Migration Path
- Automatic migration tool design?
- How to handle workflows mid-execution during upgrade?
- Rollback strategy if issues discovered?

## Next Steps

1. **Immediate**: Fix the config resolution bug to unblock record creation
2. **Week 1**: Implement intentional storage pattern
3. **Week 2**: Build unified resolver
4. **Week 3**: Frontend integration design
5. **Week 4**: Tool updates and documentation

## Conclusion

This design creates a consistent, intuitive system for data management in Director 2.0. By maintaining clear provenance while simplifying access patterns, we enable Directors to focus on building workflows rather than managing data storage mechanics.

The key innovation is recognizing that while records and variables serve different purposes, they can share the same access patterns and mental models, making the system both powerful and approachable.