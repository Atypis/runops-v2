# 🎯 SOP Orchestrator - Enterprise Automation Command Center

A bulletproof automation orchestrator for Standard Operating Procedures (SOPs) with comprehensive monitoring, human oversight, and agent coordination.

## 🚀 Quick Start

```bash
# Test the real browser-use integration first
python3 test_real_browser_integration.py

# Run the real browser demo with visual monitoring
cd sop_orchestrator
python3 real_browser_demo.py

# Or run the original mock demo
python3 visual_monitoring_demo.py

# Or start just the dashboard
python3 cockpit/web_server.py

# 🎥 NEW: Start the standalone timeline viewer (always-on results browser)
python3 start_timeline_viewer.py

# Access the dashboards
open http://localhost:8081                    # Main dashboard
open http://localhost:8081/visual-timeline   # Visual timeline
open http://localhost:8084                    # 🆕 Standalone timeline viewer
```

## 🎮 What You Get

### ✅ **Currently Implemented & Working**

- **🎛️ Enterprise Dashboard**: Real-time monitoring with sleek UI
- **🎥 Visual Timeline System**: "Time Machine" for agent actions with screenshot capture
- **🌐 Real Browser-Use Integration**: Actual Chrome browser with element highlighting
- **📊 Standalone Timeline Viewer**: Always-on results browser (NEW!)
- **🤖 Enhanced Agent System**: Comprehensive monitoring and evidence capture
- **🔧 Mission Templates**: Pre-configured automation workflows
- **📈 Performance Analytics**: Real-time metrics and intervention handling
- **🛡️ Security & Audit**: Complete evidence trails and compliance logging
- **🤖 Multi-Agent Coordination**: Specialized agents for auth, email, CRM tasks
- **👨‍💼 Human Oversight**: Interactive intervention system with approval workflows
- **📊 Comprehensive Monitoring**: Detailed logs, performance metrics, evidence capture
- **🔄 Error Recovery**: Automatic retries with intelligent recovery strategies
- **🔍 Audit Trails**: Complete mission history and checkpoint system
- **⚡ Real-time Updates**: WebSocket-powered live dashboard updates

### 🎥 **NEW: Real Browser-Use Visual Monitoring**

The **"Time Machine"** now works with **real browser automation**:

#### **Real Browser Features**
- **🌐 Actual Chrome Browser**: See real websites, not simulations
- **🎯 Browser-Use Element Highlighting**: Colored circles around clickable elements (built-in)
- **📸 Real Screenshots**: Actual browser screenshots with annotations
- **🔍 DOM Context**: Full element information (XPath, tag names, attributes)
- **📊 Interactive Element Counts**: See exactly how many elements are clickable
- **⏯️ Interactive Scrubbing**: Slide through real browser execution history

#### **Browser-Use Integration**
```python
# Real browser session with visual monitoring
from browser_use import BrowserSession
from core.visual_monitor import VisualMonitor

browser_session = BrowserSession(browser_profile=BrowserProfile(
    headless=False,           # Show the browser window
    highlight_elements=True,  # Enable element highlighting
))

visual_monitor = VisualMonitor(browser_session)
await visual_monitor.start_monitoring()

# Navigate and capture real screenshots
await browser_session.navigate("https://example.com")
state = await visual_monitor.capture_state()  # Real screenshot with highlights!
```

### 🎯 **Key Features**

#### **Mission Control Dashboard**
- Live agent status monitoring with visual timeline integration
- Task progress tracking with visual indicators
- Performance metrics (success rate, completion time)
- Evidence capture and documentation
- Interactive log viewer with filtering

#### **Human Intervention System**
- Smart approval checkpoints before each phase
- Context-aware intervention requests with visual context
- Multiple response options (approve/skip/pause/modify)
- Priority-based notification system

#### **Intelligent Agent System**
- **AuthAgent**: Handles authentication workflows
- **EmailAgent**: Processes email analysis and extraction
- **CRMAgent**: Manages database updates and contact records
- **BaseAgent**: General-purpose task execution with visual monitoring

