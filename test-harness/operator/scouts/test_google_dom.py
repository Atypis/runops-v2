#!/usr/bin/env python3
"""
Direct DOM extraction test showing Scout enhancements on Google.com
No LLM required - just shows raw DOM differences
"""

import asyncio
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Scout components
from scouts import browser_use_patch

# Import Browser-Use components
from browser_use import Browser
from browser_use.browser.browser import BrowserConfig
from browser_use.controller.service import Controller


async def extract_google_search_dom():
    """Extract and compare DOM with and without Scout patches"""
    print("🔍 Google Search DOM Extraction - Scout Enhancement Demo")
    print("=" * 80)
    
    # Ensure Scout patch is applied
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
        print("✅ Scout patch applied")
    
    print(f"\nVisible attributes with Scout: {len(browser_use_patch.SCOUT_WHITELIST)}")
    print(f"Browser-Use default attributes: {len(browser_use_patch.BROWSER_USE_DEFAULTS)}")
    print(f"Scout additions: {len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES)}")
    
    # Create browser instance
    browser_config = BrowserConfig(headless=True)  # Set to False to see browser
    
    try:
        # Create session and navigate
        print("\n1. Opening browser and navigating to google.com...")
        browser = Browser(config=browser_config)
        context = await browser.new_context()
        page = await context.new_page()
        
        await page.goto("https://www.google.com", wait_until="domcontentloaded")
        await page.wait_for_timeout(2000)  # Wait for dynamic content
        
        # Set up controller
        controller = Controller()
        controller.browser = browser
        controller.context = context  
        controller.page = page
        
        # Get browser state
        print("\n2. Extracting DOM state...")
        browser_state = await controller.get_browser_state()
        
        # Extract with Scout attributes
        print("\n3. DOM WITH Scout Enhancements:")
        print("-" * 80)
        dom_with_scout = browser_state.element_tree.clickable_elements_to_string(
            include_attributes=browser_use_patch.SCOUT_WHITELIST
        )
        
        # Find search-related elements
        search_elements_scout = []
        for line in dom_with_scout.split('\n'):
            if any(keyword in line.lower() for keyword in ['search', 'q', 'query', 'combobox', 'textarea', 'input']):
                search_elements_scout.append(line.strip())
        
        print(f"Found {len(search_elements_scout)} search-related elements")
        print("\nSearch elements with Scout attributes:")
        for elem in search_elements_scout[:15]:  # Show up to 15
            print(f"  {elem}")
            # Highlight specific attributes
            if 'id=' in elem:
                print(f"    → Contains ID attribute!")
            if 'data-' in elem:
                print(f"    → Contains data-* attributes!")
            if 'href=' in elem:
                print(f"    → Contains href attribute!")
        
        # Extract with default Browser-Use attributes only
        print("\n\n4. DOM WITHOUT Scout (Browser-Use defaults only):")
        print("-" * 80)
        dom_without_scout = browser_state.element_tree.clickable_elements_to_string(
            include_attributes=browser_use_patch.BROWSER_USE_DEFAULTS
        )
        
        # Find search-related elements in default view
        search_elements_default = []
        for line in dom_without_scout.split('\n'):
            if any(keyword in line.lower() for keyword in ['search', 'q', 'query', 'combobox', 'textarea', 'input']):
                search_elements_default.append(line.strip())
        
        print(f"Found {len(search_elements_default)} search-related elements")
        print("\nSearch elements with default attributes:")
        for elem in search_elements_default[:15]:
            print(f"  {elem}")
        
        # Analysis
        print("\n\n5. ANALYSIS:")
        print("-" * 80)
        print(f"Elements found with Scout: {len(search_elements_scout)}")
        print(f"Elements found without Scout: {len(search_elements_default)}")
        
        # Look for specific selectors in the main search box
        print("\n6. Specific Search Box Analysis:")
        print("-" * 80)
        
        # Try to find the main search input/textarea
        main_search_scout = None
        main_search_default = None
        
        for elem in search_elements_scout:
            if ('name="q"' in elem or "name='q'" in elem) and ('textarea' in elem.lower() or 'input' in elem.lower()):
                main_search_scout = elem
                break
        
        for elem in search_elements_default:
            if ('name="q"' in elem or "name='q'" in elem) and ('textarea' in elem.lower() or 'input' in elem.lower()):
                main_search_default = elem
                break
        
        if main_search_scout:
            print("Main search box WITH Scout:")
            print(f"  {main_search_scout}")
            
            # Extract attributes
            attrs_scout = []
            import re
            # Match attribute="value" or attribute='value'
            attr_pattern = r'(\w+(?:-\w+)*)=["\']([^"\']*)["\']'
            matches = re.findall(attr_pattern, main_search_scout)
            for attr, value in matches:
                attrs_scout.append(f"{attr}={value}")
            
            print(f"\n  Attributes found ({len(attrs_scout)}):")
            for attr in attrs_scout:
                print(f"    - {attr}")
        
        if main_search_default:
            print("\n\nMain search box WITHOUT Scout:")
            print(f"  {main_search_default}")
            
            # Extract attributes
            attrs_default = []
            attr_pattern = r'(\w+(?:-\w+)*)=["\']([^"\']*)["\']'
            matches = re.findall(attr_pattern, main_search_default)
            for attr, value in matches:
                attrs_default.append(f"{attr}={value}")
            
            print(f"\n  Attributes found ({len(attrs_default)}):")
            for attr in attrs_default:
                print(f"    - {attr}")
        
        # Summary
        print("\n\n7. SUMMARY - Scout Enhancements:")
        print("-" * 80)
        print("✅ With Scout patch, you can now see:")
        for attr in ['id', 'data-testid', 'data-qa', 'href', 'data-automation']:
            print(f"   - {attr} attributes")
        
        print("\n❌ Without Scout patch, these are hidden:")
        print("   - All the above attributes are filtered out!")
        
        # Session is now browser
        pass
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await browser.close()


if __name__ == "__main__":
    asyncio.run(extract_google_search_dom())