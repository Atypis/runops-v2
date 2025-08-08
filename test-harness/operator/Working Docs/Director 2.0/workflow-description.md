# High-Fidelity Workflow Description Feature

## Executive Summary

The Workflow Description feature introduces a high-fidelity, user-approved specification that serves as the authoritative contract between users and the automation system. It captures every rule, data contract, and edge case policy that defines "done" - preventing misalignment across all agents (Operator, future Tester, etc.).

This feature transforms Director 2.0's context from a 6-part to a 7-part structure, inserting the Workflow Description between System Prompt and Current Plan.

## Core Philosophy

### The Problem
Currently, critical business rules and edge case policies live only in conversation history or are discovered mid-build. This leads to:
- Misaligned expectations ("that's not what I meant")
- Incomplete automations that miss edge cases
- Difficulty sharing context with future agents (Tester, Optimizer)
- No single source of truth for what defines success

### The Solution
A high-fidelity Workflow Description that:
- **Captures every rule** that can change the user's definition of "done"
- **Serves as the contract** that all agents reference
- **Separates the "what"** (requirements) from the "how" (implementation)
- **Enables traceability** from implementation back to requirements

## Architecture Overview

### 7-Part Context Structure (Enhanced)
```
(1) SYSTEM PROMPT
    Director instructions and methodology
    
(2) WORKFLOW DESCRIPTION (NEW)
    High-fidelity specification of WHAT we're building
    
(3) CURRENT PLAN  
    Structured phases and tasks of HOW we're building it
    
(4) WORKFLOW SNAPSHOT
    Current nodes and their configuration
    
(5) WORKFLOW VARIABLES
    Current state and data flow
    
(6) BROWSER STATE
    Live browser tabs and context
    
(7) CONVERSATION HISTORY
    Filtered chat history
```

## High-Fidelity Workflow Description Schema

### Structure Guidelines
The Workflow Description uses flexible JSON but should capture these high-fidelity elements:

