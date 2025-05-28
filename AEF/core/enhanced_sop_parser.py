"""
Enhanced SOP Parser with Automation Annotations

This module extends the existing SOP parsing capabilities to include automation-specific
annotations and confidence levels for each workflow step.
"""

import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class AutomationFeasibility(Enum):
    """Automation feasibility levels for workflow steps"""
    HIGH = "high"           # Fully automatable with high confidence
    MEDIUM = "medium"       # Automatable with some uncertainty
    LOW = "low"            # Requires human judgment or complex reasoning
    MANUAL = "manual"      # Must be done by human (2FA, captcha, etc.)


class ActionType(Enum):
    """Standardized action types for browser automation"""
    NAVIGATE = "navigate"
    CLICK = "click"
    TYPE = "type"
    READ = "read"
    WAIT = "wait"
    EXTRACT = "extract"
    VALIDATE = "validate"
    DECISION = "decision"
    AUTHENTICATION = "authentication"


@dataclass
class AutomationAnnotation:
    """Automation metadata for a workflow step"""
    feasibility: AutomationFeasibility
    action_type: ActionType
    confidence_level: float  # 0.0 to 1.0
    uncertainty_factors: List[str]
    fallback_strategies: List[str]
    validation_criteria: List[str]
    estimated_duration: Optional[int] = None  # seconds
    requires_human_input: bool = False
    dependencies: List[str] = None  # Other steps this depends on


@dataclass
class EnhancedSOPStep:
    """SOP step with automation annotations"""
    original_step: Dict[str, Any]
    automation: AutomationAnnotation
    browser_actions: List[Dict[str, Any]]  # Specific browser-use actions
    success_indicators: List[str]
    failure_indicators: List[str]


