#!/usr/bin/env python3
"""
🔧 Test Screenshot Fixes

Test the improved screenshot capture with proper timing and quality verification.
"""

import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Add browser-use directory to path (it's installed locally)
browser_use_path = Path(__file__).parent.parent.parent / "browser-use"
if str(browser_use_path) not in sys.path:
    sys.path.insert(0, str(browser_use_path))

# Add the project root to Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

import structlog

# Configure logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger(__name__)

async def test_improved_screenshots():
    """Test the improved screenshot capture system"""
    print("🔧 Testing improved screenshot capture...")
    
    # Check for API key
    google_api_key = os.getenv('GOOGLE_API_KEY')
    if not google_api_key:
        print("❌ No GOOGLE_API_KEY found in environment variables")
        print("   Please ensure the .env file contains GOOGLE_API_KEY")
        return
    
    print(f"✅ Using Gemini API key: {google_api_key[:10]}...")
    
    try:
        # Import browser-use components
        from browser_use import BrowserSession, BrowserProfile
        from sop_orchestrator.core.visual_monitor import VisualMonitor, ActionType
        print("✅ Imported browser-use and visual monitor")
        
        # Create browser profile with element highlighting
        profile = BrowserProfile(
            headless=False,  # Show browser for testing
            highlight_elements=True,
            viewport_expansion=0
        )
        
        # Create browser session
        browser_session = BrowserSession(browser_profile=profile)
        await browser_session.start()
        print("✅ Browser session started")
        
        # Initialize visual monitor with improvements
        visual_monitor = VisualMonitor(
            browser_session=browser_session,
            agent_id="screenshot_test"
        )
        
        print("📸 Starting visual monitoring...")
        await visual_monitor.start_monitoring()
        
        # Test sequence with proper timing
        test_urls = [
            "https://example.com",
            "https://httpbin.org/forms/post",
            "https://jsonplaceholder.typicode.com/posts"
        ]
        
        for i, url in enumerate(test_urls):
            print(f"🔗 Navigating to {url}...")
            
            # Navigate and wait for page load
            await browser_session.navigate(url)
            
            # Wait for page to be fully ready
            await asyncio.sleep(3)  # Increased wait time
            
            # Capture state with improved timing
            print(f"📷 Capturing state {i+1}...")
            state = await visual_monitor.capture_state(f"test_navigation_{i+1}")
            
            # Verify screenshot quality
            if state.screenshot_path:
                screenshot_file = Path(state.screenshot_path)
                if screenshot_file.exists():
                    file_size = screenshot_file.stat().st_size
                    print(f"   ✅ Screenshot saved: {file_size} bytes")
                    
                    if file_size < 1024:
                        print(f"   ⚠️  WARNING: Screenshot too small ({file_size} bytes)")
                    else:
                        print(f"   🎉 Good screenshot size: {file_size} bytes")
                        
                        # Additional quality checks
                        try:
                            from PIL import Image
                            with Image.open(screenshot_file) as img:
                                width, height = img.size
                                print(f"   📐 Dimensions: {width}x{height}")
                                if width > 100 and height > 100:
                                    print(f"   ✅ Good dimensions")
                                else:
                                    print(f"   ⚠️  Small dimensions: {width}x{height}")
                        except Exception as e:
                            print(f"   ⚠️  Could not verify image: {e}")
                else:
                    print(f"   ❌ Screenshot file not found: {state.screenshot_path}")
            else:
                print("   ❌ No screenshot path")
            
            # Check browser-use integration data
            if state.clickable_elements:
                elements_count = state.clickable_elements.get("total_elements", 0)
                print(f"   🎯 Detected {elements_count} interactive elements")
            
            if state.selector_map:
                print(f"   🗺️  Selector map has {len(state.selector_map)} entries")
            
            # Annotate the action
            await visual_monitor.annotate_action(
                action_type=ActionType.NAVIGATE,
                description=f"Navigate to {url}",
                input_value=url,
                success=True,
                duration=3.0
            )
            print(f"   📝 Action annotated")
            
            # Small delay between captures
            await asyncio.sleep(2)
        
        # Export timeline
        print("📊 Exporting timeline...")
        export_path = await visual_monitor.export_timeline()
        print(f"   📁 Timeline exported to: {export_path}")
        
        # Summary
        print(f"\n📈 Test Summary:")
        print(f"   Total states captured: {len(visual_monitor.timeline)}")
        print(f"   Screenshots with paths: {len([s for s in visual_monitor.timeline if s.screenshot_path])}")
        
        # Check screenshot file sizes
        screenshot_sizes = []
        for state in visual_monitor.timeline:
            if state.screenshot_path and Path(state.screenshot_path).exists():
                size = Path(state.screenshot_path).stat().st_size
                screenshot_sizes.append(size)
        
        if screenshot_sizes:
            avg_size = sum(screenshot_sizes) / len(screenshot_sizes)
            min_size = min(screenshot_sizes)
            max_size = max(screenshot_sizes)
            
            print(f"   Screenshot sizes - Min: {min_size}, Max: {max_size}, Avg: {avg_size:.0f} bytes")
            
            # Quality assessment
            good_screenshots = len([s for s in screenshot_sizes if s > 1024])
            print(f"   Quality assessment: {good_screenshots}/{len(screenshot_sizes)} screenshots > 1KB")
            
            if good_screenshots == len(screenshot_sizes):
                print("   🎉 All screenshots passed quality check!")
            else:
                print(f"   ⚠️  {len(screenshot_sizes) - good_screenshots} screenshots failed quality check")
        
        # Browser-use integration summary
        browser_use_states = len([s for s in visual_monitor.timeline if s.clickable_elements])
        print(f"   Browser-use integration: {browser_use_states}/{len(visual_monitor.timeline)} states with element data")
        
        # Detailed timeline info
        print(f"\n📋 Detailed Timeline:")
        for i, state in enumerate(visual_monitor.timeline):
            elements = state.clickable_elements.get("total_elements", 0) if state.clickable_elements else 0
            action_desc = state.action.description if state.action else "State capture"
            screenshot_size = Path(state.screenshot_path).stat().st_size if state.screenshot_path and Path(state.screenshot_path).exists() else 0
            print(f"   {i+1}. {state.url}")
            print(f"      Action: {action_desc}")
            print(f"      Elements: {elements}, Screenshot: {screenshot_size} bytes")
        
    except Exception as e:
        logger.error("Test failed", error=str(e))
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        print("🧹 Cleaning up...")
        try:
            await visual_monitor.stop_monitoring()
            await browser_session.stop()
        except:
            pass
        print("✅ Test completed!")

if __name__ == "__main__":
    asyncio.run(test_improved_screenshots()) 