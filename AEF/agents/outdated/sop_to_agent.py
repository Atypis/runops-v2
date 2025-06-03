"""
SOP to Intelligent Agent Translator

This module converts recorded SOPs into intelligent browser-use agents
that can adapt and reason through workflows instead of blindly following steps.
"""

import asyncio
import json
import os
import uuid
from typing import Dict, List, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import Claude instead of Gemini
from langchain_anthropic import ChatAnthropic
from browser_use import Agent
from browser_use.browser import BrowserSession, BrowserProfile


class IntelligentSOPExecutor:
    """
    Converts SOPs into intelligent, adaptive browser automation.
    
    Instead of rigid step-by-step execution, this creates AI agents that:
    1. Understand the intent behind each workflow step
    2. Adapt to UI changes and unexpected situations  
    3. Reason through problems instead of failing on selector changes
    4. Learn from human demonstrations but think independently
    """
    
    def __init__(self, llm_model: str = "claude-sonnet-4-20250514", 
                 sensitive_data: dict = None, allowed_domains: list = None):
        # Use Claude Sonnet 4 with the API key from environment
        self.llm = ChatAnthropic(
            model=llm_model,
            temperature=1.0,  # Higher temperature for flexible, adaptive reasoning
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            max_tokens=8192
        )
        self.browser_session = None
        self.sensitive_data = sensitive_data or {}
        self.allowed_domains = allowed_domains or []
        
    async def execute_sop(self, sop_data: Dict[str, Any], max_steps: int = 100) -> Dict[str, Any]:
        """
        Execute an SOP using intelligent agent reasoning.
        
        Args:
            sop_data: The SOP JSON structure
            max_steps: Maximum steps for the agent
            
        Returns:
            Execution results with success metrics
        """
        
        # Extract the core intent and convert to intelligent task description
        intelligent_task = self._convert_sop_to_intelligent_task(sop_data)
        
        print(f"🧠 Generated Intelligent Task:")
        print("=" * 50)
        print(intelligent_task)
        print("=" * 50)
        
        # Create browser session if needed
        if not self.browser_session:
            # Use a unique profile to avoid conflicts
            profile_name = f"sop_execution_{uuid.uuid4().hex[:8]}"
            
            browser_profile = BrowserProfile(
                user_data_dir=f"~/.config/browseruse/profiles/{profile_name}",
                headless=False,  # Set to True for headless mode
                keep_alive=True,
                allowed_domains=self.allowed_domains if self.allowed_domains else None
            )
            
            self.browser_session = BrowserSession(
                browser_profile=browser_profile
            )
            await self.browser_session.start()
        
        # Create intelligent agent with sensitive data
        agent = Agent(
            task=intelligent_task,
            llm=self.llm,
            browser_session=self.browser_session,
            sensitive_data=self.sensitive_data if self.sensitive_data else None,
            use_vision=True,
            max_failures=5,  # Allow more retries for complex workflows
            retry_delay=3
        )
        
        # Execute with intelligence, not rigid steps
        history = await agent.run(max_steps=max_steps)
        
        return {
            "success": history.is_done(),
            "steps_executed": len(history.history),
            "final_state": history.final_state() if hasattr(history, 'final_state') else None,
            "execution_summary": self._summarize_execution(history)
        }
    
    def _convert_sop_to_intelligent_task(self, sop_data: Dict[str, Any]) -> str:
        """
        Convert rigid SOP steps into an intelligent task description.
        This is the key innovation - instead of following steps blindly,
        we give the AI the intent and let it reason through the execution.
        """
        
        meta = sop_data.get('meta', {})
        nodes = sop_data.get('public', {}).get('nodes', [])
        
        # Extract key workflow patterns
        workflow_goal = meta.get('goal', 'Execute workflow tasks')
        workflow_purpose = meta.get('purpose', 'Complete the specified workflow')
        
        # Analyze nodes for patterns
        loops = []
        decisions = []
        key_steps = []
        
        for node in nodes:
            intent = node.get('intent', '')
            if 'loop' in intent.lower() or 'iterate' in intent.lower():
                loops.append(f"- LOOP: {intent}")
            elif 'decision' in intent.lower() or 'determine' in intent.lower():
                decisions.append(f"- DECISION: {intent}")
            else:
                key_steps.append(f"- {intent}")
        
        # Create intelligent task description
        task = f"""
WORKFLOW GOAL: {workflow_goal}
PURPOSE: {workflow_purpose}

INTELLIGENT EXECUTION APPROACH:
I need to accomplish this workflow by understanding the intent behind each step, 
not by blindly following rigid instructions. Here's what I understand about this workflow:

{chr(10).join(loops)}
{chr(10).join(decisions)}
KEY WORKFLOW STEPS:
{chr(10).join(key_steps)}

EXECUTION STRATEGY:
1. I should adapt to the current state of each website/application
2. If UI elements have changed, I should reason about what the human was trying to accomplish
3. I should handle errors gracefully and find alternative approaches
4. I should maintain context about what I'm trying to achieve at each step
5. I should verify my actions are moving me toward the overall goal

IMPORTANT: I am an intelligent agent, not a macro recorder. I should think through 
each step and adapt to the current situation while maintaining focus on the ultimate goal.

FOR TESTING PURPOSES: Process ALL emails in the inbox, regardless of date, to demonstrate 
the full workflow capabilities. Don't limit to just today's emails - process all available 
emails to show the complete email triage and Airtable integration workflow.
"""
        
        return task.strip()
    
    def _analyze_workflow_intent(self, nodes: List[Dict[str, Any]]) -> str:
        """
        Analyze SOP nodes to extract the underlying intent and logic.
        """
        
        analysis_parts = []
        
        # Find loops and their purpose
        loops = [node for node in nodes if node.get("type") == "loop"]
        for loop in loops:
            loop_intent = loop.get("intent", "")
            exit_condition = loop.get("exit_condition", "")
            analysis_parts.append(f"- LOOP: {loop_intent} (until: {exit_condition})")
        
        # Find decision points
        decisions = [node for node in nodes if node.get("type") == "decision"]
        for decision in decisions:
            decision_intent = decision.get("intent", "")
            analysis_parts.append(f"- DECISION: {decision_intent}")
        
        # Find key tasks and their intents
        tasks = [node for node in nodes if node.get("type") == "task"]
        key_tasks = []
        for task in tasks[:5]:  # First 5 tasks to understand the flow
            intent = task.get("intent", "")
            if intent:
                key_tasks.append(f"- {intent}")
        
        if key_tasks:
            analysis_parts.append("KEY WORKFLOW STEPS:")
            analysis_parts.extend(key_tasks)
        
        return "\n".join(analysis_parts) if analysis_parts else "Standard workflow execution"
    
    def _get_intelligent_workflow_prompt(self) -> str:
        """
        Enhanced system prompt for intelligent workflow execution.
        """
        
        return """
INTELLIGENT WORKFLOW EXECUTION MODE:

You are executing a workflow that was demonstrated by a human. Your job is to:

1. UNDERSTAND INTENT: Don't just follow rigid steps - understand what the human was trying to accomplish
2. ADAPT TO REALITY: If the UI has changed, figure out how to achieve the same goal with the current interface
3. REASON THROUGH PROBLEMS: When something doesn't work as expected, think about alternative approaches
4. MAINTAIN CONTEXT: Remember what you're trying to accomplish and why each step matters
5. VERIFY PROGRESS: After each action, confirm you're moving toward the goal

WORKFLOW INTELLIGENCE GUIDELINES:
- If a selector doesn't work, look for similar elements that serve the same purpose
- If a step seems impossible, consider if the goal can be achieved differently
- If you encounter unexpected UI, adapt your approach while maintaining the workflow intent
- Always explain your reasoning when you deviate from the original demonstration
- Focus on successful completion of the overall goal, not rigid step adherence

LOOP HANDLING:
- For loops, understand the exit condition and monitor progress toward it
- Don't get stuck in infinite loops - if you're not making progress, try a different approach
- Count iterations and have a reasonable maximum to prevent runaway execution

DECISION MAKING:
- When making decisions, consider the context and overall workflow goal
- If uncertain, err on the side of the action that moves the workflow forward
- Document your decision-making process for human review

Remember: You're an intelligent agent, not a script. Think, adapt, and succeed.
"""
    
    def _summarize_execution(self, history) -> str:
        """
        Create a human-readable summary of what the agent accomplished.
        """
        
        if not history or not hasattr(history, 'history'):
            return "No execution history available"
        
        total_steps = len(history.history)
        success = history.is_done()
        
        summary = f"Executed {total_steps} steps. "
        summary += "Successfully completed workflow." if success else "Workflow incomplete."
        
        # Add any specific insights from the execution
        if hasattr(history, 'final_state'):
            summary += f" Final state: {history.final_state()}"
        
        return summary

    async def execute_sop_file(self, sop_file_path: str) -> Dict[str, Any]:
        """
        Execute a workflow from an SOP file with intelligent adaptation.
        """
        
        # Load SOP
        with open(sop_file_path, 'r') as f:
            sop_data = json.load(f)
        
        print(f"🧠 Executing workflow: {sop_data.get('meta', {}).get('title', 'Unknown')}")
        print("🎯 Using intelligent agent reasoning, not rigid step execution")
        print(f"🤖 Model: Claude Sonnet 4")
        
        # Generate intelligent task description
        intelligent_task = self._convert_sop_to_intelligent_task(sop_data)
        print("🧠 Generated Intelligent Task:")
        print("=" * 50)
        print(intelligent_task)
        print("=" * 50)
        
        # Execute with intelligence
        result = await self.execute_sop(sop_data)
        
        # Report results
        if result["success"]:
            print(f"✅ Workflow completed successfully in {result['steps_executed']} steps")
        else:
            print(f"⚠️ Workflow incomplete after {result['steps_executed']} steps")
            print(f"📋 Summary: {result['execution_summary']}")
        
        return result

    async def cleanup(self):
        """Clean up browser resources."""
        if self.browser_session:
            await self.browser_session.close()
            self.browser_session = None


