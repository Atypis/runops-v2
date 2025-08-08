"""
DSPy Scout Implementation Example
=================================

This is a practical example showing how to implement Scout functionality using DSPy
for the Director 2.0 system. The Scout is a lightweight reconnaissance agent that
explores web pages efficiently using tool calls within reasoning chains.

Key Features:
- Uses Claude/Anthropic as the LLM (matching Director's setup)
- Implements browser inspection tools
- Shows node creation workflow
- Demonstrates integration with browser exploration tasks
"""

import dspy
from typing import Dict, List, Any, Optional
import json
from dataclasses import dataclass
from enum import Enum

# Configure DSPy with Claude
# Note: In production, this would use the actual Anthropic API endpoint
# For now, we'll use the LiteLLM format which DSPy supports
claude_lm = dspy.LM(
    model="claude-3-5-sonnet-20241022",  # Director uses this model
    api_key="YOUR_ANTHROPIC_API_KEY",
    api_base="https://api.anthropic.com",
    temperature=0.7
)
dspy.configure(lm=claude_lm)


# Define data structures for browser state and DOM elements
@dataclass
class BrowserTab:
    name: str
    url: str
    is_active: bool

@dataclass
class DOMElement:
    id: str
    tag: str
    selectors: List[str]
    text: Optional[str]
    attributes: Dict[str, str]

class InspectionType(Enum):
    DOM_SNAPSHOT = "dom_snapshot"
    ELEMENT_DETAIL = "element_detail"


# Define Scout's Tool Functions
def inspect_tab(tab_name: str = "main", inspection_type: str = "dom_snapshot") -> Dict[str, Any]:
    """Get DOM snapshot of current page for reconnaissance."""
    # In production, this would call the actual tab inspection service
    # For demo, return mock data
    if inspection_type == "dom_snapshot":
        return {
            "success": True,
            "elements": [
                {
                    "id": "1127",
                    "tag": "input",
                    "type": "email",
                    "placeholder": "Enter email",
                    "name": "email"
                },
                {
                    "id": "1128", 
                    "tag": "input",
                    "type": "password",
                    "placeholder": "Password",
                    "name": "password"
                },
                {
                    "id": "1129",
                    "tag": "button",
                    "text": "Sign In",
                    "type": "submit"
                }
            ],
            "element_count": 3
        }
    return {"success": False, "error": "Unknown inspection type"}


def expand_dom_selector(element_id: str, tab_name: str = "main") -> Dict[str, Any]:
    """Get detailed selector information for specific elements."""
    # Mock implementation - in production would query actual DOM
    selectors_map = {
        "1127": {
            "selectors": ["#email-input", "input[name='email']", "[data-testid='email-field']"],
            "tag": "input",
            "attributes": {"type": "email", "required": "true"}
        },
        "1128": {
            "selectors": ["#password-input", "input[name='password']", "[data-qa='password']"],
            "tag": "input", 
            "attributes": {"type": "password", "required": "true"}
        },
        "1129": {
            "selectors": ["button[type='submit']", ".sign-in-btn", "[data-testid='login-button']"],
            "tag": "button",
            "attributes": {"type": "submit"}
        }
    }
    
    if element_id in selectors_map:
        return {
            "success": True,
            "element_id": element_id,
            **selectors_map[element_id]
        }
    return {"success": False, "error": f"Element {element_id} not found"}


def debug_navigate(url: str, tab_name: str = "main") -> Dict[str, Any]:
    """Navigate to explore multi-page flows during reconnaissance."""
    # Mock navigation
    return {
        "success": True,
        "navigated_to": url,
        "tab": tab_name
    }


def debug_click(selector: str, tab_name: str = "main") -> Dict[str, Any]:
    """Click elements to test interactions and explore flows."""
    # Mock click action
    return {
        "success": True,
        "clicked": selector,
        "tab": tab_name
    }


