# Scout System Overview

The Scout system is a reconnaissance framework that deploys enhanced Browser-Use agents to discover stable UI selectors and automation patterns for web applications. It serves as the "eyes" for the Director system, providing deep technical intelligence about web interfaces.

## Core Architecture

### 1. **Browser-Use Monkey Patch** (`browser_use_patch.py`)
The foundation of the Scout system - extends Browser-Use's DOM visibility from 13 to 33 attributes.

**Key Features:**
- Monkey patches Browser-Use's Agent class on import
- Adds 20 additional DOM attributes to the whitelist
- Auto-applies patch unless `SCOUT_DISABLE_PATCH` env var is set
- Gracefully handles patch/unpatch operations

**Enhanced Attributes Include:**
- **Test Hooks**: `data-testid`, `data-qa`, `data-cy`, `data-test`, `data-automation`
- **Unique IDs**: `id` attribute (normally hidden by Browser-Use)
- **Navigation**: `href` links
- **Accessibility**: `aria-labelledby`, `aria-describedby`, `aria-controls`
- **Form Metadata**: `formcontrolname`, `autocomplete`
- **Framework Hooks**: `data-component`, `data-role`, `data-selenium`

### 2. **Scout Engine** (`scout_engine.py`)
Zero-configuration deployment system for reconnaissance missions.

**Key Features:**
- Uses Gemini 2.5 Pro by default (pre-configured API key)
- Automatically applies Browser-Use patch
- Converts natural language missions into scout-optimized prompts
- Generates structured reconnaissance reports
- Simple async API: `await scout("Find login selectors", "https://example.com")`

**Core Method:**
```python
async def deploy_scout(mission: str, target_url: Optional[str] = None, max_steps: int = 30) -> str
```

### 3. **Scout Agent** (`scout_agent.py`)
Thin wrapper around Browser-Use Agent providing scout-specific enhancements.

**Key Features:**
- Ensures patch is applied before creating agents
- Provides scout-optimized defaults
- Can be used directly for more control than ScoutEngine

## Mission Files

Scout missions are standalone Python scripts that define specific reconnaissance objectives. They follow a standard pattern:

### Mission File Structure:
```python
#!/usr/bin/env python3
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scout_engine import ScoutEngine

async def run_reconnaissance():
    scout = ScoutEngine()
    
    mission = '''
    [Detailed mission briefing with specific objectives]
    '''
    
    result = await scout.deploy_scout(
        mission=mission,
        target_url='https://target-site.com',
        max_steps=30
    )
    
    return result

if __name__ == "__main__":
    asyncio.run(run_reconnaissance())
```

### Active Missions:
- **`airtable_filter_scout_mission.py`** - Deep analysis of Airtable's filter system
- **`airtable_login_scout_mission.py`** - Login flow reconnaissance
- **`airtable_record_interaction_scout.py`** - Record interaction patterns

## How It Works

1. **Director identifies knowledge gap** → "How do I interact with this filter UI?"
2. **Director requests Scout deployment** → Creates mission file or uses ScoutEngine
3. **Scout Engine prepares mission** → Applies patch, configures Gemini 2.5 Pro
4. **Enhanced Browser-Use explores** → Sees 33 DOM attributes instead of 13
5. **Scout documents findings** → Saves to `results.md` using file_write action
6. **Director uses intelligence** → Builds workflows with discovered selectors

## Key Innovation: The Monkey Patch

The Browser-Use library intentionally limits DOM visibility to reduce token usage. However, this hides critical automation hooks like:
- `id` attributes (even stable ones)
- `data-testid` (explicitly for testing!)
- `href` links (navigation targets)

The Scout patch reveals these attributes, making previously "invisible" selectors discoverable.

## Running Scouts

### Method 1: Direct Mission Execution
```bash
cd operator/scouts
python airtable_filter_scout_mission.py
```

### Method 2: Custom Mission
```python
from scout_engine import scout

# Simple reconnaissance
report = await scout("Find all login form selectors")

# With specific URL
report = await scout("Document checkout flow", "https://shop.example.com")
```

### Method 3: Through Director (Future)
```javascript
const scoutReport = await deployScout({
  mission: "Find all selectors for Airtable's filter system",
  url: "https://airtable.com/appXXX"
});
```

## Output Format

Scouts save their findings to `results.md` with:
- Discovered selectors (prioritized by stability)
- Timing measurements
- Interaction patterns
- Edge cases and warnings
- Ready-to-use automation code

## Configuration

- **Model**: Gemini 2.5 Pro (hardcoded in scout_engine.py)
- **Temperature**: 1.0 (balanced exploration)
- **Vision**: Enabled (screenshots for context)
- **Max Steps**: 30 (configurable per mission)
- **File Output**: Scouts write directly to filesystem

## File Organization

```
scouts/
├── Core System (Must Keep)
│   ├── __init__.py              # Package initialization
│   ├── browser_use_patch.py     # DOM visibility enhancer
│   ├── scout_agent.py           # Agent wrapper
│   ├── scout_engine.py          # Zero-config deployment
│   └── scout_config.py          # Model configurations
│
├── Documentation (Keep)
│   ├── README.md                # Main documentation
│   ├── IMPLEMENTATION_REPORT.md # Technical details
│   └── SCOUT_PATCH_SUMMARY.md   # Quick reference
│
├── Active Missions (Keep)
│   ├── airtable_filter_scout_mission.py
│   ├── airtable_login_scout_mission.py
│   └── airtable_record_interaction_scout.py
│
├── Tests (Evaluate)
│   ├── tests/                   # Unit tests directory
│   ├── test_*.py               # Various test files
│   └── run_*.py                # Test runners
│
└── Reports (Clean Periodically)
    └── reports/                 # Generated reconnaissance reports
```

## Best Practices

1. **Write Specific Missions** - Be explicit about what selectors you need
2. **Request File Output** - Always include "Save findings to results.md"
3. **Test Selector Stability** - Ask scouts to verify selectors work across states
4. **Measure Timings** - Critical for reliable automation
5. **Document Edge Cases** - Scouts should note failure modes

## Future Enhancements

- Direct integration with Director's workflow builder
- Parallel scout deployment for faster reconnaissance
- Scout memory for learning patterns across missions
- Automated selector stability scoring
- Continuous monitoring for UI changes

---

The Scout system transforms Browser-Use from a general automation tool into a specialized reconnaissance platform, revealing the hidden automation hooks that make robust workflows possible.