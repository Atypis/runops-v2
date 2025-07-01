#!/usr/bin/env python3
"""
Quick test of Gemini 2.5 Pro API
"""

import asyncio
import google.generativeai as genai

# Configure the API key
API_KEY = "AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs"
genai.configure(api_key=API_KEY)

async def test_gemini():
    try:
        # Initialize Gemini 2.5 Pro model
        model = genai.GenerativeModel('gemini-2.5-pro')
        
        # Test with a simple prompt
        response = model.generate_content(
            "Say 'Gemini 2.5 Pro is working!' if you can receive this message.",
            generation_config=genai.GenerationConfig(
                temperature=1.0,
            )
        )
        
        print("✅ Gemini API Test Results:")
        print(f"Model: gemini-2.5-pro")
        print(f"Temperature: 1.0")
        print(f"Response: {response.text}")
        
    except Exception as e:
        print(f"❌ Error testing Gemini API: {e}")
        print(f"Error type: {type(e).__name__}")

if __name__ == "__main__":
    asyncio.run(test_gemini())