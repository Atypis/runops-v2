# Scout Browser-Use Enhancement

This package provides monkey patches to enhance Browser-Use's DOM attribute visibility for Scout reconnaissance operations.

## Problem

Browser-Use filters DOM attributes to reduce noise for LLMs, but this hides valuable selector information that Scouts need for discovering stable automation patterns:

- IDs (even stable ones) are hidden
- Test automation attributes (`data-testid`, `data-qa`) are filtered out
- Custom attributes that might be perfect for deterministic automation are invisible

## Solution

The Scout patch extends Browser-Use's attribute whitelist to include:

- **Test Hooks**: `data-testid`, `data-test`, `data-cy`, `data-qa`, etc.
- **Unique IDs**: The `id` attribute
- **Navigation**: `href` for links
- **Accessibility**: `aria-labelledby`, `aria-describedby`, `aria-controls`
- **Form Metadata**: `formcontrolname`, `autocomplete`
- **Framework Hooks**: `data-component`, `data-role`, `data-field`, etc.

## Quick Start

### Option 1: Use ScoutAgent (Recommended)

```python
from scouts.scout_agent import ScoutAgent
from browser_use.llm.openai import ChatOpenAI

# ScoutAgent automatically applies patches
agent = ScoutAgent(
    task="Find all stable selectors on the login form",
    llm=ChatOpenAI(model='gpt-4')
)

# Run reconnaissance
result = await agent.run()
```

### Option 2: Manual Patching

```python
from scouts import browser_use_patch
from browser_use import Agent

# Apply patch
browser_use_patch.apply_scout_patch()

# Use regular Browser-Use agent (now enhanced)
agent = Agent(
    task="Extract automation selectors",
    llm=your_llm
)
```

## What Changes

### Before Scout Patch
```html
[1]<button aria-label='Submit'>Submit</button>
[2]<input name='email' type='email' />
[3]<a>Login</a>
```

### After Scout Patch
```html
[1]<button id='submit-btn' data-testid='form-submit' aria-label='Submit'>Submit</button>
[2]<input id='email' name='email' data-qa='email-input' type='email' />
[3]<a href='/login' data-automation='login-link'>Login</a>
```

## Features

- **Automatic Patching**: ScoutAgent applies patches automatically
- **Backward Compatible**: Preserves all Browser-Use defaults
- **Reversible**: Can be disabled or removed at runtime
- **Tested**: Comprehensive unit and integration tests
- **Zero Dependencies**: Only requires Browser-Use

## Installation

1. Copy the `scouts` directory to your project
2. Ensure Browser-Use is installed: `pip install browser-use`
3. Import and use!

## Testing

Run the test suite:

```bash
python scouts/tests/run_tests.py
```

## Configuration

### Disable Auto-Patching

Set environment variable before importing:

```python
import os
os.environ['SCOUT_DISABLE_PATCH'] = '1'

from scouts import browser_use_patch
# Patch is not applied automatically
```

### Custom Attribute List

```python
# Check current attributes
from scouts import browser_use_patch
print(browser_use_patch.SCOUT_WHITELIST)

# Add your own attributes before patching
browser_use_patch.SCOUT_ADDITIONAL_ATTRIBUTES.append('custom-attr')
browser_use_patch.apply_scout_patch()
```

## Architecture

The patch works by:

1. Modifying `AgentSettings.model_fields['include_attributes'].default` to include Scout attributes
2. Wrapping `Agent.__init__` to ensure Scout attributes are always included
3. Maintaining backward compatibility by preserving existing attributes

## Attributes Added

Total: 20 new attributes (154% increase over Browser-Use defaults)

### Complete List

- `data-testid` - Explicit test IDs
- `data-test` - Common test variant  
- `data-cy` - Cypress testing
- `data-qa` - QA automation
- `data-test-id` - Another variant
- `data-pw` - Playwright test IDs
- `data-automation` - Generic automation
- `data-automation-id` - Automation variant
- `id` - HTML element IDs
- `aria-labelledby` - Accessibility
- `aria-describedby` - Accessibility
- `aria-controls` - Accessibility
- `href` - Link destinations
- `formcontrolname` - Angular forms
- `autocomplete` - Form hints
- `data-component` - Component markers
- `data-role` - Role markers
- `data-field` - Field identifiers
- `data-track` - Analytics hooks
- `data-selenium` - Selenium automation

## Integration with Director/Scout System

This patch enables Scouts to discover deterministic selectors that the Director can use:

```javascript
// Scout discovers with patch:
{
  "reliable_selectors": {
    "submit_button": "#submit-btn",           // ID selector
    "email_input": "[data-testid='email']",   // Test ID
    "login_link": "a[href='/login']"          // Href selector
  }
}

// Director creates deterministic nodes:
{
  "type": "browser_action",
  "config": {
    "action": "click",
    "selector": "#submit-btn",  // Hardcoded from Scout
    "fallback": "click submit"   // AI fallback
  }
}
```

## Troubleshooting

### Patch Not Working

1. Check if already patched: `browser_use_patch.is_patched()`
2. Ensure no environment variable: `SCOUT_DISABLE_PATCH`
3. Verify Browser-Use version compatibility

### Attributes Not Showing

1. Verify patch is applied before creating agents
2. Check the DOM string includes your attributes
3. Ensure elements have the attributes in the HTML

## Contributing

When adding new attributes:

1. Add to `SCOUT_ADDITIONAL_ATTRIBUTES` in `browser_use_patch.py`
2. Add test case in `test_dom_patch.py`
3. Update this README
4. Run tests to ensure compatibility

## License

Same as your project license