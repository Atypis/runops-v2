# Browser-Use Monkey Patching Implementation Plan

## Overview

This document outlines the implementation plan for monkey-patching Browser-Use to expose additional DOM attributes for Scout reconnaissance. The patch adds all recommended selector attributes (Tiers 0-3) to the whitelist without distinction.

## Objectives

1. Extend Browser-Use's DOM attribute whitelist to include stable selectors
2. Maintain compatibility with upstream Browser-Use
3. Provide clear testing and verification methods
4. Ensure easy maintenance and updates

## Additional Attributes to Whitelist

Based on consultant recommendations, we'll add ALL the following attributes:

```python
SCOUT_ADDITIONAL_ATTRIBUTES = [
    # Tier 0: Explicit test hooks
    'data-testid', 'data-test', 'data-cy', 'data-qa', 
    'data-test-id', 'data-pw', 'data-automation', 'data-automation-id',
    
    # Tier 1: Unique IDs
    'id',
    
    # Tier 2: Additional semantic & accessibility
    'aria-labelledby', 'aria-describedby', 'aria-controls',
    
    # Tier 3: Form & control metadata
    'href', 'formcontrolname', 'ng-reflect-*', 'autocomplete',
    
    # Tier 4: Framework/analytics hooks
    'data-component', 'data-role', 'data-field', 'data-track', 
    'data-selenium', 'qa-*'
]
```

## Implementation Approach

### File Structure

```
test-harness/operator/
├── scouts/
│   ├── __init__.py
│   ├── browser_use_patch.py      # Monkey patch implementation
│   ├── scout_agent.py            # Scout-specific agent wrapper
│   └── tests/
│       ├── __init__.py
│       ├── test_dom_patch.py     # Unit tests
│       └── test_integration.py   # Integration tests
```

### Core Implementation: `browser_use_patch.py`

```python
"""
Browser-Use Monkey Patch for Scout Reconnaissance
Extends DOM attribute whitelist to include stable selectors
"""

import logging
from typing import List, Optional

# Import before patching
from browser_use.dom.views import DOMElementNode
from browser_use.agent.service import Agent

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

# Store original methods
_original_clickable_elements_to_string = DOMElementNode.clickable_elements_to_string
_original_agent_init = Agent.__init__
_patched = False


def apply_scout_patch():
    """Apply the Scout reconnaissance patch to Browser-Use"""
    global _patched
    
    if _patched:
        logger.warning("Scout patch already applied, skipping")
        return
    
    logger.info("Applying Scout DOM attribute patch to Browser-Use")
    
    # Patch DOMElementNode.clickable_elements_to_string
    def patched_clickable_elements_to_string(
        self, 
        include_attributes: Optional[List[str]] = None
    ) -> str:
        """
        Patched version that includes Scout attributes
        """
        if include_attributes is None:
            include_attributes = SCOUT_WHITELIST
        else:
            # Merge with scout attributes
            include_attributes = list(set(include_attributes + SCOUT_ADDITIONAL_ATTRIBUTES))
        
        return _original_clickable_elements_to_string(self, include_attributes)
    
    # Patch Agent.__init__ to use Scout whitelist by default
    def patched_agent_init(self, *args, **kwargs):
        """
        Patched Agent init that includes Scout attributes
        """
        if 'include_attributes' in kwargs:
            # Merge with existing
            kwargs['include_attributes'] = list(set(
                kwargs['include_attributes'] + SCOUT_ADDITIONAL_ATTRIBUTES
            ))
        else:
            # Use scout whitelist
            kwargs['include_attributes'] = SCOUT_WHITELIST
        
        return _original_agent_init(self, *args, **kwargs)
    
    # Apply patches
    DOMElementNode.clickable_elements_to_string = patched_clickable_elements_to_string
    Agent.__init__ = patched_agent_init
    
    _patched = True
    logger.info(f"Scout patch applied successfully. Added {len(SCOUT_ADDITIONAL_ATTRIBUTES)} attributes")


def remove_scout_patch():
    """Remove the Scout patch (for testing or reverting)"""
    global _patched
    
    if not _patched:
        logger.warning("Scout patch not applied, nothing to remove")
        return
    
    logger.info("Removing Scout DOM attribute patch")
    
    # Restore original methods
    DOMElementNode.clickable_elements_to_string = _original_clickable_elements_to_string
    Agent.__init__ = _original_agent_init
    
    _patched = False
    logger.info("Scout patch removed successfully")


def is_patched() -> bool:
    """Check if Scout patch is currently applied"""
    return _patched


# Auto-apply patch on import
apply_scout_patch()
```

### Scout Agent Wrapper: `scout_agent.py`

```python
"""
Scout-enhanced Browser-Use Agent
Automatically includes DOM attribute patches for reconnaissance
"""

from typing import Optional, List
import browser_use_patch  # This applies the patch
from browser_use import Agent as BrowserUseAgent


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
        
        super().__init__(*args, **kwargs)
    
    @property
    def scout_attributes(self) -> List[str]:
        """Get list of Scout-specific attributes"""
        return browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES
    
    @property
    def all_attributes(self) -> List[str]:
        """Get complete attribute whitelist"""
        return browser_use_patch.SCOUT_WHITELIST
```

