# AEF (Agentic Execution Framework) - Complete Project Documentation

> **Single Source of Truth for AEF Development**  
> This document contains everything about the AEF project status, architecture, implementation details, and development approach.

## 📋 Table of Contents
- [Project Overview](#project-overview)
- [Development Strategy](#development-strategy)
- [Current Implementation Status](#current-implementation-status)
- [Architecture & Components](#architecture--components)
- [Hardcoded SOP Structure](#hardcoded-sop-structure)
- [File Structure & References](#file-structure--references)

- [Execution Engine Requirements](#execution-engine-requirements)
- [Implementation Gaps](#implementation-gaps)
- [Next Steps](#next-steps)

---

## 🎯 Project Overview

**Agentic Execution Framework (AEF)** is Runops's Stage 2 MVP for automating user workflows with fine-grained control and transparency. It builds on Stage 1's SOP parser to execute structured workflows autonomously.

### **Core Goal**
Transform recorded workflows into reliable, automated executions while maintaining user trust through transparency and control.

### **Five Execution Modes (Planned)**
1. **Deterministic Execution** - Exact SOP playback via Playwright
2. **Light Exploratory** - Flexible DOM element selection
3. **Decision-Point** - LLM-based conditional branching
4. **Content Generation** - AI-driven content synthesis
5. **Complex Exploratory** - Multi-step UI exploration

**📄 Full PRD**: [`AEF.md`](./AEF.md)

---

## 🚀 Development Strategy

### **Hardcoded SOP Iteration Approach**

We are taking a **focused, iterative approach**:

1. **Start with ONE hardcoded SOP**: Gmail→Airtable investor CRM workflow in [`app_frontend/components/aef/AEFControlCenter.tsx`](./app_frontend/components/aef/AEFControlCenter.tsx)
2. **Iterate for reliability**: Systematically improve this specific SOP until high-reliability execution
3. **Reverse engineer general system**: ONLY after reliable execution will we build a general framework

### **Why This Approach**
- ✅ **Faster iteration cycles** on concrete, testable workflows
- ✅ **Real feedback** from actual execution attempts
- ✅ **Proven patterns** before attempting generalization
- ✅ **Concrete reliability metrics** from known-good workflow

---

## 📊 Current Implementation Status

### **✅ Already Implemented**
- **SOP Schema & Parser** (Stage 1 complete)
- **Frontend Visualization** (ReactFlow-based SOP diagrams)
- **Basic Execution Engine** (TypeScript with node execution)
- **Browser Integration** (Docker + Playwright/Stagehand)
- **API Infrastructure** (execution endpoints)
- **VNC Streaming** (WebSocket-based live browser view)


### **⚠️ Critical Gaps**
- **SOP Schema Analysis** (no formal execution compatibility docs)
- **Execution Mode Implementation** (only basic deterministic exists)
- **State Management** (no variable tracking/context persistence)
- **Error Handling** (basic without recovery strategies)
- **Decision Points** (no LLM-based decision making)
- **Real-time Communication** (limited WebSocket messaging)

---

## 🏗️ Architecture & Components

### **Backend Components**
- **SOPOrchestrator** ([`sop_orchestrator/core/orchestrator.py`](./sop_orchestrator/core/orchestrator.py))
  - Mission control capabilities
  - Agent management
  - Human intervention handling
  - Browser automation integration

- **ExecutionEngine** ([`app_frontend/aef/execution_engine/engine.ts`](./app_frontend/aef/execution_engine/engine.ts))
  - Node-by-node execution logic
  - Action handling (navigate, click, visual_scan)
  - Workflow state management

### **API Layer**
- **Execution API** ([`app_frontend/app/api/aef/execute/route.ts`](./app_frontend/app/api/aef/execute/route.ts))
  - Browser session creation
  - Docker integration
  - Execution record management

### **Frontend Components**
- **AEF Control Center** ([`app_frontend/components/aef/AEFControlCenter.tsx`](./app_frontend/components/aef/AEFControlCenter.tsx))
  - Contains hardcoded test workflow
  - VNC viewer integration
  - Execution monitoring UI

### **Browser Automation**
- **Docker Containers** with Playwright/Stagehand integration
- **VNC Streaming** for live execution monitoring
- **Supabase Database** with jobs table for execution tracking

---

## 📝 Hardcoded SOP Structure

### **Current Target Workflow**
**Location**: [`app_frontend/components/aef/AEFControlCenter.tsx`](./app_frontend/components/aef/AEFControlCenter.tsx) lines 26-160

### **Workflow: Gmail→Airtable Investor CRM (8 Steps)**

```typescript
const HARDCODED_TEST_WORKFLOW = {
  meta: {
    id: "test-investor-email-workflow",
    title: "Investor Email CRM Workflow (TEST)",
    version: "1.0",
    goal: "Extract investor information from an email and add it to a CRM"
  },
  execution: {
    environment: {
      required_tabs: [
        { name: "Gmail", url: "https://mail.google.com/mail/u/0/#inbox" },
        { name: "Airtable CRM", url: "https://airtable.com/appXXX/tblYYY/viwZZZ" }
      ]
    },
    workflow: { nodes: [...], flow: [...] }
  }
}
```

### **Step Breakdown**
1. **start_workflow** → Navigate to Gmail inbox
2. **scan_email_list** → Visual scan for investor emails
3. **email_processing_loop** → Container for iterative processing
4. **select_email** → Click unprocessed investor email
5. **extract_investor_info** → Parse email for investor details
6. **open_airtable** → Navigate to Airtable CRM
7. **add_to_crm** → Create new Airtable record
8. **mark_processed** → Return to Gmail and mark email

### **Action Types**
1. **`navigate_or_switch_tab`** - Tab management with URL targets
2. **`visual_scan`** - Content analysis and data extraction
3. **`click`** - DOM element interaction with selectors

### **Flow Pattern**
- Linear progression with iterative loop
- Conditional loop-back: `more_emails_to_process`
- Tab switching between Gmail and Airtable
- State tracking for processed emails

---

## 📁 File Structure & References

### **Core Implementation Files**

#### **Backend**
- [`sop_orchestrator/core/orchestrator.py`](./sop_orchestrator/core/orchestrator.py) - Mission control & agent management
- [`sop_orchestrator/core/visual_monitor.py`](./sop_orchestrator/core/visual_monitor.py) - Visual monitoring system
- [`sop_orchestrator/core/state_manager.py`](./sop_orchestrator/core/state_manager.py) - State management

#### **Frontend Engine**
- [`app_frontend/aef/execution_engine/engine.ts`](./app_frontend/aef/execution_engine/engine.ts) - Core execution engine
- [`app_frontend/components/aef/AEFControlCenter.tsx`](./app_frontend/components/aef/AEFControlCenter.tsx) - **Contains hardcoded SOP**

#### **API Layer**
- [`app_frontend/app/api/aef/execute/route.ts`](./app_frontend/app/api/aef/execute/route.ts) - Execution API
- [`app_frontend/app/api/aef/jobs/route.ts`](./app_frontend/app/api/aef/jobs/route.ts) - Job management
- [`app_frontend/app/api/aef/status/route.ts`](./app_frontend/app/api/aef/status/route.ts) - Status monitoring

#### **Schema Examples**
- [`app_frontend/public/latest-sop-v0.8.json`](./app_frontend/public/latest-sop-v0.8.json) - Current SOP schema (486 lines)
- [`app_frontend/public/mocksop.json`](./app_frontend/public/mocksop.json) - Variant with triggers (297 lines)
- [`stagehand-test/stagehand-optimized-sop.json`](./stagehand-test/stagehand-optimized-sop.json) - Execution-focused version (507 lines)

#### **Project Management**
- [`AEF.md`](./AEF.md) - Complete Product Requirements Document

### **Browser Automation**
- [`browser-use/`](./browser-use/) - Browser automation utilities
- [`stagehand/`](./stagehand/) - Stagehand integration
- [`cua/`](./cua/) - Additional automation components

---

## 📋 Development Progress Status

### **✅ Completed Analysis Work**

#### **🎯 SOP Schema Analysis & Gap Identification (COMPLETED)**
**Focus**: Hardcoded Gmail→Airtable workflow optimization

**Completed Work:**
- ✅ **Extract and Document Current SOP JSON Structure** (DONE)
- ✅ **Document Hardcoded SOP Structure in AEFControlCenter.tsx** (DONE)
- ✅ **Create TypeScript Interfaces for Hardcoded SOP Format** (DONE) - Existing AEF types confirmed
- ✅ **Identify Execution Gaps in Hardcoded SOP** (DONE) - Comprehensive analysis completed

### **🎯 Next Implementation Priorities**

#### **🔄 IMMEDIATE: Optimize Hardcoded SOP for Reliable Execution (HIGH PRIORITY)**
- **Status**: Ready to start
- **Dependencies**: All analysis work completed
- **Goal**: Implement Phase 1 of the detailed implementation roadmap

#### **🏗️ UPCOMING: Setup Execution Engine Core Infrastructure**
- **Focus**: Visual scan engine and execution context implementation
- **Dependencies**: SOP optimization work
- **Timeline**: Phase 1-2 implementation

#### **🔗 FUTURE: Implement Execution API Endpoints**
- **Focus**: Enhanced browser automation integration
- **Dependencies**: Core infrastructure
- **Timeline**: Phase 3-4 implementation

---

## ⚙️ Execution Engine Requirements

### **Core Action Handlers (From Hardcoded SOP Analysis)**

#### **Tab Management System**
- `navigate_or_switch_tab` actions with URL validation
- Context preservation during tab switches
- Session management across browser tabs

#### **Visual Scanning Engine**
- Content analysis and data extraction with structured output
- Visual scanning instruction formatting for AI processing
- Data extraction schema definitions for visual_scan outputs

#### **DOM Interaction Handler**
- Click actions with robust selector resolution
- Fallback selectors for DOM targeting resilience
- Cross-browser compatibility support

#### **State Management**
- Tracking processed items and loop conditions
- State persistence across loop iterations
- Inter-step data passing for extracted information

### **Loop Processing Requirements**
- Iterative loop container supporting child task sequences
- Conditional loop termination based on dynamic content evaluation
- Parent-child task relationship management within loops
- Loop termination condition evaluation logic

### **Stagehand Integration Points**
- Action mapping from SOP format to Stagehand commands
- Selector translation for cross-browser compatibility
- Navigation command structuring for reliable execution

---

## ❌ Implementation Gaps

> **Comprehensive Analysis Completed**: 2025-01-09  
> **Source**: Task 1.4 - Hardcoded Gmail→Airtable workflow analysis against current execution engine

### **1. ACTION EXECUTION GAPS**

#### **A. Visual Scan Implementation (CRITICAL)**
- **Current**: Mock implementation with 1-second delay
- **Required**: AI-powered content analysis with structured data extraction
- **Gap**: No actual visual processing, data extraction, or result storage
- **Impact**: Core workflow steps (scan_email_list, extract_investor_info) cannot function

#### **B. Tab Management (MAJOR)**
- **Current**: Basic navigation to URLs via hybridBrowserManager  
- **Required**: Smart tab switching and context preservation
- **Gap**: No actual tab detection, switching logic, or session state management
- **Impact**: Multi-app workflow navigation unreliable

#### **C. Data Extraction & Context (CRITICAL)**
- **Current**: No data extraction or storage mechanism
- **Required**: Extract investor info and pass between workflow steps
- **Gap**: No execution context, variable storage, or inter-step data flow
- **Impact**: Cannot pass extracted data from Gmail to Airtable steps

### **2. LOOP PROCESSING GAPS**

#### **A. Iterative Loop State Management (CRITICAL)**
- **Current**: Random 30% exit probability for demonstration
- **Required**: Dynamic evaluation of "more_emails_to_process" condition
- **Gap**: No actual email counting, processed tracking, or intelligent termination
- **Impact**: Loop will not terminate properly or process emails systematically

#### **B. Child Task Sequence Execution (MAJOR)**
- **Current**: Basic child node traversal without state tracking
- **Required**: Execute 5-step sequence (select→extract→navigate→add→mark) with state persistence
- **Gap**: No progress tracking within loops or recovery mechanisms
- **Impact**: Cannot reliably process multiple emails in sequence

### **3. ERROR HANDLING & RESILIENCE GAPS**

#### **A. Selector Robustness (HIGH)**
- **Current**: Basic try/catch with console logging
- **Required**: Fallback selectors, element waiting, and retry strategies
- **Gap**: Brittle selectors like `[data-thread-id]:not([data-processed='true'])` with no alternatives
- **Impact**: Workflow fails when Gmail UI changes or elements aren't immediately available

#### **B. Network & Timing Failures (HIGH)**  
- **Current**: No timeout handling or retry mechanisms
- **Required**: Configurable timeouts, exponential backoff, and recovery strategies
- **Gap**: No handling of slow page loads, authentication prompts, or network issues
- **Impact**: Workflow stops on transient failures that could be recovered

#### **C. Authentication Handling (HIGH)**
- **Current**: No authentication state detection
- **Required**: Detect and handle Gmail/Airtable login requirements
- **Gap**: Cannot detect authentication failures or prompt for re-authentication
- **Impact**: Workflow fails silently when sessions expire

### **4. DATA FLOW & STATE GAPS**

#### **A. Execution Context (CRITICAL)**
- **Current**: Basic Map<string, any> state with no persistence
- **Required**: Structured context with investor data schema and validation
- **Gap**: No data validation, type checking, or structured storage for extracted information
- **Impact**: Cannot reliably pass structured data between Gmail and Airtable steps

#### **B. Progress Tracking (MAJOR)**
- **Current**: Basic node counting with 20-node limit
- **Required**: Email-level progress tracking with processed email management
- **Gap**: No tracking of which emails processed, success rates, or partial completion states
- **Impact**: Cannot resume interrupted workflows or avoid duplicate processing

### **5. INTEGRATION GAPS**

#### **A. Stagehand Integration (MAJOR)**
- **Current**: Basic action mapping to hybridBrowserManager
- **Required**: Full Stagehand API integration with AI-powered element detection
- **Gap**: Not leveraging Stagehand's intelligent selector resolution and visual understanding
- **Impact**: Limited automation capability compared to available tools

#### **B. Real-time Monitoring (MAJOR)**
- **Current**: Console logging and basic WebSocket broadcasts
- **Required**: Structured execution logs with step-by-step progress indication
- **Gap**: No granular progress updates for complex multi-step actions
- **Impact**: Poor user experience and difficult debugging

### **6. WORKFLOW-SPECIFIC GAPS**

#### **A. Gmail-Specific Logic (HIGH)**
- **Required**: Email detection, content parsing, unread management, labeling system
- **Gap**: No Gmail API integration or email-specific automation patterns
- **Impact**: Cannot reliably identify, process, or mark investor emails

#### **B. Airtable-Specific Logic (HIGH)**
- **Required**: Record creation, field mapping, data validation, duplicate detection
- **Gap**: No Airtable API integration or CRM-specific automation patterns  
- **Impact**: Cannot reliably create structured investor records

### **IMPLEMENTATION PRIORITY ORDER**

1. **CRITICAL**: Implement visual_scan with structured data extraction
2. **CRITICAL**: Add execution context with investor data schema
3. **CRITICAL**: Fix loop termination logic with proper email tracking
4. **HIGH**: Add robust error handling and retry mechanisms
5. **HIGH**: Implement tab management with session preservation
6. **MAJOR**: Integrate Stagehand's advanced automation capabilities

### **DETAILED IMPLEMENTATION ROADMAP**

> **4-Phase Implementation Plan** developed from Task 1.4 gap analysis

#### **PHASE 1: CORE EXECUTION FOUNDATION (CRITICAL - Week 1)**

**Visual Scan Engine Implementation**
- Replace mock visual_scan with AI-powered content analysis using Stagehand's visual understanding
- Implement structured data extraction schema for investor information (name, company, email, investment focus, contact details)
- Add result storage mechanism with typed interfaces matching TypeScript definitions
- Create validation layer for extracted data quality and completeness

**Execution Context Architecture**
- Design persistent execution context with investor data schema validation
- Implement variable storage system for inter-step data flow (Gmail→Airtable data transfer)
- Add context serialization for workflow resumption after interruptions
- Create data transformation layer for Gmail content to Airtable field mapping

#### **PHASE 2: LOOP & STATE MANAGEMENT (CRITICAL - Week 2)**

**Dynamic Loop Termination Logic**
- Replace random exit probability with intelligent email counting and processed tracking
- Implement "more_emails_to_process" condition evaluation using Gmail API or DOM analysis
- Add processed email marking system to prevent duplicate processing
- Create loop state persistence for multi-session workflow execution

**Child Task Sequence Orchestration**
- Implement progress tracking within 5-step email processing sequence
- Add state checkpointing between select→extract→navigate→add→mark steps
- Create recovery mechanisms for partial sequence completion
- Design rollback capability for failed email processing attempts

#### **PHASE 3: RESILIENCE & ERROR HANDLING (HIGH - Week 3)**

**Selector Robustness Framework**
- Implement fallback selector strategies for Gmail UI variations
- Add element waiting mechanisms with configurable timeouts
- Create selector health monitoring and automatic fallback triggering
- Design selector update system for Gmail interface changes

**Network & Authentication Resilience**
- Implement exponential backoff retry strategies for network failures
- Add authentication state detection for Gmail and Airtable sessions
- Create session refresh mechanisms for expired authentication
- Design graceful degradation for partial service availability

#### **PHASE 4: INTEGRATION OPTIMIZATION (MAJOR - Week 4)**

**Advanced Stagehand Integration**
- Leverage Stagehand's AI-powered element detection for robust automation
- Implement intelligent selector resolution using visual understanding
- Add natural language action interpretation for complex Gmail/Airtable interactions
- Create adaptive automation that learns from execution patterns

**Real-time Monitoring Enhancement**
- Implement granular progress tracking with step-by-step execution logs
- Add structured WebSocket broadcasts for real-time workflow monitoring
- Create execution analytics for performance optimization and failure analysis
- Design user-friendly progress visualization for complex multi-step workflows

---

## 🎯 Next Steps

### **Immediate Priorities (Current Sprint)**

#### **1. Implement SOP Optimizations - HIGH PRIORITY**
- **Status**: Ready to start (all analysis completed)
- **Focus**: Optimize hardcoded Gmail→Airtable workflow for reliable execution
- **Dependencies**: Analysis work completed
- **Goal**: Create enhanced version of HARDCODED_TEST_WORKFLOW with improved reliability

#### **2. Begin Phase 1 Implementation (CRITICAL)**
- **Target**: Visual scan engine and execution context implementation
- **Files**: [`app_frontend/aef/execution_engine/engine.ts`](./app_frontend/aef/execution_engine/engine.ts)
- **Goal**: Replace mock implementations with functional capabilities
- **Focus**: Structured data extraction for investor information

#### **3. Test Enhanced SOP Execution**
- **Target**: Improved Gmail→Airtable workflow
- **Goal**: Establish improved execution success rates
- **Metrics**: Measure reliability improvements from optimizations

### **Medium-term Goals**

#### **4. Implement Missing Action Handlers**
- Visual scanning engine for content extraction
- Tab management system for multi-app workflows
- Improved selector resolution with fallbacks

#### **5. Add Error Handling & Retry Logic**
- Comprehensive error recovery mechanisms
- Timeout management for each action type
- Network failure handling

#### **6. Build Loop Processing System**
- Iterative container for child task sequences
- Dynamic loop termination evaluation
- State persistence across iterations

### **Long-term Vision**

#### **7. Optimize for Reliability**
- Achieve >90% success rate on hardcoded workflow
- Implement comprehensive monitoring and metrics
- Create automated testing for regression prevention

#### **8. Reverse Engineer General Framework**
- Extract patterns from reliable hardcoded execution
- Build system prompt for generating similar SOPs
- Extend to additional workflow types

---

## 📊 Success Metrics

### **Immediate Targets**
- [ ] Complete hardcoded SOP documentation (Task 1)
- [ ] Achieve basic execution of Gmail→Airtable workflow
- [ ] Identify and document all execution gaps

### **Medium-term Targets**
- [ ] 80%+ success rate on hardcoded workflow execution
- [ ] Comprehensive error handling for all action types
- [ ] Real-time execution monitoring with detailed logging

### **Long-term Targets**
- [ ] 95%+ reliability on hardcoded workflow
- [ ] General SOP generation system based on proven patterns
- [ ] Support for additional workflow types beyond Gmail→Airtable

---

## 🔗 Related Documentation

- **[AEF.md](./AEF.md)** - Complete Product Requirements Document
- **[Development Workflow Rules](./.cursor/rules/dev_workflow.mdc)** - Standard development process

---

*Last Updated: 2025-01-09*  
*Project Phase: Hardcoded SOP Iteration (Stage 2 MVP)* 