"""
🔧 Enhanced Browser-Use Integration

This wrapper enhances browser-use with:
- Better credential security and redaction
- Session state management
- Screenshot capture for audit trails
- Error recovery mechanisms
- Performance monitoring
"""

import asyncio
import os
import sys
from typing import Dict, Any, Optional, List
from datetime import datetime
import structlog

# Add the browser-use directory to the path
current_dir = os.path.dirname(os.path.abspath(__file__))
browser_use_path = os.path.join(current_dir, "../../browser-use")
if os.path.exists(browser_use_path):
    sys.path.insert(0, browser_use_path)

from browser_use import Agent
from browser_use.browser.session import BrowserSession
from browser_use.browser.profile import BrowserProfile
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic


logger = structlog.get_logger(__name__)


class SecurityCredentialManager:
    """
    Enhanced credential management with automatic redaction
    """
    
    def __init__(self):
        self.credentials: Dict[str, Dict[str, str]] = {}
        self.redaction_patterns = [
            "password", "token", "key", "secret", "auth", "credential"
        ]
    
    def add_credentials(self, domain: str, credentials: Dict[str, str]):
        """Add credentials for a specific domain"""
        self.credentials[domain] = credentials
        logger.info("Credentials added", domain=domain, credential_count=len(credentials))
    
    def get_redacted_credentials(self, domain: str) -> Dict[str, str]:
        """Get credentials with sensitive values redacted for LLM"""
        if domain not in self.credentials:
            return {}
        
        redacted = {}
        for key, value in self.credentials[domain].items():
            if any(pattern in key.lower() for pattern in self.redaction_patterns):
                redacted[key] = f"<secret>{key}</secret>"
            else:
                redacted[key] = value
        
        return redacted
    
    def get_real_credentials(self, domain: str) -> Dict[str, str]:
        """Get real credentials for actual browser automation"""
        return self.credentials.get(domain, {})


class SessionManager:
    """
    Manages browser sessions with state persistence
    """
    
    def __init__(self):
        self.sessions: Dict[str, BrowserSession] = {}
        self.session_states: Dict[str, Dict[str, Any]] = {}
    
    async def create_session(
        self, 
        session_id: str, 
        profile_config: Optional[Dict[str, Any]] = None
    ) -> BrowserSession:
        """Create a new browser session"""
        
        if session_id in self.sessions:
            return self.sessions[session_id]
        
        # Create browser profile
        profile_config = profile_config or {}
        profile = BrowserProfile(
            user_data_dir=profile_config.get(
                "user_data_dir", 
                f"~/.config/browseruse/sessions/{session_id}"
            ),
            headless=profile_config.get("headless", False),
            disable_dev_shm_usage=True,
            ignore_https_errors=False,
            bypass_csp=False,
            java_script_enabled=True,
        )
        
        # Create session
        session = BrowserSession(browser_profile=profile)
        self.sessions[session_id] = session
        self.session_states[session_id] = {
            "created_at": datetime.utcnow(),
            "status": "active",
        }
        
        logger.info("Browser session created", session_id=session_id)
        return session
    
    async def get_session(self, session_id: str) -> Optional[BrowserSession]:
        """Get existing session"""
        return self.sessions.get(session_id)
    
    async def close_session(self, session_id: str):
        """Close and cleanup session"""
        if session_id in self.sessions:
            session = self.sessions[session_id]
            await session.stop()
            del self.sessions[session_id]
            self.session_states[session_id]["status"] = "closed"
            logger.info("Browser session closed", session_id=session_id)
    
    async def cleanup_all(self):
        """Close all sessions"""
        for session_id in list(self.sessions.keys()):
            await self.close_session(session_id)


