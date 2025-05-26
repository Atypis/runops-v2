# 🤖 Runops - AI Agent Quick Start Guide

> **Transform workflow videos into structured SOPs using AI processing + ReactFlow visualization**

## 🚀 System Purpose (30 seconds)
Runops captures workflow context via screen recording, parses it into structured SOPs using Gemini AI, and visualizes the result in interactive ReactFlow diagrams. Users record → upload → get AI-generated SOP.

### 📋 Two-Part Project Roadmap
**Part 1: Context Capture + SOP Creation** *(✅ COMPLETED)*
- Screen recording capture
- AI-powered video parsing (Gemini 2.5)
- Structured SOP generation
- ReactFlow visualization
- User authentication & management

**Part 2: AI Automation Engine** *(🚧 UPCOMING - Critical Next Phase)*
- Automated workflow execution based on SOPs
- Agent-driven task completion
- Real-world application control
- Feedback loops for SOP refinement

> **Current Status**: Part 1 is mvp-ready (some improvements definetly still outstanding). Part 2 represents the core automation vision and will be the primary focus of the next development phase.

## 📚 Documentation Directory for AI Agents

**IMPORTANT**: This project has a comprehensive documentation suite in the `app_frontend/docs/` directory. **Always consult the relevant documentation files first** before making changes or debugging issues.

### Available Documentation
```
app_frontend/docs/
├── API_REFERENCE.md                    # 🌐 Complete REST API documentation
├── REACTFLOW_VISUALIZATION_GUIDE.md    # 🎨 ReactFlow architecture deep dive  
├── PERFORMANCE_OPTIMIZATION_GUIDE.md   # ⚡ System optimization strategies
├── AI_PROCESSING_PIPELINE.md           # 🤖 Gemini AI workflow processing
├── ERROR_HANDLING_GUIDE.md             # 🐛 Error patterns & debugging
├── DEVELOPMENT_SETUP.md                # 🛠️ Local development environment
├── UploadProcessingArchitecture.md     # 📤 Upload → processing flow
├── CODEBASE_MAP.md                     # 🗺️ File structure navigation
├── WorkerInstructions.md               # ⚙️ Background worker operations
├── CleanupStrategy.md                  # 🧹 Resource cleanup procedures
├── MockSOPVisualization.md             # 🎭 Testing visualization components
└── PopupAuthentication.md              # 🔐 Google OAuth popup flow
```

### Documentation Usage Guidelines for AI Agents
1. **Topic-Specific Lookup**: Match your assigned task to the relevant documentation
   - **API issues/integration** → `API_REFERENCE.md`
   - **Visualization/UI problems** → `REACTFLOW_VISUALIZATION_GUIDE.md`  
   - **Performance/scaling concerns** → `PERFORMANCE_OPTIMIZATION_GUIDE.md`
   - **AI/processing pipeline** → `AI_PROCESSING_PIPELINE.md`
   - **Error debugging** → `ERROR_HANDLING_GUIDE.md`
   - **Local development setup** → `DEVELOPMENT_SETUP.md`
   - **Upload/processing flow** → `UploadProcessingArchitecture.md`
   - **File structure navigation** → `CODEBASE_MAP.md`
   - **Worker operations** → `WorkerInstructions.md`
   - **Resource cleanup** → `CleanupStrategy.md`
   - **Testing components** → `MockSOPVisualization.md`
   - **ReactFlow implementation** → `REACTFLOW_VISUALIZATION_GUIDE.md`
   - **Google OAuth** → `PopupAuthentication.md`

2. **⚠️ CRITICAL: Flag Inconsistencies Immediately**
   - If you find discrepancies between documentation and actual codebase
   - If documented features don't exist or work differently than described
   - If implementation details contradict the documented architecture
   - **Always verify claims before implementing changes**

3. **✅ DOCUMENTATION CLEANED**: All consolidation complete, cross-references added

4. **Self-Service First**: Use documentation to understand context before asking clarifying questions

### ✅ Documentation Cleanup Complete

**STATUS: CONSOLIDATED & CROSS-REFERENCED** - All overlaps resolved and consistency verified:

