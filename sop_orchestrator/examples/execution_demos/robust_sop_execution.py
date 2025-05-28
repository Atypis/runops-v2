import asyncio
import json
import os
from dotenv import load_dotenv
load_dotenv()

from browser_use import Agent
from browser_use.browser.session import BrowserSession
from browser_use.browser.profile import BrowserProfile
from langchain_google_genai import ChatGoogleGenerativeAI

async def main():
    print("🚀 Robust SOP Execution - Real Workflow")
    print("=" * 60)
    
    # Load SOP
    with open('app_frontend/public/latest-sop-v0.8.json', 'r') as f:
        sop_data = json.load(f)
    
    # Setup credentials from .env file
    gmail_user = os.getenv("GMAIL_USER", "demo@example.com")
    gmail_pass = os.getenv("GMAIL_PASS", "demo_password")
    airtable_user = os.getenv("AIRTABLE_USER", "demo@example.com") 
    airtable_pass = os.getenv("AIRTABLE_PASS", "demo_password")
    
    print(f"🔑 Using credentials for: {gmail_user}")
    
    # Setup sensitive data for browser-use
    sensitive_data = {
        "https://accounts.google.com": {
            "gmail_user": gmail_user,
            "gmail_pass": gmail_pass
        },
        "https://gmail.com": {
            "gmail_user": gmail_user,
            "gmail_pass": gmail_pass
        },
        "https://mail.google.com": {
            "gmail_user": gmail_user,
            "gmail_pass": gmail_pass
        },
        "https://airtable.com": {
            "airtable_user": airtable_user,
            "airtable_pass": airtable_pass
        }
    }
    
    # Create browser session with better settings
    browser_profile = BrowserProfile(
        user_data_dir="~/.config/browseruse/profiles/investor_crm",
        headless=False,  # Use headed mode for better compatibility
        disable_dev_shm_usage=True,
        ignore_https_errors=False,
        bypass_csp=False,
        java_script_enabled=True,
    )
    
    browser_session = BrowserSession(browser_profile=browser_profile)
    
    # Create LLM
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash-exp",
        temperature=0.1,
    )
    
    # Create a detailed task prompt for real execution
    task_prompt = f"""
COMPLETE THE INVESTOR CRM SOP - REAL EXECUTION MODE:

**TITLE:** {sop_data['meta']['title']}
**GOAL:** {sop_data['meta']['goal']}

**AUTHENTICATION HANDLING:**
- Use proper wait times between actions (3-5 seconds)
- If password field isn't immediately visible, wait 5 seconds and try again
- Look for password input fields by type="password" or aria-label containing "password"
- Google Sign-in uses "Sign in with Google" buttons for Airtable

**PHASE 1: Gmail Authentication & Email Processing**
1. Navigate to https://gmail.com
2. Complete sign-in using <secret>gmail_user</secret> and <secret>gmail_pass</secret>
3. Wait for inbox to load completely
4. Search for investor-related emails using keywords: "investor", "fund", "venture", "capital", "partnership"
5. Review recent emails (last 7 days) and identify:
   - Investment inquiries
   - Due diligence requests
   - Portfolio updates
   - Meeting requests
6. For each relevant email, extract:
   - Sender name and email
   - Company/fund name
   - Subject line
   - Key points from email content
   - Required follow-up actions

**PHASE 2: Airtable CRM Updates**
1. Open new tab to https://airtable.com
2. Sign in using Google SSO with same credentials
3. Navigate to investor/contacts database
4. For each email identified in Phase 1:
   - Search if contact already exists
   - If new: Create contact record with extracted info
   - If existing: Add new interaction note
   - Update last contact date
   - Set follow-up tasks if needed

**PHASE 3: Documentation & Summary**
1. Create summary of:
   - Number of emails processed
   - New contacts added
   - Existing contacts updated
   - Follow-up actions created
2. Identify any emails that need immediate attention
3. Note any patterns in investor communications

**CRITICAL INSTRUCTIONS:**
- Take 3-5 second pauses between major actions
- If any step fails due to page loading, wait and retry once
- Focus on completing the actual workflow, not just demonstrating it
- Be persistent with authentication - try alternative selectors if first attempt fails
- Use the browser's visual interface - you are in headed mode

Start by navigating to Gmail and completing full authentication.
"""

    print("🎯 Starting Real Workflow Execution...")
    
    # Create agent with robust configuration
    agent = Agent(
        task=task_prompt,
        llm=llm,
        browser_session=browser_session,
        sensitive_data=sensitive_data,
        max_failures=3,  # Allow more retries
        max_actions_per_step=2,  # Allow multiple actions
        validate_output=True,
    )
    
    try:
        result = await agent.run(max_steps=500)  # Proper execution for real workflow with many emails
        print("\n" + "=" * 60)
        print("✅ Real Workflow Execution Completed!")
        print("\n📋 Final Result:")
        print(result)
        
    except Exception as e:
        print(f"\n❌ Execution failed: {e}")
    
    finally:
        # Keep browser open for inspection
        print("\n🔍 Browser left open for inspection...")
        print("Press Ctrl+C to close when done.")
        try:
            await asyncio.sleep(300)  # Wait 5 minutes
        except KeyboardInterrupt:
            await browser_session.stop()

if __name__ == "__main__":
    asyncio.run(main()) 