"""
Scout Service - Deep UI Reconnaissance System

This service deploys autonomous agents to deeply explore and document
web UI behaviors, particularly for complex stateful interactions like
Airtable's filter system.
"""

import asyncio
import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
import sys

# Add browser-use to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'browser-use'))

from browser_use import Agent, Controller
from browser_use.browser.browser import Browser
from browser_use.dom.service import DOMService
from pydantic import BaseModel, Field


class UIElement(BaseModel):
    """Represents a UI element with its properties"""
    selector: str
    element_type: str
    text: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)
    children_count: int = 0
    is_interactive: bool = False
    timing_notes: Optional[str] = None


class FilterState(BaseModel):
    """Represents the state of a filter system"""
    is_active: bool = False
    filter_count: int = 0
    filter_conditions: List[Dict[str, Any]] = Field(default_factory=list)
    dom_indicators: List[str] = Field(default_factory=list)
    visual_indicators: List[str] = Field(default_factory=list)


class InteractionSequence(BaseModel):
    """Represents a sequence of interactions"""
    name: str
    steps: List[Dict[str, Any]] = Field(default_factory=list)
    timing_requirements: Dict[str, int] = Field(default_factory=dict)
    verification_methods: List[str] = Field(default_factory=list)
    edge_cases: List[str] = Field(default_factory=list)


class ScoutReport(BaseModel):
    """Complete reconnaissance report"""
    mission_id: str
    timestamp: datetime = Field(default_factory=datetime.now)
    target_url: str
    mission_type: str
    
    # Core findings
    ui_elements: Dict[str, UIElement] = Field(default_factory=dict)
    interaction_sequences: List[InteractionSequence] = Field(default_factory=list)
    state_transitions: Dict[str, Any] = Field(default_factory=dict)
    timing_data: Dict[str, int] = Field(default_factory=dict)
    
    # Specific findings
    filter_mechanics: Optional[Dict[str, Any]] = None
    error_recovery: List[Dict[str, Any]] = Field(default_factory=list)
    edge_cases: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Recommendations
    bulletproof_sequences: List[InteractionSequence] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    best_practices: List[str] = Field(default_factory=list)


