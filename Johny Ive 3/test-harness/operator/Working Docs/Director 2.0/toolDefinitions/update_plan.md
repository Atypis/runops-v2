# update_plan Tool Documentation

## Purpose
The `update_plan` function manages the structured implementation plan for building workflows. It defines **HOW** the workflow will be built, tracking phases, tasks, and progress throughout the development lifecycle.

## Function Definition
```javascript
{
  name: 'update_plan',
  description: 'Update the current workflow plan with structured phases and tasks. This is the primary tool for Director 2.0 planning methodology.',
  parameters: {
    type: 'object',
    properties: {
      plan: {
        type: 'object',
        description: 'Complete plan object with phases, tasks, and status tracking',
        properties: {
          overall_goal: {
            type: 'string',
            description: 'Clear description of the workflow goal'
          },
          current_phase: {
            type: 'string', 
            description: 'Name of the phase currently being worked on'
          },
          phases: {
            type: 'array',
            description: 'Array of workflow phases with tasks',
            items: {
              type: 'object',
              properties: {
                phase_name: { type: 'string' },
                status: { 
                  type: 'string',
                  enum: ['pending', 'in_progress', 'completed', 'failed']
                },
                tasks: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      task_id: { type: 'number' },
                      description: { type: 'string' },
                      status: { 
                        type: 'string',
                        enum: ['pending', 'in_progress', 'completed', 'failed']
                      },
                      node_ids: { 
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Associated node IDs/aliases for traceability'
                      },
                      notes: { type: 'string' }
                    },
                    required: ['task_id', 'description', 'status']
                  }
                }
              },
              required: ['phase_name', 'status']
            }
          },
          next_actions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Immediate next steps to take'
          },
          blockers: {
            type: 'array', 
            items: { type: 'string' },
            description: 'Current blockers preventing progress'
          },
          notes: {
            type: 'string',
            description: 'General notes about the plan or discoveries'
          }
        },
        required: ['overall_goal', 'current_phase', 'phases']
      },
      reason: {
        type: 'string',
        description: 'Why the plan is being updated (for audit trail)'
      }
    },
    required: ['plan', 'reason']
  }
}
```

## Usage Examples

### Initial Plan Creation
```javascript
await update_plan({
  plan: {
    overall_goal: "Build Gmail to Airtable email automation workflow",
    current_phase: "Authentication Setup",
    phases: [
      {
        phase_name: "Authentication Setup",
        status: "in_progress",
        tasks: [
          {
            task_id: 1,
            description: "Scout Gmail login page structure",
            status: "pending"
          },
          {
            task_id: 2,
            description: "Build login flow with credentials",
            status: "pending"
          },
          {
            task_id: 3,
            description: "Handle 2FA if present",
            status: "pending"
          }
        ]
      },
      {
        phase_name: "Email Search & Filtering",
        status: "pending",
        tasks: [
          {
            task_id: 4,
            description: "Navigate to inbox",
            status: "pending"
          },
          {
            task_id: 5,
            description: "Implement search with date filter",
            status: "pending"
          }
        ]
      },
      {
        phase_name: "Data Extraction",
        status: "pending",
        tasks: [
          {
            task_id: 6,
            description: "Extract email metadata",
            status: "pending"
          },
          {
            task_id: 7,
            description: "Classify emails by type",
            status: "pending"
          }
        ]
      },
      {
        phase_name: "Airtable Integration",
        status: "pending",
        tasks: [
          {
            task_id: 8,
            description: "Navigate to Airtable",
            status: "pending"
          },
          {
            task_id: 9,
            description: "Create records with extracted data",
            status: "pending"
          }
        ]
      }
    ],
    next_actions: [
      "Deploy scout to Gmail login page",
      "Identify stable selectors for email/password fields"
    ],
    blockers: []
  },
  reason: "Initial plan creation based on approved workflow description"
});
```

