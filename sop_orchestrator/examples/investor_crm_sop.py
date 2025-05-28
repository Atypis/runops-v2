"""
🎯 Investor CRM SOP Example

This demonstrates the complete orchestration platform running
our investor email review and CRM update workflow with:
- Multi-agent orchestration
- Human oversight via web cockpit
- Complete audit trails
- Error recovery
"""

import asyncio
import json
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv(dotenv_path="../.env")

from ..core.orchestrator import SOPOrchestrator
from ..cockpit.web_server import run_cockpit
from ..integrations.browser_use_wrapper import quick_setup_with_credentials


async def main():
    """
    Run the complete investor CRM SOP orchestration demo
    """
    
    print("🚀 Starting SOP Orchestrator Demo")
    print("=" * 60)
    
    # Load the SOP definition
    sop_path = Path(__file__).parent.parent / "app_frontend/public/latest-sop-v0.8.json"
    
    if not sop_path.exists():
        print("❌ SOP definition not found. Expected at:", sop_path)
        return
    
    with open(sop_path, 'r') as f:
        sop_definition = json.load(f)
    
    print(f"📋 Loaded SOP: {sop_definition['meta']['title']}")
    print(f"🎯 Goal: {sop_definition['meta']['goal']}")
    
    # Get credentials from environment
    gmail_user = os.getenv("GMAIL_USER")
    gmail_pass = os.getenv("GMAIL_PASS")
    airtable_user = os.getenv("AIRTABLE_USER")
    airtable_pass = os.getenv("AIRTABLE_PASS")
    
    if not all([gmail_user, gmail_pass, airtable_user, airtable_pass]):
        print("❌ Missing credentials in .env file")
        print("Required: GMAIL_USER, GMAIL_PASS, AIRTABLE_USER, AIRTABLE_PASS")
        return
    
    print(f"🔑 Using credentials for: {gmail_user}")
    
    # Setup enhanced browser-use
    browser_use = await quick_setup_with_credentials(
        gmail_user=gmail_user,
        gmail_pass=gmail_pass,
        airtable_user=airtable_user,
        airtable_pass=airtable_pass,
    )
    
    # Create orchestrator
    orchestrator = SOPOrchestrator(
        browser_use_config={
            "headless": False,  # Show browser for demo
            "timeout": 30,
        }
    )
    
    # Setup browser-use integration
    orchestrator.browser_use = browser_use
    
    print("🎮 Starting Web Cockpit...")
    print("   Navigate to: http://localhost:8080")
    print("   The cockpit will show real-time mission progress")
    print("")
    
    # Start the web cockpit in background
    cockpit_task = asyncio.create_task(
        run_cockpit(orchestrator=orchestrator, port=8080)
    )
    
    # Give the server a moment to start
    await asyncio.sleep(2)
    
    print("🎯 Starting Mission Execution...")
    print("=" * 60)
    
    try:
        # Execute the mission with human oversight
        result = await orchestrator.execute_mission(
            sop_definition=sop_definition,
            human_oversight=True,  # Enable human approval points
            max_retries=2,
        )
        
        print("\n" + "=" * 60)
        print("✅ Mission Completed Successfully!")
        print(f"📊 Mission ID: {result['mission_id']}")
        print(f"📝 Status: {result['status']}")
        
        # Print summary of results
        for phase_name, phase_result in result['results'].items():
            print(f"   {phase_name}: {phase_result.get('status', 'completed')}")
        
        print(f"\n📋 Audit Trail: {len(result['audit_trail'])} events logged")
        print(f"🔖 Checkpoints: {len(result['checkpoints'])} created")
        
    except KeyboardInterrupt:
        print("\n⏸️ Mission interrupted by user")
        await orchestrator.cleanup()
        
    except Exception as e:
        print(f"\n❌ Mission failed: {e}")
        await orchestrator.cleanup()
    
    finally:
        # Keep cockpit running for inspection
        print("\n🔍 Mission complete. Cockpit still running for inspection.")
        print("   Visit http://localhost:8080 to view results")
        print("   Press Ctrl+C to shutdown")
        
        try:
            await cockpit_task
        except KeyboardInterrupt:
            print("\n👋 Shutting down...")
            cockpit_task.cancel()


async def run_demo_without_cockpit():
    """
    Simplified demo that runs without the web interface
    """
    
    print("🚀 SOP Orchestrator - Simplified Demo")
    print("=" * 50)
    
    # Create simple orchestrator
    orchestrator = SOPOrchestrator()
    
    # Mock SOP for demo
    demo_sop = {
        "meta": {
            "title": "Demo Workflow",
            "goal": "Demonstrate orchestration capabilities"
        },
        "steps": [
            {"text": "Navigate to google.com"},
            {"text": "Search for 'hello world'"},
            {"text": "Take screenshot of results"},
        ]
    }
    
    try:
        result = await orchestrator.execute_mission(
            sop_definition=demo_sop,
            human_oversight=False,  # No human intervention for demo
            max_retries=1,
        )
        
        print("✅ Demo completed!")
        print(f"Mission ID: {result['mission_id']}")
        
    except Exception as e:
        print(f"❌ Demo failed: {e}")
    
    finally:
        await orchestrator.cleanup()


if __name__ == "__main__":
    # Check if this is a full demo or simplified
    import sys
    
    if "--simple" in sys.argv:
        asyncio.run(run_demo_without_cockpit())
    else:
        asyncio.run(main()) 