#!/usr/bin/env python3
"""
🎥 Visual Monitoring Demo - Time Machine for Agent Actions

Demonstrates the complete visual monitoring system:
- Real-time screenshot capture
- Action annotation and timeline
- Interactive "time machine" scrubbing
- Evidence export capabilities
"""

import asyncio
import sys
from pathlib import Path
import structlog

# Add current directory to path
current_dir = Path(__file__).parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from core.orchestrator import SOPOrchestrator
from core.visual_monitor import VisualMonitor, ActionType
from agents.base_agent import EnhancedBaseAgent
from cockpit.web_server import EnhancedCockpitServer, run_enhanced_cockpit

logger = structlog.get_logger(__name__)


def print_visual_monitoring_banner():
    print("""
╔══════════════════════════════════════════════════════════════════════════════╗
║   🎥 VISUAL MONITORING DEMO - AGENT TIME MACHINE                            ║
║                                                                              ║
║   • Real-time Screenshot Timeline with Action Annotation                    ║
║   • Interactive "Time Machine" Scrubbing Interface                          ║
║   • Visual Evidence Capture and Export                                      ║
║   • Complete Audit Trail with Visual Context                                ║
║   • Enterprise-grade Transparency and Debugging                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
    """)


class MockBrowserSession:
    """Mock browser session for demonstration"""
    
    def __init__(self):
        self.current_page = "https://example.com"
        self.page_title = "Example Page"
        self.screenshot_count = 0
    
    async def screenshot(self):
        """Mock screenshot capture"""
        self.screenshot_count += 1
        # Return a simple base64 encoded 1x1 pixel PNG for demo
        return b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\tpHYs\x00\x00\x0b\x13\x00\x00\x0b\x13\x01\x00\x9a\x9c\x18\x00\x00\x00\nIDATx\x9cc\xf8\x00\x00\x00\x01\x00\x01\x00\x00\x00\x00IEND\xaeB`\x82'
    
    async def current_url(self):
        return self.current_page
    
    async def title(self):
        return self.page_title
    
    def navigate_to(self, url):
        self.current_page = url
        self.page_title = f"Page: {url.split('/')[-1]}"


class VisualDemoAgent(EnhancedBaseAgent):
    """Demo agent with visual monitoring capabilities"""
    
    def __init__(self, orchestrator=None):
        super().__init__(orchestrator)
        self.role_name = "visual_demo"
        self.demo_browser = MockBrowserSession()
    
    async def execute_demo_workflow(self):
        """Execute a demo workflow with visual monitoring"""
        
        # Initialize visual monitoring
        await self.initialize_visual_monitoring(self.demo_browser)
        
        print("\n🎬 Starting Visual Demo Workflow...")
        
        # Demo Step 1: Navigate to login page
        await self._demo_navigate("https://gmail.com", "Navigate to Gmail")
        await asyncio.sleep(2)
        
        # Demo Step 2: Click login button
        await self._demo_click((100, 200), "Click login button")
        await asyncio.sleep(1)
        
        # Demo Step 3: Type username
        await self._demo_type("user@example.com", "Enter username")
        await asyncio.sleep(1)
        
        # Demo Step 4: Navigate to inbox
        await self._demo_navigate("https://gmail.com/inbox", "Navigate to inbox")
        await asyncio.sleep(2)
        
        # Demo Step 5: Click on first email
        await self._demo_click((300, 150), "Click first email")
        await asyncio.sleep(1)
        
        # Demo Step 6: Extract email data
        await self._demo_extract_data("Extract sender information")
        await asyncio.sleep(1)
        
        # Demo Step 7: Navigate to CRM
        await self._demo_navigate("https://airtable.com/crm", "Navigate to CRM")
        await asyncio.sleep(2)
        
        # Demo Step 8: Update contact record
        await self._demo_click((250, 300), "Update contact record")
        await asyncio.sleep(1)
        
        print("\n✅ Visual Demo Workflow Completed!")
        print(f"📊 Timeline captured: {len(self.visual_monitor.timeline)} states")
        
        # Export timeline
        export_path = await self.visual_monitor.export_timeline()
        print(f"📁 Timeline exported to: {export_path}")
        
        return {
            "status": "completed",
            "timeline_length": len(self.visual_monitor.timeline),
            "export_path": export_path
        }
    
    async def _demo_navigate(self, url: str, description: str):
        """Demo navigation with visual annotation"""
        print(f"🧭 {description}: {url}")
        
        # Capture before state
        await self.visual_monitor.capture_state(f"before_navigate_{url}")
        
        # Simulate navigation
        self.demo_browser.navigate_to(url)
        await asyncio.sleep(0.5)
        
        # Annotate action
        await self.visual_monitor.annotate_action(
            action_type=ActionType.NAVIGATE,
            description=description,
            input_value=url,
            success=True,
            duration=0.5
        )
        
        # Capture after state
        await self.visual_monitor.capture_state(f"after_navigate_{url}")
    
    async def _demo_click(self, coordinates: tuple, description: str):
        """Demo click with visual annotation"""
        print(f"🖱️  {description} at {coordinates}")
        
        # Capture before state
        await self.visual_monitor.capture_state(f"before_click")
        
        # Simulate click
        await asyncio.sleep(0.3)
        
        # Annotate action
        await self.visual_monitor.annotate_action(
            action_type=ActionType.CLICK,
            coordinates=coordinates,
            description=description,
            success=True,
            duration=0.3
        )
        
        # Capture after state
        await self.visual_monitor.capture_state(f"after_click")
    
    async def _demo_type(self, text: str, description: str):
        """Demo typing with visual annotation"""
        print(f"⌨️  {description}: {text}")
        
        # Capture before state
        await self.visual_monitor.capture_state(f"before_type")
        
        # Simulate typing
        await asyncio.sleep(0.5)
        
        # Annotate action
        await self.visual_monitor.annotate_action(
            action_type=ActionType.TYPE,
            description=description,
            input_value=text,
            success=True,
            duration=0.5
        )
        
        # Capture after state
        await self.visual_monitor.capture_state(f"after_type")
    
    async def _demo_extract_data(self, description: str):
        """Demo data extraction with visual annotation"""
        print(f"📊 {description}")
        
        # Capture before state
        await self.visual_monitor.capture_state(f"before_extract")
        
        # Simulate data extraction
        await asyncio.sleep(0.8)
        
        # Annotate action
        await self.visual_monitor.annotate_action(
            action_type=ActionType.EXTRACT,
            description=description,
            success=True,
            duration=0.8
        )
        
        # Capture after state
        await self.visual_monitor.capture_state(f"after_extract")


async def run_visual_monitoring_demo():
    """Run the complete visual monitoring demonstration"""
    
    print_visual_monitoring_banner()
    
    print("\n🚀 Initializing Visual Monitoring Demo...")
    
    # Create orchestrator
    orchestrator = SOPOrchestrator()
    
    # Create demo agent
    demo_agent = VisualDemoAgent(orchestrator)
    orchestrator.active_agents[demo_agent.agent_id] = demo_agent
    
    print(f"🤖 Demo agent created: {demo_agent.agent_id}")
    
    # Execute demo workflow
    result = await demo_agent.execute_demo_workflow()
    
    print(f"\n📈 Demo Results:")
    print(f"   Status: {result['status']}")
    print(f"   Timeline Length: {result['timeline_length']} states")
    print(f"   Export Path: {result['export_path']}")
    
    # Show timeline summary
    print(f"\n🎬 Timeline Summary:")
    for i, state in enumerate(demo_agent.visual_monitor.timeline):
        action_desc = "State capture"
        if state.action:
            action_desc = f"{state.action.action_type.value}: {state.action.description}"
        
        print(f"   {i+1:2d}. {state.timestamp.strftime('%H:%M:%S')} - {action_desc}")
    
    return orchestrator, demo_agent


async def run_visual_dashboard_demo():
    """Run the visual dashboard with demo data"""
    
    print("\n🎮 Starting Visual Dashboard Demo...")
    
    # Run the demo workflow first
    orchestrator, demo_agent = await run_visual_monitoring_demo()
    
    print("\n🌐 Starting Visual Timeline Dashboard...")
    print("   Dashboard URL: http://localhost:8081")
    print("   Visual Timeline: http://localhost:8081/visual-timeline")
    print("\n💡 Features to try:")
    print("   • Scrub through the timeline using the slider")
    print("   • Click on timeline items to jump to specific moments")
    print("   • Toggle between Live Mode and Manual Mode")
    print("   • Export timeline data and screenshots")
    print("   • View action annotations and success/failure status")
    
    # Start the enhanced cockpit with visual monitoring
    await run_enhanced_cockpit(orchestrator=orchestrator, port=8081)


async def run_standalone_visual_monitor():
    """Run just the visual monitor without dashboard"""
    
    print("\n🔬 Standalone Visual Monitor Demo...")
    
    # Create a standalone visual monitor
    monitor = VisualMonitor(agent_id="standalone_demo")
    
    # Start monitoring
    await monitor.start_monitoring()
    
    print("📸 Capturing states every 2 seconds...")
    
    # Simulate some activity
    for i in range(5):
        await asyncio.sleep(2)
        await monitor.capture_state(f"demo_state_{i}")
        
        if i % 2 == 0:
            await monitor.annotate_action(
                action_type=ActionType.CLICK,
                coordinates=(100 + i * 50, 200),
                description=f"Demo click action {i}",
                success=True
            )
    
    # Stop monitoring
    await monitor.stop_monitoring()
    
    print(f"✅ Captured {len(monitor.timeline)} timeline states")
    
    # Export timeline
    export_path = await monitor.export_timeline()
    print(f"📁 Timeline exported to: {export_path}")
    
    # Cleanup
    await monitor.cleanup()


def main():
    """Main demo function"""
    
    print("🎥 Visual Monitoring System Demo")
    print("\nChoose demo mode:")
    print("1. Full Dashboard Demo (recommended)")
    print("2. Workflow Demo Only")
    print("3. Standalone Monitor Demo")
    
    try:
        choice = input("\nEnter choice (1-3): ").strip()
        
        if choice == "1":
            asyncio.run(run_visual_dashboard_demo())
        elif choice == "2":
            asyncio.run(run_visual_monitoring_demo())
        elif choice == "3":
            asyncio.run(run_standalone_visual_monitor())
        else:
            print("Invalid choice. Running full dashboard demo...")
            asyncio.run(run_visual_dashboard_demo())
            
    except KeyboardInterrupt:
        print("\n\n👋 Demo interrupted by user")
    except Exception as e:
        print(f"\n❌ Demo failed: {e}")
        logger.error("Demo failed", error=str(e))


if __name__ == "__main__":
    main() 