```javascript
{
  // === CORE IDENTIFICATION ===
  "workflow_name": "Gmail → Airtable Email Extractor",
  "goal": "Move startup-related emails to Airtable daily at 07:00",
  "trigger": "CRON @daily 07:00 (Phase 1: Manual)",
  
  // === ACTORS & INTEGRATIONS ===
  "actors": [
    "Gmail Account (user@startup.com)",
    "Airtable Base (app123/Startup CRM)",
    "Zendesk Instance (startup.zendesk.com)",
    "Slack Workspace (startup.slack.com)"
  ],
  
  // === HAPPY PATH SPECIFICATION ===
  "happy_path_steps": [
    "1. Navigate to Gmail inbox",
    "2. Search for label:startups AND newer_than:24h",
    "3. For each email result:",
    "   a. Extract sender, subject, thread URL, body preview",
    "   b. Classify email type using AI (investor/customer/support)",
    "   c. Check if thread_url already exists in Airtable",
    "4. Based on classification, route to appropriate handler",
    "5. Create Airtable record with extracted data",
    "6. Mark email as processed (add 'auto-processed' label)",
    "7. Send summary to Slack #automations channel"
  ],
  
  // === DECISION MATRIX & BRANCHING LOGIC ===
  "decision_matrix": {
    "email_classification": {
      "investor": {
        "action": "Create record in 'Investors' table",
        "priority": "high",
        "notifications": ["Slack DM to founder", "Add to weekly investor report"]
      },
      "customer": {
        "action": "Create record in 'Leads' table",
        "priority": "medium",
        "notifications": ["Slack #sales channel"]
      },
      "support": {
        "action": "Create Zendesk ticket + Airtable log",
        "priority": "normal",
        "notifications": ["Assign to support team"]
      },
      "unclassified": {
        "action": "Create record in 'Inbox' table for manual review",
        "priority": "low",
        "notifications": []
      }
    }
  },
  
  // === DATA CONTRACTS ===
  "data_contracts": {
    "email_extraction": {
      "required": ["sender", "subject", "thread_url", "received_date"],
      "optional": ["body_preview", "attachments", "cc_list", "labels"]
    },
    "airtable_record": {
      "investors_table": {
        "required_fields": ["company_name", "contact_email", "subject", "thread_url", "classification_confidence", "processed_at"],
        "optional_fields": ["body_preview", "attachments", "priority", "next_action"]
      },
      "leads_table": {
        "required_fields": ["sender", "subject", "thread_url", "lead_score", "processed_at"],
        "optional_fields": ["company_domain", "body_preview", "product_interest"]
      }
    },
    "zendesk_ticket": {
      "required_fields": ["requester_email", "subject", "description", "priority"],
      "optional_fields": ["attachments", "tags", "custom_fields.gmail_thread_url"]
    }
  },
  
  // === BUSINESS RULES & CONSTRAINTS ===
  "business_rules": [
    "Never process the same email twice (check by thread_url)",
    "Preserve original email read/unread status",
    "Process maximum 100 emails per run to avoid rate limits",
    "Only process emails from last 24 hours unless manually overridden",
    "Skip emails from no-reply addresses unless they match VIP domain list",
    "Maintain audit trail of all processed emails",
    "Respect Gmail API quota (250 units per user per second)"
  ],
  
  // === EDGE CASE POLICIES ===
  "edge_case_policies": {
    "authentication_failure": {
      "2fa_prompt": "Abort run, notify user via webhook, log as auth_required",
      "session_expired": "Attempt re-authentication once, abort if fails",
      "api_credentials_invalid": "Immediate abort, alert admin"
    },
    "data_issues": {
      "no_matching_emails": "Log success with zero records processed",
      "malformed_email": "Skip email, log warning, continue processing",
      "duplicate_thread_url": "Skip email, increment duplicate counter",
      "classification_confidence_low": "Route to manual review queue"
    },
    "integration_failures": {
      "airtable_rate_limit": "Exponential backoff (1s, 2s, 4s), max 3 retries",
      "airtable_api_error": "Queue for retry, continue with other emails",
      "zendesk_unavailable": "Store in fallback queue, notify support team",
      "network_timeout": "Retry with exponential backoff, max 3 attempts"
    },
    "resource_limits": {
      "execution_time_exceeded": "Gracefully stop at 4.5 minutes, log progress",
      "memory_limit_approached": "Process in smaller batches"
    }
  },
  
  // === SUCCESS CRITERIA ===
  "success_criteria": [
    "Run completes without unhandled errors",
    "Airtable record count matches processed email count (±duplicate count)",
    "All processed emails have 'auto-processed' label",
    "Original email read/unread status preserved",
    "Execution time < 5 minutes",
    "No emails processed twice (by thread_url)",
    "Audit log contains entry for each processed email",
    "Summary posted to Slack with metrics"
  ],
  
  // === EXTERNAL RESOURCES ===
  "external_resources": {
    "sample_data": "https://gist.github.com/user/sample-inbox-export.json",
    "demo_video": "https://loom.com/share/abc123-workflow-demo",
    "airtable_schema": "https://airtable.com/shrABC123/tbIXYZ789",
    "api_documentation": {
      "gmail": "https://developers.google.com/gmail/api/guides",
      "airtable": "https://airtable.com/api/meta",
      "zendesk": "https://developer.zendesk.com/api-reference"
    }
  },
  
  // === REVISION HISTORY ===
  "revision_history": [
    {
      "version": 1,
      "date": "2025-01-08T10:00:00Z",
      "author": "user",
      "changes": "Initial specification approved"
    },
    {
      "version": 2,
      "date": "2025-01-08T14:30:00Z",
      "author": "user",
      "changes": "Added Zendesk integration for support emails"
    }
  ]
}
```

### What Belongs in the Description

| Category | Examples to Include |
|----------|-------------------|
| **Goal & Trigger** | "Move startup-related emails to Airtable daily at 07:00" |
| **Happy Path Steps** | "1. Navigate to Gmail → 2. Search label:startups → 3. For each result..." |
| **Decision Matrix** | "If investor email → High priority + Slack DM to founder" |
| **Data Contracts** | "Each Airtable record must contain: sender, subject, thread_url, classification" |
| **Business Rules** | "Skip duplicates, preserve read status, max 100 emails per run" |
| **Edge Case Policies** | "On 2FA prompt → abort and notify user" |
| **Success Criteria** | "Zero unhandled errors, record count matches processed emails" |
| **External Resources** | Sample data, demo videos, API schemas |
| **Revision History** | Timestamped changes with reasons |

**Heuristic**: If omitting a fact could lead to the wrong outcome—even if nodes execute perfectly—it belongs here.

### What Stays Out

- Implementation details (CSS selectors, wait times)
- Low-level node structure
- Debugging fixtures
- Temporary workarounds

These belong in the Plan or individual nodes. The description remains technology-agnostic.

## Implementation Details

### Database Schema

```sql
CREATE TABLE workflow_descriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id) ON DELETE CASCADE,
  description_version integer DEFAULT 1,
  description_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_workflow_descriptions_workflow_id ON workflow_descriptions(workflow_id);
CREATE INDEX idx_workflow_descriptions_version ON workflow_descriptions(workflow_id, description_version DESC);

-- Add updated_at trigger
CREATE TRIGGER update_workflow_descriptions_updated_at BEFORE UPDATE ON workflow_descriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE workflow_descriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on workflow_descriptions" ON workflow_descriptions
  FOR ALL USING (true);
```

