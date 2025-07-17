# update_workflow_description Function - Director 2.0

## Overview

The `update_workflow_description` function is a critical planning tool that captures comprehensive workflow requirements before implementation. It serves as the authoritative contract between the user's needs and Director's implementation, defining WHAT needs to be built while the plan defines HOW to build it.

## Purpose & Philosophy

### The What vs How Distinction
- **Workflow Description (WHAT)**: Business requirements, success criteria, data contracts, edge cases
- **Plan (HOW)**: Implementation phases, technical tasks, node building steps

### Key Benefits
1. **Requirements Clarity**: Forces thorough understanding before building
2. **Version Control**: Maintains history of requirement changes
3. **Context Persistence**: Survives conversation resets
4. **Audit Trail**: Documents why decisions were made
5. **Quality Assurance**: Provides success criteria for validation

## Architecture Deep Dive

### Storage Architecture
- **Table**: `workflow_descriptions` in Supabase
- **Versioning**: Each update creates a new version (immutable history)
- **Structure**: JSON document with standardized fields
- **Relationship**: One-to-many with workflows (history preserved)

### Service Layer Implementation
```javascript
class WorkflowDescriptionService {
  // Creates new version on every update
  async updateDescription(workflowId, descriptionData, reason) {
    // Get current version
    const currentVersion = await this.getCurrentDescription(workflowId);
    const nextVersion = currentVersion ? currentVersion.description_version + 1 : 1;
    
    // Build revision history
    const revisionHistory = [...(descriptionData.revision_history || [])];
    revisionHistory.push({
      version: nextVersion,
      date: new Date().toISOString(),
      author: 'director',
      changes: reason
    });
    
    // Enhanced with metadata
    const enhancedData = {
      ...descriptionData,
      revision_history: revisionHistory,
      _metadata: {
        update_reason: reason,
        updated_at: new Date().toISOString(),
        version: nextVersion
      }
    };
    
    // Insert new version (preserves history)
    return await supabase.from('workflow_descriptions').insert({
      workflow_id: workflowId,
      description_version: nextVersion,
      description_data: enhancedData
    });
  }
}
```

## Function Specification

### Parameters
```javascript
{
  description: {
    type: "object",
    description: "Complete workflow description with all high-fidelity details",
    // Full schema structure (see below)
  },
  reason: {
    type: "string", 
    description: "Why the description is being created or updated (for revision history)"
  }
}
```

### Description Schema Structure

```javascript
{
  workflow_name: string,              // Descriptive name for the workflow
  goal: string,                       // What this workflow achieves
  trigger: string,                    // What initiates the workflow
  actors: string[],                   // Systems/accounts involved
  
  happy_path_steps: [{               // Ideal execution flow
    step_number: number,
    description: string,
    expected_outcome: string
  }],
  
  decision_matrix: [{                // Branching logic documentation
    condition: string,
    action_if_true: string,
    action_if_false: string,
    rationale: string
  }],
  
  data_contracts: [{                 // Input/output specifications
    name: string,
    type: string,                    // "input" or "output"
    schema: object,                  // JSON schema
    source: string,
    validation_rules: string[]
  }],
  
  business_rules: [{                 // Domain-specific logic
    rule: string,
    implementation: string,
    exceptions: string[]
  }],
  
  edge_case_policies: [{             // Error handling strategies
    scenario: string,
    detection: string,
    handling: string,
    escalation: string
  }],
  
  success_criteria: [{               // How to measure success
    criterion: string,
    measurement: string,
    threshold: string
  }],
  
  external_resources: [{             // Dependencies and integrations
    name: string,
    type: string,
    url: string,
    authentication: string,
    notes: string
  }],
  
  revision_history: [{               // Automatically managed
    version: number,
    date: string,
    author: string,
    changes: string
  }]
}
```

## Usage Patterns

