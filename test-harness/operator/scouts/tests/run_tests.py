#!/usr/bin/env python
"""
Run Scout Browser-Use patch tests
"""

import sys
import os
import pytest
import logging

# Add parent directories to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Configure logging
logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
	# Run unit tests first
	print("=" * 60)
	print("Running unit tests...")
	print("=" * 60)
	unit_result = pytest.main([
		os.path.join(os.path.dirname(__file__), "test_dom_patch.py"),
		"-v",
		"--tb=short"
	])
	
	if unit_result != 0:
		print("\n❌ Unit tests failed!")
		sys.exit(1)
	
	print("\n✅ Unit tests passed!")
	
	# Run integration tests if unit tests pass
	print("\n" + "=" * 60)
	print("Running integration tests...")
	print("=" * 60)
	integration_result = pytest.main([
		os.path.join(os.path.dirname(__file__), "test_integration.py"),
		"-v",
		"--tb=short",
		"-m", "not slow"  # Skip slow tests in CI
	])
	
	if integration_result != 0:
		print("\n❌ Integration tests failed!")
		sys.exit(1)
	
	print("\n✅ Integration tests passed!")
	print("\n🎉 All tests passed! ✅")