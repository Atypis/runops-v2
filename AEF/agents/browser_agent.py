"""
Browser Agent for AEF

This agent takes execution steps from the orchestrator and executes them
using the browser-use library for actual web automation.
"""

import asyncio
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import sys
from pathlib import Path

# Add browser-use to path
browser_use_path = Path(__file__).parent.parent.parent / "browser-use"
sys.path.append(str(browser_use_path))

try:
    from browser_use import Agent
    from browser_use.browser.browser import Browser
    from browser_use.controller.service import Controller
    BROWSER_USE_AVAILABLE = True
except ImportError:
    BROWSER_USE_AVAILABLE = False
    print("⚠️  browser-use not available - install it for real browser automation")

from core.orchestrator import ExecutionStep, ExecutionPlan, TaskType, ConfidenceLevel

logger = logging.getLogger(__name__)

@dataclass
class ExecutionResult:
    """Result of executing a single step"""
    step_id: str
    success: bool
    message: str
    screenshot_path: Optional[str] = None
    confidence_achieved: float = 0.0
    execution_time: float = 0.0
    error_details: Optional[str] = None

class BrowserAgent:
    """
    Generic browser automation agent that executes orchestrator plans
    """
    
    def __init__(self, headless: bool = False):
        self.headless = headless
        self.browser = None
        self.controller = None
        self.execution_history = []
        
    async def initialize(self):
        """Initialize the browser and controller"""
        if not BROWSER_USE_AVAILABLE:
            raise RuntimeError("browser-use library not available")
            
        try:
            # Initialize browser
            self.browser = Browser(
                headless=self.headless,
                disable_security=True  # For automation purposes
            )
            await self.browser.start()
            
            # Initialize controller
            self.controller = Controller()
            
            logger.info("Browser agent initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize browser agent: {e}")
            raise
    
    async def execute_plan(self, plan: ExecutionPlan, human_approval_callback=None) -> List[ExecutionResult]:
        """
        Execute a complete execution plan
        
        Args:
            plan: The execution plan from the orchestrator
            human_approval_callback: Function to call for human approval steps
            
        Returns:
            List of execution results for each step
        """
        if not self.browser:
            await self.initialize()
            
        results = []
        
        logger.info(f"Starting execution of plan: {plan.workflow_id}")
        
        for i, step in enumerate(plan.steps):
            logger.info(f"Executing step {i+1}/{len(plan.steps)}: {step.description}")
            
            # Check if human approval is needed
            if i in plan.human_checkpoints:
                if human_approval_callback:
                    approved = await human_approval_callback(step, i)
                    if not approved:
                        result = ExecutionResult(
                            step_id=step.id,
                            success=False,
                            message="Human approval denied",
                            error_details="User rejected step execution"
                        )
                        results.append(result)
                        break
                else:
                    logger.warning(f"Step {i+1} requires human approval but no callback provided")
            
            # Execute the step
            try:
                result = await self._execute_step(step)
                results.append(result)
                
                if not result.success:
                    logger.error(f"Step {i+1} failed: {result.message}")
                    # Decide whether to continue or stop based on step criticality
                    if step.confidence == ConfidenceLevel.HIGH:
                        logger.error("High confidence step failed - stopping execution")
                        break
                    else:
                        logger.warning("Medium/low confidence step failed - continuing")
                        
            except Exception as e:
                logger.error(f"Exception executing step {i+1}: {e}")
                result = ExecutionResult(
                    step_id=step.id,
                    success=False,
                    message=f"Execution exception: {str(e)}",
                    error_details=str(e)
                )
                results.append(result)
                break
        
        logger.info(f"Plan execution completed. {len([r for r in results if r.success])}/{len(results)} steps successful")
        return results
    
    async def _execute_step(self, step: ExecutionStep) -> ExecutionResult:
        """Execute a single step"""
        
        start_time = asyncio.get_event_loop().time()
        
        try:
            if step.type == TaskType.NAVIGATE:
                success, message = await self._execute_navigate(step)
                
            elif step.type == TaskType.CLICK:
                success, message = await self._execute_click(step)
                
            elif step.type == TaskType.TYPE:
                success, message = await self._execute_type(step)
                
            elif step.type == TaskType.READ:
                success, message = await self._execute_read(step)
                
            elif step.type == TaskType.DECISION:
                success, message = await self._execute_decision(step)
                
            elif step.type == TaskType.WAIT:
                success, message = await self._execute_wait(step)
                
            elif step.type == TaskType.LOOP:
                success, message = await self._execute_loop(step)
                
            else:
                success, message = False, f"Unknown task type: {step.type}"
            
            execution_time = asyncio.get_event_loop().time() - start_time
            
            return ExecutionResult(
                step_id=step.id,
                success=success,
                message=message,
                execution_time=execution_time,
                confidence_achieved=0.8 if success else 0.0  # Simplified confidence
            )
            
        except Exception as e:
            execution_time = asyncio.get_event_loop().time() - start_time
            return ExecutionResult(
                step_id=step.id,
                success=False,
                message=f"Step execution failed: {str(e)}",
                execution_time=execution_time,
                error_details=str(e)
            )
    
    async def _execute_navigate(self, step: ExecutionStep) -> tuple[bool, str]:
        """Execute navigation step"""
        
        try:
            # Create a browser-use agent for this navigation
            agent = Agent(
                task=f"Navigate to {step.target or step.description}",
                browser=self.browser
            )
            
            # For Gmail
            if "gmail" in step.description.lower():
                url = "https://mail.google.com"
                await self.browser.go_to_url(url)
                return True, f"Successfully navigated to Gmail: {url}"
                
            # For Airtable  
            elif "airtable" in step.description.lower():
                url = "https://airtable.com"
                await self.browser.go_to_url(url)
                return True, f"Successfully navigated to Airtable: {url}"
                
            # Generic URL navigation
            elif step.target and step.target.startswith("http"):
                await self.browser.go_to_url(step.target)
                return True, f"Successfully navigated to {step.target}"
                
            else:
                # Use agent to figure out navigation
                result = await agent.run()
                return True, f"Navigation completed: {result}"
                
        except Exception as e:
            return False, f"Navigation failed: {str(e)}"
    
    async def _execute_click(self, step: ExecutionStep) -> tuple[bool, str]:
        """Execute click step"""
        
        try:
            agent = Agent(
                task=f"Click on: {step.description}. Target: {step.target or 'auto-detect'}",
                browser=self.browser
            )
            
            result = await agent.run()
            return True, f"Click completed: {result}"
            
        except Exception as e:
            return False, f"Click failed: {str(e)}"
    
    async def _execute_type(self, step: ExecutionStep) -> tuple[bool, str]:
        """Execute typing/data entry step"""
        
        try:
            agent = Agent(
                task=f"Type/enter data: {step.description}. Input: {step.input_data or 'auto-determine'}",
                browser=self.browser
            )
            
            result = await agent.run()
            return True, f"Data entry completed: {result}"
            
        except Exception as e:
            return False, f"Data entry failed: {str(e)}"
    
    async def _execute_read(self, step: ExecutionStep) -> tuple[bool, str]:
        """Execute read/extract information step"""
        
        try:
            agent = Agent(
                task=f"Read and extract information: {step.description}",
                browser=self.browser
            )
            
            result = await agent.run()
            return True, f"Information extracted: {result}"
            
        except Exception as e:
            return False, f"Read operation failed: {str(e)}"
    
    async def _execute_decision(self, step: ExecutionStep) -> tuple[bool, str]:
        """Execute decision step"""
        
        try:
            # For decision steps, we use the agent to analyze the current page
            agent = Agent(
                task=f"Analyze and make decision: {step.description}. Provide reasoning for the decision.",
                browser=self.browser
            )
            
            result = await agent.run()
            
            # In a real implementation, you'd parse the agent's response
            # and determine the decision outcome
            return True, f"Decision made: {result}"
            
        except Exception as e:
            return False, f"Decision failed: {str(e)}"
    
    async def _execute_wait(self, step: ExecutionStep) -> tuple[bool, str]:
        """Execute wait step"""
        
        try:
            # Extract wait time from description or use default
            wait_time = 2  # Default 2 seconds
            
            if "second" in step.description:
                # Try to extract number of seconds
                import re
                match = re.search(r'(\d+)\s*second', step.description)
                if match:
                    wait_time = int(match.group(1))
            
            await asyncio.sleep(wait_time)
            return True, f"Waited {wait_time} seconds"
            
        except Exception as e:
            return False, f"Wait failed: {str(e)}"
    
    async def _execute_loop(self, step: ExecutionStep) -> tuple[bool, str]:
        """Execute loop step (placeholder)"""
        
        # Loop execution would require more complex logic
        # For now, just acknowledge the loop
        return True, f"Loop step acknowledged: {step.description}"
    
    async def cleanup(self):
        """Clean up browser resources"""
        if self.browser:
            await self.browser.close()
            logger.info("Browser agent cleaned up")

