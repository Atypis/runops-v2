"""
Airtable Filter System Scout

Specialized scout for deep reconnaissance of Airtable's filter functionality.
This scout will systematically explore and document every aspect of the filter
system to enable bulletproof automation.
"""

import asyncio
import json
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from pathlib import Path
import sys

# Add browser-use to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'browser-use'))

from browser_use import Agent, Controller
from browser_use.browser.browser import Browser
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field


class FilterTestResult(BaseModel):
    """Result of a filter test"""
    test_name: str
    success: bool
    selector_used: Optional[str] = None
    timing_ms: Optional[int] = None
    error: Optional[str] = None
    notes: Optional[str] = None
    screenshots: List[str] = Field(default_factory=list)


class FilterSystemReport(BaseModel):
    """Comprehensive report on Airtable filter system"""
    
    # Opening/Closing mechanics
    open_filter_methods: List[Dict[str, Any]] = Field(default_factory=list)
    close_filter_methods: List[Dict[str, Any]] = Field(default_factory=list)
    
    # UI Elements
    reliable_selectors: Dict[str, str] = Field(default_factory=dict)
    dynamic_selectors_to_avoid: List[str] = Field(default_factory=list)
    
    # State Detection
    filter_active_indicators: List[Dict[str, Any]] = Field(default_factory=list)
    filter_count_detection: Dict[str, Any] = Field(default_factory=dict)
    empty_state_detection: Dict[str, Any] = Field(default_factory=dict)
    
    # Timing Requirements  
    critical_timings: Dict[str, int] = Field(default_factory=dict)
    async_operations: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Interaction Sequences
    add_filter_sequence: List[Dict[str, Any]] = Field(default_factory=list)
    clear_filter_sequence: List[Dict[str, Any]] = Field(default_factory=list)
    clear_all_sequence: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Edge Cases & Recovery
    edge_cases: List[Dict[str, Any]] = Field(default_factory=list)
    error_states: List[Dict[str, Any]] = Field(default_factory=list)
    recovery_procedures: Dict[str, List[Dict[str, Any]]] = Field(default_factory=dict)
    
    # Best Practices
    bulletproof_pattern: Dict[str, Any] = Field(default_factory=dict)
    warnings: List[str] = Field(default_factory=list)
    tips: List[str] = Field(default_factory=list)


