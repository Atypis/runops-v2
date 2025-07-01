#!/usr/bin/env python3
"""
Simple test - Agent goes to Google and saves DOM selectors to results.md
"""

import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Scout components
from scouts import browser_use_patch
from scouts.scout_agent import ScoutAgent

# Import Browser-Use components
from browser_use.llm.base import BaseChatModel
from browser_use.llm.views import ChatInvokeCompletion
from browser_use.llm.messages import BaseMessage
from browser_use.agent.views import AgentOutput


class SimpleGoogleLLM(BaseChatModel):
    """LLM that navigates to Google and saves DOM info"""
    
    model: str = "google-dom-extractor"
    _step_count: int = 0
    
    @property
    def provider(self) -> str:
        return "mock"
    
    async def ainvoke(
        self, 
        messages: list[BaseMessage], 
        output_format=None
    ) -> ChatInvokeCompletion:
        self._step_count += 1
        
        if self._step_count == 1:
            # Navigate to Google
            response = AgentOutput(
                thinking="I need to navigate to Google.com",
                evaluation_previous_goal="Starting task",
                memory="No actions yet",
                next_goal="Navigate to Google.com",
                action=[{
                    "go_to_url": {"url": "https://www.google.com"}
                }]
            )
        elif self._step_count == 2:
            # Save search box DOM to file
            response = AgentOutput(
                thinking="Now I'll document all the DOM selectors I can see for the search input",
                evaluation_previous_goal="Successfully navigated to Google.com",
                memory="At Google.com homepage",
                next_goal="Document all visible DOM selectors for the search component",
                action=[{
                    "write_file": {
                        "path": "results.md",
                        "content": """# Google Search Component DOM Analysis

## Search Input Element

Looking at the main search input element on Google.com, here are ALL the DOM selectors and attributes I can see:

[I will now list every single attribute visible on the search input element, including id, name, class, data-* attributes, aria-* attributes, etc.]

Please check the actual DOM elements visible on the page and list them here.
"""
                    }
                }]
            )
        else:
            # Done
            response = AgentOutput(
                thinking="Task complete",
                evaluation_previous_goal="Documented DOM selectors",
                memory="Navigated to Google and saved DOM analysis",
                next_goal="Complete",
                action=[{
                    "done": {"summary": "DOM selectors saved to results.md"}
                }]
            )
        
        return ChatInvokeCompletion(
            model_response=response if output_format else str(response),
            prompt_tokens=100,
            completion_tokens=100,
            total_tokens=200
        )


async def main():
    print("🌐 Google DOM Extraction Test")
    print("=" * 60)
    
    # Apply Scout patch
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    print(f"✅ Scout patch active")
    print(f"📊 {len(browser_use_patch.SCOUT_WHITELIST)} attributes visible")
    
    # Create agent
    print("\nCreating agent...")
    agent = ScoutAgent(
        task="""Go to google.com and find the main search input box (where users type their queries).
        
        Write a detailed analysis to results.md listing EVERY SINGLE DOM attribute you can see on that search element.
        Include: id, name, class, type, role, aria-* attributes, data-* attributes, and any other attributes visible.
        
        Be very specific and list the actual attribute values you see.""",
        llm=SimpleGoogleLLM(),
        use_vision=False
    )
    
    # Run agent
    print("Running agent...")
    result = await agent.run(max_steps=3)
    
    print(f"\n✅ Complete! Check results.md for the DOM analysis")
    print(f"Steps taken: {result.number_of_steps()}")
    
    # Clean up
    if hasattr(agent, 'browser_session') and agent.browser_session:
        await agent.browser_session.close()


if __name__ == "__main__":
    asyncio.run(main())