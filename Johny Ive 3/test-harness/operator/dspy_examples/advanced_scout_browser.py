"""
Advanced Scout Implementation with Browser Integration
=====================================================

This example shows how to integrate DSPy Scout with actual browser automation,
demonstrating the complete workflow from Director deployment to node execution.
"""

import dspy
from typing import Dict, List, Any, Optional, Callable
import asyncio
from dataclasses import dataclass, field
import json
from datetime import datetime

# Configure DSPy with Claude (matching Director's setup)
claude_lm = dspy.LM(
    model="claude-3-5-sonnet-20241022",
    api_key="YOUR_ANTHROPIC_API_KEY",
    temperature=0.7
)
dspy.configure(lm=claude_lm)


# Browser Integration Classes
class BrowserController:
    """Mock browser controller - in production would use Playwright/Puppeteer."""
    
    def __init__(self):
        self.pages = {}
        self.active_page = None
        
    async def create_page(self, name: str, url: str):
        """Create a new browser page/tab."""
        self.pages[name] = {
            "name": name,
            "url": url,
            "dom": self._generate_mock_dom(url)
        }
        self.active_page = name
        return True
    
    async def navigate(self, url: str, page_name: Optional[str] = None):
        """Navigate to a URL."""
        page = page_name or self.active_page
        if page in self.pages:
            self.pages[page]["url"] = url
            self.pages[page]["dom"] = self._generate_mock_dom(url)
            return True
        return False
    
    async def get_dom_snapshot(self, page_name: Optional[str] = None):
        """Get DOM snapshot of current page."""
        page = page_name or self.active_page
        if page in self.pages:
            return self.pages[page]["dom"]
        return None
    
    def _generate_mock_dom(self, url: str):
        """Generate mock DOM based on URL."""
        if "login" in url:
            return {
                "elements": [
                    {"id": "1", "tag": "input", "type": "email", "name": "email", "placeholder": "Email"},
                    {"id": "2", "tag": "input", "type": "password", "name": "password", "placeholder": "Password"},
                    {"id": "3", "tag": "button", "type": "submit", "text": "Sign In"},
                    {"id": "4", "tag": "a", "href": "/oauth/google", "text": "Sign in with Google"}
                ]
            }
        elif "dashboard" in url:
            return {
                "elements": [
                    {"id": "10", "tag": "div", "class": "user-profile", "text": "Welcome User"},
                    {"id": "11", "tag": "button", "class": "logout", "text": "Logout"},
                    {"id": "12", "tag": "nav", "class": "main-nav"}
                ]
            }
        return {"elements": []}


# Enhanced Tool Implementations with Browser Integration
class BrowserTools:
    """Browser automation tools for Scout."""
    
    def __init__(self, browser: BrowserController):
        self.browser = browser
        self.inspection_cache = {}
        
    async def inspect_tab(self, tab_name: str = "main", inspection_type: str = "dom_snapshot") -> Dict[str, Any]:
        """Get DOM snapshot with caching."""
        cache_key = f"{tab_name}:{inspection_type}:{datetime.now().minute}"
        
        if cache_key in self.inspection_cache:
            return self.inspection_cache[cache_key]
        
        dom = await self.browser.get_dom_snapshot(tab_name)
        if dom:
            result = {
                "success": True,
                "inspection_type": inspection_type,
                "elements": dom["elements"],
                "element_count": len(dom["elements"]),
                "timestamp": datetime.now().isoformat()
            }
            self.inspection_cache[cache_key] = result
            return result
        
        return {"success": False, "error": "No page found"}
    
    async def expand_dom_selector(self, element_id: str, tab_name: str = "main") -> Dict[str, Any]:
        """Get detailed selector information."""
        dom = await self.browser.get_dom_snapshot(tab_name)
        
        if dom:
            for element in dom["elements"]:
                if element.get("id") == element_id:
                    # Generate multiple selector options
                    selectors = []
                    
                    # ID selector
                    if "id" in element:
                        selectors.append(f"#{element['id']}")
                    
                    # Name selector
                    if "name" in element:
                        selectors.append(f"[name='{element['name']}']")
                    
                    # Type selector for inputs
                    if element["tag"] == "input" and "type" in element:
                        selectors.append(f"input[type='{element['type']}']")
                    
                    # Class selector
                    if "class" in element:
                        selectors.append(f".{element['class']}")
                    
                    # Text selector for buttons/links
                    if "text" in element:
                        selectors.append(f"{element['tag']}:contains('{element['text']}')")
                    
                    return {
                        "success": True,
                        "element_id": element_id,
                        "tag": element["tag"],
                        "selectors": selectors,
                        "attributes": {k: v for k, v in element.items() if k not in ["id", "tag"]},
                        "recommended_selector": selectors[0] if selectors else None
                    }
        
        return {"success": False, "error": f"Element {element_id} not found"}
    
    async def navigate(self, url: str, tab_name: str = "main") -> Dict[str, Any]:
        """Navigate to URL."""
        success = await self.browser.navigate(url, tab_name)
        return {
            "success": success,
            "navigated_to": url,
            "tab": tab_name
        }
    
    async def wait_for_element(self, selector: str, timeout: int = 30000, tab_name: str = "main") -> Dict[str, Any]:
        """Wait for element to appear."""
        # Simplified - in production would actually poll DOM
        await asyncio.sleep(0.5)  # Simulate wait
        return {
            "success": True,
            "found": selector,
            "tab": tab_name,
            "wait_time": 500
        }


