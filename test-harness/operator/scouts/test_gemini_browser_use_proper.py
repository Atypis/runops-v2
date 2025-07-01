#!/usr/bin/env python3
"""
Test Gemini 2.5 Pro with proper Browser-Use integration
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from scouts import browser_use_patch
from browser_use.llm.google.chat import ChatGoogle

async def test_gemini_browser_use():
    print("Testing Gemini 2.5 Pro with Browser-Use...")
    
    # Create Gemini LLM instance
    llm = ChatGoogle(
        api_key="AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs",
        model="gemini-2.5-pro",
        temperature=1.0
    )
    
    print(f"✅ Created ChatGoogle instance")
    print(f"   Model: {llm.model}")
    print(f"   Temperature: {llm.temperature}")
    print(f"   Provider: {llm.provider}")
    
    # Test with a simple message
    from browser_use.llm.messages import SystemMessage, UserMessage
    
    messages = [
        SystemMessage(content="You are a helpful assistant."),
        UserMessage(content="Say 'Gemini 2.5 Pro is working with Browser-Use!' if you can receive this.")
    ]
    
    try:
        response = await llm.ainvoke(messages)
        print(f"\n✅ Response: {response.completion}")
        print(f"   Usage: {response.usage}")
    except Exception as e:
        print(f"\n❌ Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_gemini_browser_use())