#### **Error Recovery & Resilience**
- Automatic retry logic with exponential backoff
- Checkpoint-based rollback capabilities with visual evidence
- Strategy-based recovery (rollback, retry, agent switching)
- Complete failure analysis and reporting

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                🎮 Enhanced Cockpit + Visual Timeline        │
│          (FastAPI + WebSocket Dashboard + Time Machine)     │
└─────────────────────┬───────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                🎯 SOPOrchestrator                           │
│           (Central Mission Control)                         │
│  ┌─────────────┬─────────────┬─────────────┬─────────────┐  │
│  │StateManager │CheckpointMgr│ErrorRecovery│ AuditLogger │  │
│  └─────────────┴─────────────┴─────────────┴─────────────┘  │
└─────────────────────┬───────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼───┐     ┌──────▼──────┐     ┌────▼────┐
│ Auth  │     │    Email    │     │   CRM   │
│ Agent │     │    Agent    │     │  Agent  │
│   +   │     │      +      │     │    +    │
│Visual │     │   Visual    │     │ Visual  │
│Monitor│     │  Monitor    │     │Monitor  │
└───────┘     └─────────────┘     └─────────┘
```

## 📋 Mission Templates

### **Airtable CRM Investor Workflow**
Complete investor email analysis and CRM updates with visual monitoring:
- Gmail authentication & email search (with screenshots)
- Contact extraction from signatures (visual evidence)
- Airtable CRM synchronization (action tracking)
- Follow-up task generation (complete audit trail)

### **Simple Email Check**
Quick inbox verification with visual timeline:
- Basic Gmail access (login screenshots)
- Message counting and categorization (visual proof)
- Summary report generation (evidence capture)

### **Advanced Analytics**
Multi-platform data analysis with comprehensive visual tracking:
- Cross-platform authentication (visual verification)
- Data extraction and correlation (screenshot evidence)
- Predictive insights generation (complete timeline)

## 🎛️ Dashboard Features

### **Mission Control Panel**
- **Performance Metrics**: Tasks completed, success rates, timing
- **Live Agent Monitoring**: Real-time status of all active agents
- **Phase Progress**: Visual progression through SOP phases
- **Evidence Collection**: Screenshots, data extracts, audit items

### **Visual Timeline Dashboard**
- **Time Machine Interface**: Scrub through agent execution history
- **Action Annotations**: See exactly where agents clicked, typed, navigated
- **State Inspection**: Full context for each moment in time
- **Export Capabilities**: Screenshots, videos, PDF reports, raw data

### **Intervention Management**
- **Priority Queue**: High/Medium/Low priority requests
- **Context-Rich Requests**: Full context with visual evidence
- **Response Tracking**: Complete intervention audit trail

### **Analytics & Insights**
- **Agent Efficiency**: Performance analysis per agent type
- **Error Patterns**: Failure analysis with visual context
- **Mission Analytics**: Success rates, timing patterns
- **System Health**: Overall orchestrator performance

## 🔧 Configuration

### **Environment Setup**
```bash
# Required environment variables
export ANTHROPIC_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"  # Optional for certain features

# Install dependencies including visual monitoring
pip install -r requirements.txt
```

### **Visual Monitoring Configuration**
```python
# Configure screenshot capture interval
visual_monitor.screenshot_interval = 2.0  # seconds

# Enable/disable automatic capture
visual_monitor.auto_capture = True

# Set maximum timeline length
visual_monitor.max_timeline_length = 1000
```

### **SOP Definition Format**
```json
{
  "meta": {
    "title": "Your SOP Title",
    "goal": "Objective description",
    "description": "Detailed workflow description"
  },
  "steps": [
    {
      "text": "Step description",
      "category": "authentication|email_processing|crm_updates|reporting",
      "estimated_time": 30,
      "critical": true
    }
  ]
}
```

## 🎥 Visual Monitoring Usage

### **Starting Visual Monitoring**
```python
from core.orchestrator import SOPOrchestrator
from visual_monitoring_demo import VisualDemoAgent

# Create orchestrator with visual monitoring
orchestrator = SOPOrchestrator()

