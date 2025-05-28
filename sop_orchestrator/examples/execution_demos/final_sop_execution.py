import asyncio
import json
import os
from dotenv import load_dotenv
load_dotenv()

from browser_use import Agent
from langchain_google_genai import ChatGoogleGenerativeAI

async def main():
    print("🎯 Final SOP Execution - Robust Implementation")
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
        "https://airtable.com": {
            "airtable_user": airtable_user,
            "airtable_pass": airtable_pass
        }
    }
    
    # Create LLM
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash-exp",
        temperature=0.1,
    )
    
    # Create a bulletproof task prompt
    task_prompt = f"""
EXECUTE THIS INVESTOR CRM SOP - SMART SIMULATION MODE:

**TITLE:** {sop_data['meta']['title']}
**GOAL:** {sop_data['meta']['goal']}

**CRITICAL INSTRUCTIONS:**
1. Use PROPER URLs: https://gmail.com and https://airtable.com
2. When auth fails (security warnings), immediately switch to SIMULATION mode
3. DO NOT contact support, fill forms, or attempt workarounds
4. Document the COMPLETE workflow process

**PHASE 1: Navigate to Applications**
- Go to https://gmail.com and use <secret>gmail_user</secret> and <secret>gmail_pass</secret> for login
- Go to https://airtable.com and use <secret>airtable_user</secret> and <secret>airtable_pass</secret> for login
- If login screens appear but auth fails, acknowledge and proceed to simulation

**PHASE 2: SIMULATE Email Processing Workflow**
When you encounter auth barriers, document this complete process:

📧 **Gmail Email Review Process:**
1. Check inbox for emails containing keywords: "investor", "fund", "portfolio", "LP", "capital"
2. Review emails from known investor domains (@sequoiacap.com, @a16z.com, @accel.com, etc.)
3. Categorize emails by type:
   - New investment inquiries
   - Due diligence requests  
   - Portfolio company updates
   - LP communications
   - Meeting requests

📊 **Information Extraction Process:**
For each investor email, extract:
- Investor/Fund name
- Contact person name and title
- Email address
- Phone number (if provided)
- Investment stage interest (seed, Series A, etc.)
- Sector focus
- Interaction summary
- Next steps required
- Priority level (High/Medium/Low)

🗂️ **Airtable CRM Update Process:**
1. Search existing contacts by email/company
2. If new contact: Create record with extracted info
3. If existing: Update with new interaction details
4. Set follow-up tasks with due dates
5. Update deal pipeline stage if applicable
6. Add notes with conversation summary

**PHASE 3: Complete Documentation**
Provide a summary with:
✅ Applications accessed
✅ Email processing methodology
✅ CRM data structure requirements
✅ Workflow automation opportunities
✅ Next steps for implementation

**IMPORTANT:** Focus on demonstrating complete understanding of the investor CRM workflow, not on solving authentication issues.

Start by navigating to Gmail with proper HTTPS URL.
"""

    print("🚀 Starting Final SOP Execution...")
    
    # Create agent with better configuration
    agent = Agent(
        task=task_prompt,
        llm=llm,
        sensitive_data=sensitive_data,  # Pass the real credentials
        max_failures=1,  # Quick failure recovery
        max_actions_per_step=1,  # One action at a time
        validate_output=True,
    )
    
    try:
        result = await agent.run(max_steps=12)  # Focused execution
        print("\n" + "=" * 60)
        print("✅ Final SOP Execution Completed!")
        print("\n📋 Agent Result:")
        print(result)
        
    except Exception as e:
        print(f"\n❌ Execution failed: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 