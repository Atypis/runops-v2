"""
🚀 SOP Orchestrator - Mission-Critical AI Automation Platform

A production-ready orchestration platform for automating Standard Operating 
Procedures using AI agents with full human oversight and monitoring.
"""

__version__ = "1.0.0"

from .core.orchestrator import SOPOrchestrator
from .cockpit.web_server import run_cockpit
from .integrations.browser_use_wrapper import EnhancedBrowserUse

__all__ = ["SOPOrchestrator", "run_cockpit", "EnhancedBrowserUse"] 