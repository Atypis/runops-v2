#!/usr/bin/env python3
"""
Test script to demonstrate the benefits of separate API endpoints
vs. the full pipeline approach.
"""

import requests
import json
import time

# Sample transcript data
SAMPLE_TRANSCRIPT = [
    {
        "timestamp": "00:00:05",
        "action": "Navigate to website",
        "details": "User navigated to company portal login page",
        "url": "https://portal.company.com/login",
        "element": ""
    },
    {
        "timestamp": "00:00:18",
        "action": "Click username field",
        "details": "User clicked on the username input field",
        "url": "https://portal.company.com/login",
        "element": "input[name='username']"
    },
    {
        "timestamp": "00:00:20",
        "action": "Type username",
        "details": "User typed their username",
        "url": "https://portal.company.com/login",
        "element": "input[name='username']"
    }
]

BASE_URL = "http://localhost:8000"

def test_separate_endpoints():
    """Test the separate API endpoints approach"""
    print("🔍 Testing Separate API Endpoints Approach")
    print("=" * 60)
    
    # Stage 1: Parse SOP
    print("📋 Stage 1: Enhanced SOP Parsing")
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BASE_URL}/parse-sop",
            json=SAMPLE_TRANSCRIPT,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            sop_result = response.json()
            print(f"✅ Stage 1 Success: {sop_result.get('status')}")
            print(f"📊 Steps parsed: {sop_result.get('metadata', {}).get('total_steps', 0)}")
            
            enhanced_sop = sop_result.get('enhanced_sop')
            stage1_time = time.time() - start_time
            print(f"⏱️  Stage 1 Time: {stage1_time:.2f}s")
            
        else:
            print(f"❌ Stage 1 Failed: {response.status_code} - {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Stage 1 Error: {str(e)}")
        return
    
    print("-" * 40)
    
    # Stage 2: Create Execution Plan
    print("🎯 Stage 2: Execution Planning")
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BASE_URL}/create-execution-plan",
            json={"enhanced_sop": enhanced_sop},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            plan_result = response.json()
            print(f"✅ Stage 2 Success: {plan_result.get('status')}")
            print(f"🎯 Workflow ID: {plan_result.get('metadata', {}).get('workflow_id')}")
            
            execution_plan = plan_result.get('execution_plan')
            stage2_time = time.time() - start_time
            print(f"⏱️  Stage 2 Time: {stage2_time:.2f}s")
            
        else:
            print(f"❌ Stage 2 Failed: {response.status_code} - {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Stage 2 Error: {str(e)}")
        return
    
    print("-" * 40)
    
    # Stage 3: Execute Workflow
    print("🚀 Stage 3: Workflow Execution")
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BASE_URL}/execute-workflow",
            json={"execution_plan": execution_plan},
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            exec_result = response.json()
            print(f"✅ Stage 3 Success: {exec_result.get('status')}")
            print(f"📈 Success Rate: {exec_result.get('metadata', {}).get('success_rate', 0):.2%}")
            
            stage3_time = time.time() - start_time
            print(f"⏱️  Stage 3 Time: {stage3_time:.2f}s")
            
            total_time = stage1_time + stage2_time + stage3_time
            print(f"⏱️  Total Time: {total_time:.2f}s")
            
        else:
            print(f"❌ Stage 3 Failed: {response.status_code} - {response.text}")
            return
            
    except Exception as e:
        print(f"❌ Stage 3 Error: {str(e)}")
        return
    
    print("✅ Separate Endpoints Test Completed Successfully!")
    return True

def test_full_pipeline():
    """Test the full pipeline approach"""
    print("\n🔄 Testing Full Pipeline Approach")
    print("=" * 60)
    
    start_time = time.time()
    
    try:
        response = requests.post(
            f"{BASE_URL}/full-pipeline",
            json=SAMPLE_TRANSCRIPT,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Full Pipeline Success: {result.get('status')}")
            
            # Extract stage information
            stages = result.get('stages', {})
            summary = result.get('summary', {})
            
            print(f"📋 SOP Parsing: {stages.get('sop_parsing', {}).get('status')}")
            print(f"🎯 Execution Planning: {stages.get('execution_planning', {}).get('status')}")
            print(f"🚀 Workflow Execution: {stages.get('workflow_execution', {}).get('status')}")
            print(f"📈 Success Rate: {summary.get('execution_success_rate', 0):.2%}")
            
            total_time = time.time() - start_time
            print(f"⏱️  Total Time: {total_time:.2f}s")
            
        else:
            print(f"❌ Full Pipeline Failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Full Pipeline Error: {str(e)}")
        return False
    
    print("✅ Full Pipeline Test Completed Successfully!")
    return True

def compare_approaches():
    """Compare the two approaches"""
    print("\n📊 COMPARISON: Separate Endpoints vs Full Pipeline")
    print("=" * 60)
    
    print("🔍 Separate Endpoints Benefits:")
    print("  ✅ Error Isolation - Each stage can be retried independently")
    print("  ✅ Intermediate Validation - Inspect results between stages")
    print("  ✅ Debugging Clarity - Clear identification of failure points")
    print("  ✅ Flexibility - Modify intermediate results or skip stages")
    print("  ✅ Resource Efficiency - Lighter weight individual calls")
    print("  ✅ Timeout Prevention - Avoids long-running single calls")
    
    print("\n🔄 Full Pipeline Benefits:")
    print("  ✅ Simplicity - Single API call for complete workflow")
    print("  ✅ Atomic Operation - All-or-nothing execution")
    print("  ✅ Reduced Network Overhead - Fewer HTTP requests")
    
    print("\n💡 Recommendations:")
    print("  🎯 Use Separate Endpoints for:")
    print("    • Production workflows requiring reliability")
    print("    • Complex SOPs needing human review")
    print("    • Development and debugging")
    print("    • When intermediate validation is needed")
    
    print("  🎯 Use Full Pipeline for:")
    print("    • Simple, well-tested workflows")
    print("    • Batch processing of known-good SOPs")
    print("    • Demos and quick tests")

def main():
    """Main test function"""
    print("🚀 AEF API Endpoint Testing")
    print("🔧 Testing Two-Stage Pipeline Architecture")
    print("=" * 60)
    
    # Test health endpoint
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            health = response.json()
            print(f"✅ API Health: {health.get('status')}")
            print(f"🤖 AI Model: {health.get('ai_model')}")
        else:
            print(f"❌ API Health Check Failed: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Cannot connect to API: {str(e)}")
        print("💡 Make sure the API server is running: python3 AEF/api/main.py")
        return
    
    print("=" * 60)
    
    # Test both approaches
    separate_success = test_separate_endpoints()
    full_pipeline_success = test_full_pipeline()
    
    # Show comparison
    compare_approaches()
    
    print("\n🎉 Testing Complete!")
    if separate_success and full_pipeline_success:
        print("✅ Both approaches working correctly")
    elif separate_success:
        print("✅ Separate endpoints working, full pipeline had issues")
    elif full_pipeline_success:
        print("✅ Full pipeline working, separate endpoints had issues")
    else:
        print("❌ Both approaches had issues - check API server")

if __name__ == "__main__":
    main() 