# AI-Powered Agentic Execution Framework

## 🧠 Overview

The AEF has been completely redesigned with **Claude Sonnet 4** as the central intelligence. Instead of rule-based pattern matching, the system now uses sophisticated AI analysis to understand workflows and generate intelligent execution plans.

## 🔄 System Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React UI      │───▶│   FastAPI        │───▶│  Claude Sonnet  │
│   (Cockpit)     │    │   Backend        │    │      4          │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐             │
         └─────────────▶│  AI Orchestrator │◀────────────┘
                        │   (Core Logic)   │
                        └──────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ Browser Agents   │
                        │  (Execution)     │
                        └──────────────────┘
```

## 🚀 Quick Start

### 1. Environment Setup

Create a `.env` file in the `AEF` directory:

```bash
# Required: Claude API Key
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Supabase (if using direct backend access)
SUPABASE_URL=https://ypnnoivcybufgsrbzqkt.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Development
DEBUG=true
LOG_LEVEL=INFO
```

### 2. Install Dependencies

```bash
# Backend dependencies
cd AEF
pip install -r core/requirements.txt
pip install -r api/requirements.txt

# Frontend dependencies  
cd cockpit
npm install
```

### 3. Test AI Orchestrator

```bash
cd AEF
python test_ai_orchestrator.py
```

Expected output:
```
🧪 Testing AI-Powered Orchestrator
==================================================
✅ API Key found: sk-ant-api...
🤖 Calling Claude Sonnet 4 to analyze workflow...
✅ AI Analysis Complete!
📋 Generated 8 execution steps
⏱️  Estimated duration: 240 seconds
🛡️  Risk level: medium
👤 Human checkpoints: 2
```

### 4. Start the API Server

```bash
cd AEF
python start_api.py
```

Server will be available at:
- **API**: http://localhost:8000
- **Health**: http://localhost:8000/health
- **Docs**: http://localhost:8000/docs

### 5. Start the Frontend

```bash
cd AEF/cockpit
npm start
```

Frontend will be available at: http://localhost:3000

## 🧠 AI Intelligence Features

### Sophisticated Workflow Analysis

The AI orchestrator uses a comprehensive system prompt that enables:

1. **Context Understanding**: Analyzes both SOP structure and raw transcripts
2. **Intent Recognition**: Understands the business purpose of workflows
3. **Risk Assessment**: Identifies potential failure points and mitigation strategies
4. **Confidence Scoring**: Provides realistic confidence levels for each step
5. **Human Oversight**: Automatically determines when human approval is needed

### System Prompt Capabilities

The AI can:
- **Parse Complex Workflows**: Understand multi-step processes across different applications
- **Generate Atomic Steps**: Break down complex actions into executable browser commands
- **Plan for Failure**: Create fallback options for each step
- **Assess Risk**: Evaluate potential impact of each action
- **Optimize Efficiency**: Minimize unnecessary steps while maintaining reliability

### Example AI Analysis

**Input**: Gmail → Airtable investor email workflow

**AI Output**:
```json
{
  "title": "Automated Investor Email Processing and CRM Update",
  "description": "Intelligently process investor emails from Gmail and update corresponding contact records in Airtable CRM",
  "steps": [
    {
      "id": "step_1",
      "name": "Navigate to Gmail",
      "action_type": "navigate", 
      "confidence": "HIGH",
      "requires_approval": false,
      "reasoning": "Standard navigation to Gmail is highly reliable"
    },
    {
      "id": "step_5", 
      "name": "Update Investor Contact Record",
      "action_type": "type",
      "confidence": "MEDIUM",
      "requires_approval": true,
      "reasoning": "Data modification requires human verification to prevent errors"
    }
  ],
  "risk_assessment": {
    "overall_risk": "medium",
    "risk_factors": ["Data modification", "External API dependencies"],
    "mitigation_strategies": ["Human approval for updates", "Fallback manual process"]
  }
}
```

## 🔧 Technical Implementation

### Core Components

1. **`ai_orchestrator.py`**: Main AI intelligence using Claude Sonnet 4
2. **`main.py`**: FastAPI backend serving the orchestrator
3. **`orchestratorApi.ts`**: Frontend integration with AI backend
4. **React Cockpit**: Beautiful UI for human oversight

### AI Integration Details

- **Model**: Claude Sonnet 4 (`claude-3-5-sonnet-20241022`)
- **Temperature**: 0.1 (for consistent, logical output)
- **Max Tokens**: 4000 (sufficient for complex execution plans)
- **Async Processing**: Non-blocking AI calls with proper error handling

### API Endpoints

- `POST /api/ai-orchestrate`: Generate AI execution plan
- `GET /health`: Check system and AI availability
- `GET /docs`: Interactive API documentation

## 🎯 Key Improvements Over Rule-Based System

| Aspect | Rule-Based (Old) | AI-Powered (New) |
|--------|------------------|------------------|
| **Intelligence** | Pattern matching | Deep understanding |
| **Flexibility** | Hardcoded rules | Dynamic analysis |
| **Accuracy** | Limited patterns | Context-aware |
| **Scalability** | Manual rule updates | Self-improving |
| **Risk Assessment** | Basic heuristics | Intelligent evaluation |
| **Fallback Planning** | Predefined options | Creative alternatives |

## 🛡️ Safety & Human Oversight

### Automatic Human Approval Triggers

The AI automatically requires human approval for:
- Data modification or deletion
- Financial transactions  
- Sending emails/messages
- Low confidence steps (<70%)
- Business-critical decisions
- Irreversible actions

### Confidence Levels

- **HIGH (90%+)**: Standard navigation, simple clicks
- **MEDIUM (70-89%)**: Form filling, conditional logic
- **LOW (<70%)**: Complex decisions, error-prone actions

### Risk Assessment

- **LOW**: Read-only operations
- **MEDIUM**: Data entry, routine updates  
- **HIGH**: Irreversible actions, bulk changes

## 🔄 Data Flow

1. **User selects workflow** in React cockpit
2. **Frontend calls** `/api/ai-orchestrate` with SOP + transcript data
3. **AI Orchestrator** analyzes workflow using Claude Sonnet 4
4. **Claude generates** intelligent execution plan with confidence scores
5. **Backend returns** structured execution plan
6. **Frontend displays** plan in beautiful cockpit interface
7. **Human approves** critical steps through UI
8. **Browser agents execute** approved steps with real-time monitoring

## 🧪 Testing & Validation

### Test the AI Orchestrator

```bash
cd AEF
python test_ai_orchestrator.py
```

### Test the Full API

```bash
# Start API server
python start_api.py

