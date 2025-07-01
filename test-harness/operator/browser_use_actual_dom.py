"""
Get the ACTUAL DOM that Browser-Use shows to the LLM
"""
import asyncio
from browser_use import Agent
from browser_use.llm import ChatGoogle

async def main():
    llm = ChatGoogle(
        model='gemini-2.0-flash', 
        api_key="AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs"
    )
    
    agent = Agent(
        task="""
1. Go to google.com
2. In your NEXT response, copy EXACTLY the browser_state section you see - the part that shows "Interactive elements from top layer of the current page inside the viewport"
3. Write that ENTIRE section to results.md - include all the [numbers], tags, everything exactly as you see it
4. Don't use get_ax_tree - I want the actual DOM representation with [0], [1], etc that you see
""",
        llm=llm
    )
    
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())