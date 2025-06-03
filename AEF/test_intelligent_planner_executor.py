#!/usr/bin/env python3
"""
Test Script for Intelligent Planner-Executor Architecture

This script tests the new dynamic planning approach and compares it
against previous architectures for the Gmail→Airtable workflow.
"""

import asyncio
import json
import os
from datetime import datetime
from typing import Dict, Any

from agents.intelligent_planner_executor import IntelligentPlannerExecutor


def save_test_results(results: Dict[str, Any], test_name: str):
    """Save test results to a JSON file for analysis"""
    
    # Create results directory if it doesn't exist
    results_dir = "AEF/Evals/Test-Runs/Intelligent-Planner-Tests"
    os.makedirs(results_dir, exist_ok=True)
    
    # Add metadata
    results["test_metadata"] = {
        "test_name": test_name,
        "timestamp": datetime.now().isoformat(),
        "architecture": "intelligent_planner_executor_v1",
        "expected_improvement": "25% → 100% success rate (PERFECTION REQUIRED)"
    }
    
    # Save to file
    filename = f"{results_dir}/{test_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"📁 Test results saved to: {filename}")
    return filename


async def test_intelligent_planner_executor():
    """Test the intelligent planner-executor architecture"""
    
    print("🧠 TESTING INTELLIGENT PLANNER-EXECUTOR ARCHITECTURE")
    print("="*80)
    print("Expected improvements:")
    print("- Dynamic planning with feedback loops")
    print("- Active scratchpad memory for insights")
    print("- Task-by-task execution with replanning")
    print("- Better handling of unexpected discoveries")
    print("- Improved data preservation through strategic planning")
    print("="*80)
    
    # Define the workflow task
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
    
    # Credentials and security settings
    sensitive_data = {
        'gmail_email': 'michaelburner595@gmail.com',
        'gmail_password': 'dCdWqhgPzJev6Jz'
    }
    
    allowed_domains = [
        'https://*.google.com',
        'https://mail.google.com', 
        'https://*.airtable.com',
        'https://airtable.com'
    ]
    
    # Test with Gemini 2.5 Flash (recommended)
    print("\n🧠 Testing with Gemini 2.5 Flash...")
    
    intelligent_agent = IntelligentPlannerExecutor(
        task=task,
        sensitive_data=sensitive_data,
        allowed_domains=allowed_domains,
        use_gemini=True,
        max_steps_per_task=500,  # Increased for perfection
        agent_id="intelligent_test_gemini"
    )
    
    try:
        results = await intelligent_agent.execute_workflow()
        
        # Save results
        results_file = save_test_results(results, "intelligent_planner_gemini")
        
        # Print comprehensive summary
        print_test_summary(results, "Intelligent Planner-Executor (Gemini 2.5)")
        
        return results
        
    except Exception as e:
        print(f"❌ Test failed with error: {e}")
        error_results = {
            "success": False,
            "error": str(e),
            "architecture": "intelligent_planner_executor_v1",
            "model": "gemini-2.5-flash"
        }
        save_test_results(error_results, "intelligent_planner_gemini_error")
        return error_results


async def test_claude_comparison():
    """Test with Claude Sonnet 4 for comparison"""
    
    print("\n🧠 Testing with Claude Sonnet 4 for comparison...")
    
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
    
    sensitive_data = {
        'gmail_email': 'michaelburner595@gmail.com',
        'gmail_password': 'dCdWqhgPzJev6Jz'
    }
    
    allowed_domains = [
        'https://*.google.com',
        'https://mail.google.com', 
        'https://*.airtable.com',
        'https://airtable.com'
    ]
    
    intelligent_agent = IntelligentPlannerExecutor(
        task=task,
        sensitive_data=sensitive_data,
        allowed_domains=allowed_domains,
        use_gemini=False,  # Use Claude Sonnet 4
        max_steps_per_task=500,  # Increased for perfection
        agent_id="intelligent_test_claude"
    )
    
    try:
        results = await intelligent_agent.execute_workflow()
        
        # Save results
        results_file = save_test_results(results, "intelligent_planner_claude")
        
        # Print comprehensive summary
        print_test_summary(results, "Intelligent Planner-Executor (Claude Sonnet 4)")
        
        return results
        
    except Exception as e:
        print(f"❌ Claude test failed with error: {e}")
        error_results = {
            "success": False,
            "error": str(e),
            "architecture": "intelligent_planner_executor_v1",
            "model": "claude-sonnet-4"
        }
        save_test_results(error_results, "intelligent_planner_claude_error")
        return error_results