# In another terminal, test the endpoint
curl -X POST "http://localhost:8000/api/ai-orchestrate" \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "test_123",
    "sop_data": {"meta": {"title": "Test Workflow"}},
    "transcript": "User opened browser and navigated to website"
  }'
```

### Test the Frontend Integration

1. Start both API server and React app
2. Sign in to cockpit
3. Select a real workflow
4. Click "Generate Agentic Execution Framework"
5. Verify AI-generated plan appears

## 🚨 Troubleshooting

### Common Issues

**API Key Not Working**:
```bash
# Check if key is set
echo $ANTHROPIC_API_KEY

# Test key directly
curl -H "Authorization: Bearer $ANTHROPIC_API_KEY" \
  https://api.anthropic.com/v1/messages
```

**Import Errors**:
```bash
# Ensure all dependencies installed
pip install -r core/requirements.txt
pip install -r api/requirements.txt
```

**CORS Issues**:
- Ensure React app runs on http://localhost:3000
- Check FastAPI CORS configuration in `main.py`

**AI Analysis Fails**:
- Check API key validity
- Verify internet connection
- Review logs for specific error messages

## 🎯 Next Steps

1. **Add More AI Models**: Support for GPT-4, Gemini Pro
2. **Enhanced Prompting**: Domain-specific system prompts
3. **Learning System**: AI learns from execution success/failure
4. **Multi-Agent Coordination**: Specialized agents for different tasks
5. **Real-time Adaptation**: Dynamic plan modification during execution

## 📚 Resources

- [Claude API Documentation](https://docs.anthropic.com/claude/reference)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)
- [AEF Project Overview](./PROJECT_OVERVIEW.md)

---

**The AEF is now a true AI-powered system that can intelligently understand and automate any workflow with sophisticated human oversight.** 🚀 