#### 🔄 ReactFlow Documentation ✅ CONSOLIDATED
- **Primary**: `REACTFLOW_VISUALIZATION_GUIDE.md` (enhanced with all content)
- **Removed**: `SOPReactFlowArchitecture.md` (merged into main guide)
- **Specialized**: `MockSOPVisualization.md` (testing-specific, kept separate)

#### 🔄 Processing Pipeline Documentation ✅ CROSS-REFERENCED  
- **AI Focus**: `AI_PROCESSING_PIPELINE.md` (Gemini workflow details)
- **Upload Flow**: `UploadProcessingArchitecture.md` (complete pipeline)
- **Operations**: `WorkerInstructions.md` (maintenance & troubleshooting)
- **Result**: All documents now cross-reference each other appropriately

#### ✅ Discrepancies Fixed
1. **File size limits**: All docs now consistently show **750MB / 20min** limits
2. **Processing stages**: All processing docs include complete transcription step
3. **Database schema**: Progress tracking fields documented across all relevant docs
4. **Cross-references**: Related docs now link to each other for complete context

#### 📈 Final Documentation Quality
- **Comprehensive & Verified**: All 12 remaining docs verified for accuracy
- **Cross-Referenced**: Related topics now link to each other  
- **Consistent**: No conflicting information between documents
- **Self-Contained**: Each doc can be used independently but references others when needed

### 📊 Final Documentation Suite
**Total Documents**: 12 (consolidated from 13)  
**Total Size**: ~125KB of comprehensive documentation  
**Status**: ✅ Cleaned, verified, and cross-referenced  
**Verification Date**: Dec 2024

## ⚡ Quick Navigation for AI Agents

### Core User Flow
```
User records video → uploads via drag/drop → AI processing → ReactFlow visualization
```

### Critical Files (Start Here)
```
📁 app_frontend/
├── app/page.tsx                    # 🎯 Main upload UI (drag/drop + validation)
├── app/api/get-upload-url/route.ts # 🔗 Generates signed upload URLs  
├── app/api/queue-job/route.ts      # 📋 Queues background processing
├── app/api/job-status/[jobId]/     # 📊 Status polling for processing
├── app/sop/[sopId]/page.tsx        # 👁️  SOP viewer (ReactFlow + List toggle)
├── worker.js                       # 🔥 Background AI processing pipeline
└── components/sop/SOPFlowView.tsx  # 🎨 ReactFlow visualization engine
```

### Data Flow (Verified Implementation)
```
1. Upload:    GET /api/get-upload-url → PUT to Supabase Storage
2. Queue:     POST /api/queue-job → jobs table record  
3. Process:   worker.js polls jobs → ffmpeg + 2-stage Gemini AI
4. View:      Poll /api/job-status → Display ReactFlow diagram
```

## 🔍 Current System State (Reality Check)

### ✅ VERIFIED - Working Features
- **Upload**: 750MB / 20min limits (not 500MB/10min as old docs claim)
- **AI Pipeline**: Two-stage process (transcription → SOP parsing)  
- **Authentication**: Google OAuth via popup (preserves upload state)
- **Visualization**: Full ReactFlow with 5 custom node types
- **Progress**: Real-time polling with 4 processing stages

### ⚠️ NEEDS_VERIFICATION - Uncertain Areas
- **Auto-cleanup**: ADRs claim 24h deletion, not found in worker code
- **Rate limiting**: No visible API rate limits implemented
- **Error recovery**: Basic retry logic in worker, no advanced recovery

## 🗂️ Database Schema (Current)

```sql
-- Job tracking
jobs (id, job_id UUID, status, progress_stage, progress_percent, metadata JSONB)

-- Intermediate AI step  
transcripts (id, job_id, transcript JSONB, created_at)

-- Final structured output
sops (id, job_id, data JSONB, user_id, created_at)
```

## 🔧 Processing Pipeline (worker.js)

```javascript
// Stages with progress %
preparing_video (10-40%)   // Download → ffmpeg → upload slim  
transcribing (50-60%)      // Gemini: video → detailed transcript
parsing_sop (70-80%)       // Gemini: transcript → structured SOP  
finalizing (90%)           // Save to database + storage
completed (100%)           // Ready for visualization
```

