#!/usr/bin/env python3
"""
Demo script to show the difference between AI API calls and fallback behavior
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Add core to path
core_path = Path(__file__).parent / "core"
sys.path.append(str(core_path))

from ai_orchestrator import AIOrchestrator

# Sample workflow data
SAMPLE_SOP_DATA = {
    "meta": {
        "title": "Process Investor Emails",
        "goal": "Review Gmail and update Airtable"
    },
    "public": {
        "nodes": [],
        "variables": {}
    }
}

SAMPLE_TRANSCRIPT = "User opened Gmail, read investor email, updated Airtable contact record"

async def demo_with_invalid_key():
    """Demo with invalid API key - should show fallback behavior"""
    print("🧪 DEMO 1: Invalid API Key (Fallback Behavior)")
    print("=" * 60)
    
    # Set invalid API key
    os.environ["ANTHROPIC_API_KEY"] = "invalid_key_demo"
    
    orchestrator = AIOrchestrator()
    
    try:
        plan = await orchestrator.analyze_workflow(
            sop_data=SAMPLE_SOP_DATA,
            transcript_data=SAMPLE_TRANSCRIPT,
            job_id="demo_invalid_key"
        )
        
        print(f"📋 Result: {plan.title}")
        print(f"📊 Steps: {len(plan.steps)}")
        print(f"🛡️ Risk: {plan.risk_assessment['overall_risk']}")
        print(f"⏱️ Duration: {plan.estimated_duration}s")
        
        if "[FALLBACK]" in plan.title:
            print("✅ Correctly fell back to rule-based system")
        else:
            print("❌ Should have fallen back but didn't")
            
    except Exception as e:
        print(f"❌ Error: {e}")

async def demo_with_no_key():
    """Demo with no API key - should show immediate fallback"""
    print("\n🧪 DEMO 2: No API Key (Immediate Fallback)")
    print("=" * 60)
    
    # Remove API key
    if "ANTHROPIC_API_KEY" in os.environ:
        del os.environ["ANTHROPIC_API_KEY"]
    
    orchestrator = AIOrchestrator()
    
    try:
        plan = await orchestrator.analyze_workflow(
            sop_data=SAMPLE_SOP_DATA,
            transcript_data=SAMPLE_TRANSCRIPT,
            job_id="demo_no_key"
        )
        
        print(f"📋 Result: {plan.title}")
        print(f"📊 Steps: {len(plan.steps)}")
        print(f"🛡️ Risk: {plan.risk_assessment['overall_risk']}")
        
        if "[FALLBACK]" in plan.title:
            print("✅ Correctly fell back to rule-based system")
        else:
            print("❌ Should have fallen back but didn't")
            
    except Exception as e:
        print(f"❌ Error: {e}")

def demo_frontend_logging():
    """Show what the frontend logging will look like"""
    print("\n🧪 DEMO 3: Frontend Logging (Simulated)")
    print("=" * 60)
    
    print("🚀 Starting execution plan generation for workflow: demo_workflow_123")
    print("📊 Workflow data: {")
    print("  job_id: 'demo_workflow_123',")
    print("  has_sop_data: true,")
    print("  has_transcript: true,")
    print("  sop_keys: ['meta', 'public'],")
    print("  transcript_length: 67")
    print("}")
    print("🔍 Checking API server health at: http://localhost:8000/health")
    print("❌ API server health check failed: Error: fetch failed")
    print("🔄 Falling back to local converter due to API unavailability")
    print("✅ Conversion complete: {")
    print("  steps_count: 3,")
    print("  human_checkpoints: 1,")
    print("  estimated_duration: 120")
    print("}")

async def main():
    """Run all demos"""
    print("🎭 AEF Logging Demonstration")
    print("This shows the difference between AI calls and fallback behavior")
    print("=" * 80)
    
    await demo_with_invalid_key()
    await demo_with_no_key()
    demo_frontend_logging()
    
    print("\n🎯 Summary:")
    print("- With invalid API key: AI call attempted, fails, falls back")
    print("- With no API key: Immediate fallback")
    print("- Frontend: Detailed logging shows exactly what's happening")
    print("- The 'instant' response was actually the fallback system!")

if __name__ == "__main__":
    asyncio.run(main()) 