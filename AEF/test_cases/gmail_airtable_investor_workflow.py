"""
Gmail → Airtable Investor Workflow Test Case

This test case is based on a recorded workflow for processing daily emails to identify 
investor communications and update an Airtable CRM. The intelligent agent should 
understand the business intent and create its own strategic plan rather than 
following the original recorded steps mechanically.

IMPORTANT: This is a test of INTELLIGENCE, not script execution.
The agent should analyze the objective and create its own optimal approach.
"""

import asyncio
import logging
import os
import sys
from typing import Dict, Any

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from langchain_google_genai import ChatGoogleGenerativeAI
from browser_use import BrowserSession

from agents.intelligent_browser_agent import IntelligentBrowserAgent

logger = logging.getLogger(__name__)


async def test_gmail_airtable_investor_workflow():
    """
    Test the intelligent browser agent on a Gmail → Airtable investor workflow.
    
    This test evaluates the agent's ability to:
    1. Understand complex business workflows
    2. Create strategic plans for systematic data processing  
    3. Adapt to real UI interfaces (not recorded selectors)
    4. Handle multi-application workflows intelligently
    5. Document survival information between steps
    """
    
    # Set up Gemini 2.5 Flash like in optimal_agent_config_v3.py
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-preview-05-20",
        temperature=1.0,  # Higher temperature for flexible, adaptive behavior
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        max_tokens=8192
    )
    
    # Test credentials from optimal_agent_config_v3.py
    sensitive_data = {
        'gmail_email': 'michaelburner595@gmail.com',
        'gmail_password': 'dCdWqhgPzJev6Jz'
    }
    
    # Security restrictions for allowed domains
    allowed_domains = [
        'https://*.google.com',
        'https://mail.google.com', 
        'https://*.airtable.com',
        'https://airtable.com'
    ]
    
    # Create intelligent browser agent with the workflow task
    agent = IntelligentBrowserAgent(
        task=get_workflow_task_description(),
        llm=llm,
        max_steps=500,  # 500 max steps like optimal config
        use_vision=True,
        max_failures=3,  # Allow some failures for learning
        sensitive_data=sensitive_data,
        allowed_domains=allowed_domains
    )
    
    logger.info("🚀 Starting Gmail → Airtable Investor Workflow Test")
    logger.info("🧠 Using Gemini 2.5 Flash (like optimal_agent_config_v3)")
    logger.info("📋 This tests strategic planning and adaptive execution")
    logger.info("📧 Test account: michaelburner595@gmail.com")
    
    try:
        # Run the workflow
        result = await agent.run()
        
        # Analyze results
        await analyze_workflow_results(agent)
        
        return result
        
    except Exception as e:
        logger.error(f"❌ Workflow test failed: {e}")
        
        # Log survival context even on failure
        agent.log_context_summary()
        raise


