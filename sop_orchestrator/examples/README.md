# SOP Orchestrator Examples

This directory contains example implementations and demo scripts for the SOP Orchestrator system.

## Example Categories

### Execution Demos (`execution_demos/`)
Advanced SOP execution implementations with different security and robustness levels:

- **`robust_sop_execution.py`** - Enhanced SOP execution with error handling and retry logic
- **`final_sop_execution.py`** - Production-ready SOP execution implementation
- **`improved_sop_execution.py`** - Improved version with better performance
- **`secure_sop_execution.py`** - Security-focused SOP execution with validation and sandboxing
- **`run_real_browser_demo.sh`** - Shell script to run browser automation demos

### Business Use Cases
- **`investor_crm_sop.py`** - Example SOP for investor CRM automation workflows

## Running Examples

### Prerequisites
```bash
# Ensure environment variables are set
cp ../../.env.example ../../.env
# Edit .env and add your GOOGLE_API_KEY

# Install dependencies
pip install -r ../requirements.txt
```

### Execution Demos
```bash
cd execution_demos/

# Run secure SOP execution
python3 secure_sop_execution.py

# Run robust SOP execution
python3 robust_sop_execution.py

# Run browser demo (requires browser-use)
./run_real_browser_demo.sh
```

### Business Examples
```bash
# Run investor CRM automation
python3 investor_crm_sop.py
```

## Example Structure

```
examples/
├── README.md                           # This file
├── investor_crm_sop.py                 # Business use case example
└── execution_demos/                    # Advanced execution implementations
    ├── robust_sop_execution.py         # Error handling & retry logic
    ├── final_sop_execution.py          # Production-ready implementation
    ├── improved_sop_execution.py       # Performance improvements
    ├── secure_sop_execution.py         # Security-focused implementation
    └── run_real_browser_demo.sh        # Browser automation demo script
```

## Development Notes

- All examples use the visual monitoring system for screenshot capture
- Browser automation examples integrate with browser-use for element highlighting
- Security examples include input validation and sandboxing
- Production examples include comprehensive error handling and logging
- Examples demonstrate different approaches to SOP execution and automation 