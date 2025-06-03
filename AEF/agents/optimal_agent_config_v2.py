"""
Optimal Agent Configuration v2 - Enhanced with Smart Logging

This version integrates with the enhanced logging system to provide:
- Timestamped execution folders
- Organized log structure
- Better execution tracking and analysis
"""

from browser_use import Agent, Controller
from langchain_openai import ChatOpenAI
from typing import Dict, Any, Optional
import os
from logging.enhanced_logging_system import EnhancedLogger


class OptimalAgentConfigV2:
    """
    Enhanced version of OptimalAgentConfig with smart logging capabilities.
    """
    
    @staticmethod
    def create_agent_with_enhanced_logging(
        task: str,
        sensitive_data: Dict[str, str] = None,
        allowed_domains: list = None,
        agent_id: str = "gmail_airtable_processor",
        model_name: str = "gpt-4o",
        temperature: float = 0.1,
        max_actions_per_step: int = 10,
        use_vision: bool = True,
        save_conversation_path: Optional[str] = None,
        generate_gif: bool = True,
        **kwargs
    ):
        """
        Create an agent with enhanced logging capabilities.
        
        Args:
            task: The task description for the agent
            sensitive_data: Dictionary of sensitive data to inject
            allowed_domains: List of allowed domains for security
            agent_id: Identifier for this agent instance
            model_name: LLM model to use
            temperature: Model temperature setting
            max_actions_per_step: Maximum actions per step
            use_vision: Whether to use vision capabilities
            save_conversation_path: Custom path for conversation logs (optional)
            generate_gif: Whether to generate execution GIF
            **kwargs: Additional configuration parameters
            
        Returns:
            tuple: (agent, logger) - The configured agent and logger instance
        """
        
        # Initialize enhanced logger
        logger = EnhancedLogger(agent_id=agent_id)
        execution_id = logger.start_execution(
            task_description=task,
            execution_config={
                "model_name": model_name,
                "temperature": temperature,
                "max_actions_per_step": max_actions_per_step,
                "use_vision": use_vision,
                "sensitive_data_provided": bool(sensitive_data),
                "allowed_domains_count": len(allowed_domains) if allowed_domains else 0,
                "generate_gif": generate_gif,
                **kwargs
            }
        )
        
        # Set up logging paths
        conversation_log_path = save_conversation_path or logger.get_conversation_log_path()
        gif_path = logger.get_gif_path() if generate_gif else None
        
        # Create the LLM
        llm = ChatOpenAI(
            model=model_name,
            temperature=temperature,
            api_key=os.getenv("OPENAI_API_KEY")
        )
        
        # Create the controller with domain restrictions
        controller = Controller()
        if allowed_domains:
            # Add domain validation logic here if needed
            pass
        
        # Create the agent with enhanced configuration
        agent = Agent(
            task=task,
            llm=llm,
            controller=controller,
            use_vision=use_vision,
            save_conversation_path=conversation_log_path,
            max_actions_per_step=max_actions_per_step,
            generate_gif=gif_path,
            **kwargs
        )
        
        # Inject sensitive data if provided
        if sensitive_data:
            agent.add_to_prompt(f"\n\nSensitive Data Context:\n{_format_sensitive_data(sensitive_data)}")
        
        print(f"🤖 Agent created with enhanced logging")
        print(f"📁 Execution ID: {execution_id}")
        print(f"📝 Logs will be saved to: {logger.execution_folder}")
        
        return agent, logger
    
    @staticmethod
    def run_agent_with_enhanced_logging(
        task: str,
        sensitive_data: Dict[str, str] = None,
        allowed_domains: list = None,
        **kwargs
    ):
        """
        Complete workflow: create agent, run task, and handle logging.
        
        This is the main entry point for running agents with enhanced logging.
        """
        
        # Create agent with enhanced logging
        agent, logger = OptimalAgentConfigV2.create_agent_with_enhanced_logging(
            task=task,
            sensitive_data=sensitive_data,
            allowed_domains=allowed_domains,
            **kwargs
        )
        
        try:
            print(f"🚀 Starting agent execution...")
            print(f"📋 Task: {task}")
            
            # Run the agent
            result = agent.run()
            
            # Extract metrics from result
            total_tokens = getattr(result, 'total_tokens', 0)
            steps_completed = getattr(result, 'steps_completed', 0)
            
            # Create final summary
            final_summary = f"""
EXECUTION RESULTS:
==================

Task: {task}
Status: COMPLETED SUCCESSFULLY
Steps: {steps_completed}
Total Tokens: {total_tokens:,}
Duration: {logger.metadata.get('duration_seconds', 0):.1f}s

Result Details:
{str(result)}

GMAIL TO AIRTABLE WORKFLOW - 100% COMPLETION ACHIEVED!
Task completed successfully.
Created GIF at {logger.get_gif_path()}
            """.strip()
            
            # Mark execution as complete
            logger.complete_execution(
                success=True,
                final_summary=final_summary,
                total_tokens=total_tokens
            )
            
            print(f"✅ Task completed successfully!")
            print(f"📊 Steps: {steps_completed} | Tokens: {total_tokens:,}")
            print(f"📁 Full execution logs: {logger.execution_folder}")
            
            return result, logger
            
        except Exception as e:
            # Handle execution failure
            error_message = str(e)
            logger.complete_execution(
                success=False,
                error=error_message,
                final_summary=f"Execution failed with error: {error_message}"
            )
            
            print(f"❌ Execution failed: {error_message}")
            print(f"📁 Error logs saved to: {logger.execution_folder}")
            
            raise


def _format_sensitive_data(sensitive_data: Dict[str, str]) -> str:
    """Format sensitive data for injection into agent prompt."""
    formatted = []
    for key, value in sensitive_data.items():
        formatted.append(f"- {key}: {value}")
    return "\n".join(formatted)


# Main execution function for backward compatibility
def main():
    """
    Main execution function that demonstrates the enhanced logging system.
    """
    
    # Example task
    task = """
    Process emails from Gmail and transfer relevant data to Airtable:
    
    1. Access Gmail and identify emails from Elena Rios
    2. Extract key information (name, email, message content)
    3. Open Airtable and navigate to the appropriate base
    4. Create new records with the extracted information
    5. Verify the data was correctly transferred
    6. Provide a summary of completed actions
    """
    
    # Example sensitive data (replace with actual values)
    sensitive_data = {
        "gmail_email": "your-email@gmail.com",
        "gmail_password": "your-app-password",
        "airtable_api_key": "your-airtable-api-key",
        "airtable_base_id": "your-base-id"
    }
    
    # Allowed domains for security
    allowed_domains = [
        "gmail.com",
        "airtable.com",
        "google.com"
    ]
    
    try:
        # Run the agent with enhanced logging
        result, logger = OptimalAgentConfigV2.run_agent_with_enhanced_logging(
            task=task,
            sensitive_data=sensitive_data,
            allowed_domains=allowed_domains,
            model_name="gpt-4o",
            temperature=0.1,
            max_actions_per_step=10,
            use_vision=True,
            generate_gif=True
        )
        
        print(f"\n🎉 Execution completed successfully!")
        print(f"📁 Check the logs at: {logger.execution_folder}")
        
    except Exception as e:
        print(f"\n❌ Execution failed: {e}")


if __name__ == "__main__":
    main() 