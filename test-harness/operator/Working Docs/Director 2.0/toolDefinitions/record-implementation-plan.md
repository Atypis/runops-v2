# Implementation Plan: Adding Records Section to Director Prompt

## Analysis Summary

### Current Director Prompt Structure (V5)

1. **Role & Ownership** - Director's identity and clarifications
2. **Workflow Development Lifecycle**
   - A. Understanding & Alignment
   - B. Workflow Building Phases (Setup & Core)
   - C. Development Methodology (Plan → Scout → Build → Test → Repeat)
   - D. Critical Operating Rules (Fail Fast)
3. **Tools & Capabilities**
   - A. Context Model & Memory Management
   - B. Function Tools
   - C. Core Node Types
   - D. Variable Reference System (current location for variable concepts)

### Current Variable Documentation

The existing variable reference system (Section 3.D) covers:
- Reference syntax for stored nodes, environment, context, and iterator variables
- Schema requirements for property access
- Common schema patterns

However, it lacks:
- A cohesive mental model for data flow
- Clear explanation of how iteration creates temporary contexts
- The concept of data accumulation through workflow execution
- Best practices for organizing workflow data

### Current Iteration Documentation

The iterate node (Section 3.C.5) is documented minimally:
- "Loop over arrays"
- "Execute nodes for each item in an array"
- Variable naming creates automatic variables
- Warning about not using names ending with "Index"

This misses the fundamental concept of what iteration represents in workflows.

## Proposed Records Section

### Section Placement

Add new section **"2.E. Records: The Fundamental Working Unit"** after the Development Methodology section. This placement:
- Comes after the Director understands their workflow process
- Comes before the technical tools section
- Establishes the mental model before diving into implementation

### Section Content Structure

```markdown
### E. Records: The Fundamental Working Unit

**The Core Insight**: Every workflow operates on records - discrete units of data that flow through your automation. Understanding records transforms how you think about and build workflows.

#### What Are Records?

Records are the atoms of your workflow - each representing a single entity you're processing:
- An email to classify
- An employee to onboard
- An invoice to process
- A lead to qualify

Instead of thinking "iterate with index 0 through 9", think "process these 10 emails, each with its own identity and state."

#### The Record Mental Model

**Traditional (Index-Based) Thinking:**
```
for (i = 0; i < emails.length; i++) {
  // Which email is this? What data belongs to it?
  // Variables scatter across the workflow
}
```

**Record-Based Thinking:**
```
for each email_record:
  - email_record starts with discovered data (subject, sender)
  - email_record accumulates content as you extract it
  - email_record gains classification as you analyze it
  - email_record completes with CRM ID after update
```

Each record tells its own story through the workflow.

#### How Records Flow Through Workflows

1. **Discovery Phase**: Records are born
   - Extract from page: "Find all June 2nd emails" → email_001, email_002, email_003
   - External input: "Process these 5 employee names" → employee_001 through employee_005
   - Each record starts with initial data

2. **Processing Phase**: Records accumulate data
   ```
   email_001: {
     // Initial discovery
     subject: "Investment Interest",
     sender: "vc@sequoia.com",
     
     // Added during processing
     content: "We'd like to invest...",
     classification: "investor",
     sentiment: "positive",
     airtableId: "rec123"
   }
   ```

3. **Completion Phase**: Records reach their final state
   - Complete: All processing successful
   - Failed: Error during processing (can be retried)
   - Partial: Some steps completed (debuggable)

#### Working with Records in Practice

**Creating Records During Extraction:**
```javascript
{
  type: "browser_query",
  alias: "find_emails",
  config: {
    selector: "tr.email-row",
    create_records: "email",  // Transform results into email records
    extract: {
      subject: ".subject-line",
      sender: ".from-address"
    }
  }
}
// Creates: email_001, email_002, email_003...
```

**Processing Records with Iterate:**
```javascript
{
  type: "iterate",
  alias: "process_each_email",
  config: {
    over_records: "email_*",  // Process all email records
    as: "current",           // Reference name in iteration
    body: [/* nodes that process each email */]
  }
}
```

**Accessing Record Data:**
- Inside iteration: `{{current.subject}}`, `{{current.classification}}`
- Outside iteration: `{{records.email_001.subject}}`
- The record namespace keeps all related data together

#### Why Records Matter

1. **Clear Data Organization**: No more scattered variables - each record contains all its data
2. **Natural Debugging**: "Show me what happened to email_003" vs hunting through variables
3. **Reliable Processing**: Failed records can be retried without affecting others
4. **Progressive Enhancement**: Records build up data naturally through the workflow

#### Record Best Practices

1. **Use Meaningful Record Types**
   - Good: "email", "employee", "invoice", "lead"
   - Avoid: "item", "data", "thing"

2. **Let Records Tell Their Story**
   - Each node that processes a record should add meaningful data
   - Use `store_to_record: true` to accumulate data in the record
   - Name fields clearly: "classification" not "result"

3. **Design for Failure**
   - Individual records can fail without breaking the entire workflow
   - Failed records can be inspected and retried
   - Use `on_error: "mark_failed_continue"` for resilient processing

4. **Think in Terms of Entities**
   - What are you actually processing? Make that your record type
   - What data does each entity need? That's your record schema
   - How does the entity change through processing? That's your workflow

#### Common Record Patterns

**Email Processing:**
```
Discovery: Extract from inbox → email records with subject/sender
Enrichment: Click and extract content → add body text
Analysis: Classify content → add classification/sentiment
Action: Update CRM → add crmId
```

**Data Import:**
```
Discovery: Parse CSV rows → record per row
Validation: Check required fields → add validation status
Transformation: Normalize data → add cleaned fields
Loading: Insert to database → add dbId
```

**Web Scraping:**
```
Discovery: Find all products → product records
Details: Visit each page → add specs/price
Comparison: Analyze competition → add market position
Export: Save results → add exportedAt timestamp
```

Remember: Records aren't just a technical feature - they're a fundamentally better way to think about workflow automation. When you think in records, complex workflows become simple data transformation pipelines.
```

