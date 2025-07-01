#!/usr/bin/env python3
"""
Direct DOM extraction test - bypasses the agent and directly uses controller
Shows real DOM extraction with Scout enhancements
"""

import asyncio
import os
import sys
import tempfile

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Scout components
from scouts import browser_use_patch

# Import Browser-Use components
from browser_use.browser.session import BrowserSession
from browser_use.controller.service import Controller


async def test_real_dom_extraction():
    """Direct test of DOM extraction without agent complexity"""
    print("🌐 Direct DOM Extraction Test (Real Browser)")
    print("=" * 80)
    
    # Ensure patch is applied
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    print(f"\n✅ Scout patch active: {browser_use_patch.is_patched()}")
    print(f"📊 Visible attributes: {len(browser_use_patch.SCOUT_WHITELIST)}")
    
    # Create test HTML with various selectors
    test_html = """
    <!DOCTYPE html>
    <html>
    <head><title>Scout Test Page</title></head>
    <body>
        <div class="container">
            <h1 id="page-title" data-testid="main-heading">Scout Selector Test</h1>
            
            <form id="search-form" action="/search" data-qa="search-form">
                <input 
                    type="text"
                    id="search-input"
                    name="q"
                    class="search-box"
                    placeholder="Search..."
                    aria-label="Search"
                    data-testid="search-field"
                    data-qa="search-input"
                    data-automation="main-search"
                    autocomplete="off"
                />
                <button 
                    type="submit"
                    id="search-btn"
                    class="btn btn-primary"
                    aria-label="Search"
                    data-testid="search-button"
                    data-action="search"
                >
                    Search
                </button>
            </form>
            
            <nav class="navigation">
                <a href="/" id="home-link" data-testid="nav-home">Home</a>
                <a href="/about" data-qa="about-link">About</a>
                <a href="/contact" data-automation="contact-nav">Contact</a>
            </nav>
            
            <div data-component="user-info" data-role="sidebar">
                <button 
                    id="login-btn"
                    data-testid="login-button"
                    data-track="login-click"
                    aria-describedby="login-help"
                >
                    Login
                </button>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Save to temp file
    with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
        f.write(test_html)
        temp_path = f.name
    
    browser_session = None
    
    try:
        print("\n1. Starting browser session...")
        browser_session = BrowserSession()
        context = await browser_session.new_context()
        page = await context.new_page()
        
        print(f"\n2. Navigating to test page...")
        await page.goto(f"file://{temp_path}")
        await page.wait_for_load_state("domcontentloaded")
        
        # Create controller
        controller = Controller()
        controller.browser = browser_session
        controller.context = context
        controller.page = page
        
        print("\n3. Extracting browser state...")
        browser_state = await controller.get_browser_state()
        
        print("\n4. DOM WITH Scout Enhancements:")
        print("-" * 80)
        dom_with_scout = browser_state.element_tree.clickable_elements_to_string(
            include_attributes=browser_use_patch.SCOUT_WHITELIST
        )
        print(dom_with_scout)
        
        print("\n\n5. DOM WITHOUT Scout (Browser-Use defaults):")
        print("-" * 80)
        dom_without_scout = browser_state.element_tree.clickable_elements_to_string(
            include_attributes=browser_use_patch.BROWSER_USE_DEFAULTS
        )
        print(dom_without_scout)
        
        print("\n\n6. DETAILED ANALYSIS:")
        print("-" * 80)
        
        # Parse and analyze differences
        scout_lines = [line.strip() for line in dom_with_scout.split('\n') if line.strip()]
        default_lines = [line.strip() for line in dom_without_scout.split('\n') if line.strip()]
        
        print(f"Total elements with Scout: {len(scout_lines)}")
        print(f"Total elements without Scout: {len(default_lines)}")
        
        # Count specific attributes
        attributes_found = {
            'id': dom_with_scout.count('id='),
            'data-testid': dom_with_scout.count('data-testid='),
            'data-qa': dom_with_scout.count('data-qa='),
            'data-automation': dom_with_scout.count('data-automation='),
            'href': dom_with_scout.count('href='),
            'data-component': dom_with_scout.count('data-component='),
            'data-role': dom_with_scout.count('data-role='),
            'data-track': dom_with_scout.count('data-track='),
            'aria-describedby': dom_with_scout.count('aria-describedby='),
        }
        
        print("\n7. Scout-Specific Attributes Found:")
        print("-" * 80)
        for attr, count in attributes_found.items():
            if count > 0:
                print(f"✅ {attr}: {count} occurrences")
            else:
                print(f"❌ {attr}: 0 occurrences")
        
        print("\n8. Selector Examples Now Available:")
        print("-" * 80)
        print("ID Selectors:")
        print("  - #search-input")
        print("  - #search-btn")
        print("  - #login-btn")
        print("\nTest Selectors:")
        print("  - [data-testid='search-field']")
        print("  - [data-testid='search-button']")
        print("  - [data-testid='login-button']")
        print("\nNavigation:")
        print("  - a[href='/']")
        print("  - a[href='/about']")
        print("  - a[href='/contact']")
        
        print("\n✅ Test completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up
        if browser_session:
            await browser_session.close()
        os.unlink(temp_path)
        print("\n🧹 Cleanup completed")


if __name__ == "__main__":
    asyncio.run(test_real_dom_extraction())