#!/usr/bin/env python3
"""
Comprehensive workflow testing and visualization for the AEF two-stage pipeline.
This script demonstrates real workflows and visualizes the results.
"""

import requests
import json
import time
from typing import Dict, Any, List
import os

BASE_URL = "http://localhost:8000"

# Real workflow examples
WORKFLOWS = {
    "login_workflow": {
        "name": "Company Portal Login",
        "description": "Standard login workflow for company portal",
        "transcript": [
            {
                "timestamp": "00:00:00",
                "action": "Open browser",
                "details": "User opened Chrome browser",
                "url": "",
                "element": ""
            },
            {
                "timestamp": "00:00:05",
                "action": "Navigate to website",
                "details": "User navigated to company portal login page",
                "url": "https://portal.company.com/login",
                "element": ""
            },
            {
                "timestamp": "00:00:12",
                "action": "Wait for page load",
                "details": "Page loading, login form appeared",
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
            },
            {
                "timestamp": "00:00:25",
                "action": "Click password field",
                "details": "User clicked on the password input field",
                "url": "https://portal.company.com/login",
                "element": "input[name='password']"
            },
            {
                "timestamp": "00:00:27",
                "action": "Type password",
                "details": "User typed their password",
                "url": "https://portal.company.com/login",
                "element": "input[name='password']"
            },
            {
                "timestamp": "00:00:32",
                "action": "Click login button",
                "details": "User clicked the login button to submit credentials",
                "url": "https://portal.company.com/login",
                "element": "button[type='submit']"
            },
            {
                "timestamp": "00:00:35",
                "action": "Wait for authentication",
                "details": "System processing login, redirecting to dashboard",
                "url": "https://portal.company.com/dashboard",
                "element": ""
            }
        ]
    },
    "ecommerce_workflow": {
        "name": "E-commerce Purchase",
        "description": "Complete product purchase workflow",
        "transcript": [
            {
                "timestamp": "00:00:00",
                "action": "Navigate to product page",
                "details": "User navigated to specific product page",
                "url": "https://shop.example.com/products/laptop-123",
                "element": ""
            },
            {
                "timestamp": "00:00:08",
                "action": "Select product variant",
                "details": "User selected 16GB RAM variant",
                "url": "https://shop.example.com/products/laptop-123",
                "element": "select[name='memory']"
            },
            {
                "timestamp": "00:00:15",
                "action": "Add to cart",
                "details": "User clicked Add to Cart button",
                "url": "https://shop.example.com/products/laptop-123",
                "element": "button[data-action='add-to-cart']"
            },
            {
                "timestamp": "00:00:18",
                "action": "View cart",
                "details": "User clicked on cart icon to review items",
                "url": "https://shop.example.com/cart",
                "element": "a[href='/cart']"
            },
            {
                "timestamp": "00:00:25",
                "action": "Proceed to checkout",
                "details": "User clicked Checkout button",
                "url": "https://shop.example.com/checkout",
                "element": "button[data-action='checkout']"
            },
            {
                "timestamp": "00:00:30",
                "action": "Fill shipping address",
                "details": "User filled in shipping address form",
                "url": "https://shop.example.com/checkout",
                "element": "form[name='shipping']"
            },
            {
                "timestamp": "00:00:45",
                "action": "Select payment method",
                "details": "User selected credit card payment",
                "url": "https://shop.example.com/checkout",
                "element": "input[name='payment_method'][value='credit_card']"
            },
            {
                "timestamp": "00:00:50",
                "action": "Enter payment details",
                "details": "User entered credit card information",
                "url": "https://shop.example.com/checkout",
                "element": "form[name='payment']"
            },
            {
                "timestamp": "00:01:05",
                "action": "Complete purchase",
                "details": "User clicked Place Order button",
                "url": "https://shop.example.com/checkout",
                "element": "button[type='submit'][data-action='place-order']"
            }
        ]
    },
    "data_analysis_workflow": {
        "name": "Data Analysis Dashboard",
        "description": "Generate and download analytics report",
        "transcript": [
            {
                "timestamp": "00:00:00",
                "action": "Navigate to analytics",
                "details": "User navigated to analytics dashboard",
                "url": "https://analytics.company.com/dashboard",
                "element": ""
            },
            {
                "timestamp": "00:00:10",
                "action": "Select date range",
                "details": "User selected last 30 days from date picker",
                "url": "https://analytics.company.com/dashboard",
                "element": "input[name='date_range']"
            },
            {
                "timestamp": "00:00:18",
                "action": "Choose metrics",
                "details": "User selected revenue and conversion metrics",
                "url": "https://analytics.company.com/dashboard",
                "element": "div[data-component='metric-selector']"
            },
            {
                "timestamp": "00:00:25",
                "action": "Apply filters",
                "details": "User applied geographic filter for US region",
                "url": "https://analytics.company.com/dashboard",
                "element": "select[name='region']"
            },
            {
                "timestamp": "00:00:30",
                "action": "Generate report",
                "details": "User clicked Generate Report button",
                "url": "https://analytics.company.com/dashboard",
                "element": "button[data-action='generate-report']"
            },
            {
                "timestamp": "00:00:45",
                "action": "Wait for processing",
                "details": "System processing report, progress indicator shown",
                "url": "https://analytics.company.com/dashboard",
                "element": ""
            },
            {
                "timestamp": "00:01:20",
                "action": "Download report",
                "details": "User clicked Download PDF button",
                "url": "https://analytics.company.com/dashboard",
                "element": "button[data-action='download-pdf']"
            }
        ]
    }
}