## 🎨 ReactFlow Architecture

### Node Types & Files
```
TriggerNode    → components/sop/TriggerNode.tsx    # Start points
StepNode       → components/sop/StepNode.tsx       # Tasks + containers  
DecisionNode   → components/sop/DecisionNode.tsx   # Yes/No branches
LoopNode       → components/sop/LoopNode.tsx       # Iteration containers
EndNode        → components/sop/EndNode.tsx        # Terminal states
```

### Data Transformation Chain
```
Raw SOP JSON → processSopData() → transformSopToFlowData() → ReactFlow nodes/edges
                ↓                    ↓                         ↓
            lib/sop-utils.ts    lib/sop-utils.ts         SOPFlowView.tsx
```

## 🛠️ Common AI Agent Tasks

### Debug Upload Issues
```
Upload fails immediately     → Check app/api/get-upload-url/route.ts:23
Upload succeeds, no job     → Check app/api/queue-job/route.ts:38  
Job stuck processing        → Check worker.js logs + job status
```

### Add New ReactFlow Node Type
```
1. Create components/sop/[NodeType]Node.tsx
2. Register in SOPFlowView.tsx:nodeTypesConfig  
3. Add type in lib/types/sop.ts:SOPNode.type
4. Update lib/sop-utils.ts:transformSopToFlowData()
```

### Modify AI Processing
```
Transcription → Edit prompts/transcription_prompt_v1.md
SOP Parsing   → Edit prompts/flat_sop_parser_v0.9 copy.md
Retry Logic   → Modify worker.js:transcribeVideo() + generateSopFromTranscript()
```

### API Authentication  
```
Public endpoints:  /api/get-upload-url, /api/queue-job, /api/job-status
Protected routes:  /api/sop/[sopId] (RLS via user_id)
Auth context:      lib/auth-context.tsx (popup-based Google OAuth)
```

## 📊 System Dependencies

### Core Tech Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Next.js API routes + Supabase (PostgreSQL + Storage + Auth)
- **AI**: Google Gemini 2.5 Flash Preview (video → transcript → SOP)
- **Visualization**: ReactFlow + Dagre layout + Custom node components
- **Processing**: Node.js worker + ffmpeg + polling queue

### Environment Variables (.env.local)
```bash
NEXT_PUBLIC_SUPABASE_URL=          # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY=         # Backend database access  
GOOGLE_GEMINI_API_KEY=             # AI processing access
```

## 🔄 Development Workflow

### Start Local Development
```bash
cd app_frontend
npm install
npm run dev          # Frontend on localhost:3000
npm run worker       # Background processor (separate terminal)
```

### Test System Health
```bash
npm run test-worker  # Verify DB tables + storage + API keys
```

### Monitor Processing
```bash
# Check job status
GET /api/job-status/[jobId]

# Check worker logs (console output)
npm run worker
```

## 📁 File Organization Patterns

### API Routes Pattern
```
app/api/[endpoint]/route.ts  # Next.js 13+ App Router convention
- GET, POST, PATCH methods in same file
- Use createSupabaseServerClient() for auth
- Return NextResponse.json() with proper status codes
```

### Component Organization  
```
components/sop/              # SOP-specific UI components
components/ui/               # Reusable shadcn/ui components  
lib/types/                   # TypeScript definitions
lib/[feature].ts             # Utility functions by domain
```

### Documentation Structure
```
/docs/                       # Centralized high-level docs
app_frontend/docs/           # Implementation-specific details
components/[module]/README.md # Component-level documentation
```

---

## 🎯 Quick Decision Trees

**Need to debug?** → Check error type → Follow file paths above
**Adding features?** → Identify layer (UI/API/Worker/AI) → Follow patterns  
**Understanding flow?** → Start with app/page.tsx → Follow data through pipeline
**Modifying AI?** → Check prompts/ folder → Update worker.js constants

**Last Updated**: Based on codebase audit (26th of May 2025)  
**Verification Status**: ✅ Core flow verified | ⚠️ Cleanup logic uncertain
