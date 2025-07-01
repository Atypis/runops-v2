#!/usr/bin/env python3
"""
REAL Browser-Use test - Agent navigates to Google and documents DOM selectors
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
from browser_use.llm.openai.chat import ChatOpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


async def main():
    print("🌐 Google DOM Extraction with Scout Enhancement")
    print("=" * 60)
    
    # Check for OpenAI key
    if not os.environ.get('OPENAI_API_KEY'):
        print("\n❌ Error: OPENAI_API_KEY not set!")
        print("Please set it with: export OPENAI_API_KEY='your-key-here'")
        return
    
    # Apply Scout patch
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    print(f"\n✅ Scout patch active")
    print(f"📊 {len(browser_use_patch.SCOUT_WHITELIST)} attributes visible (vs {len(browser_use_patch.BROWSER_USE_DEFAULTS)} default)")
    
    print("\nScout reveals these additional attributes:")
    for attr in ['id', 'data-testid', 'data-qa', 'href', 'data-automation']:
        print(f"  - {attr}")
    print(f"  ... and {len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES) - 5} more")
    
    # Create LLM - use gpt-4o which works well
    llm = ChatOpenAI(model='gpt-4o')
    
    # Create Scout agent
    print("\nCreating Scout agent...")
    agent = ScoutAgent(
        task="""Navigate to google.com and analyze the "Auf gut Glück!" button (I'm Feeling Lucky button).
        
        Create a file called 'google_dom_analysis.md' that lists:
        1. ALL DOM attributes visible on the "Auf gut Glück!" button
        2. Include EVERY attribute you can see: id, name, class, type, role, aria-*, data-*, etc.
        3. List the actual values for each attribute
        4. Compare what selectors would be available for automation
        
        Be very specific and thorough in documenting every single attribute visible.""",
        llm=llm,
        use_vision=True  # Enable screenshots for better analysis
    )
    
    # Run the agent
    print("\nRunning agent...")
    print("(This will navigate to Google and analyze the 'Auf gut Glück!' button DOM)\n")
    
    result = await agent.run(max_steps=5)
    
    print(f"\n✅ Complete!")
    print(f"   Success: {result.is_successful()}")
    print(f"   Steps taken: {result.number_of_steps()}")
    
    # Show any errors
    if result.has_errors():
        print("\nErrors encountered:")
        for i, error in enumerate(result.errors()):
            if error:
                print(f"  Step {i+1}: {error}")
    
    # Show extracted content
    if result.extracted_content():
        print("\nExtracted content:")
        for content in result.extracted_content():
            print(f"  {content[:100]}..." if len(content) > 100 else f"  {content}")
    
    print("\n📄 Check 'google_dom_analysis.md' for the full DOM analysis")
    
    # Also try to read the file if it was created
    # Get the file system path from the agent
    fs_path = getattr(agent.file_system, 'path', None) or getattr(agent.file_system, '_path', None)
    if fs_path:
        file_path = os.path.join(fs_path, 'google_dom_analysis.md')
    else:
        file_path = 'google_dom_analysis.md'
    if os.path.exists(file_path):
        print("\nPreview of analysis:")
        print("-" * 60)
        with open(file_path, 'r') as f:
            preview = f.read()[:500]
            print(preview)
        print("..." if len(preview) == 500 else "")
    
    # Clean up
    if hasattr(agent, 'browser_session') and agent.browser_session:
        await agent.browser_session.close()


if __name__ == "__main__":
    asyncio.run(main())