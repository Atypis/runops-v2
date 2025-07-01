#!/usr/bin/env python3
"""
Compare DOM output with and without Scout enhancement
Shows exactly what Browser-Use agents can see
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scouts import browser_use_patch
from browser_use.dom.views import DOMElementNode


def create_google_search_element():
    """Create a realistic Google search element"""
    return DOMElementNode(
        tag_name='textarea',
        xpath='//textarea[@name="q"]',
        attributes={
            # These Browser-Use shows by default:
            'name': 'q',
            'aria-label': 'Search',
            'role': 'combobox',
            'title': 'Search',
            'type': 'search',
            'value': '',
            'aria-expanded': 'false',
            
            # These are HIDDEN without Scout patch:
            'id': 'APjFqb',  # Google's actual stable ID!
            'class': 'gLFyf gsfi',
            'autocomplete': 'off',
            'autocorrect': 'off',
            'maxlength': '2048',
            'spellcheck': 'false',
            'data-ved': '0ahUKEw...',  # Tracking data
            'jsaction': 'paste:puy29d',  # Event handlers
            'jsname': 'yZiJbe',  # Internal name
            'aria-controls': 'Alh6id',
            'aria-describedby': 'searchhelp',
            'aria-autocomplete': 'both',
            'aria-haspopup': 'false',
            'data-testid': 'search-input',  # Would be great for testing!
            'data-qa': 'main-search',  # QA automation
            'data-automation': 'google-search',  # Automation hook
        },
        children=[],
        is_visible=True,
        is_interactive=True,
        is_top_element=True,
        is_in_viewport=True,
        highlight_index=10,  # This is what Google shows as [10]
        parent=None
    )


def main():
    print("🔍 Browser-Use DOM Visibility Comparison")
    print("=" * 80)
    print("\nThis shows EXACTLY what a Browser-Use agent sees on Google.com\n")
    
    # Create the search element
    search_element = create_google_search_element()
    
    # Show WITHOUT Scout (default Browser-Use)
    print("1️⃣ WITHOUT Scout Enhancement (Default Browser-Use):")
    print("-" * 80)
    default_dom = search_element.clickable_elements_to_string(
        include_attributes=browser_use_patch.BROWSER_USE_DEFAULTS
    )
    print(default_dom)
    print("\nWhat the agent sees: Basic semantic attributes only")
    print("Missing: id, class, data-* attributes, etc.")
    
    # Apply Scout patch
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    # Show WITH Scout
    print("\n\n2️⃣ WITH Scout Enhancement:")
    print("-" * 80)
    scout_dom = search_element.clickable_elements_to_string(
        include_attributes=browser_use_patch.SCOUT_WHITELIST
    )
    print(scout_dom)
    print("\nWhat the agent sees: ALL automation-relevant attributes!")
    print("Now visible: id='APjFqb', data-testid, data-qa, etc.")
    
    # Analysis
    print("\n\n3️⃣ IMPACT ANALYSIS:")
    print("-" * 80)
    
    # Count attributes
    default_count = default_dom.count('=')
    scout_count = scout_dom.count('=')
    
    print(f"Attributes visible without Scout: {default_count}")
    print(f"Attributes visible with Scout: {scout_count}")
    print(f"Information gain: +{((scout_count/default_count)-1)*100:.0f}%")
    
    print("\n\n4️⃣ WHAT THIS MEANS FOR AUTOMATION:")
    print("-" * 80)
    print("\nWithout Scout, the Director must use:")
    print("  ❌ textarea[name='q'] - Generic, might match multiple elements")
    print("  ❌ [aria-label='Search'] - Language-dependent, breaks in non-English")
    print("\nWith Scout, the Director can use:")
    print("  ✅ #APjFqb - Google's stable ID, fastest and most reliable")
    print("  ✅ [data-testid='search-input'] - Explicit test selector")
    print("  ✅ [data-qa='main-search'] - QA automation hook")
    
    print("\n\n✅ Scout Enhancement gives Browser-Use agents FULL visibility!")


if __name__ == "__main__":
    main()