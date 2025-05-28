#!/usr/bin/env python3
"""
🎥 Real Browser-Use Visual Monitoring Demo

Demonstrates the visual monitoring system with REAL browser-use integration:
- Real Chrome browser with actual websites
- Browser-use's built-in element highlighting
- Real screenshots with colored circles around clickable elements
- Interactive timeline with actual browser states
"""

import asyncio
import sys
import os
from pathlib import Path
from dotenv import load_dotenv
import structlog

# Load environment variables
load_dotenv()

# Add browser-use directory to path (it's installed locally)
browser_use_path = Path(__file__).parent.parent / "browser-use"
if str(browser_use_path) not in sys.path:
    sys.path.insert(0, str(browser_use_path))

# Add current directory to path
current_dir = Path(__file__).parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from core.orchestrator import SOPOrchestrator
from core.visual_monitor import VisualMonitor, ActionType
from agents.base_agent import EnhancedBaseAgent
from cockpit.web_server import EnhancedCockpitServer, run_enhanced_cockpit

logger = structlog.get_logger(__name__)


def print_real_browser_banner():
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🎥 REAL BROWSER-USE VISUAL MONITORING DEMO                                ║
║                                                                              ║
║   • Real Chrome Browser with Actual Websites                                ║
║   • Browser-Use's Built-in Element Highlighting                             ║
║   • Real Screenshots with Colored Circles                                   ║
║   • Interactive Timeline with Actual Browser States                         ║
║   • Complete Integration with Browser-Use Library                           ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)


