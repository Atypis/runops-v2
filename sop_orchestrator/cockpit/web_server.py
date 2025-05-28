"""
🎮 Enhanced Human Cockpit - Enterprise Control Center

Real-time dashboard with detailed agent monitoring, task tracking,
evidence capture, and comprehensive operational intelligence.
"""

import asyncio
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, List

# Add parent directory to path for imports
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from fastapi.responses import HTMLResponse
import uvicorn
import structlog

# Import orchestrator components
try:
    from core.orchestrator import SOPOrchestrator, HumanInterventionRequest, MissionStatus
except ImportError:
    # Mock classes for standalone testing
    class MissionStatus:
        PENDING = "pending"
        RUNNING = "running"
        COMPLETED = "completed"
    
    class HumanInterventionRequest:
        def __init__(self, **kwargs):
            self.request_id = kwargs.get('request_id', 'test')
            self.priority = kwargs.get('priority', 'medium')
            self.title = kwargs.get('title', 'Test Request')
            self.description = kwargs.get('description', 'Test Description')
            self.context = kwargs.get('context', {})
            self.suggested_actions = kwargs.get('suggested_actions', [])
            self.agent_id = kwargs.get('agent_id')
            self.created_at = datetime.utcnow()
    
    class SOPOrchestrator:
        def __init__(self):
            self.pending_interventions = {}
            self.human_intervention_callback = None
        
        def get_mission_status(self):
            return {"status": "test_mode"}
        
        async def handle_human_response(self, request_id, response):
            pass


logger = structlog.get_logger(__name__)