## Testing Strategy

### Unit Tests: `test_dom_patch.py`

```python
"""
Unit tests for Browser-Use DOM attribute monkey patch
"""

import pytest
from unittest.mock import Mock, patch
import sys

# Import our patches
from scouts import browser_use_patch
from scouts.scout_agent import ScoutAgent


class TestDOMAttributePatch:
    """Test DOM attribute whitelist patching"""
    
    def setup_method(self):
        """Ensure clean state before each test"""
        if browser_use_patch.is_patched():
            browser_use_patch.remove_scout_patch()
    
    def test_patch_applies_successfully(self):
        """Test that patch can be applied"""
        assert not browser_use_patch.is_patched()
        
        browser_use_patch.apply_scout_patch()
        
        assert browser_use_patch.is_patched()
    
    def test_patch_includes_scout_attributes(self):
        """Test that Scout attributes are included in whitelist"""
        from browser_use.dom.views import DOMElementNode
        
        browser_use_patch.apply_scout_patch()
        
        # Create mock DOM node
        node = Mock(spec=DOMElementNode)
        node.tag_name = 'button'
        node.attributes = {
            'id': 'submit-btn',
            'data-testid': 'form-submit',
            'data-qa': 'submit-button',
            'class': 'btn btn-primary',
            'onclick': 'handleSubmit()'
        }
        
        # Mock the original method to return attributes
        def mock_original(self, include_attributes=None):
            if include_attributes:
                return str([attr for attr in self.attributes if attr in include_attributes])
            return str(self.attributes)
        
        # Temporarily replace original
        browser_use_patch._original_clickable_elements_to_string = mock_original
        
        # Call patched method
        result = DOMElementNode.clickable_elements_to_string(node)
        
        # Verify Scout attributes are included
        assert 'data-testid' in result
        assert 'data-qa' in result
        assert 'id' in result
        # onclick should not be included (not in whitelist)
        assert 'onclick' not in result
    
    def test_patch_preserves_browser_use_defaults(self):
        """Test that original Browser-Use attributes are preserved"""
        browser_use_patch.apply_scout_patch()
        
        # Check that all defaults are in the combined whitelist
        for attr in browser_use_patch.BROWSER_USE_DEFAULTS:
            assert attr in browser_use_patch.SCOUT_WHITELIST
    
    def test_patch_can_be_removed(self):
        """Test that patch can be removed cleanly"""
        browser_use_patch.apply_scout_patch()
        assert browser_use_patch.is_patched()
        
        browser_use_patch.remove_scout_patch()
        assert not browser_use_patch.is_patched()
    
    def test_double_patch_is_safe(self):
        """Test that applying patch twice doesn't cause issues"""
        browser_use_patch.apply_scout_patch()
        browser_use_patch.apply_scout_patch()  # Should log warning
        
        assert browser_use_patch.is_patched()
    
    def test_agent_initialization_includes_attributes(self):
        """Test that Agent gets Scout attributes by default"""
        browser_use_patch.apply_scout_patch()
        
        # We'll need to mock the Agent creation since we can't 
        # instantiate it without full setup
        with patch('browser_use.agent.service.Agent.__init__') as mock_init:
            mock_init.return_value = None
            
            agent = ScoutAgent()
            
            # Verify include_attributes was passed
            call_kwargs = mock_init.call_args[1]
            if 'include_attributes' in call_kwargs:
                attrs = call_kwargs['include_attributes']
                assert 'data-testid' in attrs
                assert 'id' in attrs
                assert 'aria-describedby' in attrs
```

### Integration Tests: `test_integration.py`

```python
"""
Integration tests for Scout-enhanced Browser-Use
Tests actual DOM extraction with enhanced attributes
"""

import pytest
import asyncio
from scouts.scout_agent import ScoutAgent
from browser_use import Browser
import tempfile
import os


class TestScoutIntegration:
    """Integration tests with real browser instance"""
    
    @pytest.fixture
    async def scout_agent(self):
        """Create a Scout agent for testing"""
        # Note: Requires proper Browser-Use setup
        agent = ScoutAgent(
            task="Scout reconnaissance test",
            llm=None  # Would need actual LLM in real test
        )
        yield agent
        # Cleanup
        await agent.close()
    
    @pytest.mark.asyncio
    async def test_dom_extraction_includes_testids(self, scout_agent):
        """Test that DOM extraction includes data-testid attributes"""
        # Create test HTML with various attributes
        test_html = """
        <html>
        <body>
            <button 
                id="submit-btn"
                data-testid="form-submit"
                data-qa="submit-button"
                class="btn btn-primary"
                aria-label="Submit form"
            >
                Submit
            </button>
            <input
                type="email"
                name="email"
                data-cy="email-input"
                placeholder="Enter email"
            />
            <a
                href="/about"
                data-automation="about-link"
                data-test-id="nav-about"
            >
                About Us
            </a>
        </body>
        </html>
        """
        
        # Write to temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.html', delete=False) as f:
            f.write(test_html)
            temp_path = f.name
        
        try:
            # Navigate to test page
            await scout_agent.browser.navigate(f"file://{temp_path}")
            
            # Get DOM state
            dom_state = await scout_agent.browser.get_dom_state()
            
            # Convert to string representation
            dom_string = dom_state.get_clickable_elements_string()
            
            # Verify Scout attributes are included
            assert 'data-testid="form-submit"' in dom_string
            assert 'data-qa="submit-button"' in dom_string
            assert 'data-cy="email-input"' in dom_string
            assert 'data-automation="about-link"' in dom_string
            assert 'data-test-id="nav-about"' in dom_string
            assert 'id="submit-btn"' in dom_string
            
            # Verify Browser-Use defaults still work
            assert 'aria-label="Submit form"' in dom_string
            assert 'placeholder="Enter email"' in dom_string
            assert 'type="email"' in dom_string
            
        finally:
            # Cleanup
            os.unlink(temp_path)
    
    @pytest.mark.asyncio
    async def test_selector_discovery_workflow(self, scout_agent):
        """Test complete selector discovery workflow"""
        # This would test the full Scout reconnaissance flow
        # Including navigation, extraction, and reporting
        pass
```

