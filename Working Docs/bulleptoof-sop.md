# Bullet-Proof SOP Implementation Plan  
## Project: Gmail → Airtable Investor CRM (v2.1)

> Scope: Browser-only automation; limit emails to **6 June 2025**; update existing Airtable rows or create new ones; no NodeLogger work in this phase.

---

### 🎯 High-Level Goals
1. Deterministically identify and process every investor-relevant thread dated 6 Jun 2025.
2. Update existing Airtable rows when the investor already exists (match on *Email* or *Investor Name*); otherwise create a new row.
3. Execute reliably under variable network latency, UI drift, and without leaking credentials.

---

## 📑 Ticket Backlog

| # | Title | Owner | Effort | Blocked-By | Definition of Done |
|---|-------|-------|--------|-----------|--------------------|
| **T-01** | Extend JSON Schema for new primitives | Backend | 2 pts | – | `workflow-schema.json` validates `extract_list`, `filter_list`, `list_iterator`, `assert_element`, `update_row`, `create_row`. CI schema tests pass. |
| **T-02** | HybridBrowserManager: `extract_list` action | Platform | 5 pts | T-01 | Action scrolls inbox, returns array `[{threadId, subject, sender, snippet, dateStr}]` ≤ maxPages. Unit tests cover: endless scroll guard, 0-item list, >300 items trimmed. |
| **T-03** | ExecutionEngine: support `filter_list` node | Backend | 3 pts | T-01 | Engine streams queue batches (*batchSize* param) through Stagehand `.act` LLM prompt, writes `investorQueue` to state. Tests confirm correct Boolean alignment. |
| **T-04** | ExecutionEngine: implement `list_iterator` loop driver | Backend | 3 pts | T-01 | Loop state (`index`, `length`, `queueKey`) persisted; `currentItem` injected into VariableResolver; deterministic exit on index==length. Unit tests for multi-item and empty queue. |
| **T-05** | HybridBrowserManager: `search_airtable`, `update_row`, `create_row` actions | Platform | 8 pts | T-01 | Browser macro locates existing row via Airtable filter UI (first by email, fallback by investor name). `update_row` edits columns; `create_row` adds new record. Tests with mock Airtable grid. |
| **T-06** | Workflow JSON Refactor to v2.1 | Workflow | 5 pts | T-01→T-05 | `gmail-investor-crm-v2.1.json` created:  
  • replaces visual_scan with extract_list & filter_list  
  • new list_iterator loop  
  • date-filter search query  
  • search_or_create_row compound node with branching.  
Schema validation passes. |
| **T-07** | Credential & Memory Hygiene Guards | Security | 3 pts | – | CredentialInjectionService: verify wipe after each action; add `clear_memory` Stagehand call post-loop. Unit test ensures memory cleared. |
| **T-08** | Error Handlers & Retry Policies | Backend | 4 pts | T-04 | Add `error_handler_login`, `error_handler_scroll`, row-level skip logic. Acceptance:  
  • Simulated network failure recovered via retry.  
  • Gmail selector drift triggers AI fallback without crash. |
| **T-09** | E2E Test Harness (Docker headless) | QA | 5 pts | T-02..T-08 | Automated Playwright suite seeds Gmail & Airtable fixtures, runs workflow in CI; asserts rowsCreated / rowsUpdated == expected. |
| **T-10** | Documentation & Developer Guide | Docs | 2 pts | T-06 | Update `node-type.md`, README; provide sample JSON snippets & troubleshooting guide. |

Total ≈ 40 pts (1 sprint).

---

## 📜 Detailed Acceptance Criteria per Ticket

### T-01 • JSON Schema Extensions
- [ ] `extract_list` under `actionType` enum with required fields `itemSelector` & `fields`.
- [ ] `filter_list`, `list_iterator`, `search_airtable`, `update_row`, `create_row`, `assert_element` node/action definitions.
- [ ] AJV validation passes for legacy & new workflows.

### T-02 • `extract_list` Action
- Scrolls using `window.innerHeight` until **no new items for 2 scrolls** or `maxPages`.
- Captures attributes as per `fields` map.
- Uses throttle (250 ms) between scrolls.
- Returns deterministic order (oldest → newest or as specified).

