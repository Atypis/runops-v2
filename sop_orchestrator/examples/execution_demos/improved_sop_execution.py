import asyncio
import json
import os
from dotenv import load_dotenv
load_dotenv()

from browser_use import Agent
from langchain_google_genai import ChatGoogleGenerativeAI

async def main():
    print("🎯 Improved SOP Execution - Smart Auth Handling")
    print("=" * 60)
    
    # Load SOP
    with open('app_frontend/public/latest-sop-v0.8.json', 'r') as f:
        sop_data = json.load(f)
    
    # Create LLM
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.0-flash-exp",
        temperature=0.1,
    )
    
    # Create a more robust task prompt
    task_prompt = f"""
EXECUTE THIS INVESTOR CRM SOP WITH SMART AUTHENTICATION HANDLING:

**TITLE:** {sop_data['meta']['title']}
**GOAL:** {sop_data['meta']['goal']}

**IMPORTANT INSTRUCTIONS:**
1. When you encounter authentication challenges (security warnings, verification pages), DO NOT contact support
2. Instead, SIMULATE the workflow and document what you would do
3. Focus on demonstrating understanding of the complete process
4. Provide detailed step-by-step documentation

**WORKFLOW TO DEMONSTRATE:**

**Phase 1: Application Access**
- Navigate to Gmail (gmail.com)
- If login fails due to security restrictions, SIMULATE the process
- Navigate to Airtable (airtable.com) 
- If login fails due to security restrictions, SIMULATE the process

**Phase 2: Email Processing Simulation** 
Document how you would:
a) Identify investor-related emails in Gmail
b) Extract key information: investor/fund name, contact person, email, interaction summary
c) Categorize emails by: New leads, Follow-ups, Due diligence requests, Portfolio updates

**Phase 3: CRM Update Simulation**
Document how you would:
a) Navigate to the investor CRM in Airtable
b) Create new contact records for new investors
c) Update existing contact records with new interactions
d) Set follow-up tasks and reminders

**SUCCESS CRITERIA:**
✅ Navigate to both applications (Gmail & Airtable)
✅ Document complete email processing workflow
✅ Demonstrate CRM data structure understanding
✅ Provide actionable next steps
✅ DO NOT contact support for login issues

**AUTHENTICATION FAILURES:**
- If you see "browser not secure" or "verify it's you" pages, acknowledge the limitation
- Switch to simulation mode immediately 
- Do not attempt to contact support or fill out help forms
- Focus on demonstrating workflow knowledge instead

Start by navigating to Gmail, then move to workflow simulation if auth fails.
"""

    print("🚀 Starting Improved SOP Execution...")
    
    # Create agent with clearer instructions
    agent = Agent(
        task=task_prompt,
        llm=llm,
        max_failures=2,  # Less tolerance for failures
        max_actions_per_step=1,  # One action at a time for better control
        validate_output=True,
    )
    
    try:
        result = await agent.run(max_steps=15)  # Shorter execution
        print("\n" + "=" * 60)
        print("✅ Improved SOP Execution Completed!")
        print("\n📋 Agent Result:")
        print(result)
        
    except Exception as e:
        print(f"\n❌ Execution failed: {e}")

if __name__ == "__main__":
    asyncio.run(main()) 