### Test Runner Script: `run_tests.py`

```python
#!/usr/bin/env python
"""
Run Scout Browser-Use patch tests
"""

import sys
import pytest
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

if __name__ == "__main__":
    # Run unit tests first
    print("Running unit tests...")
    unit_result = pytest.main([
        "scouts/tests/test_dom_patch.py",
        "-v",
        "--tb=short"
    ])
    
    if unit_result != 0:
        print("Unit tests failed!")
        sys.exit(1)
    
    # Run integration tests if unit tests pass
    print("\nRunning integration tests...")
    integration_result = pytest.main([
        "scouts/tests/test_integration.py",
        "-v",
        "--tb=short",
        "-m", "not slow"  # Skip slow tests in CI
    ])
    
    if integration_result != 0:
        print("Integration tests failed!")
        sys.exit(1)
    
    print("\nAll tests passed! ✅")
```

## Usage Examples

### Basic Usage

```python
# Option 1: Automatic patching via import
from scouts.scout_agent import ScoutAgent

# Scout attributes are automatically included
agent = ScoutAgent(
    task="Find all login form selectors",
    llm=your_llm_instance
)

# Option 2: Manual patching
from scouts import browser_use_patch
from browser_use import Agent

# Apply patch
browser_use_patch.apply_scout_patch()

# Use regular Browser-Use agent (now enhanced)
agent = Agent(
    task="Reconnaissance mission",
    llm=your_llm_instance
)
```

### Verifying Patch Status

```python
from scouts import browser_use_patch

# Check if patched
if browser_use_patch.is_patched():
    print("Scout enhancements active")
    print(f"Whitelist contains {len(browser_use_patch.SCOUT_WHITELIST)} attributes")
    print(f"Scout additions: {browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES}")
```

## Maintenance Guide

### Updating for New Browser-Use Versions

1. Check Browser-Use changelog for changes to:
   - `DOMElementNode.clickable_elements_to_string` signature
   - `Agent.__init__` parameters
   - Default `include_attributes` list

2. Update `BROWSER_USE_DEFAULTS` if needed

3. Run full test suite to verify compatibility

4. Update version notes in docstrings

### Adding New Attributes

To add new attributes to Scout's whitelist:

1. Add to `SCOUT_ADDITIONAL_ATTRIBUTES` in `browser_use_patch.py`
2. Add test case in `test_dom_patch.py`
3. Document the addition and rationale

### Debugging Patch Issues

Enable debug logging:
```python
import logging
logging.getLogger('scouts.browser_use_patch').setLevel(logging.DEBUG)
```

Check patch status:
```python
from scouts import browser_use_patch
print(f"Patched: {browser_use_patch.is_patched()}")
print(f"Current whitelist: {browser_use_patch.SCOUT_WHITELIST}")
```

## Rollback Plan

If issues arise, the patch can be disabled:

1. **Runtime removal**:
   ```python
   from scouts import browser_use_patch
   browser_use_patch.remove_scout_patch()
   ```

2. **Prevent auto-patching**:
   ```python
   # Set environment variable
   os.environ['SCOUT_DISABLE_PATCH'] = '1'
   ```

3. **Use vanilla Browser-Use**:
   ```python
   # Import Browser-Use directly without scout modules
   from browser_use import Agent
   ```

## Success Criteria

1. ✅ All Scout attributes appear in DOM extraction
2. ✅ Browser-Use default functionality preserved
3. ✅ No performance degradation
4. ✅ Tests pass on multiple Browser-Use versions
5. ✅ Clear documentation and examples
6. ✅ Easy rollback mechanism

## Timeline

1. **Week 1**: Implement core patching mechanism
2. **Week 2**: Complete test suite
3. **Week 3**: Integration testing with Scout system
4. **Week 4**: Documentation and deployment

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Browser-Use API changes | High | Version pinning, compatibility tests |
| Performance impact | Medium | Benchmark tests, selective patching |
| Attribute conflicts | Low | Namespace prefixing if needed |
| Maintenance burden | Medium | Automated tests, clear docs |