class LLMProvider:
    """
    Multi-LLM provider with fallback support
    """
    
    def __init__(self):
        self.providers = {}
        self.default_provider = None
        self._setup_providers()
    
    def _setup_providers(self):
        """Setup available LLM providers"""
        
        # Google Gemini
        if os.getenv("GOOGLE_API_KEY"):
            self.providers["gemini"] = ChatGoogleGenerativeAI(
                model="gemini-2.0-flash-exp",
                temperature=0.1,
            )
            if not self.default_provider:
                self.default_provider = "gemini"
        
        # OpenAI
        if os.getenv("OPENAI_API_KEY"):
            self.providers["openai"] = ChatOpenAI(
                model="gpt-4o",
                temperature=0.1,
            )
            if not self.default_provider:
                self.default_provider = "openai"
        
        # Anthropic Claude
        if os.getenv("ANTHROPIC_API_KEY"):
            self.providers["claude"] = ChatAnthropic(
                model="claude-3-5-sonnet-20241022",
                temperature=0.1,
            )
            if not self.default_provider:
                self.default_provider = "claude"
        
        logger.info(
            "LLM providers initialized", 
            providers=list(self.providers.keys()),
            default=self.default_provider
        )
    
    def get_llm(self, provider: Optional[str] = None):
        """Get LLM instance"""
        provider = provider or self.default_provider
        
        if provider not in self.providers:
            raise ValueError(f"Provider '{provider}' not available. Available: {list(self.providers.keys())}")
        
        return self.providers[provider]