### T-03 • `filter_list` Node
- Splits queue into batches of `batchSize` (default 25).
- LLM prompt returns JSON Boolean array; verify length matches batch.
- Writes filtered items to `state[outputKey]`.
- Supports dry-run `mock=true` flag for tests.

### T-04 • `list_iterator` Loop
- On first entry reads `queueKey`; initialises `{index:0, length}`.
- Injects `currentItem` into VariableResolver for children.
- After last child returns, increments `index` and routes back to first child.
- Exits loop when `index === length`.

### T-05 • Airtable Row Ops
`search_airtable`
- Opens filter, types query, waits ≤5 s for grid refresh.
- Returns `{ found: boolean, rowSelector?: string }`.

`update_row`
- Double-click row; updates Stage, Last Interaction (today), Thread Summary (overwrite), Interactions (append new line).
- Saves and validates cell values.

`create_row`
- Click "+" Add record"; fills each column; hits Enter to save.

### T-06 • Workflow JSON v2.1
- Passes new schema validation.
- Total nodes ≤ 25, clear IDs & labels.
- Flow graph has no orphans.
- Compound node `search_or_create_row` branches via decision.

### T-07 • Credential Hygiene
- After each credential injection, values removed from memory.
- `clear_memory` Stagehand action invoked post-loop.

### T-08 • Robust Error Handling
- Each retry uses **exponential back-off** `[0, 2 s, 5 s]`.
- Failures escalate per table:
  | Type | Retries | Escalation |
  |------|---------|------------|
  | Login | 1 | pause_for_human_login |
  | Scroll / extract_list | 2 | abort_run |
  | Row update/create | 1 | skip_row |

### T-09 • End-to-End Test Harness
- Seeds 5 investor + 3 random emails (6 Jun).<br/>
- Airtable pre-seeded with 2 existing investors.<br/>
- Expected outcome: `rowsCreated = 3`, `rowsUpdated = 2`.<br/>
- CI workflow green on Playwright + xvfb.

### T-10 • Documentation
- Update `node-type.md` with all new primitives.
- Add *Quick-start* section showing how to run v2.1 workflow locally.

---

## ⏱️ Proposed Sprint Timeline (7 days)
| Day | Focus |
|-----|-------|
| 1 | T-01 schema & tests |
| 2 | T-02 extract_list implementation & unit tests |
| 3 | T-03, T-04 engine work |
| 4 | T-05 row operations in browser manager |
| 5 | T-06 workflow JSON authoring; functional smoke test |
| 6 | T-07, T-08 security & resiliency polish |
| 7 | T-09 CI harness; T-10 docs; sprint demo |

---

### 🔒 Non-Goals / Out-of-Scope
- No NodeLogger integration (postponed).  
- No Gmail / Airtable REST APIs—browser automation only.  
- No advanced ML beyond simple investor classifier prompt.

---

### 📥 Attachments / References
- Original workflow: `app_frontend/aef/workflows/gmail-investor-crm.json`
- Strategy doc: `Working Docs/aef-strategy.md`
- Credential system: `Working Docs/auth-credentials.md`
- UI element reference screenshots (link-to-be-added).

> **End of Plan** – ready for backlog refinement & sprint planning.

---

## 🔄 Revision 1 (Feedback Incorporation – 2025-06-06)
The plan now reflects three major hardening points raised in the latest discussion:

1. **Investor Detection Funnel (3-Phase)**  
   • Phase-0 ― fast regex/keyword reject.  
   • Phase-1 ― mini-classifier LLM on row *metadata* only (subject + snippet).  
   • Phase-2 ― content sampler: open the thread, extract ≤600 chars of first human paragraph, run a second LLM prompt.  
   • Domain whitelist rescue: if sender domain ∈ `knownVC.json` flip to _investor_.  
   • Ambiguous false-positives where no email/company parsed → checkpoint/human review.  
   (Implemented inside **T-02** & **T-03**.)

2. **Generic, Fuzzy Row Matching in CRM**  
   • New action **`record_search_or_upsert`** supersedes the Airtable-specific trio.  
   • Parameters: `{ matchKeys:["Email","Investor Name"], fallbackKeys:["Contact First Name","Company"], fuzzy:true, maxAttempts:6 }`.  
   • Internal strategy: exact → fuzzy-levenshtein → partial-token; else create row with `DuplicateCheckNeeded=true`.  
   • Still uses only grid filter UI → remains product-agnostic.  
   (Replaces **T-05** scope.)