### WorkflowDescriptionService

```javascript
// backend/services/workflowDescriptionService.js
import { supabase } from '../config/supabase.js';

export class WorkflowDescriptionService {
  /**
   * Create initial description for a workflow
   */
  async createDescription(workflowId, descriptionData) {
    const { data, error } = await supabase
      .from('workflow_descriptions')
      .insert({
        workflow_id: workflowId,
        description_version: 1,
        description_data: descriptionData
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Get the current (latest) description for a workflow
   */
  async getCurrentDescription(workflowId) {
    if (!workflowId) return null;
    
    const { data, error } = await supabase
      .from('workflow_descriptions')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('description_version', { ascending: false })
      .limit(1)
      .single();
      
    if (error && error.code === 'PGRST116') return null; // No description exists
    if (error) throw error;
    
    return data;
  }

  /**
   * Update description (creates new version)
   */
  async updateDescription(workflowId, descriptionData, reason = 'Description updated') {
    // Get current version
    const current = await this.getCurrentDescription(workflowId);
    const nextVersion = current ? current.description_version + 1 : 1;
    
    // Add to revision history
    const revisionHistory = descriptionData.revision_history || [];
    revisionHistory.push({
      version: nextVersion,
      date: new Date().toISOString(),
      author: 'director',
      changes: reason
    });
    
    const enhancedData = {
      ...descriptionData,
      revision_history: revisionHistory
    };
    
    const { data, error } = await supabase
      .from('workflow_descriptions')
      .insert({
        workflow_id: workflowId,
        description_version: nextVersion,
        description_data: enhancedData
      })
      .select()
      .single();
      
    if (error) throw error;
    return data;
  }

  /**
   * Get formatted summary for context injection
   */
  getDescriptionSummary(descriptionData) {
    if (!descriptionData) return 'No description available';
    
    const { workflow_name, goal, trigger, happy_path_steps, actors, success_criteria } = descriptionData;
    
    let summary = `WORKFLOW: ${workflow_name || 'Unnamed'}\n`;
    summary += `GOAL: ${goal || 'Not specified'}\n`;
    summary += `TRIGGER: ${trigger || 'Manual'}\n\n`;
    
    if (actors && actors.length > 0) {
      summary += `ACTORS:\n`;
      actors.forEach(actor => summary += `• ${actor}\n`);
      summary += '\n';
    }
    
    if (happy_path_steps && happy_path_steps.length > 0) {
      summary += `HAPPY PATH:\n`;
      happy_path_steps.forEach(step => summary += `${step}\n`);
      summary += '\n';
    }
    
    if (success_criteria && success_criteria.length > 0) {
      summary += `SUCCESS CRITERIA:\n`;
      success_criteria.forEach(criterion => summary += `✓ ${criterion}\n`);
    }
    
    return summary;
  }

  /**
   * Suggest missing high-fidelity elements
   */
  suggestMissingElements(descriptionData) {
    const suggestions = [];
    
    if (!descriptionData.decision_matrix) {
      suggestions.push('Add decision matrix for branching logic');
    }
    if (!descriptionData.data_contracts) {
      suggestions.push('Define data contracts for integrations');
    }
    if (!descriptionData.edge_case_policies) {
      suggestions.push('Specify edge case handling policies');
    }
    if (!descriptionData.business_rules || descriptionData.business_rules.length === 0) {
      suggestions.push('Document business rules and constraints');
    }
    
    return suggestions;
  }
}
```

### Tool Definition

Add to `backend/tools/toolDefinitions.js`:

```javascript
{
  type: 'function',
  function: {
    name: 'update_workflow_description',
    description: 'Update the high-fidelity workflow description that serves as the authoritative contract. This defines WHAT we are building (requirements), while the plan defines HOW we build it (implementation). Include all business rules, data contracts, edge cases, and success criteria.',
    parameters: {
      type: 'object',
      properties: {
        description: {
          type: 'object',
          description: 'Complete workflow description with all high-fidelity details. See system prompt for structure guidelines.'
        },
        reason: {
          type: 'string',
          description: 'Why the description is being created or updated (for revision history)'
        }
      },
      required: ['description', 'reason']
    }
  }
}
```

### Director Service Integration

Update `backend/services/directorService.js`:

