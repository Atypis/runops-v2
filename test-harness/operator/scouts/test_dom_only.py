#!/usr/bin/env python3
"""
Simplest possible test - just shows DOM string generation with Scout patches
No real browser needed - just demonstrates the attribute filtering
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Scout components
from scouts import browser_use_patch

# Import DOM components
from browser_use.dom.views import DOMElementNode


def main():
    """Show DOM string differences with a complex example"""
    print("🔍 Scout DOM Attribute Enhancement Demo")
    print("=" * 80)
    
    # Ensure patch is applied
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    print(f"\n✅ Scout patch active")
    print(f"📊 Total attributes: {len(browser_use_patch.SCOUT_WHITELIST)}")
    print(f"🆕 Scout additions: {len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES)}")
    
    # Create a realistic Google search element
    search_element = DOMElementNode(
        tag_name='textarea',
        xpath='//textarea[@name="q"]',
        attributes={
            # Standard attributes (Browser-Use shows these)
            'name': 'q',
            'aria-label': 'Search',
            'role': 'combobox',
            'title': 'Search',
            'type': 'search',
            'value': '',
            'aria-expanded': 'false',
            'placeholder': 'Search Google or type a URL',
            
            # These are HIDDEN by default Browser-Use!
            'id': 'APjFqb',  # Google's actual ID
            'class': 'gLFyf gsfi',  # CSS classes
            'autocomplete': 'off',
            'data-ved': '0ahUKEwiJ9...',  # Google tracking
            'jsaction': 'paste:puy29d;',  # Event handlers
            'jsname': 'yZiJbe',  # Google's internal name
            'maxlength': '2048',
            'rows': '1',
            'data-testid': 'search-input',  # Test automation
            'data-qa': 'main-search',  # QA automation
            'data-automation': 'google-search',  # Generic automation
            'aria-controls': 'search-suggestions',
            'aria-describedby': 'search-help',
            'spellcheck': 'false',
            'dir': 'ltr',
            'style': 'color: #000; background: #fff;',
        },
        children=[],
        is_visible=True,
        is_interactive=True,
        is_top_element=True,
        is_in_viewport=True,
        highlight_index=1,
        parent=None
    )
    
    # Create a submit button
    submit_button = DOMElementNode(
        tag_name='button',
        xpath='//button[@name="btnK"]',
        attributes={
            # Browser-Use shows these
            'name': 'btnK',
            'aria-label': 'Google Search',
            'type': 'submit',
            'value': 'Google Search',
            
            # Hidden by default!
            'id': 'search-submit-btn',
            'class': 'gNO89b',
            'data-testid': 'search-button',
            'data-qa': 'submit-search',
            'data-track': 'search-submitted',
            'onclick': 'handleSearch()',
        },
        children=[],
        is_visible=True,
        is_interactive=True,
        is_top_element=True,
        is_in_viewport=True,
        highlight_index=2,
        parent=None
    )
    
    # Create root
    root = DOMElementNode(
        tag_name='body',
        xpath='//body',
        attributes={},
        children=[search_element, submit_button],
        is_visible=True,
        is_interactive=False,
        is_top_element=True,
        is_in_viewport=True,
        highlight_index=None,
        parent=None
    )
    
    # Show with Scout enhancements
    print("\n1️⃣ WITH Scout Enhancements (What Scout Agents See):")
    print("-" * 80)
    scout_dom = root.clickable_elements_to_string(
        include_attributes=browser_use_patch.SCOUT_WHITELIST
    )
    print(scout_dom)
    
    # Show without Scout
    print("\n2️⃣ WITHOUT Scout (Standard Browser-Use):")
    print("-" * 80)
    default_dom = root.clickable_elements_to_string(
        include_attributes=browser_use_patch.BROWSER_USE_DEFAULTS
    )
    print(default_dom)
    
    # Analysis
    print("\n3️⃣ ANALYSIS:")
    print("-" * 80)
    
    # Count attributes shown
    scout_attr_count = scout_dom.count('=')
    default_attr_count = default_dom.count('=')
    
    print(f"Attributes shown with Scout: {scout_attr_count}")
    print(f"Attributes shown without Scout: {default_attr_count}")
    print(f"Additional information: +{((scout_attr_count/default_attr_count)-1)*100:.0f}%")
    
    print("\n4️⃣ Critical Selectors Now Available:")
    print("-" * 80)
    
    # Check what's visible
    selectors = {
        '#APjFqb': 'id=' in scout_dom and 'APjFqb' in scout_dom,
        '[data-testid="search-input"]': 'data-testid=' in scout_dom,
        '[data-qa="main-search"]': 'data-qa=' in scout_dom,
        '[data-automation="google-search"]': 'data-automation=' in scout_dom,
        '#search-submit-btn': 'search-submit-btn' in scout_dom,
        'textarea[name="q"]': True,  # Always visible
        '[aria-label="Search"]': True,  # Always visible
    }
    
    print("Selectors available to Director:")
    for selector, available in selectors.items():
        status = "✅" if available else "❌"
        print(f"  {status} {selector}")
    
    print("\n5️⃣ What This Means:")
    print("-" * 80)
    print("Without Scout patch:")
    print("  - Director must use: textarea[name='q'] or [aria-label='Search']")
    print("  - Less specific, more fragile")
    print("\nWith Scout patch:")
    print("  - Director can use: #APjFqb (Google's stable ID)")
    print("  - Multiple test selectors for redundancy")
    print("  - Automation-specific hooks")
    
    print("\n✅ Demo completed!")


if __name__ == "__main__":
    main()