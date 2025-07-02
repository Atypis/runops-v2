"""
Scout Browser-Use Enhancements

This package provides monkey patching and extensions for Browser-Use
to enable better DOM attribute visibility for Scout reconnaissance.
"""

from .core.browser_use_patch import (
	SCOUT_ADDITIONAL_ATTRIBUTES,
	SCOUT_WHITELIST,
	apply_scout_patch,
	is_patched,
	remove_scout_patch,
)
from .core.scout_agent import ScoutAgent

__all__ = [
	'ScoutAgent',
	'apply_scout_patch',
	'remove_scout_patch',
	'is_patched',
	'SCOUT_ADDITIONAL_ATTRIBUTES',
	'SCOUT_WHITELIST',
]