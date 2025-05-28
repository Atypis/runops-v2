# AEF - Agentic Execution Framework v2.0

## Enhanced Two-Stage Pipeline with Browser-Use Integration

The Agentic Execution Framework (AEF) has been completely redesigned with a sophisticated two-stage pipeline that leverages browser-use agents for intelligent workflow automation with uncertainty handling and self-correction capabilities.

## 🏗️ Architecture Overview

```
Raw Transcript Data
        ↓
┌─────────────────────────────────────┐
│     Stage 1: Enhanced SOP Parser    │
│  • Sophisticated workflow analysis  │
│  • Automation feasibility assessment│
│  • Confidence level annotations     │
│  • Browser action mapping          │
└─────────────────────────────────────┘
        ↓
   Structured SOP with
   Automation Annotations
        ↓
┌─────────────────────────────────────┐
│   Stage 2: Agentic Orchestrator    │
│  • Execution plan generation       │
│  • Uncertainty management          │
│  • Browser-use agent coordination  │
│  • Self-correction strategies      │
└─────────────────────────────────────┘
        ↓
   Executable Workflow with
   Browser-Use Agents
```

## 🚀 Key Features

### Enhanced SOP Parser
- **Intelligent Workflow Analysis**: Deep understanding of temporal patterns and user intent
- **Automation Feasibility Assessment**: Classifies each step as HIGH/MEDIUM/LOW/MANUAL automation feasibility
- **Confidence Annotations**: Provides confidence levels and uncertainty factors for each step
- **Browser Action Mapping**: Maps workflow steps to specific browser-use actions
- **Fallback Strategies**: Defines alternative approaches for uncertain steps

### Agentic Orchestrator
- **Browser-Use Integration**: Deep understanding of browser-use agent architecture and capabilities
- **Uncertainty Management**: Sophisticated detection and handling of agent uncertainty
- **Self-Correction Orchestration**: Coordinates agent self-correction and fallback strategies
- **Multi-Agent Coordination**: Manages multiple agents for complex workflows
- **Human-in-Loop**: Intelligent escalation to humans when appropriate

### Browser-Use Agent Understanding
- **Action Registry**: Complete understanding of available actions (navigate, click, type, extract, etc.)
- **Uncertainty Indicators**: Recognizes agent uncertainty signals ("Unknown" evaluations, failures)
- **Context Injection**: Passes orchestration context to agents for enhanced coordination
- **Step Callbacks**: Real-time monitoring and intervention capabilities
- **Memory Integration**: Leverages procedural memory for learning patterns

## 🔧 Installation & Setup

### Prerequisites
- Python 3.8+
- Google Gemini API key
- Browser-use library (for actual execution)

### Environment Setup
```bash
# Clone the repository
git clone <repository-url>
cd AEF

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
```

### Required Environment Variables
```bash
GOOGLE_API_KEY=your_gemini_api_key_here
```

## 🚀 Quick Start

### 1. Start the API Server
```bash
cd AEF
python api/main.py
```

The server will start on `http://localhost:8000` with the following endpoints:

### 2. API Endpoints

#### Stage 1: Parse SOP
```bash
POST /parse-sop
```
Parses raw transcript data into structured SOP with automation annotations.

#### Stage 2: Create Execution Plan
```bash
POST /create-execution-plan
```
Creates execution plan from enhanced SOP with uncertainty handling.

#### Stage 3: Execute Workflow
```bash
POST /execute-workflow
```
Executes workflow using browser-use agents (currently simulated).

#### Full Pipeline
```bash
POST /full-pipeline
```
Complete pipeline from transcript to execution.

### 3. Test the Pipeline
```bash
cd AEF
python test_enhanced_pipeline.py
```

## 📊 Example Usage

### Sample Transcript Input
```json
[
  {
    "timestamp": "00:00:05",
    "action": "Navigate to website",
    "details": "User navigated to company portal login page",
    "url": "https://portal.company.com/login",
    "element": ""
  },
  {
    "timestamp": "00:00:18",
    "action": "Click username field",
    "details": "User clicked on the username input field",
    "url": "https://portal.company.com/login",
    "element": "input[name='username']"
  }
]
```

### Enhanced SOP Output
```json
{
  "workflow_metadata": {
    "title": "Company Portal Login and Report Generation",
    "total_steps": 8,
    "estimated_duration": 120,
    "automation_coverage": 0.85,
    "complexity_score": 0.4,
    "requires_human_intervention": false
  },
  "enhanced_steps": [
    {
      "step_id": "step_1",
      "original_step": {
        "action": "Navigate to login page",
        "details": "User opened browser and went to company portal",
        "timestamp_range": "00:00-00:15"
      },
      "automation": {
        "feasibility": "high",
        "action_type": "navigate",
        "confidence_level": 0.95,
        "uncertainty_factors": [],
        "fallback_strategies": ["retry with different URL"],
        "validation_criteria": ["page title contains 'Login'"],
        "estimated_duration": 5,
        "requires_human_input": false
      },
      "browser_actions": [
        {
          "action": "go_to_url",
          "params": {"url": "https://portal.company.com/login"},
          "description": "Navigate to login page"
        }
      ],
      "success_indicators": ["Login form is visible"],
      "failure_indicators": ["404 error page"]
    }
  ]
}
```

