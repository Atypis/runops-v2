# Scout System Directory Structure

This directory contains the Scout reconnaissance system for discovering web UI selectors and automation patterns.

## 📁 Directory Organization

```
scouts/
├── core/                 # Core scout system components
│   ├── browser_use_patch.py    # DOM visibility enhancer (adds 20 attributes)
│   ├── scout_engine.py         # Zero-config scout deployment
│   ├── scout_agent.py          # Browser-Use agent wrapper
│   └── scout_config.py         # LLM model configurations
│
├── missions/            # Executable scout missions
│   ├── airtable_filter_scout_mission.py
│   ├── airtable_login_scout_mission.py
│   └── airtable_record_interaction_scout.py
│
├── docs/                # Documentation
│   ├── README.md              # Detailed system documentation
│   ├── OVERVIEW.md            # Architecture overview
│   ├── IMPLEMENTATION_REPORT.md
│   └── SCOUT_PATCH_SUMMARY.md
│
├── examples/            # Example usage and runners
│   ├── example_usage.py
│   └── run_*.py              # Various scout runners
│
├── tests/               # Test suite
│   ├── test_integration.py
│   ├── test_dom_patch.py
│   └── test_*.py
│
└── reports/             # Scout output reports
    └── [generated JSON/MD reports]
```

## 🚀 Quick Start

1. **Run a mission:**
   ```bash
   cd missions
   python airtable_filter_scout_mission.py
   ```

2. **Create custom mission:**
   ```python
   from scouts.core.scout_engine import scout
   report = await scout("Find login form selectors", "https://example.com")
   ```

3. **Check documentation:**
   - See `docs/OVERVIEW.md` for architecture details
   - See `docs/README.md` for comprehensive guide

## 🔑 Key Components

- **Core System**: 5 essential files in `core/`
- **Active Missions**: 4 reconnaissance missions in `missions/`
- **Documentation**: Complete guides in `docs/`

The Scout system extends Browser-Use to see 33 DOM attributes (vs default 13), enabling discovery of hidden automation hooks like `data-testid`, `id`, and `href`.