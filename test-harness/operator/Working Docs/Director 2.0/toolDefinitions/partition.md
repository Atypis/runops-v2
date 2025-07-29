# Partition Node: Collection-Level Routing

## Overview

The `partition` node is a collection transformation primitive that splits a single collection of records into labeled sub-collections based on classification logic. It enables cleaner workflow organization by allowing separate `iterate` nodes for each category rather than complex branching within a single iteration.

## Core Concept

**Without partition:**
```
iterate → route (5 branches inside) → complex nested structure
```

**With partition:**
```
partition → 5 separate iterates → clean, focused workflows
```

## Classical Example: Email Triage

### Scenario
Process inbox emails into 5 categories: customer, investor, regulator, accountant, other

### Workflow Structure

```javascript
// 1. Extract and classify emails
{
  alias: "extract_emails",
  type: "browser_query",
  config: {
    create_records: "email",
    selector: "tr.email",
    extract: {
      subject: ".subject",
      sender: ".sender",
      preview: ".preview",
      element: "@element"
    }
  }
}

// 2. Classify each email
{
  alias: "classify_emails",
  type: "iterate",
  config: {
    over_records: "email_*",
    body: [{
      alias: "classify",
      type: "cognition",
      config: {
        instruction: "Classify as: customer, investor, regulator, accountant, or other",
        input: "Subject: {{current.subject}}\nSender: {{current.sender}}\nPreview: {{current.preview}}",
        store_to_record: true,
        as: "category"
      }
    }]
  }
}

// 3. Partition into buckets
{
  alias: "partition_by_category",
  type: "partition",
  config: {
    collection: "email_*",
    mode: "exclusive",
    labels: ["customer", "investor", "regulator", "accountant", "other"],
    by: "{{record.category}}",
    outputs: {
      collections: "email_buckets"
    }
  }
}

// 4. Process each bucket with dedicated workflows
{
  alias: "process_customers",
  type: "iterate",
  config: {
    over_records: "{{email_buckets.customer}}",
    concurrency: 5,
    body: [
      // Create support ticket
      // Send auto-response
      // Tag in Gmail
    ]
  }
}

{
  alias: "process_investors",
  type: "iterate",
  config: {
    over_records: "{{email_buckets.investor}}",
    concurrency: 2,
    body: [
      // Add to investor CRM
      // Flag for founder review
      // Create follow-up task
    ]
  }
}

{
  alias: "process_regulators",
  type: "iterate",
  config: {
    over_records: "{{email_buckets.regulator}}",
    concurrency: 1,  // Sequential for compliance
    body: [
      // Escalate to legal
      // Create compliance record
      // Lock email thread
      // Archive with audit trail
    ]
  }
}
```

## Node Specification

```javascript
{
  type: "partition",
  alias: "partition_emails",
  config: {
    // Input collection (records to partition)
    collection: "email_*",  // or "{{some_variable}}"
    
    // Partitioning mode
    mode: "exclusive",  // "exclusive" (one bucket per record) or "multi" (record can be in multiple buckets)
    
    // Expected labels
    labels: ["customer", "investor", "regulator", "accountant", "other"],
    // OR
    labels: "dynamic",  // Discover labels at runtime
    
    // Classification expression
    by: "{{record.category}}",  // Simple field reference
    // OR
    by: "{{record.confidence > 0.7 ? record.category : 'other'}}",  // With confidence threshold
    
    // Optional: Confidence/threshold handling
    thresholds: {
      minConfidence: 0.65,
      confidenceField: "category_confidence",
      fallback: "other"
    },
    
    // Optional: Sort within buckets
    sort: {
      key: "{{record.priority}}",
      direction: "desc"
    },
    
    // Output variable for partitioned collections
    outputs: {
      collections: "email_buckets"  // Creates email_buckets.customer, email_buckets.investor, etc.
    }
  }
}
```

## Benefits Over Route-in-Iterate

### 1. **Visual Clarity**
- Each bucket gets its own iterate node
- Workflow graph remains flat and readable
- Easy to see what happens to each category

