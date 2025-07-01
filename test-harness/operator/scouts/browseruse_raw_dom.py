import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'browser-use'))

from browser_use import Agent
from browser_use.browser import BrowserProfile, BrowserSession
from browser_use.llm import ChatOpenAI
import os

# Use environment variable for API key
# Set OPENAI_API_KEY in your environment before running this script

async def get_browseruse_dom():
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        api_key=os.getenv("OPENAI_API_KEY")
    )
    
    browser_session = BrowserSession(
        browser_profile=BrowserProfile(
            headless=False,
            viewport_expansion=0,
        )
    )
    
    # Create a custom browser session to intercept DOM
    from browser_use.browser.context import BrowserContext
    
    context = BrowserContext(session=browser_session)
    await context.start()
    
    try:
        # Navigate to Google
        page = await context.get_page()
        await page.goto('https://www.google.com')
        await page.wait_for_load_state('networkidle')
        
        # Get the DOM state using browser-use's internal method
        from browser_use.dom.service import DomService
        dom_service = DomService(page)
        dom_state = await dom_service.get_clickable_elements()
        
        # Convert to string representation
        formatted_elements = []
        
        def format_element(element, formatted_list):
            from browser_use.dom.views import DOMElementNode, DOMTextNode
            
            if isinstance(element, DOMElementNode):
                if element.highlight_index is not None:
                    # This is how browser-use formats elements for the LLM
                    text = element.get_all_text_till_next_clickable_element(max_depth=1)
                    attrs = ' '.join(f'{k}="{v}"' for k, v in element.attributes.items() if v)
                    if attrs:
                        line = f'[{element.highlight_index}]<{element.tag_name} {attrs}>{text}</{element.tag_name}>'
                    else:
                        line = f'[{element.highlight_index}]<{element.tag_name}>{text}</{element.tag_name}>'
                    formatted_list.append(line)
                
                for child in element.children:
                    format_element(child, formatted_list)
            
            elif isinstance(element, DOMTextNode):
                # Check if text should be shown (no highlighted parent)
                if (element.parent and element.parent.highlight_index is None and 
                    element.parent.is_visible and element.parent.is_top_element):
                    formatted_list.append(element.text)
        
        format_element(dom_state.element_tree, formatted_elements)
        
        print('BROWSER-USE RAW DOM OUTPUT:')
        print('=' * 80)
        for line in formatted_elements:
            print(line)
        print('=' * 80)
        
    finally:
        await context.stop()

asyncio.run(get_browseruse_dom())