import google.generativeai as genai
import asyncio

async def test_gemini_api():
    """Test if the Gemini API key works"""
    try:
        # Configure the API key
        genai.configure(api_key="AIzaSyCHFtX09QsZnUVLYbv0E3EqVmfPiCImLTs")
        
        # Create model
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        
        # Test with a simple prompt
        response = model.generate_content("Say 'API key works!' if you can read this.")
        
        print("✅ Gemini API Test Successful!")
        print(f"Response: {response.text}")
        return True
        
    except Exception as e:
        print(f"❌ Gemini API Test Failed!")
        print(f"Error: {str(e)}")
        return False

if __name__ == "__main__":
    asyncio.run(test_gemini_api())