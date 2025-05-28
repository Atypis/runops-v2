"""
Test script for the enhanced two-stage pipeline:
1. Enhanced SOP Parser with automation annotations
2. Agentic Orchestrator with browser-use integration
"""

import asyncio
import json
import logging
import os
import sys
from dotenv import load_dotenv
import google.generativeai as genai

# Add the project root to the path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from AEF.core.enhanced_sop_parser import EnhancedSOPParser
from AEF.core.agentic_orchestrator import AgenticOrchestrator

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configure Gemini
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# Sample transcript data for testing
SAMPLE_TRANSCRIPT = [
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
    },
    {
        "timestamp": "00:00:40",
        "action": "Navigate to reports section",
        "details": "User clicked on Reports menu item",
        "url": "https://portal.company.com/dashboard",
        "element": "a[href='/reports']"
    },
    {
        "timestamp": "00:00:45",
        "action": "Select report type",
        "details": "User selected 'Monthly Sales Report' from dropdown",
        "url": "https://portal.company.com/reports",
        "element": "select[name='report_type']"
    },
    {
        "timestamp": "00:00:50",
        "action": "Set date range",
        "details": "User set date range for last month",
        "url": "https://portal.company.com/reports",
        "element": "input[name='date_from'], input[name='date_to']"
    },
    {
        "timestamp": "00:00:58",
        "action": "Generate report",
        "details": "User clicked Generate Report button",
        "url": "https://portal.company.com/reports",
        "element": "button[id='generate-report']"
    },
    {
        "timestamp": "00:01:05",
        "action": "Wait for report generation",
        "details": "System generating report, progress indicator shown",
        "url": "https://portal.company.com/reports",
        "element": ""
    },
    {
        "timestamp": "00:01:20",
        "action": "Download report",
        "details": "User clicked Download PDF button when report was ready",
        "url": "https://portal.company.com/reports",
        "element": "button[id='download-pdf']"
    }
]

async def test_enhanced_sop_parser():
    """Test the Enhanced SOP Parser"""
    logger.info("🧪 Testing Enhanced SOP Parser...")
    
    # Initialize Gemini model
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash-preview-05-20",
        generation_config={
            "temperature": 1.0,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 4000,
        },
        safety_settings={
            genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
            genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH: genai.types.HarmBlockThreshold.BLOCK_NONE,
            genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: genai.types.HarmBlockThreshold.BLOCK_NONE,
            genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
        }
    )
    
    # Initialize parser
    parser = EnhancedSOPParser(model)
    
    try:
        # Parse the sample transcript
        enhanced_sop = await parser.parse_transcript_with_automation(SAMPLE_TRANSCRIPT)
        
        logger.info("✅ Enhanced SOP Parser completed successfully")
        logger.info(f"📊 Workflow metadata: {enhanced_sop.get('workflow_metadata', {})}")
        logger.info(f"📋 Enhanced steps: {len(enhanced_sop.get('enhanced_steps', []))}")
        logger.info(f"🤖 Automation summary: {enhanced_sop.get('automation_summary', {})}")
        
        # Save results for inspection
        with open('enhanced_sop_result.json', 'w') as f:
            json.dump(enhanced_sop, f, indent=2)
        logger.info("💾 Enhanced SOP saved to enhanced_sop_result.json")
        
        return enhanced_sop
        
    except Exception as e:
        logger.error(f"❌ Enhanced SOP Parser failed: {str(e)}")
        return None

async def test_agentic_orchestrator(enhanced_sop):
    """Test the Agentic Orchestrator"""
    logger.info("🎯 Testing Agentic Orchestrator...")
    
    if not enhanced_sop:
        logger.error("❌ No enhanced SOP provided")
        return None
    
    # Initialize Gemini model
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash-preview-05-20",
        generation_config={
            "temperature": 0.3,  # Lower temperature for orchestration
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 4000,
        },
        safety_settings={
            genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
            genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH: genai.types.HarmBlockThreshold.BLOCK_NONE,
            genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: genai.types.HarmBlockThreshold.BLOCK_NONE,
            genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
        }
    )
    
    # Initialize orchestrator
    orchestrator = AgenticOrchestrator(model)
    
    try:
        # Create execution plan
        execution_plan = await orchestrator.create_execution_plan(enhanced_sop)
        
        logger.info("✅ Execution plan created successfully")
        logger.info(f"🎯 Workflow ID: {execution_plan.get('execution_plan', {}).get('workflow_id')}")
        logger.info(f"📋 Step instructions: {len(execution_plan.get('step_instructions', []))}")
        logger.info(f"🔍 Uncertainty management: {execution_plan.get('uncertainty_management', {})}")
        
        # Save execution plan
        with open('execution_plan_result.json', 'w') as f:
            json.dump(execution_plan, f, indent=2)
        logger.info("💾 Execution plan saved to execution_plan_result.json")
        
        return execution_plan
        
    except Exception as e:
        logger.error(f"❌ Agentic Orchestrator failed: {str(e)}")
        return None

