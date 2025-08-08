# Variable Storage Unification Implementation Plan

## Overview

This document outlines the implementation plan to unify Director's variable storage system into two clear, consistent patterns while removing legacy complexity and noise.

## Current State Analysis

### ✅ Keep (Already Consistent)
- **Context Variables**: `variables: {}` → `{{key}}` (direct global storage)
- **Node Results**: `store: {}` → `{{alias.field}}` (namespaced storage)
- **Iteration Variables**: Auto-generated `{{variable}}`, `{{variableIndex}}`, `{{variableTotal}}`

### ❌ Remove (Legacy/Inconsistent)
- **`store_variable: true`** (deprecated legacy pattern)
- **Mixed storage key patterns** in database
- **Documentation inconsistencies** across multiple files

## Target Architecture

### Two Clear Storage Patterns

#### Pattern 1: Static Configuration Storage
```javascript
// For: API keys, configuration, constants, user input
{
  type: 'context',
  alias: 'setup',
  config: {
    variables: {
      apiKey: "sk-123",
      environment: "production",
      userId: "user_1"
    }
  }
}

// Storage: Direct keys in workflow_memory
// Access: {{apiKey}}, {{environment}}, {{userId}}
// Use case: Static values that don't change during workflow
```

#### Pattern 2: Dynamic Result Storage
```javascript
// For: Node execution results, computed values, extracted data
{
  type: 'cognition',
  alias: 'classify_email',
  config: {
    instruction: "Classify this email...",
    store: {
      "result": "classification",
      "confidence": "score"
    }
  }
}

// Storage: Namespaced keys (alias.field) in workflow_memory  
// Access: {{classify_email.classification}}, {{classify_email.score}}
// Use case: Dynamic results from node execution
```

## Implementation Plan

### Phase 1: Code Cleanup (Week 1)

#### 1.1 Remove `store_variable` Implementation
**Files to modify:**
- `/backend/services/nodeExecutor.js`
- `/backend/tools/toolDefinitionsV2.js`

**Changes:**
```javascript
// DELETE from nodeExecutor.js (lines 1264-1330):
// Legacy store_variable support (will be deprecated)
else if (resolvedConfig?.store_variable) {
  // ... entire block
}

// DELETE from all tool definitions:
store_variable: {
  type: 'boolean',
  description: 'Store the result...'
}
```

#### 1.2 Update Error Messages
**Replace confusing error messages:**
```javascript
// OLD:
throw new Error(`Variable '${path}' not found. Did you forget to set store_variable: true?`);

// NEW:
throw new Error(`Variable '${path}' not found. 

Available storage patterns:
• Static values: Use variables: {key: value} → access {{key}}
• Dynamic results: Use store: {field: name} → access {{alias.name}}

Available variables: ${availableVars.join(', ')}

Use get_workflow_data() to inspect all stored variables.`);
```

#### 1.3 Clean Up Variable Resolution Logic
**Simplify resolution path in `resolveTemplateVariables()`:**
```javascript
// Keep only these resolution paths:
1. Record context (when in record iteration)
2. Property access (alias.field) → store: {} results
3. Simple lookup (key) → variables: {} values  
4. Iteration context variables
5. Clear error with helpful message
```

### Phase 2: Tool Definition Updates (Week 1)

#### 2.1 Update Context Node Definition
```javascript
// In toolDefinitionsV2.js - context node
{
  type: 'object',
  properties: {
    type: { const: 'context' },
    config: {
      type: 'object',
      properties: {
        variables: {
          type: 'object',
          description: 'Static values stored globally. Each key-value pair is stored with the exact key provided (e.g., {apiKey: "sk-123"} is accessed as {{apiKey}}). Use for configuration, constants, and user input that won\'t change during workflow execution.',
          additionalProperties: true
        }
      },
      required: ['variables'],
      additionalProperties: false
    }
  }
}
```

#### 2.2 Add Universal `store` Configuration
**Add to ALL node types that can produce results:**
```javascript
// Universal store configuration for all nodes
store: {
  type: 'object',
  description: 'Map specific fields from the node result to named variables. Each mapping stores result.sourceField as {{alias.targetName}}. Example: {"result": "classification", "confidence": "score"} stores the result field as {{alias.classification}} and confidence field as {{alias.score}}.',
  additionalProperties: { type: 'string' }
}
```

