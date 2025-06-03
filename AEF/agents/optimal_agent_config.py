"""
Optimal Browser-Use Agent Configuration

This file contains the optimal configuration for browser-use agents
to maximize reliability and intelligence for complex workflows.
"""

import os
import asyncio
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from langchain_anthropic import ChatAnthropic
from browser_use import Agent
from browser_use.browser import BrowserSession, BrowserProfile
from browser_use.agent.memory import MemoryConfig


class OptimalAgentConfig:
    """
    Optimal configuration for browser-use agents that maximizes all capabilities:
    - Memory system for learning and context retention
    - Planner for strategic task decomposition  
    - High step limits for complex workflows
    - Vision for UI understanding
    - Robust error handling and retries
    """
    
    @staticmethod
    def create_agent(
        task: str,
        sensitive_data: Optional[Dict[str, str]] = None,
        allowed_domains: Optional[list] = None,
        llm_model: str = "claude-sonnet-4-20250514",
        planner_model: str = "claude-sonnet-4-20250514",
        max_steps: int = 500,
        agent_id: Optional[str] = None
    ) -> Agent:
        """
        Create an optimally configured browser-use agent.
        
        Args:
            task: The high-level task description
            sensitive_data: Credentials and sensitive information
            allowed_domains: Security restriction for domains
            llm_model: Main LLM model for agent actions (Claude Sonnet 4)
            planner_model: LLM model for strategic planning (Claude Sonnet 4)
            max_steps: Maximum steps for complex workflows
            agent_id: Unique identifier for memory persistence
            
        Returns:
            Fully configured Agent instance
        """
        
        # Initialize Claude Sonnet 4 LLMs
        main_llm = ChatAnthropic(
            model=llm_model,
            temperature=1.0,  # Higher temperature for flexible, adaptive behavior
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            max_tokens=8192
        )
        
        planner_llm = ChatAnthropic(
            model=planner_model,
            temperature=1.0,  # Higher temperature for creative and adaptive planning
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            max_tokens=8192
        )
        
        # Configure browser profile with security
        browser_profile = BrowserProfile(
            user_data_dir=f"~/.config/browseruse/profiles/optimal_agent",
            headless=False,  # Visual feedback for development
            keep_alive=True,
            allowed_domains=allowed_domains or []
        )
        
        # Create browser session
        browser_session = BrowserSession(browser_profile=browser_profile)
        
        # Configure memory for learning and context retention
        memory_config = MemoryConfig(
            agent_id=agent_id or "gmail_airtable_agent",
            memory_interval=10,  # Summarize every 10 steps
            llm_instance=main_llm
        )
        
        # Create agent with maximum capabilities enabled
        agent = Agent(
            task=task,
            llm=main_llm,
            browser_session=browser_session,
            
            # === CORE INTELLIGENCE SETTINGS ===
            use_vision=True,                    # Essential for UI understanding
            planner_llm=planner_llm,           # Strategic planning capability
            planner_interval=5,                # Plan every 5 steps for complex workflows
            use_vision_for_planner=True,       # Planner can see screenshots
            is_planner_reasoning=True,         # Enable planner reasoning
            
            # === MEMORY & LEARNING ===
            enable_memory=True,                # Learn from experience
            memory_config=memory_config,       # Persistent memory across runs
            
            # === EXECUTION SETTINGS ===
            max_actions_per_step=15,           # Allow complex multi-action steps
            max_failures=8,                    # High tolerance for UI changes
            retry_delay=5,                     # Quick recovery from failures
            
            # === SECURITY ===
            sensitive_data=sensitive_data,     # Secure credential handling
            
            # === SYSTEM PROMPT ENHANCEMENT ===
            extend_system_message=OptimalAgentConfig.get_enhanced_system_prompt(),
            
            # === DEBUGGING & MONITORING ===
            save_conversation_path=f"logs/agent_conversation_{agent_id}.json",
            generate_gif=True,                 # Visual execution record
            
            # === VALIDATION ===
            validate_output=True,              # LLM-based output validation
            
            # === CONTEXT OPTIMIZATION ===
            max_input_tokens=200000,           # Large context for complex workflows
            include_attributes=[               # Rich element information
                'title', 'type', 'name', 'role', 'aria-label', 
                'placeholder', 'value', 'alt', 'aria-expanded',
                'data-testid', 'class', 'id'
            ]
        )
        
        return agent
    
    @staticmethod
    def get_enhanced_system_prompt() -> str:
        """
        Enhanced system prompt that maximizes agent intelligence and reliability.
        """
        return """
ENHANCED AGENT CAPABILITIES:

🧠 INTELLIGENT EXECUTION MODE:
You are an expert automation agent with advanced reasoning capabilities. Your goal is to complete complex workflows through intelligent adaptation, not rigid script following.

🎯 CORE PRINCIPLES:
1. UNDERSTAND INTENT: Always grasp the underlying business goal, not just individual steps
2. ADAPT DYNAMICALLY: When UI changes, reason about alternative approaches to achieve the same outcome
3. THINK STRATEGICALLY: Use your planner to break down complex tasks into logical phases
4. LEARN FROM EXPERIENCE: Leverage your memory system to improve performance over time
5. VALIDATE PROGRESS: Continuously verify you're moving toward the ultimate objective

🔍 WORKFLOW INTELLIGENCE:
- For email processing: Understand content semantics, not just UI interactions
- For data entry: Focus on accuracy and completeness of information transfer
- For authentication: Handle various login flows intelligently
- For navigation: Adapt to different layouts while maintaining workflow continuity

🛡️ ERROR HANDLING:
- If an element isn't found, look for semantically similar alternatives
- If a step fails, consider different approaches to achieve the same goal
- If authentication is required, handle it gracefully within security constraints
- If data is missing, make intelligent decisions about how to proceed

📊 MEMORY UTILIZATION:
- Remember successful patterns from previous executions
- Learn from failures to avoid repeating mistakes
- Build up domain knowledge about specific websites and workflows
- Maintain context about long-running processes

🎨 UI ADAPTATION:
- Use vision capabilities to understand visual context
- Recognize UI patterns even when specific selectors change
- Adapt to responsive design changes and different screen sizes
- Handle dynamic content loading and async operations

⚡ PERFORMANCE OPTIMIZATION:
- Batch related actions when possible
- Minimize unnecessary navigation
- Use efficient element selection strategies
- Optimize for both speed and reliability

🔐 SECURITY AWARENESS:
- Only use provided credentials on authorized domains
- Be cautious about data exposure in logs or screenshots
- Validate SSL certificates and secure connections
- Handle sensitive information appropriately

Remember: You are an intelligent agent, not a macro. Think, reason, adapt, and succeed.
"""

    @staticmethod
    async def execute_workflow(
        task: str,
        sensitive_data: Optional[Dict[str, str]] = None,
        allowed_domains: Optional[list] = None,
        max_steps: int = 500,
        agent_id: str = "optimal_agent"
    ) -> Dict[str, Any]:
        """
        Execute a workflow with optimal agent configuration.
        
        Returns:
            Execution results with detailed metrics
        """
        
        # Create optimally configured agent
        agent = OptimalAgentConfig.create_agent(
            task=task,
            sensitive_data=sensitive_data,
            allowed_domains=allowed_domains,
            max_steps=max_steps,
            agent_id=agent_id
        )
        
        try:
            # Start browser session
            await agent.browser_session.start()
            
            print(f"🚀 Starting optimal agent execution")
            print(f"🎯 Task: {task}")
            print(f"🧠 Memory enabled with ID: {agent_id}")
            print(f"🗺️ Planner enabled (every 5 steps)")
            print(f"👁️ Vision enabled for both agent and planner")
            print(f"📊 Max steps: {max_steps}")
            print(f"🔐 Security: {len(allowed_domains or [])} allowed domains")
            
            # Execute with optimal settings
            history = await agent.run(max_steps=max_steps)
            
            # Analyze results
            success = history.is_done()
            steps_executed = len(history.history)
            total_tokens = history.total_input_tokens()
            duration = history.total_duration_seconds()
            
            return {
                "success": success,
                "steps_executed": steps_executed,
                "total_input_tokens": total_tokens,
                "duration_seconds": duration,
                "final_url": history.history[-1].state.url if history.history else None,
                "memory_enabled": True,
                "planner_enabled": True,
                "vision_enabled": True,
                "execution_summary": f"Completed {steps_executed} steps in {duration:.1f}s using {total_tokens} tokens"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "steps_executed": len(agent.state.history.history),
                "execution_summary": f"Failed with error: {str(e)}"
            }
            
        finally:
            # Cleanup
            await agent.browser_session.close()


