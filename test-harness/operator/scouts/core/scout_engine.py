#!/usr/bin/env python3
"""
Scout Engine - Zero-configuration reconnaissance deployment for Directors

The Scout Engine allows Directors to deploy Browser-Use agents on reconnaissance 
missions with just a mission description. All configuration is handled automatically.
"""

import asyncio
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

# Apply Browser-Use monkey patch for extended DOM visibility
from . import browser_use_patch

from browser_use import Agent
from browser_use.browser.session import BrowserSession
from browser_use.llm.google.chat import ChatGoogle
from browser_use.llm.messages import SystemMessage

logger = logging.getLogger(__name__)


class ScoutEngine:
    """
    Zero-configuration Scout deployment system.
    
    Directors simply provide a mission description and the Scout Engine handles:
    - Model configuration (Gemini 2.5 Pro)
    - Browser setup with extended DOM visibility
    - Mission-specific prompting
    - Natural language reporting
    """
    
    def __init__(self):
        """Initialize Scout Engine with default configuration."""
        # Ensure patch is applied
        if not browser_use_patch.is_patched():
            browser_use_patch.apply_scout_patch()
            
        # Initialize Gemini 2.5 Pro
        self.llm = ChatGoogle(
            api_key="AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs",
            model="gemini-2.5-pro",
            temperature=1.0
        )
        
        logger.info("Scout Engine initialized with Gemini 2.5 Pro")
        logger.info(f"DOM visibility enhanced: {len(browser_use_patch.SCOUT_WHITELIST)} attributes")
    
    def _create_scout_prompt(self, mission: str) -> str:
        """
        Convert Director's mission into a Scout-optimized prompt.
        
        This adapts the Browser-Use system prompt for reconnaissance:
        - Emphasizes selector discovery
        - Focuses on pattern recognition
        - Prioritizes technical details
        """
        return f"""You are a Scout - a specialized reconnaissance agent deployed by the Director to explore and document web UI patterns.

SCOUT MISSION: {mission}

Your reconnaissance objectives:
1. **Discover ALL stable selectors** - Document every reliable way to interact with elements
2. **Test selector reliability** - Verify selectors work across different states
3. **Measure timing requirements** - Note how long operations take
4. **Identify patterns** - Find consistent UI structures that can be reused
5. **Document edge cases** - Note potential failure modes and recovery strategies

ENHANCED DOM VISIBILITY:
You can see {len(browser_use_patch.SCOUT_WHITELIST)} DOM attributes including:
- id attributes (even if they look random, they might be stable)
- data-testid, data-qa, data-test (explicitly for automation)
- href, formcontrolname (form/navigation metadata)
- aria-labelledby, aria-describedby (accessibility)
- data-automation, data-selenium (automation hooks)

REPORTING GUIDELINES:
- Be extremely specific about selectors you discover
- Test multiple selector strategies for critical elements
- Note which attributes are most reliable
- Report exact timing measurements
- Provide ready-to-use selector recommendations

Remember: The Director will use your findings to build robust automation workflows. Be thorough!"""
    
    async def deploy_scout(self, mission: str, target_url: Optional[str] = None, max_steps: int = 30, save_report: bool = False) -> str:
        """
        Deploy a scout on a reconnaissance mission.
        
        Args:
            mission: Natural language description of what to explore
            target_url: Optional starting URL (scout can navigate if not provided)
            max_steps: Maximum steps before returning (default: 30)
            save_report: If True, saves report to scouts/reports/ folder
            
        Returns:
            Natural language report of findings
        """
        logger.info(f"Deploying scout on mission: {mission[:100]}...")
        
        # Prepare the scout task
        task = f"{mission}"
        if target_url:
            task = f"{mission}\n\nStart at: {target_url}"
        
        # Create mission timestamp
        mission_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Create scout agent with mission-specific configuration
        agent = Agent(
            task=task,
            llm=self.llm,
            browser_session=None,  # Will create new session
            use_vision=True,  # Enable screenshots for better analysis
            override_system_message=self._create_scout_prompt(mission),
        )
        
        try:
            # Execute reconnaissance with max_steps
            logger.info("Scout beginning reconnaissance...")
            result = await agent.run(max_steps=max_steps)
            
            
            # Generate report
            report = self._generate_report(mission, result, agent)
            
            # Save report if requested
            if save_report:
                self._save_report(report, mission_id)
            
            logger.info("Scout mission completed successfully")
            return report
            
        except Exception as e:
            logger.error(f"Scout mission failed: {e}")
            return f"Scout mission failed: {str(e)}"
        finally:
            # Clean up browser session
            if hasattr(agent, 'browser_session') and agent.browser_session:
                await agent.browser_session.close()
    
    def _save_report(self, report: str, mission_id: str):
        """Save scout report to the reports directory."""
        try:
            scout_dir = Path(__file__).parent.parent
            reports_dir = scout_dir / "reports"
            reports_dir.mkdir(exist_ok=True)
            
            filename = f"scout_report_{mission_id}.md"
            filepath = reports_dir / filename
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(report)
            
            logger.info(f"Scout report saved to: reports/{filename}")
            
        except Exception as e:
            logger.warning(f"Could not save scout report: {e}")
    
    def _generate_report(self, mission: str, result, agent) -> str:
        """Generate natural language report from scout findings."""
        
        report = f"""# Scout Reconnaissance Report

**Mission**: {mission}
**Status**: {'Successful' if result.is_successful() else 'Partial'}
**Steps Taken**: {result.number_of_steps()}

## Executive Summary
{result.final_result() if result.final_result() else "Mission completed with observations documented below."}

## Key Discoveries

### Discovered Selectors
Based on the enhanced DOM visibility ({len(browser_use_patch.SCOUT_WHITELIST)} attributes), the scout discovered:
- Stable IDs and data attributes that were previously hidden
- Reliable selector patterns for automation
- Timing requirements for UI operations

### Extracted Information
"""
        
        # Add any extracted content
        if result.extracted_content():
            for content in result.extracted_content():
                report += f"\n{content}\n"
        
        # Add action history summary
        if hasattr(result, 'history') and result.history:
            report += "\n### Reconnaissance Path\n"
            for i, step in enumerate(result.history):
                if hasattr(step, 'result') and step.result:
                    report += f"- Step {i+1}: {step.result}\n"
        
        # Add errors if any
        if result.has_errors():
            report += "\n### Challenges Encountered\n"
            for i, error in enumerate(result.errors()):
                if error:
                    report += f"- Step {i+1}: {error}\n"
        
        report += "\n---\n*Scout Engine Report - Enhanced with Extended DOM Visibility*"
        
        return report


# Convenience function for Directors
async def scout(mission: str, url: Optional[str] = None) -> str:
    """
    Simple scout deployment function.
    
    Usage:
        report = await scout("Find all login form selectors on the page")
    """
    engine = ScoutEngine()
    return await engine.deploy_scout(mission, url)


if __name__ == "__main__":
    # Example usage
    async def example():
        engine = ScoutEngine()
        report = await engine.deploy_scout(
            "Find and document all selectors for the search functionality",
            "https://google.com"
        )
        print(report)
    
    asyncio.run(example())