class SOPWorkflowManager:
    """
    High-level manager for executing SOPs with intelligent browser agents.
    """
    
    def __init__(self, llm_model: str = "claude-sonnet-4-20250514", 
                 sensitive_data: dict = None, allowed_domains: list = None):
        self.llm_model = llm_model
        self.sensitive_data = sensitive_data or {}
        self.allowed_domains = allowed_domains or []
        self.executor = None
        
    async def execute_workflow(self, sop_path: str) -> dict:
        """
        Execute a workflow from SOP file with intelligent reasoning.
        """
        try:
            # Create executor with sensitive data and domain restrictions
            self.executor = IntelligentSOPExecutor(
                llm_model=self.llm_model,
                sensitive_data=self.sensitive_data,
                allowed_domains=self.allowed_domains
            )
            
            # Load and execute the SOP
            result = await self.executor.execute_sop_file(sop_path)
            return result
            
        except Exception as e:
            return {
                'success': False,
                'steps_executed': 0,
                'execution_summary': f'Failed to execute workflow: {str(e)}',
                'error': str(e)
            }
    
    async def cleanup(self):
        """Clean up resources."""
        if self.executor:
            await self.executor.cleanup()


# Example usage
async def main():
    """
    Example of how to use the intelligent SOP executor.
    """
    
    manager = SOPWorkflowManager()
    
    try:
        # Execute the email triage workflow intelligently
        result = await manager.execute_workflow("stagehand-test/downloads/22d88614-7cfa-41ca-a3fb-3d191e8daf21_stagehand.json")
        
        print(f"\n🎯 Execution Result:")
        print(f"Success: {result['success']}")
        print(f"Steps: {result['steps_executed']}")
        print(f"Summary: {result['execution_summary']}")
        
    finally:
        await manager.cleanup()


if __name__ == "__main__":
    asyncio.run(main()) 