def print_test_summary(results: Dict[str, Any], test_name: str):
    """Print a comprehensive test summary"""
    
    print(f"\n{'='*80}")
    print(f"🎯 TEST RESULTS: {test_name}")
    print(f"{'='*80}")
    
    # Basic metrics
    print(f"✅ Overall Success: {results.get('success', False)}")
    print(f"📊 Success Rate: {results.get('success_rate', 0):.1f}%")
    print(f"🎯 Tasks Completed: {results.get('completed_tasks', 0)}/{results.get('total_tasks', 0)}")
    print(f"🧠 Strategy Used: {results.get('strategy', 'N/A')}")
    
    # Intelligence metrics
    print(f"\n🧠 INTELLIGENCE METRICS:")
    print(f"💡 Insights Discovered: {results.get('insights_discovered', 0)}")
    print(f"🔍 Discoveries Made: {results.get('discoveries_made', 0)}")
    print(f"⚠️ Challenges Encountered: {results.get('challenges_encountered', 0)}")
    
    # Execution details
    if results.get('execution_log'):
        print(f"\n📋 EXECUTION LOG:")
        for i, log_entry in enumerate(results['execution_log'], 1):
            status = log_entry.get('status', 'unknown')
            task_id = log_entry.get('task_id', 'unknown')
            print(f"  {i}. Task {task_id}: {status}")
            
            if log_entry.get('findings'):
                findings = log_entry['findings']
                if isinstance(findings, dict) and findings.get('summary'):
                    print(f"     📝 {findings['summary']}")
    
    # Scratchpad insights
    if results.get('final_scratchpad'):
        scratchpad = results['final_scratchpad']
        
        if scratchpad.get('insights'):
            print(f"\n💡 KEY INSIGHTS DISCOVERED:")
            for insight in scratchpad['insights'][:3]:  # Show top 3
                print(f"  • {insight.get('insight', 'N/A')} (confidence: {insight.get('confidence', 0)})")
        
        if scratchpad.get('discoveries'):
            print(f"\n🔍 IMPORTANT DISCOVERIES:")
            for discovery in scratchpad['discoveries'][:3]:  # Show top 3
                print(f"  • {discovery.get('discovery', 'N/A')} (impact: {discovery.get('impact', 'N/A')})")
        
        if scratchpad.get('challenges'):
            print(f"\n⚠️ CHALLENGES ENCOUNTERED:")
            for challenge in scratchpad['challenges'][:3]:  # Show top 3
                print(f"  • {challenge.get('challenge', 'N/A')}")
    
    # Error information
    if results.get('error'):
        print(f"\n❌ ERROR: {results['error']}")
    
    # Performance comparison
    print(f"\n📈 PERFORMANCE COMPARISON:")
    print(f"Previous Architecture (Test Run 1): 5/100 (5%)")
    print(f"Previous Architecture (Test Run 2): 25/100 (25%)")
    print(f"Intelligent Planner-Executor: {results.get('success_rate', 0):.0f}/100 ({results.get('success_rate', 0):.1f}%)")
    
    improvement = results.get('success_rate', 0) - 25  # Compare to best previous
    if improvement > 0:
        print(f"🚀 IMPROVEMENT: +{improvement:.1f} percentage points!")
    else:
        print(f"📉 Performance: {improvement:.1f} percentage points vs previous best")
    
    print(f"{'='*80}")


async def run_comprehensive_test():
    """Run comprehensive test of the intelligent planner-executor"""
    
    print("🚀 COMPREHENSIVE INTELLIGENT PLANNER-EXECUTOR TEST")
    print("="*80)
    print("🎯 PERFECTION REQUIREMENT: This architecture MUST achieve 100% success rate")
    print("Expected improvements:")
    print("- Strategic planning with dynamic adaptation")
    print("- Active memory and insight curation")
    print("- Task-focused execution with feedback loops")
    print("- Better data preservation and integrity")
    print("- ZERO TOLERANCE FOR FAILURE - 100% success only")
    print("="*80)
    
    # Test 1: Gemini 2.5 Flash (Primary test)
    print("\n🧪 TEST 1: GEMINI 2.5 FLASH")
    gemini_results = await test_intelligent_planner_executor()
    
    # Test 2: Claude Sonnet 4 (Comparison)
    print("\n🧪 TEST 2: CLAUDE SONNET 4 COMPARISON")
    claude_results = await test_claude_comparison()
    
    # Final comparison
    print("\n" + "="*80)
    print("🏆 FINAL COMPARISON")
    print("="*80)
    
    print(f"Gemini 2.5 Flash: {gemini_results.get('success_rate', 0):.1f}% success")
    print(f"Claude Sonnet 4: {claude_results.get('success_rate', 0):.1f}% success")
    
    best_model = "Gemini 2.5 Flash" if gemini_results.get('success_rate', 0) > claude_results.get('success_rate', 0) else "Claude Sonnet 4"
    best_rate = max(gemini_results.get('success_rate', 0), claude_results.get('success_rate', 0))
    
    print(f"\n🏆 Best Performance: {best_model} with {best_rate:.1f}% success rate")
    
    # Architecture assessment
    if best_rate == 100:
        print("🏆 PERFECTION ACHIEVED: 100% success rate - exactly what we demanded!")
    elif best_rate >= 90:
        print("🎉 EXCELLENT: Very close to perfection - minor refinements needed")
    elif best_rate >= 70:
        print("✅ GOOD: Significant improvement but still short of our 100% goal")
    elif best_rate >= 50:
        print("📈 PROGRESS: Some improvement, needs major refinement")
    else:
        print("⚠️ NEEDS WORK: Architecture requires fundamental redesign")
    
    return {
        "gemini_results": gemini_results,
        "claude_results": claude_results,
        "best_model": best_model,
        "best_success_rate": best_rate
    }


def main():
    """Main entry point with user options"""
    
    print("🧠 INTELLIGENT PLANNER-EXECUTOR TEST SUITE")
    print("="*50)
    print("Choose test option:")
    print("1. Quick test with Gemini 2.5 Flash")
    print("2. Comprehensive test (both models)")
    print("3. Claude Sonnet 4 only")
    print("4. Exit")
    
    choice = input("\nEnter your choice (1-4): ").strip()
    
    if choice == "1":
        print("\n🚀 Running quick test with Gemini 2.5 Flash...")
        return asyncio.run(test_intelligent_planner_executor())
    
    elif choice == "2":
        print("\n🚀 Running comprehensive test suite...")
        return asyncio.run(run_comprehensive_test())
    
    elif choice == "3":
        print("\n🚀 Running Claude Sonnet 4 test...")
        return asyncio.run(test_claude_comparison())
    
    elif choice == "4":
        print("👋 Goodbye!")
        return None
    
    else:
        print("❌ Invalid choice. Please run again.")
        return None


if __name__ == "__main__":
    main() 