```javascript
// Add import
import { WorkflowDescriptionService } from './workflowDescriptionService.js';

// In constructor
this.workflowDescriptionService = new WorkflowDescriptionService();

// In buildDirector2Context method, after Part 1 (System Prompt):
// Part 2: Workflow Description
const currentDescription = await this.workflowDescriptionService.getCurrentDescription(workflowId);
if (currentDescription) {
  parts.push(`(2) WORKFLOW DESCRIPTION\n${this.workflowDescriptionService.getDescriptionSummary(currentDescription.description_data)}`);
  
  // Check for missing elements and add suggestions
  const suggestions = this.workflowDescriptionService.suggestMissingElements(currentDescription.description_data);
  if (suggestions.length > 0) {
    parts[parts.length - 1] += `\n\nSuggested additions:\n${suggestions.map(s => `• ${s}`).join('\n')}`;
  }
} else {
  parts.push(`(2) WORKFLOW DESCRIPTION\nNo description created yet. Use update_workflow_description to capture comprehensive requirements before building.`);
}

// In processToolCalls switch statement:
case 'update_workflow_description':
  result = await this.updateWorkflowDescription(args, workflowId);
  break;

// Add handler method:
async updateWorkflowDescription(args, workflowId) {
  try {
    const { description, reason } = args;
    
    if (!description) {
      throw new Error('Description data is required');
    }
    
    if (!workflowId) {
      throw new Error('Workflow ID is required for description updates');
    }
    
    const updated = await this.workflowDescriptionService.updateDescription(
      workflowId, 
      description, 
      reason
    );
    
    return {
      success: true,
      message: `Workflow description updated successfully (version ${updated.description_version})`,
      description_id: updated.id,
      version: updated.description_version,
      updated_at: updated.updated_at
    };
    
  } catch (error) {
    console.error('Failed to update workflow description:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### System Prompt Enhancement

Add to `DIRECTOR_2_METHODOLOGY` in `backend/prompts/directorPrompt.js`:

```javascript
### High-Fidelity Workflow Description - Your First Priority

Before creating ANY nodes, you MUST gather comprehensive requirements and create a Workflow Description. This serves as the authoritative contract that prevents misalignment.

#### Information Gathering Process:
1. **Start with the goal** - What automation does the user want?
2. **Probe for details** - Keep asking until you understand:
   - Every decision point and branching rule
   - All data that needs to be captured or transformed  
   - How to handle every edge case
   - What defines success vs failure
3. **Document everything** - Create a comprehensive description
4. **Get explicit confirmation** - "Does this description accurately capture what you want?"

#### What MUST be in the Description:
- **Goal & Trigger**: What are we automating and when?
- **Happy Path Steps**: Detailed sequence of the ideal flow
- **Decision Matrix**: All if/then branching logic
- **Data Contracts**: Exact fields and formats for each integration
- **Business Rules**: Constraints that must be respected
- **Edge Case Policies**: What to do when things go wrong
- **Success Criteria**: How we measure if it worked

#### Remember:
- If a detail could change the user's definition of "done", it MUST be in the description
- The description is technology-agnostic (no CSS selectors or node types)
- Any new requirement discovered during building → pause, update description, reconfirm
- Future agents (Tester, Optimizer) will use this same description

CRITICAL: Never start building until the user explicitly confirms the Workflow Description!
```

### Frontend Integration

Add to `frontend/app.js`:

```javascript
// Update tabs array
const tabs = ['description', 'plan', 'variables', 'browser', 'reasoning', 'tokens'];

// Add state
const [currentDescription, setCurrentDescription] = useState(null);

// Add loader function
const loadCurrentDescription = async () => {
  try {
    const response = await fetch(`${API_BASE}/workflows/${workflowId}/description`);
    if (response.ok) {
      const description = await response.json();
      if (description && description.description_data) {
        setCurrentDescription(description);
      }
    }
  } catch (error) {
    console.error('Failed to load workflow description:', error);
  }
};

