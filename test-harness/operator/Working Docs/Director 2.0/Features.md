# Features: Director 2.0 Implementation Tracker

This document tracks all features that need to be built for the Director 2.0 transition. Each feature includes status, priority, and implementation details.

## Status Legend
- 🔴 **Not Started** - Feature not implemented
- 🟡 **In Progress** - Feature partially implemented  
- 🟢 **Completed** - Feature fully implemented and tested
- 🔵 **Planned** - Feature designed but not started

---

## **Core Infrastructure Features**

### 1. Planning Feature 🟢

**Priority**: High  
**Required For**: Context management, workflow organization  
**Description**: Director can create, update, and manage structured workflow plans  
**Status**: ✅ **COMPLETED** - Fully implemented and deployed (July 3, 2025)

#### Requirements ✅ ALL COMPLETE
- ✅ JSON-based plan structure with phases and tasks
- ✅ `update_plan` tool for Director to modify plans  
- ✅ Supabase storage with versioning
- ✅ Frontend rendering as interactive to-do list

#### Database Schema
```sql
CREATE TABLE director_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES workflows(id),
  plan_version integer DEFAULT 1,
  plan_data jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

#### Tools to Build
```javascript
{
  name: 'update_plan',
  description: 'Update the current workflow plan',
  parameters: {
    plan: 'Complete plan object (replaces existing plan)',
    reason: 'Why the plan is being updated'
  }
}
```

#### Implementation Details ✅ COMPLETE
- **PlanService**: Full service with versioning, validation, error handling
- **DirectorService Integration**: 6-part context building with plan injection  
- **API Routes**: `/workflows/:id/plan` and `/workflows/:id/plan/history`
- **Frontend PlanViewer**: Interactive to-do list with status icons and real-time updates
- **Enhanced System Prompt**: Director 2.0 planning-first methodology integrated
- **Database Migration**: Successfully applied via Supabase MCP

#### Files Modified/Created
- ✅ `supabase/migrations/20250703120000_add_director_plans_table.sql`
- ✅ `backend/services/planService.js` (NEW)
- ✅ `backend/services/directorService.js` (Enhanced)
- ✅ `backend/tools/toolDefinitions.js` (Added update_plan tool)
- ✅ `backend/routes/director.js` (Added plan endpoints)
- ✅ `backend/prompts/directorPrompt.js` (Enhanced with Director 2.0)
- ✅ `frontend/app.js` (Added PlanViewer component and integration)

---

### 2. 6-Part Context Management System 🟢

**Priority**: High  
**Required For**: Structured context, conversation compression  
**Description**: System Prompt → Plan → Workflow → Variables → Browser State → History  
**Status**: ✅ **COMPLETED** - Full implementation with context stripping (July 4, 2025)

#### Requirements ✅ ALL COMPLETE
- ✅ Context builder service that assembles 6-part structure (`buildDirector2Context` method)
- ⏸️ **Context compression at 180k tokens using Director (ON HOLD - see On Hold section)**
- ✅ Conversation filtering (exclude old prompts/plans/JSONs)
- ✅ Real-time updates of all context sections
- ✅ **NEW**: Automatic director2Context stripping from historical messages to prevent exponential token growth

#### Implementation Details ✅ COMPLETE
- **buildDirector2Context**: Assembles all 6 parts into unified context
- **Conversation Filtering**: Strips director2Context from historical messages using `split('\n\n(2) CURRENT PLAN')[0]`
- **Token Optimization**: Prevents exponential growth by ensuring context is only added to current message
- **Debug Logging**: Added comprehensive logging to track context stripping

#### Files Modified
- ✅ `backend/services/directorService.js` (buildDirector2Context method + context stripping)

---

### 3. Enhanced System Prompt 🔴

**Priority**: High  
**Required For**: Director 2.0 methodology  
**Description**: Rewrite system prompt with incremental approach

#### New Sections Needed
- Chunk-based workflow methodology (chunk → scout → build → validate)
- Variable storage clarification with practical examples
- Business-level invariants for each node type
- Node type tutorials (navigation, extraction, routes, loops, variables, cognition)
- Deterministic vs AI selector hierarchy

---

## **Variable Management Features**

### 4. Workflow Variables Context 🟢

**Priority**: High  
**Required For**: Debugging visibility, workflow state understanding  
**Description**: Always-visible chunked variable display in context  
**Status**: ✅ **COMPLETED** - Fully implemented and integrated (July 3, 2025)

#### Requirements ✅ ALL COMPLETE
- ✅ Chunked display (100 char limit with "...")
- ✅ Real-time updates with each API call
- ✅ Sensitive data masking ([hidden])
- ✅ Array preview (first element + count)

#### Implementation Details ✅ COMPLETE
- **VariableManagementService**: Full service with chunked display, sensitive data masking, array previews
- **Director Context Integration**: Part 4 of 6-part context structure displays variables in real-time
- **Sensitive Data Patterns**: Automatic masking for passwords, tokens, keys, secrets, auth, credentials
- **Array Handling**: Smart preview showing first element + count for large arrays
- **Error Handling**: Graceful fallback when variables can't be loaded

#### Files Modified/Created
- ✅ `backend/services/variableManagementService.js` (NEW)
- ✅ `backend/services/directorService.js` (Enhanced with variable context integration)
- ✅ `backend/tools/toolDefinitions.js` (Added 4 variable debugging tools)

#### Display Example
```
WORKFLOW VARIABLES:
- gmail_creds = {email: "user@gmail.com", password: "[hidden]"}
- node4.loginRequired = true  
- node7.emails = [{"sender": "investor@vc.com", "subject": "Re: Funding"}, {"sender": "startup@...
```

---

### 5. Variable Debugging Tools 🟢

**Priority**: High  
**Required For**: Advanced debugging, manual testing  
**Description**: Tools for Director to inspect and manipulate workflow variables  
**Status**: ✅ **COMPLETED** - All 4 debugging tools implemented (July 3, 2025)

#### Implementation Details ✅ COMPLETE
- **get_workflow_variable**: Retrieve full variable content (bypasses chunked display)
- **set_variable**: Set/update variables with optional JSON schema validation
- **clear_variable**: Delete specific variables for testing
- **clear_all_variables**: Reset entire workflow state for clean testing
- **Optional Validation**: JSON schema validation when schema parameter provided
- **Comprehensive Error Handling**: Clear error messages and logging
- **Reason Tracking**: All operations require reason parameter for debugging audit trail

#### Tools Implemented ✅ ALL COMPLETE
```javascript
// ✅ Get full variable content
get_workflow_variable({
  variableName: "node7.emails", // specific variable or "all"
  nodeId: 7 // alternative - get all variables from node 7
})

// ✅ Set variable for debugging
set_variable({
  variableName: "test_email",
  value: "debug@test.com",
  reason: "Override email for testing login flow",
  schema: {...} // optional validation
})

// ✅ Clear specific variable
clear_variable({
  variableName: "node7.emails", 
  reason: "Reset to test email extraction again"
})

// ✅ Clear all variables
clear_all_variables({
  reason: "Reset entire workflow state for clean test"
})
```

---

## **Validation & Testing Features**

### 6. Flexible Node Execution 🟢

**Priority**: High  
**Required For**: Node-by-node validation, flexible testing  
**Description**: Execute individual nodes or ranges for testing  
**Status**: ✅ **COMPLETED** - Fully implemented and working (July 3, 2025)

#### Implementation Details ✅ COMPLETE
- **execute_nodes Tool**: Parse string selections ("3-5,15,20,30") → execute nodes in position order
- **Range Parsing**: Supports individual nodes, ranges, and "all" selection
- **Comprehensive Results**: Returns detailed execution status with timing and error details
- **Continue-on-Error**: Executes all requested nodes regardless of individual failures
- **Browser State Management**: Optional browser reset for clean testing

#### Tool Specification ✅ IMPLEMENTED
```javascript
execute_nodes({
  nodeSelection: "3-5,15,20,30", // ranges and individual nodes
  resetBrowserFirst: false // default: use current browser session
})
```

#### Returns
```javascript
{
  "execution_results": [
    {
      "node_position": 3,
      "node_id": "abc123", 
      "status": "success",
      "result": "Navigated to https://mail.google.com",
      "execution_time": "1.2s"
    },
    {
      "node_position": 15,
      "status": "error",
      "error_details": "Selector '#loginButton' not found"
    }
  ]
}
```

#### Files Modified ✅ COMPLETE
- **toolDefinitions.js**: Added execute_nodes tool definition with nodeSelection and resetBrowserFirst parameters
- **directorService.js**: Added parseNodeSelection and executeNodes methods with comprehensive range parsing
- **nodeExecutor.js**: Enhanced getStateValue method with proper iteration context fallback handling

---

### 7. Validation Node Type 🔴

**Priority**: High  
**Required For**: Business-level invariants, workflow safety barriers  
**Description**: Dedicated validation nodes that stop workflow on failure

#### New Node Type: `validation`
```javascript
{
  type: "validation",
  config: {
    validationType: "deterministic|ai|both",
    conditions: [
      {
        type: "element_exists",
        selector: "[data-action='signin']",
        description: "Login button must be present"
      },
      {
        type: "ai_assessment", 
        instruction: "Verify we're on Gmail login page, not 2FA",
        expectedResult: "gmail_login_page"
      }
    ],
    onFailure: {
      action: "stop_workflow", // or "branch_to_error_handler"
      errorMessage: "Gmail login page not accessible"
    }
  }
}
```

#### Benefits over browser_query
- Built-in workflow stopping on failure
- Business invariant semantics
- Clear error messaging
- Safety barrier functionality

---

## **Browser & Debugging Features**

### 8. Real-time Browser State Context 🟢

**Priority**: High  
**Required For**: Debugging visibility, tab management  
**Description**: Live browser tab information in Director context  
**Status**: ✅ **COMPLETED** - Fully implemented with real-time SSE updates (July 6, 2025)

#### Requirements ✅ ALL COMPLETE
- ✅ Real-time browser state tracking in database
- ✅ Director 6-part context integration (Part 5)
- ✅ Server-Sent Events for instant updates
- ✅ Frontend Browser State tab with live updates
- ✅ Tab count badges and visual indicators

#### Implementation Details ✅ COMPLETE
- **Database Schema**: `browser_state` table with workflow_id, tabs (JSONB), active_tab_name
- **BrowserStateService**: Complete service with CRUD operations and SSE connection management
- **NodeExecutor Integration**: Browser state updates on navigate, openNewTab, switchTab actions
- **Real-time Updates**: Server-Sent Events eliminate polling, instant frontend updates
- **Frontend Browser State Tab**: Replaces Metrics tab, shows formatted + raw browser state

#### Context Display
```
BROWSER STATE:
1 tab open:
- main (Active) = https://www.apple.com/
```

#### Files Modified/Created ✅ COMPLETE
- ✅ `supabase/migrations/*_add_browser_state_table.sql` (Database schema)
- ✅ `backend/services/browserStateService.js` (NEW - Complete service)
- ✅ `backend/services/nodeExecutor.js` (Enhanced with browser state updates)
- ✅ `backend/services/directorService.js` (Enhanced with browser state context)
- ✅ `backend/routes/director.js` (Added browser state + SSE endpoints)
- ✅ `frontend/app.js` (SSE integration + Browser State tab)

#### Technical Features ✅ COMPLETE
- **Server-Sent Events**: Real-time browser state streaming (`/workflows/:id/browser-state/stream`)
- **Connection Management**: Multiple concurrent SSE connections per workflow
- **Fallback Strategy**: Initial fetch + SSE for guaranteed state visibility
- **Error Handling**: Graceful connection cleanup and reconnection
- **Performance**: 90% reduction in network requests (eliminated 3-second polling)

---

### 9. Tab Inspection Tools 🟢

**Priority**: High  
**Required For**: Page state debugging, selector verification  
**Description**: Two-tool approach for efficient DOM inspection  
**Status**: ✅ **COMPLETED** - Fully implemented and tested (December 2024)

#### Requirements ✅ ALL COMPLETE
- ✅ Context-efficient page overview (~10k tokens)
- ✅ Surgical DOM attribute extraction for specific elements
- ✅ Intelligent selector generation (href > semantic classes > data-* > id)
- ✅ In-memory caching system for performance
- ✅ Complete DOM attribute access (no filtering)

#### Implementation Details ✅ COMPLETE
**Tool 1: inspect_tab**
- Context-efficient accessibility tree output (~10k tokens)
- Caches DOM tree data for expand_dom_selector
- Clean output format: `[1127] link: Support`

**Tool 2: expand_dom_selector**
- Surgical DOM attribute extraction for specific elements
- Returns complete selector options and all DOM attributes
- Intelligent selector hierarchy generation

#### Real-World Test Results (Apple.com) ✅ VALIDATED
```json
{
  "elementId": "1127",
  "role": "link",
  "name": "Support", 
  "selectors": [
    "[href=\"https://support.apple.com/?cid=gn-ols-home-hp-tab\"]",
    ".globalnav-link.globalnav-submenu-trigger-link.globalnav-link-support"
  ],
  "attributes": {
    "href": "https://support.apple.com/?cid=gn-ols-home-hp-tab",
    "class": "globalnav-link globalnav-submenu-trigger-link globalnav-link-support"
  }
}
```

#### Files Modified/Created ✅ COMPLETE
- ✅ `backend/services/tabInspectionService.js` (NEW - Complete two-tool service)
- ✅ `backend/tools/toolDefinitions.js` (Added inspect_tab and expand_dom_selector)
- ✅ `backend/services/directorService.js` (Added tool handlers)
- ✅ `backend/prompts/directorPrompt.js` (Updated with two-tool documentation)
- ✅ `vendor/stagehand-pov/` (Enhanced POV generation module)

#### Technical Features ✅ COMPLETE
- **CDP Integration**: Chrome DevTools Protocol for DOM attribute extraction
- **Accessibility Tree Processing**: Stagehand-based filtering approach
- **Intelligent Caching**: In-memory cache cleared on page navigation
- **Success Rate**: 771/1186 nodes enhanced with DOM attributes (65% success rate)
- **Context Efficiency**: Base inspection stays ~10k tokens, surgical detail on demand

---

### 10. Director Debugging Navigation 🔴

**Priority**: High  
**Required For**: Manual debugging, selector testing  
**Description**: Director navigation tools separate from workflow

#### Debugging Tools
```javascript
// Navigate for debugging (not part of workflow)
debug_navigate({
  url: "https://mail.google.com",
  tabName: "Main Tab",
  reason: "Test fresh login flow to verify selectors"
})

// Perform debugging actions
debug_action({
  action: "click|type|wait",
  selector: "#identifierNext", 
  tabName: "Main Tab",
  reason: "Test if selector works"
})

// Tab management
debug_open_tab({url: "https://airtable.com", tabName: "Debug Tab"})
debug_close_tab({tabName: "Debug Tab"})
```

#### Key Features
- Batched function calls in single API response
- Actions logged in chat history only (not persisted)
- Separate from workflow building

---

## **Frontend Features**

### 11. Unified Control Panel 🟢

**Priority**: Medium  
**Required For**: User interface, debugging visibility  
**Description**: Single control panel with tabs for all Director 2.0 features  
**Status**: ✅ **COMPLETED** - Tabbed interface with Plan and Variables (July 3, 2025)

#### Panel Tabs ✅ IMPLEMENTED
- ✅ **Plan Viewer**: Interactive to-do list with phase breakdown
- ✅ **Variable Inspector**: Real-time variables with categorization and formatting
- 🔄 **Browser Monitor**: Placeholder ready for Phase 2 implementation
- 🔄 **Context Monitor**: Future implementation

#### Features ✅ COMPLETE
- ✅ Real-time updates when Director modifies anything (3-second polling)
- ✅ Tabbed interface with Plan, Variables, and Browser tabs
- ✅ Variable count badges and status indicators
- ✅ Categorized display (Custom Variables vs Node Results)
- ✅ Formatted JSON display with timestamps
- ✅ Responsive design with max-height scrolling

#### Implementation Details ✅ COMPLETE
- **Tab State Management**: activeTab state with 'plan', 'variables', 'browser' options
- **Real-time Polling**: Both node values and variables refresh every 3 seconds
- **Variable Categories**: Separates custom variables from node execution results
- **Professional UI**: Color-coded tabs with badges and hover effects
- **Extensible Design**: Ready for Browser Monitor and Context Monitor tabs

---

### 12. Context Size Monitor 🔴

**Priority**: Medium  
**Required For**: Context management, compression triggers  
**Description**: Real-time context size tracking and warnings

#### Features
- Live context size display
- Warning at 160k tokens
- Compression trigger UI
- Breakdown by context section (plan, variables, history, etc.)

---


## **Backend Infrastructure**

### 13. Context Builder Service 🟢

**Priority**: High  
**Required For**: 6-part context assembly  
**Description**: Service that builds complete Director context
**Status**: ✅ **COMPLETED** - Implemented as part of DirectorService (July 4, 2025)

#### Implementation Details ✅ COMPLETE
- **buildDirector2Context method**: Assembles all 6 context parts
- **Variable chunking**: Applied through VariableManagementService integration
- **Conversation filtering**: Strips old context to prevent duplication
- **Real-time assembly**: Fresh context built for each message

---

### 14. Variable Management Service 🟢

**Priority**: High  
**Required For**: Variable state management  
**Description**: Service for workflow variable operations
**Status**: ✅ **COMPLETED** - Full service implementation (July 3, 2025)

#### Implementation Details ✅ COMPLETE
- **Full CRUD operations**: getVariable, setVariable, deleteVariable, clearAllVariables
- **Chunking display**: 100 character limit with "..." for long values
- **Sensitive data masking**: Automatic [hidden] for passwords, tokens, keys
- **Array handling**: Smart previews showing first element + count
- **File**: `backend/services/variableManagementService.js`

---

### 15. Browser State Service 🔴

**Priority**: High  
**Required For**: Real-time browser context  
**Description**: Service for live browser state information

#### Responsibilities
- Real-time tab information retrieval
- Browser state API integration
- Tab management coordination

---

### 16. Database Schema Updates 🔴

**Priority**: High  
**Required For**: Data persistence  
**Description**: Database changes for new features

#### New Tables
- `director_plans` table (already specified)
- Additional indexes for performance
- Variable storage optimization (if needed)

---

## **Token Management & Optimization**

### 17. Token Counting Accuracy Fix 🟢

**Priority**: High  
**Required For**: Accurate cost tracking, user understanding  
**Description**: Fix misleading token accumulation from recursive tool calls  
**Status**: ✅ **COMPLETED** - Implemented clean separation (July 4, 2025)

#### The Problem
- Reasoning models make recursive API calls when executing tools
- Original implementation accumulated ALL tokens from these calls
- Made it appear messages used 20k-40k tokens when they only used ~10k

#### The Solution ✅ IMPLEMENTED
- Modified `runDirectorControlLoop` to track initial vs recursive tokens separately
- User-facing token counts now show ONLY the initial message tokens
- Tool execution overhead treated as internal implementation detail

#### Implementation Details
```javascript
// Only return initial call's tokens to user
const userFacingUsage = recursionDepth === 0 ? tokenUsage : recursiveResult.usage;

// Debug logging shows both
[TOKEN_DEBUG] Initial message tokens: 9839 in, 1534 out
[TOKEN_DEBUG] Total with 3 tool executions: 40663 in, 2560 out
```

#### Results
- **Before**: 19.7k → 40.6k tokens (misleading jumps)
- **After**: 9.7k → 9.9k tokens (accurate, consistent)
- **Benefit**: Predictable costs that scale linearly with conversation length

---

## **Strategic Implementation Plan**

### **Phase 1: Core Infrastructure Foundation (Week 1)** ✅ COMPLETED
**Goal**: Get the 6-part context working with basic features

1. ✅ **Context Builder Service** - Build 6-part context assembly with static placeholders
2. ✅ **Planning Feature** - Database schema + basic CRUD + `update_plan` tool
3. ✅ **Variable Management Service** - Variable retrieval with chunking logic + basic tools
4. 🔄 **Browser State Service** - Live tab information retrieval (deferred to Phase 2)

**Milestone**: ✅ **ACHIEVED** - Director sees 6-part context with real data

**Bonus Completed in Phase 1:**
- ✅ **Variable Debugging Tools** (#5) - All 4 tools implemented ahead of schedule
- ✅ **Unified Control Panel** (#11) - Tabbed interface with Variables inspector

---

### **Phase 2: Execution & Basic Debugging (Week 2)**
**Goal**: Director can test nodes and see results

5. ✅ **Flexible Node Execution** - COMPLETED in Phase 1
6. ✅ **Variable Debugging Tools** - COMPLETED in Phase 1
7. **Context Size Monitoring** - Real-time token counting + compression trigger logic
8. **Browser State Service** - Live tab information retrieval (moved from Phase 1)

**Milestone**: Director can test workflows and manipulate variables

---

### **Phase 3: Advanced Debugging (Week 3)**
**Goal**: Director becomes a debugging powerhouse

8. **Tab Inspection Tools** - `inspect_tab` (lightweight + full DOM)
9. **Director Debugging Navigation** - `debug_navigate`, `debug_action`, tab management
10. **Validation Node Type** - New node type with business invariant logic

**Milestone**: Director has surgical debugging capabilities

---

### **Phase 4: Frontend Integration (Week 4)**
**Goal**: Beautiful user interface for all features

11. **Unified Control Panel** - Plan viewer, variable inspector, browser monitor
12. **Context Compression System** - Automatic compression at 180k tokens

**Milestone**: Complete user experience with visual feedback

---

### **Phase 5: Enhancement & Polish (Week 5)**
**Goal**: Perfect the experience

13. **Enhanced System Prompt** - Complete methodology documentation (built last!)
14. **Performance Optimization** - Batched operations, caching, etc.
15. **Advanced Features** - Pattern learning, failure analysis, etc.

---

## **Why This Order Works**
- **Dependency Management**: Context structure first, backend before frontend
- **Incremental Value**: Each phase delivers working features
- **Risk Mitigation**: Core infrastructure first, system prompt last
- **Practical Benefits**: Can start using improvements immediately

**Total: 18 major features** with strategic implementation order.

## **Completed Features Summary**
- ✅ **13 features fully completed**: Planning (#1), Context Management (#2), Variable Context (#4), Variable Debugging Tools (#5), Node Execution (#6), Real-time Browser State Context (#8), Tab Inspection Tools (#9), Unified Control Panel (#11), Context Builder (#13), Variable Management Service (#14), Browser State Service (#15), Token Counting Fix (#17), **Validation System**, **Workflow Description Service**
- 🔴 **5 features not started**: Enhanced System Prompt (#3), Debug Navigation (#10), Context Size Monitor (#12), Database Updates (#16)
- 🟡 **0 features in progress**: All features are either complete or not started

**Latest Achievement**: ✅ **Validation System** - Two-pronged approach with navigation auto-validation and browser_query validate method, plus stop-on-error workflow execution

## **Recently Added Features**

### **✅ Validation System** 
Complete validation implementation with:
- **Navigation auto-validation**: Click/type nodes automatically stop workflow on selector failures
- **browser_query validate method**: Deterministic + AI validation with 3 rule types (element_exists, element_absent, ai_assessment)
- **Stop-on-error execution**: execute_nodes now halts on first failure (prevents cascading errors)
- **Clear documentation**: Guidance on when to use each validation approach

### **✅ Workflow Description Service**
High-fidelity requirement capture system:
- **Authoritative contract**: Separates WHAT (requirements) from HOW (implementation) 
- **Enhanced context**: Upgraded from 6-part to 7-part context structure with workflow description
- **Comprehensive capture**: Business rules, data contracts, edge cases, success criteria
- **Version management**: Database-backed with update_workflow_description tool
- **Traceability**: Single source of truth for all automation requirements

---

## **On Hold / Future Investigation**

### **Prompt Caching Investigation** 🔵
**Status**: ON HOLD - Requires future examination  
**Description**: OpenAI appears to automatically cache system prompts (~10k cached tokens on first message)  
**Open Questions**:
- Is automatic prompt caching reliable/documented behavior?
- Can it be explicitly controlled or disabled?
- How does it work across workflow IDs and sessions?
- What are the cache TTL and invalidation rules?

**Note**: Currently working as expected with 75% cost reduction on cached tokens, but the automatic behavior needs documentation.

### **Lightweight Web Explorer Agent** 🔵
**Status**: BACKLOG - Future token-efficient exploration feature  
**Priority**: Medium  
**Description**: AI agent for autonomous web exploration with natural language instructions

#### The Concept
Director specifies natural language exploration goals, and a lightweight explorer agent navigates and investigates autonomously, then reports back with findings.

#### Usage Pattern
```javascript
explore_web({
  instruction: "Navigate to the main login flow and identify all required form fields and their validation requirements",
  startingUrl: "https://app.example.com",
  maxDepth: 3, // navigation steps
  reportFormat: "structured" // or "natural_language"
})
```

#### Explorer Agent Capabilities
- **Navigation**: Uses same browser tools as Director (navigate, click, type)
- **Investigation**: Uses inspect_tab and expand_dom_selector for DOM analysis  
- **Decision Making**: AI-driven exploration based on natural language goals
- **Reporting**: Returns structured findings to Director in single message

#### Token Efficiency Benefits
- **Director Context Preserved**: Explorer operates independently without flooding Director's context
- **Summarized Results**: Explorer processes raw DOM data and returns only relevant findings
- **Autonomous Operation**: Director delegates exploration without micro-managing each step
- **Single Response**: All exploration findings delivered in one comprehensive report

#### Example Workflow
1. **Director**: "I need to understand the login flow validation"
2. **Explorer**: Navigates → inspects forms → tests validation → analyzes selectors
3. **Explorer Reports**: "Login requires email (data-testid='email'), password (8+ chars), optional 2FA toggle (id='enable-2fa'). Validation appears on blur events."
4. **Director**: Uses findings to build reliable workflow nodes

#### Implementation Approach
- **Separate Agent Instance**: Independent from Director with focused exploration prompt
- **Shared Tool Access**: Same inspect_tab, expand_dom_selector, and browser action tools
- **Message Boundary**: Explorer completes full investigation before reporting back
- **Error Handling**: Explorer handles navigation failures and reports what was successfully discovered

**Rationale**: Provides Director with efficient reconnaissance capability without context bloat, enabling informed workflow building decisions based on comprehensive site analysis.