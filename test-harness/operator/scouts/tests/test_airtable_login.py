#!/usr/bin/env python3
"""
Scout Engine test - Find Airtable login button selectors
"""

import asyncio
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scouts import browser_use_patch
from scouts.scout_engine import ScoutEngine


async def scout_airtable_login():
    """Deploy scout to find Airtable login button selectors."""
    
    print("🚀 Scout Engine - Airtable Login Button Reconnaissance")
    print("=" * 60)
    
    # Verify monkey patch is active
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    print(f"✅ Monkey patch active - {len(browser_use_patch.SCOUT_WHITELIST)} attributes visible")
    print(f"   Enhanced visibility includes: id, data-testid, data-qa, href, data-automation...")
    
    # Create scout engine
    engine = ScoutEngine()
    
    # Define focused mission for Airtable
    mission = """Navigate to https://airtable.com and find the login button/link. 
    
    Your objectives:
    1. Find ALL possible selectors for the login button/link
    2. Look especially for: id, data-testid, data-qa, data-automation, href attributes
    3. Document the TOP 5 most stable selectors, ranked by reliability
    4. Note if it's a button, link, or other element type
    5. Check if there are multiple login options (e.g., "Sign in", "Log in", different positions)
    
    Save your findings in results.md with:
    - Element type (button/link/div)
    - All visible attributes thanks to enhanced DOM visibility
    - Top 5 selectors ranked by stability
    - Any interesting patterns you notice
    
    Focus ONLY on login-related elements."""
    
    print(f"\n📋 Mission: Find login button selectors on Airtable")
    print(f"🌐 Target: https://airtable.com")
    print(f"🤖 Model: Gemini 2.5 Pro")
    print(f"🔧 Temperature: 1.0")
    print(f"👁️ Enhanced DOM: Can see hidden attributes like IDs and test hooks")
    
    print("\n🔍 Deploying Scout...")
    start_time = datetime.now()
    
    try:
        # Deploy scout with focused mission
        report = await engine.deploy_scout(
            mission=mission,
            target_url="https://airtable.com",
            max_steps=10  # Should be enough to find login
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        print(f"\n✅ Scout completed in {duration:.1f} seconds")
        print("\n" + "=" * 60)
        print("SCOUT REPORT:")
        print("=" * 60)
        print(report)
        
        # Try to find and display results.md
        print("\n📄 Looking for detailed results...")
        temp_base = "/var/folders/tv/6j2tctm51r11zpsj611xz5nr0000gn/T/"
        
        # Find the most recent browser_use_agent directory
        import time
        most_recent = None
        most_recent_time = 0
        
        for entry in os.listdir(temp_base):
            if entry.startswith("browser_use_agent_"):
                agent_dir = os.path.join(temp_base, entry)
                results_file = os.path.join(agent_dir, "browseruse_agent_data", "results.md")
                
                if os.path.exists(results_file):
                    mtime = os.path.getmtime(results_file)
                    if mtime > most_recent_time and (time.time() - mtime) < 120:  # Within last 2 minutes
                        most_recent = results_file
                        most_recent_time = mtime
        
        if most_recent:
            print(f"\n✅ Found results.md (age: {time.time() - most_recent_time:.1f}s)")
            print("\n📋 DETAILED FINDINGS:")
            print("-" * 60)
            with open(most_recent, 'r') as f:
                print(f.read())
            print("-" * 60)
        else:
            print("\n⚠️ Could not find results.md file")
        
    except Exception as e:
        print(f"\n❌ Scout mission failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("Testing Scout Engine with Airtable login button mission...\n")
    asyncio.run(scout_airtable_login())