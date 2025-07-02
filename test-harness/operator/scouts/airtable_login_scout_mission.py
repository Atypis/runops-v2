#!/usr/bin/env python3
"""
Airtable Login Page Reconnaissance Mission
Director: Discover robust selectors and timings for Google OAuth button

Run this scout before automating Airtable login to ensure selectors stay up-to-date.
"""

import asyncio
import sys
import os
from datetime import datetime

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scout_engine import ScoutEngine  # type: ignore


async def run_airtable_login_reconnaissance():
    """Deploys a Scout to analyse the Airtable login page (OAuth providers)."""

    scout = ScoutEngine()

    mission = f"""
    AIRTABLE LOGIN PAGE RECON

    OBJECTIVE: Identify **stable** selectors, timings and state-detection cues that allow an automation to reliably trigger "Sign in with Google" on Airtable's login page.

    TARGET URL: https://airtable.com/login (redirects from app workspaces)

    DELIVERABLES (JSON):
    {{
        "google_button": {{
            "selectors": ["primary", "fallback1", "fallback2"],
            "most_stable": "primary",
            "notes": "why it works"
        }},
        "other_providers_present": ["microsoft", "apple"],
        "render_time_ms": 0-based timings for the Google button to appear after page load,
        "login_flow": {{
            "redirects_to": "https://accounts.google.com/o/oauth2/v2/auth...",
            "iframe_present": false
        }},
        "close_methods": ["browser back", "link: Cancel"],
        "recommended_strategy": "Step-by-step plan"
    }}

    CRITICAL TASK LIST:
    1. Navigate to https://airtable.com/login?continue=/app123 (generic).
    2. Wait for network idle, record the exact millisecond timestamp when the Google button becomes clickable.
    3. Enumerate **all** attributes on the Google button wrapper and child elements (id, classes, data-provider, aria-label, innerText).
    4. Attempt clicking via each candidate selector and confirm a navigation (accounts.google.com) or iframe.
    5. Document any transient loading skeletons or JS rerenders that hide the button.
    6. Provide robust fallback strategies (text regex, aria-label pattern, natural-language 'act' phrase).

    WHEN FINISHED:
    ‑ Save a markdown report named "login_results.md" that contains:
        • Header "# Airtable Login Scout Results"
        • Completion timestamp
        • The full JSON findings inside a fenced ```json block
        • Extra observations

    """

    print("\n🚀 Launching Airtable Login Scout…\n" + "=" * 60)

    result = await scout.deploy_scout(
        mission=mission,
        target_url="https://airtable.com/login",
        max_steps=30,
    )

    print("\n✅ SCOUT COMPLETED – findings saved to login_results.md")

    return result


if __name__ == "__main__":
    asyncio.run(run_airtable_login_reconnaissance()) 