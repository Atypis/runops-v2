#!/usr/bin/env python3
"""
REAL Browser-Use test - actually navigates to a website and extracts DOM
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
from browser_use import Agent
from browser_use.browser.session import BrowserSession


# Create a minimal mock LLM that just returns done
class MinimalLLM:
    """Minimal LLM that immediately returns done action"""
    
    async def ainvoke(self, messages, response_format=None, **kwargs):
        # Return a done action immediately
        return {
            "thinking": "Extracting DOM information",
            "evaluation_previous_goal": "Starting DOM extraction", 
            "memory": "Need to extract DOM",
            "next_goal": "Complete extraction",
            "action": [{
                "done": {
                    "summary": "DOM extraction complete"
                }
            }]
        }


async def real_browser_test():
    """Test with a real Browser-Use agent"""
    print("🌐 REAL Browser-Use DOM Extraction Test")
    print("=" * 80)
    
    # Ensure patch is applied
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    print(f"\n✅ Scout patch active: {browser_use_patch.is_patched()}")
    print(f"📊 Total visible attributes: {len(browser_use_patch.SCOUT_WHITELIST)}")
    
    try:
        # Create a Scout agent with minimal LLM
        print("\n1. Creating Scout-enhanced Browser-Use agent...")
        agent = ScoutAgent(
            task="Navigate to example.com and extract DOM",
            llm=MinimalLLM(),
            use_vision=False,
            max_actions_per_step=1
        )
        
        print("\n2. Starting browser and navigating...")
        # Get the browser session and navigate manually
        if not agent.browser_session:
            agent.browser_session = BrowserSession()
        
        # Create context and page
        agent.context = await agent.browser_session.new_context()
        agent.page = await agent.context.new_page()
        
        # Navigate to a simple page
        print("   Navigating to example.com...")
        await agent.page.goto("https://example.com", wait_until="domcontentloaded")
        await agent.page.wait_for_timeout(2000)
        
        # Get browser state through controller
        print("\n3. Extracting browser state...")
        browser_state = await agent.controller.get_browser_state()
        
        print("\n4. DOM WITH Scout Enhancements:")
        print("-" * 80)
        # Get DOM with Scout attributes
        dom_with_scout = browser_state.element_tree.clickable_elements_to_string(
            include_attributes=browser_use_patch.SCOUT_WHITELIST
        )
        print(dom_with_scout[:1500] + "..." if len(dom_with_scout) > 1500 else dom_with_scout)
        
        print("\n\n5. DOM WITHOUT Scout (Browser-Use defaults):")
        print("-" * 80)
        # Get DOM with default attributes only
        dom_without_scout = browser_state.element_tree.clickable_elements_to_string(
            include_attributes=browser_use_patch.BROWSER_USE_DEFAULTS
        )
        print(dom_without_scout[:1500] + "..." if len(dom_without_scout) > 1500 else dom_without_scout)
        
        # Analysis
        print("\n\n6. ANALYSIS:")
        print("-" * 80)
        scout_lines = dom_with_scout.split('\n')
        default_lines = dom_without_scout.split('\n')
        
        print(f"Lines with Scout: {len(scout_lines)}")
        print(f"Lines without Scout: {len(default_lines)}")
        
        # Look for specific attributes
        print("\n7. Attribute Detection:")
        print("-" * 80)
        
        # Check for IDs
        id_count_scout = dom_with_scout.count("id=")
        id_count_default = dom_without_scout.count("id=")
        print(f"ID attributes - With Scout: {id_count_scout}, Without: {id_count_default}")
        
        # Check for hrefs
        href_count_scout = dom_with_scout.count("href=")
        href_count_default = dom_without_scout.count("href=")
        print(f"Href attributes - With Scout: {href_count_scout}, Without: {href_count_default}")
        
        # Check for data attributes
        data_count_scout = dom_with_scout.count("data-")
        data_count_default = dom_without_scout.count("data-")
        print(f"Data-* attributes - With Scout: {data_count_scout}, Without: {data_count_default}")
        
        print("\n✅ Real browser test completed!")
        
        # Clean up
        await agent.browser_session.close()
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


async def test_with_httpserver():
    """Test with a local HTTP server (alternative approach)"""
    print("\n\n🏠 Local Server Test (Alternative)")
    print("=" * 80)
    
    # Create test HTML
    test_html = """
    <!DOCTYPE html>
    <html>
    <head><title>Test Page</title></head>
    <body>
        <h1 id="main-title" data-testid="page-title">Test Page</h1>
        <form id="test-form" data-qa="main-form">
            <input 
                type="text" 
                id="username" 
                name="username" 
                data-testid="username-input"
                placeholder="Username"
            />
            <button 
                type="submit" 
                id="submit-btn" 
                data-testid="submit-button"
                data-automation="form-submit"
            >
                Submit
            </button>
        </form>
        <a href="/about" id="about-link" data-qa="about-nav">About</a>
    </body>
    </html>
    """
    
    # Save to temp file
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
        f.write(test_html)
        temp_path = f.name
    
    try:
        print("1. Created test HTML file")
        
        # Create agent
        agent = Agent(
            task="Extract DOM",
            llm=MinimalLLM(),
            use_vision=False
        )
        
        if not agent.browser_session:
            agent.browser_session = BrowserSession()
        
        agent.context = await agent.browser_session.new_context()
        agent.page = await agent.context.new_page()
        
        # Navigate to local file
        print(f"2. Navigating to file://{temp_path}")
        await agent.page.goto(f"file://{temp_path}")
        await agent.page.wait_for_timeout(1000)
        
        # Extract DOM
        browser_state = await agent.controller.get_browser_state()
        
        print("\n3. Extracted DOM:")
        print("-" * 80)
        dom_scout = browser_state.element_tree.clickable_elements_to_string(
            include_attributes=browser_use_patch.SCOUT_WHITELIST
        )
        print(dom_scout)
        
        # Check what we found
        print("\n4. Found Selectors:")
        print("-" * 80)
        if 'id="username"' in dom_scout:
            print("✅ Found: #username")
        if 'data-testid="username-input"' in dom_scout:
            print("✅ Found: [data-testid='username-input']")
        if 'id="submit-btn"' in dom_scout:
            print("✅ Found: #submit-btn")
        if 'href="/about"' in dom_scout:
            print("✅ Found: a[href='/about']")
        
        await agent.browser_session.close()
        
    finally:
        # Clean up
        os.unlink(temp_path)
        print("\n✅ Local test completed!")


if __name__ == "__main__":
    print("🚀 Running REAL Browser-Use Tests")
    print("=" * 80)
    
    async def main():
        # Run real browser test
        await real_browser_test()
        
        # Also run local file test
        await test_with_httpserver()
    
    asyncio.run(main())