# Advanced Scout with Async Support
class AsyncScout(dspy.Module):
    """
    Async Scout implementation that works with browser automation.
    """
    
    def __init__(self, browser: BrowserController, max_steps: int = 7):
        super().__init__()
        self.browser = browser
        self.tools = BrowserTools(browser)
        self.max_steps = max_steps
        
        # Scout signature with detailed instructions
        self.scout_signature = dspy.Signature(
            "mission, browser_state, context -> findings",
            instructions="""You are an advanced Scout agent with browser automation capabilities.
            
            RECONNAISSANCE METHODOLOGY:
            1. Analyze browser state - navigate if needed
            2. Use inspect_tab for initial page structure
            3. Use expand_dom_selector on relevant elements (call multiple times)
            4. Test interactions if needed for the mission
            5. Build comprehensive understanding through systematic exploration
            
            REPORTING REQUIREMENTS:
            - Report exact HTML tags for all elements
            - Provide multiple selector options when available
            - Include selector stability assessment
            - Note any dynamic or problematic elements
            - Suggest backup selectors for critical elements
            
            QUALITY STANDARDS:
            - Only report verified findings from successful tool calls
            - Include confidence levels for selectors
            - Flag potential issues or edge cases
            - Provide actionable recommendations"""
        )
        
        # Create custom ReAct-style module
        self.explore = dspy.ChainOfThought(self.scout_signature)
        
    async def forward(self, mission: str, context: Optional[Dict] = None) -> dspy.Prediction:
        """Execute async scout mission."""
        # Get current browser state
        browser_state = await self._get_browser_state()
        
        # Build context
        full_context = {
            "browser_state": browser_state,
            "available_tools": self._get_tool_descriptions(),
            "additional_context": context or {}
        }
        
        # Execute exploration with tool calls
        trajectory = []
        findings = {
            "elements": [],
            "selectors": {},
            "patterns": [],
            "warnings": [],
            "recommendations": []
        }
        
        for step in range(self.max_steps):
            # Get next action from LLM
            result = self.explore(
                mission=mission,
                browser_state=json.dumps(browser_state, indent=2),
                context=json.dumps(full_context, indent=2)
            )
            
            # Parse and execute tool calls from the result
            tool_calls = self._extract_tool_calls(result.findings)
            
            for tool_call in tool_calls:
                tool_result = await self._execute_tool(tool_call)
                trajectory.append({
                    "step": step,
                    "tool": tool_call["name"],
                    "args": tool_call["args"],
                    "result": tool_result
                })
                
                # Update findings based on tool results
                self._update_findings(findings, tool_call["name"], tool_result)
            
            # Check if mission is complete
            if self._is_mission_complete(findings, mission):
                break
        
        # Generate final report
        report = self._generate_report(findings, trajectory, mission)
        
        return dspy.Prediction(
            findings=findings,
            report=report,
            trajectory=trajectory,
            success=True
        )
    
    async def _get_browser_state(self) -> Dict[str, Any]:
        """Get current browser state."""
        tabs = []
        for name, page in self.browser.pages.items():
            tabs.append({
                "name": name,
                "url": page["url"],
                "is_active": name == self.browser.active_page
            })
        
        return {
            "tabs": tabs,
            "active_tab": self.browser.active_page,
            "tab_count": len(tabs)
        }
    
    def _get_tool_descriptions(self) -> List[Dict[str, str]]:
        """Get descriptions of available tools."""
        return [
            {
                "name": "inspect_tab",
                "description": "Get DOM snapshot of current page",
                "args": ["tab_name", "inspection_type"]
            },
            {
                "name": "expand_dom_selector", 
                "description": "Get detailed selector info for element",
                "args": ["element_id", "tab_name"]
            },
            {
                "name": "navigate",
                "description": "Navigate to URL",
                "args": ["url", "tab_name"]
            },
            {
                "name": "wait_for_element",
                "description": "Wait for element to appear",
                "args": ["selector", "timeout", "tab_name"]
            }
        ]
    
    def _extract_tool_calls(self, llm_output: str) -> List[Dict[str, Any]]:
        """Extract tool calls from LLM output."""
        # In production, this would parse the LLM's structured output
        # For demo, return mock tool calls based on common patterns
        return [
            {"name": "inspect_tab", "args": {"tab_name": "main"}},
            {"name": "expand_dom_selector", "args": {"element_id": "1"}},
            {"name": "expand_dom_selector", "args": {"element_id": "2"}},
            {"name": "expand_dom_selector", "args": {"element_id": "3"}}
        ]
    
    async def _execute_tool(self, tool_call: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool call."""
        tool_name = tool_call["name"]
        args = tool_call["args"]
        
        if tool_name == "inspect_tab":
            return await self.tools.inspect_tab(**args)
        elif tool_name == "expand_dom_selector":
            return await self.tools.expand_dom_selector(**args)
        elif tool_name == "navigate":
            return await self.tools.navigate(**args)
        elif tool_name == "wait_for_element":
            return await self.tools.wait_for_element(**args)
        
        return {"success": False, "error": f"Unknown tool: {tool_name}"}
    
    def _update_findings(self, findings: Dict, tool_name: str, result: Dict):
        """Update findings based on tool results."""
        if not result.get("success"):
            findings["warnings"].append(f"{tool_name} failed: {result.get('error')}")
            return
        
        if tool_name == "inspect_tab" and "elements" in result:
            findings["elements"].extend(result["elements"])
        
        elif tool_name == "expand_dom_selector" and "selectors" in result:
            element_id = result["element_id"]
            findings["selectors"][element_id] = {
                "tag": result["tag"],
                "selectors": result["selectors"],
                "recommended": result.get("recommended_selector"),
                "attributes": result.get("attributes", {})
            }
    
    def _is_mission_complete(self, findings: Dict, mission: str) -> bool:
        """Check if mission objectives are met."""
        # Simple heuristic - in production would use LLM judgment
        return len(findings["selectors"]) >= 3
    
    def _generate_report(self, findings: Dict, trajectory: List, mission: str) -> str:
        """Generate final Scout report."""
        report = f"SCOUT RECONNAISSANCE REPORT\n"
        report += f"Mission: {mission}\n"
        report += f"Execution: {len(trajectory)} tool calls\n\n"
        
        report += "FINDINGS:\n"
        for elem_id, info in findings["selectors"].items():
            report += f"\nElement {elem_id} ({info['tag']}):\n"
            report += f"  Recommended: {info['recommended']}\n"
            report += f"  Alternatives: {', '.join(info['selectors'][1:])}\n"
        
        if findings["warnings"]:
            report += f"\nWARNINGS:\n"
            for warning in findings["warnings"]:
                report += f"  - {warning}\n"
        
        return report


# Director Integration Example
class DirectorWithScout(dspy.Module):
    """
    Example Director that uses Scout for reconnaissance.
    """
    
    def __init__(self):
        super().__init__()
        self.browser = BrowserController()
        self.scout = AsyncScout(self.browser)
        
        # Director's main planning signature
        self.plan = dspy.ChainOfThought(
            dspy.Signature(
                "task, scout_findings -> execution_plan",
                instructions="Create a detailed execution plan based on Scout's findings"
            )
        )
    
    async def forward(self, task: str) -> dspy.Prediction:
        """Execute Director workflow with Scout reconnaissance."""
        # Step 1: Deploy Scout for reconnaissance
        scout_mission = f"Explore the page to understand how to: {task}"
        scout_result = await self.scout(mission=scout_mission)
        
        # Step 2: Create execution plan based on findings
        plan_result = self.plan(
            task=task,
            scout_findings=scout_result.report
        )
        
        # Step 3: Generate nodes from plan
        nodes = self._generate_nodes_from_plan(plan_result.execution_plan, scout_result.findings)
        
        return dspy.Prediction(
            scout_report=scout_result.report,
            execution_plan=plan_result.execution_plan,
            nodes=nodes,
            success=True
        )
    
    def _generate_nodes_from_plan(self, plan: str, findings: Dict) -> List[Dict]:
        """Generate executable nodes from plan and findings."""
        nodes = []
        
        # Example node generation based on findings
        for elem_id, info in findings["selectors"].items():
            if info["tag"] == "input":
                nodes.append({
                    "type": "form_interaction",
                    "selector": info["recommended"],
                    "action": "type",
                    "fallback_selectors": info["selectors"][1:]
                })
            elif info["tag"] == "button":
                nodes.append({
                    "type": "element_click",
                    "selector": info["recommended"],
                    "action": "click",
                    "fallback_selectors": info["selectors"][1:]
                })
        
        return nodes


# Example Usage
async def main():
    """Demonstrate the complete Scout workflow."""
    
    # Initialize Director with Scout
    director = DirectorWithScout()
    
    # Create initial browser state
    await director.browser.create_page("main", "https://example.com/login")
    
    # Execute task with Scout reconnaissance
    task = "Log into the application using email and password"
    
    print("=== DIRECTOR TASK EXECUTION ===")
    print(f"Task: {task}\n")
    
    result = await director(task=task)
    
    print("=== SCOUT RECONNAISSANCE ===")
    print(result.scout_report)
    
    print("\n=== EXECUTION PLAN ===")
    print(result.execution_plan)
    
    print("\n=== GENERATED NODES ===")
    for i, node in enumerate(result.nodes, 1):
        print(f"\n{i}. {node['type'].upper()}")
        print(f"   Selector: {node['selector']}")
        print(f"   Action: {node['action']}")
        print(f"   Fallbacks: {', '.join(node['fallback_selectors'])}")
    
    # Example: Optimize Scout with DSPy
    print("\n\n=== OPTIMIZATION EXAMPLE ===")
    
    # Create training data
    trainset = []
    for i in range(5):
        example = dspy.Example(
            mission=f"Find login elements on page {i}",
            browser_state={"tabs": [{"name": "main", "url": f"https://site{i}.com/login"}]},
            findings={"success": True, "selectors": {"1": {"tag": "input", "selectors": ["#email"]}}}
        ).with_inputs("mission", "browser_state")
        trainset.append(example)
    
    # Define optimization metric
    def scout_metric(example, pred, trace=None):
        return pred.findings.get("success", False) and len(pred.findings.get("selectors", {})) > 0
    
    # Optimize Scout
    from dspy.teleprompt import BootstrapFewShot
    
    optimizer = BootstrapFewShot(metric=scout_metric, max_bootstrapped_demos=3)
    # Note: In production, you would run: optimized_scout = optimizer.compile(scout, trainset=trainset)
    
    print("Scout optimization workflow demonstrated!")


if __name__ == "__main__":
    # Run the async example
    asyncio.run(main())