# 🗺️ Runops Codebase Map

> **AI Agent Navigation Guide - Component Relationships & Architecture**

## 🏗️ System Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend UI   │───▶│   API Routes     │───▶│  Background     │
│   (Next.js)     │    │   (REST/JSON)    │    │  Worker         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  ReactFlow      │    │   Supabase       │    │   Gemini AI     │
│  Visualization  │    │   (DB + Storage) │    │   Processing    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 📂 Directory Structure with Purpose

```
app_frontend/
├── 🎯 app/                          # Next.js App Router (pages + API)
│   ├── page.tsx                    # Landing page with upload
│   ├── layout.tsx                  # Root layout with sidebar
│   ├── globals.css                 # Global styles + Tailwind
│   ├── api/                        # Backend API endpoints
│   │   ├── get-upload-url/         # Generate signed upload URLs
│   │   ├── queue-job/              # Queue background processing  
│   │   ├── job-status/[jobId]/     # Poll processing status
│   │   ├── sop/[sopId]/            # Retrieve/update SOPs
│   │   └── direct-*/               # Direct access for debugging
│   ├── auth/                       # Authentication flow pages
│   ├── dashboard/                  # User dashboard (future)
│   ├── my-sops/                    # User's SOP library
│   └── sop/[sopId]/               # SOP viewer with ReactFlow
│
├── 🎨 components/                   # Reusable UI components
│   ├── sop/                        # SOP-specific components
│   │   ├── SOPFlowView.tsx         # Main ReactFlow container
│   │   ├── SOPListView.tsx         # Alternative list view
│   │   ├── ElegantSOPView.tsx      # Enhanced list display
│   │   ├── [Node]Node.tsx          # Custom ReactFlow nodes (5 types)
│   │   ├── NodeEditSidebar.tsx     # Node editing interface
│   │   ├── ExpandedNodeEditor.tsx  # Advanced node editor
│   │   └── utils/                  # SOP-specific utilities
│   │       ├── edgeUtils.ts        # Edge routing & connection logic
│   │       └── CompoundNodeMarker.tsx # Visual markers for edges
│   ├── ui/                         # shadcn/ui base components
│   └── [layout components].tsx     # Sidebar, navigation, etc.
│
├── 🧠 lib/                          # Core business logic
│   ├── types/
│   │   └── sop.ts                  # TypeScript type definitions
│   ├── sop-utils.ts                # SOP data processing & transformation
│   ├── auth-context.tsx            # Authentication state management
│   ├── supabase-*.ts              # Database client configurations
│   └── utils.ts                    # General utility functions
│
├── 🔧 worker.js                     # Background job processor
├── 🧪 test-worker.js               # Worker setup verification
├── 📝 prompts/                     # AI prompting strategies
│   ├── transcription_prompt_v1.md # Video → transcript prompt
│   └── *sop_parser_v*.md          # Transcript → SOP prompts
├── 📚 docs/                        # Documentation
├── 🎭 public/                      # Static assets
└── 📦 [config files]               # package.json, next.config.js, etc.
```

## 🔗 Component Relationships

### Data Flow Chain
```mermaid
graph TD
    A[app/page.tsx] --> B[API /get-upload-url]
    B --> C[Supabase Storage]
    C --> D[API /queue-job]
    D --> E[jobs table]
    E --> F[worker.js]
    F --> G[Gemini AI]
    G --> H[sops table]
    H --> I[app/sop/[sopId]/page.tsx]
    I --> J[SOPFlowView.tsx]
    J --> K[Custom Node Components]
```

### Key Dependencies
```
SOPFlowView.tsx
├── Uses: lib/sop-utils.ts (data transformation)
├── Uses: lib/types/sop.ts (TypeScript definitions)  
├── Uses: components/sop/*Node.tsx (custom nodes)
├── Uses: components/sop/utils/edgeUtils.ts (routing)
└── Renders: ReactFlow with custom nodes & edges

lib/sop-utils.ts
├── Imports: lib/types/sop.ts (type definitions)
├── Exports: processSopData() (resolves parent-child)
├── Exports: transformSopToFlowData() (SOP → ReactFlow)
└── Exports: getLayoutedElements() (Dagre positioning)

worker.js
├── Uses: prompts/transcription_prompt_v1.md
├── Uses: prompts/flat_sop_parser_v0.9 copy.md
├── Connects: Supabase (jobs, transcripts, sops tables)
├── Connects: Gemini API (video processing)
└── Processes: ffmpeg (video compression)
```

## 🎯 Critical Integration Points

### 1. Upload Flow Integration
```typescript
// app/page.tsx:177 - Main upload handler
const handleProcessVideo = async () => {
  // Step 1: Get signed URL
  const response = await fetch('/api/get-upload-url', { method: 'POST' });
  
  // Step 2: Direct upload to Supabase Storage  
  xhr.open('PUT', url);
  xhr.send(file);
  
  // Step 3: Queue processing job
  await fetch('/api/queue-job', { 
    body: JSON.stringify({ jobId }) 
  });
  
  // Step 4: Start status polling
  pollJobStatus(jobId);
}
```

### 2. ReactFlow Integration  
```typescript
// components/sop/SOPFlowView.tsx:1192 - Main component
const SOPFlowView: React.FC<SOPFlowViewProps> = ({ sopData }) => {
  // Transform data: SOP JSON → ReactFlow nodes/edges
  const { flowNodes, flowEdges } = transformSopToFlowData(sopData);
  
  // Apply layout: Dagre algorithm for positioning
  const { nodes: layoutedNodes, edges: layoutedEdges } = 
    getLayoutedElements(flowNodes, flowEdges);
  
  // Render: ReactFlow with custom node types
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypesConfig}  // Custom node components
      edgeTypes={edgeTypesConfig}  // Custom edge rendering
    />
  );
};
```

