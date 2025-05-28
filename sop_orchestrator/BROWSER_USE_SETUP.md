# Browser-Use Setup Guide

The visual monitoring system uses a local installation of browser-use that is included in this repository.

## Installation

Browser-use is already included in this repository. To set it up:

```bash
# Navigate to the browser-use directory
cd browser-use

# Install dependencies
pip install -e .
```

## Verification

Test that browser-use is working:

```bash
cd browser-use
python -c "from browser_use import BrowserSession; print('✅ Browser-use installed correctly')"
```

## Integration

The visual monitoring system uses the included browser-use installation at:
- `../browser-use/` (relative to sop_orchestrator directory)
- Tests look for `../../../browser-use/` (relative to tests directory)

## Modifications

Since browser-use is included in the repository, you can:
- Make custom modifications to browser-use code
- Track changes with version control
- Ensure reproducible builds across environments

## Requirements

- Python 3.8+
- Chrome/Chromium browser
- Required Python packages (see browser-use requirements.txt)

## Troubleshooting

If you get import errors:
1. Install browser-use in development mode: `cd browser-use && pip install -e .`
2. Check that Chrome/Chromium is installed and accessible
3. Verify the browser-use directory structure is intact 