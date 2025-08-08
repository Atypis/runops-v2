# 🤖 Agentic Execution Framework v2.0 
## The Human-Controlled AI Workflow Automation System

---

## 📋 Table of Contents
1. [Project Overview & Evolution](#project-overview--evolution)
2. [User Experience Flow](#user-experience-flow)
3. [Product Features & Components](#product-features--components)

---

## 🎯 Project Overview & Evolution

### Current System State
Our Runops platform successfully captures workflow context through screen recordings and transforms them into structured Standard Operating Procedures (SOPs) using AI processing. Users can record workflows, upload videos, and receive interactive List-View or ReactFlow visualizations of their processes. This **Part 1** of the system is functional and provides valuable workflow documentation.

### Past Automation Attempts & Limitations
The initial approach to **Part 2** (automation execution) involved building an Agentic Execution Framework (AEF) that operated largely independently from the SOPs. The strategy was to use fully autonomous automation frameworks like Browser-Use, where you essentially:

1. **Send the agent off** with high-level instructions
2. **Wait 30+ minutes** for completion 
3. **Receive an execution report** of what happened
4. **Hope it worked correctly**

This "black box" approach revealed critical fundamental flaws:

#### The Observability Problem
- **No real-time visibility** into what the agent is actually doing
- **No intervention capability** when things go wrong
- **No understanding** of decision-making processes during execution
- **No learning mechanism** from partial successes or failures

#### The Control Problem  
- **All-or-nothing execution** - you can't run just part of a workflow
- **No human checkpoints** for critical decision points
- **No ability to pause** and provide additional context
- **No granular approval** for sensitive operations

#### The Precision Problem
- **Dynamic elements** (like email subjects, investor names) can't be predetermined
- **Loop iterations** are unknown until runtime (how many emails today?)
- **Business logic decisions** require judgment (is this email investor-related?)
- **Context-dependent actions** sometimes need real-time human input

### The Realization: Integration Over Separation
The fundamental insight is that **SOPs and automation shouldn't be separate systems**. Users already understand workflows through the SOP structure they helped create. The automation framework should **amplify and augment** this familiar mental model, not replace it with a completely different system.

### Vision: Human-Controlled AI Workflow Automation
Instead of "fire and forget" automation, we envision a system where:

- **Humans remain in control** but are augmented by AI capabilities
- **Real-time observability** shows exactly what's happening at each step
- **Granular execution control** allows running individual steps or full workflows
- **Adaptive checkpoints** can be inserted anywhere for human review
- **Live browser visualization** provides continuous feedback
- **Progressive automation** allows gradual transition from manual to automated steps

#### The Learning Partnership Vision
As users nurture and guide their AI system through repeated workflow executions, the system progressively builds up institutional knowledge and pattern recognition. Over time, users gain increasing confidence in the AI's decision-making capabilities, allowing for:

- **Reduced checkpoint frequency** for trusted, well-learned patterns
- **Autonomous handling** of routine decisions and actions
- **Predictive suggestions** based on historical workflow patterns
- **Self-improving accuracy** through continuous learning from user feedback
- **Graduated autonomy** where the system earns increased independence through proven reliability

The ultimate goal is a **collaborative intelligence** where human expertise guides AI learning, and AI capabilities amplify human efficiency - creating workflows that become more autonomous while remaining fully transparent and controllable.

This system works with **any website** (not just APIs), handles **dynamic content**, and maintains **human agency** throughout the process.

---

## 🎨 User Experience Flow

### Phase 1: SOP to AEF Transformation

#### Starting Point: Existing SOP
The user is viewing their completed SOP in the current interface - let's say the "Daily Investor Email Review and CRM Update" workflow. They can see it in both List View and ReactFlow View, with all the familiar nodes like "Process Daily Emails", "Open Email", "Switch to Airtable", etc.

#### The Magic Button Discovery
In the top-right corner of the SOP interface, next to the existing view toggles, the user notices a new element:

**🤖 "Transform to AEF" Button** - A prominent, slightly animated button with text like "Turn into Automation" or "Make This Executable"

#### The Transformation Moment
User clicks the button. The interface shows:

**Loading Experience:**
- Animated progress bar with playful, Anno-style building messages:
  - "🧠 Analyzing workflow structure..."
  - "🔧 Initializing AI agents..."  
  - "⚡ Building execution environment..."
  - "🎯 Configuring checkpoints..."
  - "🚀 AEF ready for deployment!"

This takes 10-15 seconds (probably more - could be a complex api call), building anticipation and communicating that something sophisticated is happening.

#### Interface Transformation
After loading, the user sees the interface has evolved:

**New Tab Appears:** 📋 List View | 🌊 ReactFlow View | 🤖 **AEF Control Center**

The AEF Control Center tab is now active, showing a completely transformed version of their workflow.

### Phase 2: AEF Control Center Interface

#### Layout Architecture
The screen is divided into three main sections:

**Left Panel (40% width): Workflow Control**
- Clean, list-based view of all workflow steps
- Each step shows execution status, controls, and configuration options
- Hierarchical structure clearly showing loops and sub-steps

**Right Panel (40% width): Live Browser Window**  
- Real-time browser view in containerized environment
- Shows actual websites as the agent navigates
- User can see exactly what's happening in real-time

**Bottom Panel (20% height): Execution Log**
- Real-time activity feed
- Technical details for power users
- Executive summary for business users

#### Left Panel Deep Dive: Workflow Control

**Global Controls (Top of Left Panel):**
```
🎯 Daily Investor Email Review and CRM Update
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
▶️ [RUN ALL]  🛑 [STOP]  ⏸️ [PAUSE]  🔄 [RESET]

⚙️ Settings  |  🔐 Secrets  |  📊 Analytics
```

**Individual Step Controls:**
Each workflow step appears as an expandable card:

```
🎯 1. Setup Applications                           [▶️ RUN] [⚙️]
   ✅ Checkpoint: Before execution
   📝 "Open Gmail and Airtable in browser tabs"
   🔐 Requires: gmail_credentials, airtable_access
   
🔄 2. Process Daily Emails (LOOP)                  [▶️ RUN] [⚙️] 
   📧 Discovered Items: Loading... [🔍 DISCOVER]
   ┌─ Email 1: "Re: Series A Investment Terms"     [▶️] [📋]
   ┌─ Email 2: "Investment Committee Decision"      [▶️] [📋] 
   ┌─ Email 3: "Quarterly Newsletter"              [⏭️ SKIP]
   ┌─ Email 4: "Follow-up on Due Diligence"       [▶️] [📋]
   └─ Email 5: "Meeting Confirmation"              [⏭️ SKIP]
   
   📋 2.1 Open Email                               [▶️ RUN] [⚙️]
      ✅ Checkpoint: Before opening
      📝 "Click on the email to open it"
      
   ❓ 2.2 Is Email Investor Related?               [▶️ RUN] [⚙️]
      ✅ Checkpoint: Review decision
      📝 "Analyze email content for investor relevance"
      
   🔧 2.3 Process Investor Email                   [▶️ RUN] [⚙️]
      ✅ Checkpoint: Before Airtable updates
      📝 "Update or create investor record in CRM"
```

#### Checkpoint Configuration
When a user clicks the ⚙️ settings icon on any step, they see:

**Checkpoint Options:**
- ☐ No checkpoints (fully automated)
- ☑️ Before execution (default)
- ☐ After execution  
- ☐ On errors only
- ☐ Custom: [text field for specific conditions]

**Execution Method:**
- ☑️ AI Agent (Stagehand/Browser-Use)
- ☐ API Integration (if available)
- ☐ Manual Step (human performs action)

**Security & Credentials:**
- Secret key assignments for this step
- Permission levels required
- Data access scope

### Phase 3: Execution Experience

#### Starting Execution
User clicks **▶️ [RUN ALL]** button:

**Safety Confirmation Popup:**
```
⚠️  Execute Complete Workflow?

This will run the entire "Daily Investor Email Review" workflow.

Estimated time: 15-20 minutes
Checkpoints enabled: 7 human review points
Websites accessed: Gmail, Airtable
Credentials used: gmail_user, airtable_api

You can pause or stop execution at any time.

[📋 SHOW CHECKPOINT SUMMARY]  [❌ Cancel]  [✅ Run Workflow]
```

#### Live Execution Experience

**Right Panel - Browser Window:**
The containerized browser window comes alive:
- Browser opens and navigates to gmail.com
- User sees the actual Gmail login screen
- Real-time typing of credentials (masked for security)
- Navigation to inbox, application of filters
- Each action is clearly visible and trackable

**Left Panel - Step Status Updates:**
Steps update in real-time with status indicators:
```
🟢 1. Setup Applications                    ✅ COMPLETED (2.3s)
🟡 2. Process Daily Emails (LOOP)          🔄 RUNNING...
   🟢 ┌─ Email Discovery                    ✅ FOUND 5 EMAILS
   🟡 ┌─ Email 1: "Re: Series A..."        🔄 PROCESSING
   🔄    📋 2.1 Open Email                 🔄 EXECUTING
```

#### Human Checkpoint Experience
When the system hits the first checkpoint:

**Checkpoint Modal Appears:**
```
🛑 Human Checkpoint Required

Step: Open Email
About to: Click on email "Re: Series A Investment Terms"

Current browser state: Gmail inbox loaded, 5 emails visible
Target element: Email row with subject "Re: Series A Investment Terms"
Action: Click to open email for review

Preview what happens next:
• Email will open in Gmail interface  
• Content will be analyzed for investor relevance
• If relevant, investor data will be extracted

[📷 TAKE SCREENSHOT]  [🔍 INSPECT ELEMENT]

[❌ Cancel]  [⏭️ Skip This Email]  [✅ Proceed]
```

#### Loop Iteration Management
When processing the email loop, users see:

**Dynamic Loop Control:**
```
🔄 2. Process Daily Emails (LOOP)                    [⏸️ PAUSE LOOP]

Progress: Email 2 of 5 (40% complete)
Estimated remaining time: 8 minutes

Current Email: "Investment Committee Decision"        [⏭️ SKIP] [✅ PROCESS]
  🟡 Analyzing content for investor relevance...     [🛑 STOP]
  
Queue Status:
  ✅ Email 1: "Re: Series A..." → Processed → CRM Updated
  🟡 Email 2: "Investment Committee..." → Processing  
  ⏳ Email 3: "Quarterly Newsletter" → Queued
  ⏳ Email 4: "Follow-up on Due Diligence" → Queued  
  ⏳ Email 5: "Meeting Confirmation" → Queued
```

#### Individual Step Execution
Users can also run individual steps. Clicking **▶️ RUN** on "2.1 Open Email":

**Single Step Execution:**
```
🎯 Executing: Open Email

Prerequisites: ✅ Gmail loaded, ✅ Inbox visible, ✅ Email selected
Action: Click on email "Re: Series A Investment Terms"
Expected result: Email content visible in Gmail interface

[🔄 EXECUTING...]

Browser activity: Clicking element at coordinates (245, 167)
Result: ✅ Email opened successfully (1.2s)
Next suggested step: "2.2 Is Email Investor Related?"

[▶️ RUN NEXT STEP]  [🏠 RETURN TO OVERVIEW]
```

### Phase 4: Advanced Interaction Modes

#### Parallel Step Execution
For non-dependent steps, users can run multiple actions simultaneously:

```
🔧 2.3 Process Investor Email                       [▶️ BATCH RUN]
   
Parallel Execution Options:
☑️ 2.3.1 Switch to Airtable tab                   [▶️] 
☑️ 2.3.2 Search for investor record               [▶️]
☐ 2.3.3 Update investor details                   [⏸️] (requires approval)
☑️ 2.3.4 Log interaction timestamp                [▶️]

[📋 SELECT ALL]  [▶️ RUN SELECTED (3 steps)]
```

#### Error Recovery Interface
When something goes wrong:

```
❌ Step Failed: Find Investor in CRM

Error: Could not locate investor "Andreessen Horowitz" in Airtable
Browser state: Airtable CRM base loaded, search performed

Recovery Options:
🔍 Try alternative search terms
   • "a16z" [▶️ TRY]
   • "Andreessen" [▶️ TRY]  
   • Manual search [👤 HUMAN TAKEOVER]

🆕 Create new investor record instead [▶️ CREATE NEW]

⏭️ Skip this email and continue [▶️ SKIP]

🛑 Stop entire workflow [🛑 STOP]

AI Suggestion: "Try searching for 'a16z' as this is a common abbreviation"
[✅ ACCEPT AI SUGGESTION]
```

#### Human Takeover Mode
When users need to intervene directly:

```
👤 Human Takeover Active

Step: Update Investor Record
Issue: Complex data entry requires human judgment

Browser Control: 
• You now have direct control of the browser
• All actions are being recorded for future automation
• AI assistant is standing by for guidance

[🤖 GET AI SUGGESTION]  [📝 RECORD ACTIONS]  [✅ RESUME AUTOMATION]

Recorded Actions:
1. Clicked on "Stage" dropdown
2. Selected "Due Diligence" option  
3. Typed "Positive initial call, requesting deck review" in Notes field
4. Set follow-up date to "2024-12-15"

[💾 SAVE ACTIONS AS NEW AUTOMATION PATTERN]
```

### Phase 5: Completion & Learning

#### Workflow Completion Summary
When the entire workflow finishes:

```
🎉 Workflow Completed Successfully!

📊 Execution Summary:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Runtime: 18 minutes, 42 seconds
Steps Executed: 23/25 (2 skipped)
Human Checkpoints: 5 (all approved)
Emails Processed: 3 investor-related, 2 skipped
CRM Updates: 2 existing records updated, 1 new record created

🎯 Business Impact:
• Investor CRM now current with today's communications
• 3 follow-up actions identified and scheduled
• 0 emails missed or misfiled

💡 Optimization Opportunities:
• Email classification accuracy: 95% (AI learned new patterns)
• 2 repetitive actions identified for future automation
• Average checkpoint approval time: 12 seconds

[📄 DETAILED REPORT]  [📧 EMAIL SUMMARY]  [🔄 SCHEDULE NEXT RUN]
```

#### Learning & Improvement
The system presents learning insights:

```
🧠 AI Learning Summary

New Automation Patterns Discovered:
✅ Auto-detect "a16z" as "Andreessen Horowitz" (approved)
✅ Skip newsletter emails from known sources (approved)  
🔍 Suggest auto-categorizing by email domain (pending review)

Future Workflow Improvements:
• Reduce checkpoints for trusted email sources
• Pre-populate common investor names for faster search
• Auto-schedule follow-ups based on email content

[⚙️ APPLY IMPROVEMENTS]  [📚 TRAIN AI FURTHER]  [💾 SAVE AS TEMPLATE]
```

This comprehensive user experience ensures that automation feels **controlled, transparent, and educational** rather than mysterious and risky.

---

## 🛠️ Product Features & Components

### Core Platform Features

#### 1. SOP-to-AEF Transformation Engine
**Purpose:** Convert existing SOPs into executable automation frameworks
**User Value:** Leverage existing workflow documentation for automation without rebuilding from scratch

**Key Capabilities:**
- Parse existing SOP JSON structure and identify automatable steps
- Analyze node types (tasks, decisions, loops) and suggest appropriate execution methods
- Generate initial checkpoint recommendations based on step complexity and risk
- Create default configurations for common workflow patterns
- Preserve original SOP structure while adding execution metadata

#### 2. Multi-Modal Execution Engine
**Purpose:** Support different execution methods based on step requirements and user preferences
**User Value:** Flexibility to use the right tool for each job - AI, APIs, or human intervention

**Execution Methods:**
- **AI Agent Mode:** Browser automation using Stagehand/Browser-Use for UI interactions
- **API Integration Mode:** Direct API calls for systems with available interfaces
- **Human Manual Mode:** Guided human execution with action recording
- **Hybrid Mode:** Combination of multiple methods within single workflows

#### 3. Real-Time Browser Visualization
**Purpose:** Provide live view of automated browser interactions
**User Value:** Complete transparency and confidence in what the system is doing

**Technical Components:**
- Containerized browser environment for security and isolation
- Real-time streaming of browser viewport to user interface
- Action highlighting and annotation overlay
- Screenshot capture at key moments for audit trails
- Browser state preservation between steps

#### 4. Dynamic Loop Discovery & Management
**Purpose:** Handle variable iteration counts and dynamic content in loops
**User Value:** Automate processes with unknown quantities (like "all emails today")

**Capabilities:**
- Pre-execution discovery phase to determine loop iterations
- Dynamic UI generation for each discovered iteration
- Individual control over each loop instance
- Progress tracking and estimated completion times
- Parallel processing of independent loop items where possible

#### 5. Granular Checkpoint System
**Purpose:** Allow human intervention and approval at any workflow granularity
**User Value:** Maintain control and build trust through incremental automation

**Checkpoint Types:**
- **Before Execution:** Preview and approve actions before they happen
- **After Execution:** Review results and confirm before proceeding
- **On Errors:** Human intervention when automated recovery fails
- **Custom Conditions:** User-defined triggers for human review
- **Data Validation:** Confirm extracted or entered data accuracy

### User Interface Components

#### 6. Tri-View Interface Architecture
**Purpose:** Seamless progression from documentation to automation
**User Value:** Familiar workflow visualization enhanced with execution capabilities

**Three View Modes:**
- **List View:** Linear, detailed view optimal for execution control
- **ReactFlow View:** Visual diagram for understanding workflow structure  
- **AEF Control Center:** Execution-focused interface with live monitoring

#### 7. Live Execution Dashboard
**Purpose:** Comprehensive real-time monitoring and control interface
**User Value:** Complete situational awareness during automation execution

**Dashboard Elements:**
- **Step Status Indicators:** Real-time progress, success/failure states
- **Execution Timeline:** Historical view of completed actions
- **Resource Monitoring:** Browser performance, API rate limits, credential usage
- **Queue Management:** Upcoming steps, parallel execution status
- **Human Intervention Panel:** Checkpoint approvals, error resolution options

#### 8. Interactive Loop Interface
**Purpose:** Make complex loops manageable and understandable
**User Value:** Clear visibility into repetitive processes with individual control

**Loop Components:**
- **Discovery Results Display:** Show all items found for processing
- **Individual Item Controls:** Execute, skip, or modify specific iterations
- **Batch Operations:** Apply actions to multiple loop items simultaneously
- **Progress Visualization:** Completion status and estimated remaining time
- **Exception Handling:** Special cases and error recovery within loops

### Automation Intelligence Features

#### 9. Adaptive Learning System
**Purpose:** Improve automation accuracy and efficiency over time
**User Value:** Workflows become more reliable and require less human intervention

**Learning Capabilities:**
- **Pattern Recognition:** Identify successful action sequences for caching
- **Error Prevention:** Learn from failures to avoid similar issues
- **Optimization Suggestions:** Recommend workflow improvements based on execution data
- **Context Awareness:** Understand situational variations and adapt accordingly
- **User Preference Learning:** Adapt to individual user approval patterns

#### 10. Smart Error Recovery
**Purpose:** Handle automation failures gracefully with multiple recovery options
**User Value:** Robust automation that doesn't fail catastrophically

**Recovery Mechanisms:**
- **Alternative Action Suggestions:** AI-generated backup approaches
- **Human Takeover Mode:** Seamless transition to manual control
- **Retry Logic:** Intelligent retry with variations for transient failures
- **Graceful Degradation:** Continue workflow with reduced functionality when possible
- **State Preservation:** Maintain progress and context across recovery attempts

#### 11. Cross-Platform Integration Hub
**Purpose:** Work with any website or system, not just those with APIs
**User Value:** Universal automation capability regardless of target system's technical sophistication

**Integration Methods:**
- **Browser Automation:** Universal web interface interaction
- **API Connectors:** Direct integration where available for speed and reliability
- **MCP (Model Context Protocol):** Structured integration with AI-aware systems
- **Screen Automation:** Fallback for desktop applications and complex interfaces
- **Hybrid Approaches:** Combine multiple methods for optimal results

### Security & Compliance Features

#### 12. Credential Management System
**Purpose:** Secure handling of sensitive authentication information
**User Value:** Safe automation without exposing passwords or API keys

**Security Features:**
- **Encrypted Storage:** All credentials encrypted at rest and in transit
- **Granular Permissions:** Assign credentials to specific steps or workflows
- **Audit Logging:** Complete trail of credential usage
- **Rotation Management:** Automated credential updates and expiry handling
- **Multi-Factor Support:** Integration with 2FA and SSO systems

#### 13. Audit Trail & Compliance
**Purpose:** Complete documentation of all automated actions for compliance and debugging
**User Value:** Regulatory compliance and operational transparency

**Audit Capabilities:**
- **Action Logging:** Every browser interaction, API call, and human decision
- **Data Lineage:** Track how information flows through the workflow
- **Version Control:** Maintain history of workflow changes and executions
- **Compliance Reports:** Generate reports for regulatory requirements
- **Privacy Controls:** Manage and protect sensitive data handling

### Analytics & Optimization Features

#### 14. Workflow Performance Analytics
**Purpose:** Provide insights into automation effectiveness and opportunities
**User Value:** Data-driven optimization of business processes

**Analytics Components:**
- **Execution Metrics:** Speed, success rates, error patterns
- **Business Impact Measurement:** Quantify time savings and accuracy improvements
- **User Behavior Analysis:** Understand how humans interact with automation
- **Trend Analysis:** Identify patterns and changes over time
- **ROI Calculation:** Measure automation value against implementation costs

#### 15. Template & Pattern Library
**Purpose:** Enable reuse of successful automation patterns across workflows
**User Value:** Faster implementation of new automations using proven approaches

**Library Features:**
- **Workflow Templates:** Complete workflow patterns for common business processes
- **Step Patterns:** Reusable automation sequences for frequent tasks
- **Integration Patterns:** Proven approaches for connecting different systems
- **Best Practices:** Documented recommendations for effective automation
- **Community Sharing:** Optional sharing of successful patterns with other users

This comprehensive feature set creates a platform that transforms static workflow documentation into dynamic, controllable automation while maintaining human agency and providing complete transparency throughout the process. 