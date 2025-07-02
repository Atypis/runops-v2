#!/usr/bin/env python3
"""
Airtable Filter System Deep Reconnaissance Mission
Using Scout Engine directly
"""

import asyncio
import sys
import os

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scout_engine import ScoutEngine

async def run_airtable_filter_reconnaissance():
    # Initialize Scout Engine (uses Gemini 2.5 Pro by default)
    scout = ScoutEngine()
    
    # Critical mission briefing
    mission = '''
    AIRTABLE FILTER SYSTEM DEEP RECONNAISSANCE MISSION

    OBJECTIVE: Complete forensic analysis of Airtable's filter functionality to enable bulletproof automation.

    CONTEXT: Previous automation attempts failed due to incomplete understanding of filter states, persistence, and clearing mechanisms.

    CREDENTIALS FOR LOGIN:
    - Login method: Google OAuth (Continue with Google)
    - Email: michaelburner595@gmail.com
    - Password: dCdWqhgPzJev6Jz
    - If account chooser appears, select the account with email above

    CRITICAL REQUIREMENTS:
    - You have Browser-Use with 33 DOM attributes visible (including id, data-testid, data-qa, etc.)
    - Document EXACT selectors, prioritizing data-testid attributes
    - Measure precise timings for all operations
    - Test filter persistence and state management

    RECONNAISSANCE TARGETS:

    PHASE 0 - LOGIN (if needed)
    1. Navigate to https://airtable.com/appTnT68Rt8yHIGV3
    2. If you see a login screen:
       - Click "Continue with Google" button
       - Enter email: michaelburner595@gmail.com
       - Click Next
       - Enter password: dCdWqhgPzJev6Jz
       - Click Next
       - If account chooser appears, click on the account
       - Wait for Airtable to load

    PHASE 1 - FILTER PANEL STATES (Critical Priority)
    1. Ensure you're on the Airtable base (https://airtable.com/appTnT68Rt8yHIGV3)
    2. Document initial state:
       - Are any filters currently active?
       - Look for filter count badges (e.g., "Filtered (2)")
       - Check for any visual indicators of filtered state
       - Is the filter panel open or closed by default?
    
    3. Find and document ALL selectors for the Filter button:
       - Look for data-testid="view-filter-button" or similar
       - Check aria-label attributes
       - Document any id attributes
       - Note stable class patterns
       - Which selector is most reliable?
    
    4. Click Filter button and precisely measure:
       - Exact animation duration until panel is fully open
       - What DOM element appears/changes? (Container selector?)
       - Can you detect panel open state programmatically?
       - Is there an overlay or just a panel?
    
    5. With panel open, carefully analyze:
       - Is there a "Clear all" button? What's its exact selector?
       - How many filter conditions currently exist?
       - What's the DOM structure of existing conditions?
       - Can you identify individual condition rows?

    PHASE 2 - FILTER CONFIGURATION DEEP DIVE
    1. Find and click "Add condition" button:
       - Document ALL possible selectors
       - What happens in the DOM when clicked?
       - Is a new row created? What's its structure?
       - Any unique attributes on the new condition row?
    
    2. Field Selection Analysis:
       - How do you select the field? Dropdown? Input?
       - Click/focus the field selector
       - Can you type "Email" to search?
       - What's the exact selector for the "Email" option?
       - Is it a <select>, <input>, or custom component?
    
    3. Operator Selection:
       - After selecting Email field, how to choose operator?
       - Find selector for "contains" operator
       - Is "contains" the default or must you change it?
       - Dropdown or button group?
    
    4. Value Input:
       - Locate the value input field selector
       - Does it auto-focus after operator selection?
       - Any placeholder text or aria-label?
       - Can you just type immediately?
    
    5. Filter Application:
       - Is there an explicit "Apply" button or does it auto-apply?
       - If auto-apply, how long after typing?
       - How can you detect filter is being processed?
       - What DOM changes indicate filter is complete?
       - Does the grid show a loading state?

    PHASE 3 - FILTER CLEARING AND STATE MANAGEMENT
    1. With one filter active:
       - Document every way to remove it
       - Is there an X or remove button on the condition row?
       - What's the selector for individual condition removal?
       - What happens when you click it?
    
    2. Test "Clear all" functionality:
       - Add 2-3 different filters
       - Find and click "Clear all"
       - How long does clearing take?
       - Does grid refresh automatically?
       - Any confirmation dialog?
    
    3. Filter Persistence Test:
       - Add a filter
       - Close filter panel (how? Click outside? X button? Esc key?)
       - Reopen filter panel
       - Is the filter still there?
       - Is it still active on the grid?
    
    4. Critical: Panel Close Methods:
       - Document ALL ways to close filter panel
       - Click outside?
       - Escape key?
       - Specific close button?
       - Which is most reliable?

    PHASE 4 - EDGE CASES AND RECOVERY
    1. Zero Results Scenario:
       - Apply filter that returns no records
       - What does the grid show?
       - Any special empty state?
       - Can you still clear the filter?
    
    2. Multiple Same-Field Filters:
       - Try adding "Email contains X" twice
       - Does it allow duplicates?
       - How does it handle this?
    
    3. Maximum Filters:
       - Keep adding conditions
       - Is there a limit?
       - UI changes at capacity?
    
    4. Network/Performance:
       - Note any loading delays
       - Timeout risks?

    DELIVERABLE FORMAT:
    {
        "filter_button": {
            "selectors": ["primary_selector", "fallback1", "fallback2"],
            "most_stable": "which one to use",
            "notes": "any quirks"
        },
        "panel_states": {
            "open_detection": "how to know panel is open",
            "close_methods": ["method1", "method2"],
            "animation_time": milliseconds
        },
        "add_condition": {
            "button_selector": "...",
            "new_row_selector": "...",
            "field_selection": {
                "method": "dropdown|input|select",
                "email_selector": "...",
                "interaction": "click|type|both"
            },
            "operator_selection": {...},
            "value_input": {...}
        },
        "filter_clearing": {
            "clear_all_selector": "...",
            "individual_remove": "...",
            "persistence": "filters persist after panel close: true|false"
        },
        "timings": {
            "panel_open": ms,
            "filter_apply": ms,
            "grid_refresh": ms,
            "clear_filters": ms
        },
        "recovery_strategies": {
            "zero_results": "how to handle",
            "stuck_panel": "how to close",
            "stale_filters": "how to clear"
        },
        "recommended_approach": "Step by step best practice"
    }
    '''
    
    print("\n🚀 Deploying Airtable Filter Scout...")
    print("=" * 60)
    print("Mission: Deep reconnaissance of Airtable filter system")
    print("Objective: Enable bulletproof record update automation")
    print("=" * 60)
    
    # Deploy the scout
    try:
        report = await scout.deploy_scout(
            mission=mission,
            target_url='https://airtable.com/appTnT68Rt8yHIGV3',
            max_steps=40
        )
        
        # Display results
        print("\n✅ SCOUT MISSION COMPLETE")
        print("=" * 60)
        print("\n📊 Scout Report:")
        print(report)
        
        # Save report to file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = f"./reports/airtable_filter_scout_{timestamp}.md"
        os.makedirs("./reports", exist_ok=True)
        
        with open(report_file, 'w') as f:
            f.write(report)
        
        print(f"\n📄 Full report saved to: {report_file}")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Scout mission failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    from datetime import datetime
    asyncio.run(run_airtable_filter_reconnaissance())