def get_workflow_task_description() -> str:
    """
    Get the intelligent workflow task description.
    
    This description emphasizes business intent and allows the agent to create
    its own strategic approach rather than following rigid recorded steps.
    """
    
    return """
**BUSINESS OBJECTIVE: Daily Investor Email Triage and CRM Update**

You are tasked with processing daily emails to identify investor communications and update the Airtable CRM system. This is a strategic workflow that requires intelligence, not mechanical execution.

**CREDENTIALS AVAILABLE:**
- Gmail login: Use <secret>gmail_email</secret> and <secret>gmail_password</secret> for authentication
- You have access to these credentials through the sensitive_data system - use them directly in login forms

**THE BUSINESS INTENT:**
- Review emails from today to find investor-related communications
- For investor emails: extract key information and update/create records in Airtable CRM
- For non-investor emails: handle appropriately (archive, mark read, etc.)
- Maintain accurate investor relationship tracking in the CRM

**ORIGINAL WORKFLOW CONTEXT (For Reference Only):**
The original recorded workflow followed this pattern:
1. Navigate to Gmail inbox
2. Loop through emails one by one
3. Extract email data and classify as investor/non-investor
4. For investor emails: switch to Airtable, find/create records, update details
5. Return to Gmail and continue processing

**YOUR STRATEGIC MISSION:**
DO NOT mechanically follow the original workflow. Instead:

1. **STRATEGIC PLANNING PHASE**: 
   - Analyze the business objective deeply
   - Create your own intelligent approach for systematic processing
   - Plan for completeness: ensure every relevant email gets processed
   - Consider the most efficient workflow between Gmail and Airtable

2. **INTELLIGENT EXECUTION**:
   - Use the provided credentials (<secret>gmail_email</secret> and <secret>gmail_password</secret>) for Gmail login
   - Adapt to real UI interfaces (Gmail and Airtable may look different than recorded)
   - Make smart decisions about email classification
   - Handle authentication flows intelligently
   - Create efficient patterns for data entry and record management

3. **SUCCESS CRITERIA**:
   - Systematic coverage: demonstrate you've reviewed today's emails comprehensively
   - Accurate classification: show intelligent decision-making about investor vs non-investor emails
   - CRM Updates: for any investor emails found, show you can navigate and update Airtable appropriately
   - Documentation: maintain clear survival notes about your approach and discoveries

**ENVIRONMENT EXPECTATIONS:**
- Gmail account should be accessible using <secret>gmail_email</secret> and <secret>gmail_password</secret>
- Airtable "Investor Relationship Management App" should be accessible
- You should work with whatever emails are actually present (not simulated data)

**INVESTOR EMAIL INDICATORS (For Classification Guidance):**
- Sender domains containing: 'vc', 'fund', 'capital', 'invest', 'partners'
- Subject/body keywords: 'pitch deck', 'diligence', 'fundraising', 'investment', 'round', 'IC'
- Communications from known VCs, angels, or institutional investors

**AIRTABLE CRM STRUCTURE (Expected Fields):**
- Investor Name
- Contact Person  
- Email
- Stage (dropdown: Contacted, Interested, Due Diligence, etc.)
- Last Interaction (date)
- Thread Summary / Notes (text)
- Follow-up Needed (checkbox)
- Next Step / Action (text)

**KEY PHILOSOPHY:**
This is a test of your intelligence and strategic thinking. Show that you can:
- Understand business intent beyond mechanical steps
- Create systematic approaches that ensure completeness
- Adapt to real interfaces intelligently
- Use available credentials effectively
- Document your learnings for survival between memory wipes
- Make business decisions about email classification and CRM updates

Remember: You are not executing a script. You are solving a business problem intelligently.
"""


async def analyze_workflow_results(agent: IntelligentBrowserAgent):
    """Analyze the results of the workflow execution"""
    
    logger.info("\n📊 WORKFLOW ANALYSIS")
    logger.info("=" * 50)
    
    # Get survived context
    context = await agent.get_survived_context()
    
    # Analyze strategic planning
    logger.info("🧠 STRATEGIC PLANNING QUALITY:")
    if "systematic" in context.workflow_progress.lower() or "plan" in context.workflow_progress.lower():
        logger.info("   ✅ Agent demonstrated strategic planning")
    else:
        logger.info("   ❌ Limited evidence of strategic planning")
    
    # Analyze completeness tracking
    logger.info("\n📋 COMPLETENESS TRACKING:")
    if any(word in context.workflow_progress.lower() for word in ["count", "total", "processed", "remaining"]):
        logger.info("   ✅ Agent tracked systematic coverage")
    else:
        logger.info("   ❌ No clear evidence of systematic tracking")
    
    # Analyze adaptation
    logger.info("\n🔄 ADAPTATION INTELLIGENCE:")
    if context.key_discoveries or context.successful_patterns:
        logger.info("   ✅ Agent documented learning and adaptation")
        logger.info(f"   💡 Key Discoveries: {context.key_discoveries[:100]}...")
    else:
        logger.info("   ❌ Limited evidence of adaptive learning")
    
    # Analyze survival documentation
    logger.info("\n📝 SURVIVAL DOCUMENTATION:")
    survival_score = 0
    if context.navigation_state: survival_score += 1
    if context.critical_information: survival_score += 1
    if context.data_collected: survival_score += 1
    if context.workflow_progress: survival_score += 1
    
    logger.info(f"   📊 Survival Documentation Score: {survival_score}/4")
    
    # Final assessment
    logger.info("\n🎯 OVERALL ASSESSMENT:")
    if survival_score >= 3 and context.action_history:
        logger.info("   🌟 EXCELLENT: Agent demonstrated intelligent workflow execution")
    elif survival_score >= 2:
        logger.info("   ✅ GOOD: Agent showed good strategic thinking")
    else:
        logger.info("   ⚠️ NEEDS IMPROVEMENT: Agent needs better survival documentation")
    
    # Log detailed context
    logger.info(f"\n📜 ACTION HISTORY ({len(context.action_history)} steps):")
    for i, action in enumerate(context.action_history[-5:], 1):  # Show last 5 actions
        logger.info(f"   {i}. {action}")
    
    logger.info(f"\n🗂️ WORKFLOW PROGRESS:")
    logger.info(f"   {context.workflow_progress}")