#### 2.3 Add Store Shortcuts
```javascript
// Add convenient shortcuts
store: {
  oneOf: [
    {
      type: 'object',
      description: 'Field mapping object',
      additionalProperties: { type: 'string' }
    },
    {
      type: 'boolean', 
      const: true,
      description: 'Shorthand for store: {"result": "result"} - stores main result as {{alias.result}}'
    },
    {
      type: 'string',
      const: '*',
      description: 'Store all result fields with same names - useful for browser queries with multiple fields'
    }
  ]
}
```

### Phase 3: Documentation Updates (Week 1)

#### 3.1 Update Director Prompt
**Replace entire variable section in `directorPromptV4.js`:**

```javascript
### D. Data Model: Variables & Storage

**Two Storage Patterns:**

**Pattern 1: Static Configuration Storage**
Use for: API keys, configuration, constants, user input
```javascript
{
  type: 'context',
  alias: 'setup', 
  config: {
    variables: {
      apiKey: "sk-123",
      environment: "production"
    }
  }
}
// Access: {{apiKey}}, {{environment}}
```

**Pattern 2: Dynamic Result Storage**  
Use for: Node execution results, computed values, extracted data
```javascript
{
  type: 'cognition',
  alias: 'classify_email',
  config: {
    instruction: "Classify this email...",
    store: {
      "result": "classification",
      "confidence": "score"
    }
  }
}
// Access: {{classify_email.classification}}, {{classify_email.score}}
```

**Storage Shortcuts:**
```javascript
store: true           // Shorthand for store: {"result": "result"}
store: "*"            // Store all fields with same names
```

**Variable Reference Patterns:**
```javascript
// Static values (context variables)
{{apiKey}}                    // Direct access
{{environment}}               // Direct access

// Dynamic results (stored results)  
{{classify_email.result}}     // Namespaced access
{{extract_data.emails[0]}}    // Array/object navigation

// Iteration variables (auto-created)
{{email}}                     // Current item
{{emailIndex}}                // Current index (0, 1, 2...)
{{emailTotal}}                // Total count
```

**When to Use Which:**
- **Context variables**: Configuration that doesn't change (API keys, user settings)
- **Store configuration**: Results you'll reference later (classifications, extracted data)
- **No storage**: Intermediate steps that don't need to be referenced
```

#### 3.2 Create New Documentation File
**Create `/backend/docs/variable-storage-guide.md`:**

```markdown
# Director Variable Storage Guide

## The Two Patterns

### 1. Static Configuration (`variables: {}`)
**Purpose:** Store configuration, constants, and user input
**Storage:** Direct keys in workflow_memory
**Access:** `{{key}}`

**Example:**
```javascript
{
  type: 'context',
  alias: 'config',
  config: {
    variables: {
      apiKey: "sk-123",
      maxResults: 50,
      userEmail: "user@company.com"
    }
  }
}

// Access anywhere in workflow:
{{apiKey}}        // "sk-123"
{{maxResults}}    // 50
{{userEmail}}     // "user@company.com"
```

### 2. Dynamic Results (`store: {}`)
**Purpose:** Store computed results for later use
**Storage:** Namespaced keys (alias.field) in workflow_memory
**Access:** `{{alias.field}}`

**Example:**
```javascript
{
  type: 'cognition',
  alias: 'email_classifier',
  config: {
    instruction: "Classify this email as urgent, normal, or low priority",
    store: {
      "result": "priority",
      "confidence": "confidence_score"
    }
  }
}

// Access anywhere in workflow:
{{email_classifier.priority}}          // "urgent" 
{{email_classifier.confidence_score}}  // 0.85
```

## Shortcuts and Conventions

### Store Shortcuts
```javascript
// Instead of store: {"result": "result"}
store: true

// Instead of store: {"field1": "field1", "field2": "field2", ...}  
store: "*"
```

### Common Patterns
```javascript
// Browser query extracting multiple fields
{
  type: 'browser_query',
  alias: 'extract_emails',
  config: {
    method: 'deterministic_extract',
    selector: 'tr.email',
    fields: {
      subject: '.subject',
      sender: '.sender', 
      date: '.date'
    },
    store: "*"  // Stores all fields: {{extract_emails.subject}}, {{extract_emails.sender}}, {{extract_emails.date}}
  }
}

// Cognition with simple result
{
  type: 'cognition',
  alias: 'is_spam',
  config: {
    instruction: "Is this email spam? Return true or false",
    schema: { type: "boolean" },
    store: true  // Stores as: {{is_spam.result}}
  }
}
```

## Decision Tree: Which Pattern to Use?

```
Is this data static/configuration?
├─ YES → Use variables: {} → Access {{key}}
└─ NO → Is this a result you'll reference later?
   ├─ YES → Use store: {} → Access {{alias.field}}
   └─ NO → Don't store (intermediate step)
