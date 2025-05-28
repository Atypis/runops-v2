"""
Agentic Orchestrator for Browser-Use Workflow Execution

This module orchestrates browser-use agents to execute structured workflows with
sophisticated uncertainty handling, self-correction, and multi-agent coordination.
"""

import json
import logging
import asyncio
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass
from enum import Enum
import google.generativeai as genai

logger = logging.getLogger(__name__)


class ExecutionStatus(Enum):
    """Execution status for workflow steps"""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    REQUIRES_HUMAN = "requires_human"
    UNCERTAIN = "uncertain"


class UncertaintyLevel(Enum):
    """Uncertainty levels for agent outputs"""
    LOW = "low"           # High confidence, proceed
    MEDIUM = "medium"     # Some uncertainty, validate
    HIGH = "high"         # High uncertainty, escalate
    CRITICAL = "critical" # Critical uncertainty, stop


@dataclass
class OrchestratorContext:
    """Context object passed to browser-use agents"""
    workflow_id: str
    step_id: str
    confidence_threshold: float = 0.8
    uncertainty_escalation: bool = True
    step_validation_required: bool = False
    alternative_strategies: List[str] = None
    shared_state: Dict[str, Any] = None
    orchestrator_callback: Optional[Callable] = None


@dataclass
class ExecutionResult:
    """Result of executing a workflow step"""
    step_id: str
    status: ExecutionStatus
    confidence_level: float
    uncertainty_factors: List[str]
    execution_time: float
    agent_output: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    fallback_used: bool = False
    human_intervention_required: bool = False
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert ExecutionResult to dictionary for JSON serialization"""
        return {
            "step_id": self.step_id,
            "status": self.status.value,
            "confidence_level": self.confidence_level,
            "uncertainty_factors": self.uncertainty_factors,
            "execution_time": self.execution_time,
            "agent_output": self.agent_output,
            "error_message": self.error_message,
            "fallback_used": self.fallback_used,
            "human_intervention_required": self.human_intervention_required
        }


class AgenticOrchestrator:
    """Orchestrates browser-use agents for workflow execution"""
    
    def __init__(self, gemini_model):
        self.gemini_model = gemini_model
        self.system_prompt = self._build_system_prompt()
        self.temperature = 0.3  # Lower temperature for consistent orchestration decisions
        self.max_tokens = 4000
        
        # Orchestration state
        self.active_workflows: Dict[str, Dict[str, Any]] = {}
        self.agent_pool: List[Any] = []  # Pool of available browser-use agents
        self.uncertainty_detector = UncertaintyDetector()
        self.execution_monitor = ExecutionMonitor()
    
    def _build_system_prompt(self) -> str:
        """Build the system prompt for the Agentic Orchestrator"""
        return """You are an expert Agentic Orchestrator responsible for executing structured workflows using browser-use agents. Your role is to:

## Core Responsibilities

1. **Workflow Execution Planning**: Convert structured SOPs into executable agent instructions
2. **Uncertainty Management**: Detect, assess, and handle uncertainty in agent outputs
3. **Self-Correction Orchestration**: Coordinate agent self-correction and fallback strategies
4. **Multi-Agent Coordination**: Manage multiple agents for complex workflows
5. **Human-in-Loop Integration**: Escalate to humans when appropriate

## Browser-Use Agent Architecture Understanding

### Agent Capabilities
- **Actions**: navigate, click, type, extract, validate, wait, scroll, drag_drop
- **Self-Correction**: Built-in retry mechanisms (max_failures=3), output validation
- **Uncertainty Reporting**: evaluation_previous_goal (Success|Failed|Unknown)
- **Context Awareness**: Screenshots, DOM state, element detection
- **Memory System**: Procedural memory for long conversations
- **Planning**: Optional planner LLM for strategy

### Agent Control Mechanisms
- **Pause/Resume**: External control for orchestration intervention
- **Step Callbacks**: Real-time monitoring of agent progress
- **Context Injection**: Custom orchestration data via context parameter
- **Action Filtering**: Domain-specific and page-specific action availability
- **Validation**: Built-in output validation and error recovery