def print_header(title: str, char: str = "="):
    """Print a formatted header"""
    print(f"\n{char * 80}")
    print(f"{title:^80}")
    print(f"{char * 80}")

def print_section(title: str):
    """Print a section header"""
    print(f"\n{'─' * 60}")
    print(f"🔹 {title}")
    print(f"{'─' * 60}")

def visualize_workflow_metadata(metadata: Dict[str, Any]):
    """Visualize workflow metadata"""
    print("📊 WORKFLOW METADATA:")
    print(f"   📋 Title: {metadata.get('title', 'N/A')}")
    print(f"   📈 Total Steps: {metadata.get('total_steps', 0)}")
    print(f"   ⏱️  Estimated Duration: {metadata.get('estimated_duration', 0)}s")
    print(f"   🤖 Automation Coverage: {metadata.get('automation_coverage', 0):.1%}")
    print(f"   🧠 Complexity Score: {metadata.get('complexity_score', 0):.2f}")
    print(f"   👤 Human Intervention: {'Yes' if metadata.get('requires_human_intervention', True) else 'No'}")

def visualize_enhanced_steps(steps: List[Dict[str, Any]]):
    """Visualize enhanced SOP steps"""
    print("\n📋 ENHANCED SOP STEPS:")
    
    if not steps:
        print("   ⚠️  No steps found")
        return
    
    for i, step in enumerate(steps, 1):
        automation = step.get('automation', {})
        feasibility = automation.get('feasibility', 'unknown')
        confidence = automation.get('confidence_level', 0)
        action_type = automation.get('action_type', 'unknown')
        
        # Color coding based on feasibility
        feasibility_emoji = {
            'high': '🟢',
            'medium': '🟡', 
            'low': '🟠',
            'manual': '🔴'
        }.get(feasibility, '⚪')
        
        print(f"   {i:2d}. {feasibility_emoji} {step.get('step_id', f'step_{i}')}")
        print(f"       Action: {step.get('original_step', {}).get('action', 'N/A')}")
        print(f"       Type: {action_type} | Feasibility: {feasibility} | Confidence: {confidence:.2f}")
        
        # Show browser actions
        browser_actions = step.get('browser_actions', [])
        if browser_actions:
            print(f"       Browser Actions: {len(browser_actions)} action(s)")
            for action in browser_actions[:2]:  # Show first 2 actions
                print(f"         • {action.get('action', 'N/A')}: {action.get('description', 'N/A')}")

