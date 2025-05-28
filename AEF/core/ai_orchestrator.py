"""
AEF AI-Powered Orchestrator Agent

This is the central AI intelligence that analyzes SOPs + raw transcripts and creates
dynamic execution plans using Claude Sonnet 4 for intelligent workflow understanding.
"""

import json
import asyncio
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from dotenv import load_dotenv
import anthropic

# Load environment variables
load_dotenv()

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
    HIGH = "HIGH"      # 90%+ confidence
    MEDIUM = "MEDIUM"  # 70-89% confidence  
    LOW = "LOW"        # <70% confidence

class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

@dataclass
class ExecutionStep:
    """Represents a single step in the execution plan"""
    id: str
    name: str
    description: str
    action_type: str
    confidence: str
    requires_approval: bool
    reasoning: str
    fallback_options: List[str]
    estimated_duration: int
    risk_level: str

@dataclass
class ExecutionPlan:
    """Complete execution plan for a workflow"""
    workflow_id: str
    title: str
    description: str
    steps: List[ExecutionStep]
    human_checkpoints: List[str]
    estimated_duration: int
    risk_assessment: Dict[str, Any]

class AIOrchestrator:
    """
    AI-powered orchestrator using Claude Sonnet 4 for intelligent workflow analysis
    """
    
    def __init__(self):
        self.client = anthropic.Anthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )
        self.model = "claude-3-5-sonnet-20241022"
        
    async def analyze_workflow(self, sop_data: Dict, transcript_data: str, job_id: str) -> ExecutionPlan:
        """
        Use Claude Sonnet 4 to analyze workflow and generate intelligent execution plan
        """
        logger.info(f"AI analyzing workflow: {job_id}")
        
        # Prepare the analysis prompt
        analysis_prompt = self._create_analysis_prompt(sop_data, transcript_data, job_id)
        
        try:
            # Call Claude Sonnet 4
            response = await self._call_claude(analysis_prompt)
            
            # Parse the AI response into execution plan
            execution_plan = self._parse_ai_response(response, job_id)
            
            logger.info(f"AI generated execution plan with {len(execution_plan.steps)} steps")
            return execution_plan
            
        except Exception as e:
            logger.error(f"AI analysis failed: {e}")
            # Fallback to basic plan
            return self._create_fallback_plan(sop_data, job_id)
    
    def _create_analysis_prompt(self, sop_data: Dict, transcript_data: str, job_id: str) -> str:
        """
        Create a comprehensive system prompt for Claude to analyze the workflow
        """
        
        return f"""You are an expert AI agent specializing in workflow automation and browser-based task execution. Your role is to analyze Standard Operating Procedures (SOPs) and raw execution transcripts to create intelligent, executable automation plans.

## CONTEXT
You are analyzing a real workflow that was previously recorded and converted into an SOP. You have access to:
1. **SOP Data**: Structured workflow information
2. **Raw Transcript**: Detailed execution log with timestamps and actions

## YOUR TASK
Create a comprehensive execution plan that can be automated using browser agents with human oversight. The plan should be:
- **Intelligent**: Understand the workflow's purpose and context
- **Robust**: Include confidence levels and fallback options
- **Safe**: Identify risks and require human approval where needed
- **Executable**: Generate specific, actionable steps

## INPUT DATA

### SOP Data:
```json
{json.dumps(sop_data, indent=2)}
```

### Raw Transcript:
```
{transcript_data}
```

### Workflow ID: {job_id}

## OUTPUT FORMAT
Respond with a JSON object in this exact format:

```json
{{
  "workflow_id": "{job_id}",
  "title": "Clear, descriptive workflow title",
  "description": "Comprehensive description of what this workflow accomplishes",
  "steps": [
    {{
      "id": "step_1",
      "name": "Short step name",
      "description": "Detailed description of what this step does",
      "action_type": "navigate|click|type|read|wait|decision|loop",
      "confidence": "HIGH|MEDIUM|LOW",
      "requires_approval": true/false,
      "reasoning": "Why this step is necessary and how confident you are",
      "fallback_options": ["Alternative approach 1", "Alternative approach 2"],
      "estimated_duration": 30,
      "risk_level": "low|medium|high"
    }}
  ],
  "human_checkpoints": ["step_id1", "step_id2"],
  "estimated_duration": 180,
  "risk_assessment": {{
    "overall_risk": "low|medium|high",
    "risk_factors": ["Factor 1", "Factor 2"],
    "mitigation_strategies": ["Strategy 1", "Strategy 2"]
  }}
}}
```

## ANALYSIS GUIDELINES

### Step Generation:
1. **Start with navigation**: Open required applications/websites
2. **Break down complex actions**: Each step should be atomic and specific
3. **Include verification steps**: Add steps to confirm actions succeeded
4. **Handle loops intelligently**: For repetitive tasks, create loop structures
5. **End with validation**: Ensure the workflow goal was achieved

### Confidence Levels:
- **HIGH (90%+)**: Standard web navigation, simple clicks, predictable elements
- **MEDIUM (70-89%)**: Form filling, element identification, conditional logic
- **LOW (<70%)**: Complex decisions, dynamic content, error-prone actions

### Human Approval Required For:
- Data modification or deletion
- Financial transactions
- Sending emails/messages
- Low confidence steps
- Decision points with business impact
- Steps that could cause data loss

### Risk Assessment:
- **LOW**: Read-only operations, standard navigation
- **MEDIUM**: Data entry, form submission, routine updates
- **HIGH**: Irreversible actions, financial operations, bulk changes

### Action Types:
- **navigate**: Go to URL, switch tabs/windows
- **click**: Click buttons, links, menu items
- **type**: Enter text in fields, forms
- **read**: Extract information, verify content
- **wait**: Pause for loading, delays
- **decision**: Conditional logic, branching
- **loop**: Repetitive operations

## CRITICAL REQUIREMENTS
1. **Be specific**: Each step should be actionable by a browser automation agent
2. **Consider context**: Understand the business purpose and user intent
3. **Plan for failure**: Include fallback options for each step
4. **Prioritize safety**: When in doubt, require human approval
5. **Optimize efficiency**: Minimize unnecessary steps while maintaining reliability

Analyze the provided workflow data and generate an intelligent execution plan that balances automation efficiency with human oversight and safety."""

    async def _call_claude(self, prompt: str) -> str:
        """
        Call Claude Sonnet 4 with the analysis prompt
        """
        try:
            message = await asyncio.to_thread(
                self.client.messages.create,
                model=self.model,
                max_tokens=4000,
                temperature=0.1,  # Low temperature for consistent, logical output
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            )
            
            return message.content[0].text
            
        except Exception as e:
            logger.error(f"Claude API call failed: {e}")
            raise
    
    def _parse_ai_response(self, response: str, job_id: str) -> ExecutionPlan:
        """
        Parse Claude's JSON response into ExecutionPlan object
        """
        try:
            # Extract JSON from response (in case there's extra text)
            start_idx = response.find('{')
            end_idx = response.rfind('}') + 1
            json_str = response[start_idx:end_idx]
            
            data = json.loads(json_str)
            
            # Convert steps to ExecutionStep objects
            steps = []
            for step_data in data['steps']:
                step = ExecutionStep(
                    id=step_data['id'],
                    name=step_data['name'],
                    description=step_data['description'],
                    action_type=step_data['action_type'],
                    confidence=step_data['confidence'],
                    requires_approval=step_data['requires_approval'],
                    reasoning=step_data['reasoning'],
                    fallback_options=step_data['fallback_options'],
                    estimated_duration=step_data['estimated_duration'],
                    risk_level=step_data['risk_level']
                )
                steps.append(step)
            
            return ExecutionPlan(
                workflow_id=data['workflow_id'],
                title=data['title'],
                description=data['description'],
                steps=steps,
                human_checkpoints=data['human_checkpoints'],
                estimated_duration=data['estimated_duration'],
                risk_assessment=data['risk_assessment']
            )
            
        except Exception as e:
            logger.error(f"Failed to parse AI response: {e}")
            logger.error(f"Response was: {response}")
            raise
    
    def _create_fallback_plan(self, sop_data: Dict, job_id: str) -> ExecutionPlan:
        """
        Create a basic fallback plan if AI analysis fails
        """
        title = sop_data.get('meta', {}).get('title', f'Workflow {job_id[:8]}')
        
        fallback_steps = [
            ExecutionStep(
                id="step_1",
                name="Manual Review Required",
                description="AI analysis failed - manual review and execution required",
                action_type="decision",
                confidence="LOW",
                requires_approval=True,
                reasoning="Fallback plan due to AI analysis failure",
                fallback_options=["Manual execution", "Retry AI analysis"],
                estimated_duration=300,
                risk_level="high"
            )
        ]
        
        return ExecutionPlan(
            workflow_id=job_id,
            title=f"[FALLBACK] {title}",
            description="Fallback plan - requires manual review",
            steps=fallback_steps,
            human_checkpoints=["step_1"],
            estimated_duration=300,
            risk_assessment={
                "overall_risk": "high",
                "risk_factors": ["AI analysis failed"],
                "mitigation_strategies": ["Manual review required"]
            }
        )

# Example usage
async def main():
    """Test the AI orchestrator"""
    orchestrator = AIOrchestrator()
    
    # Sample data (replace with real data)
    sample_sop = {
        "meta": {
            "title": "Process Investor Emails",
            "goal": "Review Gmail inbox and update Airtable CRM"
        },
        "public": {
            "nodes": [],
            "variables": {}
        }
    }
    
    sample_transcript = "User opened Gmail, clicked on inbox, read email from investor, switched to Airtable, updated contact record"
    
    try:
        plan = await orchestrator.analyze_workflow(sample_sop, sample_transcript, "test_job_123")
        print("Generated execution plan:")
        print(json.dumps(asdict(plan), indent=2, default=str))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 