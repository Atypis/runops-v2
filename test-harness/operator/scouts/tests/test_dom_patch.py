"""
Unit tests for Browser-Use DOM attribute monkey patch
"""

import os
import pytest
from unittest.mock import Mock, patch, MagicMock
import sys

# Add parent directories to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))))

# Set environment variable to prevent auto-patching during import
os.environ['SCOUT_DISABLE_PATCH'] = '1'

# Import our patches
from scouts import browser_use_patch
from scouts.scout_agent import ScoutAgent


class TestDOMAttributePatch:
	"""Test DOM attribute whitelist patching"""
	
	def setup_method(self):
		"""Ensure clean state before each test"""
		# Remove environment variable for tests
		if 'SCOUT_DISABLE_PATCH' in os.environ:
			del os.environ['SCOUT_DISABLE_PATCH']
		
		if browser_use_patch.is_patched():
			browser_use_patch.remove_scout_patch()
	
	def teardown_method(self):
		"""Clean up after each test"""
		if browser_use_patch.is_patched():
			browser_use_patch.remove_scout_patch()
		# Restore environment variable
		os.environ['SCOUT_DISABLE_PATCH'] = '1'
	
	def test_patch_applies_successfully(self):
		"""Test that patch can be applied"""
		assert not browser_use_patch.is_patched()
		
		browser_use_patch.apply_scout_patch()
		
		assert browser_use_patch.is_patched()
	
	def test_patch_modifies_agent_init(self):
		"""Test that patch modifies Agent.__init__"""
		from browser_use.agent.service import Agent
		
		# Store original
		original_init = Agent.__init__
		
		browser_use_patch.apply_scout_patch()
		
		# Verify it was modified
		assert Agent.__init__ != original_init
		assert hasattr(Agent.__init__, '__name__')
		assert 'patched' in Agent.__init__.__name__
	
	def test_patch_modifies_agent_settings_default(self):
		"""Test that patch modifies AgentSettings default"""
		from browser_use.agent.views import AgentSettings
		
		# Get original default from model field
		original_default = AgentSettings.model_fields['include_attributes'].default
		
		browser_use_patch.apply_scout_patch()
		
		# Verify default was changed
		assert AgentSettings.model_fields['include_attributes'].default == browser_use_patch.SCOUT_WHITELIST
		assert len(AgentSettings.model_fields['include_attributes'].default) > len(original_default)
	
	def test_scout_attributes_included_in_whitelist(self):
		"""Test that Scout attributes are in the combined whitelist"""
		# Verify all scout attributes are included
		for attr in browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES:
			assert attr in browser_use_patch.SCOUT_WHITELIST
		
		# Verify all browser-use defaults are preserved
		for attr in browser_use_patch.BROWSER_USE_DEFAULTS:
			assert attr in browser_use_patch.SCOUT_WHITELIST
		
		# Verify specific important attributes
		assert 'id' in browser_use_patch.SCOUT_WHITELIST
		assert 'data-testid' in browser_use_patch.SCOUT_WHITELIST
		assert 'data-qa' in browser_use_patch.SCOUT_WHITELIST
		assert 'href' in browser_use_patch.SCOUT_WHITELIST
	
	def test_patch_preserves_browser_use_defaults(self):
		"""Test that original Browser-Use attributes are preserved"""
		browser_use_patch.apply_scout_patch()
		
		# Check that all defaults are in the combined whitelist
		for attr in browser_use_patch.BROWSER_USE_DEFAULTS:
			assert attr in browser_use_patch.SCOUT_WHITELIST
	
	def test_patch_can_be_removed(self):
		"""Test that patch can be removed cleanly"""
		from browser_use.agent.service import Agent
		from browser_use.agent.views import AgentSettings
		
		# Apply patch
		browser_use_patch.apply_scout_patch()
		assert browser_use_patch.is_patched()
		
		# Remove patch
		browser_use_patch.remove_scout_patch()
		assert not browser_use_patch.is_patched()
		
		# Verify original methods are restored
		assert Agent.__init__ == browser_use_patch._original_agent_init
		assert AgentSettings.model_fields['include_attributes'].default == browser_use_patch._original_settings_attributes
	
	def test_double_patch_is_safe(self):
		"""Test that applying patch twice doesn't cause issues"""
		browser_use_patch.apply_scout_patch()
		browser_use_patch.apply_scout_patch()  # Should log warning
		
		assert browser_use_patch.is_patched()
	
	def test_double_remove_is_safe(self):
		"""Test that removing patch twice doesn't cause issues"""
		browser_use_patch.apply_scout_patch()
		browser_use_patch.remove_scout_patch()
		browser_use_patch.remove_scout_patch()  # Should log warning
		
		assert not browser_use_patch.is_patched()
	
	@patch('browser_use.agent.service.Agent')
	def test_agent_initialization_includes_attributes(self, mock_agent_class):
		"""Test that Agent gets Scout attributes by default"""
		browser_use_patch.apply_scout_patch()
		
		# Create a mock instance
		mock_instance = MagicMock()
		mock_agent_class.return_value = mock_instance
		
		# Mock the __init__ to capture kwargs
		init_kwargs = {}
		def capture_init(self, *args, **kwargs):
			init_kwargs.update(kwargs)
		
		# Apply our patched init
		original_init = Mock(side_effect=capture_init)
		browser_use_patch._original_agent_init = original_init
		
		# Re-apply patch to use our mock
		browser_use_patch.remove_scout_patch()
		browser_use_patch._original_agent_init = original_init
		browser_use_patch.apply_scout_patch()
		
		# Test initialization without include_attributes
		from browser_use.agent.service import Agent
		agent = Agent(task="test", llm=Mock())
		
		# Verify include_attributes was set to SCOUT_WHITELIST
		assert 'include_attributes' in init_kwargs
		assert init_kwargs['include_attributes'] == browser_use_patch.SCOUT_WHITELIST
	
	@patch('browser_use.agent.service.Agent')
	def test_agent_initialization_merges_custom_attributes(self, mock_agent_class):
		"""Test that custom attributes are merged with Scout attributes"""
		browser_use_patch.apply_scout_patch()
		
		# Create a mock instance
		mock_instance = MagicMock()
		mock_agent_class.return_value = mock_instance
		
		# Mock the __init__ to capture kwargs
		init_kwargs = {}
		def capture_init(self, *args, **kwargs):
			init_kwargs.update(kwargs)
		
		# Apply our patched init
		original_init = Mock(side_effect=capture_init)
		browser_use_patch._original_agent_init = original_init
		
		# Re-apply patch to use our mock
		browser_use_patch.remove_scout_patch()
		browser_use_patch._original_agent_init = original_init
		browser_use_patch.apply_scout_patch()
		
		# Test initialization with custom attributes
		custom_attrs = ['custom-attr-1', 'custom-attr-2']
		from browser_use.agent.service import Agent
		agent = Agent(task="test", llm=Mock(), include_attributes=custom_attrs)
		
		# Verify attributes were merged
		assert 'include_attributes' in init_kwargs
		result_attrs = init_kwargs['include_attributes']
		
		# Check custom attributes are included
		assert 'custom-attr-1' in result_attrs
		assert 'custom-attr-2' in result_attrs
		
		# Check scout attributes are included
		assert 'data-testid' in result_attrs
		assert 'id' in result_attrs
	
	def test_environment_variable_disables_auto_patch(self):
		"""Test that SCOUT_DISABLE_PATCH environment variable works"""
		# Set environment variable before import
		os.environ['SCOUT_DISABLE_PATCH'] = '1'
		
		# Re-import to test auto-patch behavior
		import importlib
		importlib.reload(browser_use_patch)
		
		# Should not be patched
		assert not browser_use_patch.is_patched()
		
		# Clean up
		del os.environ['SCOUT_DISABLE_PATCH']