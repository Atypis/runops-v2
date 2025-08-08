"""
Browser-Use Monkey Patch for Scout Reconnaissance
Extends DOM attribute whitelist to include stable selectors
"""

import logging
from typing import List, Optional

logger = logging.getLogger(__name__)

# Scout's additional attributes (all tiers included)
SCOUT_ADDITIONAL_ATTRIBUTES = [
	# Tier 0: Explicit test hooks
	'data-testid', 'data-test', 'data-cy', 'data-qa', 
	'data-test-id', 'data-pw', 'data-automation', 'data-automation-id',
	
	# Tier 1: Unique IDs
	'id',
	
	# Tier 2: Additional semantic & accessibility
	'aria-labelledby', 'aria-describedby', 'aria-controls',
	
	# Tier 3: Form & control metadata
	'href', 'formcontrolname', 'autocomplete',
	
	# Tier 4: Framework/analytics hooks
	'data-component', 'data-role', 'data-field', 'data-track', 
	'data-selenium'
]

# Browser-Use's default attributes (as of v0.1.x)
BROWSER_USE_DEFAULTS = [
	'title', 'type', 'name', 'role', 'aria-label', 'placeholder',
	'value', 'alt', 'aria-expanded', 'data-date-format', 'checked',
	'data-state', 'aria-checked'
]

# Combined whitelist
SCOUT_WHITELIST = BROWSER_USE_DEFAULTS + SCOUT_ADDITIONAL_ATTRIBUTES

# Store patching state
_patched = False
_original_agent_init = None
_original_settings_attributes = None


def apply_scout_patch():
	"""Apply the Scout reconnaissance patch to Browser-Use"""
	global _patched, _original_agent_init, _original_settings_attributes
	
	if _patched:
		logger.warning("Scout patch already applied, skipping")
		return
	
	logger.info("Applying Scout DOM attribute patch to Browser-Use")
	
	try:
		# Import after checking if already patched to avoid circular imports
		from browser_use.agent.service import Agent
		from browser_use.agent.views import AgentSettings
		
		# Store original values
		_original_agent_init = Agent.__init__
		# Get the default value from the model field
		_original_settings_attributes = AgentSettings.model_fields['include_attributes'].default
		
		# Patch AgentSettings default by modifying the model field
		AgentSettings.model_fields['include_attributes'].default = SCOUT_WHITELIST
		
		# Patch Agent.__init__ to use Scout whitelist by default
		def patched_agent_init(self, *args, **kwargs):
			"""Patched Agent init that includes Scout attributes"""
			# If include_attributes is provided, merge with scout attributes
			if 'include_attributes' in kwargs and kwargs['include_attributes'] is not None:
				# Merge with existing, removing duplicates
				merged_attributes = list(set(kwargs['include_attributes'] + SCOUT_ADDITIONAL_ATTRIBUTES))
				kwargs['include_attributes'] = merged_attributes
			else:
				# Use scout whitelist as default
				kwargs['include_attributes'] = SCOUT_WHITELIST
			
			# Call original init
			return _original_agent_init(self, *args, **kwargs)
		
		# Apply patches
		Agent.__init__ = patched_agent_init
		
		_patched = True
		logger.info(f"Scout patch applied successfully. Added {len(SCOUT_ADDITIONAL_ATTRIBUTES)} attributes")
		
	except ImportError as e:
		logger.error(f"Failed to import Browser-Use components: {e}")
		raise
	except Exception as e:
		logger.error(f"Failed to apply Scout patch: {e}")
		raise


def remove_scout_patch():
	"""Remove the Scout patch (for testing or reverting)"""
	global _patched, _original_agent_init, _original_settings_attributes
	
	if not _patched:
		logger.warning("Scout patch not applied, nothing to remove")
		return
	
	logger.info("Removing Scout DOM attribute patch")
	
	try:
		from browser_use.agent.service import Agent
		from browser_use.agent.views import AgentSettings
		
		# Restore original methods
		if _original_agent_init:
			Agent.__init__ = _original_agent_init
		
		# Restore original default
		if _original_settings_attributes is not None:
			AgentSettings.model_fields['include_attributes'].default = _original_settings_attributes
		
		_patched = False
		logger.info("Scout patch removed successfully")
		
	except ImportError as e:
		logger.error(f"Failed to import Browser-Use components: {e}")
		raise
	except Exception as e:
		logger.error(f"Failed to remove Scout patch: {e}")
		raise


def is_patched() -> bool:
	"""Check if Scout patch is currently applied"""
	return _patched


# Environment variable to disable auto-patching
import os
if not os.environ.get('SCOUT_DISABLE_PATCH'):
	# Auto-apply patch on import
	apply_scout_patch()