// Add DescriptionViewer component
const DescriptionViewer = ({ description, workflowId }) => {
  if (!description || !description.description_data) {
    return (
      <div className="no-description">
        <p>No workflow description created yet.</p>
        <p className="hint">The Director will create a high-fidelity description before building.</p>
      </div>
    );
  }

  const data = description.description_data;
  
  return (
    <div className="description-viewer">
      <div className="description-header">
        <h3>{data.workflow_name || 'Unnamed Workflow'}</h3>
        <span className="version">Version {description.description_version}</span>
      </div>
      
      <div className="description-section">
        <h4>Goal</h4>
        <p>{data.goal}</p>
        <p className="trigger">Trigger: {data.trigger || 'Manual'}</p>
      </div>
      
      {data.actors && (
        <div className="description-section">
          <h4>Actors & Integrations</h4>
          <ul>
            {data.actors.map((actor, i) => <li key={i}>{actor}</li>)}
          </ul>
        </div>
      )}
      
      {data.happy_path_steps && (
        <div className="description-section">
          <h4>Happy Path</h4>
          <ol className="happy-path">
            {data.happy_path_steps.map((step, i) => (
              <li key={i} className="step">{step}</li>
            ))}
          </ol>
        </div>
      )}
      
      {data.decision_matrix && (
        <div className="description-section">
          <h4>Decision Matrix</h4>
          <div className="decision-matrix">
            {Object.entries(data.decision_matrix).map(([key, rules]) => (
              <div key={key} className="decision-category">
                <h5>{key}</h5>
                <div className="rules">
                  {Object.entries(rules).map(([condition, action]) => (
                    <div key={condition} className="rule">
                      <span className="condition">{condition}:</span>
                      <span className="action">{JSON.stringify(action, null, 2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {data.success_criteria && (
        <div className="description-section">
          <h4>Success Criteria</h4>
          <ul className="success-criteria">
            {data.success_criteria.map((criterion, i) => (
              <li key={i}>✓ {criterion}</li>
            ))}
          </ul>
        </div>
      )}
      
      {data.revision_history && (
        <div className="description-section">
          <h4>Revision History</h4>
          <div className="revisions">
            {data.revision_history.map((rev, i) => (
              <div key={i} className="revision">
                <span className="version">v{rev.version}</span>
                <span className="date">{new Date(rev.date).toLocaleString()}</span>
                <span className="changes">{rev.changes}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

### API Endpoints

Add to `backend/routes/director.js`:

```javascript
// Get current workflow description
router.get('/workflows/:workflowId/description', async (req, res) => {
  try {
    const description = await workflowDescriptionService.getCurrentDescription(req.params.workflowId);
    if (!description) {
      return res.status(404).json({ error: 'No description found' });
    }
    res.json(description);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get description history
router.get('/workflows/:workflowId/description/history', async (req, res) => {
  try {
    const history = await workflowDescriptionService.getDescriptionHistory(req.params.workflowId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## Practical Implications for the Director

### 1. Front-load Questioning
Keep probing until you have:
- Complete branching logic and decision rules
- All data fields and their validation requirements  
- Comprehensive edge case handling policies
- Clear success/failure criteria

### 2. Draft, Then Confirm
- Present the complete Workflow Description to the user
- Get explicit "looks good" before any building begins
- Use formatted output to make it easy to review

### 3. Treat Updates as Sacred
- Any new requirement discovered mid-build → pause immediately
- Update the description with the new information
- Increment version and document the change
- Get user reconfirmation before proceeding

### 4. Maintain Traceability
- Each Plan task should relate to the Workflow Description
- When building nodes, reference which requirement you're implementing
- If you can't trace a node back to the description, question if it's needed

## Benefits

### Immediate Benefits
- **Reduced misalignment** - Clear contract prevents "that's not what I meant"
- **Comprehensive coverage** - No edge cases discovered mid-build
- **User confidence** - Explicit agreement on what will be built
- **Faster development** - Less rework from misunderstood requirements

### Long-term Benefits
- **Cross-agent compatibility** - Tester agent uses same description
- **Workflow portability** - Description can regenerate implementation
- **Audit trail** - Complete history of requirement changes
- **Knowledge base** - Library of high-fidelity workflow patterns

## Migration Strategy

### Phase 1: Backend Infrastructure (Week 1)
- Database migration for `workflow_descriptions` table
- WorkflowDescriptionService implementation  
- Tool definition and handler
- API endpoints

### Phase 2: Director Integration (Week 2)
- Update buildDirector2Context for 7-part structure
- Enhance system prompt with guidelines
- Add tool handler to processToolCalls
- Test with sample workflows

### Phase 3: Frontend Enhancement (Week 3)
- Add Description tab to control panel
- Build DescriptionViewer component
- Connect to real-time updates
- Style for readability

## Success Metrics

1. **Requirement Coverage**: 95%+ of edge cases captured before building
2. **Rework Reduction**: 80% decrease in "misunderstanding" node deletions
3. **Cross-Agent Success**: Tester agent can validate using description alone
4. **User Satisfaction**: Clear contract increases trust in automation

## Conclusion

The high-fidelity Workflow Description transforms Director 2.0 from a capable builder into a requirements-first automation platform. By capturing every rule, edge case, and success criterion upfront, we create automations that truly match user intent.

This isn't just documentation - it's the contract that ensures every automation does exactly what the user expects, every time.