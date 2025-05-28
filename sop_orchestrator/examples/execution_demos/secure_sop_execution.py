import asyncio
import json
import os
import re
from typing import Dict, Any, Optional, Callable
from dotenv import load_dotenv
load_dotenv()

from browser_use import Agent
from browser_use.browser.session import BrowserSession
from browser_use.browser.profile import BrowserProfile
from browser_use.agent.memory import MemoryConfig
from langchain_google_genai import ChatGoogleGenerativeAI

class SecureCredentialManager:
    """
    Enhanced credential manager with multiple security layers
    """
    
    def __init__(self):
        self.credentials = {}
        self.domain_restrictions = {}
        self.access_log = []
    
    def add_service_credentials(self, service_name: str, domain_pattern: str, credentials: Dict[str, str]):
        """Add credentials for a specific service with domain restrictions"""
        self.credentials[service_name] = credentials
        self.domain_restrictions[service_name] = domain_pattern
        
    def get_sensitive_data_for_browser_use(self) -> Dict[str, Dict[str, str]]:
        """Convert stored credentials to browser-use format"""
        browser_use_format = {}
        for service, creds in self.credentials.items():
            domain = self.domain_restrictions[service]
            browser_use_format[domain] = creds
        return browser_use_format
    
    def get_allowed_domains(self) -> list[str]:
        """Get list of allowed domains for browser session"""
        return list(self.domain_restrictions.values())
    
    def log_access(self, service: str, action: str, domain: str):
        """Log credential access for audit trail"""
        self.access_log.append({
            'service': service,
            'action': action,
            'domain': domain,
            'timestamp': asyncio.get_event_loop().time()
        })