class EnhancedSOPParser:
    """Enhanced SOP parser that adds automation annotations"""
    
    def __init__(self, gemini_model):
        self.gemini_model = gemini_model
        self.system_prompt = self._build_system_prompt()
    
    def _build_system_prompt(self) -> str:
        """Build the enhanced system prompt for SOP parsing with automation annotations"""
        return """You are an expert SOP (Standard Operating Procedure) parser and automation analyst. Your task is to:

1. Parse raw transcript data into structured workflow steps (using existing SOP parsing logic)
2. Add automation annotations for each step including feasibility, confidence, and browser actions

## Core SOP Parsing (Phase 1)
Use the sophisticated SOP parsing logic to identify:
- Workflow boundaries and natural breakpoints
- Core action sequences vs exploratory navigation
- Data flow patterns and dependencies
- Decision points and conditional logic
- Setup/teardown phases

## Automation Analysis (Phase 2)
For each parsed SOP step, analyze:

### Automation Feasibility Assessment
- **HIGH**: Standard web interactions (click, type, navigate, extract)
- **MEDIUM**: Complex interactions requiring validation or retry logic
- **LOW**: Requires human judgment, complex reasoning, or domain expertise
- **MANUAL**: Authentication, captcha, creative decisions, or safety-critical actions

### Action Type Classification
- **NAVIGATE**: URL navigation, tab switching, page transitions
- **CLICK**: Button clicks, link clicks, menu selections
- **TYPE**: Form filling, text input, data entry
- **READ**: Content extraction, data reading, status checking
- **WAIT**: Delays, loading waits, process completion waits
- **EXTRACT**: Data extraction, content scraping, information gathering
- **VALIDATE**: Verification steps, success checking, error detection
- **DECISION**: Conditional logic, branching, choice points
- **AUTHENTICATION**: Login, 2FA, credential entry

### Confidence & Uncertainty Analysis
- Confidence level (0.0-1.0) based on action complexity and predictability
- Uncertainty factors: dynamic content, timing issues, UI variations
- Fallback strategies for when primary approach fails
- Validation criteria to confirm step success

### Browser-Use Action Mapping
Map each SOP step to specific browser-use actions:
```json
{
  "action": "click_element",
  "params": {"index": "TBD"},
  "description": "Click the submit button",
  "selector_hints": ["submit", "button[type=submit]", ".submit-btn"]
}
```

## Output Format
Return a JSON object with this structure:

```json
{
  "workflow_metadata": {
    "title": "Workflow name",
    "total_steps": 10,
    "estimated_duration": 300,
    "automation_coverage": 0.85,
    "complexity_score": 0.6,
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
        "fallback_strategies": ["retry with different URL", "check for redirects"],
        "validation_criteria": ["page title contains 'Login'", "login form is visible"],
        "estimated_duration": 5,
        "requires_human_input": false,
        "dependencies": []
      },
      "browser_actions": [
        {
          "action": "go_to_url",
          "params": {"url": "https://portal.company.com/login"},
          "description": "Navigate to login page"
        }
      ],
      "success_indicators": [
        "Login form is visible",
        "Page title contains login-related text",
        "URL matches expected login page"
      ],
      "failure_indicators": [
        "404 error page",
        "Redirect to unexpected page",
        "Page load timeout"
      ]
    }
  ],
  "automation_summary": {
    "fully_automatable_steps": 8,
    "partially_automatable_steps": 1,
    "manual_steps": 1,
    "critical_dependencies": ["user credentials", "network access"],
    "risk_factors": ["dynamic content", "rate limiting"],
    "recommended_approach": "automated with human oversight"
  }
}
```

## Key Principles

1. **Conservative Confidence**: Better to underestimate automation feasibility than overestimate
2. **Robust Fallbacks**: Always provide alternative strategies for uncertain steps
3. **Clear Validation**: Define specific, measurable success criteria
4. **Human-in-Loop**: Identify where human intervention adds value
5. **Dependency Mapping**: Track inter-step dependencies for proper sequencing
6. **Error Anticipation**: Predict likely failure modes and recovery strategies

Focus on creating actionable automation plans that can be executed by browser-use agents with appropriate uncertainty handling and self-correction capabilities."""

    async def parse_transcript_with_automation(self, transcript_data: Any) -> Dict[str, Any]:
        """Parse transcript data and add automation annotations"""
        try:
            # Prepare the input for Gemini
            if isinstance(transcript_data, list):
                # Handle array format - convert to structured text
                transcript_text = self._convert_array_to_text(transcript_data)
            else:
                transcript_text = str(transcript_data)
            
            # Create the prompt
            prompt = f"""
{self.system_prompt}

## Raw Transcript Data to Parse:
{transcript_text}

Please analyze this transcript data and return the enhanced SOP with automation annotations as specified above.
"""
            
            # Call Gemini
            response = await self._call_gemini(prompt)
            
            # Parse and validate the response
            enhanced_sop = self._parse_and_validate_response(response)
            
            return enhanced_sop
            
        except Exception as e:
            logger.error(f"Error in enhanced SOP parsing: {str(e)}")
            # Return a fallback structure
            return self._create_fallback_sop(transcript_data)
    
    def _convert_array_to_text(self, transcript_array: List[Dict]) -> str:
        """Convert array transcript to readable text format"""
        text_parts = []
        
        for i, entry in enumerate(transcript_array):
            if isinstance(entry, dict):
                timestamp = entry.get('timestamp', f'Step {i+1}')
                action = entry.get('action', 'Unknown action')
                details = entry.get('details', '')
                
                text_parts.append(f"[{timestamp}] {action}")
                if details:
                    text_parts.append(f"  Details: {details}")
                text_parts.append("")
        
        return "\n".join(text_parts)
    
    async def _call_gemini(self, prompt: str) -> str:
        """Call Gemini with the enhanced prompt"""
        try:
            response = self.gemini_model.generate_content(prompt)
            
            # Check if response was blocked by safety filters
            if not response.parts:
                logger.warning("Response blocked by safety filters, using fallback")
                return ""
            
            return response.text
        except Exception as e:
            logger.error(f"Gemini API call failed: {str(e)}")
            # Return empty string to trigger fallback
            return ""
    
    def _parse_and_validate_response(self, response: str) -> Dict[str, Any]:
        """Parse and validate Gemini's response"""
        try:
            # Handle empty response (safety filter or API failure)
            if not response or response.strip() == "":
                logger.warning("Empty response from Gemini, using fallback")
                return self._create_minimal_fallback()
            
            # Clean the response first
            cleaned_response = self._clean_json_response(response)
            
            # Try to extract JSON from the response
            json_start = cleaned_response.find('{')
            json_end = cleaned_response.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = cleaned_response[json_start:json_end]
                
                # Try multiple JSON parsing strategies
                parsed = self._try_parse_json(json_str)
                
                if parsed and self._validate_enhanced_sop_structure(parsed):
                    return parsed
                else:
                    logger.warning("Invalid SOP structure, using fallback")
                    return self._create_minimal_fallback()
            else:
                logger.warning("No valid JSON found in response")
                return self._create_minimal_fallback()
                
        except Exception as e:
            logger.error(f"Response parsing failed: {str(e)}")
            return self._create_minimal_fallback()
    
    def _clean_json_response(self, response: str) -> str:
        """Clean the response to improve JSON parsing"""
        # Remove markdown code blocks
        response = response.replace('```json', '').replace('```', '')
        
        # Remove common prefixes/suffixes
        response = response.strip()
        
        return response
    
    def _try_parse_json(self, json_str: str) -> Optional[Dict[str, Any]]:
        """Try multiple strategies to parse JSON"""
        strategies = [
            lambda s: json.loads(s),  # Direct parsing
            lambda s: json.loads(s.replace('\n', ' ')),  # Remove newlines
            lambda s: json.loads(s.replace('\\', '\\\\')),  # Escape backslashes
            lambda s: self._fix_common_json_issues(s)  # Fix common issues
        ]
        
        for strategy in strategies:
            try:
                result = strategy(json_str)
                if isinstance(result, dict):
                    return result
            except (json.JSONDecodeError, Exception) as e:
                logger.debug(f"JSON parsing strategy failed: {str(e)}")
                continue
        
        return None
    
    def _fix_common_json_issues(self, json_str: str) -> Dict[str, Any]:
        """Fix common JSON formatting issues"""
        # Remove trailing commas
        import re
        json_str = re.sub(r',(\s*[}\]])', r'\1', json_str)
        
        # Fix unescaped quotes in strings
        # This is a simple fix - in production you'd want more sophisticated handling
        json_str = json_str.replace('"', '\\"').replace('\\"', '"', 1)
        
        return json.loads(json_str)
    
    def _validate_enhanced_sop_structure(self, sop: Dict[str, Any]) -> bool:
        """Validate the structure of the enhanced SOP"""
        required_fields = ['workflow_metadata', 'enhanced_steps', 'automation_summary']
        
        if not all(field in sop for field in required_fields):
            return False
        
        # Validate enhanced_steps structure
        if not isinstance(sop['enhanced_steps'], list):
            return False
        
        for step in sop['enhanced_steps']:
            required_step_fields = ['step_id', 'original_step', 'automation', 'browser_actions']
            if not all(field in step for field in required_step_fields):
                return False
        
        return True
    
    def _create_fallback_sop(self, transcript_data: Any) -> Dict[str, Any]:
        """Create a basic fallback SOP when parsing fails"""
        return {
            "workflow_metadata": {
                "title": "Parsed Workflow",
                "total_steps": 1,
                "estimated_duration": 60,
                "automation_coverage": 0.5,
                "complexity_score": 0.8,
                "requires_human_intervention": True
            },
            "enhanced_steps": [
                {
                    "step_id": "step_1",
                    "original_step": {
                        "action": "Execute workflow from transcript",
                        "details": "Complex workflow requiring human oversight",
                        "timestamp_range": "full_transcript"
                    },
                    "automation": {
                        "feasibility": "low",
                        "action_type": "decision",
                        "confidence_level": 0.3,
                        "uncertainty_factors": ["complex_workflow", "parsing_failed"],
                        "fallback_strategies": ["human_review", "manual_execution"],
                        "validation_criteria": ["human_confirmation"],
                        "estimated_duration": 60,
                        "requires_human_input": True,
                        "dependencies": []
                    },
                    "browser_actions": [
                        {
                            "action": "extract_content",
                            "params": {"goal": "analyze current page state"},
                            "description": "Analyze current state before proceeding"
                        }
                    ],
                    "success_indicators": ["human_approval"],
                    "failure_indicators": ["parsing_error", "invalid_transcript"]
                }
            ],
            "automation_summary": {
                "fully_automatable_steps": 0,
                "partially_automatable_steps": 0,
                "manual_steps": 1,
                "critical_dependencies": ["human_oversight"],
                "risk_factors": ["parsing_failure", "complex_workflow"],
                "recommended_approach": "manual_review_required"
            }
        }
    
    def _create_minimal_fallback(self) -> Dict[str, Any]:
        """Create minimal fallback when everything fails"""
        return {
            "workflow_metadata": {
                "title": "Failed Parse",
                "total_steps": 0,
                "estimated_duration": 0,
                "automation_coverage": 0.0,
                "complexity_score": 1.0,
                "requires_human_intervention": True
            },
            "enhanced_steps": [],
            "automation_summary": {
                "fully_automatable_steps": 0,
                "partially_automatable_steps": 0,
                "manual_steps": 0,
                "critical_dependencies": ["manual_review"],
                "risk_factors": ["parsing_failure"],
                "recommended_approach": "manual_review_required"
            }
        } 