#!/usr/bin/env python3
"""
Live test of Scout-enhanced Browser-Use on Google.com
Extracts all DOM selectors for the search component
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Scout components
from scouts.scout_agent import ScoutAgent
from scouts import browser_use_patch

# Import Browser-Use components
from browser_use import Browser
from browser_use.browser.browser import BrowserConfig

# You'll need to set up your LLM
from browser_use.llm.openai import ChatOpenAI


async def extract_google_search_selectors():
    """Extract all visible selectors for Google's search component"""
    print("🔍 Scout Live Test: Google Search Component")
    print("=" * 60)
    
    # Initialize LLM (you'll need to set OPENAI_API_KEY)
    llm = ChatOpenAI(model='gpt-4o-mini')
    
    print("\n1. Creating Scout-enhanced agent...")
    print(f"   Scout patch active: {browser_use_patch.is_patched()}")
    print(f"   Total attributes visible: {len(browser_use_patch.SCOUT_WHITELIST)}")
    
    # Create Scout agent
    agent = ScoutAgent(
        task="""Go to google.com and extract ALL DOM selectors you can see for the main search input field. 
        List every single attribute you can see including id, name, class, data-* attributes, aria-* attributes, etc.
        Focus specifically on the search box/textarea element.""",
        llm=llm,
        use_vision=True,  # Enable screenshot analysis
        max_actions_per_step=5
    )
    
    print("\n2. Running reconnaissance mission...")
    try:
        # Run the agent
        result = await agent.run(max_steps=3)
        
        print("\n3. Mission Results:")
        print(f"   Success: {result.is_successful()}")
        print(f"   Steps taken: {result.number_of_steps()}")
        
        # Print the extracted content
        if result.extracted_content():
            print("\n4. Extracted Selectors:")
            print("-" * 60)
            for content in result.extracted_content():
                print(content)
            print("-" * 60)
        
        # Also print the model's thoughts
        print("\n5. Agent's Analysis:")
        for thought in result.model_thoughts():
            if thought.next_goal:
                print(f"   Goal: {thought.next_goal}")
            if thought.memory:
                print(f"   Memory: {thought.memory}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up
        if hasattr(agent, 'browser_session') and agent.browser_session:
            await agent.browser_session.close()


async def manual_dom_extraction():
    """Manually extract DOM to show the difference"""
    print("\n\n🔬 Manual DOM Extraction Comparison")
    print("=" * 60)
    
    # Create browser instance
    browser_config = BrowserConfig(headless=False)  # Set to False to see the browser
    browser = Browser(browser_config)
    
    try:
        # Create session and navigate
        session = await browser.new_session()
        context = await session.new_context()
        page = await context.new_page()
        
        print("\n1. Navigating to google.com...")
        await page.goto("https://www.google.com", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)  # Wait for dynamic content
        
        # Get the page's DOM state
        from browser_use.controller.service import Controller
        controller = Controller()
        controller.browser = browser
        controller.context = context  
        controller.page = page
        
        print("\n2. Extracting DOM state...")
        browser_state = await controller.get_browser_state()
        
        # Convert to string with Scout attributes
        print("\n3. DOM with Scout attributes:")
        print("-" * 60)
        dom_string = browser_state.element_tree.clickable_elements_to_string(
            include_attributes=browser_use_patch.SCOUT_WHITELIST
        )
        
        # Find and print search-related elements
        lines = dom_string.split('\n')
        search_elements = []
        for line in lines:
            if any(keyword in line.lower() for keyword in ['search', 'q', 'query', 'combobox', 'textbox']):
                search_elements.append(line.strip())
        
        if search_elements:
            print("Search-related elements found:")
            for elem in search_elements[:10]:  # Limit to first 10
                print(f"  {elem}")
        else:
            print("No search elements found in filtered view")
        
        print("-" * 60)
        
        # Also show what it would look like without Scout
        print("\n4. DOM without Scout (Browser-Use defaults only):")
        print("-" * 60)
        dom_string_default = browser_state.element_tree.clickable_elements_to_string(
            include_attributes=browser_use_patch.BROWSER_USE_DEFAULTS
        )
        
        # Find search elements in default view
        lines_default = dom_string_default.split('\n')
        search_elements_default = []
        for line in lines_default:
            if any(keyword in line.lower() for keyword in ['search', 'q', 'query', 'combobox', 'textbox']):
                search_elements_default.append(line.strip())
        
        if search_elements_default:
            print("Search-related elements (default attributes):")
            for elem in search_elements_default[:10]:
                print(f"  {elem}")
        print("-" * 60)
        
        # Show the difference
        print("\n5. Attribute Visibility Comparison:")
        print(f"   With Scout: Found {len(search_elements)} search elements")
        print(f"   Without Scout: Found {len(search_elements_default)} search elements")
        
        await session.close()
        
    except Exception as e:
        print(f"\n❌ Error in manual extraction: {e}")
        import traceback
        traceback.print_exc()


async def main():
    """Run both automated and manual extraction"""
    print("🚀 Google Search Component Selector Extraction")
    print("=" * 80)
    
    # Check if API key is set
    if not os.environ.get('OPENAI_API_KEY'):
        print("\n⚠️  Warning: OPENAI_API_KEY not set!")
        print("   Set it with: export OPENAI_API_KEY='your-key-here'")
        print("\n   Skipping automated extraction, running manual extraction only...")
        
        # Run manual extraction only
        await manual_dom_extraction()
    else:
        # Run automated extraction
        await extract_google_search_selectors()
        
        # Also run manual extraction for comparison
        await manual_dom_extraction()
    
    print("\n✅ Test completed!")


if __name__ == "__main__":
    # Ensure Scout patch is applied
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    asyncio.run(main())