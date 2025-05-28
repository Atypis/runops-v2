"""
AEF Core Orchestrator Agent

This is the central intelligence that takes SOPs + raw transcripts and creates
dynamic execution plans using generic browser automation agents.
"""

import json
import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TaskType(Enum):
    NAVIGATE = "navigate"
    CLICK = "click"
    TYPE = "type"
    READ = "read"
    WAIT = "wait"
    DECISION = "decision"
    LOOP = "loop"

class ConfidenceLevel(Enum):
    HIGH = "high"      # 90%+ confidence
    MEDIUM = "medium"  # 70-89% confidence  
    LOW = "low"        # <70% confidence

@dataclass
class ExecutionStep:
    """Represents a single step in the execution plan"""
    id: str
    type: TaskType
    description: str
    target: Optional[str] = None
    input_data: Optional[str] = None
    confidence: ConfidenceLevel = ConfidenceLevel.MEDIUM
    reasoning: str = ""
    fallback_options: List[str] = None
    
    def __post_init__(self):
        if self.fallback_options is None:
            self.fallback_options = []

@dataclass
class ExecutionPlan:
    """Complete execution plan for a workflow"""
    workflow_id: str
    steps: List[ExecutionStep]
    estimated_duration: int  # in seconds
    risk_assessment: str
    human_checkpoints: List[int] = None  # step indices requiring human approval
    
    def __post_init__(self):
        if self.human_checkpoints is None:
            self.human_checkpoints = []

