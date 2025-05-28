#!/usr/bin/env python3
"""
🎥 Start Timeline Viewer

Simple script to start the standalone timeline viewer.
This runs independently and shows all your captured automation timelines.
"""

import sys
from pathlib import Path

# Add sop_orchestrator to path
sop_path = Path(__file__).parent / "sop_orchestrator"
if str(sop_path) not in sys.path:
    sys.path.insert(0, str(sop_path))

def main():
    print("🎥 Starting Visual Timeline Viewer...")
    print("=" * 50)
    print()
    print("This viewer runs independently and shows all your automation results.")
    print("You can browse timelines even when no automation is running!")
    print()
    
    try:
        from timeline_viewer import main as viewer_main
        viewer_main()
    except ImportError as e:
        print(f"❌ Missing dependencies: {e}")
        print()
        print("Please install required packages:")
        print("   pip install fastapi uvicorn")
        print()
        print("Or install all requirements:")
        print("   pip install -r sop_orchestrator/requirements.txt")
    except KeyboardInterrupt:
        print("\n\n👋 Timeline viewer stopped")
    except Exception as e:
        print(f"\n❌ Error starting timeline viewer: {e}")

if __name__ == "__main__":
    main() 