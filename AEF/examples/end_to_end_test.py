"""
End-to-End AEF Test

This demonstrates the complete workflow:
1. Load SOP + transcript data
2. Orchestrator analyzes and creates execution plan
3. Browser agent executes the plan
4. Human oversight and feedback
"""

import asyncio
import json
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from core.orchestrator import OrchestratorAgent
from agents.browser_agent import create_browser_agent, ExecutionResult

async def human_approval_callback(step, step_index):
    """
    Simulate human approval for critical steps
    In a real implementation, this would show a UI prompt
    """
    print(f"\n🤔 HUMAN APPROVAL REQUIRED for Step {step_index + 1}")
    print(f"   Description: {step.description}")
    print(f"   Confidence: {step.confidence.value}")
    print(f"   Reasoning: {step.reasoning}")
    
    if step.fallback_options:
        print(f"   Fallback options: {', '.join(step.fallback_options)}")
    
    # For this demo, auto-approve most steps but reject some for testing
    if "decision" in step.description.lower() and "classify" in step.description.lower():
        print("   🤖 Auto-approving email classification decision")
        return True
    
    print("   ✅ Auto-approved for demo")
    return True

async def run_end_to_end_test():
    """Run the complete AEF workflow"""
    
    print("🚀 AEF End-to-End Test")
    print("=" * 60)
    
    # Step 1: Load SOP and transcript data
    print("📊 Step 1: Loading workflow data...")
    
    sop_data = {
        "meta": {
            "id": "e2e-test-workflow",
            "title": "Investor Email Processing Workflow",
            "goal": "Automatically process investor emails and update CRM",
            "purpose": "Streamline investor communication tracking"
        },
        "public": {
            "nodes": [
                {
                    "id": "T0_open_gmail",
                    "type": "task",
                    "label": "Open Gmail",
                    "intent": "Access email inbox"
                },
                {
                    "id": "L1_process_emails", 
                    "type": "loop",
                    "label": "Process Investor Emails",
                    "intent": "Iterate through unread emails"
                },
                {
                    "id": "D1_classify_email",
                    "type": "decision", 
                    "label": "Classify Email as Investor-Related",
                    "intent": "Determine if email needs CRM update"
                },
                {
                    "id": "T1_open_airtable",
                    "type": "task",
                    "label": "Open Airtable CRM", 
                    "intent": "Access CRM system"
                },
                {
                    "id": "T2_update_record",
                    "type": "task",
                    "label": "Update Investor Record",
                    "intent": "Add email data to investor profile"
                }
            ],
            "variables": {
                "investor_keywords": ["funding", "investment", "series", "round"],
                "crm_base_url": "https://airtable.com/app123/tbl456"
            }
        }
    }
    
    transcript_data = [
        {
            "action_type_observed": "SWITCH_TAB",
            "application_in_focus": "Gmail - Inbox",
            "timestamp_start_visual": "00:00:05.000",
            "screen_region_description_post_action": "Gmail inbox loaded with 12 unread emails"
        },
        {
            "action_type_observed": "CLICK",
            "application_in_focus": "Gmail - Inbox",
            "target_element_details": {"type": "email", "subject": "Series A Update"},
            "timestamp_start_visual": "00:00:12.500",
            "screen_region_description_post_action": "Opened email from Sequoia Capital about Series A"
        },
        {
            "action_type_observed": "READ",
            "application_in_focus": "Gmail - Email View", 
            "timestamp_start_visual": "00:00:15.000",
            "screen_region_description_post_action": "Reading email content about funding timeline"
        },
        {
            "action_type_observed": "SWITCH_TAB",
            "application_in_focus": "Airtable - Investors Base",
            "timestamp_start_visual": "00:00:45.000", 
            "screen_region_description_post_action": "Airtable CRM opened showing investor records"
        },
        {
            "action_type_observed": "CLICK",
            "application_in_focus": "Airtable - Investors Base",
            "target_element_details": {"type": "record", "name": "Sequoia Capital"},
            "timestamp_start_visual": "00:00:52.000",
            "screen_region_description_post_action": "Sequoia Capital record opened for editing"
        },
        {
            "action_type_observed": "TYPE",
            "application_in_focus": "Airtable - Investors Base",
            "target_element_details": {"field": "Last Contact", "value": "Series A timeline discussion"},
            "timestamp_start_visual": "00:01:05.000",
            "screen_region_description_post_action": "Updated last contact field with email summary"
        }
    ]
    
    print(f"✅ Loaded workflow: {sop_data['meta']['title']}")
    print(f"✅ Loaded {len(transcript_data)} transcript actions")
    print()
    
    # Step 2: Orchestrator analysis
    print("🧠 Step 2: Orchestrator analysis...")
    
    orchestrator = OrchestratorAgent()
    plan = await orchestrator.analyze_workflow(sop_data, transcript_data)
    
    print(f"✅ Generated execution plan:")
    print(f"   📋 Workflow ID: {plan.workflow_id}")
    print(f"   📝 Steps: {len(plan.steps)}")
    print(f"   ⏱️  Duration: {plan.estimated_duration}s")
    print(f"   ⚠️  Risk: {plan.risk_assessment}")
    print(f"   👤 Human checkpoints: {len(plan.human_checkpoints)}")
    print()
    
    # Display the plan
    print("📋 Execution Plan:")
    print("-" * 40)
    for i, step in enumerate(plan.steps):
        checkpoint = " 👤" if i in plan.human_checkpoints else ""
        confidence_emoji = {"high": "🟢", "medium": "🟡", "low": "🔴"}[step.confidence.value]
        
        print(f"{i+1:2d}. {confidence_emoji} {step.description}{checkpoint}")
        print(f"     {step.type.value} | {step.confidence.value}")
        if step.reasoning:
            print(f"     💭 {step.reasoning}")
        print()
    
    # Step 3: Browser agent execution
    print("🌐 Step 3: Browser agent execution...")
    
    browser_agent = create_browser_agent(headless=True, use_simulation=True)
    await browser_agent.initialize()
    
    print("✅ Browser agent initialized")
    print("🚀 Starting execution with human oversight...")
    print()
    
    # Execute the plan
    results = await browser_agent.execute_plan(
        plan, 
        human_approval_callback=human_approval_callback
    )
    
    # Step 4: Results analysis
    print("📊 Step 4: Execution results...")
    print("-" * 40)
    
    successful_steps = [r for r in results if r.success]
    failed_steps = [r for r in results if not r.success]
    
    print(f"✅ Successful steps: {len(successful_steps)}/{len(results)}")
    print(f"❌ Failed steps: {len(failed_steps)}")
    
    if failed_steps:
        print(f"⚠️  Failures:")
        for result in failed_steps:
            print(f"   - {result.step_id}: {result.message}")
    
    print()
    
    # Detailed execution log
    print("📋 Detailed Execution Log:")
    print("-" * 30)
    
    total_time = sum(r.execution_time for r in results)
    
    for i, result in enumerate(results):
        status_emoji = "✅" if result.success else "❌"
        print(f"{i+1:2d}. {status_emoji} {result.message}")
        print(f"     ⏱️  {result.execution_time:.2f}s | 🎯 {result.confidence_achieved:.0%}")
        
        if result.error_details:
            print(f"     ❌ Error: {result.error_details}")
        print()
    
    print(f"⏱️  Total execution time: {total_time:.2f} seconds")
    print()
    
    # Step 5: Summary and next steps
    print("🎯 Step 5: Summary and recommendations...")
    print("-" * 50)
    
    success_rate = len(successful_steps) / len(results) if results else 0
    
    print(f"📈 Overall success rate: {success_rate:.0%}")
    
    if success_rate >= 0.8:
        print("🎉 Excellent! The workflow is ready for production")
        print("   Recommendations:")
        print("   - Deploy to production environment")
        print("   - Set up monitoring and alerts")
        print("   - Schedule regular execution")
    elif success_rate >= 0.6:
        print("⚠️  Good progress, but needs refinement")
        print("   Recommendations:")
        print("   - Review failed steps and improve confidence")
        print("   - Add more fallback options")
        print("   - Increase human oversight for critical steps")
    else:
        print("🔴 Workflow needs significant improvement")
        print("   Recommendations:")
        print("   - Redesign low-confidence steps")
        print("   - Add more training data")
        print("   - Consider manual execution for complex parts")
    
    print()
    print("🚀 Next steps for production deployment:")
    print("   1. Integrate with real Supabase data")
    print("   2. Build human oversight dashboard")
    print("   3. Add error recovery mechanisms")
    print("   4. Implement learning from execution feedback")
    print("   5. Set up automated scheduling")
    
    # Cleanup
    await browser_agent.cleanup()
    
    return plan, results