### 1. Initial Workflow Definition
```javascript
update_workflow_description({
  description: {
    workflow_name: "Gmail Auto-Responder",
    goal: "Automatically respond to urgent emails with predefined templates",
    trigger: "Manual execution or scheduled (every 30 minutes)",
    actors: ["Gmail Account (user@example.com)", "Director System"],
    
    happy_path_steps: [
      {
        step_number: 1,
        description: "Login to Gmail account",
        expected_outcome: "Successfully authenticated and inbox visible"
      },
      {
        step_number: 2,
        description: "Extract unread emails from inbox",
        expected_outcome: "List of email objects with subject, sender, body"
      },
      {
        step_number: 3,
        description: "Classify emails by urgency using AI",
        expected_outcome: "Emails categorized as urgent/normal/low priority"
      },
      {
        step_number: 4,
        description: "Generate responses for urgent emails",
        expected_outcome: "Appropriate template responses created"
      },
      {
        step_number: 5,
        description: "Send auto-responses",
        expected_outcome: "Responses sent, emails marked as handled"
      }
    ],
    
    decision_matrix: [
      {
        condition: "Email contains keywords: 'urgent', 'asap', 'emergency'",
        action_if_true: "Classify as urgent and prioritize response",
        action_if_false: "Apply standard classification rules",
        rationale: "Explicit urgency indicators take precedence"
      }
    ],
    
    data_contracts: [
      {
        name: "Email Object",
        type: "internal",
        schema: {
          type: "object",
          properties: {
            id: {type: "string"},
            subject: {type: "string"},
            sender: {type: "string"},
            body: {type: "string"},
            timestamp: {type: "string"},
            hasAttachments: {type: "boolean"}
          }
        },
        source: "Gmail extraction",
        validation_rules: ["All fields required except hasAttachments"]
      }
    ],
    
    edge_case_policies: [
      {
        scenario: "Gmail login fails with 2FA prompt",
        detection: "Presence of 2FA input field",
        handling: "Pause workflow and alert user for manual intervention",
        escalation: "Send notification to user's backup contact method"
      },
      {
        scenario: "Empty inbox (no unread emails)",
        detection: "Email extraction returns empty array",
        handling: "Log status and complete workflow successfully",
        escalation: "None required"
      }
    ],
    
    success_criteria: [
      {
        criterion: "Response time",
        measurement: "Time from email receipt to auto-response sent",
        threshold: "< 5 minutes for urgent emails"
      },
      {
        criterion: "Accuracy",
        measurement: "Percentage of correctly classified urgent emails",
        threshold: "> 95%"
      }
    ]
  },
  reason: "Initial workflow requirements captured from user specifications"
})
```

### 2. Updating After Discovery
```javascript
update_workflow_description({
  description: {
    // ... existing fields ...
    
    edge_case_policies: [
      // ... existing policies ...
      {
        scenario: "Gmail interface changed (selectors not found)",
        detection: "Core selector validation fails",
        handling: "Switch to AI-powered actions for resilience",
        escalation: "Log UI change for manual review"
      }
    ],
    
    business_rules: [
      {
        rule: "Never auto-respond to no-reply addresses",
        implementation: "Check sender against no-reply patterns",
        exceptions: ["Internal company no-reply addresses"]
      },
      {
        rule: "Limit auto-responses to 1 per sender per day",
        implementation: "Track responded senders in workflow state",
        exceptions: ["Emails marked as highest priority"]
      }
    ]
  },
  reason: "Added business rules discovered during stakeholder review"
})
```

### 3. Iterative Refinement
```javascript
update_workflow_description({
  description: {
    // ... include all existing fields ...
    // ... then modify/add specific sections ...
    
    success_criteria: [
      // ... existing criteria ...
      {
        criterion: "Template relevance",
        measurement: "User feedback on auto-response quality",
        threshold: "< 2% negative feedback rate"
      }
    ],
    
    external_resources: [
      {
        name: "Response Templates API",
        type: "REST API",
        url: "https://api.company.com/templates",
        authentication: "Bearer token from env:API_TOKEN",
        notes: "Provides context-aware response templates"
      }
    ]
  },
  reason: "Added template API integration and quality metrics"
})
```