# Simulation version for when browser-use is not available
class SimulatedBrowserAgent:
    """
    Simulated browser agent for testing when browser-use is not available
    """
    
    def __init__(self, headless: bool = False):
        self.headless = headless
        
    async def initialize(self):
        """Initialize simulation"""
        logger.info("Simulated browser agent initialized")
    
    async def execute_plan(self, plan: ExecutionPlan, human_approval_callback=None) -> List[ExecutionResult]:
        """Simulate plan execution"""
        
        results = []
        
        for i, step in enumerate(plan.steps):
            # Simulate execution time
            await asyncio.sleep(0.5)
            
            # Check human approval
            if i in plan.human_checkpoints and human_approval_callback:
                approved = await human_approval_callback(step, i)
                if not approved:
                    results.append(ExecutionResult(
                        step_id=step.id,
                        success=False,
                        message="Human approval denied"
                    ))
                    break
            
            # Simulate success/failure based on confidence
            success_rate = {
                ConfidenceLevel.HIGH: 0.95,
                ConfidenceLevel.MEDIUM: 0.80,
                ConfidenceLevel.LOW: 0.60
            }
            
            import random
            success = random.random() < success_rate[step.confidence]
            
            result = ExecutionResult(
                step_id=step.id,
                success=success,
                message=f"Simulated: {step.description}",
                confidence_achieved=success_rate[step.confidence] if success else 0.0,
                execution_time=random.uniform(1.0, 5.0)
            )
            
            results.append(result)
            
            if not success and step.confidence == ConfidenceLevel.HIGH:
                break  # Stop on high-confidence failures
        
        return results
    
    async def cleanup(self):
        """No cleanup needed for simulation"""
        pass

# Factory function
def create_browser_agent(headless: bool = False, use_simulation: bool = None):
    """
    Create a browser agent (real or simulated)
    
    Args:
        headless: Whether to run browser in headless mode
        use_simulation: Force simulation mode (None = auto-detect)
    """
    
    if use_simulation is None:
        use_simulation = not BROWSER_USE_AVAILABLE
    
    if use_simulation:
        return SimulatedBrowserAgent(headless=headless)
    else:
        return BrowserAgent(headless=headless) 