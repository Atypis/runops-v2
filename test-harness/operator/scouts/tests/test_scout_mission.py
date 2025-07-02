#!/usr/bin/env python3
"""
Test Scout Engine with a real mission from the mock workflow.

Based on the mock workflow, we need to understand Airtable's filter system
to handle the investor email matching logic.
"""

import asyncio
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scouts import browser_use_patch
from scouts.scout_engine import ScoutEngine


async def test_airtable_filter_scout():
    """
    Test mission based on the mock workflow's Airtable filter needs.
    
    The workflow needs to:
    1. Open filter panel
    2. Add a condition
    3. Set field to "Email"
    4. Set operator to "contains"
    5. Enter email value
    6. Apply filter
    """
    
    print("🚀 Scout Engine Test - Airtable Filter Reconnaissance")
    print("=" * 60)
    
    # Create scout engine
    engine = ScoutEngine()
    
    # Define the mission based on workflow needs
    mission = """Explore Airtable's filter system and discover all reliable selectors for:

1. The Filter button in the view toolbar
2. The "Add condition" button in the filter panel
3. Field selection dropdown (need to select "Email" field)
4. Operator dropdown (need to select "contains")
5. Value input field for entering email addresses
6. Apply/confirm button for the filter

Also document:
- Exact timing delays needed between actions
- How to detect when filter panel is fully open
- How to verify filter has been applied successfully
- Any edge cases or alternative approaches

Test the selectors by actually trying to set up a filter for Email contains "test@example.com" and verify it works.

IMPORTANT: Look for data-testid, data-automation, aria-label, and stable IDs. Report all available selectors ranked by reliability."""
    
    # For testing, we'll use a public Airtable template
    # In production, this would be the actual Airtable URL from the workflow
    test_url = "https://airtable.com/shrCgX5oOhVDuWgJ0"  # Public template
    
    print(f"\nMission: {mission[:200]}...")
    print(f"Target URL: {test_url}")
    print(f"Model: Gemini 2.5 Pro")
    print(f"DOM Visibility: Enhanced ({len(browser_use_patch.SCOUT_WHITELIST)} attributes)")
    
    print("\n🔍 Deploying Scout...")
    start_time = datetime.now()
    
    try:
        # Deploy the scout
        report = await engine.deploy_scout(
            mission=mission,
            target_url=test_url,
            max_steps=25  # Enough steps to explore thoroughly
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        print(f"\n✅ Scout mission completed in {duration:.1f} seconds")
        print("\n" + "=" * 60)
        print("SCOUT REPORT:")
        print("=" * 60)
        print(report)
        
        # Save report to file
        report_file = f"scout_reports/airtable_filter_{datetime.now().strftime('%Y%m%d_%H%M%S')}.md"
        os.makedirs("scout_reports", exist_ok=True)
        with open(report_file, 'w') as f:
            f.write(report)
        print(f"\n📄 Report saved to: {report_file}")
        
    except Exception as e:
        print(f"\n❌ Scout mission failed: {e}")
        import traceback
        traceback.print_exc()


async def test_simple_google_scout():
    """
    Simpler test with Google search to verify Scout Engine works.
    """
    print("\n🚀 Scout Engine Test - Google Search Reconnaissance")
    print("=" * 60)
    
    engine = ScoutEngine()
    
    mission = """Find and document ALL selectors for Google's search functionality:
1. The main search input box - find the ID, name, and any data attributes
2. The "Google Search" button - all possible selectors
3. The "I'm Feeling Lucky" button - all possible selectors

Report every single attribute you can see on these elements thanks to the enhanced DOM visibility.
Rank selectors by stability (ID > data-testid > name > aria-label > class)."""
    
    print("\n🔍 Deploying Scout to Google...")
    
    try:
        report = await engine.deploy_scout(
            mission=mission,
            target_url="https://google.com",
            max_steps=10
        )
        
        print("\n" + "=" * 60)
        print("SCOUT REPORT:")
        print("=" * 60)
        print(report)
        
    except Exception as e:
        print(f"\n❌ Scout mission failed: {e}")


if __name__ == "__main__":
    # Run both tests
    print("Testing Scout Engine with real missions...\n")
    
    # First test with Google (simpler)
    asyncio.run(test_simple_google_scout())
    
    # Then test with Airtable (more complex)
    # asyncio.run(test_airtable_filter_scout())
    
    print("\n✅ Scout Engine tests completed!")