3. **Per-Iteration Context & Memory Hygiene**  
   • `currentItem` object exposed only to child nodes of the active loop iteration.  
   • After Airtable step → run `clear_memory` action **and** delete heavy data from engine state.  
   • Every 10 iterations reload the email list to avoid DOM bloat.  
   (Acceptance criteria added to **T-04**.)

4. **Google OAuth Login for CRM**  
   • `assert_element` detects "Continue with Google" button; `act` clicks it; relies on existing Gmail session.  
   • Fallback: pause execution for manual login after one retry.  
   (Added to **T-05** acceptance.)

### Updated Ticket Tweaks
- **T-02** now includes Phase-0 regex reject logic inside `extract_list` (cheap JS filter) and Phase-2 body sampler helper.
- **T-03** 'filter_list' acceptance requires Boolean alignment **and** hand-off to Phase-2 when needed.
- **T-05** renamed "Generic record_search_or_upsert"; scope widened to fuzzy logic & duplicate-flag column.

> All other timelines stay unchanged; effort points for T-02 (+1) and T-05 (+2) adjusted implicitly within sprint buffer.

---

## 📋 T-01 Implementation Complete: New Bullet-Proof Schema Primitives

**Status**: ✅ **COMPLETED** (2025-01-15)  
**Effort**: 2 pts  
**Files Modified**:
- `app_frontend/aef/workflows/schemas/workflow-schema.json`
- `app_frontend/test-bulletproof-schema-validation.js` (new)

### 🎯 What Was Delivered

The JSON schema has been extended with **6 new action types** that provide bullet-proof primitives for list processing, assertions, and CRM operations:

1. **`extract_list`** - Robust list extraction with pagination
2. **`filter_list`** - Intelligent filtering with multiple criteria
3. **`list_iterator`** - Deterministic iteration with context management
4. **`assert_element`** - Comprehensive element assertions
5. **`update_row`** - Generic row updating with fuzzy matching
6. **`create_row`** - Reliable row creation with validation

### 📖 Schema Definitions & Usage Examples

#### 1. `extract_list` Action

**Purpose**: Extract structured lists from web pages with automatic pagination and deduplication.

```json
{
  "type": "extract_list",
  "instruction": "Extract all email threads from Gmail inbox",
  "schema": {
    "threads": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "subject": { "type": "string" },
          "sender": { "type": "string" },
          "date": { "type": "string" },
          "snippet": { "type": "string" }
        }
      }
    }
  },
  "listConfig": {
    "scrollStrategy": "auto",           // "auto" | "manual" | "infinite"
    "maxItems": 100,                    // Maximum items to extract
    "deduplication": true,              // Remove duplicates
    "itemSelector": ".email-row",       // CSS selector for items
    "nextPageSelector": ".next-page"    // Pagination button selector
  }
}
```

**Key Features**:
- **Scroll Strategies**: `auto` (smart detection), `manual` (click pagination), `infinite` (endless scroll)
- **Deduplication**: Automatic removal of duplicate items based on content hash
- **Pagination**: Handles both button-based and scroll-based pagination
- **Safety Limits**: `maxItems` prevents runaway extraction

#### 2. `filter_list` Action

**Purpose**: Apply sophisticated filtering criteria to extracted lists.

```json
{
  "type": "filter_list",
  "instruction": "Filter emails to only investor-related communications",
  "listConfig": {
    "filterCriteria": {
      "includeKeywords": ["investor", "fund", "capital", "vc", "angel"],
      "excludeKeywords": ["newsletter", "spam", "unsubscribe"],
      "dateRange": {
        "start": "2025-06-06",
        "end": "2025-06-06"
      }
    }
  }
}
```

**Key Features**:
- **Keyword Filtering**: Include/exclude based on text content
- **Date Range**: Filter by date ranges with flexible formats
- **Multi-Criteria**: Combine multiple filtering strategies
- **Performance**: Optimized for large lists with early termination

#### 3. `list_iterator` Action

