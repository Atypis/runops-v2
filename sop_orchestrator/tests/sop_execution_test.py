import asyncio
import json
import os
from dotenv import load_dotenv
load_dotenv()

from browser_use import Agent
from langchain_google_genai import ChatGoogleGenerativeAI
from browser_use.agent.memory import MemoryConfig

async def main():
    try:
        # Load the SOP JSON
        with open('app_frontend/public/latest-sop-v0.8.json', 'r') as f:
            sop_data = json.load(f)
        
        print("✅ SOP loaded successfully!")
        print(f"📋 SOP Title: {sop_data['meta']['title']}")
        print(f"🎯 Goal: {sop_data['meta']['goal']}")
        
        # Check for Google API key
        if not os.getenv("GOOGLE_API_KEY"):
            print("⚠️  Please add your GOOGLE_API_KEY to the .env file")
            return
            
        # Create the agent with Google's Gemini model
        llm = ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            temperature=0.1,
        )
        
        # Configure memory for complex workflow tracking
        memory_config = MemoryConfig(
            agent_id="investor_crm_sop_agent",
            memory_interval=5,  # Compress memory every 5 steps
            llm_instance=llm
        )
        
        # Create comprehensive task description from SOP
        sop_task = f"""
EXECUTE THE FOLLOWING STANDARD OPERATING PROCEDURE (SOP):

**TITLE:** {sop_data['meta']['title']}
**GOAL:** {sop_data['meta']['goal']}
**PURPOSE:** {sop_data['meta']['purpose']}

**WORKFLOW STEPS TO EXECUTE:**

1. **Setup Applications**: Open Gmail and Airtable in separate browser tabs

2. **Process Daily Emails** (LOOP until all emails processed):
   a. Open the next unread email in Gmail
   b. Determine if this email is investor-related (look for VC firms, investment discussions, fundraising topics)
   c. If YES (investor-related):
      - Switch to Airtable tab
      - Search for the investor/fund in the CRM
      - If found: Update the existing record with new interaction details
      - If not found: Create a new investor record
      - Close any modals and switch back to Gmail
   d. If NO (not investor-related): Skip to next email
   e. Continue until all recent emails are processed

**IMPORTANT VARIABLES TO TRACK:**
- investor_name: Name of the investment fund or entity
- contact_person: Name of the primary contact person  
- contact_email: Email address of the contact
- stage: Current relationship stage (Contacted, Interested, etc.)
- last_interaction_date: Date of most recent interaction
- thread_summary_notes: Summary of the email thread
- follow_up_needed: Whether follow-up is required
- next_step_action: Description of next required action

**SUCCESS CRITERIA:**
- All recent emails have been reviewed
- Investor-related emails have been logged in Airtable CRM
- Each investor record contains updated interaction information
- Workflow completes with summary of actions taken

**NOTE:** This is a demonstration/simulation. If you cannot access real Gmail/Airtable accounts, please simulate the workflow by:
1. Going to example websites that represent email/CRM interfaces
2. Demonstrating the decision-making process
3. Showing how you would extract and organize the required information
4. Explaining each step as you would perform it

Start by navigating to Gmail (gmail.com) or a demo email interface.
"""
        
        agent = Agent(
            task=sop_task,
            llm=llm,
            enable_memory=True,
            memory_config=memory_config,
            max_failures=5,  # Allow more retries for complex workflow
            max_actions_per_step=3,  # Allow multiple actions per step
        )
        
        print("✅ Agent created successfully!")
        print("🚀 Starting SOP execution...")
        print("📝 The agent will attempt to execute the investor CRM workflow...")
        print("\n" + "="*60 + "\n")
        
        # Run the agent!
        await agent.run(max_steps=25)  # Allow more steps for complex workflow
        
        print("\n" + "="*60)
        print("✅ SOP execution completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main()) 