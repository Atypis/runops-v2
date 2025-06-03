"""
Enhanced Logging System for AEF Agent Executions

This module provides a smarter logging system that:
1. Creates dedicated folders for each execution run
2. Uses timestamps in folder names for easy identification
3. Organizes logs, screenshots, and execution artifacts
4. Provides easy analysis and comparison tools
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
import uuid


class EnhancedLogger:
    """
    Enhanced logging system for browser automation agents.
    
    Features:
    - Timestamped execution folders
    - Organized log structure
    - Execution metadata tracking
    - Easy analysis and comparison
    """
    
    def __init__(self, base_log_dir: str = "AEF/agents/execution_logs", agent_id: str = "agent"):
        self.base_log_dir = Path(base_log_dir)
        self.agent_id = agent_id
        self.execution_id = None
        self.execution_folder = None
        self.start_time = None
        self.metadata = {}
        
    def start_execution(self, task_description: str = "", execution_config: Dict[str, Any] = None) -> str:
        """
        Start a new execution and create the logging structure.
        
        Args:
            task_description: Description of the task being executed
            execution_config: Configuration parameters for this execution
            
        Returns:
            execution_id: Unique identifier for this execution
        """
        self.start_time = datetime.now()
        timestamp = self.start_time.strftime("%Y%m%d_%H%M%S")
        self.execution_id = f"{timestamp}_{self.agent_id}_{uuid.uuid4().hex[:8]}"
        
        # Create execution folder structure
        self.execution_folder = self.base_log_dir / self.execution_id
        self._create_folder_structure()
        
        # Initialize metadata
        self.metadata = {
            "execution_id": self.execution_id,
            "agent_id": self.agent_id,
            "start_time": self.start_time.isoformat(),
            "task_description": task_description,
            "execution_config": execution_config or {},
            "status": "running",
            "steps_completed": 0,
            "total_tokens": 0,
            "duration_seconds": 0,
            "success": False,
            "error": None,
            "artifacts": {
                "conversation_logs": [],
                "screenshots": [],
                "gif_file": None,
                "final_summary": None
            }
        }
        
        # Save initial metadata
        self._save_metadata()
        
        print(f"🚀 Started execution: {self.execution_id}")
        print(f"📁 Logs folder: {self.execution_folder}")
        
        return self.execution_id
    
    def _create_folder_structure(self):
        """Create the organized folder structure for this execution."""
        folders = [
            self.execution_folder,
            self.execution_folder / "conversation_logs",
            self.execution_folder / "screenshots", 
            self.execution_folder / "artifacts",
            self.execution_folder / "analysis"
        ]
        
        for folder in folders:
            folder.mkdir(parents=True, exist_ok=True)
    
    def get_conversation_log_path(self) -> str:
        """Get the path for conversation logs (for browser-use save_conversation_path)."""
        if not self.execution_folder:
            raise ValueError("Execution not started. Call start_execution() first.")
        
        log_path = self.execution_folder / "conversation_logs" / f"{self.agent_id}_conversation.json"
        return str(log_path)
    
    def get_gif_path(self) -> str:
        """Get the path for the execution GIF."""
        if not self.execution_folder:
            raise ValueError("Execution not started. Call start_execution() first.")
        
        gif_path = self.execution_folder / "artifacts" / f"{self.agent_id}_history.gif"
        return str(gif_path)
    
    def log_step(self, step_number: int, step_data: Dict[str, Any] = None):
        """Log information about a specific step."""
        if step_data:
            step_log_path = self.execution_folder / "conversation_logs" / f"step_{step_number:03d}.json"
            with open(step_log_path, 'w') as f:
                json.dump(step_data, f, indent=2)
        
        self.metadata["steps_completed"] = step_number
        self._save_metadata()
    
    def save_screenshot(self, step_number: int, screenshot_data: bytes, description: str = ""):
        """Save a screenshot for a specific step."""
        screenshot_path = self.execution_folder / "screenshots" / f"step_{step_number:03d}_{description}.png"
        with open(screenshot_path, 'wb') as f:
            f.write(screenshot_data)
        
        self.metadata["artifacts"]["screenshots"].append({
            "step": step_number,
            "path": str(screenshot_path.relative_to(self.execution_folder)),
            "description": description
        })
        self._save_metadata()
    
    def complete_execution(self, success: bool, final_summary: str = "", error: str = None, 
                          total_tokens: int = 0):
        """Mark the execution as complete and save final metadata."""
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()
        
        self.metadata.update({
            "end_time": end_time.isoformat(),
            "duration_seconds": duration,
            "status": "completed" if success else "failed",
            "success": success,
            "error": error,
            "total_tokens": total_tokens,
            "artifacts": {
                **self.metadata["artifacts"],
                "final_summary": final_summary
            }
        })
        
        # Save final summary to file
        if final_summary:
            summary_path = self.execution_folder / "artifacts" / "execution_summary.txt"
            with open(summary_path, 'w') as f:
                f.write(final_summary)
        
        # Save final metadata
        self._save_metadata()
        
        # Create execution report
        self._create_execution_report()
        
        print(f"✅ Execution completed: {self.execution_id}")
        print(f"📊 Duration: {duration:.1f}s | Steps: {self.metadata['steps_completed']} | Tokens: {total_tokens:,}")
        print(f"📁 Full logs: {self.execution_folder}")
    
    def _save_metadata(self):
        """Save the current metadata to file."""
        metadata_path = self.execution_folder / "execution_metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(self.metadata, f, indent=2)
    
    def _create_execution_report(self):
        """Create a human-readable execution report."""
        report_path = self.execution_folder / "EXECUTION_REPORT.md"
        
        report = f"""# Execution Report: {self.execution_id}