```

## Migration from Legacy Patterns

### Replacing `store_variable: true`
```javascript
// OLD (deprecated):
{
  type: 'cognition',
  alias: 'classifier',
  config: {
    instruction: "...",
    store_variable: true
  }
}
// Access: {{classifier}} or {{classifier.result}}

// NEW (preferred):
{
  type: 'cognition', 
  alias: 'classifier',
  config: {
    instruction: "...",
    store: true  // or store: {"result": "result"}
  }
}
// Access: {{classifier.result}}
```
```

### Phase 4: Implementation Support (Week 2)

#### 4.1 Add Migration Warnings
```javascript
// In nodeExecutor.js, add deprecation warnings:
if (resolvedConfig?.store_variable) {
  console.warn(`
⚠️  DEPRECATED: store_variable is deprecated and will be removed.
Node: ${node.alias} (position ${node.position})

MIGRATION:
  OLD: store_variable: true
  NEW: store: true  // Access as {{${node.alias}.result}}
  
See /backend/docs/variable-storage-guide.md for details.
  `);
}
```

#### 4.2 Add Development Helper Tool
```javascript
// New MCP tool for variable inspection
mcp__director__inspect_variables: {
  description: 'Debug variable storage patterns and get migration suggestions',
  parameters: {
    showStorageKeys: { type: 'boolean', description: 'Show database storage keys' },
    showLegacyUsage: { type: 'boolean', description: 'Highlight deprecated patterns' },
    suggestMigration: { type: 'boolean', description: 'Suggest modern alternatives' }
  }
}
```

#### 4.3 Add Store Shortcut Implementation
```javascript
// In nodeExecutor.js, handle store shortcuts:
if (resolvedConfig?.store === true) {
  resolvedConfig.store = { "result": "result" };
}

if (resolvedConfig?.store === "*") {
  // For browser queries, store all fields with same names
  if (result && typeof result === 'object') {
    resolvedConfig.store = {};
    for (const key of Object.keys(result)) {
      resolvedConfig.store[key] = key;
    }
  }
}
```

### Phase 5: Testing & Validation (Week 2)

#### 5.1 Update Existing Test Workflows
**Identify and update workflows using deprecated patterns:**
- Search for `store_variable: true` usage
- Update to use `store: true` or appropriate mapping
- Verify variable access patterns work correctly

#### 5.2 Add Comprehensive Tests
```javascript
// Test cases to add:
1. Context variables storage and access
2. Store configuration with field mapping
3. Store shortcuts (true, "*")
4. Variable collision prevention  
5. Error message clarity
6. Migration path from store_variable
```

#### 5.3 Performance Testing
**Verify no performance regression:**
- Variable resolution time
- Database query patterns
- Memory usage during large workflows

## Migration Timeline

### Week 1: Core Implementation
- [ ] Remove `store_variable` code
- [ ] Update tool definitions  
- [ ] Update documentation
- [ ] Add deprecation warnings

### Week 2: Support & Testing
- [ ] Add migration helpers
- [ ] Implement store shortcuts
- [ ] Update test workflows
- [ ] Performance validation

### Week 3: Production Rollout
- [ ] Deploy to staging
- [ ] Validate existing workflows
- [ ] Monitor for issues
- [ ] Full production deployment

## Success Criteria

✅ **Single Decision Tree**: Clear rules for when to use which pattern  
✅ **Zero Legacy Code**: No `store_variable` references in codebase  
✅ **Consistent Documentation**: All docs show same patterns  
✅ **Helpful Errors**: Failed variable lookups guide toward solution  
✅ **Migration Path**: Clear upgrade path for existing workflows  
✅ **Performance**: No regression in variable resolution speed  

## Risk Mitigation

### Backward Compatibility
- Keep deprecated code initially with warnings
- Provide clear migration documentation
- Test extensively before removal

### User Communication  
- Update Director prompt immediately
- Add migration guides to documentation
- Provide helper tools for conversion

### Rollback Plan
- Feature flags for new vs old behavior
- Database rollback scripts if needed  
- Monitoring for error rate increases

---

*This plan unifies Director's variable storage into two clear, consistent patterns while removing legacy complexity. The result will be a system that's easier to understand, document, and maintain.*