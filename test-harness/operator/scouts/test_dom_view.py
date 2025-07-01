"""
Test script to see exactly what browser-use LLM sees
"""

import asyncio
import sys
from pathlib import Path

# Add browser-use to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'browser-use'))

from browser_use import Agent
from browser_use.browser import BrowserProfile, BrowserSession
from browser_use.llm import ChatOpenAI
import os

# API key should be set in environment before running
# e.g., export OPENAI_API_KEY="your-api-key"


async def capture_dom_view():
    """Navigate to Google and capture what the LLM sees"""
    
    print("🔍 Browser-use DOM View Test")
    print("=" * 50)
    
    # Configure LLM
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=os.getenv("OPENAI_API_KEY")
    )
    
    # Configure browser session
    browser_session = BrowserSession(
        browser_profile=BrowserProfile(
            headless=False,
            viewport_expansion=0,
        )
    )
    
    # Simple task that will force the agent to see the DOM
    task = """Navigate to google.com and search for 'dog'. 
    
    IMPORTANT: After navigating to google.com but BEFORE searching, please describe EXACTLY what you see in the DOM. 
    Print out the first 50 lines of elements you can see, including their index numbers and exact format.
    
    Use this exact format:
    "I see the following elements:
    [copy the exact element representations here]"
    
    Then proceed to search for 'dog'."""
    
    # Create agent
    agent = Agent(
        task=task,
        llm=llm,
        browser_session=browser_session,
        max_actions_per_step=3
    )
    
    try:
        print("\n🚀 Starting browser-use agent...")
        print("📸 Watch what the LLM sees when it looks at Google\n")
        
        # Run the agent
        result = await agent.run(max_steps=5)
        
        print("\n✅ Task complete!")
        print("\n📊 Agent's observations:")
        print("-" * 50)
        
        # The agent's descriptions will be in the console output
        # Let's also try to capture from the agent's history
        if hasattr(result, 'all_results'):
            for i, action_result in enumerate(result.all_results[:5]):
                if action_result.extracted_content:
                    print(f"\nStep {i+1}: {action_result.extracted_content[:500]}")
        
        return result
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        raise


if __name__ == "__main__":
    asyncio.run(capture_dom_view())