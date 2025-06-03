#!/usr/bin/env python3
"""
Simple Gmail to Airtable Test
Direct test of the intelligent planner-executor for Gmail→Airtable workflow
"""

import asyncio
from agents.intelligent_planner_executor import IntelligentPlannerExecutor

async def test_gmail_airtable():
    """Simple test of Gmail to Airtable workflow"""
    
    print("🚀 STARTING GMAIL → AIRTABLE WORKFLOW TEST")
    print("="*60)
    
    # Define the Gmail→Airtable task
    task = """
    GMAIL TO AIRTABLE EMAIL PROCESSING WORKFLOW:
    
    I need to process emails from Gmail and update an Airtable CRM with investor information.
    
    WORKFLOW OBJECTIVE:
    1. Navigate to Gmail and authenticate
    2. Process ALL emails in the inbox (not just today's - process everything for testing)
    3. For each email, determine if it's investor-related
    4. If investor-related, extract key information for ALL 10 Airtable fields
    5. Navigate to Airtable CRM
    6. Update existing investor records or create new ones with COMPLETE data
    7. Ensure all 10 fields are populated accurately
    
    CRITICAL REQUIREMENTS:
    - PRESERVE all existing data in the CRM - never create new tables
    - Use existing field structure exactly as it appears
    - Process actual email content, not cached data
    - Maintain data integrity throughout
    - Focus on accuracy and completeness
    
    SUCCESS CRITERIA:
    - All investor emails correctly identified and processed
    - Airtable accurately reflects email information in ALL 10 fields
    - No data loss or corruption
    - Proper stage classification and date formatting
    - Complete historical context preserved
    """
    
    # Credentials
    sensitive_data = {
        'gmail_email': 'michaelburner595@gmail.com',
        'gmail_password': 'dCdWqhgPzJev6Jz'
    }
    
    # Allowed domains
    allowed_domains = [
        'https://*.google.com',
        'https://mail.google.com', 
        'https://*.airtable.com',
        'https://airtable.com'
    ]
    
    print("🧠 Creating intelligent planner-executor...")
    
    # Create the intelligent agent
    agent = IntelligentPlannerExecutor(
        task=task,
        sensitive_data=sensitive_data,
        allowed_domains=allowed_domains,
        use_gemini=True,  # Use Gemini 2.5 Flash
        max_steps_per_task=500,  # Plenty of steps for perfection
        agent_id="gmail_airtable_simple_test"
    )
    
    print("✅ Agent created successfully!")
    print("🎯 Starting workflow execution...")
    
    try:
        # Execute the workflow
        results = await agent.execute_workflow()
        
        print("\n" + "="*60)
        print("🎯 WORKFLOW RESULTS")
        print("="*60)
        print(f"✅ Success: {results['success']}")
        print(f"📊 Success Rate: {results.get('success_rate', 0):.1f}%")
        print(f"🎯 Tasks: {results.get('completed_tasks', 0)}/{results.get('total_tasks', 0)}")
        print(f"🧠 Strategy: {results.get('strategy', 'N/A')}")
        print(f"💡 Insights: {results.get('insights_discovered', 0)}")
        print(f"🔍 Discoveries: {results.get('discoveries_made', 0)}")
        print(f"⚠️ Challenges: {results.get('challenges_encountered', 0)}")
        
        if results.get('error'):
            print(f"❌ Error: {results['error']}")
        
        # Show if we achieved perfection
        if results.get('success_rate', 0) == 100:
            print("\n🏆 PERFECTION ACHIEVED! 100% SUCCESS RATE!")
        elif results.get('success_rate', 0) >= 90:
            print(f"\n🎉 EXCELLENT! {results.get('success_rate', 0):.1f}% - Very close to perfection!")
        elif results.get('success_rate', 0) >= 70:
            print(f"\n✅ GOOD PROGRESS! {results.get('success_rate', 0):.1f}% - Significant improvement!")
        else:
            print(f"\n📈 NEEDS WORK: {results.get('success_rate', 0):.1f}% - Architecture needs refinement")
        
        return results
        
    except Exception as e:
        print(f"\n❌ WORKFLOW FAILED: {str(e)}")
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    print("🧠 INTELLIGENT PLANNER-EXECUTOR: GMAIL → AIRTABLE")
    print("🎯 PERFECTION REQUIREMENT: 100% success rate only")
    print("⚡ Max steps per task: 500")
    print("🚀 Starting test...")
    
    results = asyncio.run(test_gmail_airtable())
    
    print(f"\n🏁 Final Result: {'SUCCESS' if results.get('success') else 'NEEDS IMPROVEMENT'}") 