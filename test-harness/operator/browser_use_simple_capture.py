"""
Browser-Use Simple Capture
Just navigate and capture what the agent sees
"""
import asyncio
from browser_use import Agent
from browser_use.browser import BrowserSession
from browser_use.llm import ChatGoogle
import sys
import os

# Add browser-use to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../browser-use'))

async def capture_browser_use_view():
    """Capture Browser-Use's view"""
    
    print("🔍 Browser-Use Simple Capture Starting...")
    print("=" * 80)
    
    # Initialize Gemini model
    llm = ChatGoogle(
        model='gemini-2.0-flash', 
        api_key="AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs"
    )
    
    # Create a browser session
    browser_session = BrowserSession(
        headless=False,
    )
    
    # Create agent with simple task
    agent = Agent(
        task="Go to google.com",
        llm=llm,
        browser_session=browser_session,
        use_vision=True,  # Enable vision to see what agent sees
        message_context="IMPORTANT: Include in your response the EXACT DOM/accessibility tree representation you see.",
        max_actions_per_step=1
    )
    
    try:
        # Run just one step
        result = await agent.run(max_steps=2)
        
        # Get the agent's history
        history = agent.state.history.history
        
        # Save the complete interaction
        output = "BROWSER-USE CAPTURE\n" + "=" * 80 + "\n\n"
        
        for i, step in enumerate(history):
            output += f"\n--- STEP {i+1} ---\n"
            if hasattr(step, 'state') and step.state:
                output += f"URL: {step.state.url}\n"
                output += f"Title: {step.state.title}\n"
                output += f"Tabs: {step.state.tabs}\n"
                output += f"Interactive Elements: {len(step.state.selector_map) if step.state.selector_map else 0}\n"
            
            if hasattr(step, 'model_output') and step.model_output:
                output += f"\nAgent Thinking: {step.model_output.current_state.thinking}\n"
                output += f"Evaluation: {step.model_output.current_state.evaluation_previous_goal}\n"
                output += f"Memory: {step.model_output.current_state.memory}\n"
                output += f"Next Goal: {step.model_output.current_state.next_goal}\n"
        
        output += f"\n\nFinal Result: {result}\n"
        
        # Save to file
        with open('browser_use_capture.txt', 'w') as f:
            f.write(output)
        
        print("\n✅ Browser-Use capture saved to browser_use_capture.txt")
        print(output[:500] + "...")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
    
    finally:
        if browser_session:
            await browser_session.close()

if __name__ == "__main__":
    asyncio.run(capture_browser_use_view())