def visualize_execution_plan(plan: Dict[str, Any]):
    """Visualize execution plan"""
    exec_plan = plan.get('execution_plan', {})
    step_instructions = plan.get('step_instructions', [])
    uncertainty_mgmt = plan.get('uncertainty_management', {})
    
    print("🎯 EXECUTION PLAN:")
    print(f"   🆔 Workflow ID: {exec_plan.get('workflow_id', 'N/A')}")
    print(f"   📊 Total Steps: {exec_plan.get('total_steps', 0)}")
    print(f"   ⏱️  Estimated Duration: {exec_plan.get('estimated_duration', 0)}s")
    print(f"   🎯 Strategy: {exec_plan.get('execution_strategy', 'N/A')}")
    print(f"   🎚️  Confidence Threshold: {exec_plan.get('confidence_threshold', 0):.2f}")
    print(f"   👤 Human Oversight: {'Yes' if exec_plan.get('human_oversight_required', True) else 'No'}")
    
    print(f"\n🔍 UNCERTAINTY MANAGEMENT:")
    print(f"   📈 Overall Confidence: {uncertainty_mgmt.get('overall_confidence', 0):.2f}")
    print(f"   ⚠️  Risk Factors: {len(uncertainty_mgmt.get('risk_factors', []))}")
    for risk in uncertainty_mgmt.get('risk_factors', [])[:3]:
        print(f"      • {risk}")
    
    print(f"\n📋 STEP INSTRUCTIONS: {len(step_instructions)} step(s)")
    for i, instruction in enumerate(step_instructions[:3], 1):
        step_id = instruction.get('step_id', f'step_{i}')
        task = instruction.get('agent_instructions', {}).get('task', 'N/A')
        print(f"   {i}. {step_id}: {task[:60]}{'...' if len(task) > 60 else ''}")

def visualize_execution_results(results: Dict[str, Any]):
    """Visualize execution results"""
    workflow_id = results.get('workflow_id', 'N/A')
    status = results.get('status', 'unknown')
    step_results = results.get('results', [])
    summary = results.get('summary', {})
    
    print("🚀 EXECUTION RESULTS:")
    print(f"   🆔 Workflow ID: {workflow_id}")
    print(f"   📊 Status: {status.upper()}")
    print(f"   📈 Steps Executed: {len(step_results)}")
    
    print(f"\n📊 EXECUTION SUMMARY:")
    print(f"   ✅ Successful Steps: {summary.get('successful_steps', 0)}")
    print(f"   ❌ Failed Steps: {summary.get('failed_steps', 0)}")
    print(f"   ❓ Uncertain Steps: {summary.get('uncertain_steps', 0)}")
    print(f"   📈 Success Rate: {summary.get('success_rate', 0):.1%}")
    print(f"   🎯 Average Confidence: {summary.get('average_confidence', 0):.2f}")
    print(f"   ⏱️  Total Execution Time: {summary.get('total_execution_time', 0):.2f}s")
    print(f"   👤 Human Intervention Required: {'Yes' if summary.get('human_intervention_required', False) else 'No'}")
    
    # Show individual step results
    if step_results:
        print(f"\n📋 STEP RESULTS:")
        for i, result in enumerate(step_results, 1):
            status_emoji = {
                'success': '✅',
                'failed': '❌',
                'uncertain': '❓',
                'requires_human': '👤'
            }.get(result.get('status', 'unknown'), '⚪')
            
            print(f"   {i}. {status_emoji} {result.get('step_id', f'step_{i}')}")
            print(f"      Status: {result.get('status', 'unknown')} | Confidence: {result.get('confidence_level', 0):.2f}")
            print(f"      Execution Time: {result.get('execution_time', 0):.2f}s")

