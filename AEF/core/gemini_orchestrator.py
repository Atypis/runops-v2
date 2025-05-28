"""
AEF Gemini-Powered Orchestrator Agent

This is the central AI intelligence that analyzes SOPs + raw transcripts and creates
dynamic execution plans using Google Gemini 2.5 Flash Preview 05-20 for intelligent workflow understanding.
"""

import json
import asyncio
import os
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from dotenv import load_dotenv
import google.generativeai as genai

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

class GeminiOrchestrator:
    """
    AI-powered orchestrator using Google Gemini 2.5 Flash Preview 05-20 for intelligent workflow analysis
    """
    
    def __init__(self):
        # Configure Gemini
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable required")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash-preview-05-20')
        
        # Configuration for workflow analysis
        self.temperature = 1.0      # Higher temperature for creative synthesis of complex workflow data
        self.max_tokens = 4000      # Enough tokens for comprehensive execution plans
        
    async def analyze_workflow(self, sop_data: Dict, transcript_data: Any, job_id: str) -> ExecutionPlan:
        """
        Use Gemini 2.5 Flash Preview 05-20 to analyze workflow and generate intelligent execution plan
        """
        try:
            logger.info(f"🤖 Gemini analyzing workflow: {job_id}")
            
            # Pre-process and simplify the transcript data
            simplified_transcript = self._preprocess_transcript(transcript_data)
            logger.info(f"📝 Simplified transcript from {len(str(transcript_data))} to {len(str(simplified_transcript))} chars")
            
            # Prepare the analysis prompt with simplified data
            analysis_prompt = self._create_analysis_prompt(sop_data, simplified_transcript, job_id)
            
            # Call Gemini 2.5 Flash Preview 05-20
            response = await self._call_gemini(analysis_prompt)
            
            # Parse the AI response into execution plan
            execution_plan = self._parse_ai_response(response, job_id)
            
            logger.info(f"✅ Gemini generated execution plan with {len(execution_plan.steps)} steps")
            return execution_plan
            
        except Exception as e:
            logger.error(f"❌ Critical error in analyze_workflow: {e}")
            logger.error(f"❌ Error type: {type(e).__name__}")
            # Return fallback plan for any error
            return self._create_fallback_plan(job_id)
    
    def _preprocess_transcript(self, transcript_data: Any) -> Dict:
        """
        Simplify and abstract the raw transcript to avoid safety filters and reduce complexity
        """
        try:
            # Convert to list if it's a string
            if isinstance(transcript_data, str):
                # Try to parse as JSON first
                try:
                    import json
                    transcript_data = json.loads(transcript_data)
                except:
                    # If not JSON, treat as simple text description
                    return {
                        "workflow_type": "text_description",
                        "summary": "User described a workflow process",
                        "action_count": 1,
                        "patterns": ["manual_process"]
                    }
            
            # Handle list of action objects
            if isinstance(transcript_data, list):
                return self._abstract_action_sequence(transcript_data)
            
            # Handle dict/object
            if isinstance(transcript_data, dict):
                if 'actions' in transcript_data:
                    return self._abstract_action_sequence(transcript_data['actions'])
                else:
                    return self._abstract_single_action(transcript_data)
            
            # Fallback for unknown format
            return {
                "workflow_type": "unknown_format",
                "summary": "Workflow data provided in unknown format",
                "action_count": 1,
                "patterns": ["manual_review_needed"]
            }
            
        except Exception as e:
            logger.warning(f"Transcript preprocessing failed: {e}")
            return {
                "workflow_type": "preprocessing_failed",
                "summary": "Could not process transcript data",
                "action_count": 1,
                "patterns": ["manual_review_needed"]
            }
    
    def _abstract_action_sequence(self, actions: list) -> Dict:
        """
        Convert a sequence of actions into abstract patterns
        """
        if not actions:
            return {
                "workflow_type": "empty_sequence",
                "summary": "No actions recorded",
                "action_count": 0,
                "patterns": []
            }
        
        # Abstract the actions
        patterns = []
        action_types = []
        app_switches = 0
        data_operations = 0
        
        for action in actions:
            action_type = self._get_action_type(action)
            action_types.append(action_type)
            
            # Detect patterns
            if action_type == "navigate":
                if "app_switch" not in patterns:
                    patterns.append("app_switch")
                app_switches += 1
            elif action_type in ["type", "input"]:
                if "data_entry" not in patterns:
                    patterns.append("data_entry")
                data_operations += 1
            elif action_type == "click":
                if "ui_interaction" not in patterns:
                    patterns.append("ui_interaction")
            elif action_type == "read":
                if "data_extraction" not in patterns:
                    patterns.append("data_extraction")
                data_operations += 1
        
        # Detect workflow patterns
        if app_switches > 1:
            patterns.append("multi_app_workflow")
        if data_operations > 2:
            patterns.append("data_intensive")
        if len(set(action_types)) > 3:
            patterns.append("complex_workflow")
        
        return {
            "workflow_type": "action_sequence",
            "summary": f"Workflow with {len(actions)} actions across {app_switches + 1} applications",
            "action_count": len(actions),
            "action_types": list(set(action_types)),
            "patterns": patterns,
            "complexity": "high" if len(actions) > 10 else "medium" if len(actions) > 5 else "low"
        }
    
    def _get_action_type(self, action: Any) -> str:
        """
        Extract the action type from an action object
        """
        if isinstance(action, dict):
            # Try common field names
            for field in ['action', 'action_type', 'type', 'event_type']:
                if field in action:
                    action_value = str(action[field]).lower()
                    # Map to standard types
                    if 'nav' in action_value or 'url' in action_value or 'goto' in action_value:
                        return "navigate"
                    elif 'click' in action_value or 'press' in action_value:
                        return "click"
                    elif 'type' in action_value or 'input' in action_value or 'enter' in action_value:
                        return "type"
                    elif 'read' in action_value or 'extract' in action_value or 'get' in action_value:
                        return "read"
                    elif 'wait' in action_value or 'pause' in action_value:
                        return "wait"
                    else:
                        return "unknown"
            
            # Infer from target or details
            target = str(action.get('target', '')).lower()
            details = str(action.get('details', '')).lower()
            
            if any(word in target + details for word in ['url', 'website', 'page', 'tab']):
                return "navigate"
            elif any(word in target + details for word in ['button', 'link', 'menu']):
                return "click"
            elif any(word in target + details for word in ['field', 'input', 'form', 'text']):
                return "type"
            elif any(word in target + details for word in ['read', 'extract', 'content']):
                return "read"
        
        return "unknown"
    
    def _abstract_single_action(self, action: dict) -> Dict:
        """
        Abstract a single action object
        """
        action_type = self._get_action_type(action)
        
        return {
            "workflow_type": "single_action",
            "summary": f"Single {action_type} action",
            "action_count": 1,
            "action_types": [action_type],
            "patterns": ["simple_action"],
            "complexity": "low"
        }
    
    def _create_analysis_prompt(self, sop_data: Dict, transcript_data: Any, job_id: str) -> str:
        """
        Create a comprehensive system prompt for Gemini to analyze the workflow
        """
        
        return f"""You are an expert AI workflow synthesizer specializing in converting complex, time-stamped execution transcripts into intelligent automation plans. Your superpower is understanding the temporal flow of user actions and synthesizing them into coherent, executable workflows.

## MISSION
Transform messy, real-world execution data into clean, automated workflows. You excel at:
- **Temporal Analysis**: Understanding action sequences and timing patterns
- **Intent Recognition**: Inferring user goals from fragmented actions  
- **Workflow Synthesis**: Creating logical execution flows from chaotic data
- **Smart Abstraction**: Converting specific actions into reusable patterns

## INPUT ANALYSIS

### SOP Metadata:
```json
{json.dumps(sop_data, indent=2)}
```

### Raw Execution Transcript:
The transcript contains timestamped actions, clicks, navigation events, and user interactions. This is REAL data from actual workflow execution - synthesize it intelligently:

```json
{json.dumps(transcript_data, indent=2)}
```

### Target Workflow ID: {job_id}

## SYNTHESIS CHALLENGE
Your job is to look at this temporal sequence of actions and understand:
1. **What was the user trying to accomplish?** (the real goal)
2. **What was the logical flow?** (despite any backtracking or errors)
3. **What patterns emerge?** (repetitive actions, decision points)
4. **How can this be automated?** (reliable, repeatable steps)

## JSON OUTPUT REQUIREMENT
⚠️ **CRITICAL**: You MUST respond with ONLY valid JSON. No markdown, no explanations, no extra text. Just pure JSON that starts with {{ and ends with }}.

Your response format:

{{
  "workflow_id": "{job_id}",
  "title": "Descriptive workflow title based on observed actions",
  "description": "What this workflow accomplishes based on the transcript analysis",
  "steps": [
    {{
      "id": "step_1",
      "name": "Action name",
      "description": "What this step does and why",
      "action_type": "navigate|click|type|read|wait|decision|loop",
      "confidence": "HIGH|MEDIUM|LOW",
      "requires_approval": true,
      "reasoning": "Why this step is needed based on transcript evidence",
      "fallback_options": ["Backup approach 1", "Backup approach 2"],
      "estimated_duration": 15,
      "risk_level": "low|medium|high"
    }}
  ],
  "human_checkpoints": ["step_id_requiring_approval"],
  "estimated_duration": 120,
  "risk_assessment": {{
    "overall_risk": "low|medium|high",
    "risk_factors": ["Identified risk 1", "Identified risk 2"],
    "mitigation_strategies": ["How to handle risk 1", "How to handle risk 2"]
  }}
}}

## SYNTHESIS GUIDELINES

### Temporal Pattern Recognition:
- **Identify the main workflow spine**: What's the core sequence?
- **Filter out noise**: Ignore accidental clicks, corrections, backtracking
- **Recognize loops**: Spot repetitive patterns in the transcript
- **Understand context switches**: When user moves between applications/tabs
- **Infer wait times**: From timestamps, understand natural pauses

### Smart Step Creation:
- **Consolidate micro-actions**: Group related clicks/types into logical steps
- **Preserve decision points**: Where user had to think or choose
- **Abstract specific data**: Turn "clicked on John Smith" into "select contact"
- **Handle errors gracefully**: Plan for common failure modes observed
- **Optimize flow**: Remove unnecessary steps while preserving intent

### Confidence Assessment:
- **HIGH**: Clear, repeated patterns in transcript
- **MEDIUM**: Logical but not explicitly demonstrated actions  
- **LOW**: Inferred steps that might need human verification

### Risk & Approval Logic:
- **Require approval for**: Data changes, external communications, financial actions
- **Low risk**: Reading, navigation, information gathering
- **High risk**: Irreversible actions, bulk operations, sensitive data

### Action Type Mapping:
- **navigate**: URL changes, tab switches, app launches
- **click**: Button presses, link clicks, menu selections  
- **type**: Text input, form filling, search queries
- **read**: Information extraction, verification steps
- **wait**: Deliberate pauses for loading or processing
- **decision**: Conditional logic based on observed branching
- **loop**: Repetitive patterns identified in transcript

## CREATIVE SYNTHESIS INSTRUCTIONS
Use your creativity to:
1. **Fill logical gaps**: If user went from A to C, infer step B
2. **Optimize the flow**: Remove redundant actions while preserving intent
3. **Add safety nets**: Include verification steps for critical actions
4. **Handle edge cases**: Plan for scenarios that might not be in transcript
5. **Make it reusable**: Abstract specific details into parameterizable actions

Remember: You're not just transcribing actions - you're creating an intelligent automation that understands the WHY behind the WHAT.

RESPOND WITH ONLY THE JSON OBJECT - NO OTHER TEXT."""

    async def _call_gemini(self, prompt: str) -> str:
        """
        Call Gemini 2.5 Flash Preview 05-20 with the analysis prompt
        """
        try:
            # Configure safety settings to disable blocking
            safety_settings = [
                {
                    "category": "HARM_CATEGORY_HARASSMENT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_HATE_SPEECH", 
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                    "threshold": "BLOCK_NONE"
                },
                {
                    "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                    "threshold": "BLOCK_NONE"
                }
            ]
            
            # Call Gemini with safety settings
            response = await asyncio.to_thread(
                self.model.generate_content,
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=self.temperature,
                    max_output_tokens=self.max_tokens,
                ),
                safety_settings=safety_settings
            )
            
            logger.info(f"✅ Gemini 2.5 Flash Preview 05-20 response received")
            logger.info(f"🔍 Raw Gemini response (first 1000 chars): {response.text[:1000]}")
            return response.text
            
        except Exception as e:
            logger.error(f"❌ Gemini API call failed: {e}")
            raise Exception(f"Gemini API call failed: {str(e)}")
    
    def _parse_ai_response(self, response: str, job_id: str) -> ExecutionPlan:
        """
        Parse Gemini's JSON response into ExecutionPlan object with robust error handling and auto-repair
        """
        try:
            logger.info(f"🔍 Full Gemini response length: {len(response)} chars")
            
            # Clean the response - remove any markdown formatting
            cleaned_response = response.strip()
            
            # Remove markdown code blocks if present
            if cleaned_response.startswith('```'):
                lines = cleaned_response.split('\n')
                # Find first line that starts with {
                start_line = 0
                for i, line in enumerate(lines):
                    if line.strip().startswith('{'):
                        start_line = i
                        break
                
                # Find last line that ends with }
                end_line = len(lines) - 1
                for i in range(len(lines) - 1, -1, -1):
                    if lines[i].strip().endswith('}'):
                        end_line = i
                        break
                
                cleaned_response = '\n'.join(lines[start_line:end_line + 1])
            
            # Extract JSON from response (find the main JSON object)
            start_idx = cleaned_response.find('{')
            end_idx = cleaned_response.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                raise ValueError("No JSON object found in response")
            
            json_str = cleaned_response[start_idx:end_idx]
            
            logger.info(f"🧹 Extracted JSON length: {len(json_str)} chars")
            
            # Try multiple parsing strategies
            data = self._parse_json_with_fallbacks(json_str)
            
            # Validate required fields
            required_fields = ['workflow_id', 'title', 'description', 'steps']
            for field in required_fields:
                if field not in data:
                    logger.warning(f"Missing required field: {field}, using default")
                    if field == 'workflow_id':
                        data[field] = job_id
                    elif field == 'title':
                        data[field] = 'Generated Workflow'
                    elif field == 'description':
                        data[field] = 'Workflow generated from transcript analysis'
                    elif field == 'steps':
                        data[field] = []
            
            # Ensure optional fields exist
            data.setdefault('human_checkpoints', [])
            data.setdefault('estimated_duration', 300)
            data.setdefault('risk_assessment', {
                'overall_risk': 'medium',
                'risk_factors': ['Unknown workflow'],
                'mitigation_strategies': ['Manual review required']
            })
            
            # Convert steps to ExecutionStep objects
            steps = []
            for i, step_data in enumerate(data['steps']):
                try:
                    step = ExecutionStep(
                        id=step_data.get('id', f'step_{i+1}'),
                        name=step_data.get('name', f'Step {i+1}'),
                        description=step_data.get('description', ''),
                        action_type=step_data.get('action_type', 'click'),
                        confidence=step_data.get('confidence', 'MEDIUM'),
                        requires_approval=step_data.get('requires_approval', False),
                        reasoning=step_data.get('reasoning', ''),
                        fallback_options=step_data.get('fallback_options', []),
                        estimated_duration=step_data.get('estimated_duration', 30),
                        risk_level=step_data.get('risk_level', 'medium')
                    )
                    steps.append(step)
                except Exception as e:
                    logger.warning(f"Error parsing step {i}: {e}")
                    continue
            
            return ExecutionPlan(
                workflow_id=data.get('workflow_id', job_id),
                title=data.get('title', 'Generated Workflow'),
                description=data.get('description', 'Workflow generated from transcript analysis'),
                steps=steps,
                human_checkpoints=data.get('human_checkpoints', []),
                estimated_duration=data.get('estimated_duration', 300),
                risk_assessment=data.get('risk_assessment', {
                    'overall_risk': 'medium',
                    'risk_factors': ['Unknown workflow'],
                    'mitigation_strategies': ['Manual review required']
                })
            )
            
        except Exception as e:
            logger.error(f"❌ Response parsing failed: {e}")
            # Return a fallback execution plan
            return self._create_fallback_plan(job_id)
    
    def _parse_json_with_fallbacks(self, json_str: str) -> dict:
        """
        Try multiple strategies to parse potentially malformed JSON - NEVER raises exceptions
        """
        # Strategy 1: Direct parsing
        try:
            return json.loads(json_str)
        except json.JSONDecodeError as e:
            logger.warning(f"Direct JSON parsing failed: {e}")
        
        # Strategy 2: Clean whitespace and try again
        try:
            cleaned = json_str.replace('\n', ' ').replace('\t', ' ')
            cleaned = ' '.join(cleaned.split())
            return json.loads(cleaned)
        except json.JSONDecodeError as e:
            logger.warning(f"Cleaned JSON parsing failed: {e}")
        
        # Strategy 3: Fix common JSON issues
        try:
            fixed_json = self._fix_common_json_issues(json_str)
            return json.loads(fixed_json)
        except json.JSONDecodeError as e:
            logger.warning(f"Fixed JSON parsing failed: {e}")
        
        # Strategy 4: Extract partial JSON
        try:
            partial_json = self._extract_partial_json(json_str)
            return json.loads(partial_json)
        except json.JSONDecodeError as e:
            logger.warning(f"Partial JSON parsing failed: {e}")
        
        # Strategy 5: Ultimate fallback - return minimal valid structure
        logger.error(f"All JSON parsing strategies failed. Using ultimate fallback.")
        logger.error(f"Problematic JSON (first 1000 chars): {json_str[:1000]}...")
        
        return {
            "workflow_id": "fallback",
            "title": "JSON Parsing Failed - Manual Review Required",
            "description": "The AI response could not be parsed. Manual intervention required.",
            "steps": [
                {
                    "id": "manual_review_step",
                    "name": "Manual Review Required",
                    "description": "AI response parsing failed. Please review the workflow manually.",
                    "action_type": "decision",
                    "confidence": "LOW",
                    "requires_approval": True,
                    "reasoning": "JSON parsing failed for AI response",
                    "fallback_options": ["Manual workflow creation", "Retry with different prompt"],
                    "estimated_duration": 300,
                    "risk_level": "high"
                }
            ],
            "human_checkpoints": ["manual_review_step"],
            "estimated_duration": 300,
            "risk_assessment": {
                "overall_risk": "high",
                "risk_factors": ["AI response parsing failed"],
                "mitigation_strategies": ["Manual review required"]
            }
        }
    
    def _fix_common_json_issues(self, json_str: str) -> str:
        """
        Fix common JSON syntax issues
        """
        # Remove trailing commas
        import re
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        # Fix unescaped quotes in strings
        json_str = re.sub(r'(?<!\\)"(?=.*")', r'\\"', json_str)
        
        # Ensure proper string quoting
        json_str = re.sub(r':\s*([^",\[\]{}]+)(?=\s*[,}])', r': "\1"', json_str)
        
        return json_str
    
    def _extract_partial_json(self, json_str: str) -> str:
        """
        Extract a valid JSON subset if the full JSON is malformed
        """
        # Find the first complete object
        brace_count = 0
        for i, char in enumerate(json_str):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    return json_str[:i+1]
        
        # If no complete object found, return minimal valid JSON
        return '{"workflow_id": "fallback", "title": "Fallback", "description": "Fallback workflow", "steps": []}'
    
    def _create_fallback_plan(self, job_id: str) -> ExecutionPlan:
        """
        Create a basic fallback execution plan when parsing fails
        """
        logger.warning(f"Creating fallback execution plan for job: {job_id}")
        
        fallback_step = ExecutionStep(
            id="fallback_step_1",
            name="Manual Review Required",
            description="Automatic workflow generation failed. Manual review and planning required.",
            action_type="decision",
            confidence="LOW",
            requires_approval=True,
            reasoning="AI analysis failed to generate a valid execution plan",
            fallback_options=["Manual workflow creation", "Retry with simplified data"],
            estimated_duration=300,
            risk_level="high"
        )
        
        return ExecutionPlan(
            workflow_id=job_id,
            title="Fallback Workflow - Manual Review Required",
            description="Automatic workflow generation encountered errors. Manual intervention required.",
            steps=[fallback_step],
            human_checkpoints=["fallback_step_1"],
            estimated_duration=300,
            risk_assessment={
                "overall_risk": "high",
                "risk_factors": ["AI analysis failed", "Unknown workflow complexity"],
                "mitigation_strategies": ["Manual review required", "Simplify input data", "Contact support"]
            }
        )

# Example usage
async def main():
    """Test the Gemini orchestrator"""
    orchestrator = GeminiOrchestrator()
    
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