### Updates to Existing Sections

#### 1. Update Iterate Node Documentation (Section 3.C.5)

Current:
```javascript
5. **`iterate`** - Loop over arrays
   - Execute nodes for each item in an array
   - Variable naming creates automatic variables
   - **IMPORTANT**: Never use variable names ending with "Index"
```

Updated:
```javascript
5. **`iterate`** - Process collections of data
   - Execute nodes for each item in an array or record set
   - Two modes:
     - Array iteration: `over: "{{email_array}}"` (legacy)
     - Record iteration: `over_records: "email_*"` (recommended)
   - Creates iteration context with automatic variables:
     - `{{current}}` or `{{yourName}}` - current item/record
     - `{{currentIndex}}` or `{{yourNameIndex}}` - position
     - `{{currentTotal}}` or `{{yourNameTotal}}` - total count
   - **IMPORTANT**: Never use variable names ending with "Index"
   - See Section 2.E for the record-based mental model
```

#### 2. Update Variable Reference System (Section 3.D)

Add new subsection after Schema Requirements:

```markdown
**Record References:**
- Inside record iteration: `{{current.field}}` or `{{iteratorName.field}}`
- Outside iteration: `{{records.recordId.field}}`
- Record-aware nodes store with: `store_to_record: true`
- Records accumulate data progressively through workflow execution
- See Section 2.E for complete record documentation
```

#### 3. Update Browser Query Documentation

Add record creation capability:

```javascript
2. **`browser_query`** - Deterministic validation and extraction
   - validate: Check element exists
   - deterministic_extract: Extract structured data
   - count: Count elements matching selector
   - **NEW**: create_records: Transform extracted data into records
     - Simple: `create_records: "email"`
     - Advanced: `create_records: { type: "email", id_pattern: "email_{{sender}}" }`
```

### Integration with Examples

Add record-based examples throughout:

1. In the Setup Phase section, show profile + record setup
2. In the Core Workflow Phase, demonstrate record accumulation
3. In the Critical Operating Rules, show record-specific error handling

### Mental Model Reinforcement

Throughout the prompt, reinforce the record concept:
- When discussing extraction: "extract data into records"
- When discussing iteration: "process each record"
- When discussing debugging: "inspect record state"
- When discussing errors: "retry failed records"

## Implementation Steps

1. **Add Section 2.E** as the primary record documentation
2. **Update node type descriptions** to reference record capabilities
3. **Enhance variable documentation** with record-specific patterns
4. **Add record examples** to relevant sections
5. **Update iteration documentation** to emphasize record processing
6. **Test with sample workflows** to ensure clarity

## Success Criteria

The updated prompt should enable Directors to:
1. Immediately understand records as the fundamental working unit
2. Design workflows around record transformations
3. Use record-based patterns naturally
4. Debug workflows by inspecting record state
5. Build more maintainable and reliable automations

## Key Messages to Convey

1. **Records = Entities**: Each record represents a real thing being processed
2. **Records Accumulate**: Data builds up progressively through the workflow
3. **Records Persist**: Failed records can be debugged and retried
4. **Records Organize**: All related data stays together in one namespace
5. **Records Simplify**: Complex workflows become clear data pipelines