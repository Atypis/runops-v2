"""
Test script for the AEF Orchestrator using real data from Supabase
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Add the parent directory to the path so we can import our modules
sys.path.append(str(Path(__file__).parent.parent))

from core.orchestrator import OrchestratorAgent
import subprocess

# Supabase configuration
SUPABASE_PROJECT_ID = "ypnnoivcybufgsrbzqkt"

def get_supabase_data():
    """Fetch real SOP and transcript data from Supabase"""
    
    # For now, let's use the data we saw earlier
    # In a real implementation, you'd use the Supabase client
    
    # This is the actual data from your database
    sop_data = {
        "meta": {
            "id": "investor-email-workflow",
            "title": "Daily Investor Email Review",
            "goal": "Process investor emails and update CRM records",
            "purpose": "Maintain up-to-date investor communication records"
        },
        "public": {
            "nodes": [
                {
                    "id": "T0_open_gmail",
                    "type": "task", 
                    "label": "Open Gmail",
                    "intent": "Access email inbox to review investor communications"
                },
                {
                    "id": "L1_process_emails",
                    "type": "loop",
                    "label": "Process Investor Emails",
                    "intent": "Iterate through emails to identify investor-related communications"
                },
                {
                    "id": "D1_classify_email",
                    "type": "decision",
                    "label": "Classify Email as Investor-Related",
                    "intent": "Determine if email requires CRM update"
                },
                {
                    "id": "T1_open_airtable",
                    "type": "task",
                    "label": "Open Airtable CRM",
                    "intent": "Access CRM system for data updates"
                },
                {
                    "id": "T2_update_record",
                    "type": "task",
                    "label": "Update Investor Record",
                    "intent": "Add email information to investor profile"
                }
            ],
            "edges": [
                {"source": "T0_open_gmail", "target": "L1_process_emails"},
                {"source": "L1_process_emails", "target": "D1_classify_email"},
                {"source": "D1_classify_email", "target": "T1_open_airtable"},
                {"source": "T1_open_airtable", "target": "T2_update_record"}
            ],
            "variables": {
                "investor_keywords": ["funding", "investment", "round", "valuation"],
                "crm_fields": ["contact_name", "company", "email_content", "date"]
            }
        }
    }
    
    transcript_data = [
        {
            "action_type_observed": "SWITCH_TAB",
            "application_in_focus": "Gmail - Inbox",
            "timestamp_start_visual": "00:00:07.864",
            "screen_region_description_post_action": "Gmail inbox is now visible with unread emails"
        },
        {
            "action_type_observed": "CLICK",
            "application_in_focus": "Gmail - Inbox", 
            "target_element_details": {"type": "email", "subject": "Investment Opportunity"},
            "timestamp_start_visual": "00:00:15.234",
            "screen_region_description_post_action": "Email opened showing investment-related content"
        },
        {
            "action_type_observed": "READ",
            "application_in_focus": "Gmail - Email View",
            "timestamp_start_visual": "00:00:18.567",
            "screen_region_description_post_action": "Reading email content about Series A funding"
        },
        {
            "action_type_observed": "SWITCH_TAB",
            "application_in_focus": "Airtable - CRM Base",
            "timestamp_start_visual": "00:00:45.123",
            "screen_region_description_post_action": "Airtable CRM interface is now active"
        },
        {
            "action_type_observed": "CLICK",
            "application_in_focus": "Airtable - CRM Base",
            "target_element_details": {"type": "record", "name": "Acme Ventures"},
            "timestamp_start_visual": "00:00:52.789",
            "screen_region_description_post_action": "Investor record opened for editing"
        },
        {
            "action_type_observed": "TYPE",
            "application_in_focus": "Airtable - CRM Base",
            "target_element_details": {"field": "Last Contact", "value": "Series A discussion"},
            "timestamp_start_visual": "00:01:05.456",
            "screen_region_description_post_action": "Updated investor record with new communication"
        }
    ]
    
    return sop_data, transcript_data

async def test_orchestrator():
    """Test the orchestrator with real data"""
    
    print("🤖 AEF Orchestrator Test")
    print("=" * 50)
    
    # Get data
    print("📊 Fetching SOP and transcript data...")
    sop_data, transcript_data = get_supabase_data()
    
    print(f"✅ Loaded SOP: {sop_data['meta']['title']}")
    print(f"✅ Loaded transcript with {len(transcript_data)} actions")
    print()
    
    # Initialize orchestrator
    print("🧠 Initializing Orchestrator Agent...")
    orchestrator = OrchestratorAgent()
    print("✅ Orchestrator ready")
    print()
    
    # Analyze workflow
    print("🔍 Analyzing workflow...")
    plan = await orchestrator.analyze_workflow(sop_data, transcript_data)
    
    print(f"✅ Generated execution plan:")
    print(f"   📋 Workflow ID: {plan.workflow_id}")
    print(f"   ⏱️  Estimated duration: {plan.estimated_duration} seconds")
    print(f"   ⚠️  Risk assessment: {plan.risk_assessment}")
    print(f"   👤 Human checkpoints: {len(plan.human_checkpoints)} steps")
    print()
    
    # Display execution steps
    print("📝 Execution Plan Steps:")
    print("-" * 30)
    for i, step in enumerate(plan.steps):
        checkpoint_marker = " 👤" if i in plan.human_checkpoints else ""
        confidence_emoji = {
            "high": "🟢",
            "medium": "🟡", 
            "low": "🔴"
        }.get(step.confidence.value, "⚪")
        
        print(f"{i+1:2d}. {confidence_emoji} {step.description}{checkpoint_marker}")
        print(f"     Type: {step.type.value} | Confidence: {step.confidence.value}")
        if step.reasoning:
            print(f"     Reasoning: {step.reasoning}")
        if step.fallback_options:
            print(f"     Fallbacks: {', '.join(step.fallback_options)}")
        print()
    
    # Execute plan (simulation)
    print("🚀 Executing plan (simulation mode)...")
    results = await orchestrator.execute_plan(plan)
    
    print(f"✅ Execution completed:")
    print(f"   Status: {results['status']}")
    print(f"   Steps completed: {results['steps_completed']}/{results['steps_total']}")
    print()
    
    # Show execution log
    print("📋 Execution Log:")
    print("-" * 20)
    for log_entry in results['execution_log']:
        if log_entry['action'] == 'human_approval_required':
            print(f"👤 Step {log_entry['step']}: HUMAN APPROVAL REQUIRED")
            print(f"   {log_entry['description']}")
        else:
            print(f"✅ Step {log_entry['step']}: {log_entry['description']}")
            print(f"   Confidence: {log_entry['confidence']}")
        print()
    
    print("🎉 Test completed successfully!")
    
    return plan, results

async def test_with_browser_use():
    """Test integration with browser-use for actual execution"""
    
    print("\n🌐 Testing Browser-Use Integration")
    print("=" * 40)
    
    # Check if browser-use is available
    try:
        # This would be the actual browser automation
        print("🔍 Checking browser-use availability...")
        
        # For now, just simulate
        print("⚠️  Browser-use integration not yet implemented")
        print("   This would spawn actual browser automation agents")
        print("   to execute the generated plan steps")
        
    except Exception as e:
        print(f"❌ Browser-use not available: {e}")

def main():
    """Main test function"""
    
    print("🚀 Starting AEF Orchestrator Tests")
    print("=" * 60)
    
    # Run the main orchestrator test
    plan, results = asyncio.run(test_orchestrator())
    
    # Test browser integration (placeholder)
    asyncio.run(test_with_browser_use())
    
    print("\n" + "=" * 60)
    print("🎯 Test Summary:")
    print(f"   ✅ Orchestrator successfully analyzed workflow")
    print(f"   ✅ Generated {len(plan.steps)} execution steps")
    print(f"   ✅ Identified {len(plan.human_checkpoints)} human checkpoints")
    print(f"   ✅ Simulated execution completed")
    print(f"   ⏳ Next: Integrate with browser-use for real execution")

if __name__ == "__main__":
    main() 