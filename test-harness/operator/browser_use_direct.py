"""
Direct Browser-Use - Just write what you see
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
2. Write EXACTLY what you see in the DOM/accessibility tree to results.md
3. Include EVERYTHING - all the elements, indexes, formatting, the whole thing
""",
        llm=llm
    )
    
    await agent.run()

if __name__ == "__main__":
    asyncio.run(main())