### Uncertainty Indicators
- **"Unknown" in evaluation_previous_goal**: Agent is uncertain about success
- **Consecutive failures**: Multiple retry attempts indicate difficulty
- **Error patterns**: Specific error types suggest systematic issues
- **Confidence markers**: Agent's own confidence assessment

## Orchestration Strategies

### 1. Confidence-Based Execution
```python
if confidence_level >= 0.8:
    # Proceed with high confidence
    execute_step_autonomously()
elif confidence_level >= 0.5:
    # Medium confidence - add validation
    execute_with_validation()
else:
    # Low confidence - escalate or use fallback
    escalate_or_fallback()
```

### 2. Uncertainty Escalation Patterns
- **Agent Reports "Unknown"**: Provide additional context or alternative approach
- **Multiple Failures**: Switch to fallback strategy or different agent
- **Parsing Errors**: Simplify instructions or break into smaller steps
- **Element Not Found**: Wait, scroll, or try alternative selectors

### 3. Self-Correction Enhancement
- **Validation Actions**: Add explicit validation steps after uncertain actions
- **Alternative Strategies**: Provide multiple approaches for complex steps
- **Rollback Mechanisms**: Ability to undo actions and try different approaches
- **Human Escalation**: Clear criteria for when to involve humans

### 4. Multi-Agent Coordination
- **Primary/Backup Pattern**: Main agent with backup for failures
- **Parallel Execution**: Multiple agents for independent tasks
- **Sequential Handoff**: Pass context between agents for complex workflows
- **Consensus Building**: Multiple agents validate critical decisions

## Input Format
You receive structured SOPs with automation annotations:

```json
{
  "workflow_metadata": {...},
  "enhanced_steps": [
    {
      "step_id": "step_1",
      "automation": {
        "feasibility": "high|medium|low|manual",
        "confidence_level": 0.85,
        "uncertainty_factors": [...],
        "fallback_strategies": [...]
      },
      "browser_actions": [...],
      "success_indicators": [...],
      "failure_indicators": [...]
    }
  ]
}
```

## Output Format
Return execution plans with uncertainty handling:

```json
{
  "execution_plan": {
    "workflow_id": "workflow_123",
    "total_steps": 5,
    "estimated_duration": 300,
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
        "success_criteria": ["login form visible", "no error messages"],
        "uncertainty_handling": {
          "confidence_threshold": 0.8,
          "escalation_triggers": ["Unknown evaluation", "multiple failures"],
          "fallback_strategy": "retry_with_different_url",
          "max_retries": 3
        }
      },
      "orchestration_config": {
        "requires_validation": true,
        "parallel_execution": false,
        "human_approval_required": false,
        "timeout_seconds": 30
      }
    }
  ],
  "uncertainty_management": {
    "overall_confidence": 0.85,
    "risk_factors": ["dynamic_content", "network_dependency"],
    "mitigation_strategies": ["retry_logic", "alternative_selectors"],
    "escalation_plan": "human_review_on_failure",
    "monitoring_requirements": ["step_validation", "error_tracking"]
  },
  "coordination_strategy": {
    "agent_allocation": "single_agent_sequential",
    "backup_agents": 1,
    "parallel_tasks": [],
    "synchronization_points": ["after_login", "before_submission"],
    "rollback_capabilities": true
  }
}
```

## Key Principles

1. **Conservative Confidence**: Better to over-validate than under-validate
2. **Graceful Degradation**: Always have fallback strategies
3. **Transparent Uncertainty**: Clearly communicate confidence levels and risks
4. **Human-Centric**: Design for easy human intervention when needed
5. **Learning-Oriented**: Capture patterns for future improvement
6. **Robust Monitoring**: Comprehensive tracking of execution state

## Browser-Use Integration Specifics

### Agent Creation with Orchestration Context
```python
agent = Agent(
    task=step_instructions["task"],
    llm=llm,
    context=OrchestratorContext(
        workflow_id=workflow_id,
        step_id=step_id,
        confidence_threshold=0.8,
        uncertainty_escalation=True
    ),
    register_new_step_callback=orchestrator_step_callback,
    max_failures=3,
    use_vision=True,
    enable_memory=True
)
```

