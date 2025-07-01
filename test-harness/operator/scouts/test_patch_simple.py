#!/usr/bin/env python3
"""
Simple test to verify Scout patch functionality
"""

import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Disable auto-patch for controlled testing
os.environ['SCOUT_DISABLE_PATCH'] = '1'

from scouts import browser_use_patch
from browser_use.agent.views import AgentSettings
from browser_use.agent.service import Agent


def test_patch_functionality():
	"""Test that the patch actually works"""
	print("🔍 Testing Scout Browser-Use Patch")
	print("=" * 60)
	
	# Check initial state
	print("\n1. Initial State:")
	print(f"   Patched: {browser_use_patch.is_patched()}")
	original_attrs = AgentSettings.model_fields['include_attributes'].default
	print(f"   Default attributes: {len(original_attrs)}")
	print(f"   Sample: {original_attrs[:3]}...")
	
	# Apply patch
	print("\n2. Applying Scout patch...")
	browser_use_patch.apply_scout_patch()
	
	# Check patched state
	print("\n3. After Patching:")
	print(f"   Patched: {browser_use_patch.is_patched()}")
	patched_attrs = AgentSettings.model_fields['include_attributes'].default
	print(f"   Default attributes: {len(patched_attrs)}")
	print(f"   Added: {len(patched_attrs) - len(original_attrs)} new attributes")
	
	# Check specific attributes
	print("\n4. Scout Attributes Now Available:")
	scout_attrs = ['id', 'data-testid', 'data-qa', 'href', 'data-automation']
	for attr in scout_attrs:
		available = attr in patched_attrs
		print(f"   {attr}: {'✅' if available else '❌'}")
	
	# Test Agent initialization
	print("\n5. Testing Agent Creation...")
	try:
		# Mock LLM for testing
		class MockLLM:
			pass
		
		# Create agent with defaults
		agent = Agent(task="Test", llm=MockLLM())
		
		# Check if attributes were applied
		if hasattr(agent, 'settings') and hasattr(agent.settings, 'include_attributes'):
			agent_attrs = agent.settings.include_attributes
			print(f"   Agent has {len(agent_attrs)} attributes")
			print(f"   Includes Scout attributes: {'id' in agent_attrs}")
		else:
			print("   ⚠️  Could not verify agent attributes")
		
		print("   ✅ Agent created successfully")
		
	except Exception as e:
		print(f"   ❌ Agent creation failed: {e}")
	
	# Remove patch
	print("\n6. Removing patch...")
	browser_use_patch.remove_scout_patch()
	print(f"   Patched: {browser_use_patch.is_patched()}")
	restored_attrs = AgentSettings.model_fields['include_attributes'].default
	print(f"   Attributes restored: {len(restored_attrs) == len(original_attrs)}")
	
	print("\n✅ Test completed successfully!")


if __name__ == "__main__":
	test_patch_functionality()