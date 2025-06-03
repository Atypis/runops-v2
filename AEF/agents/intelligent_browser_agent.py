"""
Intelligent Browser Agent - Memory-Wiping Implementation

This module adapts browser-use to implement the memory-wiping approach where:
1. Agent memory gets wiped after each step (like Memento)
2. Only structured context survives (action history, preserved intelligence, current state)
3. Agent must document everything critical for survival
4. Forces higher-quality thinking and planning

Key differences from standard browser-use:
- Custom system prompt focused on strategic planning and mindful execution
- Memory wiping between steps with survival documentation
- Structured context management with explicit sections
- Early escalation philosophy with low uncertainty threshold
"""

import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from pydantic import BaseModel

# Import browser-use components
from browser_use import Agent, BrowserSession, Controller
from browser_use.agent.views import AgentOutput, ActionResult, AgentStepInfo
from browser_use.browser.views import BrowserStateSummary
from browser_use.agent.message_manager.service import MessageManager, MessageManagerSettings
from browser_use.agent.message_manager.views import MessageManagerState, MessageMetadata

logger = logging.getLogger(__name__)


class SurvivedContext(BaseModel):
    """The only context that survives memory wipes between steps"""
    
    # Current state awareness - always preserved
    current_task: str = ""
    current_location: str = ""
    current_objective: str = ""
    
    # Complete action history - NEVER WIPED
    action_history: List[str] = []
    
    # Preserved intelligence - survival notes
    workflow_progress: str = ""
    navigation_state: str = ""
    critical_information: str = ""
    key_discoveries: str = ""
    successful_patterns: str = ""
    data_collected: str = ""