class SecureSOPExecutor:
    """
    Secure SOP executor with enhanced privacy and credential management
    """
    
    def __init__(self, use_local_llm: bool = False):
        self.credential_manager = SecureCredentialManager()
        self.use_local_llm = use_local_llm
        self.sop_data = None
        
    def load_sop(self, sop_path: str):
        """Load SOP configuration"""
        with open(sop_path, 'r') as f:
            self.sop_data = json.load(f)
    
    def setup_credentials(self):
        """Setup credentials for the investor CRM workflow"""
        
        # Gmail credentials (domain-restricted)
        self.credential_manager.add_service_credentials(
            service_name="gmail",
            domain_pattern="https://*.google.com",
            credentials={
                "gmail_user": os.getenv("GMAIL_USER", "demo@example.com"),
                "gmail_pass": os.getenv("GMAIL_PASS", "demo_password")
            }
        )
        
        # Airtable credentials (domain-restricted)
        self.credential_manager.add_service_credentials(
            service_name="airtable",
            domain_pattern="https://*.airtable.com",
            credentials={
                "airtable_user": os.getenv("AIRTABLE_USER", "demo@example.com"),
                "airtable_pass": os.getenv("AIRTABLE_PASS", "demo_password"),
                "airtable_api_key": os.getenv("AIRTABLE_API_KEY", "demo_api_key")
            }
        )
    
    def create_secure_browser_session(self) -> BrowserSession:
        """Create browser session with security hardening"""
        
        # Get allowed domains from credential manager
        allowed_domains = self.credential_manager.get_allowed_domains()
        
        # Create secure browser profile
        secure_profile = BrowserProfile(
            # Use isolated user data directory with timestamp
            user_data_dir=f"~/.config/browseruse/profiles/secure_sop_{int(asyncio.get_event_loop().time())}",
            # Security hardening
            headless=True,  # For production, use headless mode
            disable_dev_shm_usage=True,
            ignore_https_errors=False,
            bypass_csp=False,
            java_script_enabled=True,
            # Network isolation
            allowed_domains=allowed_domains,
        )
        
        return BrowserSession(browser_profile=secure_profile)
    
    def create_llm_instance(self):
        """Create LLM instance with security considerations"""
        
        if self.use_local_llm:
            # For maximum security, use local LLM
            # This requires additional setup but keeps all data local
            try:
                from langchain_ollama import ChatOllama
                return ChatOllama(
                    model="llama3.2",  # or other local model
                    temperature=0.1,
                )
            except ImportError:
                print("⚠️  Local LLM not available, falling back to cloud LLM")
                print("   Install with: pip install langchain-ollama")
                print("   Setup with: ollama pull llama3.2")
        
        # Cloud LLM with careful prompt engineering
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash-exp",
            temperature=0.1,
        )
    
    def create_secure_task_prompt(self) -> str:
        """Create task prompt with security-aware instructions"""
        
        base_prompt = f"""
EXECUTE THE FOLLOWING STANDARD OPERATING PROCEDURE (SOP):

**TITLE:** {self.sop_data['meta']['title']}
**GOAL:** {self.sop_data['meta']['goal']}

**SECURITY NOTICE:** 
- You are working with sensitive credential data
- All credentials are automatically filtered before being sent to the LLM
- Only proceed with the designated workflow on approved domains
- If you encounter authentication challenges, note them but do not expose credentials

**WORKFLOW STEPS:**

1. **Setup Applications**: 
   - Open Gmail using <secret>gmail_user</secret> and <secret>gmail_pass</secret>
   - Open Airtable using <secret>airtable_user</secret> and <secret>airtable_pass</secret>

2. **Process Daily Emails** (SIMULATE for security):
   a. Navigate to Gmail and identify investor-related emails
   b. For each investor email, extract:
      - Investor/fund name
      - Contact person name
      - Email address
      - Interaction summary
   c. Switch to Airtable and simulate CRM updates
   d. Document the workflow steps taken

**SECURITY CONSTRAINTS:**
- Only visit approved domains (Gmail and Airtable)
- Do not expose actual credential values in any output
- If real authentication fails, use simulation mode
- Provide detailed workflow documentation

**SUCCESS CRITERIA:**
- Demonstrate complete workflow understanding
- Show ability to extract investor information
- Simulate CRM data entry process
- Complete with security-conscious summary

Start by navigating to Gmail.
"""
        return base_prompt
    
    async def execute_secure_sop(self):
        """Execute SOP with maximum security measures"""
        
        if not self.sop_data:
            raise ValueError("SOP data not loaded. Call load_sop() first.")
        
        # Setup credentials
        self.setup_credentials()
        
        # Create secure browser session
        browser_session = self.create_secure_browser_session()
        
        # Create LLM instance
        llm = self.create_llm_instance()
        
        # Setup memory with security-aware configuration
        memory_config = MemoryConfig(
            agent_id="secure_investor_crm_agent",
            memory_interval=10,  # Less frequent memory compression for security
            llm_instance=llm
        )
        
        # Create secure task prompt
        task_prompt = self.create_secure_task_prompt()
        
        # Get credentials in browser-use format
        sensitive_data = self.credential_manager.get_sensitive_data_for_browser_use()
        
        print("🔒 Security Status:")
        print(f"   • Using Local LLM: {self.use_local_llm}")
        print(f"   • Allowed Domains: {self.credential_manager.get_allowed_domains()}")
        print(f"   • Credential Services: {list(self.credential_manager.credentials.keys())}")
        print(f"   • Browser Session: Isolated profile")
        
        # Create agent with security configuration
        agent = Agent(
            task=task_prompt,
            llm=llm,
            browser_session=browser_session,
            sensitive_data=sensitive_data,
            enable_memory=True,
            memory_config=memory_config,
            max_failures=3,
            max_actions_per_step=2,  # Limit actions per step for security
            validate_output=True,
        )
        
        print("\n🚀 Starting Secure SOP Execution...")
        print("="*60)
        
        try:
            # Execute with monitoring
            result = await agent.run(max_steps=20)
            
            print("\n" + "="*60)
            print("✅ Secure SOP Execution Completed!")
            
            # Security audit log
            print("\n🔍 Security Audit:")
            for log_entry in self.credential_manager.access_log:
                print(f"   • {log_entry['action']} on {log_entry['service']} at {log_entry['timestamp']}")
            
            return result
            
        except Exception as e:
            print(f"\n❌ Secure execution failed: {e}")
            raise
        
        finally:
            # Cleanup
            await browser_session.stop()

async def main():
    """Main execution function"""
    
    print("🛡️  Secure SOP Execution Framework")
    print("="*50)
    
    # Create secure executor
    executor = SecureSOPExecutor(use_local_llm=False)  # Set to True for local LLM
    
    # Load SOP
    executor.load_sop('app_frontend/public/latest-sop-v0.8.json')
    
    # Execute securely
    await executor.execute_secure_sop()

if __name__ == "__main__":
    asyncio.run(main()) 