### Execution Plan Output
```json
{
  "execution_plan": {
    "workflow_id": "workflow_123",
    "total_steps": 8,
    "estimated_duration": 120,
    "execution_strategy": "sequential_with_validation",
    "confidence_threshold": 0.8,
    "human_oversight_required": false
  },
  "step_instructions": [
    {
      "step_id": "step_1",
      "agent_instructions": {
        "task": "Navigate to login page and verify it loads correctly",
        "actions": [
          {
            "action": "go_to_url",
            "params": {"url": "https://portal.company.com/login"},
            "validation": "page title contains 'Login'"
          }
        ],
        "uncertainty_handling": {
          "confidence_threshold": 0.8,
          "escalation_triggers": ["Unknown evaluation"],
          "fallback_strategy": "retry_with_different_url",
          "max_retries": 3
        }
      }
    }
  ],
  "uncertainty_management": {
    "overall_confidence": 0.85,
    "risk_factors": ["dynamic_content"],
    "escalation_plan": "human_review_on_failure"
  }
}
```

## 🧠 Technical Deep Dive

### Browser-Use Architecture Integration

The Agentic Orchestrator has deep understanding of browser-use agent capabilities:

#### Agent Capabilities
- **Actions**: navigate, click, type, extract, validate, wait, scroll, drag_drop
- **Self-Correction**: Built-in retry mechanisms, output validation
- **Uncertainty Reporting**: evaluation_previous_goal (Success|Failed|Unknown)
- **Context Awareness**: Screenshots, DOM state, element detection
- **Memory System**: Procedural memory for long conversations

#### Uncertainty Detection Patterns
- **"Unknown" in evaluation_previous_goal**: Direct uncertainty signal
- **Repeated failures**: Systematic difficulty indicator
- **Parsing errors**: Communication breakdown
- **Element not found**: Environment mismatch
- **Timeout errors**: Timing or performance issues

#### Orchestration Strategies
- **Confidence-Based Execution**: Different strategies based on confidence levels
- **Uncertainty Escalation**: Structured escalation patterns for different uncertainty types
- **Self-Correction Enhancement**: Additional validation and alternative strategies
- **Multi-Agent Coordination**: Primary/backup patterns and parallel execution

### Gemini Model Configuration

#### Enhanced SOP Parser
- **Model**: gemini-2.5-flash-preview-05-20
- **Temperature**: 1.0 (higher for creative workflow synthesis)
- **Focus**: Temporal analysis, pattern recognition, automation feasibility

#### Agentic Orchestrator
- **Model**: gemini-2.5-flash-preview-05-20
- **Temperature**: 0.3 (lower for consistent orchestration decisions)
- **Focus**: Execution planning, uncertainty management, agent coordination

## 🔍 Monitoring & Debugging

### Execution Monitoring
The framework provides comprehensive monitoring:
- Real-time step execution tracking
- Confidence level monitoring
- Uncertainty factor analysis
- Performance metrics
- Human intervention triggers

### Debug Output Files
When running tests, the following files are generated:
- `enhanced_sop_result.json`: Parsed SOP with annotations
- `execution_plan_result.json`: Generated execution plan
- `execution_result.json`: Workflow execution results
- `pipeline_summary.json`: Comprehensive pipeline summary

## 🎯 Use Cases

### Ideal Scenarios
- **Web Application Workflows**: Login, form filling, data extraction
- **Report Generation**: Automated report creation and download
- **Data Entry Tasks**: Structured data input across multiple systems
- **Testing Workflows**: Automated UI testing with uncertainty handling

### Automation Coverage
- **HIGH Feasibility**: Standard web interactions (90%+ automation)
- **MEDIUM Feasibility**: Complex interactions requiring validation (70-90%)
- **LOW Feasibility**: Human judgment required (30-70%)
- **MANUAL**: Authentication, captcha, creative decisions (human required)

## 🔮 Future Enhancements

### Planned Features
1. **Real Browser-Use Integration**: Replace simulation with actual browser-use agents
2. **Learning System**: Machine learning from execution patterns
3. **Advanced Multi-Agent**: Sophisticated agent coordination strategies
4. **Visual Validation**: Screenshot-based validation and error detection
5. **Workflow Templates**: Pre-built templates for common workflows

### Integration Roadmap
1. **Phase 1**: Complete browser-use integration (current simulation → real agents)
2. **Phase 2**: Advanced uncertainty handling with ML-based confidence scoring
3. **Phase 3**: Multi-agent orchestration with consensus mechanisms
4. **Phase 4**: Self-improving system with pattern learning

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for:
- Code style and standards
- Testing requirements
- Documentation standards
- Pull request process

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation and examples
- Review the test files for usage patterns

---

**AEF v2.0** - Intelligent workflow automation with sophisticated uncertainty handling and browser-use integration. 