## Overview
- **Agent ID**: {self.metadata['agent_id']}
- **Start Time**: {self.metadata['start_time']}
- **End Time**: {self.metadata.get('end_time', 'N/A')}
- **Duration**: {self.metadata['duration_seconds']:.1f} seconds
- **Status**: {self.metadata['status']}
- **Success**: {self.metadata['success']}

## Task Description
{self.metadata['task_description']}

## Execution Metrics
- **Steps Completed**: {self.metadata['steps_completed']}
- **Total Tokens**: {self.metadata['total_tokens']:,}
- **Average Tokens per Step**: {self.metadata['total_tokens'] / max(1, self.metadata['steps_completed']):.0f}

## Artifacts Generated
- **Conversation Logs**: {len(self.metadata['artifacts']['conversation_logs'])} files
- **Screenshots**: {len(self.metadata['artifacts']['screenshots'])} files
- **GIF File**: {'✅' if self.metadata['artifacts']['gif_file'] else '❌'}

## Configuration
```json
{json.dumps(self.metadata['execution_config'], indent=2)}
```

## Final Summary
{self.metadata['artifacts']['final_summary'] or 'No summary provided'}

## Error Details
{self.metadata['error'] or 'No errors reported'}

---
*Generated by Enhanced Logging System*
"""
        
        with open(report_path, 'w') as f:
            f.write(report)
    
    @staticmethod
    def list_executions(base_log_dir: str = "AEF/agents/execution_logs") -> list:
        """List all execution folders with their metadata."""
        base_path = Path(base_log_dir)
        if not base_path.exists():
            return []
        
        executions = []
        for folder in base_path.iterdir():
            if folder.is_dir():
                metadata_path = folder / "execution_metadata.json"
                if metadata_path.exists():
                    with open(metadata_path, 'r') as f:
                        metadata = json.load(f)
                    executions.append({
                        "folder": folder.name,
                        "path": str(folder),
                        "metadata": metadata
                    })
        
        # Sort by start time (newest first)
        executions.sort(key=lambda x: x['metadata']['start_time'], reverse=True)
        return executions
    
    @staticmethod
    def get_execution_summary(execution_folder: str) -> Dict[str, Any]:
        """Get a summary of a specific execution."""
        folder_path = Path(execution_folder)
        metadata_path = folder_path / "execution_metadata.json"
        
        if not metadata_path.exists():
            return {"error": "Execution metadata not found"}
        
        with open(metadata_path, 'r') as f:
            metadata = json.load(f)
        
        # Count actual files
        conversation_logs = list((folder_path / "conversation_logs").glob("*.json"))
        screenshots = list((folder_path / "screenshots").glob("*.png"))
        
        return {
            "execution_id": metadata['execution_id'],
            "start_time": metadata['start_time'],
            "duration": metadata['duration_seconds'],
            "success": metadata['success'],
            "steps": metadata['steps_completed'],
            "tokens": metadata['total_tokens'],
            "conversation_logs_count": len(conversation_logs),
            "screenshots_count": len(screenshots),
            "task": metadata['task_description'][:100] + "..." if len(metadata['task_description']) > 100 else metadata['task_description']
        }


def create_enhanced_agent_config(task: str, sensitive_data: Dict[str, str] = None, 
                               allowed_domains: list = None, **kwargs):
    """
    Create an agent configuration with enhanced logging.
    
    This replaces the logging configuration in optimal_agent_config.py
    """
    from AEF.agents.optimal_agent_config import OptimalAgentConfig
    
    # Initialize enhanced logger
    logger = EnhancedLogger(agent_id="gmail_airtable_processor")
    execution_id = logger.start_execution(
        task_description=task,
        execution_config={
            "sensitive_data_provided": bool(sensitive_data),
            "allowed_domains_count": len(allowed_domains) if allowed_domains else 0,
            **kwargs
        }
    )
    
    # Create agent with enhanced logging paths
    agent = OptimalAgentConfig.create_agent(
        task=task,
        sensitive_data=sensitive_data,
        allowed_domains=allowed_domains,
        agent_id="gmail_airtable_processor",
        **kwargs
    )
    
    # Override logging paths
    agent.settings.save_conversation_path = logger.get_conversation_log_path()
    agent.settings.generate_gif = logger.get_gif_path()
    
    return agent, logger


# CLI tool for analyzing executions
def main():
    """Command-line interface for execution analysis."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced Logging System CLI")
    parser.add_argument("--list", action="store_true", help="List all executions")
    parser.add_argument("--summary", type=str, help="Get summary of specific execution")
    parser.add_argument("--compare", nargs=2, help="Compare two executions")
    
    args = parser.parse_args()
    
    if args.list:
        executions = EnhancedLogger.list_executions()
        print(f"\n📊 Found {len(executions)} executions:\n")
        
        for i, exec_data in enumerate(executions[:10]):  # Show last 10
            metadata = exec_data['metadata']
            status_icon = "✅" if metadata['success'] else "❌"
            print(f"{i+1:2d}. {status_icon} {exec_data['folder']}")
            print(f"    📅 {metadata['start_time'][:19]} | ⏱️ {metadata['duration_seconds']:.1f}s | 📊 {metadata['steps_completed']} steps")
            print(f"    📝 {metadata['task_description'][:80]}...")
            print()
    
    elif args.summary:
        summary = EnhancedLogger.get_execution_summary(args.summary)
        if "error" in summary:
            print(f"❌ {summary['error']}")
        else:
            print(f"\n📊 Execution Summary: {summary['execution_id']}")
            print(f"📅 Start: {summary['start_time'][:19]}")
            print(f"⏱️ Duration: {summary['duration']:.1f}s")
            print(f"📊 Steps: {summary['steps']} | Tokens: {summary['tokens']:,}")
            print(f"📁 Logs: {summary['conversation_logs_count']} | Screenshots: {summary['screenshots_count']}")
            print(f"✅ Success: {summary['success']}")
            print(f"📝 Task: {summary['task']}")


if __name__ == "__main__":
    main() 