#!/usr/bin/env python3
"""
Simple demonstration of DOM extraction with Scout enhancements
Shows before/after comparison on a local HTML file
"""

import os
import sys
import tempfile

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Scout components
from scouts import browser_use_patch

# Import DOM processing
from browser_use.dom.views import DOMElementNode


def create_google_like_html():
    """Create a simplified Google-like search page"""
    return """
    <html>
    <head><title>Search</title></head>
    <body>
        <div class="header">
            <img src="/logo.png" alt="Logo" />
        </div>
        <form action="/search" method="GET" role="search">
            <div class="search-container">
                <textarea 
                    class="gLFyf" 
                    id="APjFqb"
                    name="q"
                    aria-label="Search"
                    aria-autocomplete="both"
                    aria-haspopup="false"
                    autocapitalize="off"
                    autocomplete="off"
                    autocorrect="off"
                    autofocus=""
                    maxlength="2048"
                    role="combobox"
                    rows="1"
                    spellcheck="false"
                    title="Search"
                    type="search"
                    value=""
                    data-ved="0ahUKEwj..."
                    jsaction="paste:puy29d"
                    jsname="yZiJbe"
                    aria-expanded="false"
                    data-testid="search-input"
                    data-qa="main-search"
                    data-automation="google-search-box"
                ></textarea>
                <button 
                    type="submit"
                    class="search-button"
                    id="search-btn"
                    name="btnK"
                    aria-label="Google Search"
                    data-testid="search-button"
                    data-qa="search-submit"
                    value="Google Search"
                >
                    Google Search
                </button>
                <button 
                    type="button"
                    class="lucky-button"
                    id="lucky-btn"
                    name="btnI"
                    aria-label="I'm Feeling Lucky"
                    data-testid="lucky-button"
                    value="I'm Feeling Lucky"
                >
                    I'm Feeling Lucky
                </button>
            </div>
        </form>
        <div class="footer">
            <a href="/about" data-testid="about-link" data-qa="footer-about">About</a>
            <a href="/privacy" data-testid="privacy-link">Privacy</a>
            <a href="/terms" id="terms-link">Terms</a>
        </div>
    </body>
    </html>
    """


def create_mock_dom_tree():
    """Create a mock DOM tree from the HTML"""
    # Create search textarea element
    search_element = DOMElementNode(
        tag_name='textarea',
        xpath='//textarea[@name="q"]',
        attributes={
            'class': 'gLFyf',
            'id': 'APjFqb',
            'name': 'q',
            'aria-label': 'Search',
            'aria-autocomplete': 'both',
            'aria-haspopup': 'false',
            'autocapitalize': 'off',
            'autocomplete': 'off',
            'autocorrect': 'off',
            'autofocus': '',
            'maxlength': '2048',
            'role': 'combobox',
            'rows': '1',
            'spellcheck': 'false',
            'title': 'Search',
            'type': 'search',
            'value': '',
            'data-ved': '0ahUKEwj...',
            'jsaction': 'paste:puy29d',
            'jsname': 'yZiJbe',
            'aria-expanded': 'false',
            'data-testid': 'search-input',
            'data-qa': 'main-search',
            'data-automation': 'google-search-box',
        },
        children=[],
        is_visible=True,
        is_interactive=True,
        is_top_element=True,
        is_in_viewport=True,
        highlight_index=1,
        parent=None
    )
    
    # Create search button
    search_button = DOMElementNode(
        tag_name='button',
        xpath='//button[@name="btnK"]',
        attributes={
            'type': 'submit',
            'class': 'search-button',
            'id': 'search-btn',
            'name': 'btnK',
            'aria-label': 'Google Search',
            'data-testid': 'search-button',
            'data-qa': 'search-submit',
            'value': 'Google Search',
        },
        children=[],
        is_visible=True,
        is_interactive=True,
        is_top_element=True,
        is_in_viewport=True,
        highlight_index=2,
        parent=None
    )
    
    # Create about link
    about_link = DOMElementNode(
        tag_name='a',
        xpath='//a[@href="/about"]',
        attributes={
            'href': '/about',
            'data-testid': 'about-link',
            'data-qa': 'footer-about',
        },
        children=[],
        is_visible=True,
        is_interactive=True,
        is_top_element=True,
        is_in_viewport=True,
        highlight_index=3,
        parent=None
    )
    
    # Create root element
    root = DOMElementNode(
        tag_name='body',
        xpath='//body',
        attributes={},
        children=[search_element, search_button, about_link],
        is_visible=True,
        is_interactive=False,
        is_top_element=True,
        is_in_viewport=True,
        highlight_index=None,
        parent=None
    )
    
    return root


def main():
    """Run the demonstration"""
    print("🔍 Scout DOM Enhancement Demonstration")
    print("=" * 80)
    
    # Ensure Scout patch is applied
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
        print("✅ Scout patch applied")
    
    print(f"\nAttributes visible with Scout: {len(browser_use_patch.SCOUT_WHITELIST)}")
    print(f"Browser-Use defaults: {len(browser_use_patch.BROWSER_USE_DEFAULTS)}")
    print(f"Scout additions: {len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES)}")
    
    # Create mock DOM
    print("\n1. Creating mock Google-like search page DOM...")
    dom_tree = create_mock_dom_tree()
    
    # Extract with Scout attributes
    print("\n2. DOM WITH Scout Enhancements:")
    print("-" * 80)
    dom_with_scout = dom_tree.clickable_elements_to_string(
        include_attributes=browser_use_patch.SCOUT_WHITELIST
    )
    print(dom_with_scout)
    
    # Extract with default attributes
    print("\n3. DOM WITHOUT Scout (Browser-Use defaults only):")
    print("-" * 80)
    dom_without_scout = dom_tree.clickable_elements_to_string(
        include_attributes=browser_use_patch.BROWSER_USE_DEFAULTS
    )
    print(dom_without_scout)
    
    # Analysis
    print("\n4. ANALYSIS - What Scout Reveals:")
    print("-" * 80)
    
    # Count attributes in each version
    scout_attrs = dom_with_scout.count('=')
    default_attrs = dom_without_scout.count('=')
    
    print(f"Attribute count with Scout: {scout_attrs}")
    print(f"Attribute count without Scout: {default_attrs}")
    print(f"Additional attributes exposed: {scout_attrs - default_attrs}")
    
    print("\n5. Key Selectors Now Available:")
    print("-" * 80)
    print("✅ ID Selectors:")
    print("   - #APjFqb (search input)")
    print("   - #search-btn (search button)")
    
    print("\n✅ Test Automation Selectors:")
    print("   - [data-testid='search-input']")
    print("   - [data-testid='search-button']")
    print("   - [data-qa='main-search']")
    
    print("\n✅ Link Selectors:")
    print("   - a[href='/about']")
    
    print("\n✅ Custom Automation:")
    print("   - [data-automation='google-search-box']")
    
    print("\n6. Director Can Now Use:")
    print("-" * 80)
    print('{\n  "type": "browser_action",')
    print('  "config": {')
    print('    "action": "type",')
    print('    "selector": "#APjFqb",  // Stable ID discovered by Scout')
    print('    "text": "search query"')
    print('  }')
    print('}')
    
    print("\n✅ Demonstration completed!")


if __name__ == "__main__":
    main()