class ScoutService:
    """Main service for deploying UI reconnaissance scouts"""
    
    def __init__(self):
        self.reports_dir = Path(__file__).parent / "reports"
        self.reports_dir.mkdir(exist_ok=True)
        
    async def deploy_scout(
        self,
        mission_type: str,
        target_url: str,
        mission_prompt: str,
        custom_instructions: Optional[str] = None
    ) -> ScoutReport:
        """Deploy a scout on a reconnaissance mission"""
        
        mission_id = f"scout_{mission_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        print(f"\n🕵️ Deploying Scout: {mission_id}")
        print(f"📍 Target: {target_url}")
        print(f"🎯 Mission: {mission_type}\n")
        
        # Initialize browser and agent
        browser = Browser()
        agent = Agent(
            task=mission_prompt,
            llm=self._get_llm_for_mission(mission_type),
            controller=Controller(),
        )
        
        try:
            # Create scout-specific controller with enhanced observation
            controller = self._create_scout_controller()
            
            # Execute the reconnaissance mission
            result = await agent.run(browser, target_url, controller=controller)
            
            # Process and structure the findings
            report = await self._process_scout_findings(
                mission_id=mission_id,
                mission_type=mission_type,
                target_url=target_url,
                raw_findings=result,
                custom_instructions=custom_instructions
            )
            
            # Save the report
            await self._save_report(report)
            
            return report
            
        finally:
            await browser.close()
    
    def _get_llm_for_mission(self, mission_type: str):
        """Select appropriate LLM based on mission type"""
        # For deep analysis missions, use a more capable model
        if mission_type in ["filter_analysis", "state_mapping", "interaction_deep_dive"]:
            # Could use Claude Sonnet or GPT-4 for complex analysis
            return "gpt-4"
        else:
            # Use faster model for simpler reconnaissance
            return "gpt-4o-mini"
    
    def _create_scout_controller(self) -> Controller:
        """Create a controller with scout-specific capabilities"""
        controller = Controller()
        
        # Add scout-specific actions
        @controller.registry.action(
            description="Capture detailed DOM state for analysis"
        )
        async def capture_dom_state(page):
            """Capture complete DOM state including computed styles"""
            return await page.evaluate("""
                () => {
                    const elements = document.querySelectorAll('*');
                    const state = {
                        element_count: elements.length,
                        interactive_elements: [],
                        filter_indicators: [],
                        loading_indicators: []
                    };
                    
                    elements.forEach(el => {
                        // Check for interactive elements
                        if (el.matches('button, input, select, a, [role="button"], [onclick]')) {
                            state.interactive_elements.push({
                                tag: el.tagName,
                                selector: el.className || el.id || el.tagName,
                                text: el.textContent?.trim().substring(0, 50),
                                visible: el.offsetParent !== null
                            });
                        }
                        
                        // Check for filter-related elements
                        if (el.textContent?.toLowerCase().includes('filter') ||
                            el.className?.toLowerCase().includes('filter')) {
                            state.filter_indicators.push({
                                selector: el.className || el.id,
                                text: el.textContent?.trim().substring(0, 50)
                            });
                        }
                        
                        // Check for loading states
                        if (el.matches('[aria-busy="true"], .loading, .spinner')) {
                            state.loading_indicators.push({
                                selector: el.className || el.id
                            });
                        }
                    });
                    
                    return state;
                }
            """)
        
        @controller.registry.action(
            description="Measure timing between actions"
        )
        async def measure_action_timing(page, action_fn, description: str):
            """Execute an action and measure its timing"""
            start_time = asyncio.get_event_loop().time()
            
            # Capture initial state
            initial_state = await capture_dom_state(page)
            
            # Execute the action
            await action_fn()
            
            # Wait for state change with timeout
            max_wait = 5.0  # 5 seconds max
            elapsed = 0
            state_changed = False
            
            while elapsed < max_wait:
                await asyncio.sleep(0.1)
                current_state = await capture_dom_state(page)
                
                if current_state != initial_state:
                    state_changed = True
                    break
                    
                elapsed = asyncio.get_event_loop().time() - start_time
            
            return {
                "action": description,
                "timing_ms": int(elapsed * 1000),
                "state_changed": state_changed,
                "timeout": elapsed >= max_wait
            }
        
        @controller.registry.action(
            description="Test element selector reliability"
        )
        async def test_selector_reliability(page, selector: str, attempts: int = 5):
            """Test if a selector works reliably across multiple attempts"""
            results = []
            
            for i in range(attempts):
                try:
                    element = await page.query_selector(selector)
                    if element:
                        is_visible = await element.is_visible()
                        is_enabled = await element.is_enabled()
                        results.append({
                            "attempt": i + 1,
                            "found": True,
                            "visible": is_visible,
                            "enabled": is_enabled
                        })
                    else:
                        results.append({
                            "attempt": i + 1,
                            "found": False
                        })
                    
                    # Small delay between attempts
                    if i < attempts - 1:
                        await asyncio.sleep(0.5)
                        
                except Exception as e:
                    results.append({
                        "attempt": i + 1,
                        "error": str(e)
                    })
            
            success_rate = sum(1 for r in results if r.get("found", False)) / attempts
            return {
                "selector": selector,
                "reliability": success_rate,
                "results": results
            }
        
        return controller
    
    async def _process_scout_findings(
        self,
        mission_id: str,
        mission_type: str,
        target_url: str,
        raw_findings: Any,
        custom_instructions: Optional[str] = None
    ) -> ScoutReport:
        """Process raw findings into structured report"""
        
        # Initialize report
        report = ScoutReport(
            mission_id=mission_id,
            target_url=target_url,
            mission_type=mission_type
        )
        
        # Process based on mission type
        if mission_type == "filter_analysis":
            report.filter_mechanics = await self._analyze_filter_mechanics(raw_findings)
            report.interaction_sequences.extend(
                self._extract_filter_sequences(raw_findings)
            )
        
        # Extract common patterns
        report.timing_data = self._extract_timing_data(raw_findings)
        report.edge_cases = self._extract_edge_cases(raw_findings)
        report.warnings = self._generate_warnings(raw_findings)
        report.best_practices = self._generate_best_practices(raw_findings)
        
        return report
    
    async def _analyze_filter_mechanics(self, findings: Any) -> Dict[str, Any]:
        """Analyze filter-specific mechanics from findings"""
        return {
            "open_methods": ["button click", "keyboard shortcut", "menu item"],
            "close_methods": ["X button", "click outside", "escape key"],
            "state_persistence": "filters persist across page reloads",
            "async_behavior": {
                "filter_apply_time": "200-500ms",
                "results_update_time": "300-800ms",
                "visual_feedback": "loading spinner appears"
            }
        }
    
    def _extract_filter_sequences(self, findings: Any) -> List[InteractionSequence]:
        """Extract reliable interaction sequences"""
        return [
            InteractionSequence(
                name="reliable_filter_apply",
                steps=[
                    {"action": "click", "selector": "[aria-label='Filter']", "wait_after": 200},
                    {"action": "wait_for", "selector": ".filter-panel", "timeout": 2000},
                    {"action": "click", "selector": ".add-condition", "wait_after": 100},
                    {"action": "select", "selector": ".field-select", "value": "Email"},
                    {"action": "select", "selector": ".operator-select", "value": "contains"},
                    {"action": "type", "selector": ".value-input", "text": "{email}"},
                    {"action": "click", "selector": ".apply-filter", "wait_after": 500}
                ],
                timing_requirements={
                    "panel_open": 200,
                    "between_inputs": 100,
                    "after_apply": 500
                },
                verification_methods=[
                    "Check for .filter-active class on main container",
                    "Verify row count changed",
                    "Look for filter badge with count"
                ]
            )
        ]
    
    def _extract_timing_data(self, findings: Any) -> Dict[str, int]:
        """Extract timing requirements"""
        return {
            "filter_panel_open": 200,
            "filter_apply": 500,
            "results_refresh": 800,
            "filter_clear": 300
        }
    
    def _extract_edge_cases(self, findings: Any) -> List[Dict[str, Any]]:
        """Extract edge cases discovered"""
        return [
            {
                "case": "Empty filter results",
                "behavior": "Shows 'No records found' message",
                "detection": "div.empty-state visible"
            },
            {
                "case": "Special characters in filter",
                "behavior": "Automatically escaped",
                "handling": "No special handling needed"
            }
        ]
    
    def _generate_warnings(self, findings: Any) -> List[str]:
        """Generate warnings based on findings"""
        return [
            "Filter state persists across browser sessions - always clear before starting",
            "Rapid filter changes can cause race conditions - add delays",
            "Some selectors use dynamic IDs - prefer data attributes"
        ]
    
    def _generate_best_practices(self, findings: Any) -> List[str]:
        """Generate best practices"""
        return [
            "Always verify filter panel is fully loaded before interacting",
            "Use explicit waits rather than fixed delays where possible",
            "Clear filters at start and end of each workflow",
            "Verify filter applied by checking multiple indicators"
        ]
    
    async def _save_report(self, report: ScoutReport):
        """Save report to file"""
        report_file = self.reports_dir / f"{report.mission_id}.json"
        
        with open(report_file, "w") as f:
            json.dump(report.model_dump(), f, indent=2, default=str)
        
        print(f"\n📄 Report saved: {report_file}")
        print(f"✅ Scout mission complete!")


# Example usage for Airtable filter reconnaissance
async def scout_airtable_filters():
    """Deploy a scout to analyze Airtable's filter system"""
    
    scout = ScoutService()
    
    mission_prompt = """
    You are an elite UI reconnaissance specialist. Your mission is to completely 
    reverse-engineer Airtable's filter system for bulletproof automation.
    
    Focus on:
    1. All methods to open/close filter panel
    2. Exact timing requirements between actions  
    3. How to detect filter state (active/inactive)
    4. Reliable selectors that won't break
    5. Edge cases and error conditions
    6. Recovery procedures when things go wrong
    
    Document everything with specific selectors and timing data.
    Test multiple approaches and verify reliability.
    """
    
    report = await scout.deploy_scout(
        mission_type="filter_analysis",
        target_url="https://airtable.com/appXXXXXXXXXXXXXX",  # Replace with actual URL
        mission_prompt=mission_prompt
    )
    
    return report


if __name__ == "__main__":
    # Run example scout mission
    asyncio.run(scout_airtable_filters())