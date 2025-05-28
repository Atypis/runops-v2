# Browser-Use Setup Guide

The visual monitoring system requires a local installation of browser-use.

## Installation

```bash
# Clone browser-use to project root
cd /path/to/your/project/root
git clone https://github.com/gregpr07/browser-use.git

# Install dependencies
cd browser-use
pip install -e .
```

## Verification

Test that browser-use is working:

```bash
cd browser-use
python -c "from browser_use import BrowserSession; print('✅ Browser-use installed correctly')"
```

## Integration

The visual monitoring system automatically detects the local browser-use installation at:
- `../browser-use/` (relative to sop_orchestrator directory)
- Tests look for `../../../browser-use/` (relative to tests directory)

## Requirements

- Python 3.8+
- Chrome/Chromium browser
- Required Python packages (see browser-use requirements.txt)

## Troubleshooting

If you get import errors:
1. Ensure browser-use is cloned to the project root
2. Install browser-use in development mode: `pip install -e .`
3. Check that Chrome/Chromium is installed and accessible 