### Custom Orchestration Actions
```python
@controller.registry.action("Report uncertainty to orchestrator")
async def report_uncertainty(
    uncertainty_level: str,
    factors: List[str],
    context: OrchestratorContext
):
    # Escalate to orchestrator for guidance
    return await context.orchestrator_callback(uncertainty_level, factors)

@controller.registry.action("Validate step completion")
async def validate_step(
    expected_outcome: str,
    validation_criteria: List[str],
    context: OrchestratorContext
):
    # Validate that step achieved expected outcome
    # Return confidence level and validation results
```

### Uncertainty Detection Patterns
- **"Unknown" in evaluation_previous_goal**: Direct uncertainty signal
- **Repeated failures**: Systematic difficulty indicator
- **Parsing errors**: Communication breakdown
- **Element not found**: Environment mismatch
- **Timeout errors**: Timing or performance issues

Focus on creating robust, self-correcting execution plans that leverage browser-use's built-in capabilities while adding sophisticated orchestration intelligence."""

    async def create_execution_plan(self, enhanced_sop: Dict[str, Any]) -> Dict[str, Any]:
        """Create an execution plan from an enhanced SOP"""
        try:
            # Prepare the prompt
            prompt = f"""
{self.system_prompt}

## Enhanced SOP to Execute:
{json.dumps(enhanced_sop, indent=2)}

Please create a comprehensive execution plan with uncertainty handling as specified above.
Focus on leveraging browser-use agent capabilities while adding orchestration intelligence.
"""
            
            # Call Gemini
            response = await self._call_gemini(prompt)
            
            # Parse and validate the response
            execution_plan = self._parse_and_validate_execution_plan(response)
            
            return execution_plan
            
        except Exception as e:
            logger.error(f"Error creating execution plan: {str(e)}")
            return self._create_fallback_execution_plan(enhanced_sop)
    
    async def execute_workflow(self, execution_plan: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a workflow using the execution plan"""
        workflow_id = execution_plan["execution_plan"]["workflow_id"]
        
        # Initialize workflow state
        self.active_workflows[workflow_id] = {
            "plan": execution_plan,
            "status": "running",
            "current_step": 0,
            "results": [],
            "start_time": asyncio.get_event_loop().time()
        }
        
        try:
            results = []
            
            for i, step_instruction in enumerate(execution_plan["step_instructions"]):
                step_id = step_instruction["step_id"]
                
                logger.info(f"Executing step {i+1}/{len(execution_plan['step_instructions'])}: {step_id}")
                
                # Execute the step
                result = await self._execute_step(workflow_id, step_instruction)
                results.append(result)
                
                # Update workflow state
                self.active_workflows[workflow_id]["current_step"] = i + 1
                self.active_workflows[workflow_id]["results"] = results
                
                # Check if we should continue
                if result.status == ExecutionStatus.FAILED and not result.fallback_used:
                    logger.error(f"Step {step_id} failed without fallback")
                    break
                elif result.human_intervention_required:
                    logger.warning(f"Step {step_id} requires human intervention")
                    break
            
            # Finalize workflow
            self.active_workflows[workflow_id]["status"] = "completed"
            
            return {
                "workflow_id": workflow_id,
                "status": "completed",
                "results": [result.to_dict() for result in results],
                "summary": self._generate_execution_summary(results)
            }
            
        except Exception as e:
            logger.error(f"Workflow execution failed: {str(e)}")
            self.active_workflows[workflow_id]["status"] = "failed"
            return {
                "workflow_id": workflow_id,
                "status": "failed",
                "error": str(e)
            }
    
    async def _execute_step(self, workflow_id: str, step_instruction: Dict[str, Any]) -> ExecutionResult:
        """Execute a single workflow step"""
        step_id = step_instruction["step_id"]
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Create orchestrator context
            context = OrchestratorContext(
                workflow_id=workflow_id,
                step_id=step_id,
                confidence_threshold=step_instruction["agent_instructions"]["uncertainty_handling"]["confidence_threshold"],
                uncertainty_escalation=True,
                orchestrator_callback=self._handle_uncertainty_escalation
            )
            
            # For now, simulate agent execution
            # In real implementation, this would create and run a browser-use agent
            agent_output = await self._simulate_agent_execution(step_instruction, context)
            
            # Analyze uncertainty
            uncertainty_level = self.uncertainty_detector.analyze_output(agent_output)
            
            # Determine execution result
            execution_time = asyncio.get_event_loop().time() - start_time
            
            if uncertainty_level == UncertaintyLevel.LOW:
                status = ExecutionStatus.SUCCESS
            elif uncertainty_level == UncertaintyLevel.MEDIUM:
                status = ExecutionStatus.SUCCESS  # But with validation
            else:
                status = ExecutionStatus.UNCERTAIN
            
            return ExecutionResult(
                step_id=step_id,
                status=status,
                confidence_level=agent_output.get("confidence", 0.5),
                uncertainty_factors=agent_output.get("uncertainty_factors", []),
                execution_time=execution_time,
                agent_output=agent_output,
                fallback_used=False,
                human_intervention_required=uncertainty_level == UncertaintyLevel.CRITICAL
            )
            
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            logger.error(f"Step execution failed: {str(e)}")
            
            return ExecutionResult(
                step_id=step_id,
                status=ExecutionStatus.FAILED,
                confidence_level=0.0,
                uncertainty_factors=["execution_error"],
                execution_time=execution_time,
                error_message=str(e),
                human_intervention_required=True
            )
    
    async def _simulate_agent_execution(self, step_instruction: Dict[str, Any], context: OrchestratorContext) -> Dict[str, Any]:
        """Simulate browser-use agent execution (placeholder for real implementation)"""
        # This is a simulation - in real implementation, this would:
        # 1. Create a browser-use Agent with the task and context
        # 2. Execute the agent with the specified actions
        # 3. Monitor for uncertainty indicators
        # 4. Return the agent's output and analysis
        
        await asyncio.sleep(1)  # Simulate execution time
        
        return {
            "evaluation_previous_goal": "Success - Step completed as expected",
            "memory": "Executed step successfully with no issues",
            "next_goal": "Proceed to next step",
            "confidence": 0.85,
            "uncertainty_factors": [],
            "actions_taken": step_instruction["agent_instructions"]["actions"]
        }
    
    async def _handle_uncertainty_escalation(self, uncertainty_level: str, factors: List[str]) -> Dict[str, Any]:
        """Handle uncertainty escalation from agents"""
        logger.warning(f"Uncertainty escalation: {uncertainty_level}, factors: {factors}")
        
        # Implement escalation logic
        if uncertainty_level == "high":
            return {
                "action": "retry_with_alternative",
                "guidance": "Try alternative selectors or approach"
            }
        elif uncertainty_level == "critical":
            return {
                "action": "escalate_to_human",
                "guidance": "Human intervention required"
            }
        else:
            return {
                "action": "continue_with_validation",
                "guidance": "Proceed but add extra validation"
            }
    
    async def _call_gemini(self, prompt: str) -> str:
        """Call Gemini with the orchestration prompt"""
        try:
            response = self.gemini_model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.error(f"Gemini API call failed: {str(e)}")
            raise
    
    def _parse_and_validate_execution_plan(self, response: str) -> Dict[str, Any]:
        """Parse and validate Gemini's execution plan response"""
        try:
            # Extract JSON from response
            json_start = response.find('{')
            json_end = response.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response[json_start:json_end]
                parsed = json.loads(json_str)
                
                # Validate structure
                if self._validate_execution_plan_structure(parsed):
                    return parsed
                else:
                    logger.warning("Invalid execution plan structure")
                    return self._create_minimal_execution_plan()
            else:
                logger.warning("No valid JSON found in execution plan response")
                return self._create_minimal_execution_plan()
                
        except json.JSONDecodeError as e:
            logger.error(f"JSON parsing failed for execution plan: {str(e)}")
            return self._create_minimal_execution_plan()
    
    def _validate_execution_plan_structure(self, plan: Dict[str, Any]) -> bool:
        """Validate execution plan structure"""
        required_fields = ['execution_plan', 'step_instructions', 'uncertainty_management']
        return all(field in plan for field in required_fields)
    
    def _create_fallback_execution_plan(self, enhanced_sop: Dict[str, Any]) -> Dict[str, Any]:
        """Create a fallback execution plan when parsing fails"""
        return {
            "execution_plan": {
                "workflow_id": f"workflow_{hash(str(enhanced_sop)) % 10000}",
                "total_steps": len(enhanced_sop.get("enhanced_steps", [])),
                "estimated_duration": 300,
                "execution_strategy": "manual_review_required",
                "confidence_threshold": 0.5,
                "human_oversight_required": True
            },
            "step_instructions": [],
            "uncertainty_management": {
                "overall_confidence": 0.3,
                "risk_factors": ["parsing_failure"],
                "escalation_plan": "immediate_human_review"
            }
        }
    
    def _create_minimal_execution_plan(self) -> Dict[str, Any]:
        """Create minimal execution plan for fallback"""
        return {
            "execution_plan": {
                "workflow_id": "fallback_workflow",
                "total_steps": 0,
                "estimated_duration": 0,
                "execution_strategy": "manual_review_required",
                "confidence_threshold": 0.0,
                "human_oversight_required": True
            },
            "step_instructions": [],
            "uncertainty_management": {
                "overall_confidence": 0.0,
                "risk_factors": ["system_failure"],
                "escalation_plan": "immediate_human_review"
            }
        }
    
    def _generate_execution_summary(self, results: List[ExecutionResult]) -> Dict[str, Any]:
        """Generate a summary of execution results"""
        total_steps = len(results)
        successful_steps = sum(1 for r in results if r.status == ExecutionStatus.SUCCESS)
        failed_steps = sum(1 for r in results if r.status == ExecutionStatus.FAILED)
        uncertain_steps = sum(1 for r in results if r.status == ExecutionStatus.UNCERTAIN)
        
        avg_confidence = sum(r.confidence_level for r in results) / total_steps if total_steps > 0 else 0
        total_time = sum(r.execution_time for r in results)
        
        return {
            "total_steps": total_steps,
            "successful_steps": successful_steps,
            "failed_steps": failed_steps,
            "uncertain_steps": uncertain_steps,
            "success_rate": successful_steps / total_steps if total_steps > 0 else 0,
            "average_confidence": avg_confidence,
            "total_execution_time": total_time,
            "human_intervention_required": any(r.human_intervention_required for r in results)
        }


class UncertaintyDetector:
    """Detects and analyzes uncertainty in agent outputs"""
    
    def analyze_output(self, agent_output: Dict[str, Any]) -> UncertaintyLevel:
        """Analyze agent output for uncertainty indicators"""
        evaluation = agent_output.get("evaluation_previous_goal", "")
        confidence = agent_output.get("confidence", 0.5)
        uncertainty_factors = agent_output.get("uncertainty_factors", [])
        
        # Check for explicit uncertainty signals
        if "Unknown" in evaluation:
            return UncertaintyLevel.HIGH
        
        if "Failed" in evaluation:
            return UncertaintyLevel.CRITICAL
        
        # Check confidence level
        if confidence >= 0.8:
            return UncertaintyLevel.LOW
        elif confidence >= 0.5:
            return UncertaintyLevel.MEDIUM
        else:
            return UncertaintyLevel.HIGH
        
        # Check uncertainty factors
        if len(uncertainty_factors) > 2:
            return UncertaintyLevel.HIGH
        elif len(uncertainty_factors) > 0:
            return UncertaintyLevel.MEDIUM
        
        return UncertaintyLevel.LOW


class ExecutionMonitor:
    """Monitors workflow execution and provides real-time insights"""
    
    def __init__(self):
        self.execution_logs: List[Dict[str, Any]] = []
    
    def log_step_execution(self, step_id: str, result: ExecutionResult):
        """Log step execution for monitoring"""
        self.execution_logs.append({
            "timestamp": asyncio.get_event_loop().time(),
            "step_id": step_id,
            "status": result.status.value,
            "confidence": result.confidence_level,
            "execution_time": result.execution_time
        })
    
    def get_execution_metrics(self) -> Dict[str, Any]:
        """Get execution metrics for monitoring"""
        if not self.execution_logs:
            return {}
        
        total_steps = len(self.execution_logs)
        avg_confidence = sum(log["confidence"] for log in self.execution_logs) / total_steps
        avg_execution_time = sum(log["execution_time"] for log in self.execution_logs) / total_steps
        
        return {
            "total_steps_executed": total_steps,
            "average_confidence": avg_confidence,
            "average_execution_time": avg_execution_time,
            "success_rate": sum(1 for log in self.execution_logs if log["status"] == "success") / total_steps
        } 