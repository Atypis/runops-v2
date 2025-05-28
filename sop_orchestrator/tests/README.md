# SOP Orchestrator Tests

This directory contains all test files for the SOP Orchestrator system.

## Test Files

### Visual Monitoring Tests
- **`test_screenshot_fixes.py`** - Comprehensive test for screenshot capture quality and browser-use integration
- **`test_real_browser_integration.py`** - Tests real browser automation with element highlighting
- **`test_browser_use.py`** - Basic browser-use functionality tests

### SOP Execution Tests
- **`sop_execution_test.py`** - Tests for SOP execution and automation workflows

### Utility Scripts
- **`start_timeline_viewer.py`** - Quick script to start the timeline viewer interface

## Running Tests

### Prerequisites
```bash
# Ensure environment variables are set
cp ../../.env.example ../../.env
# Edit .env and add your GOOGLE_API_KEY
```

### Individual Tests
```bash
# Test screenshot capture and quality
python3 test_screenshot_fixes.py

# Test browser integration
python3 test_real_browser_integration.py

# Test basic browser-use functionality
python3 test_browser_use.py

# Test SOP execution
python3 sop_execution_test.py
```

### Start Timeline Viewer
```bash
python3 start_timeline_viewer.py
# Visit: http://localhost:8084
```

## Test Structure

```
tests/
├── README.md                          # This file
├── test_screenshot_fixes.py           # Visual monitoring quality tests
├── test_real_browser_integration.py   # Browser automation tests
├── test_browser_use.py                # Basic browser-use tests
├── sop_execution_test.py              # SOP execution tests
├── start_timeline_viewer.py           # Timeline viewer utility
├── integration/                       # Integration test suites
└── unit/                              # Unit test suites
```

## Notes

- All tests use the local browser-use installation in `../../../browser-use/`
- Screenshots are saved to `../screenshots/` directory
- Tests require valid API keys in the `.env` file at project root
- Visual monitoring tests will open a browser window (headless=False for testing) 