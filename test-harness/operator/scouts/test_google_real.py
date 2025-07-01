#!/usr/bin/env python3
"""
REAL Browser-Use test that navigates to Google.com and extracts DOM selectors
"""

import asyncio
import os
import sys
from typing import Optional

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Scout components
from scouts import browser_use_patch
from scouts.scout_agent import ScoutAgent

# Import Browser-Use components
from browser_use import Agent
from browser_use.llm.base import BaseChatModel
from browser_use.llm.views import ChatInvokeCompletion
from browser_use.llm.messages import BaseMessage
from browser_use.agent.views import AgentOutput


class GoogleSearchLLM(BaseChatModel):
    """Minimal LLM that navigates to Google and then extracts DOM"""
    
    model: str = "google-search-extractor"
    _step_count: int = 0
    
    @property
    def provider(self) -> str:
        return "mock"
    
    async def ainvoke(
        self, 
        messages: list[BaseMessage], 
        output_format: Optional[type] = None
    ) -> ChatInvokeCompletion:
        """Navigate to Google then extract DOM info"""
        self._step_count += 1
        
        # Step 1: Navigate to Google
        if self._step_count == 1:
            response = AgentOutput(
                thinking="I need to navigate to Google.com first",
                evaluation_previous_goal="Starting fresh",
                memory="No previous actions",
                next_goal="Navigate to Google.com",
                action=[{
                    "go_to_url": {
                        "url": "https://www.google.com"
                    }
                }]
            )
        # Step 2: Extract DOM information
        elif self._step_count == 2:
            response = AgentOutput(
                thinking="Now I'll extract all DOM information for the search component",
                evaluation_previous_goal="Successfully navigated to Google.com",
                memory="Navigated to Google.com",
                next_goal="Extract DOM selectors for search input",
                action=[{
                    "extract_content": {
                        "method": "json",
                        "content": "Extract ALL attributes and selectors for the main search input element (the search box where users type queries). Include every single attribute you can see: id, name, class, data-* attributes, aria-* attributes, type, role, etc. Return as JSON with keys for each attribute type."
                    }
                }]
            )
        # Step 3: Done
        else:
            response = AgentOutput(
                thinking="DOM extraction complete",
                evaluation_previous_goal="Extracted DOM information",
                memory="Navigated to Google and extracted search component DOM",
                next_goal="Complete task",
                action=[{
                    "done": {
                        "summary": "Successfully extracted Google search component DOM selectors"
                    }
                }]
            )
        
        if output_format:
            # Return the response model directly
            return ChatInvokeCompletion(
                model_response=response,
                prompt_tokens=100,
                completion_tokens=100,
                total_tokens=200
            )
        else:
            # Return as string
            return ChatInvokeCompletion(
                model_response=str(response),
                prompt_tokens=100,
                completion_tokens=100,
                total_tokens=200
            )


async def extract_google_dom_with_scout():
    """Run the actual test with Scout-enhanced Browser-Use"""
    print("🌐 REAL Google.com DOM Extraction Test")
    print("=" * 80)
    
    # Ensure Scout patch is applied
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    print(f"\n✅ Scout patch active: {browser_use_patch.is_patched()}")
    print(f"📊 Total visible attributes: {len(browser_use_patch.SCOUT_WHITELIST)}")
    print("\nScout additions include:")
    for attr in ['id', 'data-testid', 'data-qa', 'href', 'data-automation'][:5]:
        print(f"  - {attr}")
    print(f"  ... and {len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES) - 5} more")
    
    # Create our custom LLM
    llm = GoogleSearchLLM()
    
    print("\n1. Creating Scout-enhanced agent...")
    agent = ScoutAgent(
        task="Navigate to Google.com and extract all DOM selectors for the search component",
        llm=llm,
        use_vision=False,  # Don't need screenshots for this test
        max_actions_per_step=1,
        max_failures=1
    )
    
    # We'll analyze the DOM from the agent's history after it runs
    
    print("\n2. Running agent (navigating to Google and extracting DOM)...")
    try:
        result = await agent.run(max_steps=3)
        
        print("\n3. Agent execution complete!")
        print(f"   Success: {result.is_successful()}")
        print(f"   Steps taken: {result.number_of_steps()}")
        
        # Show extracted content
        if result.extracted_content():
            print("\n4. Extracted Content:")
            print("-" * 80)
            for content in result.extracted_content():
                print(content)
        
        # Get the DOM from the agent's history
        if result.history and len(result.history) >= 2:
            # Get the state after navigation to Google
            google_state = result.history[1].state  # Second step should be at Google
            
            if google_state and google_state.element_tree:
            
            print("\n5. DOM Analysis on Google.com:")
            print("-" * 80)
            print(f"URL: {google_dom['url']}")
            
            # Find search-related elements
            scout_lines = [l.strip() for l in google_dom['with_scout'].split('\n') if l.strip()]
            default_lines = [l.strip() for l in google_dom['without_scout'].split('\n') if l.strip()]
            
            # Look for search box
            print("\n6. Search Input Elements Found:")
            print("-" * 80)
            
            print("WITH Scout Enhancement:")
            search_elements = [l for l in scout_lines if any(
                x in l.lower() for x in ['search', 'q', 'query', 'textarea', 'input', 'combobox']
            )]
            for elem in search_elements[:5]:  # Show first 5
                print(f"  {elem}")
                # Highlight key attributes
                if 'id=' in elem:
                    import re
                    id_match = re.search(r'id=[\'"]([^\'"]*)[\'"]\s', elem)
                    if id_match:
                        print(f"    → Found ID: #{id_match.group(1)}")
                if 'data-testid=' in elem:
                    testid_match = re.search(r'data-testid=[\'"]([^\'"]*)[\'"]\s', elem)
                    if testid_match:
                        print(f"    → Found data-testid: {testid_match.group(1)}")
            
            print(f"\nTotal search elements with Scout: {len(search_elements)}")
            
            print("\n\nWITHOUT Scout (Browser-Use default):")
            search_elements_default = [l for l in default_lines if any(
                x in l.lower() for x in ['search', 'q', 'query', 'textarea', 'input', 'combobox']
            )]
            for elem in search_elements_default[:5]:
                print(f"  {elem}")
            
            print(f"\nTotal search elements without Scout: {len(search_elements_default)}")
            
            # Summary
            print("\n7. SUMMARY:")
            print("-" * 80)
            print(f"✅ With Scout: Found {len(search_elements)} search-related elements")
            print(f"❌ Without Scout: Found {len(search_elements_default)} search-related elements")
            print(f"🔍 Scout reveals {len(search_elements) - len(search_elements_default)} additional elements/attributes")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Clean up
        if hasattr(agent, 'browser_session') and agent.browser_session:
            await agent.browser_session.close()
    
    print("\n✅ Test completed!")


if __name__ == "__main__":
    asyncio.run(extract_google_dom_with_scout())