"""
Simple Scout Runner for Airtable Filter Reconnaissance
Using OpenAI o4-mini
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path
import sys

# Add browser-use to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'browser-use'))

from browser_use import Agent
from browser_use.browser import BrowserProfile, BrowserSession
from browser_use.llm import ChatOpenAI
import os

# Use environment variable for API key
# Set OPENAI_API_KEY in your environment before running this script


async def run_airtable_scout(airtable_url: str):
    """Run a scout mission on Airtable using o4-mini"""
    
    print("🕵️ AIRTABLE FILTER SCOUT - OpenAI o4-mini")
    print("=" * 50)
    print(f"Target: {airtable_url}")
    print("=" * 50)
    
    # Configure o4-mini
    llm = ChatOpenAI(
        model="o4-mini",
        api_key=os.getenv("OPENAI_API_KEY"),
        temperature=1.0  # o4-mini only supports temperature=1
    )
    
    # Configure browser session
    browser_session = BrowserSession(
        browser_profile=BrowserProfile(
            headless=False,  # Keep visible to watch
            viewport_expansion=0,
        )
    )
    
    # Scout mission prompt
    task = f"""You are an elite UI reconnaissance specialist. Your mission is to completely reverse-engineer Airtable's filter system.

First, navigate to: {airtable_url}

IMPORTANT: You will need to login. This is a Google OAuth account:
- Email: michaelburner595@gmail.com
- Google Password: dCdWqhgPzJev6Jz

Login flow:
1. Click "Sign in with Google" on Airtable
2. Enter email: michaelburner595@gmail.com
3. Click Next
4. Enter password: dCdWqhgPzJev6Jz
5. Click Next
6. If asked about 2FA or account verification, document what you see

Note: This account uses Google OAuth, there is no direct Airtable password.

CRITICAL OBJECTIVES:

1. FILTER PANEL ACCESS
   - Find ALL ways to open the filter panel (button click, keyboard shortcut, menu)
   - Test each method and document exact selectors
   - Measure how long the panel takes to open
   - What happens if you click filter button multiple times rapidly?

2. FILTER STATE DETECTION  
   - How can you tell if filters are already active when you load the page?
   - Find DOM elements that indicate active filters
   - What visual cues show filters are applied?
   - How to detect the number of active filters?

3. FILTER MECHANICS
   - Document the EXACT sequence to add a filter condition
   - What are the reliable selectors for: field dropdown, operator dropdown, value input?
   - How long does it take for filter to apply after clicking "Apply"?
   - Does the UI show loading states? How to detect them?

4. CRITICAL TIMINGS
   - Time between clicking filter button and panel being interactive
   - Time between entering filter value and it being applied
   - Time for filtered results to appear
   - Any other async operations that need waiting

5. EDGE CASES & RECOVERY
   - What happens with a filter that returns 0 results?
   - What if you enter special characters like @, quotes, parentheses?
   - How to clear ONE filter vs ALL filters?
   - What happens if filter panel gets "stuck"?
   - Best way to ensure clean state before starting?

IMPORTANT: 
- Test selectors multiple times to ensure reliability
- Avoid dynamic IDs that change (like #:r5:)
- Document EXACT wait times needed
- Take screenshots of different states
- Think like an automation engineer - what would break?

Be extremely thorough and technical. This reconnaissance will be used to build bulletproof automation."""

    # Create agent with browser session
    agent = Agent(
        task=task,
        llm=llm,
        browser_session=browser_session,
        max_actions_per_step=4
    )
    
    try:
        print("\n🚀 Deploying scout...")
        print("🤖 Scout will use OpenAI o4-mini model")
        print("⏱️  This may take several minutes for thorough reconnaissance\n")
        
        # Run the scout
        result = await agent.run()
        
        # Save the raw result
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_dir = Path(__file__).parent / "reports"
        report_dir.mkdir(exist_ok=True)
        
        report_file = report_dir / f"o4mini_scout_report_{timestamp}.json"
        
        # Process the result
        report_data = {
            "model": "o4-mini",
            "timestamp": timestamp,
            "target_url": airtable_url,
            "raw_findings": str(result),
            "mission_status": "complete"
        }
        
        with open(report_file, "w") as f:
            json.dump(report_data, f, indent=2)
        
        print(f"\n✅ Scout mission complete!")
        print(f"📄 Report saved to: {report_file}")
        print(f"\n📊 Quick Summary:")
        print(f"   - Model: OpenAI o4-mini")
        print(f"   - Duration: Check browser session")
        print(f"   - Report size: {len(str(result))} characters")
        
        # Print first part of findings
        print(f"\n📋 First 500 chars of findings:")
        print("-" * 50)
        print(str(result)[:500] + "...")
        
        return result
        
    except Exception as e:
        print(f"\n❌ Scout mission failed: {str(e)}")
        raise


if __name__ == "__main__":
    # Replace with your actual Airtable URL
    AIRTABLE_URL = "https://airtable.com/appTnT68Rt8yHIGV3"  # The one from the workflow
    
    # Run the scout
    asyncio.run(run_airtable_scout(AIRTABLE_URL))