## Integration with Director Workflow

### 1. Context Injection
The description appears in Director's context as Part 2:
```
(2) WORKFLOW DESCRIPTION
WORKFLOW: Gmail Auto-Responder
GOAL: Automatically respond to urgent emails...
[Summary of key sections]
```

### 2. Missing Elements Detection
The service automatically suggests missing elements:
```javascript
suggestMissingElements(descriptionData) {
  const suggestions = [];
  if (\!descriptionData.workflow_name) {
    suggestions.push('Give your workflow a descriptive name');
  }
  if (\!descriptionData.success_criteria || descriptionData.success_criteria.length === 0) {
    suggestions.push('Define measurable success criteria');
  }
  // ... more checks
  return suggestions;
}
```

### 3. Version History
Each update creates a new version with full audit trail:
- Version number increments
- Timestamp recorded
- Change reason preserved
- Previous versions accessible

## Best Practices

### 1. Completeness Over Brevity
```javascript
// ❌ Bad: Vague requirements
{
  goal: "Handle emails",
  happy_path_steps: ["Login", "Process", "Done"]
}

// ✅ Good: Detailed specifications
{
  goal: "Automatically classify and respond to customer support emails based on urgency and content type",
  happy_path_steps: [
    {
      step_number: 1,
      description: "Authenticate with Gmail using OAuth2 flow",
      expected_outcome: "Valid session token obtained and stored"
    }
    // ... detailed steps
  ]
}
```

### 2. Capture Business Logic Early
Document rules that affect implementation:
- Rate limits
- Business hours
- Priority matrices
- Compliance requirements

### 3. Define Clear Success Metrics
Make success measurable:
- Response times
- Accuracy rates
- Error thresholds
- User satisfaction

### 4. Document Integration Points
Specify external dependencies:
- APIs and endpoints
- Authentication methods
- Data formats
- Error responses

### 5. Plan for Failure
Document edge cases thoroughly:
- Network failures
- UI changes
- Data anomalies
- Permission issues

## Common Patterns

### E-commerce Workflow
```javascript
{
  workflow_name: "Inventory Restock Monitor",
  actors: ["Shopify Admin API", "Supplier Portal", "Notification System"],
  data_contracts: [
    {
      name: "Inventory Level",
      type: "input",
      schema: {/* ... */},
      source: "Shopify API",
      validation_rules: ["SKU must exist", "Quantity >= 0"]
    }
  ],
  business_rules: [
    {
      rule: "Reorder when stock < 20% of max",
      implementation: "Calculate threshold per SKU based on historical sales",
      exceptions: ["Seasonal items", "Discontinued products"]
    }
  ]
}
```

### Data Processing Workflow
```javascript
{
  workflow_name: "Daily Sales Report Generator",
  trigger: "Scheduled at 2 AM EST daily",
  success_criteria: [
    {
      criterion: "Report completeness",
      measurement: "All active stores included",
      threshold: "100% coverage"
    },
    {
      criterion: "Processing time",
      measurement: "End-to-end execution",
      threshold: "< 30 minutes"
    }
  ]
}
```

## Error Prevention

### 1. Schema Validation
The service validates the description structure to prevent:
- Missing required fields
- Invalid data types
- Inconsistent references

### 2. Reason Tracking
Every update requires a reason, creating accountability:
- "Initial requirements from user"
- "Added error handling after testing"
- "Updated success criteria based on stakeholder feedback"

### 3. Immutable History
Previous versions are never deleted, enabling:
- Rollback capabilities
- Audit trails
- Change analysis

## Summary

The `update_workflow_description` function is more than a documentation tool—it's a requirements engineering system that:
1. Forces thorough analysis before building
2. Captures business logic and edge cases
3. Provides success criteria for validation
4. Maintains comprehensive audit trails
5. Guides Director's implementation decisions

By investing time in a complete description, Director can build more robust, maintainable workflows that truly meet user needs.
EOF < /dev/null