**Purpose**: Iterate through lists with proper context management and error handling.

```json
{
  "type": "list_iterator",
  "instruction": "Process each filtered email individually",
  "iteratorConfig": {
    "listVariable": "filteredEmails",     // Source list variable
    "itemVariable": "currentEmail",       // Current item variable name
    "indexVariable": "emailIndex",        // Current index variable name
    "maxIterations": 1000,               // Safety limit
    "continueOnError": false,            // Stop on first error
    "batchSize": 1                       // Items per batch
  }
}
```

**Key Features**:
- **Context Injection**: Current item and index available to child nodes
- **Error Handling**: Configurable continue-on-error behavior
- **Batch Processing**: Process multiple items per iteration
- **Safety Limits**: `maxIterations` prevents infinite loops
- **Memory Management**: Automatic cleanup between iterations

#### 4. `assert_element` Action

**Purpose**: Robust element assertions with multiple validation types.

```json
{
  "type": "assert_element",
  "instruction": "Verify login button is visible and enabled",
  "assertConfig": {
    "assertionType": "visible",           // "exists" | "visible" | "hidden" | "enabled" | "disabled" | "contains_text" | "has_attribute" | "count"
    "selector": "#login-button",
    "expectedText": "Sign In",           // For "contains_text"
    "expectedAttribute": {               // For "has_attribute"
      "name": "data-testid",
      "value": "login-btn"
    },
    "expectedCount": 1,                  // For "count" assertion
    "timeout": 10000,                    // Wait timeout
    "failureAction": "stop"              // "stop" | "continue" | "retry" | "escalate"
  }
}
```

**Assertion Types**:
- **`exists`**: Element is present in DOM
- **`visible`**: Element is visible to user
- **`hidden`**: Element is hidden
- **`enabled`**: Element is interactive
- **`disabled`**: Element is disabled
- **`contains_text`**: Element contains specific text
- **`has_attribute`**: Element has specific attribute/value
- **`count`**: Specific number of matching elements

#### 5. `update_row` Action

**Purpose**: Update existing records with fuzzy matching and fallback strategies.

```json
{
  "type": "update_row",
  "instruction": "Update existing investor record with new interaction",
  "rowConfig": {
    "tableName": "investor_crm",
    "searchCriteria": {
      "primaryKey": "email",             // Primary search field
      "searchFields": ["name", "company"], // Additional search fields
      "fuzzyMatch": true,                // Enable fuzzy matching
      "matchThreshold": 0.8              // Similarity threshold (0-1)
    },
    "fieldMapping": {
      "investorName": "name",            // Variable -> Field mapping
      "investorEmail": "email",
      "lastInteraction": "interaction_date",
      "threadSummary": "notes"
    },
    "upsertStrategy": "update_only",     // "create_only" | "update_only" | "create_or_update"
    "requiredFields": ["name", "email"],
    "defaultValues": {
      "stage": "contacted",
      "updated_date": "{{current_date}}"
    }
  }
}
```

**Key Features**:
- **Fuzzy Matching**: Levenshtein distance-based matching for typos
- **Multiple Search Fields**: Try different fields for finding records
- **Flexible Mapping**: Map workflow variables to table fields
- **Upsert Strategies**: Control create vs update behavior
- **Default Values**: Automatic field population

#### 6. `create_row` Action

**Purpose**: Create new records with validation and default values.

```json
{
  "type": "create_row",
  "instruction": "Create new investor record in CRM",
  "rowConfig": {
    "tableName": "investor_crm",
    "fieldMapping": {
      "investorName": "name",
      "investorEmail": "email",
      "company": "company",
      "stage": "status",
      "threadSummary": "initial_notes"
    },
    "upsertStrategy": "create_only",
    "requiredFields": ["name", "email"],
    "defaultValues": {
      "stage": "new",
      "created_date": "{{current_date}}",
      "follow_up_needed": true
    }
  }
}
```

### 🧪 Validation & Testing

**Comprehensive Test Suite**: `test-bulletproof-schema-validation.js`

The test suite validates:
- ✅ All 6 new action types with valid configurations
- ✅ Required field validation (e.g., `listVariable` for `list_iterator`)
- ✅ Enum value validation (e.g., `assertionType` values)
- ✅ Invalid action type rejection
- ✅ Complex workflows with multiple new action types
- ✅ Edge cases and error conditions