class OrchestratorAgent:
    """
    The central orchestrator that analyzes SOPs and creates execution plans
    """
    
    def __init__(self):
        self.execution_history = []
        self.confidence_threshold = 0.9  # 90% confidence required
        
    async def analyze_workflow(self, sop_data: Dict, transcript_data: List[Dict]) -> ExecutionPlan:
        """
        Analyze SOP + transcript to create a dynamic execution plan
        
        Args:
            sop_data: Parsed SOP structure from database
            transcript_data: Raw transcript with actions and timestamps
            
        Returns:
            ExecutionPlan: Detailed plan for agentic execution
        """
        logger.info(f"Analyzing workflow: {sop_data.get('meta', {}).get('title', 'Unknown')}")
        
        # Extract key information
        workflow_context = self._extract_workflow_context(sop_data, transcript_data)
        
        # Generate execution steps
        steps = await self._generate_execution_steps(workflow_context)
        
        # Assess risks and confidence
        risk_assessment = self._assess_risks(steps)
        
        # Identify human checkpoints
        human_checkpoints = self._identify_human_checkpoints(steps)
        
        plan = ExecutionPlan(
            workflow_id=sop_data.get('meta', {}).get('id', 'unknown'),
            steps=steps,
            estimated_duration=self._estimate_duration(steps),
            risk_assessment=risk_assessment,
            human_checkpoints=human_checkpoints
        )
        
        logger.info(f"Generated execution plan with {len(steps)} steps")
        return plan
    
    def _extract_workflow_context(self, sop_data: Dict, transcript_data: List[Dict]) -> Dict:
        """Extract key context from SOP and transcript data"""
        
        # Get the workflow goal and purpose
        meta = sop_data.get('meta', {})
        public_data = sop_data.get('public', {})
        
        # Extract applications used from transcript
        apps_used = set()
        for entry in transcript_data:
            if 'application_in_focus' in entry:
                apps_used.add(entry['application_in_focus'])
        
        # Extract key actions from transcript
        key_actions = []
        for entry in transcript_data:
            if entry.get('action_type_observed'):
                key_actions.append({
                    'action': entry['action_type_observed'],
                    'target': entry.get('target_element_details', {}),
                    'timestamp': entry.get('timestamp_start_visual'),
                    'context': entry.get('screen_region_description_post_action', '')
                })
        
        # Extract variables and data from SOP
        variables = public_data.get('variables', {})
        
        return {
            'goal': meta.get('goal', ''),
            'title': meta.get('title', ''),
            'purpose': meta.get('purpose', ''),
            'apps_used': list(apps_used),
            'key_actions': key_actions,
            'variables': variables,
            'nodes': public_data.get('nodes', []),
            'edges': public_data.get('edges', [])
        }
    
    async def _generate_execution_steps(self, context: Dict) -> List[ExecutionStep]:
        """Generate execution steps based on workflow context"""
        
        steps = []
        step_counter = 1
        
        # Start with opening required applications
        for app in context['apps_used']:
            if 'Gmail' in app:
                steps.append(ExecutionStep(
                    id=f"step_{step_counter}",
                    type=TaskType.NAVIGATE,
                    description="Open Gmail inbox",
                    target="https://mail.google.com",
                    confidence=ConfidenceLevel.HIGH,
                    reasoning="Gmail is a standard web application with predictable URL"
                ))
                step_counter += 1
                
            elif 'Airtable' in app:
                steps.append(ExecutionStep(
                    id=f"step_{step_counter}",
                    type=TaskType.NAVIGATE,
                    description="Open Airtable CRM",
                    target="https://airtable.com",
                    confidence=ConfidenceLevel.HIGH,
                    reasoning="Airtable is a standard web application"
                ))
                step_counter += 1
        
        # Process the main workflow logic based on SOP nodes
        for node in context['nodes']:
            if node.get('type') == 'loop':
                # Handle loop logic
                loop_steps = self._generate_loop_steps(node, step_counter)
                steps.extend(loop_steps)
                step_counter += len(loop_steps)
                
            elif node.get('type') == 'task':
                # Handle individual tasks
                task_step = self._generate_task_step(node, step_counter)
                if task_step:
                    steps.append(task_step)
                    step_counter += 1
                    
            elif node.get('type') == 'decision':
                # Handle decision points
                decision_step = self._generate_decision_step(node, step_counter)
                if decision_step:
                    steps.append(decision_step)
                    step_counter += 1
        
        return steps
    
    def _generate_loop_steps(self, loop_node: Dict, start_counter: int) -> List[ExecutionStep]:
        """Generate steps for loop execution"""
        steps = []
        counter = start_counter
        
        # For the investor email workflow, this would be the main email processing loop
        if 'process_emails' in loop_node.get('label', '').lower():
            steps.append(ExecutionStep(
                id=f"step_{counter}",
                type=TaskType.LOOP,
                description="Process investor emails in inbox",
                confidence=ConfidenceLevel.MEDIUM,
                reasoning="Loop requires dynamic email identification and processing",
                fallback_options=["Request human assistance for email classification"]
            ))
            counter += 1
            
            # Add sub-steps for email processing
            sub_steps = [
                ("Open next email", TaskType.CLICK, ConfidenceLevel.HIGH),
                ("Read email content", TaskType.READ, ConfidenceLevel.HIGH),
                ("Determine if investor-related", TaskType.DECISION, ConfidenceLevel.MEDIUM),
                ("Switch to Airtable", TaskType.NAVIGATE, ConfidenceLevel.HIGH),
                ("Find or create investor record", TaskType.CLICK, ConfidenceLevel.MEDIUM),
                ("Update investor information", TaskType.TYPE, ConfidenceLevel.MEDIUM),
                ("Return to Gmail", TaskType.NAVIGATE, ConfidenceLevel.HIGH)
            ]
            
            for desc, task_type, confidence in sub_steps:
                steps.append(ExecutionStep(
                    id=f"step_{counter}",
                    type=task_type,
                    description=desc,
                    confidence=confidence,
                    reasoning=f"Part of email processing workflow"
                ))
                counter += 1
        
        return steps
    
    def _generate_task_step(self, task_node: Dict, counter: int) -> Optional[ExecutionStep]:
        """Generate a single task step"""
        
        label = task_node.get('label', '')
        intent = task_node.get('intent', '')
        
        # Map common task patterns to execution steps
        if 'open' in label.lower() and 'gmail' in label.lower():
            return ExecutionStep(
                id=f"step_{counter}",
                type=TaskType.NAVIGATE,
                description=f"Open Gmail: {intent}",
                target="gmail_inbox",
                confidence=ConfidenceLevel.HIGH,
                reasoning="Gmail navigation is well-established"
            )
            
        elif 'open' in label.lower() and 'airtable' in label.lower():
            return ExecutionStep(
                id=f"step_{counter}",
                type=TaskType.NAVIGATE,
                description=f"Open Airtable: {intent}",
                target="airtable_crm",
                confidence=ConfidenceLevel.HIGH,
                reasoning="Airtable navigation is predictable"
            )
            
        elif 'click' in label.lower() or 'open' in label.lower():
            return ExecutionStep(
                id=f"step_{counter}",
                type=TaskType.CLICK,
                description=f"Click action: {intent}",
                confidence=ConfidenceLevel.MEDIUM,
                reasoning="Click actions require element identification"
            )
            
        elif 'update' in label.lower() or 'add' in label.lower():
            return ExecutionStep(
                id=f"step_{counter}",
                type=TaskType.TYPE,
                description=f"Data entry: {intent}",
                confidence=ConfidenceLevel.MEDIUM,
                reasoning="Data entry requires field identification and validation"
            )
        
        return None
    
    def _generate_decision_step(self, decision_node: Dict, counter: int) -> Optional[ExecutionStep]:
        """Generate a decision step"""
        
        return ExecutionStep(
            id=f"step_{counter}",
            type=TaskType.DECISION,
            description=f"Decision: {decision_node.get('label', '')}",
            confidence=ConfidenceLevel.LOW,  # Decisions are inherently uncertain
            reasoning="Decision points require contextual analysis",
            fallback_options=["Escalate to human for decision"]
        )
    
    def _assess_risks(self, steps: List[ExecutionStep]) -> str:
        """Assess overall risk level of the execution plan"""
        
        low_confidence_steps = [s for s in steps if s.confidence == ConfidenceLevel.LOW]
        medium_confidence_steps = [s for s in steps if s.confidence == ConfidenceLevel.MEDIUM]
        
        if len(low_confidence_steps) > 3:
            return "HIGH_RISK: Multiple low-confidence steps detected"
        elif len(medium_confidence_steps) > 5:
            return "MEDIUM_RISK: Several medium-confidence steps require monitoring"
        else:
            return "LOW_RISK: Most steps have high confidence"
    
    def _identify_human_checkpoints(self, steps: List[ExecutionStep]) -> List[int]:
        """Identify which steps should require human approval"""
        
        checkpoints = []
        
        for i, step in enumerate(steps):
            # Require human approval for low confidence steps
            if step.confidence == ConfidenceLevel.LOW:
                checkpoints.append(i)
                
            # Require approval for decision points
            if step.type == TaskType.DECISION:
                checkpoints.append(i)
                
            # Require approval for data modification steps
            if step.type == TaskType.TYPE and 'update' in step.description.lower():
                checkpoints.append(i)
        
        return checkpoints
    
    def _estimate_duration(self, steps: List[ExecutionStep]) -> int:
        """Estimate execution duration in seconds"""
        
        duration_map = {
            TaskType.NAVIGATE: 3,
            TaskType.CLICK: 2,
            TaskType.TYPE: 5,
            TaskType.READ: 3,
            TaskType.WAIT: 2,
            TaskType.DECISION: 10,  # Includes analysis time
            TaskType.LOOP: 30  # Base loop overhead
        }
        
        total = sum(duration_map.get(step.type, 5) for step in steps)
        return total
    
    async def execute_plan(self, plan: ExecutionPlan) -> Dict:
        """
        Execute the generated plan (placeholder for now)
        """
        logger.info(f"Starting execution of plan with {len(plan.steps)} steps")
        
        results = {
            'plan_id': plan.workflow_id,
            'status': 'simulated',
            'steps_completed': 0,
            'steps_total': len(plan.steps),
            'execution_log': []
        }
        
        # For now, just simulate execution
        for i, step in enumerate(plan.steps):
            logger.info(f"Simulating step {i+1}: {step.description}")
            
            # Check if human approval needed
            if i in plan.human_checkpoints:
                logger.info(f"Step {i+1} requires human approval")
                results['execution_log'].append({
                    'step': i+1,
                    'action': 'human_approval_required',
                    'description': step.description,
                    'confidence': step.confidence.value
                })
                # In real implementation, would pause here for human input
            
            results['execution_log'].append({
                'step': i+1,
                'action': 'simulated',
                'description': step.description,
                'confidence': step.confidence.value,
                'reasoning': step.reasoning
            })
            
            results['steps_completed'] = i + 1
            
            # Simulate some execution time
            await asyncio.sleep(0.1)
        
        results['status'] = 'completed'
        logger.info("Plan execution completed")
        
        return results

