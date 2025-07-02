#!/usr/bin/env python
"""
Example usage of Scout-enhanced Browser-Use

This script demonstrates how to use the Scout patches to get enhanced DOM visibility.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import Scout components
from scouts.scout_agent import ScoutAgent
from scouts import browser_use_patch

# You'll need to set up your LLM - this is just an example
# from browser_use.llm.openai import ChatOpenAI


async def basic_scout_example():
	"""Basic example of using ScoutAgent"""
	print("🔍 Scout Agent Example")
	print("=" * 50)
	
	# The ScoutAgent automatically applies patches
	# You would normally pass a real LLM here
	# llm = ChatOpenAI(model='gpt-4')
	
	print("\n1. Creating Scout Agent...")
	# agent = ScoutAgent(
	#     task="Find all login form selectors on the page",
	#     llm=llm
	# )
	
	print("\n2. Scout patches applied automatically!")
	print(f"   - Patched: {browser_use_patch.is_patched()}")
	print(f"   - Total attributes: {len(browser_use_patch.SCOUT_WHITELIST)}")
	print(f"   - Scout additions: {len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES)}")
	
	print("\n3. Scout-specific attributes now visible:")
	for i, attr in enumerate(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES[:5]):
		print(f"   - {attr}")
	print(f"   ... and {len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES) - 5} more")
	
	# Run the agent
	# result = await agent.run()
	# print(f"\n4. Task completed: {result.is_successful()}")


async def manual_patch_example():
	"""Example of manually applying patches"""
	print("\n\n🔧 Manual Patch Example")
	print("=" * 50)
	
	# Check initial state
	print(f"\n1. Initial patch state: {browser_use_patch.is_patched()}")
	
	# Apply patch manually
	print("\n2. Applying Scout patches...")
	browser_use_patch.apply_scout_patch()
	
	# Now use regular Browser-Use Agent - it will have Scout attributes
	from browser_use import Agent
	
	print("\n3. Creating regular Browser-Use Agent (now enhanced)...")
	# agent = Agent(
	#     task="Extract all test automation selectors",
	#     llm=llm
	# )
	
	print("\n4. The agent now sees these additional attributes:")
	scout_attrs = browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES
	print(f"   - IDs: {'id' in scout_attrs}")
	print(f"   - Test IDs: {'data-testid' in scout_attrs}")
	print(f"   - QA hooks: {'data-qa' in scout_attrs}")
	print(f"   - Cypress: {'data-cy' in scout_attrs}")
	print(f"   - Links: {'href' in scout_attrs}")


async def verify_dom_extraction():
	"""Example showing actual DOM extraction with Scout attributes"""
	print("\n\n🎯 DOM Extraction Verification")
	print("=" * 50)
	
	# This would be in your actual reconnaissance code
	example_dom = """
	With Scout patches, the agent can now see:
	
	[1]<button id='submit-btn' data-testid='form-submit' aria-label='Submit'>Submit</button>
	[2]<input id='email' name='email' data-qa='email-input' type='email' />
	[3]<a href='/login' data-automation='login-link'>Login</a>
	
	Instead of just:
	[1]<button aria-label='Submit'>Submit</button>
	[2]<input name='email' type='email' />
	[3]<a>Login</a>
	"""
	
	print(example_dom)


def print_attribute_comparison():
	"""Show before/after attribute visibility"""
	print("\n\n📊 Attribute Visibility Comparison")
	print("=" * 50)
	
	print("\nBrowser-Use Default Attributes:")
	for attr in browser_use_patch.BROWSER_USE_DEFAULTS:
		print(f"  ✓ {attr}")
	
	print(f"\nTotal: {len(browser_use_patch.BROWSER_USE_DEFAULTS)} attributes")
	
	print("\n\nWith Scout Patches - Additional Attributes:")
	tiers = {
		"Test Hooks": ['data-testid', 'data-test', 'data-cy', 'data-qa'],
		"IDs": ['id'],
		"Navigation": ['href'],
		"Accessibility": ['aria-labelledby', 'aria-describedby'],
		"Automation": ['data-automation', 'data-selenium'],
	}
	
	for category, attrs in tiers.items():
		print(f"\n{category}:")
		for attr in attrs:
			if attr in browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES:
				print(f"  ✓ {attr}")
	
	print(f"\n\nTotal with Scout: {len(browser_use_patch.SCOUT_WHITELIST)} attributes")
	print(f"Improvement: +{len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES)} attributes ({len(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES)/len(browser_use_patch.BROWSER_USE_DEFAULTS)*100:.0f}% increase)")


async def main():
	"""Run all examples"""
	print("🚀 Scout Browser-Use Enhancement Examples")
	print("=" * 60)
	
	# Show attribute comparison
	print_attribute_comparison()
	
	# Run async examples
	await basic_scout_example()
	await manual_patch_example()
	await verify_dom_extraction()
	
	print("\n\n✅ Examples completed!")
	print("\nTo use in your project:")
	print("1. Import: from scouts.scout_agent import ScoutAgent")
	print("2. Use ScoutAgent instead of Agent for reconnaissance")
	print("3. All stable selectors will be automatically visible!")


if __name__ == "__main__":
	asyncio.run(main())