### 3. Worker Processing Integration
```javascript
// worker.js:261 - Main processing pipeline  
async function extractSopFromVideo(videoPath, jobId) {
  // Stage 1: Video → Transcript (Gemini API)
  const transcript = await transcribeVideo(videoPath);
  await saveTranscriptToDatabase(jobId, transcript);
  
  // Stage 2: Transcript → SOP (Gemini API) 
  const sopData = await generateSopFromTranscript(transcript);
  await saveSopToDatabase(jobId, sopData);
  
  return sopData;
}
```

## 🔍 Debugging Entry Points

### Upload Issues
```typescript
// Check: app/api/get-upload-url/route.ts:23
const { data, error } = await supabase.storage
  .from('videos')
  .createSignedUploadUrl(`raw/${jobId}.mp4`);

// Check: app/api/queue-job/route.ts:38  
const { data: fileExists } = await supabase.storage
  .from('videos')
  .list('raw', { search: `${jobId}.mp4` });
```

### Processing Issues
```javascript
// Check: worker.js:94 - Job polling
const { data: jobs } = await supabase
  .from('jobs')
  .select('*')
  .eq('status', 'queued');

// Check: worker.js:300 - AI transcription
const result = await model.generateContent([
  TRANSCRIPTION_PROMPT,
  { inlineData: { mimeType: "video/mp4", data: base64Video } }
]);
```

### Visualization Issues
```typescript
// Check: lib/sop-utils.ts:288 - Data transformation
export const transformSopToFlowData = (sopDocument: SOPDocument) => {
  // Converts SOP nodes → ReactFlow nodes
  // Converts SOP edges → ReactFlow edges
};

// Check: components/sop/SOPFlowView.tsx:748 - Layout
const getLayoutedElements = (nodes: FlowNode[], edges: FlowEdge[]) => {
  // Applies Dagre layout algorithm
};
```

## 🎨 Custom Node Architecture

### Node Type Registration
```typescript
// components/sop/SOPFlowView.tsx:89
const nodeTypesConfig = {
  trigger: TriggerNode,    // Start points
  step: StepNode,          // Tasks + containers
  end: EndNode,            // Terminal states  
  decision: DecisionNode,  // Yes/No branches
  loop: LoopNode,          // Iteration containers
};
```

### Node Component Pattern
```typescript
// Example: components/sop/StepNode.tsx:24
const StepNode: React.FC<NodeProps<StepNodeData>> = ({ 
  data, id, isConnectable, selected 
}) => {
  // 1. Determine node styling based on data properties
  const isContainer = !!(data.childSopNodeIds?.length);
  const hasParent = !!(data.parentNode || data.parentId);
  
  // 2. Render node content with handles
  return (
    <div style={{ width: nodeWidth, height: nodeHeight }}>
      {/* Node content */}
      <Handle type="source" position={Position.Bottom} />
      <Handle type="target" position={Position.Top} />
    </div>
  );
};
```

## 🗄️ Database Schema Relationships

```sql
-- Primary job tracking
jobs (
  id SERIAL PRIMARY KEY,
  job_id UUID UNIQUE,           -- Links to storage paths
  status VARCHAR(50),           -- queued|processing|completed|error  
  progress_stage VARCHAR(50),   -- preparing_video|transcribing|parsing_sop|finalizing
  progress_percent INT,         -- 0-100 for UI progress bars
  metadata JSONB                -- { user_id } for RLS
);

-- Intermediate processing step
transcripts (
  id SERIAL PRIMARY KEY, 
  job_id UUID REFERENCES jobs(job_id),
  transcript JSONB              -- Raw transcript from Gemini
);

-- Final structured output
sops (
  id SERIAL PRIMARY KEY,
  job_id UUID REFERENCES jobs(job_id), 
  data JSONB,                   -- Structured SOP document
  user_id UUID REFERENCES auth.users(id)  -- RLS access control
);
```

## 🔐 Authentication Flow

```typescript
// lib/auth-context.tsx:67 - Popup-based OAuth
const signIn = async () => {
  const { data } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: '/auth/popup-callback',  // Popup target
      skipBrowserRedirect: true,           // Preserves main window
    }
  });
  
  // Opens popup, preserves upload state in main window
  const authWindow = openPopupWindow(data.url, 'Sign in', 580, 600);
};
```

## 🎛️ Configuration Files

### Environment Variables
```bash
# .env.local - Required for development
NEXT_PUBLIC_SUPABASE_URL=         # Frontend + backend access
SUPABASE_SERVICE_ROLE_KEY=        # Backend admin access (worker)  
GOOGLE_GEMINI_API_KEY=            # AI processing access
```

### Package Scripts
```json
// package.json - Development commands
{
  "scripts": {
    "dev": "next dev",              // Frontend development server
    "worker": "node worker.js",     // Background job processor
    "test-worker": "node test-worker.js"  // Verify setup
  }
}
```

---

## 🎯 Quick Reference for AI Agents

**Finding upload logic?** → Start at `app/page.tsx:177`
**Understanding ReactFlow?** → Start at `components/sop/SOPFlowView.tsx:1192`  
**Debugging worker?** → Check `worker.js:94` + console logs
**Adding node types?** → Follow pattern in `components/sop/StepNode.tsx`
**Modifying AI prompts?** → Check `prompts/` folder + `worker.js` constants
**Database issues?** → Check schema in this doc + Supabase dashboard

**Last Updated**: Dec 2024 (based on codebase audit) 