def test_workflow_with_visualization(workflow_name: str, workflow_data: Dict[str, Any]):
    """Test a complete workflow with full visualization"""
    print_header(f"🧪 TESTING WORKFLOW: {workflow_data['name']}")
    print(f"📝 Description: {workflow_data['description']}")
    print(f"📊 Input Steps: {len(workflow_data['transcript'])}")
    
    # Stage 1: Enhanced SOP Parsing
    print_section("Stage 1: Enhanced SOP Parsing")
    
    try:
        response = requests.post(
            f"{BASE_URL}/parse-sop",
            json=workflow_data['transcript'],
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        if response.status_code == 200:
            sop_result = response.json()
            print("✅ SOP Parsing: SUCCESS")
            
            enhanced_sop = sop_result.get('enhanced_sop', {})
            metadata = enhanced_sop.get('workflow_metadata', {})
            steps = enhanced_sop.get('enhanced_steps', [])
            
            visualize_workflow_metadata(metadata)
            visualize_enhanced_steps(steps)
            
        else:
            print(f"❌ SOP Parsing FAILED: {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ SOP Parsing ERROR: {str(e)}")
        return False
    
    # Stage 2: Execution Planning
    print_section("Stage 2: Execution Planning")
    
    try:
        response = requests.post(
            f"{BASE_URL}/create-execution-plan",
            json={"enhanced_sop": enhanced_sop},
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        if response.status_code == 200:
            plan_result = response.json()
            print("✅ Execution Planning: SUCCESS")
            
            execution_plan = plan_result.get('execution_plan', {})
            visualize_execution_plan(execution_plan)
            
        else:
            print(f"❌ Execution Planning FAILED: {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Execution Planning ERROR: {str(e)}")
        return False
    
    # Stage 3: Workflow Execution
    print_section("Stage 3: Workflow Execution")
    
    try:
        response = requests.post(
            f"{BASE_URL}/execute-workflow",
            json={"execution_plan": execution_plan},
            headers={"Content-Type": "application/json"},
            timeout=60
        )
        
        if response.status_code == 200:
            exec_result = response.json()
            print("✅ Workflow Execution: SUCCESS")
            
            execution_results = exec_result.get('execution_result', {})
            visualize_execution_results(execution_results)
            
            # Save detailed results
            filename = f"workflow_results_{workflow_name}.json"
            with open(filename, 'w') as f:
                json.dump({
                    'workflow_name': workflow_name,
                    'workflow_data': workflow_data,
                    'sop_result': sop_result,
                    'plan_result': plan_result,
                    'exec_result': exec_result
                }, f, indent=2)
            print(f"\n💾 Detailed results saved to: {filename}")
            
        else:
            print(f"❌ Workflow Execution FAILED: {response.status_code}")
            print(f"Error: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Workflow Execution ERROR: {str(e)}")
        return False
    
    print_section("✅ WORKFLOW TEST COMPLETED SUCCESSFULLY")
    return True

def main():
    """Main testing function"""
    print_header("🚀 AEF WORKFLOW TESTING & VISUALIZATION", "🌟")
    print("🔧 Two-Stage Pipeline: Enhanced SOP Parser → Agentic Orchestrator")
    
    # Check API health
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        if response.status_code == 200:
            health = response.json()
            print(f"✅ API Status: {health.get('status')}")
            print(f"🤖 AI Model: {health.get('ai_model')}")
        else:
            print(f"❌ API Health Check Failed: {response.status_code}")
            return
    except Exception as e:
        print(f"❌ Cannot connect to API: {str(e)}")
        print("💡 Start the server with: python3 AEF/api/main.py")
        return
    
    # Test each workflow
    successful_tests = 0
    total_tests = len(WORKFLOWS)
    
    for workflow_name, workflow_data in WORKFLOWS.items():
        success = test_workflow_with_visualization(workflow_name, workflow_data)
        if success:
            successful_tests += 1
        
        # Add a pause between workflows
        time.sleep(2)
    
    # Final summary
    print_header("📊 TESTING SUMMARY")
    print(f"✅ Successful Tests: {successful_tests}/{total_tests}")
    print(f"📈 Success Rate: {successful_tests/total_tests:.1%}")
    
    if successful_tests == total_tests:
        print("🎉 All workflows tested successfully!")
        print("💡 Check the generated JSON files for detailed results")
    else:
        print("⚠️  Some workflows had issues - check the logs above")
    
    print("\n📁 Generated Files:")
    for workflow_name in WORKFLOWS.keys():
        filename = f"workflow_results_{workflow_name}.json"
        if os.path.exists(filename):
            print(f"   📄 {filename}")

if __name__ == "__main__":
    main() 