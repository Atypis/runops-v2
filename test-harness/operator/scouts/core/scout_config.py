"""
Scout Configuration for Model Benchmarking

This module configures different LLM models for scout missions
to benchmark their performance on deep UI reconnaissance tasks.
"""

import os
from typing import Dict, Any, Optional
from enum import Enum


class ScoutModel(Enum):
    GEMINI_2_FLASH = "gemini-2.0-flash"
    OPENAI_O1_MINI = "o1-mini-2025-01-16"
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"


# API Keys (will be set via environment or directly)
MODEL_CONFIGS = {
    ScoutModel.GEMINI_2_FLASH: {
        "provider": "google",
        "model_name": "gemini-2.0-flash",
        "api_key": "AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs",
        "temperature": 0.3,
        "max_tokens": 8192,
        "features": {
            "fast_response": True,
            "multimodal": True,
            "cost_effective": True,
            "context_window": 1048576  # 1M tokens
        }
    },
    ScoutModel.OPENAI_O1_MINI: {
        "provider": "openai",
        "model_name": "o1-mini-2025-01-16",
        "api_key": os.getenv("OPENAI_API_KEY"),
        "temperature": 0.2,  # Lower for more deterministic scouting
        "max_tokens": 65536,
        "features": {
            "reasoning": True,
            "systematic_exploration": True,
            "technical_depth": True,
            "context_window": 128000
        }
    },
    ScoutModel.GPT_4O: {
        "provider": "openai", 
        "model_name": "gpt-4o",
        "api_key": os.getenv("OPENAI_API_KEY"),
        "temperature": 0.3,
        "max_tokens": 4096,
        "features": {
            "multimodal": True,
            "balanced": True
        }
    },
    ScoutModel.GPT_4O_MINI: {
        "provider": "openai",
        "model_name": "gpt-4o-mini", 
        "api_key": os.getenv("OPENAI_API_KEY"),
        "temperature": 0.3,
        "max_tokens": 16384,
        "features": {
            "fast": True,
            "cost_effective": True
        }
    }
}


def get_model_config(model: ScoutModel) -> Dict[str, Any]:
    """Get configuration for a specific model"""
    return MODEL_CONFIGS.get(model, {})


def set_api_key(model: ScoutModel, api_key: str):
    """Update API key for a model"""
    if model in MODEL_CONFIGS:
        MODEL_CONFIGS[model]["api_key"] = api_key


# Scout mission prompts optimized for different models
SCOUT_PROMPTS = {
    "base": """You are an elite UI reconnaissance specialist. Your mission is to completely reverse-engineer Airtable's filter system for bulletproof automation.

Your objectives:
1. Document EVERY method to open/close the filter panel
2. Measure EXACT timing requirements between actions
3. Find ALL ways to detect filter state (active/inactive/loading)
4. Identify the MOST RELIABLE selectors (avoid dynamic IDs)
5. Test edge cases systematically
6. Develop recovery procedures for errors

Be extremely thorough and technical. Test multiple approaches. Verify everything works reliably.""",
    
    "gemini_enhanced": """You are an elite UI reconnaissance specialist with advanced visual analysis capabilities.

MISSION: Complete reverse-engineering of Airtable's filter system.

USE YOUR VISUAL CAPABILITIES to:
- Screenshot and analyze UI states at each step
- Identify visual patterns and indicators
- Compare before/after states visually
- Detect subtle UI changes

SYSTEMATIC APPROACH:
1. Visual state mapping (screenshot everything)
2. Interaction testing (try all methods)
3. Timing analysis (measure everything)
4. Selector reliability (test 5+ times each)
5. Edge case exploration
6. Recovery procedure development

Document with specific selectors, exact timings, and visual evidence.""",
    
    "o1_enhanced": """You are conducting a systematic reconnaissance mission to reverse-engineer Airtable's filter system.

REASONING APPROACH:
- First, hypothesize about the filter system's architecture
- Then, systematically test each hypothesis
- Reason through why certain approaches fail
- Deduce the most reliable patterns

DEEP ANALYSIS REQUIRED:
1. Filter State Machine: Map all possible states and transitions
2. Async Behavior: Understand the client-server communication pattern
3. DOM Mutation Patterns: How does the UI update?
4. Error States: What can go wrong and why?
5. Reliability Engineering: What makes a selector/approach bulletproof?

Think step by step. Question your assumptions. Verify everything empirically."""
}


def get_scout_prompt(model: ScoutModel, mission_type: str = "filter_analysis") -> str:
    """Get an optimized prompt for the model and mission"""
    
    if model == ScoutModel.GEMINI_2_FLASH:
        return SCOUT_PROMPTS["gemini_enhanced"]
    elif model == ScoutModel.OPENAI_O1_MINI:
        return SCOUT_PROMPTS["o1_enhanced"]
    else:
        return SCOUT_PROMPTS["base"]


# Benchmark tracking
class BenchmarkResult:
    def __init__(self, model: ScoutModel):
        self.model = model
        self.start_time: Optional[float] = None
        self.end_time: Optional[float] = None
        self.tokens_used: int = 0
        self.cost_estimate: float = 0.0
        self.findings_count: int = 0
        self.reliability_score: float = 0.0
        self.completeness_score: float = 0.0
        self.errors: list = []
        
    def duration_seconds(self) -> float:
        if self.start_time and self.end_time:
            return self.end_time - self.start_time
        return 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "model": self.model.value,
            "duration_seconds": self.duration_seconds(),
            "tokens_used": self.tokens_used,
            "cost_estimate": self.cost_estimate,
            "findings_count": self.findings_count,
            "reliability_score": self.reliability_score,
            "completeness_score": self.completeness_score,
            "errors": self.errors
        }