# Define Scout Agent Module using DSPy
class ScoutAgent(dspy.Module):
    """
    Scout Agent - A lightweight reconnaissance agent for web exploration.
    
    This agent uses DSPy's ReAct pattern to explore web pages through
    reasoning and tool calls, gathering intelligence for the Director.
    """
    
    def __init__(self, max_steps: int = 5):
        super().__init__()
        self.max_steps = max_steps
        
        # Define the tools available to Scout
        self.tools = [
            inspect_tab,
            expand_dom_selector,
            debug_navigate,
            debug_click
        ]
        
        # Create the ReAct agent with custom signature
        scout_signature = dspy.Signature(
            "mission, browser_state -> findings",
            instructions="""You are a Scout - a lightweight reconnaissance agent exploring web pages efficiently.
            
            Your mission is to gather specific intelligence through systematic exploration.
            Focus on finding stable selectors, element patterns, and interaction flows.
            
            IMPORTANT:
            - Check browser state first - navigate if no pages are loaded
            - Use inspect_tab to see page structure
            - Use expand_dom_selector multiple times to investigate elements
            - Report exact HTML tags and multiple selector options
            - Only report what you actually find - never hallucinate"""
        )
        
        self.react = dspy.ReAct(
            signature=scout_signature,
            tools=self.tools,
            max_iters=self.max_steps
        )
        
    def forward(self, mission: str, browser_state: Dict[str, Any]) -> dspy.Prediction:
        """Execute the scout mission and return findings."""
        # Format browser state for the agent
        browser_context = self._format_browser_state(browser_state)
        
        # Execute the reconnaissance mission
        result = self.react(
            mission=f"{mission}\n\nCurrent Browser State:\n{browser_context}",
            browser_state=browser_state
        )
        
        # Extract and structure the findings
        findings = self._extract_findings(result)
        
        return dspy.Prediction(
            findings=findings,
            trajectory=result.trajectory,
            success=findings.get("success", False)
        )
    
    def _format_browser_state(self, browser_state: Dict[str, Any]) -> str:
        """Format browser state for Scout's context."""
        if not browser_state.get("tabs"):
            return "No tabs open. You'll need to navigate somewhere first."
        
        tabs = browser_state["tabs"]
        active_tab = browser_state.get("active_tab", "main")
        
        formatted = f"{len(tabs)} tab(s) open:\n"
        for tab in tabs:
            is_active = " (Active)" if tab["name"] == active_tab else ""
            formatted += f"- {tab['name']}{is_active} = {tab['url']}\n"
        
        return formatted
    
    def _extract_findings(self, result: dspy.Prediction) -> Dict[str, Any]:
        """Extract structured findings from Scout's exploration."""
        trajectory = result.trajectory
        
        # Analyze the trajectory to extract findings
        findings = {
            "success": True,
            "summary": result.findings,
            "elements_found": [],
            "patterns": [],
            "warnings": [],
            "tools_executed": 0
        }
        
        # Count tool executions and extract results
        for i in range(self.max_steps):
            if f"tool_name_{i}" in trajectory:
                findings["tools_executed"] += 1
                
                tool_name = trajectory[f"tool_name_{i}"]
                observation = trajectory.get(f"observation_{i}", {})
                
                # Extract element information from observations
                if tool_name == "inspect_tab" and isinstance(observation, dict):
                    if "elements" in observation:
                        findings["elements_found"].extend(observation["elements"])
                
                # Check for errors
                if isinstance(observation, dict) and observation.get("success") is False:
                    findings["warnings"].append(f"{tool_name} failed: {observation.get('error', 'Unknown error')}")
        
        return findings


# Create Node Structures for Director Integration
class NodeType(Enum):
    """Node types that Scout can suggest for Director to create."""
    NAVIGATION = "navigation"
    FORM_INTERACTION = "form_interaction"
    ELEMENT_CLICK = "element_click"
    WAIT_FOR_ELEMENT = "wait_for_element"
    EXTRACT_DATA = "extract_data"


@dataclass
class SuggestedNode:
    """A node that Scout suggests Director should create."""
    type: NodeType
    description: str
    selectors: List[str]
    parameters: Dict[str, Any]
    confidence: float  # 0.0 to 1.0