### Progress Update
```javascript
await update_plan({
  plan: {
    overall_goal: "Build Gmail to Airtable email automation workflow",
    current_phase: "Authentication Setup",
    phases: [
      {
        phase_name: "Authentication Setup",
        status: "in_progress",
        tasks: [
          {
            task_id: 1,
            description: "Scout Gmail login page structure",
            status: "completed",
            node_ids: ["scout_login"],
            notes: "Found stable selectors: #identifierId, #identifierNext"
          },
          {
            task_id: 2,
            description: "Build login flow with credentials",
            status: "in_progress",
            node_ids: ["nav_gmail", "enter_email", "click_next"]
          },
          {
            task_id: 3,
            description: "Handle 2FA if present",
            status: "pending"
          }
        ]
      }
      // ... other phases remain unchanged
    ],
    next_actions: [
      "Complete password entry nodes",
      "Test login flow end-to-end",
      "Scout for 2FA detection"
    ],
    blockers: [],
    notes: "Gmail uses multi-step login. Email and password on separate pages."
  },
  reason: "Completed initial scouting, building login nodes"
});
```

### Handling Blockers
```javascript
await update_plan({
  plan: {
    // ... other fields
    current_phase: "Authentication Setup",
    phases: [
      {
        phase_name: "Authentication Setup",
        status: "in_progress",
        tasks: [
          // ... other tasks
          {
            task_id: 3,
            description: "Handle 2FA if present",
            status: "failed",
            notes: "User has 2FA enabled, cannot proceed automatically"
          }
        ]
      }
    ],
    next_actions: [
      "Discuss 2FA handling options with user",
      "Consider app-specific password approach"
    ],
    blockers: [
      "Gmail 2FA requires manual intervention or app-specific password"
    ]
  },
  reason: "Encountered 2FA blocker during authentication testing"
});
```

## Best Practices

### 1. Update Frequency
- Update after completing each task
- Update when discovering new information
- Update when encountering blockers
- Update when changing approach

### 2. Task Granularity
- Keep tasks small and actionable (1-3 nodes per task)
- Each task should have a clear completion criteria
- Associate node IDs with tasks for traceability

### 3. Phase Organization
```javascript
// Good phase structure
phases: [
  { phase_name: "Authentication", ... },      // Clear boundary
  { phase_name: "Data Collection", ... },     // Logical grouping
  { phase_name: "Data Processing", ... },     // Sequential flow
  { phase_name: "Output Generation", ... }    // End result
]

// Poor phase structure
phases: [
  { phase_name: "Do Everything", ... },       // Too broad
  { phase_name: "Misc Tasks", ... },          // No clear purpose
  { phase_name: "Node Creation", ... }        // Implementation detail
]
```

### 4. Status Management
- Only one phase should be `in_progress` at a time
- Within a phase, multiple tasks can be `in_progress`
- Mark tasks `completed` immediately upon finishing
- Use `failed` status with explanatory notes

### 5. Next Actions
- Keep next actions specific and immediately actionable
- 2-4 next actions is ideal
- Remove completed actions in the next update
- Next actions should align with current phase

## Technical Implementation

### Storage
- Stored in `director_plans` table in Supabase
- Each update creates a new version (never overwrites)
- Maintains full history with timestamps

### Context Integration
- Appears as Part 3 in Director's 7-part context structure
- Latest plan is automatically injected into context
- Summary version used to manage token usage

### Related Functions
- `get_current_plan()` - Retrieve the current plan
- `update_workflow_description()` - Update requirements (WHAT)
- `execute_nodes()` - Execute tasks defined in plan

## Common Patterns

### 1. Standard Workflow Phases
```javascript
// Authentication-based workflows
["Authentication Setup", "Navigation", "Data Extraction", "Processing", "Output"]

// Data processing workflows  
["Input Collection", "Validation", "Transformation", "Storage", "Reporting"]

// Multi-system workflows
["System A Login", "System A Operations", "System B Login", "System B Operations", "Reconciliation"]
```

### 2. Task Status Progression
```
pending → in_progress → completed
                     ↘
                       failed → pending (after fix)
```

### 3. Plan Evolution
1. Initial plan with all phases/tasks as `pending`
2. First phase becomes `in_progress`
3. Tasks progress through statuses
4. Phase marked `completed` when all tasks done
5. Next phase begins
6. Repeat until all phases complete

## Error Handling

The function handles several edge cases:
- Missing required fields → Returns validation error
- Invalid status values → Returns enum constraint error
- Database connection issues → Graceful fallback
- Concurrent updates → Latest version wins

## Integration with Workflow Loop

The plan integrates with Director's core loop:

```
Plan → Scout → Build → Execute → Validate → Update Plan → Repeat
```

Each cycle:
1. Check current plan for next actions
2. Execute the actions (scout, build, etc.)
3. Update plan with results
4. Identify new next actions
5. Continue until plan is complete