"""
Side-by-side DOM comparison: Browser-use vs Stagehand
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

# Use environment variable for API key
# Set OPENAI_API_KEY in your environment before running this script


async def capture_browser_use_dom():
    """Capture DOM as browser-use sees it"""
    
    print("\n" + "="*80)
    print("BROWSER-USE DOM VIEW")
    print("="*80)
    
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=os.getenv("OPENAI_API_KEY")
    )
    
    browser_session = BrowserSession(
        browser_profile=BrowserProfile(
            headless=False,
            viewport_expansion=0,
        )
    )
    
    task = """Navigate to google.com and search for 'dog'. 
    
    AFTER the search results load, print EXACTLY what you see in the DOM.
    Print the first 40 elements with their exact format and indices.
    
    Format:
    "DOM elements on search results page:
    [0]<element>
    [1]<element>
    ..."
    
    Be very precise about the format."""
    
    agent = Agent(
        task=task,
        llm=llm,
        browser_session=browser_session,
        max_actions_per_step=3
    )
    
    try:
        print("\n🚀 Running browser-use agent...")
        result = await agent.run(max_steps=10)
        
        # Save any output files
        if hasattr(result, 'all_results'):
            with open('browser_use_dom.txt', 'w') as f:
                for action in result.all_results:
                    if action.extracted_content:
                        f.write(str(action.extracted_content) + '\n')
        
        print("\n✅ Browser-use capture complete")
        return result
        
    except Exception as e:
        print(f"\n❌ Browser-use error: {str(e)}")
        raise


async def main():
    """Run both captures"""
    print("🔍 DOM Comparison Test: Browser-use vs Stagehand")
    print("Target: Google search results for 'dog'")
    
    # Run browser-use
    await capture_browser_use_dom()
    
    print("\n" + "="*80)
    print("COMPARISON NOTES:")
    print("="*80)
    print("1. Browser-use format: [index]<element>")
    print("2. Stagehand format: index:<element>text</element> or index:text")
    print("3. Key difference: Stagehand gives separate indices to text nodes")
    print("4. Same button might be index [5] in browser-use but index 12 in Stagehand")
    print("\nCheck the console output above to see the actual DOM representations!")


if __name__ == "__main__":
    asyncio.run(main())