**Test Results**: 10/10 tests passed ✅

```bash
# Run schema validation tests
cd app_frontend
node test-bulletproof-schema-validation.js
```

### 🔧 Configuration Schema Definitions

The schema includes 4 new configuration objects:

#### `listConfig`
```json
{
  "scrollStrategy": "auto",      // Pagination strategy
  "maxItems": 100,              // Item limit
  "deduplication": true,        // Remove duplicates
  "itemSelector": ".item",      // Item CSS selector
  "nextPageSelector": ".next",  // Next page selector
  "filterCriteria": {           // Filtering options
    "includeKeywords": ["..."],
    "excludeKeywords": ["..."],
    "dateRange": { "start": "...", "end": "..." }
  }
}
```

#### `iteratorConfig`
```json
{
  "listVariable": "myList",     // REQUIRED: Source list
  "itemVariable": "currentItem", // Current item variable
  "indexVariable": "index",     // Current index variable
  "maxIterations": 1000,       // Safety limit
  "continueOnError": false,     // Error handling
  "batchSize": 1               // Batch size
}
```

#### `assertConfig`
```json
{
  "assertionType": "visible",   // REQUIRED: Assertion type
  "selector": "#element",       // REQUIRED: CSS selector
  "expectedText": "...",        // For text assertions
  "expectedAttribute": {...},   // For attribute assertions
  "expectedCount": 1,           // For count assertions
  "timeout": 10000,            // Wait timeout
  "failureAction": "stop"       // Failure handling
}
```

#### `rowConfig`
```json
{
  "tableName": "table_name",    // Table identifier
  "searchCriteria": {           // Search configuration
    "primaryKey": "id",
    "searchFields": ["..."],
    "fuzzyMatch": true,
    "matchThreshold": 0.8
  },
  "fieldMapping": {...},        // Variable to field mapping
  "upsertStrategy": "create_or_update", // Strategy
  "requiredFields": ["..."],    // Required fields
  "defaultValues": {...}        // Default values
}
```

### 🚀 Next Steps

With T-01 complete, the foundation is ready for:

- **T-02**: Implement `extract_list` in HybridBrowserManager
- **T-03**: Add `filter_list` support to ExecutionEngine  
- **T-04**: Build `list_iterator` loop driver
- **T-05**: Create generic row operations (`update_row`, `create_row`)

### 🔍 Backward Compatibility

All existing workflows continue to work unchanged. The new action types are additive and don't affect existing functionality.

### 📚 Developer Notes

- **Schema Location**: `app_frontend/aef/workflows/schemas/workflow-schema.json`
- **Validation**: Uses AJV with `allErrors: true` for comprehensive error reporting
- **Caching**: ServerWorkflowLoader caches validated workflows for performance
- **Error Handling**: Detailed validation errors with field paths and descriptions

---

## 🔄 Revision 2 (Schema Hardening – 2025-01-15)

### What changed
1. **Conditional Validation Rules**  
   • Added `allOf` discriminators so each action type *must* carry only its matching config (`listConfig`, `iteratorConfig`, `assertConfig`, `rowConfig`).  
   • Navigational / basic actions are explicitly forbidden from carrying any of these heavy configs.

2. **Enum Alignment**  
   • Removed legacy `search_airtable` from `workflowAction.type`.  
   • Added generic **`record_search_or_upsert`** to promote app-agnostic CRM ops.

3. **Test Suite Upgrade** (`test-bulletproof-schema-validation.js`)  
   • Re-written as table-driven; now 11 tests covering:
     – happy paths for all 7 new/generic CRUD primitives,  
     – config-mismatch rejection,  
     – invalid action type,  
     – bad enum value.  
   • All tests pass ⇒ schema is "bullet-proof".

4. **Documentation Synced**  
   • Examples & tables updated to reference `record_search_or_upsert`.

### Open todos migrated to backlog
- **TS type-gen**: run `npm run schema:gen` once T-01 lands on `main` (ownership: Backend).  
- **CI hook**: add `"test:schema"` script and integrate with GitHub Actions (ownership: DevOps).

--- 