class RealBrowserAgent(EnhancedBaseAgent):
    """Agent that uses real browser-use for visual monitoring"""
    
    def __init__(self, orchestrator=None):
        super().__init__(orchestrator)
        self.role_name = "real_browser_demo"
        self.browser_session = None
    
    async def initialize_browser(self):
        """Initialize real browser-use session"""
        try:
            from browser_use import BrowserSession, BrowserProfile
            
            # Create browser profile
            profile = BrowserProfile(
                headless=False,  # Show the browser window
                highlight_elements=True,  # Enable element highlighting
                viewport_expansion=0,  # Show elements in viewport
            )
            
            # Create browser session
            self.browser_session = BrowserSession(browser_profile=profile)
            await self.browser_session.start()
            
            # Initialize visual monitoring with real browser session
            await self.initialize_visual_monitoring(self.browser_session)
            
            logger.info("Real browser session initialized", agent_id=self.agent_id)
            return True
            
        except ImportError as e:
            logger.error("Browser-use not available", error=str(e))
            return False
        except Exception as e:
            logger.error("Failed to initialize browser", error=str(e))
            return False
    
    async def execute_real_demo_workflow(self):
        """Execute a demo workflow with real browser-use"""
        
        if not await self.initialize_browser():
            raise Exception("Failed to initialize browser session")
        
        print("\n🎬 Starting Real Browser Demo Workflow...")
        print("📱 You should see a Chrome browser window opening...")
        
        try:
            # Demo Step 1: Navigate to a simple website
            await self._real_navigate("https://example.com", "Navigate to Example.com")
            await asyncio.sleep(3)  # Let page load and capture state
            
            # Demo Step 2: Navigate to a more interactive site
            await self._real_navigate("https://httpbin.org/forms/post", "Navigate to HTTPBin form")
            await asyncio.sleep(3)
            
            # Demo Step 3: Try to interact with form elements
            await self._real_interact_with_page("Look for form elements")
            await asyncio.sleep(2)
            
            # Demo Step 4: Navigate to another site
            await self._real_navigate("https://jsonplaceholder.typicode.com/", "Navigate to JSONPlaceholder")
            await asyncio.sleep(3)
            
            # Demo Step 5: Final navigation
            await self._real_navigate("https://httpbin.org/", "Navigate to HTTPBin main page")
            await asyncio.sleep(3)
            
            print("\n✅ Real Browser Demo Workflow Completed!")
            print(f"📊 Timeline captured: {len(self.visual_monitor.timeline)} states")
            print("🎯 Each state contains real browser screenshots with element highlighting!")
            
            # Export timeline
            export_path = await self.visual_monitor.export_timeline()
            print(f"📁 Timeline exported to: {export_path}")
            
            return {
                "status": "completed",
                "timeline_length": len(self.visual_monitor.timeline),
                "export_path": export_path,
                "real_browser": True
            }
            
        finally:
            # Keep browser open for demo
            print("\n⏸️  Browser will stay open for timeline viewing...")
            print("   Close the browser manually when done with the demo")
    
    async def _real_navigate(self, url: str, description: str):
        """Real navigation with browser-use"""
        print(f"🧭 {description}: {url}")
        
        try:
            # Capture before state
            await self.visual_monitor.capture_state(f"before_navigate_{url}")
            
            # Real browser navigation
            await self.browser_session.navigate(url)
            
            # Wait for page to load
            await asyncio.sleep(2)
            
            # Annotate action
            await self.visual_monitor.annotate_action(
                action_type=ActionType.NAVIGATE,
                description=description,
                input_value=url,
                success=True,
                duration=2.0
            )
            
            # Capture after state (this will have browser-use highlights!)
            await self.visual_monitor.capture_state(f"after_navigate_{url}")
            
        except Exception as e:
            logger.error("Navigation failed", error=str(e))
            await self.visual_monitor.annotate_action(
                action_type=ActionType.NAVIGATE,
                description=f"Failed navigation: {description}",
                input_value=url,
                success=False,
                error_message=str(e),
                duration=2.0
            )
    
    async def _real_interact_with_page(self, description: str):
        """Interact with page elements using browser-use"""
        print(f"🔍 {description}")
        
        try:
            # Capture current state with all highlighted elements
            await self.visual_monitor.capture_state("interaction_analysis")
            
            # Get current state to see what elements are available
            state = await self.browser_session.get_state_summary()
            
            if state.selector_map:
                print(f"   Found {len(state.selector_map)} interactive elements")
                
                # Show some element info
                for i, (index, element) in enumerate(list(state.selector_map.items())[:3]):
                    print(f"   Element {index}: {element.tag_name} - {element.xpath[:50]}...")
                    
                    if i == 0:  # Try to click the first element
                        try:
                            await self.browser_session.click(index)
                            await self.visual_monitor.annotate_action(
                                action_type=ActionType.CLICK,
                                description=f"Clicked element {index} ({element.tag_name})",
                                element_index=index,
                                element_selector=element.xpath,
                                success=True,
                                duration=1.0
                            )
                            await asyncio.sleep(1)
                            break
                        except Exception as e:
                            logger.warning("Click failed", error=str(e))
            else:
                print("   No interactive elements found")
            
            # Capture final state
            await self.visual_monitor.capture_state("after_interaction")
            
        except Exception as e:
            logger.error("Interaction failed", error=str(e))
    
    async def cleanup(self):
        """Clean up browser session"""
        try:
            if self.browser_session:
                print("\n🧹 Cleaning up browser session...")
                await self.browser_session.stop()
        except Exception as e:
            logger.warning("Browser cleanup failed", error=str(e))
        
        await super().cleanup()