# Example usage for Gmail → Airtable workflow
async def main():
    """
    Example of optimal agent configuration for Gmail → Airtable workflow.
    """
    
    task = """
    GMAIL TO AIRTABLE EMAIL PROCESSING WORKFLOW:
    
    I need to process emails from Gmail and update an Airtable CRM with investor information.
    
    WORKFLOW STEPS:
    1. Navigate to Gmail and authenticate
    2. Process ALL emails in the inbox (not just today's - process everything for testing)
    3. For each email, determine if it's investor-related
    4. If investor-related, extract key information:
       - Investor name and contact person
       - Email address and company
       - Stage of relationship (Initial Contact, Interested, In Diligence, etc.)
       - Summary of the interaction
       - Next steps or follow-up needed
    5. Navigate to Airtable CRM
    6. Update existing investor records or create new ones
    7. Ensure all data is accurately transferred
    
    INTELLIGENCE REQUIREMENTS:
    - Understand email content semantically (not just keywords)
    - Classify relationship stages intelligently
    - Handle various email formats and styles
    - Adapt to UI changes in both Gmail and Airtable
    - Maintain data accuracy and completeness
    
    SUCCESS CRITERIA:
    - All investor emails correctly identified and processed
    - Airtable accurately reflects email information
    - No data loss or corruption
    - Graceful handling of authentication and errors
    """
    
    sensitive_data = {
        'gmail_email': 'michaelburner595@gmail.com',
        'gmail_password': 'dCdWqhgPzJev6Jz'
    }
    
    allowed_domains = [
        'https://*.google.com',
        'https://mail.google.com', 
        'https://*.airtable.com',
        'https://airtable.com'
    ]
    
    result = await OptimalAgentConfig.execute_workflow(
        task=task,
        sensitive_data=sensitive_data,
        allowed_domains=allowed_domains,
        max_steps=500,
        agent_id="gmail_airtable_processor"
    )
    
    print("\n" + "="*60)
    print("🎯 EXECUTION RESULTS")
    print("="*60)
    print(f"✅ Success: {result['success']}")
    print(f"📊 Steps: {result['steps_executed']}")
    print(f"⏱️ Duration: {result.get('duration_seconds', 0):.1f}s")
    print(f"🧠 Tokens: {result.get('total_input_tokens', 0):,}")
    print(f"📝 Summary: {result['execution_summary']}")


if __name__ == "__main__":
    asyncio.run(main()) 