### 2. **Operational Control**
- Different concurrency settings per bucket
- Different timeout/retry policies
- Can pause/disable specific buckets

### 3. **Better Observability**
- Clear metrics per bucket
- Easy to see distribution (14 emails → 4 customer, 3 investor, 1 regulator, 2 accountant, 4 other)
- Separate logs and debugging per category

### 4. **Team Ownership**
- Different teams can own different buckets
- Compliance team owns regulator flow
- Sales owns customer flow
- No stepping on each other's toes

### 5. **Performance Optimization**
- High-priority buckets can run first
- Resource allocation per bucket
- Parallel processing where safe, sequential where required

## Implementation Details

### Data Model
- Partition creates **views** not copies
- Records maintain their identity and data
- Output is a map of record ID arrays:
  ```javascript
  {
    customer: ["email_001", "email_004", "email_007"],
    investor: ["email_002", "email_005"],
    regulator: ["email_003"],
    accountant: ["email_006", "email_008"],
    other: ["email_009", "email_010"]
  }
  ```

### Edge Cases

#### Empty Buckets
- Empty buckets create empty collections
- Corresponding iterates simply no-op
- No errors thrown

#### Dynamic Labels
```javascript
{
  labels: "dynamic",
  by: "{{record.detected_category}}"
}
// Discovers labels at runtime: spam, urgent, newsletter, etc.
```

#### Multi-Label (Advanced)
```javascript
{
  mode: "multi",
  by: "{{record.tags}}",  // Returns array of labels
  // Record can appear in multiple buckets
  // Use with caution - side effects must be idempotent
}
```

#### Confidence Thresholds
```javascript
{
  by: "{{record.confidence >= 0.7 ? record.category : 'needs_review'}}",
  // Routes low-confidence items to review bucket
}
```

## When to Use Partition

### Use Partition When:
- You have 3+ distinct processing paths
- Different buckets need different:
  - Concurrency settings
  - Error handling
  - Team ownership
  - SLAs or timeouts
- Buckets map to business concepts (customer types, priority levels, etc.)
- You want cleaner logs and metrics per category

### Use Route-in-Iterate When:
- Only 2-3 simple branches
- Branches share most logic with minor variations
- All items need same concurrency/error handling
- Branches are purely conditional (if X do Y, else do Z)

## Best Practices

1. **Classify First, Partition Second**
   - Run classification as a separate step before partition
   - Makes classification logic reusable and testable

2. **Use Exclusive Mode for Side Effects**
   - When buckets perform writes/clicks/API calls
   - Prevents duplicate actions

3. **Consider Confidence Thresholds**
   - Route low-confidence items to manual review
   - Better than forcing a guess

4. **Name Buckets Meaningfully**
   - Use business terms not technical ones
   - "high_value_customer" not "bucket_1"

5. **Monitor Distribution**
   - Track how records distribute across buckets
   - Identify classification issues early

## Example Patterns

### Priority-Based Processing
```javascript
partition by urgency → 
  - immediate (concurrency: 10)
  - today (concurrency: 5)  
  - this_week (concurrency: 2)
  - backlog (concurrency: 1)
```

### Error Triage
```javascript
partition by error_type →
  - network_timeout (retry with backoff)
  - auth_failure (refresh token)
  - validation_error (send to manual review)
  - unknown (log and skip)
```

### Multi-Stage Classification
```javascript
partition by department →
  - engineering → partition by severity (P0/P1/P2)
  - sales → partition by deal_size (enterprise/mid/small)
  - support → partition by tier (premium/standard)
```

## Future Enhancements

1. **Partition Analytics Node**
   - Visualize distribution
   - Show sample records per bucket
   - Suggest rebalancing

2. **Dynamic Rebalancing**
   - Move records between buckets based on load
   - Useful for queue management

3. **Partition Merge**
   - Combine multiple partitions
   - Union/intersection operations

4. **ML-Powered Partitioning**
   - Learn optimal buckets from historical data
   - Suggest new categories