class ScoutWithNodeGeneration(ScoutAgent):
    """
    Extended Scout that can suggest nodes for Director to create.
    
    This demonstrates how Scout's findings can be translated into
    actionable node creation suggestions for the Director.
    """
    
    def __init__(self, max_steps: int = 5):
        super().__init__(max_steps)
        
        # Add a signature for node generation
        self.node_generator = dspy.ChainOfThought(
            dspy.Signature(
                "findings, mission -> suggested_nodes: list[dict]",
                instructions="""Based on the reconnaissance findings, suggest specific nodes
                that the Director should create to accomplish the mission.
                
                Each node should include:
                - type: navigation, form_interaction, element_click, wait_for_element, extract_data
                - description: What the node does
                - selectors: List of CSS selectors to use (prefer stable ones)
                - parameters: Any additional parameters needed
                - confidence: How confident you are this node will work (0.0-1.0)"""
            )
        )
    
    def forward(self, mission: str, browser_state: Dict[str, Any]) -> dspy.Prediction:
        """Execute scout mission and generate node suggestions."""
        # Get base findings
        scout_result = super().forward(mission, browser_state)
        
        # Generate node suggestions based on findings
        node_result = self.node_generator(
            findings=json.dumps(scout_result.findings, indent=2),
            mission=mission
        )
        
        # Parse and structure the suggested nodes
        suggested_nodes = self._parse_node_suggestions(node_result.suggested_nodes)
        
        return dspy.Prediction(
            findings=scout_result.findings,
            trajectory=scout_result.trajectory,
            suggested_nodes=suggested_nodes,
            success=scout_result.success
        )
    
    def _parse_node_suggestions(self, raw_suggestions: Any) -> List[SuggestedNode]:
        """Parse raw node suggestions into structured format."""
        nodes = []
        
        # Handle different formats that the LLM might return
        if isinstance(raw_suggestions, str):
            try:
                raw_suggestions = json.loads(raw_suggestions)
            except:
                return nodes
        
        if isinstance(raw_suggestions, list):
            for suggestion in raw_suggestions:
                if isinstance(suggestion, dict):
                    try:
                        node = SuggestedNode(
                            type=NodeType(suggestion.get("type", "element_click")),
                            description=suggestion.get("description", ""),
                            selectors=suggestion.get("selectors", []),
                            parameters=suggestion.get("parameters", {}),
                            confidence=float(suggestion.get("confidence", 0.5))
                        )
                        nodes.append(node)
                    except:
                        continue
        
        return nodes


# Example Usage and Testing
if __name__ == "__main__":
    # Initialize Scout
    scout = ScoutWithNodeGeneration(max_steps=7)
    
    # Example browser state
    browser_state = {
        "tabs": [
            {"name": "main", "url": "https://example.com/login"},
            {"name": "oauth", "url": "https://accounts.google.com/signin"}
        ],
        "active_tab": "main"
    }
    
    # Example mission
    mission = """Find all login form elements and their stable selectors. 
    Test the login flow and identify any OAuth options."""
    
    # Deploy Scout
    print("Deploying Scout on reconnaissance mission...")
    result = scout(mission=mission, browser_state=browser_state)
    
    # Display results
    print("\n=== SCOUT FINDINGS ===")
    print(f"Success: {result.success}")
    print(f"Tools Executed: {result.findings['tools_executed']}")
    print(f"\nSummary: {result.findings['summary']}")
    
    print("\n=== SUGGESTED NODES ===")
    for i, node in enumerate(result.suggested_nodes, 1):
        print(f"\n{i}. {node.type.value.upper()}")
        print(f"   Description: {node.description}")
        print(f"   Selectors: {', '.join(node.selectors)}")
        print(f"   Confidence: {node.confidence:.1%}")
    
    # Example: Using with optimization
    print("\n\n=== OPTIMIZATION EXAMPLE ===")
    
    # Create training examples
    trainset = [
        dspy.Example(
            mission="Find the search box and search button",
            browser_state={"tabs": [{"name": "main", "url": "https://google.com"}], "active_tab": "main"},
            findings={"success": True, "summary": "Found search box (input[name='q']) and search button"}
        ).with_inputs("mission", "browser_state"),
        # Add more training examples...
    ]
    
    # Define metric for optimization
    def scout_metric(example, pred, trace=None):
        # Check if Scout found relevant elements
        return pred.findings.get("success", False) and pred.findings.get("tools_executed", 0) > 0
    
    # Optimize with DSPy (simplified example)
    from dspy.teleprompt import BootstrapFewShot
    
    print("Optimizing Scout agent...")
    optimizer = BootstrapFewShot(metric=scout_metric, max_bootstrapped_demos=3)
    optimized_scout = optimizer.compile(scout, trainset=trainset)
    
    print("Scout optimization complete!")
    
    # The optimized scout now has better prompts and few-shot examples
    # based on the training data and metric