async def test_workflow_execution(execution_plan):
    """Test workflow execution simulation"""
    logger.info("🚀 Testing Workflow Execution...")
    
    if not execution_plan:
        logger.error("❌ No execution plan provided")
        return None
    
    # Initialize Gemini model
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash-preview-05-20",
        generation_config={
            "temperature": 0.3,
            "top_p": 0.95,
            "top_k": 40,
            "max_output_tokens": 4000,
        },
        safety_settings={
            genai.types.HarmCategory.HARM_CATEGORY_HARASSMENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
            genai.types.HarmCategory.HARM_CATEGORY_HATE_SPEECH: genai.types.HarmBlockThreshold.BLOCK_NONE,
            genai.types.HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT: genai.types.HarmBlockThreshold.BLOCK_NONE,
            genai.types.HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT: genai.types.HarmBlockThreshold.BLOCK_NONE,
        }
    )
    
    # Initialize orchestrator
    orchestrator = AgenticOrchestrator(model)
    
    try:
        # Execute workflow (simulation)
        execution_result = await orchestrator.execute_workflow(execution_plan)
        
        logger.info("✅ Workflow execution completed")
        logger.info(f"📊 Execution status: {execution_result.get('status')}")
        logger.info(f"📋 Results: {len(execution_result.get('results', []))}")
        logger.info(f"📈 Summary: {execution_result.get('summary', {})}")
        
        # Save execution results
        with open('execution_result.json', 'w') as f:
            json.dump(execution_result, f, indent=2)
        logger.info("💾 Execution results saved to execution_result.json")
        
        return execution_result
        
    except Exception as e:
        logger.error(f"❌ Workflow execution failed: {str(e)}")
        return None

async def test_full_pipeline():
    """Test the complete two-stage pipeline"""
    logger.info("🔄 Testing Full Two-Stage Pipeline...")
    logger.info("=" * 60)
    
    # Stage 1: Enhanced SOP Parsing
    logger.info("🔍 Stage 1: Enhanced SOP Parsing with Automation Annotations")
    enhanced_sop = await test_enhanced_sop_parser()
    
    if not enhanced_sop:
        logger.error("❌ Pipeline failed at Stage 1")
        return
    
    logger.info("=" * 60)
    
    # Stage 2: Agentic Orchestration
    logger.info("🎯 Stage 2: Agentic Orchestration with Browser-Use Integration")
    execution_plan = await test_agentic_orchestrator(enhanced_sop)
    
    if not execution_plan:
        logger.error("❌ Pipeline failed at Stage 2")
        return
    
    logger.info("=" * 60)
    
    # Stage 3: Workflow Execution (Simulation)
    logger.info("🚀 Stage 3: Workflow Execution Simulation")
    execution_result = await test_workflow_execution(execution_plan)
    
    if not execution_result:
        logger.error("❌ Pipeline failed at Stage 3")
        return
    
    logger.info("=" * 60)
    
    # Pipeline Summary
    logger.info("📊 PIPELINE SUMMARY")
    logger.info("=" * 60)
    
    workflow_metadata = enhanced_sop.get('workflow_metadata', {})
    execution_summary = execution_result.get('summary', {})
    
    logger.info(f"✅ Pipeline Status: COMPLETED")
    logger.info(f"📋 Total Steps Parsed: {workflow_metadata.get('total_steps', 0)}")
    logger.info(f"🤖 Automation Coverage: {workflow_metadata.get('automation_coverage', 0):.2%}")
    logger.info(f"⏱️  Estimated Duration: {workflow_metadata.get('estimated_duration', 0)}s")
    logger.info(f"🎯 Steps Executed: {execution_summary.get('total_steps', 0)}")
    logger.info(f"📈 Success Rate: {execution_summary.get('success_rate', 0):.2%}")
    logger.info(f"⏱️  Actual Execution Time: {execution_summary.get('total_execution_time', 0):.2f}s")
    logger.info(f"👤 Human Intervention Required: {execution_summary.get('human_intervention_required', False)}")
    
    # Create comprehensive summary
    pipeline_summary = {
        "pipeline_status": "completed",
        "stages": {
            "sop_parsing": {
                "status": "success",
                "total_steps": workflow_metadata.get('total_steps', 0),
                "automation_coverage": workflow_metadata.get('automation_coverage', 0),
                "complexity_score": workflow_metadata.get('complexity_score', 0)
            },
            "execution_planning": {
                "status": "success",
                "workflow_id": execution_plan.get('execution_plan', {}).get('workflow_id'),
                "step_instructions": len(execution_plan.get('step_instructions', [])),
                "confidence_threshold": execution_plan.get('execution_plan', {}).get('confidence_threshold', 0)
            },
            "workflow_execution": {
                "status": "success",
                "success_rate": execution_summary.get('success_rate', 0),
                "execution_time": execution_summary.get('total_execution_time', 0),
                "human_intervention_required": execution_summary.get('human_intervention_required', False)
            }
        },
        "overall_metrics": {
            "automation_feasibility": workflow_metadata.get('automation_coverage', 0),
            "execution_confidence": execution_summary.get('average_confidence', 0),
            "time_efficiency": {
                "estimated": workflow_metadata.get('estimated_duration', 0),
                "actual": execution_summary.get('total_execution_time', 0)
            }
        }
    }
    
    # Save pipeline summary
    with open('pipeline_summary.json', 'w') as f:
        json.dump(pipeline_summary, f, indent=2)
    logger.info("💾 Pipeline summary saved to pipeline_summary.json")
    
    logger.info("🎉 Two-Stage Pipeline Test Completed Successfully!")

async def main():
    """Main test function"""
    logger.info("🚀 Starting Enhanced AEF Pipeline Tests")
    logger.info("🔧 Architecture: Enhanced SOP Parser → Agentic Orchestrator → Browser-Use Integration")
    
    # Check environment
    if not os.getenv("GOOGLE_API_KEY"):
        logger.error("❌ GOOGLE_API_KEY not found in environment")
        return
    
    try:
        await test_full_pipeline()
    except Exception as e:
        logger.error(f"❌ Test failed with error: {str(e)}")
        import traceback
        logger.error(f"❌ Traceback: {traceback.format_exc()}")

if __name__ == "__main__":
    asyncio.run(main()) 