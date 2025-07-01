#!/usr/bin/env python3
"""
Scout Engine test - Find Airtable sign-in page selectors
"""

import asyncio
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scouts import browser_use_patch
from scouts.scout_engine import ScoutEngine


async def scout_airtable_signin():
    """Deploy scout to find Airtable sign-in selectors."""
    
    print("🚀 Scout Engine - Airtable Sign-in Page Reconnaissance")
    print("=" * 60)
    
    # Verify monkey patch
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    print(f"✅ Monkey patch active - {len(browser_use_patch.SCOUT_WHITELIST)} attributes visible")
    
    # Create scout engine
    engine = ScoutEngine()
    
    # Direct mission to sign-in page
    mission = """Navigate to https://airtable.com/signin and analyze the sign-in form.
    
    Find and document in results.md:
    1. Email/username input field - ALL selectors including id, data-testid, name
    2. Password input field - ALL selectors
    3. Sign in button - ALL selectors
    4. "Continue with Google" button (if present) - ALL selectors
    
    For each element, list:
    - Element type and tag
    - ALL attributes visible with enhanced DOM (especially id, data-testid, data-qa, name, type)
    - Top 3 most stable selectors ranked
    
    Thanks to the enhanced DOM visibility, you should see attributes that are normally hidden."""
    
    print(f"\n📋 Mission: Analyze Airtable sign-in form")
    print(f"🌐 Target: https://airtable.com/signin")
    print(f"🤖 Model: Gemini 2.5 Pro")
    
    print("\n🔍 Deploying Scout...")
    start_time = datetime.now()
    
    try:
        # Deploy to signin page directly
        report = await engine.deploy_scout(
            mission=mission,
            target_url="https://airtable.com/signin",
            max_steps=8
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        print(f"\n✅ Scout completed in {duration:.1f} seconds")
        
        # Find results
        import time
        temp_base = "/var/folders/tv/6j2tctm51r11zpsj611xz5nr0000gn/T/"
        most_recent = None
        most_recent_time = 0
        
        for entry in os.listdir(temp_base):
            if entry.startswith("browser_use_agent_"):
                results_file = os.path.join(temp_base, entry, "browseruse_agent_data", "results.md")
                if os.path.exists(results_file):
                    mtime = os.path.getmtime(results_file)
                    if mtime > most_recent_time and (time.time() - mtime) < 120:
                        most_recent = results_file
                        most_recent_time = mtime
        
        if most_recent and os.path.getsize(most_recent) > 0:
            print(f"\n📋 SCOUT FINDINGS:")
            print("-" * 60)
            with open(most_recent, 'r') as f:
                print(f.read())
            print("-" * 60)
        else:
            print("\n⚠️ No results found, showing report:")
            print(report)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(scout_airtable_signin())