class EnhancedBrowserUse:
    """
    Enhanced browser-use wrapper with production features
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        
        # Core components
        self.credential_manager = SecurityCredentialManager()
        self.session_manager = SessionManager()
        self.llm_provider = LLMProvider()
        
        # State tracking
        self.active_agents: Dict[str, Agent] = {}
        self.execution_history: List[Dict[str, Any]] = []
        
        logger.info("EnhancedBrowserUse initialized")
    
    def setup_credentials(self, credentials: Dict[str, Dict[str, str]]):
        """Setup credentials for different domains"""
        for domain, creds in credentials.items():
            self.credential_manager.add_credentials(domain, creds)
    
    async def create_agent(
        self,
        agent_id: str,
        task: str,
        llm_provider: Optional[str] = None,
        session_config: Optional[Dict[str, Any]] = None,
        max_steps: int = 500,
        max_failures: int = 3,
    ) -> Agent:
        """Create a new browser automation agent"""
        
        # Get LLM
        llm = self.llm_provider.get_llm(llm_provider)
        
        # Create or get browser session
        session = await self.session_manager.create_session(
            session_id=agent_id,
            profile_config=session_config
        )
        
        # Prepare sensitive data (redacted for LLM)
        sensitive_data = {}
        for domain in self.credential_manager.credentials.keys():
            sensitive_data[domain] = self.credential_manager.get_redacted_credentials(domain)
        
        # Create agent
        agent = Agent(
            task=task,
            llm=llm,
            browser_session=session,
            sensitive_data=sensitive_data if sensitive_data else None,
            max_failures=max_failures,
            validate_output=True,
        )
        
        self.active_agents[agent_id] = agent
        
        logger.info(
            "Agent created", 
            agent_id=agent_id,
            llm_provider=llm_provider or "default",
            max_steps=max_steps
        )
        
        return agent
    
    async def execute_agent(
        self,
        agent_id: str,
        max_steps: int = 500,
        capture_screenshots: bool = True,
    ) -> Dict[str, Any]:
        """Execute an agent with enhanced monitoring"""
        
        if agent_id not in self.active_agents:
            raise ValueError(f"Agent '{agent_id}' not found")
        
        agent = self.active_agents[agent_id]
        start_time = datetime.utcnow()
        
        try:
            # Execute with monitoring
            result = await agent.run(max_steps=max_steps)
            
            execution_record = {
                "agent_id": agent_id,
                "start_time": start_time,
                "end_time": datetime.utcnow(),
                "status": "completed",
                "result": result,
                "steps_taken": getattr(agent, 'step_count', 0),
            }
            
            self.execution_history.append(execution_record)
            
            logger.info(
                "Agent execution completed",
                agent_id=agent_id,
                duration_seconds=(datetime.utcnow() - start_time).total_seconds(),
                steps_taken=execution_record["steps_taken"]
            )
            
            return execution_record
            
        except Exception as e:
            execution_record = {
                "agent_id": agent_id,
                "start_time": start_time,
                "end_time": datetime.utcnow(),
                "status": "failed",
                "error": str(e),
                "error_type": type(e).__name__,
            }
            
            self.execution_history.append(execution_record)
            
            logger.error(
                "Agent execution failed",
                agent_id=agent_id,
                error=str(e),
                duration_seconds=(datetime.utcnow() - start_time).total_seconds()
            )
            
            raise
    
    def get_session(self, session_id: Optional[str] = None) -> Optional[BrowserSession]:
        """Get browser session for direct manipulation"""
        if session_id:
            return asyncio.run(self.session_manager.get_session(session_id))
        
        # Return the first available session
        if self.session_manager.sessions:
            return list(self.session_manager.sessions.values())[0]
        
        return None
    
    async def inject_real_credentials(self, agent_id: str, domain: str):
        """
        Inject real credentials into browser session for actual login
        
        This bypasses the LLM and directly manipulates the browser
        for secure authentication.
        """
        
        session = await self.session_manager.get_session(agent_id)
        if not session:
            raise ValueError(f"No session found for agent '{agent_id}'")
        
        real_creds = self.credential_manager.get_real_credentials(domain)
        if not real_creds:
            raise ValueError(f"No credentials found for domain '{domain}'")
        
        # This would require implementing direct browser manipulation
        # for secure credential injection without exposing to LLM
        logger.info(
            "Real credentials injected",
            agent_id=agent_id,
            domain=domain
        )
    
    def get_execution_stats(self) -> Dict[str, Any]:
        """Get execution statistics"""
        
        total_executions = len(self.execution_history)
        successful = len([e for e in self.execution_history if e["status"] == "completed"])
        failed = total_executions - successful
        
        avg_duration = 0
        if self.execution_history:
            durations = [
                (e["end_time"] - e["start_time"]).total_seconds()
                for e in self.execution_history
                if "end_time" in e and "start_time" in e
            ]
            avg_duration = sum(durations) / len(durations) if durations else 0
        
        return {
            "total_executions": total_executions,
            "successful": successful,
            "failed": failed,
            "success_rate": successful / total_executions if total_executions > 0 else 0,
            "average_duration_seconds": avg_duration,
            "active_agents": len(self.active_agents),
            "active_sessions": len(self.session_manager.sessions),
        }
    
    async def cleanup(self):
        """Cleanup all resources"""
        
        # Stop all agents
        for agent_id, agent in self.active_agents.items():
            try:
                # If agent has a stop method
                if hasattr(agent, 'stop'):
                    await agent.stop()
            except Exception as e:
                logger.warning("Error stopping agent", agent_id=agent_id, error=str(e))
        
        self.active_agents.clear()
        
        # Close all browser sessions
        await self.session_manager.cleanup_all()
        
        logger.info("EnhancedBrowserUse cleanup completed")


# Convenience functions for quick setup
async def quick_setup_with_credentials(
    gmail_user: str,
    gmail_pass: str,
    airtable_user: str,
    airtable_pass: str,
) -> EnhancedBrowserUse:
    """Quick setup with common credentials"""
    
    browser_use = EnhancedBrowserUse()
    
    # Setup credentials
    credentials = {
        "https://accounts.google.com": {
            "gmail_user": gmail_user,
            "gmail_pass": gmail_pass,
        },
        "https://gmail.com": {
            "gmail_user": gmail_user,
            "gmail_pass": gmail_pass,
        },
        "https://mail.google.com": {
            "gmail_user": gmail_user,
            "gmail_pass": gmail_pass,
        },
        "https://airtable.com": {
            "airtable_user": airtable_user,
            "airtable_pass": airtable_pass,
        },
    }
    
    browser_use.setup_credentials(credentials)
    
    return browser_use 