class IntelligentBrowserAgent:
    """
    Browser agent that implements memory-wiping with structured context preservation.
    
    This agent follows the "Memento" approach where detailed memory gets wiped after
    each step, forcing the agent to document everything critical in structured survival notes.
    """
    
    def __init__(
        self,
        task: str,
        llm: BaseChatModel,
        browser_session: Optional[BrowserSession] = None,
        controller: Optional[Controller] = None,
        max_steps: int = 50,
        use_vision: bool = True,
        **kwargs
    ):
        self.task = task
        self.llm = llm
        self.max_steps = max_steps
        self.use_vision = use_vision
        
        # Initialize survived context
        self.survived_context = SurvivedContext(current_task=task)
        
        # Extract parameters that need special handling
        max_failures = kwargs.pop('max_failures', 2)
        sensitive_data = kwargs.pop('sensitive_data', None)
        allowed_domains = kwargs.pop('allowed_domains', None)
        
        # Create browser session if not provided, with proper security setup
        if browser_session is None:
            from browser_use.browser.session import BrowserSession
            from browser_use.browser.profile import BrowserProfile
            
            # Configure browser profile with security restrictions
            browser_profile = BrowserProfile(
                user_data_dir=f"~/.config/browseruse/profiles/intelligent_agent_{int(time.time())}",
                headless=False,
                keep_alive=True,
                allowed_domains=allowed_domains or []
            )
            
            browser_session = BrowserSession(browser_profile=browser_profile)
        
        # Create underlying browser-use agent with custom settings
        self.browser_agent = Agent(
            task=task,
            llm=llm,
            browser_session=browser_session,
            controller=controller or Controller(),
            use_vision=use_vision,
            enable_memory=False,  # Disable browser-use's built-in memory
            override_system_message=self._get_intelligent_system_prompt(),
            max_failures=max_failures,
            sensitive_data=sensitive_data,  # Pass sensitive_data to browser agent
            **kwargs
        )
        
        self.step_count = 0
        
    def _get_intelligent_system_prompt(self) -> str:
        """Get the intelligent workflow agent system prompt"""
        return '''🧠 YOU ARE AN INTELLIGENT WORKFLOW AGENT

You are not a task execution machine. You are a brilliant, adaptive intelligence capable of reasoning, planning, and executing complex workflows with precision and creativity. You possess the rare ability to think strategically while acting tactically, to see both the forest and the trees.

## YOUR CORE IDENTITY

You are a strategic thinker and meticulous executor rolled into one. You approach every workflow like a master craftsperson - with careful planning, thoughtful execution, and continuous refinement. You understand that true intelligence lies not in following instructions blindly, but in understanding intent, adapting to reality, and achieving outcomes through reasoned action.

## 🔐 AUTHENTICATION & CREDENTIALS

You have access to login credentials for this workflow through the sensitive_data system. When you encounter login forms:
- Use the provided Gmail credentials (email and password) instead of asking the user
- The credentials are available in your sensitive_data context
- Input them directly into login forms as needed
- DO NOT ask the user for credentials that are already available to you

## YOUR OPERATING FRAMEWORK

### PHASE 1: STRATEGIC PLANNING
When you receive a workflow task, engage your strategic mind:

**THINK DEEPLY:**
- What is the true objective here? What does success actually look like?
- What are the potential failure modes and how can I plan around them?
- How can I ensure COMPLETE and SYSTEMATIC coverage of all required work?
- What information will I need to preserve as I work through this?

**PLAN FOR COMPLETENESS:**
- **For bulk processing tasks**: Create individual tasks for each item that needs processing
  - "Process document 1 of 25", "Process document 2 of 25", etc.
  - This ensures systematic coverage and nothing gets missed
- **For complex workflows**: Break into logical phases with clear boundaries
- **For exploratory tasks**: Plan discovery phase first, then systematic execution
- **Always include verification steps**: "Confirm all items have been processed"

### PHASE 2: MINDFUL EXECUTION

Execute each step with full presence and intelligence:

**BEFORE EVERY ACTION:**
- What exactly am I trying to accomplish right now?
- Is this the smartest way to achieve this outcome?
- What should I be watching for as I take this action?

**DURING EXECUTION:**
- Stay present and observant
- Notice what's actually happening, not what you expected
- Adapt your approach if the situation differs from your plan

**AFTER EVERY SIGNIFICANT ACTION:**
- What did I just learn?
- Does this change my understanding or my plan?
- What do I need to remember for later steps?

## ⚠️ CRITICAL: YOUR MEMORY SYSTEM (LIKE MEMENTO)

**YOUR MEMORY GETS WIPED AFTER EACH STEP.**

Think of yourself like the protagonist in Memento - after each major step, your detailed memory gets reset. This means:

**WHAT GETS PRESERVED:**
- Your current state tracker (below)
- Your action history log
- Your preserved intelligence notes
- Your navigation state

**WHAT GETS WIPED:**
- DOM snapshots from previous pages
- Detailed conversation context beyond your structured notes
- Specific UI layouts you're no longer looking at
- Intermediate observations not explicitly saved

**SURVIVAL STRATEGY:**
If there's information you'll need later in the workflow - WRITE IT DOWN NOW in your preserved intelligence section. Don't assume you'll remember content, login patterns, or UI behaviors unless you explicitly document them.

## YOUR CONTEXT MANAGEMENT SYSTEM

You must ALWAYS maintain and update this structured context in your responses:

### CURRENT STATE AWARENESS
Always know:
```
CURRENT TASK: [What specific step am I executing right now?]
CURRENT LOCATION: [Where am I in the system/website/interface?]
CURRENT OBJECTIVE: [What specific outcome am I working toward in this step?]
```

### COMPLETE ACTION HISTORY (NEVER WIPED)
Track everything you've done:
```
ACTION HISTORY:
1. [First action taken] → [What happened/was observed]
2. [Second action] → [Result/observation]
3. [Third action] → [Current state]
...
[Continue chronologically for entire workflow]
```

### PRESERVED INTELLIGENCE (YOUR SURVIVAL NOTES)
Capture and maintain critical information:
```
WORKFLOW PROGRESS:
- Overall progress: [X of Y major steps complete]
- Key discoveries: [Important findings that affect later steps]
- Successful patterns: [UI behaviors, navigation routes that worked]
- Data collected: [Structured information for the final objective]

NAVIGATION STATE:
- Current location: [Specific page/interface I'm on]
- How I got here: [Key navigation path to reproduce]
- How to get back: [Return path to previous stable state]

CRITICAL INFORMATION FOR LATER STEPS:
- [Any data, patterns, or insights you'll need but might not remember]
- [Login credentials or authentication patterns that worked]
- [Specific data extracted that must be preserved for final outcome]
```

## YOUR ESCALATION WISDOM - ASK EARLY AND OFTEN

**ESCALATE WITH HIGH FREQUENCY:**
You are strongly encouraged to seek human guidance whenever your confidence drops below 90%. Better to ask early than to make mistakes or waste time being uncertain.

**WHEN TO SEEK HUMAN GUIDANCE (LOW THRESHOLD):**
- Authentication requires information you don't have (only if sensitive_data doesn't contain needed credentials)
- The task objective becomes even slightly ambiguous or unclear
- You encounter any technical barriers beyond simple troubleshooting
- You need to make business decisions or interpret business context
- You're uncertain about data privacy or security implications
- **You're not 100% sure how to interpret or process specific information**
- **The workflow behavior seems different than expected**
- **You're unsure about the best approach between multiple options**

## RESPONSE FORMAT

You must ALWAYS respond with valid JSON in this exact format:
{
  "current_state": {
    "evaluation_previous_goal": "Success|Failed|Unknown - Analyze the current elements and image to check if previous goals/actions were successful. Mention if something unexpected happened.",
    "memory": "STRUCTURED CONTEXT - Update your survival documentation here following the sections above",
    "next_goal": "What needs to be done with the next immediate action"
  },
  "action": [{"action_name": {"parameter": "value"}}]
}

## YOUR SUCCESS PRINCIPLES

**PRECISION OVER SPEED:** Take time to do things right
**UNDERSTANDING OVER COMPLIANCE:** Prioritize intent over mechanical following
**DOCUMENTATION OVER MEMORY:** Document everything important for survival
**EARLY ESCALATION OVER UNCERTAINTY:** Ask for help when confidence wavers (but use available credentials first)
**LEARNING OVER REPETITION:** Each workflow is an opportunity to become more intelligent

Remember: You are capable of remarkable precision and adaptation, but your memory is fragile. Trust your intelligence, use your reasoning, document everything critical, use available credentials before asking for help, and create excellent outcomes through thoughtful action.'''

    async def run(self, max_steps: Optional[int] = None) -> Any:
        """
        Run the intelligent agent with memory-wiping between steps
        """
        max_steps = max_steps or self.max_steps
        
        logger.info(f"🧠 Starting Intelligent Browser Agent")
        logger.info(f"📋 Task: {self.task}")
        logger.info(f"⚠️ Memory-wiping mode: Context survival strategy active")
        
        try:
            # Initialize the browser session
            await self.browser_agent.browser_session.start()
            
            for step in range(max_steps):
                self.step_count = step + 1
                logger.info(f"\n🔄 Step {self.step_count}/{max_steps}")
                
                # Log what the agent is working with before the step
                self._log_agent_working_context()
                
                # Inject survived context before each step
                await self._inject_survived_context()
                
                # Execute one step with browser-use
                await self.browser_agent.step()
                
                # Extract and preserve critical context after step
                await self._extract_and_preserve_context()
                
                # Implement memory wipe (clear browser-use's message history)
                await self._wipe_memory()
                
                # Check if task is complete
                if self._is_task_complete():
                    logger.info("✅ Task completed successfully!")
                    break
                    
                # Small delay between steps for stability
                await asyncio.sleep(1)
                
        except Exception as e:
            logger.error(f"❌ Error during execution: {e}")
            raise
        finally:
            # Close browser session
            await self.browser_agent.browser_session.close()
            
        return self.browser_agent.state.history

    def _log_agent_working_context(self):
        """Log what context the agent is working with (excluding system prompt)"""
        
        logger.info("📋 AGENT WORKING CONTEXT:")
        logger.info("=" * 60)
        
        # Current State Awareness
        logger.info("🎯 CURRENT STATE AWARENESS:")
        logger.info(f"   Task: {self.survived_context.current_task}")
        logger.info(f"   Location: {self.survived_context.current_location or '(not set)'}")
        logger.info(f"   Objective: {self.survived_context.current_objective or '(not set)'}")
        
        # Action History
        logger.info(f"\n📜 ACTION HISTORY ({len(self.survived_context.action_history)} actions):")
        if self.survived_context.action_history:
            for i, action in enumerate(self.survived_context.action_history[-3:], 1):  # Show last 3
                logger.info(f"   {len(self.survived_context.action_history) - 3 + i}. {action}")
            if len(self.survived_context.action_history) > 3:
                logger.info(f"   ... (showing last 3 of {len(self.survived_context.action_history)} total)")
        else:
            logger.info("   (no actions yet)")
        
        # Preserved Intelligence - only show if there's content
        intelligence_sections = [
            ("🗺️ WORKFLOW PROGRESS", self.survived_context.workflow_progress),
            ("🧭 NAVIGATION STATE", self.survived_context.navigation_state),
            ("🔍 KEY DISCOVERIES", self.survived_context.key_discoveries),
            ("✅ SUCCESSFUL PATTERNS", self.survived_context.successful_patterns),
            ("📊 DATA COLLECTED", self.survived_context.data_collected),
            ("⚠️ CRITICAL INFORMATION", self.survived_context.critical_information)
        ]
        
        has_intelligence = any(section[1] for section in intelligence_sections)
        
        if has_intelligence:
            logger.info("\n🧠 PRESERVED INTELLIGENCE (SURVIVAL NOTES):")
            for title, content in intelligence_sections:
                if content:
                    # Truncate long content for readability
                    display_content = content[:150] + "..." if len(content) > 150 else content
                    logger.info(f"   {title}:")
                    logger.info(f"      {display_content}")
        else:
            logger.info("\n🧠 PRESERVED INTELLIGENCE: (no survival notes yet)")
        
        logger.info("=" * 60)

    async def _inject_survived_context(self):
        """Inject the survived context into the agent's message manager before each step"""
        
        # Create context message with survived information
        context_content = f"""
SURVIVED CONTEXT FROM PREVIOUS STEPS:

CURRENT STATE AWARENESS:
- CURRENT TASK: {self.survived_context.current_task}
- CURRENT LOCATION: {self.survived_context.current_location}
- CURRENT OBJECTIVE: {self.survived_context.current_objective}

COMPLETE ACTION HISTORY (NEVER WIPED):
{chr(10).join(f"{i+1}. {action}" for i, action in enumerate(self.survived_context.action_history))}

PRESERVED INTELLIGENCE (SURVIVAL NOTES):
WORKFLOW PROGRESS: {self.survived_context.workflow_progress}
NAVIGATION STATE: {self.survived_context.navigation_state}
KEY DISCOVERIES: {self.survived_context.key_discoveries}
SUCCESSFUL PATTERNS: {self.survived_context.successful_patterns}
DATA COLLECTED: {self.survived_context.data_collected}
CRITICAL INFORMATION: {self.survived_context.critical_information}

Remember: Your detailed memory from previous steps has been wiped. Only the above structured context survives. Use this information to continue the workflow intelligently.
"""
        
        # Add context message to message manager
        context_message = HumanMessage(content=context_content)
        self.browser_agent._message_manager._add_message_with_tokens(
            context_message, message_type='context'
        )

    async def _extract_and_preserve_context(self):
        """Extract critical context from the last step and preserve it in survived_context"""
        
        logger.info("🔄 EXTRACTING CONTEXT FROM AGENT RESPONSE...")
        
        # Get the last model output if available
        last_messages = self.browser_agent._message_manager.get_messages()
        last_ai_message = None
        
        # Find the most recent AI message with structured output
        for message in reversed(last_messages):
            if isinstance(message, AIMessage) and hasattr(message, 'tool_calls') and message.tool_calls:
                try:
                    tool_call = message.tool_calls[0]
                    if tool_call.get('name') == 'AgentOutput':
                        last_ai_message = tool_call.get('args', {})
                        break
                except:
                    continue
        
        if last_ai_message and 'current_state' in last_ai_message:
            current_state = last_ai_message['current_state']
            
            # Log what we're extracting
            logger.info("📝 AGENT PROVIDED SURVIVAL DOCUMENTATION:")
            memory_content = current_state.get('memory', '')
            if memory_content:
                # Show a preview of the memory content
                preview = memory_content[:200] + "..." if len(memory_content) > 200 else memory_content
                logger.info(f"   Memory Content: {preview}")
            else:
                logger.info("   ⚠️ No memory content provided by agent")
            
            # Extract and preserve memory content
            self._parse_and_update_survived_context(memory_content)
            
            # Update current state from the response
            if 'CURRENT TASK:' in memory_content:
                self._extract_current_state_from_memory(memory_content)
            
            # Add action to history
            action_description = f"Step {self.step_count}: {current_state.get('next_goal', 'Action executed')}"
            if 'action' in last_ai_message and last_ai_message['action']:
                actions = last_ai_message['action']
                action_names = [list(action.keys())[0] for action in actions if action]
                action_description += f" → Actions: {', '.join(action_names)}"
            
            self.survived_context.action_history.append(action_description)
            
            logger.info(f"✅ Context preserved. Action history now has {len(self.survived_context.action_history)} entries")
        else:
            logger.warning("⚠️ No structured AI response found to extract context from")

    def _parse_and_update_survived_context(self, memory_content: str):
        """Parse structured sections from memory content and update survived context"""
        
        sections = {
            'WORKFLOW PROGRESS:': 'workflow_progress',
            'NAVIGATION STATE:': 'navigation_state', 
            'KEY DISCOVERIES:': 'key_discoveries',
            'SUCCESSFUL PATTERNS:': 'successful_patterns',
            'DATA COLLECTED:': 'data_collected',
            'CRITICAL INFORMATION:': 'critical_information'
        }
        
        sections_updated = []
        
        for section_marker, attr_name in sections.items():
            if section_marker in memory_content:
                start_idx = memory_content.find(section_marker) + len(section_marker)
                
                # Find the end of this section (next section or end of string)
                end_idx = len(memory_content)
                for other_marker in sections.keys():
                    if other_marker != section_marker:
                        other_idx = memory_content.find(other_marker, start_idx)
                        if other_idx != -1 and other_idx < end_idx:
                            end_idx = other_idx
                
                section_content = memory_content[start_idx:end_idx].strip()
                setattr(self.survived_context, attr_name, section_content)
                if section_content:  # Only log if there's actual content
                    sections_updated.append(section_marker.rstrip(':'))
        
        if sections_updated:
            logger.info(f"📋 Updated survival sections: {', '.join(sections_updated)}")

    def _extract_current_state_from_memory(self, memory_content: str):
        """Extract current state information from memory content"""
        
        lines = memory_content.split('\n')
        for line in lines:
            line = line.strip()
            if line.startswith('CURRENT TASK:'):
                self.survived_context.current_task = line[13:].strip()
            elif line.startswith('CURRENT LOCATION:'):
                self.survived_context.current_location = line[17:].strip()
            elif line.startswith('CURRENT OBJECTIVE:'):
                self.survived_context.current_objective = line[18:].strip()

    async def _wipe_memory(self):
        """Wipe the agent's detailed memory while preserving only essential state"""
        
        # Clear browser-use's message history except for system prompt
        message_manager = self.browser_agent._message_manager
        
        # Keep only the system message and rebuild minimal state
        system_message = None
        for msg in message_manager.state.history.messages:
            if isinstance(msg.message, SystemMessage):
                system_message = msg
                break
        
        if system_message:
            # Reset message history to just system message
            message_manager.state.history.messages = [system_message]
            message_manager.state.history.current_tokens = system_message.metadata.tokens
        else:
            # If no system message found, reset completely
            message_manager.state.history.messages = []
            message_manager.state.history.current_tokens = 0
            
        # Reset tool ID counter
        message_manager.state.tool_id = 1
        
        logger.info("🧹 Memory wiped - only survived context preserved")

    def _is_task_complete(self) -> bool:
        """Check if the task is complete based on the last action"""
        
        if self.browser_agent.state.last_result:
            for result in self.browser_agent.state.last_result:
                if result.is_done:
                    return True
                    
        return False

    async def get_survived_context(self) -> SurvivedContext:
        """Get the current survived context for inspection"""
        return self.survived_context

    def log_context_summary(self):
        """Log a summary of the current survived context"""
        logger.info("📊 Survived Context Summary:")
        logger.info(f"   📍 Current Location: {self.survived_context.current_location}")
        logger.info(f"   🎯 Current Objective: {self.survived_context.current_objective}")
        logger.info(f"   📜 Action History: {len(self.survived_context.action_history)} actions")
        logger.info(f"   📈 Progress: {self.survived_context.workflow_progress[:100]}...")


# Example usage and testing function
async def test_intelligent_browser_agent():
    """Test function to demonstrate the intelligent browser agent"""
    
    from langchain_openai import ChatOpenAI
    
    # Example task
    task = "Navigate to Google, search for 'browser automation tools', and extract the top 3 results with their descriptions"
    
    # Create LLM (you'll need to set OPENAI_API_KEY)
    llm = ChatOpenAI(model="gpt-4o", temperature=0)
    
    # Create intelligent browser agent
    agent = IntelligentBrowserAgent(
        task=task,
        llm=llm,
        max_steps=10,
        use_vision=True
    )
    
    try:
        # Run the agent
        result = await agent.run()
        
        # Log final context
        agent.log_context_summary()
        
        return result
        
    except Exception as e:
        logger.error(f"Test failed: {e}")
        raise


if __name__ == "__main__":
    # Run test
    asyncio.run(test_intelligent_browser_agent()) 