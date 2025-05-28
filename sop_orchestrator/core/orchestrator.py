"""
🎯 Central Orchestrator - The Mission Control Center

This is the brain of the operation. It:
- Manages the entire SOP mission lifecycle
- Coordinates specialized agents
- Handles human intervention requests
- Maintains complete state and audit trails
- Ensures graceful error recovery
"""

import asyncio
import uuid
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
import json
import structlog

# Add parent directory to path for imports
current_dir = Path(__file__).parent
parent_dir = current_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from .state_manager import StateManager, MissionState, CheckpointManager
from .error_recovery import ErrorRecovery, RecoveryStrategy
from .audit_logger import AuditLogger, AuditEvent

# Import agents dynamically to avoid circular imports
try:
    from agents.base_agent import BaseAgent, AgentRole
except ImportError:
    # Fallback for when running standalone
    class AgentRole:
        AUTH = "auth"
        EMAIL = "email"
        CRM = "crm"
        GENERAL = "general"
    
    class BaseAgent:
        def __init__(self, orchestrator=None):
            self.orchestrator = orchestrator
            self.status = "idle"
            self.current_task = None
        
        async def execute_phase(self, phase, browser_session=None, mission_context=None):
            """Basic execute_phase implementation"""
            self.status = "running"
            self.current_task = f"Executing {phase['name']}"
            
            # Simulate work
            await asyncio.sleep(2)
            
            self.status = "completed"
            self.current_task = None
            
            return {
                "status": "completed",
                "phase_name": phase["name"],
                "steps_completed": len(phase.get("steps", [])),
                "message": f"Phase {phase['name']} completed successfully"
            }
        
        def get_status(self):
            return self.status
        
        def get_current_task(self):
            return self.current_task
        
        async def stop(self):
            self.status = "stopped"

# Import browser use wrapper if available
try:
    from integrations.browser_use_wrapper import EnhancedBrowserUse
except ImportError:
    # Mock class for testing
    class EnhancedBrowserUse:
        def __init__(self, config=None):
            self.config = config or {}
        
        def get_session(self):
            return None
        
        async def cleanup(self):
            pass


logger = structlog.get_logger(__name__)


class MissionStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    WAITING_HUMAN = "waiting_human"
    ERROR = "error"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class HumanInterventionPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class HumanInterventionRequest:
    def __init__(
        self,
        request_id: str,
        priority: HumanInterventionPriority,
        title: str,
        description: str,
        context: Dict[str, Any],
        suggested_actions: List[str],
        agent_id: Optional[str] = None,
        screenshot_path: Optional[str] = None,
    ):
        self.request_id = request_id
        self.priority = priority
        self.title = title
        self.description = description
        self.context = context
        self.suggested_actions = suggested_actions
        self.agent_id = agent_id
        self.screenshot_path = screenshot_path
        self.created_at = datetime.utcnow()
        self.resolved_at: Optional[datetime] = None
        self.human_response: Optional[Dict[str, Any]] = None