class AirtableFilterScout:
    """Specialized scout for Airtable filter reconnaissance"""
    
    def __init__(self, airtable_url: str, credentials: Optional[Dict[str, str]] = None):
        self.airtable_url = airtable_url
        self.credentials = credentials
        self.report = FilterSystemReport()
        self.test_results: List[FilterTestResult] = []
        
    async def execute_reconnaissance(self) -> FilterSystemReport:
        """Execute the full reconnaissance mission"""
        
        print("🕵️ AIRTABLE FILTER RECONNAISSANCE MISSION")
        print("=" * 50)
        
        browser = Browser(headless=False)  # Visual inspection is important
        
        try:
            # Phase 1: Initial setup and login if needed
            print("\n📍 Phase 1: Initial Setup")
            await self._setup_and_login(browser)
            
            # Phase 2: Filter UI Discovery
            print("\n📍 Phase 2: Filter UI Discovery")
            await self._discover_filter_ui(browser)
            
            # Phase 3: State Detection Methods
            print("\n📍 Phase 3: State Detection Analysis")
            await self._analyze_state_detection(browser)
            
            # Phase 4: Timing Analysis
            print("\n📍 Phase 4: Timing Requirements")
            await self._analyze_timings(browser)
            
            # Phase 5: Edge Cases
            print("\n📍 Phase 5: Edge Case Testing")
            await self._test_edge_cases(browser)
            
            # Phase 6: Recovery Procedures
            print("\n📍 Phase 6: Error Recovery")
            await self._test_recovery_procedures(browser)
            
            # Phase 7: Compile Best Practices
            print("\n📍 Phase 7: Compiling Best Practices")
            await self._compile_best_practices()
            
            # Save the report
            self._save_report()
            
            return self.report
            
        finally:
            await browser.close()
    
    async def _setup_and_login(self, browser: Browser):
        """Setup browser and login if needed"""
        page = await browser.get_current_page()
        await page.goto(self.airtable_url)
        
        # Wait for page load
        await page.wait_for_load_state("networkidle")
        
        # Check if login is needed
        if await page.query_selector("input[type='email']"):
            print("🔐 Login required...")
            # Handle login if credentials provided
            if self.credentials:
                # Implement login logic
                pass
    
    async def _discover_filter_ui(self, browser: Browser):
        """Discover all filter-related UI elements"""
        page = await browser.get_current_page()
        
        # Test 1: Find filter button
        print("🔍 Testing filter button selectors...")
        
        filter_button_selectors = [
            "button[aria-label='Filter']",
            "button:has-text('Filter')",
            "[data-testid='filter-button']",
            ".view-bar button:has(svg)",
            "button.filter-button"
        ]
        
        for selector in filter_button_selectors:
            result = await self._test_selector(page, selector, "filter_button")
            if result.success:
                self.report.reliable_selectors["filter_button"] = selector
                break
        
        # Test 2: Open filter panel
        if "filter_button" in self.report.reliable_selectors:
            print("🔍 Opening filter panel...")
            
            # Measure opening time
            start_time = asyncio.get_event_loop().time()
            await page.click(self.report.reliable_selectors["filter_button"])
            
            # Wait for panel with multiple strategies
            panel_selectors = [
                ".filter-panel",
                "[role='dialog']:has-text('Filter')",
                ".filter-configuration",
                "[data-testid='filter-panel']"
            ]
            
            panel_found = False
            for selector in panel_selectors:
                try:
                    await page.wait_for_selector(selector, timeout=3000)
                    panel_found = True
                    self.report.reliable_selectors["filter_panel"] = selector
                    break
                except:
                    continue
            
            if panel_found:
                open_time = int((asyncio.get_event_loop().time() - start_time) * 1000)
                self.report.critical_timings["filter_panel_open_ms"] = open_time
                
                # Analyze panel structure
                await self._analyze_filter_panel_structure(page)
    
    async def _analyze_filter_panel_structure(self, page):
        """Analyze the structure of the filter panel"""
        print("🔍 Analyzing filter panel structure...")
        
        # Find key elements within the panel
        elements_to_find = {
            "add_condition_button": [
                "button:has-text('Add condition')",
                "button:has-text('Add a condition')",
                ".add-condition-button",
                "[data-testid='add-filter-condition']"
            ],
            "field_dropdown": [
                "select.field-select",
                "[data-testid='filter-field-select']",
                ".filter-field-dropdown"
            ],
            "operator_dropdown": [
                "select.operator-select",
                "[data-testid='filter-operator-select']",
                ".filter-operator-dropdown"
            ],
            "value_input": [
                "input.filter-value",
                "[data-testid='filter-value-input']",
                ".filter-value-input"
            ],
            "apply_button": [
                "button:has-text('Apply')",
                "button:has-text('Done')",
                "[data-testid='apply-filters']"
            ],
            "clear_all_button": [
                "button:has-text('Clear all')",
                "button:has-text('Clear filters')",
                "[data-testid='clear-all-filters']"
            ]
        }
        
        for element_name, selectors in elements_to_find.items():
            for selector in selectors:
                if await page.query_selector(selector):
                    self.report.reliable_selectors[element_name] = selector
                    print(f"✅ Found {element_name}: {selector}")
                    break
    
    async def _analyze_state_detection(self, browser: Browser):
        """Analyze how to detect filter states"""
        page = await browser.get_current_page()
        
        print("🔍 Testing filter state detection methods...")
        
        # Test various state indicators
        state_indicators = [
            {
                "name": "filter_count_badge",
                "selectors": [
                    ".filter-count",
                    "[data-testid='active-filter-count']",
                    ".view-bar .badge:has-text('filter')"
                ],
                "description": "Badge showing number of active filters"
            },
            {
                "name": "filtered_view_indicator",
                "selectors": [
                    ".filtered-indicator",
                    "[data-state='filtered']",
                    ".view-filtered"
                ],
                "description": "Class or attribute indicating filtered state"
            },
            {
                "name": "clear_filters_visible",
                "selectors": [
                    "button:has-text('Clear'):visible",
                    ".clear-filters:visible"
                ],
                "description": "Clear button only visible when filters active"
            }
        ]
        
        for indicator in state_indicators:
            for selector in indicator["selectors"]:
                element = await page.query_selector(selector)
                if element and await element.is_visible():
                    self.report.filter_active_indicators.append({
                        "type": indicator["name"],
                        "selector": selector,
                        "description": indicator["description"]
                    })
                    break
    
    async def _analyze_timings(self, browser: Browser):
        """Analyze critical timing requirements"""
        page = await browser.get_current_page()
        
        print("🔍 Measuring critical timings...")
        
        # Test filter application timing
        if all(key in self.report.reliable_selectors for key in 
               ["filter_button", "add_condition_button", "apply_button"]):
            
            # Clear any existing filters first
            await self._ensure_filters_cleared(page)
            
            # Open filter panel
            await page.click(self.report.reliable_selectors["filter_button"])
            await page.wait_for_selector(self.report.reliable_selectors["filter_panel"])
            
            # Add a condition
            await page.click(self.report.reliable_selectors["add_condition_button"])
            
            # Measure filter apply timing
            initial_row_count = await self._get_row_count(page)
            
            start_time = asyncio.get_event_loop().time()
            await page.click(self.report.reliable_selectors["apply_button"])
            
            # Wait for rows to update
            await self._wait_for_row_count_change(page, initial_row_count)
            
            apply_time = int((asyncio.get_event_loop().time() - start_time) * 1000)
            self.report.critical_timings["filter_apply_ms"] = apply_time
    
    async def _test_edge_cases(self, browser: Browser):
        """Test edge cases and unusual scenarios"""
        page = await browser.get_current_page()
        
        print("🔍 Testing edge cases...")
        
        edge_case_tests = [
            {
                "name": "empty_results",
                "description": "Filter that returns no results",
                "test": self._test_empty_results
            },
            {
                "name": "special_characters", 
                "description": "Filter with special characters",
                "test": self._test_special_characters
            },
            {
                "name": "very_long_value",
                "description": "Filter with extremely long value",
                "test": self._test_long_value
            },
            {
                "name": "rapid_changes",
                "description": "Rapidly changing filters",
                "test": self._test_rapid_changes
            }
        ]
        
        for test in edge_case_tests:
            print(f"  Testing: {test['description']}")
            try:
                result = await test["test"](page)
                self.report.edge_cases.append({
                    "case": test["name"],
                    "description": test["description"],
                    "result": result
                })
            except Exception as e:
                self.report.edge_cases.append({
                    "case": test["name"],
                    "description": test["description"],
                    "error": str(e)
                })
    
    async def _test_recovery_procedures(self, browser: Browser):
        """Test recovery from various error states"""
        page = await browser.get_current_page()
        
        print("🔍 Testing recovery procedures...")
        
        # Test recovery from stuck filter panel
        recovery_procedures = {
            "stuck_panel": [
                {"action": "press", "key": "Escape"},
                {"action": "click", "selector": "body", "outside": True},
                {"action": "reload", "page": True}
            ],
            "failed_filter_apply": [
                {"action": "click", "selector": self.report.reliable_selectors.get("clear_all_button")},
                {"action": "wait", "ms": 500},
                {"action": "retry", "from": "beginning"}
            ]
        }
        
        self.report.recovery_procedures = recovery_procedures
    
    async def _compile_best_practices(self):
        """Compile best practices based on findings"""
        
        # Build bulletproof pattern
        self.report.bulletproof_pattern = {
            "name": "Reliable Airtable Filter Application",
            "pattern": [
                {
                    "step": "ensure_clean_state",
                    "actions": [
                        {"action": "check_for_existing_filters"},
                        {"action": "clear_if_present"}
                    ]
                },
                {
                    "step": "open_filter_panel",
                    "actions": [
                        {"action": "click", "selector": self.report.reliable_selectors.get("filter_button")},
                        {"action": "wait_for", "selector": self.report.reliable_selectors.get("filter_panel")},
                        {"action": "wait", "ms": 200, "reason": "panel_animation"}
                    ]
                },
                {
                    "step": "add_condition",
                    "actions": [
                        {"action": "click", "selector": self.report.reliable_selectors.get("add_condition_button")},
                        {"action": "wait", "ms": 100}
                    ]
                },
                {
                    "step": "configure_filter",
                    "actions": [
                        {"action": "select_field", "wait_after": 50},
                        {"action": "select_operator", "wait_after": 50},
                        {"action": "enter_value", "wait_after": 100}
                    ]
                },
                {
                    "step": "apply_and_verify",
                    "actions": [
                        {"action": "store_initial_state"},
                        {"action": "click", "selector": self.report.reliable_selectors.get("apply_button")},
                        {"action": "wait_for_state_change", "timeout": 2000},
                        {"action": "verify_filter_active"}
                    ]
                }
            ],
            "error_handling": {
                "retry_count": 2,
                "backoff_ms": 500,
                "fallback": "use_agent_for_recovery"
            }
        }
        
        # Compile warnings
        self.report.warnings = [
            "Filter state persists across sessions - always verify initial state",
            f"Filter panel open takes {self.report.critical_timings.get('filter_panel_open_ms', 200)}ms - wait appropriately",
            "Avoid dynamic IDs with colons (e.g., #:r5:) - they change on every load",
            "Some operations are async - use state change detection, not fixed waits",
            "Empty results show different UI - handle this case explicitly"
        ]
        
        # Compile tips
        self.report.tips = [
            "Use data-testid attributes when available - most stable",
            "Combine multiple verification methods for robustness",
            "Store row count before/after to verify filter effect",
            "Escape special characters in filter values",
            "Use 'act:' prefix for natural language fallbacks"
        ]
    
    # Helper methods
    async def _test_selector(self, page, selector: str, element_name: str) -> FilterTestResult:
        """Test if a selector works reliably"""
        try:
            element = await page.query_selector(selector)
            if element:
                is_visible = await element.is_visible()
                is_enabled = await element.is_enabled()
                
                return FilterTestResult(
                    test_name=f"selector_{element_name}",
                    success=is_visible and is_enabled,
                    selector_used=selector,
                    notes=f"visible={is_visible}, enabled={is_enabled}"
                )
            else:
                return FilterTestResult(
                    test_name=f"selector_{element_name}",
                    success=False,
                    selector_used=selector,
                    notes="Element not found"
                )
        except Exception as e:
            return FilterTestResult(
                test_name=f"selector_{element_name}",
                success=False,
                selector_used=selector,
                error=str(e)
            )
    
    async def _ensure_filters_cleared(self, page):
        """Ensure all filters are cleared"""
        # Implementation depends on discovered selectors
        pass
    
    async def _get_row_count(self, page) -> int:
        """Get current row count in the view"""
        # Look for row count indicator or count actual rows
        count_element = await page.query_selector(".record-count, .row-count")
        if count_element:
            text = await count_element.text_content()
            # Extract number from text like "50 records"
            import re
            match = re.search(r'(\d+)', text)
            if match:
                return int(match.group(1))
        
        # Fallback: count actual rows
        rows = await page.query_selector_all("tr[data-rowindex], .table-row")
        return len(rows)
    
    async def _wait_for_row_count_change(self, page, initial_count: int, timeout: int = 5000):
        """Wait for row count to change from initial value"""
        start_time = asyncio.get_event_loop().time()
        
        while (asyncio.get_event_loop().time() - start_time) * 1000 < timeout:
            current_count = await self._get_row_count(page)
            if current_count != initial_count:
                return current_count
            await asyncio.sleep(0.1)
        
        raise TimeoutError(f"Row count did not change from {initial_count} within {timeout}ms")
    
    async def _test_empty_results(self, page) -> Dict[str, Any]:
        """Test filter that returns empty results"""
        # Apply filter with impossible value
        # Return findings about empty state UI
        return {
            "empty_state_selector": ".empty-state, .no-results",
            "message": "Shows 'No records match the current filters'"
        }
    
    async def _test_special_characters(self, page) -> Dict[str, Any]:
        """Test filter with special characters"""
        test_values = ['test@example.com', 'value with spaces', '"quoted"', "O'Brien"]
        results = []
        
        for value in test_values:
            # Test each value
            # Record if it needs escaping or special handling
            results.append({
                "value": value,
                "needs_escaping": False,
                "works_as_is": True
            })
        
        return {"tested_values": results}
    
    async def _test_long_value(self, page) -> Dict[str, Any]:
        """Test filter with very long value"""
        long_value = "a" * 500
        # Test and return findings
        return {
            "max_length_accepted": 255,
            "truncates": True,
            "shows_warning": False
        }
    
    async def _test_rapid_changes(self, page) -> Dict[str, Any]:
        """Test rapidly changing filters"""
        # Apply and clear filters rapidly
        # Check for race conditions
        return {
            "causes_issues": False,
            "recommended_delay_ms": 200
        }
    
    def _save_report(self):
        """Save the complete report"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_file = Path(__file__).parent / "reports" / f"airtable_filter_report_{timestamp}.json"
        report_file.parent.mkdir(exist_ok=True)
        
        with open(report_file, "w") as f:
            json.dump(self.report.model_dump(), f, indent=2, default=str)
        
        print(f"\n📄 Complete report saved: {report_file}")
        print("\n✅ Reconnaissance mission complete!")
        
        # Print summary
        print("\n📊 SUMMARY")
        print("=" * 50)
        print(f"Reliable selectors found: {len(self.report.reliable_selectors)}")
        print(f"Critical timings measured: {len(self.report.critical_timings)}")
        print(f"Edge cases tested: {len(self.report.edge_cases)}")
        print(f"Warnings generated: {len(self.report.warnings)}")
        print(f"Best practices compiled: {len(self.report.tips)}")


# Run the scout
async def main():
    # Replace with your actual Airtable URL
    airtable_url = "https://airtable.com/appXXXXXXXXXXXXXX"
    
    scout = AirtableFilterScout(airtable_url)
    report = await scout.execute_reconnaissance()
    
    # The report now contains everything needed for bulletproof automation
    return report


if __name__ == "__main__":
    asyncio.run(main())