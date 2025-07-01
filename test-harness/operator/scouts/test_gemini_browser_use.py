#!/usr/bin/env python3
"""
Test Gemini 2.5 Pro with Browser-Use LLM interface
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scouts import browser_use_patch
import google.generativeai as genai
from browser_use.llm.base import LLM, SystemMessage, UserMessage

class GeminiLLM(LLM):
    def __init__(self, api_key: str, model: str = "gemini-2.5-pro", temperature: float = 1.0):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model)
        self.temperature = temperature
    
    async def chat(self, messages: list[dict]) -> dict:
        # Convert Browser-Use messages to Gemini format
        prompt = ""
        for msg in messages:
            if isinstance(msg, SystemMessage):
                prompt += f"System: {msg.content}\n\n"
            elif isinstance(msg, UserMessage):
                prompt += f"User: {msg.content}\n\n"
        
        response = self.model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(temperature=self.temperature)
        )
        
        return {
            "content": response.text,
            "role": "assistant"
        }

# Test the integration
print("Testing Gemini 2.5 Pro with Browser-Use LLM interface...")
try:
    llm = GeminiLLM(
        api_key="AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs",
        model="gemini-2.5-pro",
        temperature=1.0
    )
    print("✅ Gemini LLM wrapper created successfully!")
    print(f"   Model: gemini-2.5-pro")
    print(f"   Temperature: 1.0")
    print(f"   Ready for Browser-Use integration")
except Exception as e:
    print(f"❌ Error: {e}")