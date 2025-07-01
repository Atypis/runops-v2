#!/usr/bin/env python3
"""
Quick test to see Scout results
"""

import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scouts.scout_engine import ScoutEngine


async def quick_scout_test():
    """Quick test with immediate results."""
    
    print("🚀 Quick Scout Test - OpenAI Login")
    print("=" * 40)
    
    engine = ScoutEngine()
    
    # Simple mission
    mission = """Go to https://openai.com and find the login button.
    Write the top 3 selectors for it in results.md, ranked by stability."""
    
    try:
        # Deploy scout
        report = await engine.deploy_scout(
            mission=mission,
            max_steps=5  # Very quick
        )
        
        print("\n📄 SCOUT REPORT:")
        print(report)
        
        # Try to find and read results.md from temp directories
        print("\n🔍 Looking for results.md files...")
        temp_base = "/var/folders/tv/6j2tctm51r11zpsj611xz5nr0000gn/T/"
        
        # Find recent browser_use_agent directories
        for entry in os.listdir(temp_base):
            if entry.startswith("browser_use_agent_"):
                agent_dir = os.path.join(temp_base, entry)
                results_file = os.path.join(agent_dir, "results.md")
                
                if os.path.exists(results_file):
                    # Check modification time
                    mtime = os.path.getmtime(results_file)
                    import time
                    age = time.time() - mtime
                    
                    if age < 300:  # Less than 5 minutes old
                        print(f"\n✅ Found recent results.md (age: {age:.1f}s)")
                        print(f"   Path: {results_file}")
                        print("\n📋 CONTENTS:")
                        print("-" * 40)
                        with open(results_file, 'r') as f:
                            print(f.read())
                        print("-" * 40)
                        break
        
    except Exception as e:
        print(f"\n❌ Error: {e}")


if __name__ == "__main__":
    asyncio.run(quick_scout_test())