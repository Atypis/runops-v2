#!/usr/bin/env python3
"""
Test script for the Gemini-powered orchestrator

This script tests the Gemini orchestrator with sample workflow data to ensure
it can generate intelligent execution plans.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Add core to path
core_path = Path(__file__).parent / "core"
sys.path.append(str(core_path))

from gemini_orchestrator import GeminiOrchestrator

# Sample workflow data (based on real SOP structure)
SAMPLE_SOP_DATA = {
    "meta": {
        "title": "Process Investor Emails in Gmail and Update Airtable CRM",
        "goal": "Review new investor emails, categorize them, and update contact records in Airtable",
        "created_at": "2024-01-15T10:30:00Z"
    },
    "public": {
        "nodes": [
            {
                "id": "node_1",
                "type": "navigation",
                "data": {
                    "url": "https://mail.google.com",
                    "description": "Open Gmail inbox"
                }
            },
            {
                "id": "node_2", 
                "type": "interaction",
                "data": {
                    "action": "click",
                    "target": "inbox",
                    "description": "Click on inbox folder"
                }
            },
            {
                "id": "node_3",
                "type": "data_extraction",
                "data": {
                    "action": "read",
                    "target": "email_list",
                    "description": "Review unread emails from investors"
                }
            },
            {
                "id": "node_4",
                "type": "navigation", 
                "data": {
                    "url": "https://airtable.com/app123/tbl456",
                    "description": "Open Airtable CRM base"
                }
            },
            {
                "id": "node_5",
                "type": "data_entry",
                "data": {
                    "action": "update",
                    "target": "contact_record",
                    "description": "Update investor contact with email details"
                }
            }
        ],
        "variables": {
            "investor_email": "",
            "contact_id": "",
            "email_category": ""
        }
    }
}

SAMPLE_TRANSCRIPT = """
[2024-01-15 10:30:15] User opened Chrome browser
[2024-01-15 10:30:18] Navigated to https://mail.google.com
[2024-01-15 10:30:22] Clicked on "Inbox" in left sidebar
[2024-01-15 10:30:25] Scrolled through email list
[2024-01-15 10:30:28] Clicked on email from "john@techventures.com" with subject "Q4 Investment Update"
[2024-01-15 10:30:35] Read email content - investor requesting portfolio update meeting
[2024-01-15 10:30:40] Opened new tab
[2024-01-15 10:30:42] Navigated to https://airtable.com/app123/tbl456
[2024-01-15 10:30:48] Searched for "TechVentures" in contacts table
[2024-01-15 10:30:52] Clicked on John Smith contact record
[2024-01-15 10:30:55] Updated "Last Contact" field with today's date
[2024-01-15 10:30:58] Added note: "Requested Q4 portfolio update meeting via email"
[2024-01-15 10:31:02] Changed status to "Follow-up Required"
[2024-01-15 10:31:05] Saved record
[2024-01-15 10:31:08] Returned to Gmail tab
[2024-01-15 10:31:10] Marked email as important
[2024-01-15 10:31:12] Added label "Investor Relations"
[2024-01-15 10:31:15] Workflow completed
"""

async def test_gemini_orchestrator():
    """Test the Gemini orchestrator with sample data"""
    
    print("🧪 Testing Gemini-Powered Orchestrator")
    print("=" * 50)
    
    # Check if API key is available
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("❌ GOOGLE_API_KEY or GEMINI_API_KEY not found in environment")
        print("Please add your Google AI API key to the environment")
        return
    
    print(f"✅ Google API Key found: {api_key[:10]}...")
    
    # Initialize orchestrator
    try:
        orchestrator = GeminiOrchestrator()
        print("✅ Gemini Orchestrator initialized successfully")
    except Exception as e:
        print(f"❌ Failed to initialize Gemini Orchestrator: {e}")
        return
    
    try:
        print("\n🤖 Calling Gemini 2.5 Flash Preview 05-20 to analyze workflow...")
        
        # Generate execution plan
        execution_plan = await orchestrator.analyze_workflow(
            sop_data=SAMPLE_SOP_DATA,
            transcript_data=SAMPLE_TRANSCRIPT,
            job_id="test_investor_email_workflow"
        )
        
        print(f"✅ Gemini Analysis Complete!")
        print(f"📋 Generated {len(execution_plan.steps)} execution steps")
        print(f"⏱️  Estimated duration: {execution_plan.estimated_duration} seconds")
        print(f"🛡️  Risk level: {execution_plan.risk_assessment['overall_risk']}")
        print(f"👤 Human checkpoints: {len(execution_plan.human_checkpoints)}")
        
        print("\n📊 EXECUTION PLAN DETAILS:")
        print("=" * 50)
        print(f"Title: {execution_plan.title}")
        print(f"Description: {execution_plan.description}")
        
        print(f"\nSteps ({len(execution_plan.steps)}):")
        for i, step in enumerate(execution_plan.steps, 1):
            approval_indicator = "🔒" if step.requires_approval else "🔓"
            confidence_color = {
                "HIGH": "🟢",
                "MEDIUM": "🟡", 
                "LOW": "🔴"
            }.get(step.confidence, "⚪")
            
            print(f"  {i}. {approval_indicator} {confidence_color} [{step.action_type.upper()}] {step.name}")
            print(f"     {step.description}")
            print(f"     Confidence: {step.confidence} | Duration: {step.estimated_duration}s")
            print(f"     Reasoning: {step.reasoning}")
            if step.fallback_options:
                print(f"     Fallbacks: {', '.join(step.fallback_options)}")
            print()
        
        print(f"Risk Assessment:")
        print(f"  Overall Risk: {execution_plan.risk_assessment['overall_risk']}")
        print(f"  Risk Factors: {', '.join(execution_plan.risk_assessment['risk_factors'])}")
        print(f"  Mitigation: {', '.join(execution_plan.risk_assessment['mitigation_strategies'])}")
        
        print(f"\n🎯 SUCCESS: Gemini orchestrator generated intelligent execution plan!")
        
    except Exception as e:
        print(f"❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_gemini_orchestrator()) 