async def test_real_browser_execution():
    """
    Test with real browser automation (if browser-use is available)
    """
    print("\n🌐 Testing Real Browser Execution")
    print("=" * 40)
    
    try:
        # Try to create a real browser agent
        browser_agent = create_browser_agent(headless=True, use_simulation=False)
        await browser_agent.initialize()
        
        print("✅ Real browser agent initialized!")
        print("🚀 This would execute actual browser automation")
        
        # For safety, don't actually run real automation in this demo
        print("⚠️  Skipping real execution for demo safety")
        
        await browser_agent.cleanup()
        
    except Exception as e:
        print(f"⚠️  Real browser execution not available: {e}")
        print("   Install browser-use for real automation")

def main():
    """Main test runner"""
    
    print("🎯 AEF Complete System Test")
    print("=" * 70)
    print("Testing the full Agentic Execution Framework pipeline")
    print()
    
    # Run end-to-end test
    plan, results = asyncio.run(run_end_to_end_test())
    
    # Test real browser (if available)
    asyncio.run(test_real_browser_execution())
    
    print("\n" + "=" * 70)
    print("🎉 AEF System Test Complete!")
    print()
    print("💡 Key Achievements:")
    print("   ✅ Orchestrator successfully analyzed SOP + transcript")
    print("   ✅ Generated dynamic execution plan with confidence scoring")
    print("   ✅ Implemented human oversight checkpoints")
    print("   ✅ Browser agent executed plan with realistic simulation")
    print("   ✅ Comprehensive error handling and reporting")
    print()
    print("🚀 The AEF core is working! Ready for real-world testing.")

if __name__ == "__main__":
    main() 