#!/usr/bin/env python3
"""
🎬 SOP Orchestrator Demo

This demonstrates the platform's capabilities with a simulated
investor CRM workflow. Shows:
- Multi-agent coordination
- Human cockpit interface
- Real-time monitoring
- Complete audit trails
"""

import asyncio
import os
import sys
from pathlib import Path

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.orchestrator import SOPOrchestrator
from cockpit.web_server import run_cockpit


async def run_demo():
    """Run the orchestration demo"""
    
    print("🎬 SOP Orchestrator Demo")
    print("=" * 50)
    print("")
    print("This demo shows a production-ready AI automation platform with:")
    print("• Multi-agent orchestration")
    print("• Real-time human cockpit")
    print("• Complete auditability")
    print("• Graceful error recovery")
    print("")
    
    # Demo SOP - simulating investor email workflow
    demo_sop = {
        "meta": {
            "title": "Investor Email CRM Update",
            "goal": "Review investor emails and update CRM with contact information",
            "description": "Automated workflow to process investor communications and maintain accurate contact records"
        },
        "steps": [
            {"text": "Login to Gmail account"},
            {"text": "Search for emails from investors in the last 30 days"},
            {"text": "Extract contact information from email signatures"},
            {"text": "Login to Airtable CRM"},
            {"text": "Update investor contact records"},
            {"text": "Create follow-up tasks for sales team"},
            {"text": "Generate summary report"}
        ]
    }
    
    # Create orchestrator
    orchestrator = SOPOrchestrator()
    
    print(f"📋 Demo SOP: {demo_sop['meta']['title']}")
    print(f"🎯 Goal: {demo_sop['meta']['goal']}")
    print("")
    
    # Ask user how they want to run the demo
    print("🎮 Demo Options:")
    print("1. Full demo with web cockpit (recommended)")
    print("2. Simple command-line demo")
    print("3. Platform test only")
    print("")
    
    try:
        choice = input("Choose option (1-3): ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\n👋 Demo cancelled")
        return
    
    if choice == "1":
        await run_full_demo(orchestrator, demo_sop)
    elif choice == "2":
        await run_simple_demo(orchestrator, demo_sop)
    elif choice == "3":
        await run_platform_test()
    else:
        print("❌ Invalid choice")


async def run_full_demo(orchestrator, demo_sop):
    """Run demo with web cockpit"""
    
    print("🎮 Starting Web Cockpit Mission Control...")
    print("")
    print("📡 Web cockpit will start at: http://localhost:8081")
    print("🖥️  Open this URL in your browser to control missions")
    print("")
    print("⏳ Starting web server...")
    
    # Start cockpit in background
    cockpit_task = asyncio.create_task(
        run_cockpit(orchestrator=orchestrator, port=8081)
    )
    
    # Give server time to start
    await asyncio.sleep(3)
    
    print("✅ Web cockpit started!")
    print("")
    print("🎯 Ready for mission control!")
    print("   🌐 Open: http://localhost:8081")
    print("   🚀 Click 'Start Mission' in the web interface")
    print("   🤖 Watch agents work in real-time")
    print("   ✋ Approve phases when prompted")
    print("")
    print("Press Ctrl+C to shutdown the cockpit")
    
    try:
        # Keep cockpit running - missions will be triggered from web interface
        await cockpit_task
        
    except KeyboardInterrupt:
        print("\n⏸️ Cockpit shutdown by user")
        cockpit_task.cancel()
    
    finally:
        await orchestrator.cleanup()


async def run_simple_demo(orchestrator, demo_sop):
    """Run simple command-line demo"""
    
    print("🚀 Starting Simple Demo (command-line only)...")
    print("")
    
    try:
        result = await orchestrator.execute_mission(
            sop_definition=demo_sop,
            human_oversight=False,  # No human intervention for simple demo
            max_retries=1,
        )
        
        print("✅ Demo completed successfully!")
        print(f"Mission ID: {result['mission_id']}")
        print("")
        
        # Show results
        print("📋 Phase Results:")
        for phase_name, phase_result in result['results'].items():
            print(f"   • {phase_name}: {phase_result.get('status', 'unknown')}")
        
        print(f"\n📝 Events logged: {len(result['audit_trail'])}")
        print(f"🔖 Checkpoints: {len(result['checkpoints'])}")
        
    except Exception as e:
        print(f"❌ Demo failed: {e}")
    
    finally:
        await orchestrator.cleanup()


async def run_platform_test():
    """Run platform test"""
    
    print("🧪 Running Platform Test...")
    print("")
    
    # Import and run test
    try:
        from test_platform import main as test_main
        success = await test_main()
        
        if success:
            print("\n🎉 Platform test passed! Ready for production use.")
        else:
            print("\n⚠️ Platform test failed. Please check the logs.")
            
    except ImportError:
        print("❌ Test module not found")
    except Exception as e:
        print(f"❌ Test failed: {e}")


def main():
    """Main entry point"""
    
    # Check if we're in the right directory
    if not Path("core/orchestrator.py").exists():
        print("❌ Please run this demo from the sop_orchestrator directory")
        print("   cd sop_orchestrator && python demo.py")
        return
    
    # Run the demo
    try:
        asyncio.run(run_demo())
    except KeyboardInterrupt:
        print("\n👋 Demo terminated by user")


if __name__ == "__main__":
    main() 