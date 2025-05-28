import asyncio
from dotenv import load_dotenv
load_dotenv()

# Test with a simple example
async def main():
    try:
        from browser_use import Agent
        from langchain_google_genai import ChatGoogleGenerativeAI
        
        print("✅ browser-use imported successfully!")
        print("✅ langchain_google_genai imported successfully!")
        
        # Check for Google API key
        if not os.getenv("GOOGLE_API_KEY"):
            print("⚠️  Please add your GOOGLE_API_KEY to the .env file to run the full example")
            print("For now, just testing imports...")
            return
            
        # Create the agent with Google's Gemini Flash model
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            temperature=0.1,
        )
        
        agent = Agent(
            task="Go to google.com and search for 'hello world', then tell me what you found",
            llm=llm,
        )
        print("✅ Agent created successfully!")
        print("🚀 Starting browser automation...")
        
        # Run the agent!
        await agent.run()
        
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    import os
    asyncio.run(main()) 