async def run_real_browser_demo():
    """Run the real browser demo"""
    
    print_real_browser_banner()
    
    # Check for browser-use availability
    try:
        import browser_use
        print("✅ browser-use library found")
    except ImportError:
        print("❌ browser-use library not found!")
        print("   Please make sure the browser-use/ directory exists at the project root")
        print("   Or install it with: pip install browser-use")
        return
    
    print("\n🚀 Initializing Real Browser Demo...")
    
    # Create orchestrator
    orchestrator = SOPOrchestrator()
    
    # Create real browser agent
    demo_agent = RealBrowserAgent(orchestrator)
    orchestrator.active_agents[demo_agent.agent_id] = demo_agent
    
    print(f"🤖 Real browser agent created: {demo_agent.agent_id}")
    
    try:
        # Execute demo workflow
        result = await demo_agent.execute_real_demo_workflow()
        
        print(f"\n📈 Demo Results:")
        print(f"   Status: {result['status']}")
        print(f"   Timeline Length: {result['timeline_length']} states")
        print(f"   Real Browser: {result['real_browser']}")
        print(f"   Export Path: {result['export_path']}")
        
        # Show timeline summary
        print(f"\n🎬 Timeline Summary:")
        for i, state in enumerate(demo_agent.visual_monitor.timeline):
            action_desc = "State capture"
            elements_count = 0
            
            if state.action:
                action_desc = f"{state.action.action_type.value}: {state.action.description}"
            
            if state.clickable_elements:
                elements_count = state.clickable_elements.get("total_elements", 0)
            
            print(f"   {i+1:2d}. {state.timestamp.strftime('%H:%M:%S')} - {action_desc} ({elements_count} elements)")
        
        return orchestrator, demo_agent
        
    except Exception as e:
        logger.error("Demo failed", error=str(e))
        await demo_agent.cleanup()
        raise


async def run_real_browser_dashboard():
    """Run the visual dashboard with real browser data"""
    
    print("\n🎮 Starting Real Browser Visual Dashboard...")
    
    # Run the real browser demo first
    orchestrator, demo_agent = await run_real_browser_demo()
    
    print("\n🌐 Starting Visual Timeline Dashboard...")
    print("   Dashboard URL: http://localhost:8081")
    print("   Visual Timeline: http://localhost:8081/visual-timeline")
    print("\n💡 Features to try:")
    print("   • Scrub through the timeline to see real browser screenshots")
    print("   • See browser-use's colored circles around clickable elements")
    print("   • View actual DOM element counts and browser context")
    print("   • Export timeline data with real browser state information")
    print("   • Compare different website layouts and element highlighting")
    
    try:
        # Start the enhanced cockpit with real browser data
        await run_enhanced_cockpit(orchestrator=orchestrator, port=8081)
    finally:
        # Cleanup
        await demo_agent.cleanup()


async def run_simple_browser_test():
    """Run a simple browser test without dashboard"""
    
    print("\n🔬 Simple Real Browser Test...")
    
    # Create a standalone agent
    agent = RealBrowserAgent()
    
    try:
        if not await agent.initialize_browser():
            print("❌ Failed to initialize browser")
            return
        
        print("📸 Taking real browser screenshots...")
        
        # Simple navigation test
        await agent._real_navigate("https://example.com", "Test navigation")
        await asyncio.sleep(2)
        
        await agent._real_navigate("https://httpbin.org/", "Test navigation 2")
        await asyncio.sleep(2)
        
        print(f"✅ Captured {len(agent.visual_monitor.timeline)} real browser states")
        
        # Show what we captured
        for i, state in enumerate(agent.visual_monitor.timeline):
            elements = state.clickable_elements.get("total_elements", 0) if state.clickable_elements else 0
            print(f"   State {i+1}: {state.url} ({elements} interactive elements)")
        
        # Export timeline
        export_path = await agent.visual_monitor.export_timeline()
        print(f"📁 Timeline exported to: {export_path}")
        
    finally:
        await agent.cleanup()


def main():
    """Main demo function"""
    
    print("🎥 Real Browser-Use Visual Monitoring Demo")
    print("\nChoose demo mode:")
    print("1. Full Dashboard Demo with Real Browser (recommended)")
    print("2. Simple Browser Test (no dashboard)")
    print("3. Browser Workflow Only")
    
    try:
        choice = input("\nEnter choice (1-3): ").strip()
        
        if choice == "1":
            asyncio.run(run_real_browser_dashboard())
        elif choice == "2":
            asyncio.run(run_simple_browser_test())
        elif choice == "3":
            asyncio.run(run_real_browser_demo())
        else:
            print("Invalid choice. Running full dashboard demo...")
            asyncio.run(run_real_browser_dashboard())
            
    except KeyboardInterrupt:
        print("\n\n👋 Demo interrupted by user")
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        logger.error("Demo failed", error=str(e))


if __name__ == "__main__":
    main() 