class SOPOrchestrator:
    """
    The Central Command - Never Dies, Always Recovers
    
    This orchestrator is designed to be bulletproof:
    - Survives agent failures
    - Handles human interventions gracefully
    - Maintains complete audit trails
    - Supports rollback to any checkpoint
    """
    
    def __init__(
        self,
        browser_use_config: Optional[Dict[str, Any]] = None,
        human_intervention_callback: Optional[Callable] = None,
    ):
        # Core systems
        self.mission_id: Optional[str] = None
        self.state_manager = StateManager()
        self.checkpoint_manager = CheckpointManager()
        self.error_recovery = ErrorRecovery()
        self.audit_logger = AuditLogger()
        
        # Agent management
        self.active_agents: Dict[str, BaseAgent] = {}
        self.agent_pool: Dict[AgentRole, type] = {}
        
        # Human oversight
        self.human_intervention_callback = human_intervention_callback
        self.pending_interventions: Dict[str, HumanInterventionRequest] = {}
        
        # Browser automation
        self.browser_use = EnhancedBrowserUse(config=browser_use_config or {})
        
        # Mission state
        self.current_status = MissionStatus.PENDING
        self.current_phase: Optional[str] = None
        self.mission_start_time: Optional[datetime] = None
        
        logger.info("SOPOrchestrator initialized", orchestrator_id=id(self))
    
    async def execute_mission(
        self,
        sop_definition: Dict[str, Any],
        human_oversight: bool = True,
        max_retries: int = 3,
    ) -> Dict[str, Any]:
        """
        Execute a complete SOP mission with full orchestration
        
        Args:
            sop_definition: The SOP to execute (JSON format)
            human_oversight: Whether to enable human intervention points
            max_retries: Maximum retries per phase
            
        Returns:
            Complete mission results and audit trail
        """
        
        # Initialize mission
        self.mission_id = str(uuid.uuid4())
        self.mission_start_time = datetime.utcnow()
        self.current_status = MissionStatus.RUNNING
        
        # Log mission start
        await self.audit_logger.log_event(
            AuditEvent.MISSION_STARTED,
            mission_id=self.mission_id,
            sop_definition=sop_definition,
            human_oversight=human_oversight,
        )
        
        try:
            # Create initial checkpoint
            initial_checkpoint = await self.checkpoint_manager.create_checkpoint(
                mission_id=self.mission_id,
                phase="initialization",
                state={"sop_definition": sop_definition},
            )
            
            logger.info(
                "Mission started",
                mission_id=self.mission_id,
                sop_title=sop_definition.get("meta", {}).get("title", "Unknown"),
                checkpoint_id=initial_checkpoint,
            )
            
            # Break down SOP into phases
            phases = self._break_down_sop(sop_definition)
            
            # Execute each phase with full monitoring
            mission_results = {}
            for phase_index, phase in enumerate(phases):
                phase_name = f"phase_{phase_index + 1}_{phase['name']}"
                self.current_phase = phase_name
                
                # Human approval checkpoint (if enabled)
                if human_oversight and phase.get("requires_approval", True):
                    await self._request_phase_approval(phase, phase_index)
                
                # Execute phase with error recovery
                phase_result = await self._execute_phase_with_recovery(
                    phase, max_retries=max_retries
                )
                
                mission_results[phase_name] = phase_result
                
                # Create checkpoint after each phase
                await self.checkpoint_manager.create_checkpoint(
                    mission_id=self.mission_id,
                    phase=phase_name,
                    state={"results": mission_results, "current_phase": phase_index},
                )
            
            # Mission completed successfully
            self.current_status = MissionStatus.COMPLETED
            
            await self.audit_logger.log_event(
                AuditEvent.MISSION_COMPLETED,
                mission_id=self.mission_id,
                results=mission_results,
                duration_seconds=(datetime.utcnow() - self.mission_start_time).total_seconds(),
            )
            
            return {
                "mission_id": self.mission_id,
                "status": "completed",
                "results": mission_results,
                "audit_trail": await self.audit_logger.get_mission_audit(self.mission_id),
                "checkpoints": await self.checkpoint_manager.get_mission_checkpoints(self.mission_id),
            }
            
        except Exception as e:
            # Mission failed - log and attempt recovery
            self.current_status = MissionStatus.ERROR
            
            await self.audit_logger.log_event(
                AuditEvent.MISSION_FAILED,
                mission_id=self.mission_id,
                error=str(e),
                error_type=type(e).__name__,
            )
            
            # Attempt graceful recovery
            recovery_result = await self.error_recovery.handle_mission_failure(
                mission_id=self.mission_id,
                error=e,
                current_phase=self.current_phase,
            )
            
            if recovery_result.success:
                logger.info("Mission recovered", recovery_strategy=recovery_result.strategy)
                return await self.execute_mission(sop_definition, human_oversight, max_retries - 1)
            else:
                self.current_status = MissionStatus.FAILED
                raise
    
    def _break_down_sop(self, sop_definition: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Break down the SOP into manageable phases
        
        This is where we analyze the SOP structure and create
        a phased execution plan with clear boundaries.
        """
        
        phases = []
        
        # Extract steps from SOP definition
        steps = sop_definition.get("steps", [])
        
        # First, try to group by category field if available
        if steps and all(step.get("category") for step in steps):
            # Group steps by their category field
            current_category = None
            current_phase = None
            
            for step in steps:
                step_category = step.get("category")
                
                if step_category != current_category:
                    # Start new phase
                    if current_phase:
                        phases.append(current_phase)
                    
                    # Map category to agent type
                    agent_type_map = {
                        "authentication": "auth",
                        "email_processing": "email", 
                        "crm_updates": "crm",
                        "reporting": "general",
                        "analytics": "general"
                    }
                    
                    current_category = step_category
                    current_phase = {
                        "name": step_category,
                        "steps": [],
                        "agent_type": agent_type_map.get(step_category, "general")
                    }
                
                current_phase["steps"].append(step)
            
            # Add the last phase
            if current_phase:
                phases.append(current_phase)
        
        else:
            # Fallback to keyword-based grouping for legacy SOPs
            current_phase = {"name": "authentication", "steps": [], "agent_type": "auth"}
            
            for step in steps:
                step_text = step.get("text", "").lower()
                
                # Determine which phase this step belongs to
                if any(keyword in step_text for keyword in ["login", "sign in", "authenticate", "password"]):
                    if current_phase["name"] != "authentication":
                        phases.append(current_phase)
                        current_phase = {"name": "authentication", "steps": [], "agent_type": "auth"}
                    current_phase["steps"].append(step)
                    
                elif any(keyword in step_text for keyword in ["email", "inbox", "message", "gmail"]):
                    if current_phase["name"] != "email_processing":
                        phases.append(current_phase)
                        current_phase = {"name": "email_processing", "steps": [], "agent_type": "email"}
                    current_phase["steps"].append(step)
                    
                elif any(keyword in step_text for keyword in ["airtable", "crm", "update", "contact", "database"]):
                    if current_phase["name"] != "crm_updates":
                        phases.append(current_phase)
                        current_phase = {"name": "crm_updates", "steps": [], "agent_type": "crm"}
                    current_phase["steps"].append(step)
                    
                else:
                    # General workflow step
                    current_phase["steps"].append(step)
            
            # Add the last phase
            if current_phase["steps"]:
                phases.append(current_phase)
        
        return phases
    
    async def _request_phase_approval(self, phase: Dict[str, Any], phase_index: int):
        """Request human approval before executing a phase"""
        
        request = HumanInterventionRequest(
            request_id=str(uuid.uuid4()),
            priority=HumanInterventionPriority.MEDIUM,
            title=f"Approve Phase {phase_index + 1}: {phase['name'].title()}",
            description=f"Ready to execute phase '{phase['name']}' with {len(phase['steps'])} steps.",
            context={
                "phase": phase,
                "phase_index": phase_index,
                "mission_id": self.mission_id,
            },
            suggested_actions=["approve", "skip", "pause", "modify"],
        )
        
        self.pending_interventions[request.request_id] = request
        self.current_status = MissionStatus.WAITING_HUMAN
        
        logger.info("Created human intervention request", 
                   request_id=request.request_id, 
                   phase=phase['name'], 
                   callback_set=self.human_intervention_callback is not None)
        
        # Notify human via callback
        if self.human_intervention_callback:
            logger.info("Calling human intervention callback", request_id=request.request_id)
            await self.human_intervention_callback(request)
        else:
            logger.warning("No human intervention callback set!")
        
        # Wait for human response
        while request.human_response is None:
            await asyncio.sleep(1)
        
        self.current_status = MissionStatus.RUNNING
        
        # Process human response
        action = request.human_response.get("action", "approve")
        if action == "pause":
            self.current_status = MissionStatus.PAUSED
            raise Exception("Mission paused by human operator")
        elif action == "skip":
            logger.info("Phase skipped by human operator", phase=phase["name"])
            return "skipped"
    
    async def _execute_phase_with_recovery(
        self, 
        phase: Dict[str, Any], 
        max_retries: int = 3
    ) -> Dict[str, Any]:
        """Execute a phase with automatic error recovery"""
        
        for attempt in range(max_retries + 1):
            try:
                # Create phase checkpoint
                checkpoint_id = await self.checkpoint_manager.create_checkpoint(
                    mission_id=self.mission_id,
                    phase=f"{phase['name']}_attempt_{attempt + 1}",
                    state={"phase": phase, "attempt": attempt + 1},
                )
                
                # Execute the phase
                result = await self._execute_phase(phase)
                
                # Success!
                await self.audit_logger.log_event(
                    AuditEvent.PHASE_COMPLETED,
                    mission_id=self.mission_id,
                    phase_name=phase["name"],
                    attempt=attempt + 1,
                    result=result,
                )
                
                return result
                
            except Exception as e:
                await self.audit_logger.log_event(
                    AuditEvent.PHASE_FAILED,
                    mission_id=self.mission_id,
                    phase_name=phase["name"],
                    attempt=attempt + 1,
                    error=str(e),
                )
                
                if attempt < max_retries:
                    # Attempt recovery
                    recovery_strategy = await self.error_recovery.analyze_phase_failure(
                        phase=phase,
                        error=e,
                        attempt=attempt + 1,
                    )
                    
                    # Apply recovery strategy
                    await self._apply_recovery_strategy(recovery_strategy, checkpoint_id)
                    
                    logger.info(
                        "Retrying phase after recovery",
                        phase=phase["name"],
                        attempt=attempt + 2,
                        strategy=recovery_strategy.name,
                    )
                else:
                    # Final attempt failed
                    raise Exception(f"Phase '{phase['name']}' failed after {max_retries + 1} attempts: {e}")
    
    async def _execute_phase(self, phase: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single phase using appropriate specialized agent"""
        
        # Get or create appropriate agent
        agent_type = phase.get("agent_type", "general")
        agent = await self._get_or_create_agent(agent_type)
        
        # Execute phase with agent
        result = await agent.execute_phase(
            phase=phase,
            browser_session=self.browser_use.get_session(),
            mission_context={
                "mission_id": self.mission_id,
                "orchestrator": self,
            }
        )
        
        return result
    
    async def _get_or_create_agent(self, agent_type: str) -> BaseAgent:
        """Get existing agent or create new one of specified type"""
        
        if agent_type in self.active_agents:
            return self.active_agents[agent_type]
        
        # Import and create appropriate agent
        if agent_type == "auth":
            from agents.auth_agent import AuthAgent
            agent = AuthAgent(orchestrator=self)
        elif agent_type == "email":
            from agents.email_agent import EmailAgent
            agent = EmailAgent(orchestrator=self)
        elif agent_type == "crm":
            from agents.crm_agent import CRMAgent
            agent = CRMAgent(orchestrator=self)
        else:
            from agents.base_agent import BaseAgent
            agent = BaseAgent(orchestrator=self)
        
        self.active_agents[agent_type] = agent
        return agent
    
    async def _apply_recovery_strategy(self, strategy: RecoveryStrategy, checkpoint_id: str):
        """Apply a recovery strategy"""
        
        if strategy.action == "rollback":
            await self.checkpoint_manager.rollback_to_checkpoint(checkpoint_id)
        elif strategy.action == "retry_with_delay":
            await asyncio.sleep(strategy.params.get("delay", 5))
        elif strategy.action == "switch_agent":
            # Replace current agent with different type
            old_agent_type = strategy.params.get("old_agent_type")
            new_agent_type = strategy.params.get("new_agent_type")
            if old_agent_type in self.active_agents:
                del self.active_agents[old_agent_type]
    
    # Human intervention methods
    async def handle_human_response(self, request_id: str, response: Dict[str, Any]):
        """Handle response from human operator"""
        
        if request_id in self.pending_interventions:
            request = self.pending_interventions[request_id]
            request.human_response = response
            request.resolved_at = datetime.utcnow()
            
            await self.audit_logger.log_event(
                AuditEvent.HUMAN_INTERVENTION,
                mission_id=self.mission_id,
                request_id=request_id,
                response=response,
            )
    
    async def request_human_intervention(
        self,
        priority: HumanInterventionPriority,
        title: str,
        description: str,
        context: Dict[str, Any],
        suggested_actions: List[str],
        agent_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Request human intervention from any part of the system"""
        
        request = HumanInterventionRequest(
            request_id=str(uuid.uuid4()),
            priority=priority,
            title=title,
            description=description,
            context=context,
            suggested_actions=suggested_actions,
            agent_id=agent_id,
        )
        
        self.pending_interventions[request.request_id] = request
        
        # Notify human
        if self.human_intervention_callback:
            await self.human_intervention_callback(request)
        
        # Wait for response
        while request.human_response is None:
            await asyncio.sleep(0.5)
        
        return request.human_response
    
    # Status and monitoring
    def get_mission_status(self) -> Dict[str, Any]:
        """Get current mission status for dashboard"""
        
        return {
            "mission_id": self.mission_id,
            "status": self.current_status.value,
            "current_phase": self.current_phase,
            "start_time": self.mission_start_time.isoformat() if self.mission_start_time else None,
            "active_agents": {
                agent_type: {
                    "status": agent.get_status(),
                    "current_task": agent.get_current_task(),
                }
                for agent_type, agent in self.active_agents.items()
            },
            "pending_interventions": len(self.pending_interventions),
        }
    
    async def cleanup(self):
        """Clean up resources"""
        
        # Stop all agents
        for agent in self.active_agents.values():
            await agent.stop()
        
        # Close browser sessions
        await self.browser_use.cleanup()
        
        logger.info("Orchestrator cleanup completed", mission_id=self.mission_id) 