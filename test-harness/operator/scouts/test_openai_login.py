#!/usr/bin/env python3
"""
Quick Scout Engine test - Find OpenAI login button selectors
"""

import asyncio
import sys
import os
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scouts import browser_use_patch
from scouts.scout_engine import ScoutEngine


async def scout_openai_login():
    """Deploy scout to find OpenAI login button selectors."""
    
    print("🚀 Scout Engine - OpenAI Login Button Reconnaissance")
    print("=" * 60)
    
    # Verify monkey patch is active
    if not browser_use_patch.is_patched():
        browser_use_patch.apply_scout_patch()
    
    print(f"✅ Monkey patch active - {len(browser_use_patch.SCOUT_WHITELIST)} attributes visible")
    print(f"   Including: id, data-testid, data-qa, href, data-automation...")
    
    # Create scout engine
    engine = ScoutEngine()
    
    # Define focused mission
    mission = """Navigate to https://openai.com and find the login button. 
    
    Document the TOP 5 most stable DOM selectors for the login button, ranked by stability:
    1. ID selectors (if available)
    2. data-testid or data-qa attributes
    3. Unique aria-label or role combinations
    4. href attribute (for login links)
    5. Stable class combinations
    
    Save your findings in results.md with clear rankings and explanations of why each selector is stable.
    Focus ONLY on the login button/link - ignore other elements."""
    
    print(f"\n📋 Mission: Find top 5 login button selectors on OpenAI")
    print(f"🌐 Target: https://openai.com")
    print(f"🤖 Model: Gemini 2.5 Pro")
    print(f"🔧 Temperature: 1.0")
    
    print("\n🔍 Deploying Scout...")
    start_time = datetime.now()
    
    try:
        # Deploy scout with focused mission
        report = await engine.deploy_scout(
            mission=mission,
            target_url="https://openai.com",
            max_steps=10  # Should be quick - just need to find login button
        )
        
        duration = (datetime.now() - start_time).total_seconds()
        
        print(f"\n✅ Scout completed in {duration:.1f} seconds")
        print("\n" + "=" * 60)
        print("SCOUT REPORT:")
        print("=" * 60)
        print(report)
        
        # Check if results.md was created
        results_path = "/var/folders/tv/6j2tctm51r11zpsj611xz5nr0000gn/T/"
        print(f"\n💡 Check for results.md in the agent's temp directory")
        print(f"   (Scout saves findings there)")
        
    except Exception as e:
        print(f"\n❌ Scout mission failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    print("Testing Scout Engine with OpenAI login button mission...\n")
    asyncio.run(scout_openai_login())