class EnhancedCockpitServer:
    """
    Enterprise-grade web interface for comprehensive SOP orchestration monitoring
    
    Features:
    - Real-time agent monitoring with detailed task breakdown
    - Performance metrics and analytics
    - Evidence capture and documentation
    - Granular control over agent operations
    - Comprehensive audit logging
    """
    
    def __init__(self, orchestrator: Optional[SOPOrchestrator] = None):
        self.app = FastAPI(title="SOP Orchestrator - Enterprise Control Center", version="2.0.0")
        self.orchestrator = orchestrator
        
        # WebSocket connections for real-time updates
        self.websocket_connections: List[WebSocket] = []
        
        # Enhanced monitoring data
        self.agent_logs: Dict[str, List[Dict[str, Any]]] = {}
        self.evidence_items: List[Dict[str, Any]] = []
        self.performance_metrics: Dict[str, Any] = {}
        self.mission_analytics: Dict[str, Any] = {}
        
        # Setup routes and callbacks
        self._setup_routes()
        self._setup_static_files()
        
        # Set up enhanced callbacks if orchestrator provided
        if self.orchestrator:
            self._setup_orchestrator_callbacks()
        
        logger.info("Enhanced CockpitServer initialized with detailed monitoring")
    
    def _setup_routes(self):
        """Setup FastAPI routes with enhanced endpoints"""
        
        @self.app.get("/", response_class=HTMLResponse)
        async def enhanced_dashboard(request: Request):
            """Enhanced dashboard with comprehensive monitoring"""
            templates = Jinja2Templates(directory="cockpit/templates")
            return templates.TemplateResponse("enhanced_dashboard.html", {"request": request})
        
        @self.app.get("/api/status")
        async def get_enhanced_status():
            """Get comprehensive mission status with analytics"""
            if not self.orchestrator:
                return {"status": "no_orchestrator"}
            
            status = self.orchestrator.get_mission_status()
            status.update({
                "performance_metrics": self.performance_metrics,
                "mission_analytics": self.mission_analytics,
                "evidence_count": len(self.evidence_items),
                "log_count": sum(len(logs) for logs in self.agent_logs.values())
            })
            
            return status
        
        @self.app.get("/api/agents/{agent_id}/details")
        async def get_agent_details(agent_id: str):
            """Get detailed agent information including logs and metrics"""
            if not self.orchestrator:
                raise HTTPException(status_code=400, detail="No orchestrator available")
            
            agent = self.orchestrator.active_agents.get(agent_id)
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")
            
            return {
                "agent_id": agent_id,
                "detailed_status": agent.get_detailed_status(),
                "recent_logs": self.agent_logs.get(agent_id, [])[-20:],
                "evidence_items": [e for e in self.evidence_items if e.get("agent_id") == agent_id],
                "performance_data": agent._get_current_metrics()
            }
        
        @self.app.get("/api/evidence")
        async def get_evidence():
            """Get all captured evidence with filtering options"""
            return {
                "evidence_items": self.evidence_items,
                "total_count": len(self.evidence_items),
                "by_type": self._group_evidence_by_type(),
                "by_agent": self._group_evidence_by_agent()
            }
        
        @self.app.get("/api/logs")
        async def get_logs():
            """Get comprehensive logs with filtering and search"""
            all_logs = []
            for agent_id, logs in self.agent_logs.items():
                for log in logs:
                    log["agent_id"] = agent_id
                    all_logs.append(log)
            
            # Sort by timestamp
            all_logs.sort(key=lambda x: x.get("timestamp", ""))
            
            return {
                "logs": all_logs,
                "total_count": len(all_logs),
                "log_levels": self._get_log_level_distribution(all_logs)
            }
        
        @self.app.get("/api/analytics")
        async def get_analytics():
            """Get comprehensive mission analytics and insights"""
            return {
                "mission_analytics": self.mission_analytics,
                "performance_trends": self._calculate_performance_trends(),
                "agent_efficiency": self._calculate_agent_efficiency(),
                "error_analysis": self._analyze_errors()
            }
        
        @self.app.get("/visual-timeline", response_class=HTMLResponse)
        async def visual_timeline_dashboard(request: Request):
            """Visual timeline dashboard page"""
            templates = Jinja2Templates(directory="cockpit/templates")
            return templates.TemplateResponse("visual_timeline.html", {"request": request})
        
        @self.app.get("/api/visual-timeline")
        async def get_visual_timeline():
            """Get visual timeline data for all agents"""
            timeline_data = []
            
            if self.orchestrator:
                for agent_id, agent in self.orchestrator.active_agents.items():
                    if hasattr(agent, 'visual_monitor') and agent.visual_monitor:
                        agent_timeline = agent.visual_monitor.get_timeline_data()
                        timeline_data.extend(agent_timeline)
            
            # Sort by timestamp
            timeline_data.sort(key=lambda x: x.get("timestamp", ""))
            
            return {
                "timeline": timeline_data,
                "total_states": len(timeline_data),
                "agents": list(self.orchestrator.active_agents.keys()) if self.orchestrator else []
            }
        
        @self.app.get("/api/visual-timeline/{agent_id}")
        async def get_agent_visual_timeline(agent_id: str):
            """Get visual timeline data for specific agent"""
            if not self.orchestrator:
                raise HTTPException(status_code=400, detail="No orchestrator available")
            
            agent = self.orchestrator.active_agents.get(agent_id)
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")
            
            if not hasattr(agent, 'visual_monitor') or not agent.visual_monitor:
                return {"timeline": [], "agent_id": agent_id, "total_states": 0}
            
            timeline_data = agent.visual_monitor.get_timeline_data()
            
            return {
                "timeline": timeline_data,
                "agent_id": agent_id,
                "total_states": len(timeline_data),
                "monitoring_active": agent.visual_monitor._is_running,
                "screenshot_interval": agent.visual_monitor.screenshot_interval
            }
        
        @self.app.get("/api/screenshot/{state_id}")
        async def get_screenshot(state_id: str):
            """Get screenshot for specific timeline state"""
            if not self.orchestrator:
                raise HTTPException(status_code=404, detail="No orchestrator available")
            
            # Find the state across all agents
            for agent_id, agent in self.orchestrator.active_agents.items():
                if hasattr(agent, 'visual_monitor') and agent.visual_monitor:
                    state = agent.visual_monitor.get_state_by_id(state_id)
                    if state and state.screenshot_path:
                        from fastapi.responses import FileResponse
                        return FileResponse(state.screenshot_path, media_type="image/png")
            
            raise HTTPException(status_code=404, detail="Screenshot not found")
        
        @self.app.get("/api/annotated-screenshot/{state_id}")
        async def get_annotated_screenshot(state_id: str):
            """Get annotated screenshot for specific timeline state"""
            if not self.orchestrator:
                raise HTTPException(status_code=404, detail="No orchestrator available")
            
            # Find the state across all agents
            for agent_id, agent in self.orchestrator.active_agents.items():
                if hasattr(agent, 'visual_monitor') and agent.visual_monitor:
                    state = agent.visual_monitor.get_state_by_id(state_id)
                    if state and state.annotated_screenshot_path:
                        from fastapi.responses import FileResponse
                        return FileResponse(state.annotated_screenshot_path, media_type="image/png")
            
            raise HTTPException(status_code=404, detail="Annotated screenshot not found")
        
        @self.app.post("/api/export-timeline")
        async def export_timeline():
            """Export complete visual timeline"""
            if not self.orchestrator:
                raise HTTPException(status_code=400, detail="No orchestrator available")
            
            export_data = {
                "export_timestamp": datetime.utcnow().isoformat(),
                "agents": {}
            }
            
            # Collect timeline data from all agents
            for agent_id, agent in self.orchestrator.active_agents.items():
                if hasattr(agent, 'visual_monitor') and agent.visual_monitor:
                    export_path = await agent.visual_monitor.export_timeline("json")
                    export_data["agents"][agent_id] = {
                        "timeline_length": len(agent.visual_monitor.timeline),
                        "export_path": export_path
                    }
            
            # Create combined export
            combined_export_path = f"screenshots/combined_timeline_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            
            import json
            with open(combined_export_path, 'w') as f:
                json.dump(export_data, f, indent=2)
            
            return {
                "status": "success",
                "export_path": combined_export_path,
                "download_url": f"/api/download/{combined_export_path.split('/')[-1]}"
            }
        
        @self.app.get("/api/download/{filename}")
        async def download_file(filename: str):
            """Download exported files"""
            file_path = f"screenshots/{filename}"
            if not Path(file_path).exists():
                raise HTTPException(status_code=404, detail="File not found")
            
            from fastapi.responses import FileResponse
            return FileResponse(file_path, filename=filename)
        
        @self.app.post("/api/visual-timeline/control")
        async def control_visual_monitoring(action: Dict[str, Any]):
            """Control visual monitoring for all agents"""
            if not self.orchestrator:
                raise HTTPException(status_code=400, detail="No orchestrator available")
            
            action_type = action.get("action")
            agent_id = action.get("agent_id")  # Optional: control specific agent
            
            agents_to_control = []
            if agent_id:
                agent = self.orchestrator.active_agents.get(agent_id)
                if agent:
                    agents_to_control = [agent]
            else:
                agents_to_control = list(self.orchestrator.active_agents.values())
            
            results = []
            for agent in agents_to_control:
                if hasattr(agent, 'visual_monitor') and agent.visual_monitor:
                    try:
                        if action_type == "start":
                            await agent.visual_monitor.start_monitoring()
                        elif action_type == "stop":
                            await agent.visual_monitor.stop_monitoring()
                        elif action_type == "set_interval":
                            interval = action.get("interval", 2.0)
                            agent.visual_monitor.screenshot_interval = interval
                        
                        results.append({
                            "agent_id": agent.agent_id,
                            "status": "success",
                            "action": action_type
                        })
                    except Exception as e:
                        results.append({
                            "agent_id": agent.agent_id,
                            "status": "error",
                            "error": str(e)
                        })
            
            return {"results": results}
        
        @self.app.post("/api/agents/{agent_id}/control")
        async def control_agent(agent_id: str, action: Dict[str, Any]):
            """Control individual agent operations (pause/resume/stop)"""
            if not self.orchestrator:
                raise HTTPException(status_code=400, detail="No orchestrator available")
            
            agent = self.orchestrator.active_agents.get(agent_id)
            if not agent:
                raise HTTPException(status_code=404, detail="Agent not found")
            
            action_type = action.get("action")
            
            if action_type == "pause":
                await agent.pause()
            elif action_type == "resume":
                await agent.resume()
            elif action_type == "stop":
                await agent.stop()
            else:
                raise HTTPException(status_code=400, detail="Invalid action")
            
            await self._broadcast_update({
                "type": "agent_control",
                "agent_id": agent_id,
                "action": action_type
            })
            
            return {"status": "success", "action": action_type}
        
        @self.app.post("/api/interventions/{request_id}/respond")
        async def respond_to_intervention(request_id: str, response: Dict[str, Any]):
            """Enhanced intervention response with detailed logging"""
            if not self.orchestrator:
                raise HTTPException(status_code=400, detail="No orchestrator available")
            
            await self.orchestrator.handle_human_response(request_id, response)
            
            # Log the intervention response
            await self._log_system_event("HUMAN_INTERVENTION", {
                "request_id": request_id,
                "response": response,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            await self._broadcast_update({
                "type": "intervention_resolved",
                "request_id": request_id,
                "response": response
            })
            
            return {"status": "success"}
        
        @self.app.post("/api/missions/start")
        async def start_enhanced_mission(request: Request):
            """Start mission with enhanced monitoring setup"""
            
            body = await request.body()
            mission_config = json.loads(body)
            
            # Create orchestrator if not exists
            if not self.orchestrator:
                logger.info("Creating orchestrator for mission execution")
                from core.orchestrator import SOPOrchestrator
                self.orchestrator = SOPOrchestrator()
                self._setup_orchestrator_callbacks()
            
            # Reset monitoring data for new mission
            self._reset_monitoring_data()
            
            # Start mission execution in background
            asyncio.create_task(self._execute_mission_with_monitoring(mission_config))
            
            await self._broadcast_update({
                "type": "mission_starting",
                "config": mission_config,
                "timestamp": datetime.utcnow().isoformat()
            })
            
            return {"status": "mission_started", "message": "Enhanced mission execution started"}
        
        @self.app.get("/api/missions/templates")
        async def get_mission_templates():
            """Get predefined mission templates"""
            templates = {
                "airtable_crm_workflow": {
                    "name": "Airtable CRM Investor Workflow",
                    "description": "Complete investor email analysis and CRM updates",
                    "estimated_duration": "12-15 minutes",
                    "complexity": "high",
                    "sop_definition": {
                        "meta": {
                            "title": "Enhanced Airtable CRM Investor Workflow",
                            "goal": "Comprehensive investor email analysis and CRM updates with full monitoring",
                            "description": "Advanced workflow with detailed task breakdown and evidence capture",
                            "estimated_duration": "12-15 minutes",
                            "complexity": "high"
                        },
                        "steps": [
                            {"text": "Initialize secure browser session with authentication monitoring", "category": "authentication"},
                            {"text": "Navigate to Gmail and perform secure login with credential validation", "category": "authentication"},
                            {"text": "Execute advanced search for investor emails (last 30 days)", "category": "email_processing"},
                            {"text": "Extract and validate contact information from email signatures", "category": "email_processing"},
                            {"text": "Analyze email content for investment opportunities and sentiment", "category": "email_processing"},
                            {"text": "Establish secure connection to Airtable CRM with API validation", "category": "crm_updates"},
                            {"text": "Map extracted email data to CRM fields with validation", "category": "crm_updates"},
                            {"text": "Update existing contact records with conflict resolution", "category": "crm_updates"},
                            {"text": "Create new contact records for unknown investors", "category": "crm_updates"},
                            {"text": "Generate follow-up tasks for sales team with priority assignment", "category": "crm_updates"},
                            {"text": "Create comprehensive summary report with analytics", "category": "reporting"}
                        ]
                    }
                },
                "simple_email_check": {
                    "name": "Simple Email Check",
                    "description": "Quick email inbox verification and basic analysis",
                    "estimated_duration": "3-5 minutes", 
                    "complexity": "low",
                    "sop_definition": {
                        "meta": {
                            "title": "Simple Email Verification",
                            "goal": "Quick email inbox check and basic analysis",
                            "description": "Lightweight workflow for email verification"
                        },
                        "steps": [
                            {"text": "Login to Gmail account", "category": "authentication"},
                            {"text": "Check inbox for new messages", "category": "email_processing"},
                            {"text": "Generate basic summary report", "category": "reporting"}
                        ]
                    }
                },
                "advanced_analytics": {
                    "name": "Advanced Analytics Workflow",
                    "description": "Comprehensive data analysis across multiple platforms",
                    "estimated_duration": "20-25 minutes",
                    "complexity": "very_high", 
                    "sop_definition": {
                        "meta": {
                            "title": "Advanced Multi-Platform Analytics",
                            "goal": "Comprehensive data analysis and reporting across Gmail, Airtable, and analytics platforms",
                            "description": "Enterprise-grade analytics workflow with detailed monitoring"
                        },
                        "steps": [
                            {"text": "Authenticate with multiple platforms (Gmail, Airtable, Analytics)", "category": "authentication"},
                            {"text": "Extract email engagement metrics and patterns", "category": "email_processing"},
                            {"text": "Analyze CRM data for conversion trends", "category": "crm_updates"},
                            {"text": "Cross-reference data across platforms", "category": "analytics"},
                            {"text": "Generate predictive insights and recommendations", "category": "analytics"},
                            {"text": "Create comprehensive executive dashboard", "category": "reporting"}
                        ]
                    }
                }
            }
            
            return {"templates": templates}
        
        @self.app.websocket("/ws")
        async def enhanced_websocket_endpoint(websocket: WebSocket):
            """Enhanced WebSocket endpoint with detailed real-time updates"""
            await websocket.accept()
            self.websocket_connections.append(websocket)
            
            # Send initial state
            await websocket.send_text(json.dumps({
                "type": "connection_established",
                "message": "Enhanced monitoring connected",
                "timestamp": datetime.utcnow().isoformat()
            }))
            
            try:
                while True:
                    data = await websocket.receive_text()
                    message = json.loads(data)
                    
                    # Handle enhanced client messages
                    if message.get("type") == "request_status":
                        if self.orchestrator:
                            status = await self.get_enhanced_status()
                            await websocket.send_text(json.dumps({
                                "type": "status_update",
                                "data": status
                            }))
                    
                    elif message.get("type") == "request_agent_details":
                        agent_id = message.get("agent_id")
                        if agent_id and self.orchestrator:
                            details = await self.get_agent_details(agent_id)
                            await websocket.send_text(json.dumps({
                                "type": "agent_details",
                                "agent_id": agent_id,
                                "data": details
                            }))
                    
            except WebSocketDisconnect:
                self.websocket_connections.remove(websocket)
    
    def _setup_static_files(self):
        """Setup static file serving"""
        static_dir = Path(__file__).parent / "static"
        if static_dir.exists():
            self.app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
        
        # Mount screenshots directory for visual monitoring
        screenshots_dir = Path(__file__).parent.parent / "screenshots"
        if screenshots_dir.exists():
            self.app.mount("/screenshots", StaticFiles(directory=str(screenshots_dir)), name="screenshots")
    
    def _setup_orchestrator_callbacks(self):
        """Setup enhanced callbacks for real-time monitoring"""
        self.orchestrator.human_intervention_callback = self._handle_intervention_request
        
        # Setup agent callbacks for detailed monitoring
        for agent in self.orchestrator.active_agents.values():
            self._setup_agent_callbacks(agent)
    
    def _setup_agent_callbacks(self, agent):
        """Setup detailed monitoring callbacks for an agent"""
        agent.log_callback = self._handle_agent_log
        agent.evidence_callback = self._handle_evidence_capture
        agent.status_callback = self._handle_agent_status_update
    
    async def _handle_agent_log(self, log_entry: Dict[str, Any]):
        """Handle detailed agent log entries"""
        agent_id = log_entry.get("agent_id")
        
        if agent_id not in self.agent_logs:
            self.agent_logs[agent_id] = []
        
        self.agent_logs[agent_id].append(log_entry)
        
        # Keep only last 1000 logs per agent
        if len(self.agent_logs[agent_id]) > 1000:
            self.agent_logs[agent_id] = self.agent_logs[agent_id][-1000:]
        
        # Broadcast to frontend
        await self._broadcast_update({
            "type": "detailed_log",
            "data": log_entry
        })
    
    async def _handle_evidence_capture(self, evidence: Dict[str, Any]):
        """Handle evidence capture from agents"""
        self.evidence_items.append(evidence)
        
        # Broadcast to frontend
        await self._broadcast_update({
            "type": "evidence_captured",
            "data": evidence
        })
    
    async def _handle_agent_status_update(self, agent_id: str, status_data: Dict[str, Any]):
        """Handle agent status updates"""
        await self._broadcast_update({
            "type": "agent_update",
            "agent_id": agent_id,
            "data": status_data
        })
    
    async def _handle_intervention_request(self, request: HumanInterventionRequest):
        """Enhanced intervention request handling"""
        logger.info("Enhanced intervention request received", 
                   request_id=request.request_id, 
                   title=request.title)
        
        # Handle both enum and string types for priority
        priority_value = request.priority
        if hasattr(request.priority, 'value'):
            priority_value = request.priority.value
        elif hasattr(request.priority, 'name'):
            priority_value = request.priority.name
        
        intervention_data = {
            "request_id": request.request_id,
            "priority": priority_value,
            "title": request.title,
            "description": request.description,
            "context": request.context,
            "suggested_actions": request.suggested_actions,
            "agent_id": request.agent_id,
            "created_at": request.created_at.isoformat(),
        }
        
        await self._broadcast_update({
            "type": "intervention_request",
            "data": intervention_data
        })
        
        # Log system event
        await self._log_system_event("INTERVENTION_REQUESTED", intervention_data)
    
    async def _execute_mission_with_monitoring(self, mission_config: Dict[str, Any]):
        """Execute mission with comprehensive monitoring"""
        try:
            # Setup monitoring for new agents
            def setup_new_agent_monitoring():
                for agent in self.orchestrator.active_agents.values():
                    if not hasattr(agent, 'log_callback') or agent.log_callback is None:
                        self._setup_agent_callbacks(agent)
            
            # Monitor for new agents periodically
            monitor_task = asyncio.create_task(self._monitor_for_new_agents())
            
            result = await self.orchestrator.execute_mission(
                sop_definition=mission_config["sop_definition"],
                human_oversight=mission_config.get("human_oversight", True),
                max_retries=mission_config.get("max_retries", 2),
            )
            
            monitor_task.cancel()
            
            # Update analytics
            self._update_mission_analytics(result)
            
            await self._broadcast_update({
                "type": "mission_completed",
                "data": result,
                "analytics": self.mission_analytics
            })
            
        except Exception as e:
            await self._broadcast_update({
                "type": "mission_failed",
                "error": str(e),
                "error_type": type(e).__name__
            })
    
    async def _monitor_for_new_agents(self):
        """Monitor for new agents and setup callbacks"""
        while True:
            try:
                if self.orchestrator:
                    for agent in self.orchestrator.active_agents.values():
                        if not hasattr(agent, 'log_callback') or agent.log_callback is None:
                            self._setup_agent_callbacks(agent)
                await asyncio.sleep(1)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning("Error monitoring for new agents", error=str(e))
                await asyncio.sleep(5)
    
    def _reset_monitoring_data(self):
        """Reset monitoring data for new mission"""
        self.agent_logs.clear()
        self.evidence_items.clear()
        self.performance_metrics.clear()
        self.mission_analytics.clear()
    
    def _update_mission_analytics(self, mission_result: Dict[str, Any]):
        """Update mission analytics with results"""
        self.mission_analytics = {
            "mission_duration": mission_result.get("duration", 0),
            "total_phases": len(mission_result.get("results", {})),
            "success_rate": self._calculate_success_rate(mission_result),
            "agent_performance": self._analyze_agent_performance(),
            "task_distribution": self._analyze_task_distribution(),
            "error_patterns": self._analyze_error_patterns(),
            "efficiency_metrics": self._calculate_efficiency_metrics()
        }
    
    def _calculate_success_rate(self, mission_result: Dict[str, Any]) -> float:
        """Calculate overall mission success rate"""
        results = mission_result.get("results", {})
        if not results:
            return 0.0
        
        successful = sum(1 for r in results.values() if r.get("status") == "completed")
        return successful / len(results)
    
    def _analyze_agent_performance(self) -> Dict[str, Any]:
        """Analyze individual agent performance"""
        performance = {}
        
        if self.orchestrator:
            for agent_id, agent in self.orchestrator.active_agents.items():
                metrics = agent._get_current_metrics()
                performance[agent_id] = {
                    "efficiency": metrics.get("success_rate", 0),
                    "speed": metrics.get("average_task_time", 0),
                    "reliability": 1 - (metrics.get("errors_encountered", 0) / max(1, metrics.get("tasks_completed", 1)))
                }
        
        return performance
    
    def _analyze_task_distribution(self) -> Dict[str, Any]:
        """Analyze task distribution across agents"""
        distribution = {}
        
        for agent_id, logs in self.agent_logs.items():
            task_logs = [log for log in logs if "task" in log.get("message", "").lower()]
            distribution[agent_id] = len(task_logs)
        
        return distribution
    
    def _analyze_error_patterns(self) -> Dict[str, Any]:
        """Analyze error patterns in logs"""
        errors = []
        
        for logs in self.agent_logs.values():
            errors.extend([log for log in logs if log.get("level") == "ERROR"])
        
        error_types = {}
        for error in errors:
            error_type = error.get("data", {}).get("error_type", "Unknown")
            error_types[error_type] = error_types.get(error_type, 0) + 1
        
        return error_types
    
    def _calculate_efficiency_metrics(self) -> Dict[str, Any]:
        """Calculate efficiency metrics"""
        total_logs = sum(len(logs) for logs in self.agent_logs.values())
        total_evidence = len(self.evidence_items)
        
        return {
            "logs_per_minute": total_logs / max(1, self.mission_analytics.get("mission_duration", 1) / 60),
            "evidence_per_phase": total_evidence / max(1, self.mission_analytics.get("total_phases", 1)),
            "system_efficiency": self._calculate_system_efficiency()
        }
    
    def _calculate_system_efficiency(self) -> float:
        """Calculate overall system efficiency"""
        if not self.orchestrator:
            return 0.0
        
        total_efficiency = 0
        agent_count = 0
        
        for agent in self.orchestrator.active_agents.values():
            metrics = agent._get_current_metrics()
            if metrics.get("tasks_completed", 0) > 0:
                efficiency = metrics.get("success_rate", 0) * (1 / max(0.1, metrics.get("average_task_time", 1)))
                total_efficiency += efficiency
                agent_count += 1
        
        return total_efficiency / max(1, agent_count)
    
    def _group_evidence_by_type(self) -> Dict[str, int]:
        """Group evidence items by type"""
        groups = {}
        for item in self.evidence_items:
            item_type = item.get("type", "unknown")
            groups[item_type] = groups.get(item_type, 0) + 1
        return groups
    
    def _group_evidence_by_agent(self) -> Dict[str, int]:
        """Group evidence items by agent"""
        groups = {}
        for item in self.evidence_items:
            agent_id = item.get("agent_id", "unknown")
            groups[agent_id] = groups.get(agent_id, 0) + 1
        return groups
    
    def _get_log_level_distribution(self, logs: List[Dict[str, Any]]) -> Dict[str, int]:
        """Get distribution of log levels"""
        distribution = {}
        for log in logs:
            level = log.get("level", "unknown")
            distribution[level] = distribution.get(level, 0) + 1
        return distribution
    
    def _calculate_performance_trends(self) -> Dict[str, Any]:
        """Calculate performance trends over time"""
        # This would analyze performance over time
        # For now, return basic trend data
        return {
            "task_completion_trend": "stable",
            "error_rate_trend": "decreasing",
            "efficiency_trend": "improving"
        }
    
    def _calculate_agent_efficiency(self) -> Dict[str, float]:
        """Calculate efficiency score for each agent"""
        efficiency = {}
        
        if self.orchestrator:
            for agent_id, agent in self.orchestrator.active_agents.items():
                metrics = agent._get_current_metrics()
                success_rate = metrics.get("success_rate", 0)
                avg_time = metrics.get("average_task_time", 1)
                efficiency[agent_id] = success_rate / max(0.1, avg_time)
        
        return efficiency
    
    def _analyze_errors(self) -> Dict[str, Any]:
        """Analyze errors across the system"""
        error_logs = []
        
        for logs in self.agent_logs.values():
            error_logs.extend([log for log in logs if log.get("level") == "ERROR"])
        
        return {
            "total_errors": len(error_logs),
            "error_rate": len(error_logs) / max(1, sum(len(logs) for logs in self.agent_logs.values())),
            "most_common_errors": self._get_most_common_errors(error_logs)
        }
    
    def _get_most_common_errors(self, error_logs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Get most common error types"""
        error_counts = {}
        
        for error in error_logs:
            message = error.get("message", "Unknown error")
            error_counts[message] = error_counts.get(message, 0) + 1
        
        # Sort by count and return top 5
        sorted_errors = sorted(error_counts.items(), key=lambda x: x[1], reverse=True)
        return [{"error": error, "count": count} for error, count in sorted_errors[:5]]
    
    async def _log_system_event(self, event_type: str, data: Dict[str, Any]):
        """Log system-level events"""
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "agent_id": "SYSTEM",
            "role": "SYSTEM",
            "level": "INFO",
            "message": f"System event: {event_type}",
            "current_task": None,
            "data": data
        }
        
        if "SYSTEM" not in self.agent_logs:
            self.agent_logs["SYSTEM"] = []
        
        self.agent_logs["SYSTEM"].append(log_entry)
        
        await self._broadcast_update({
            "type": "detailed_log",
            "data": log_entry
        })
    
    async def _broadcast_update(self, message: Dict[str, Any]):
        """Enhanced broadcast with message queuing"""
        if not self.websocket_connections:
            return
        
        message["timestamp"] = datetime.utcnow().isoformat()
        message_json = json.dumps(message)
        disconnected = []
        
        for websocket in self.websocket_connections:
            try:
                await websocket.send_text(message_json)
            except Exception as e:
                logger.warning("Failed to send WebSocket message", error=str(e))
                disconnected.append(websocket)
        
        # Remove disconnected clients
        for websocket in disconnected:
            if websocket in self.websocket_connections:
                self.websocket_connections.remove(websocket)
    
    def set_orchestrator(self, orchestrator: SOPOrchestrator):
        """Set orchestrator with enhanced callback setup"""
        self.orchestrator = orchestrator
        self._setup_orchestrator_callbacks()
    
    async def start_server(self, host: str = "localhost", port: int = 8081):
        """Start the enhanced server"""
        config = uvicorn.Config(
            app=self.app,
            host=host,
            port=port,
            log_level="info"
        )
        server = uvicorn.Server(config)
        
        logger.info("Starting enhanced cockpit server", host=host, port=port)
        await server.serve()


# Enhanced background monitoring
async def start_enhanced_monitoring(cockpit: EnhancedCockpitServer):
    """Enhanced periodic monitoring with detailed metrics"""
    while True:
        try:
            if cockpit.orchestrator and cockpit.websocket_connections:
                # Get comprehensive status
                status = cockpit.orchestrator.get_mission_status()
                
                # Add enhanced metrics
                enhanced_status = {
                    **status,
                    "performance_metrics": cockpit.performance_metrics,
                    "mission_analytics": cockpit.mission_analytics,
                    "system_health": cockpit._calculate_system_efficiency(),
                    "active_connections": len(cockpit.websocket_connections)
                }
                
                await cockpit._broadcast_update({
                    "type": "status_update",
                    "data": enhanced_status
                })
            
            await asyncio.sleep(2)  # Update every 2 seconds
            
        except Exception as e:
            logger.warning("Error in enhanced monitoring", error=str(e))
            await asyncio.sleep(5)


# Convenience function for enhanced cockpit
async def run_enhanced_cockpit(
    orchestrator: Optional[SOPOrchestrator] = None,
    host: str = "localhost",
    port: int = 8081
):
    """Run the enhanced cockpit server"""
    
    cockpit = EnhancedCockpitServer(orchestrator)
    
    # Start enhanced monitoring in background
    monitor_task = asyncio.create_task(start_enhanced_monitoring(cockpit))
    
    try:
        await cockpit.start_server(host=host, port=port)
    finally:
        monitor_task.cancel()


# Legacy compatibility
CockpitServer = EnhancedCockpitServer
run_cockpit = run_enhanced_cockpit


if __name__ == "__main__":
    # Run enhanced cockpit for testing
    asyncio.run(run_enhanced_cockpit()) 