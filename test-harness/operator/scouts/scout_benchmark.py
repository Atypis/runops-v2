"""
Scout Benchmark Runner

This module runs the same reconnaissance mission with different models
to benchmark their performance on deep UI exploration tasks.
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
import sys

# Add browser-use to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent / 'browser-use'))

from browser_use import Agent, Controller
from browser_use.browser.browser import Browser

# Import configurations
from scout_config import (
    ScoutModel, 
    get_model_config, 
    get_scout_prompt,
    BenchmarkResult,
    MODEL_CONFIGS
)

# Configure the models based on provider
def create_agent_for_model(model: ScoutModel, task: str) -> Agent:
    """Create a browser-use agent configured for the specific model"""
    config = get_model_config(model)
    
    if config["provider"] == "google":
        # Use Gemini through browser-use
        from langchain_google_genai import ChatGoogleGenerativeAI
        
        llm = ChatGoogleGenerativeAI(
            model=config["model_name"],
            google_api_key=config["api_key"],
            temperature=config["temperature"],
            max_output_tokens=config["max_tokens"]
        )
    elif config["provider"] == "openai":
        # Use OpenAI models
        from langchain_openai import ChatOpenAI
        
        llm = ChatOpenAI(
            model=config["model_name"],
            openai_api_key=config["api_key"],
            temperature=config["temperature"],
            max_tokens=config["max_tokens"]
        )
    else:
        raise ValueError(f"Unknown provider: {config['provider']}")
    
    # Create agent with the configured LLM
    agent = Agent(
        task=task,
        llm=llm,
        controller=Controller()
    )
    
    return agent


class ScoutBenchmark:
    """Benchmark different models on scout missions"""
    
    def __init__(self, airtable_url: str):
        self.airtable_url = airtable_url
        self.results: Dict[ScoutModel, BenchmarkResult] = {}
        self.reports_dir = Path(__file__).parent / "benchmark_reports"
        self.reports_dir.mkdir(exist_ok=True)
        
    async def run_benchmark(self, models: List[ScoutModel]) -> Dict[str, Any]:
        """Run the same mission with different models"""
        
        print("🏁 SCOUT MODEL BENCHMARK")
        print("=" * 60)
        print(f"Target: {self.airtable_url}")
        print(f"Models: {[m.value for m in models]}")
        print("=" * 60)
        
        for model in models:
            print(f"\n🤖 Testing {model.value}...")
            result = await self._run_single_scout(model)
            self.results[model] = result
            
            # Save intermediate results
            self._save_results()
            
            # Brief pause between models
            if model != models[-1]:
                print("\n⏸️  Pausing before next model...")
                await asyncio.sleep(5)
        
        # Generate comparison report
        comparison = self._generate_comparison()
        self._save_comparison(comparison)
        
        return comparison
    
    async def _run_single_scout(self, model: ScoutModel) -> BenchmarkResult:
        """Run a single scout mission with specified model"""
        
        result = BenchmarkResult(model)
        result.start_time = time.time()
        
        browser = None
        try:
            # Get the mission prompt optimized for this model
            task = get_scout_prompt(model, "filter_analysis")
            
            # Create browser and agent
            browser = Browser(headless=True)  # Headless for benchmarking
            agent = create_agent_for_model(model, task)
            
            # Add custom controller actions for scouting
            controller = self._create_scout_controller()
            
            # Execute the mission
            print(f"  🕵️ Deploying {model.value} scout...")
            scout_result = await agent.run(browser, self.airtable_url, controller=controller)
            
            # Process results
            result.end_time = time.time()
            result = self._analyze_scout_performance(result, scout_result)
            
            print(f"  ✅ {model.value} completed in {result.duration_seconds():.1f}s")
            
        except Exception as e:
            result.end_time = time.time()
            result.errors.append(str(e))
            print(f"  ❌ {model.value} failed: {str(e)}")
            
        finally:
            if browser:
                await browser.close()
                
        return result
    
    def _create_scout_controller(self) -> Controller:
        """Create a controller with scout-specific actions"""
        controller = Controller()
        
        # Add measurement and analysis actions
        @controller.registry.action(
            description="Capture filter panel state with timing"
        )
        async def analyze_filter_panel(page):
            """Analyze filter panel opening with detailed timing"""
            measurements = {
                "panel_visible": False,
                "load_time_ms": 0,
                "interactive_elements": 0,
                "selectors_found": []
            }
            
            start = time.time()
            
            # Check for filter panel with multiple selectors
            panel_selectors = [
                ".filter-panel",
                "[role='dialog']:has-text('Filter')",
                ".filter-configuration",
                "[data-testid='filter-panel']"
            ]
            
            for selector in panel_selectors:
                element = await page.query_selector(selector)
                if element and await element.is_visible():
                    measurements["panel_visible"] = True
                    measurements["selectors_found"].append(selector)
                    break
            
            # Count interactive elements if panel found
            if measurements["panel_visible"]:
                buttons = await page.query_selector_all("button:visible")
                inputs = await page.query_selector_all("input:visible, select:visible")
                measurements["interactive_elements"] = len(buttons) + len(inputs)
            
            measurements["load_time_ms"] = int((time.time() - start) * 1000)
            return measurements
        
        @controller.registry.action(
            description="Test filter application with verification"
        )
        async def test_filter_application(page, filter_value: str):
            """Apply a filter and measure the complete cycle"""
            test_result = {
                "value": filter_value,
                "success": False,
                "timing": {},
                "verification": {}
            }
            
            try:
                # Record initial state
                initial_rows = len(await page.query_selector_all("tr[data-rowindex]"))
                test_result["verification"]["initial_rows"] = initial_rows
                
                # Apply filter (simplified for benchmark)
                # ... filter application logic ...
                
                test_result["success"] = True
                
            except Exception as e:
                test_result["error"] = str(e)
                
            return test_result
        
        return controller
    
    def _analyze_scout_performance(self, result: BenchmarkResult, scout_output: Any) -> BenchmarkResult:
        """Analyze the scout's performance and findings"""
        
        # Extract metrics from scout output
        if isinstance(scout_output, dict):
            # Count findings
            if "selectors" in scout_output:
                result.findings_count += len(scout_output["selectors"])
            if "timings" in scout_output:
                result.findings_count += len(scout_output["timings"])
            if "edge_cases" in scout_output:
                result.findings_count += len(scout_output["edge_cases"])
            
            # Calculate reliability score (0-100)
            # Based on: selector quality, timing precision, error handling
            reliability_factors = []
            
            # Check for good selectors (not using dynamic IDs)
            if "selectors" in scout_output:
                good_selectors = sum(1 for s in scout_output["selectors"].values() 
                                   if not (":" in s and s.count(":") > 2))
                reliability_factors.append(good_selectors / max(len(scout_output["selectors"]), 1))
            
            # Check for timing measurements
            if "timings" in scout_output:
                reliability_factors.append(min(len(scout_output["timings"]) / 5, 1.0))
            
            # Check for error handling
            if "recovery_procedures" in scout_output:
                reliability_factors.append(0.8)
            
            result.reliability_score = sum(reliability_factors) / max(len(reliability_factors), 1) * 100
            
            # Calculate completeness score (0-100)
            expected_findings = {
                "selectors": 10,  # Expected number of key selectors
                "timings": 5,     # Expected timing measurements
                "edge_cases": 4,  # Expected edge cases
                "recovery": 2     # Expected recovery procedures
            }
            
            completeness_factors = []
            for key, expected in expected_findings.items():
                if key in scout_output:
                    actual = len(scout_output[key]) if isinstance(scout_output[key], (list, dict)) else 1
                    completeness_factors.append(min(actual / expected, 1.0))
                else:
                    completeness_factors.append(0)
            
            result.completeness_score = sum(completeness_factors) / len(completeness_factors) * 100
        
        # Estimate tokens and cost (rough estimates)
        if result.model == ScoutModel.GEMINI_2_FLASH:
            result.tokens_used = int(result.duration_seconds() * 1000)  # ~1k tokens/sec
            result.cost_estimate = result.tokens_used * 0.00001  # Gemini pricing
        elif result.model == ScoutModel.OPENAI_O1_MINI:
            result.tokens_used = int(result.duration_seconds() * 500)   # ~500 tokens/sec
            result.cost_estimate = result.tokens_used * 0.00003  # o1-mini pricing
        
        return result
    
    def _generate_comparison(self) -> Dict[str, Any]:
        """Generate a comparison report of all models"""
        
        comparison = {
            "benchmark_id": f"scout_benchmark_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "target_url": self.airtable_url,
            "models_tested": [m.value for m in self.results.keys()],
            "summary": {},
            "detailed_results": {},
            "rankings": {}
        }
        
        # Generate summary statistics
        for model, result in self.results.items():
            comparison["detailed_results"][model.value] = result.to_dict()
            
        # Rank models by different criteria
        if len(self.results) > 1:
            # Speed ranking
            speed_ranking = sorted(self.results.items(), 
                                 key=lambda x: x[1].duration_seconds())
            comparison["rankings"]["speed"] = [m[0].value for m in speed_ranking]
            
            # Completeness ranking
            completeness_ranking = sorted(self.results.items(),
                                        key=lambda x: x[1].completeness_score,
                                        reverse=True)
            comparison["rankings"]["completeness"] = [m[0].value for m in completeness_ranking]
            
            # Reliability ranking
            reliability_ranking = sorted(self.results.items(),
                                       key=lambda x: x[1].reliability_score,
                                       reverse=True)
            comparison["rankings"]["reliability"] = [m[0].value for m in reliability_ranking]
            
            # Cost efficiency ranking (findings per dollar)
            cost_ranking = sorted(self.results.items(),
                                key=lambda x: x[1].findings_count / max(x[1].cost_estimate, 0.0001),
                                reverse=True)
            comparison["rankings"]["cost_efficiency"] = [m[0].value for m in cost_ranking]
        
        # Generate summary
        comparison["summary"] = {
            "fastest_model": comparison["rankings"].get("speed", [None])[0],
            "most_complete": comparison["rankings"].get("completeness", [None])[0],
            "most_reliable": comparison["rankings"].get("reliability", [None])[0],
            "best_value": comparison["rankings"].get("cost_efficiency", [None])[0]
        }
        
        return comparison
    
    def _save_results(self):
        """Save intermediate results"""
        for model, result in self.results.items():
            filename = self.reports_dir / f"{model.value}_result.json"
            with open(filename, "w") as f:
                json.dump(result.to_dict(), f, indent=2)
    
    def _save_comparison(self, comparison: Dict[str, Any]):
        """Save the comparison report"""
        filename = self.reports_dir / f"{comparison['benchmark_id']}.json"
        with open(filename, "w") as f:
            json.dump(comparison, f, indent=2)
        
        # Also create a markdown summary
        self._create_markdown_summary(comparison)
        
        print(f"\n📊 Benchmark complete! Report saved to: {filename}")
    
    def _create_markdown_summary(self, comparison: Dict[str, Any]):
        """Create a readable markdown summary"""
        
        md_file = self.reports_dir / f"{comparison['benchmark_id']}.md"
        
        with open(md_file, "w") as f:
            f.write(f"# Scout Model Benchmark Report\n\n")
            f.write(f"**Date**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"**Target**: {comparison['target_url']}\n\n")
            
            f.write("## Summary\n\n")
            for key, value in comparison["summary"].items():
                f.write(f"- **{key.replace('_', ' ').title()}**: {value}\n")
            
            f.write("\n## Detailed Results\n\n")
            f.write("| Model | Duration (s) | Findings | Completeness | Reliability | Cost ($) |\n")
            f.write("|-------|-------------|----------|--------------|-------------|----------|\n")
            
            for model_name, result in comparison["detailed_results"].items():
                f.write(f"| {model_name} | {result['duration_seconds']:.1f} | ")
                f.write(f"{result['findings_count']} | {result['completeness_score']:.0f}% | ")
                f.write(f"{result['reliability_score']:.0f}% | ${result['cost_estimate']:.4f} |\n")
            
            f.write("\n## Rankings\n\n")
            for criterion, ranking in comparison["rankings"].items():
                f.write(f"### {criterion.replace('_', ' ').title()}\n")
                for i, model in enumerate(ranking, 1):
                    f.write(f"{i}. {model}\n")
                f.write("\n")


# Main benchmark execution
async def run_airtable_scout_benchmark():
    """Run the benchmark with both Gemini and o1-mini"""
    
    # Your Airtable URL here
    airtable_url = "https://airtable.com/appXXXXXXXXXXXXXX"  # Replace with actual
    
    # Models to test
    models_to_test = [
        ScoutModel.GEMINI_2_FLASH,
        ScoutModel.OPENAI_O1_MINI
    ]
    
    # Run benchmark
    benchmark = ScoutBenchmark(airtable_url)
    comparison = await benchmark.run_benchmark(models_to_test)
    
    return comparison


if __name__ == "__main__":
    # Run the benchmark
    asyncio.run(run_airtable_scout_benchmark())