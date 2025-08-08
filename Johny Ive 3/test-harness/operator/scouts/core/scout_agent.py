"""
Scout-enhanced Browser-Use Agent
Automatically includes DOM attribute patches for reconnaissance
"""

import logging
from typing import List, Optional

from browser_use import Agent as BrowserUseAgent

from . import browser_use_patch

logger = logging.getLogger(__name__)


class ScoutAgent(BrowserUseAgent):
	"""
	Browser-Use Agent enhanced for Scout reconnaissance
	Ensures all stable DOM selectors are visible
	"""
	
	def __init__(self, *args, **kwargs):
		# Ensure patch is applied
		if not browser_use_patch.is_patched():
			browser_use_patch.apply_scout_patch()
		
		# Log scout mode activation
		logger.info("ScoutAgent initialized with enhanced DOM visibility")
		logger.debug(f"Scout whitelist contains {len(browser_use_patch.SCOUT_WHITELIST)} attributes")
		
		# Initialize parent class
		super().__init__(*args, **kwargs)
	
	@property
	def scout_attributes(self) -> List[str]:
		"""Get list of Scout-specific attributes"""
		return browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES
	
	@property
	def all_attributes(self) -> List[str]:
		"""Get complete attribute whitelist"""
		return browser_use_patch.SCOUT_WHITELIST
	
	def get_current_dom_attributes(self) -> List[str]:
		"""Get the current include_attributes setting"""
		# Access through the settings object
		if hasattr(self, 'settings') and hasattr(self.settings, 'include_attributes'):
			return self.settings.include_attributes
		return []
	
	def verify_scout_attributes(self) -> bool:
		"""Verify Scout attributes are included in current settings"""
		current_attrs = self.get_current_dom_attributes()
		missing = set(browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES) - set(current_attrs)
		if missing:
			logger.warning(f"Missing Scout attributes: {missing}")
			return False
		return True