def get_test_environment_setup() -> Dict[str, Any]:
    """Get environment setup instructions for the test"""
    
    return {
        "required_accounts": [
            "Gmail account with recent emails",
            "Airtable account with 'Investor Relationship Management App' base"
        ],
        "browser_requirements": [
            "Allow popups and redirects",
            "Enable camera/microphone if requested",
            "Consider using a test/secondary account for safety"
        ],
        "expected_duration": "10-20 minutes",
        "complexity_level": "High - Multi-application workflow with business logic",
        "success_indicators": [
            "Agent creates strategic plan for systematic processing",
            "Demonstrates intelligent email classification",
            "Successfully navigates between Gmail and Airtable",
            "Maintains detailed survival documentation",
            "Shows adaptation to real UI interfaces"
        ]
    }


# Alternative simplified test for development
async def test_simplified_email_classification():
    """
    Simplified test focusing just on email classification intelligence.
    Use this for development/debugging before running the full workflow.
    """
    
    # Set up Gemini 2.5 Flash like in optimal_agent_config_v3.py
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-preview-05-20",
        temperature=1.0,
        google_api_key=os.getenv("GOOGLE_API_KEY"),
        max_tokens=8192
    )
    
    # Test credentials
    sensitive_data = {
        'gmail_email': 'michaelburner595@gmail.com',
        'gmail_password': 'dCdWqhgPzJev6Jz'
    }
    
    # Security restrictions for allowed domains
    allowed_domains = [
        'https://*.google.com',
        'https://mail.google.com', 
        'https://*.airtable.com',
        'https://airtable.com'
    ]
    
    simplified_task = """
**SIMPLIFIED OBJECTIVE: Intelligent Email Classification**

Navigate to Gmail and demonstrate intelligent email classification:

**CREDENTIALS AVAILABLE:**
- Gmail login: Use <secret>gmail_email</secret> and <secret>gmail_password</secret> for authentication

**TASKS:**
1. **STRATEGIC PLANNING**: Create a systematic approach to review today's emails
2. **CLASSIFICATION**: For each email, intelligently determine if it's investor-related
3. **DOCUMENTATION**: Maintain clear survival notes about your classification logic and findings

**SUCCESS CRITERIA**:
- Show strategic thinking about email review approach
- Demonstrate intelligent classification decisions with reasoning
- Document patterns and discoveries for survival between memory wipes

This is a test of intelligence, not mechanical execution. Create your own smart approach.
"""
    
    agent = IntelligentBrowserAgent(
        task=simplified_task,
        llm=llm,
        max_steps=50,  # Shorter for simplified test
        use_vision=True,
        sensitive_data=sensitive_data,
        allowed_domains=allowed_domains
    )
    
    logger.info("🧪 Running Simplified Email Classification Test")
    logger.info("🧠 Using Gemini 2.5 Flash")
    logger.info("📧 Test account: michaelburner595@gmail.com")
    
    try:
        result = await agent.run()
        agent.log_context_summary()
        return result
    except Exception as e:
        logger.error(f"Simplified test failed: {e}")
        agent.log_context_summary()
        raise


if __name__ == "__main__":
    # Set up logging
    logging.basicConfig(level=logging.INFO)
    
    # Print test information
    setup = get_test_environment_setup()
    print("🔬 Gmail → Airtable Investor Workflow Test")
    print("=" * 50)
    print(f"Expected Duration: {setup['expected_duration']}")
    print(f"Complexity: {setup['complexity_level']}")
    print("\nRequired Accounts:")
    for req in setup['required_accounts']:
        print(f"  - {req}")
    
    print("\nSuccess Indicators:")
    for indicator in setup['success_indicators']:
        print(f"  ✓ {indicator}")
    
    print("\n" + "=" * 50)
    
    # Ask user which test to run
    choice = input("\nWhich test would you like to run?\n1. Full workflow test\n2. Simplified classification test\nChoice (1/2): ")
    
    if choice == "2":
        asyncio.run(test_simplified_email_classification())
    else:
        asyncio.run(test_gmail_airtable_investor_workflow()) 