# Example usage function
async def main():
    """Example of how to use the orchestrator"""
    
    # This would come from your Supabase data
    sample_sop = {
        "meta": {
            "id": "test-workflow",
            "title": "Daily Investor Email Review",
            "goal": "Update Airtable CRM with investor communications"
        },
        "public": {
            "nodes": [
                {
                    "id": "T0_open_gmail",
                    "type": "task",
                    "label": "Open Gmail",
                    "intent": "Access daily email inbox"
                },
                {
                    "id": "L1_process_emails",
                    "type": "loop",
                    "label": "Process Investor Emails",
                    "intent": "Iterate through relevant investor emails"
                }
            ]
        }
    }
    
    sample_transcript = [
        {
            "action_type_observed": "SWITCH_TAB",
            "application_in_focus": "Gmail - Inbox",
            "timestamp_start_visual": "00:00:07.864"
        }
    ]
    
    orchestrator = OrchestratorAgent()
    plan = await orchestrator.analyze_workflow(sample_sop, sample_transcript)
    
    print(f"Generated plan with {len(plan.steps)} steps")
    print(f"Risk assessment: {plan.risk_assessment}")
    print(f"Human checkpoints: {plan.human_checkpoints}")
    
    # Execute the plan
    results = await orchestrator.execute_plan(plan)
    print(f"Execution completed: {results['status']}")

if __name__ == "__main__":
    asyncio.run(main()) 