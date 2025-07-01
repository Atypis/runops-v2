"""
Browser-Use POV Test
Captures the exact accessibility tree/DOM representation that Browser-Use sends to the LLM
"""
import asyncio
from browser_use import Agent
from langchain_google_genai import ChatGoogleGenerativeAI
import sys
import os

# Add browser-use to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../browser-use'))

async def get_browser_use_pov():
    """Get Browser-Use's view of google.com"""
    
    print("🔍 Browser-Use POV Test Starting...")
    print("=" * 80)
    
    # Initialize Gemini model
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash-exp",
        google_api_key="AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs",
        temperature=0  # Ensure consistent output
    )
    
    # Create a browser session with config
    from browser_use.browser import BrowserSession
    browser_session = BrowserSession(
        headless=False,  # Show browser for debugging
    )
    
    # Create agent with verbatim extraction task
    agent = Agent(
        task="""Navigate to google.com and then output the EXACT accessibility tree/DOM representation you see, including:
- All element indexes/numbers in square brackets like [0], [1], etc.
- Exact formatting and indentation as shown to you
- Every single element visible to you (interactive and non-interactive)
- Any special markers (like asterisks for new elements)
- The complete hierarchical structure
- Do not summarize, interpret, or skip anything
- Output everything inside a code block
- Add '=== END OF TREE ===' when complete

Start with '=== BROWSER-USE ACCESSIBILITY TREE ===' before the code block.""",
        llm=llm,
        browser_session=browser_session
    )
    
    try:
        # Run the agent
        result = await agent.run()
        
        # Save to file
        with open('browser_use_tree.txt', 'w') as f:
            f.write("BROWSER-USE POV TEST RESULTS\n")
            f.write("=" * 80 + "\n")
            f.write(result)
        
        print("\n✅ Browser-Use POV captured successfully!")
        print(f"📄 Saved to: browser_use_tree.txt")
        print("\n" + "=" * 80)
        print("CAPTURED OUTPUT:")
        print("=" * 80)
        print(result)
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        if hasattr(agent, 'browser'):
            await agent.browser.close()
        elif browser_session:
            await browser_session.close()

if __name__ == "__main__":
    asyncio.run(get_browser_use_pov())