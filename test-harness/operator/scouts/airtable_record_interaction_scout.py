#!/usr/bin/env python3
"""
Airtable Record Interaction Scout Mission
Director: Gathering intelligence for bulletproof record updates
Focus: Grid selection, record modal editing, and field interactions
"""

import asyncio
import sys
import os
from datetime import datetime

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scout_engine import ScoutEngine

async def run_record_interaction_reconnaissance():
    scout = ScoutEngine()  # Uses Gemini 2.5 Pro by default
    
    mission = '''
    AIRTABLE RECORD INTERACTION DEEP RECONNAISSANCE
    
    OBJECTIVE: Map the complete record selection and editing flow to enable deterministic automation of record updates.
    
    CONTEXT: We have mastered the filter system but lack intelligence on:
    1. How to reliably select records from the filtered grid
    2. How to interact with the record edit modal/view
    3. How to update specific fields (Last Contact, Notes)
    4. How to ensure changes are saved
    
    CREDENTIALS:
    - Login method: Google OAuth (Continue with Google)
    - Email: michaelburner595@gmail.com
    - Password: dCdWqhgPzJev6Jz
    
    RECONNAISSANCE TARGETS:
    
    PHASE 1 - GRID STRUCTURE & RECORD SELECTION
    1. Navigate to https://airtable.com/appTnT68Rt8yHIGV3 and login if needed
    2. Apply a filter (Email contains "test" or any value that returns 1-3 records)
    3. Analyze the filtered grid structure:
       - What's the DOM structure of record rows?
       - Look for data-rowindex, data-recordid, or similar attributes
       - Find the most reliable selector for "first record in filtered results"
       - Can you select by position (1st, 2nd, 3rd row)?
       - What happens when you hover over a row?
    4. Document multiple ways to select a specific record:
       - By position in grid
       - By content (e.g., investor name)
       - By data attributes
       - Which method is most stable?
    
    PHASE 2 - RECORD MODAL/VIEW ANALYSIS
    1. Click on a filtered record to open it
    2. Document what happens:
       - Does it open as a modal, sidebar, or new view?
       - How long does it take to fully load?
       - What's the container selector for the record view?
       - Is there a unique identifier for the opened record?
    3. Analyze the record view structure:
       - How are fields organized?
       - Can you identify fields by label?
       - Are there data attributes on field containers?
    
    PHASE 3 - FIELD IDENTIFICATION & INTERACTION
    1. Find the "Last Contact" field:
       - What type of field is it? (date picker, text input, etc.)
       - Document ALL selectors to reach this field
       - How do you click/focus it?
       - How do you clear existing value?
       - How do you enter a new date?
       - Does it accept text format like "06/02/2025" or need picker?
    
    2. Find the "Notes" field:
       - What type is it? (textarea, rich text, etc.)
       - Document ALL selectors
       - How do you append text (not replace)?
       - Do you need to click at the end first?
       - Can you just type or need special handling?
    
    3. Test field interaction patterns:
       - Click field → Type → Does it auto-save?
       - Do you need to click elsewhere to trigger save?
       - Any loading indicators during save?
       - How to verify save completed?
    
    PHASE 4 - RECORD SAVE & CLOSE MECHANISMS  
    1. Document ALL ways to save changes:
       - Is there an explicit Save button?
       - Does it auto-save? After how long?
       - Visual indicators of saving/saved state?
       - What triggers a save?
    
    2. Document ALL ways to close the record:
       - X button? Where located?
       - Escape key?
       - Click outside?
       - Which is most reliable?
    
    3. After closing, verify:
       - Are you back at the filtered grid?
       - Is the filter still active?
       - Can you see your changes in the grid view?
    
    PHASE 5 - EDGE CASES & ERROR STATES
    1. What if a field is read-only?
    2. What if save fails (network issue)?
    3. Multiple records with same email - how to handle?
    4. Can multiple records be open at once?
    5. Concurrent edit warnings?
    
    DELIVERABLE:
    Save your complete findings to 'results.md' using the write_file action with this JSON structure:
    
    {
        "grid_selection": {
            "row_structure": "describe DOM pattern",
            "first_record_selectors": ["primary", "fallback1", "fallback2"],
            "selection_by_position": "how to select nth row",
            "selection_by_content": "how to select by name/email",
            "most_reliable_method": "which approach to use"
        },
        "record_view": {
            "open_method": "modal|sidebar|view",
            "load_time_ms": number,
            "container_selector": "...",
            "close_methods": ["method1", "method2"],
            "most_reliable_close": "..."
        },
        "field_interactions": {
            "last_contact": {
                "field_type": "date|text|picker",
                "selectors": ["primary", "fallbacks"],
                "interaction_sequence": ["step1", "step2"],
                "date_format_accepted": "MM/DD/YYYY or picker"
            },
            "notes": {
                "field_type": "textarea|richtext",
                "selectors": ["primary", "fallbacks"],
                "append_method": "click_end_then_type|direct_append",
                "special_handling": "any quirks"
            }
        },
        "save_mechanism": {
            "auto_save": true|false,
            "auto_save_delay_ms": number,
            "explicit_save_button": "selector or null",
            "save_indicators": ["saving_text", "checkmark", "etc"],
            "verification_method": "how to confirm saved"
        },
        "recommended_sequence": [
            "1. Click record using: ...",
            "2. Wait X ms for load",
            "3. Update Last Contact by: ...",
            "4. Update Notes by: ...",
            "5. Save by: ...",
            "6. Close by: ...",
            "7. Verify by: ..."
        ]
    }
    
    CRITICAL: Test each selector multiple times to ensure reliability!
    '''
    
    print("\n🎯 Deploying Airtable Record Interaction Scout...")
    print("=" * 60)
    print("Mission: Deep reconnaissance of record selection and editing")
    print("Focus: Grid interaction, field updates, save mechanisms")
    print("=" * 60)
    
    try:
        result = await scout.deploy_scout(
            mission=mission,
            target_url='https://airtable.com/appTnT68Rt8yHIGV3',
            max_steps=40
        )
        
        print("\n✅ SCOUT MISSION COMPLETE")
        print("=" * 60)
        print("\n📊 Scout Report:")
        print(result[:1000] + "..." if len(result) > 1000 else result)
        
        # Save report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = f"./reports/airtable_record_scout_{timestamp}.md"
        os.makedirs("./reports", exist_ok=True)
        
        with open(report_file, 'w') as f:
            f.write(result)
        
        print(f"\n📄 Full report saved to: {report_file}")
        print("💡 Check results.md for structured findings")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Scout mission failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_record_interaction_reconnaissance())