# Agents automatically initialize visual monitoring when browser session is provided
result = await orchestrator.execute_mission(
    sop_definition=your_sop_json,
    human_oversight=True,
    visual_monitoring=True  # Enable visual timeline
)
```

### **Accessing Visual Timeline**
1. **Live Monitoring**: Watch agents in real-time at `/visual-timeline`
2. **Historical Analysis**: Scrub through past executions
3. **Export Evidence**: Download screenshots, videos, or complete audit packages
4. **Debug Failures**: See exactly where and why things went wrong

### **Visual Timeline Controls**
- **▶️ Live Mode**: Automatically follow latest agent actions
- **⏸️ Manual Mode**: Manually scrub through timeline
- **⏮️ ⏭️ Navigation**: Jump between timeline states
- **📊 Export**: Generate reports with visual evidence

## 📁 Project Structure

```
sop_orchestrator/
├── core/
│   ├── orchestrator.py         # Main SOPOrchestrator class
│   ├── visual_monitor.py       # 🎥 NEW: Visual monitoring system
│   ├── state_manager.py        # Mission state management
│   ├── error_recovery.py       # Error handling and recovery
│   └── audit_logger.py         # Comprehensive logging
├── agents/
│   ├── base_agent.py          # Enhanced base agent with visual monitoring
│   ├── auth_agent.py          # Authentication specialist
│   ├── email_agent.py         # Email processing specialist
│   └── crm_agent.py           # CRM update specialist
├── cockpit/
│   ├── web_server.py          # Enhanced FastAPI server with visual APIs
│   ├── templates/
│   │   ├── enhanced_dashboard.html
│   │   └── visual_timeline.html  # 🎥 NEW: Visual timeline interface
│   └── static/                # CSS, JS, assets
├── integrations/              # External service integrations
├── tests/                     # Unit and integration tests
├── visual_monitoring_demo.py  # 🎥 NEW: Visual monitoring demo
└── requirements.txt           # Updated with Pillow for image processing
```

## 🎯 Usage Examples

### **Starting a Mission with Visual Monitoring**
```python
from core.orchestrator import SOPOrchestrator

# Initialize orchestrator with visual monitoring
orchestrator = SOPOrchestrator(
    human_intervention_callback=handle_interventions
)

# Execute SOP with visual timeline
result = await orchestrator.execute_mission(
    sop_definition=your_sop_json,
    human_oversight=True,
    max_retries=3
)

# Access visual timeline data
for agent_id, agent in orchestrator.active_agents.items():
    if agent.visual_monitor:
        timeline_data = agent.visual_monitor.get_timeline_data()
        export_path = await agent.visual_monitor.export_timeline()
```

### **Custom Agent with Visual Monitoring**
```python
from agents.base_agent import EnhancedBaseAgent

class CustomAgent(EnhancedBaseAgent):
    async def execute_phase(self, phase, browser_session=None, mission_context=None):
        # Visual monitoring is automatically initialized
        
        # Perform browser action with visual annotation
        await self._execute_browser_action(
            "click",
            selector="#login-button",
            coordinates=(100, 200),
            description="Click login button"
        )
        
        return await super().execute_phase(phase, browser_session, mission_context)
```

## 🔍 Monitoring & Debugging

### **Real-time Visual Monitoring**
- **Live Timeline**: Watch agent actions as they happen
- **Action Annotations**: See clicks, typing, navigation with visual overlays
- **State Inspection**: Full context for each moment
- **Error Visualization**: See exactly where failures occurred

### **Evidence Capture**
- **Automatic Screenshots**: Captured every 2 seconds
- **Action Documentation**: Visual proof of every agent action
- **Timeline Export**: Complete audit trail with visual evidence
- **Failure Analysis**: Screenshots of error states

### **Performance Metrics**
- **Task Completion Times**: With visual timeline correlation
- **Success/Failure Rates**: With visual evidence
- **Agent Efficiency Scores**: Including visual monitoring overhead
- **System Resource Usage**: Screenshot storage and processing

## 🚀 Production Deployment

For production use with visual monitoring:
- Configure proper authentication and access controls
- Set up SSL/TLS for the dashboard and visual timeline
- Implement proper secrets management
- Add monitoring and alerting for visual monitoring system
- Configure screenshot storage and retention policies
- Scale agent pools and visual monitoring as needed

## 🎬 Demo & Testing

```bash
# Run the visual monitoring demo
python3 visual_monitoring_demo.py

# Choose from:
# 1. Full Dashboard Demo (recommended) - Complete visual timeline interface
# 2. Workflow Demo Only - See visual monitoring in action
# 3. Standalone Monitor Demo - Test visual monitoring components
```

---

**Built for reliability, transparency, and human oversight in automation workflows - now with complete visual transparency.** 🎯🎥 