# [OUTDATED] Workflow Operator: The System That Builds The System

> ⚠️ **This document is outdated** - See `architecture-overview.md` and `director.md` for current architecture. The "Operator" is now called "Director" to clarify it designs workflows, not executes them.

## Core Concept

Instead of pre-defining workflows, an intelligent operator constructs them in real-time through human-AI collaboration. Think of it as pair programming for browser automation.

## Architecture Overview

```
Human Intent → AI Operator → Proposed Action → Human Confirmation → Execution → Learning
                    ↑                                                              ↓
                    └──────────────── Context & Understanding ←───────────────────┘
```

## Key Components

### 1. The Operator (AI Director)
- Maintains conversation context and goal understanding
- Proposes next logical steps based on current state
- Learns from corrections and builds workflow incrementally
- Can backtrack and try alternative approaches

### 2. Execution Modes

#### Interactive Mode (Learning/Building)
```
Operator: "I need to log into Gmail. I'll navigate to mail.google.com"
[Preview] → Human: ✓ Confirm
[Execute] → Success
Operator: "I see a login form. I'll enter the email: michaelburner595@gmail.com"
[Preview] → Human: ✓ Confirm
[Execute] → Success
```

#### Autonomous Mode (Running learned workflows)
- Executes confirmed patterns without asking
- Only pauses for unexpected states or critical actions

### 3. Confirmation Hierarchy

**Auto-execute (inform after):**
- Navigation to URLs
- Waiting/delays
- Reading/extraction

**Confirm before (preview):**
- Form inputs
- Clicks on buttons
- Data modifications

**Explain & confirm (detailed):**
- Loops/iterations
- Conditional branches
- Cross-domain actions

## Implementation Phases

### Phase 1: Basic Operator (MVP)
```javascript
class WorkflowOperator {
  constructor(options) {
    this.mode = 'interactive'; // or 'autonomous'
    this.context = [];
    this.workflow = [];
    this.stagehand = null;
  }

  async buildWorkflow(goal, context) {
    // Initial understanding
    const plan = await this.createInitialPlan(goal, context);
    
    // Iterative building
    while (!this.isComplete()) {
      const nextStep = await this.proposeNextStep();
      const feedback = await this.getHumanFeedback(nextStep);
      
      if (feedback.approved) {
        const result = await this.execute(nextStep);
        this.learn(result, feedback);
      } else {
        await this.adjustApproach(feedback);
      }
    }
    
    return this.workflow;
  }
}
```

### Phase 2: State Awareness
- Visual state recognition ("I see we're in the inbox")
- Context tracking ("We just logged in, now looking for search")
- Recovery detection ("That didn't work, let me try another way")

### Phase 3: Pattern Learning
- Recognize repeated sequences
- Build reusable sub-workflows
- Suggest optimizations

### Phase 4: Multi-Modal Input
- Voice commands for corrections
- Screenshot annotations
- Video demonstration import

## Interaction Patterns

### 1. Goal Setting
```
Human: "I need to extract investor emails from Gmail and add them to Airtable"
Operator: "I understand. Let me break this down:
1. Log into Gmail
2. Search for investor emails
3. Extract the relevant ones
4. Log into Airtable
5. Add new records

Shall we start with Gmail login?"
```

### 2. Step Proposal
```
Operator: "I can see the Gmail login page. I'll:
- Enter 'michaelburner595@gmail.com' in the email field
- Click the 'Next' button

Preview: [shows screenshot with highlighted elements]
Proceed?"
```

### 3. Error Handling
```
Operator: "The login failed. I see an error message about 2FA.
Options:
1. Wait for you to complete 2FA manually
2. Try a different authentication method
3. Skip to Airtable setup first

What would you prefer?"
```

### 4. Learning from Correction
```
Human: "No, don't click that Add button. You need to use the '+' icon in the toolbar"
Operator: "I see, the '+' icon in the toolbar, not the 'Add' button. 
I'll remember this for Airtable interactions. 
[Updates pattern library]"
```

## Technical Implementation

### Core Technologies
- **LLM**: GPT-4 for understanding and planning
- **Vision**: GPT-4V for visual state recognition
- **Browser**: StageHand for execution
- **State**: Vector DB for pattern matching

### Workflow Representation
```javascript
{
  id: "gmail-airtable-flow",
  goal: "Extract investor emails and sync to CRM",
  steps: [
    {
      id: 1,
      description: "Navigate to Gmail",
      action: { type: "navigate", url: "https://mail.google.com" },
      confirmationLevel: "auto",
      learned: true,
      patterns: ["gmail", "login", "email"]
    },
    {
      id: 2,
      description: "Handle authentication",
      action: { type: "conditional", ... },
      confirmationLevel: "preview",
      learned: true,
      subflow: "gmail-auth-flow"
    }
  ],
  context: {
    credentials: { /* encrypted */ },
    preferences: { confirmationLevel: "balanced" }
  }
}
```

### Learning Storage
```javascript
{
  patterns: [
    {
      trigger: "Gmail login page detected",
      solution: "gmail-auth-flow",
      confidence: 0.95,
      lastUsed: "2024-01-20"
    }
  ],
  failures: [
    {
      context: "Airtable record creation",
      issue: "Used 'Add' button instead of '+' icon",
      resolution: "Use toolbar '+' icon",
      frequency: 1
    }
  ]
}
```

## User Experience

### CLI Interface (MVP)
```bash
$ operator start "Extract investor emails to CRM"

🎯 Goal understood. Starting workflow construction...

📍 Step 1: Navigate to Gmail
   → Navigating to https://mail.google.com
   ✓ Success

🤔 I see a login page. Should I:
   1. Enter your email (michaelburner595@gmail.com)
   2. Use a different account
   3. Skip Gmail for now
   
Choice (1/2/3): 1

📝 Step 2: Entering email...
   [Preview shows highlighted email field]
   Confirm? (y/n/modify): y
   ✓ Email entered

...
```

### Web Interface (Future)
- Split screen: Browser view + Operator chat
- Visual highlights on proposed actions
- Drag-and-drop correction
- Workflow visualization

## Success Metrics

### Phase 1 Goals
- Build a 3-step workflow with human guidance
- Successfully handle one error correction
- Save and replay a learned workflow

### Long-term Goals
- 90% autonomous execution after training
- <5 confirmations needed for new workflows
- Pattern library of 100+ common actions

## Competitive Advantages

1. **No coding required** - Natural language all the way
2. **Learns from usage** - Gets better over time
3. **Graceful failures** - Human can always intervene
4. **Explainable** - Shows reasoning at each step
5. **Transferable** - Patterns work across similar sites

## Open Questions

1. How much context to maintain? (full conversation vs key decisions)
2. When to generalize patterns? (after 2 uses? 5? 10?)
3. How to handle user-specific preferences?
4. Privacy/security for learned credentials?
5. How to share learned patterns between users?

## Next Steps

1. Build basic operator.js with console interaction
2. Test on simple 3-step workflow
3. Add visual state recognition
4. Build pattern storage system
5. Create web UI for better interaction

The key insight: We're not building workflows, we're building a workflow teacher that learns how each human prefers to work.