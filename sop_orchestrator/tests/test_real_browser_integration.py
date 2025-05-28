#!/usr/bin/env python3
"""
🧪 Test Real Browser-Use Integration

Quick test to verify that the visual monitoring system works with real browser-use.
"""

import asyncio
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add browser-use directory to path (it's installed locally)
browser_use_path = Path(__file__).parent / "browser-use"
if str(browser_use_path) not in sys.path:
    sys.path.insert(0, str(browser_use_path))

# Add sop_orchestrator to path
sop_path = Path(__file__).parent / "sop_orchestrator"
if str(sop_path) not in sys.path:
    sys.path.insert(0, str(sop_path))

async def test_browser_use_integration():
    """Test basic browser-use integration"""
    
    print("🧪 Testing Real Browser-Use Integration...")
    
    try:
        # Test browser-use import with correct paths
        from browser_use import BrowserSession, BrowserProfile
        print("✅ browser-use imported successfully")
        
        # Test visual monitor import
        from core.visual_monitor import VisualMonitor, ActionType
        print("✅ Visual monitor imported successfully")
        
        # Create browser profile
        profile = BrowserProfile(
            headless=False,  # Show browser for testing
            highlight_elements=True,
            viewport_expansion=0
        )
        
        # Create browser session
        browser_session = BrowserSession(browser_profile=profile)
        await browser_session.start()
        print("✅ Browser session started")
        
        # Create visual monitor
        visual_monitor = VisualMonitor(browser_session, "test_agent")
        await visual_monitor.start_monitoring()
        print("✅ Visual monitoring started")
        
        # Test navigation
        print("\n📱 Navigating to test page...")
        await browser_session.navigate("https://example.com")
        await asyncio.sleep(3)
        
        # Capture state
        state = await visual_monitor.capture_state("test_navigation")
        print(f"✅ State captured: {state.url}")
        print(f"   Screenshot available: {bool(state.screenshot_path)}")
        print(f"   Interactive elements: {state.clickable_elements.get('total_elements', 0) if state.clickable_elements else 0}")
        
        # Test another navigation
        print("\n📱 Navigating to another test page...")
        await browser_session.navigate("https://httpbin.org/")
        await asyncio.sleep(3)
        
        # Capture another state
        state2 = await visual_monitor.capture_state("test_navigation_2")
        print(f"✅ State 2 captured: {state2.url}")
        print(f"   Interactive elements: {state2.clickable_elements.get('total_elements', 0) if state2.clickable_elements else 0}")
        
        # Test action annotation
        await visual_monitor.annotate_action(
            action_type=ActionType.NAVIGATE,
            description="Test navigation action",
            input_value="https://httpbin.org/",
            success=True,
            duration=3.0
        )
        print("✅ Action annotated")
        
        # Show timeline summary
        print(f"\n📊 Timeline Summary:")
        print(f"   Total states: {len(visual_monitor.timeline)}")
        for i, state in enumerate(visual_monitor.timeline):
            elements = state.clickable_elements.get("total_elements", 0) if state.clickable_elements else 0
            action_desc = state.action.description if state.action else "State capture"
            print(f"   {i+1}. {state.url} - {action_desc} ({elements} elements)")
        
        # Export timeline
        export_path = await visual_monitor.export_timeline()
        print(f"✅ Timeline exported to: {export_path}")
        
        # Cleanup
        await visual_monitor.stop_monitoring()
        await browser_session.stop()
        print("✅ Cleanup completed")
        
        print("\n🎉 All tests passed! Real browser-use integration is working.")
        return True
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("   Make sure browser-use is available in the browser-use/ directory")
        return False
    except Exception as e:
        print(f"❌ Test failed: {e}")
        return False

async def main():
    """Main test function"""
    
    print("🎥 Real Browser-Use Integration Test")
    print("=" * 50)
    
    success = await test_browser_use_integration()
    
    if success:
        print("\n✅ Integration test completed successfully!")
        print("   You can now run the full demo with: python sop_orchestrator/real_browser_demo.py")
    else:
        print("\n❌ Integration test failed!")
        print("   Please check the error messages above.")

if __name__ == "__main__":
    asyncio.run(main()) 