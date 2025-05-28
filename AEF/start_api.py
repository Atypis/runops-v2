#!/usr/bin/env python3
"""
AEF API Startup Script

Starts the FastAPI server for the Agentic Execution Framework
"""

import os
import sys
from pathlib import Path

def main():
    """Start the AEF API server"""
    
    print("🚀 Starting AEF API Server")
    print("=" * 40)
    
    # Check if API key is configured
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("⚠️  WARNING: ANTHROPIC_API_KEY not found")
        print("   AI features will be disabled")
        print("   Add your Claude API key to .env file")
    else:
        print(f"✅ Claude API Key configured: {api_key[:10]}...")
    
    print("\n📡 Server will be available at:")
    print("   • Main API: http://localhost:8000")
    print("   • Health Check: http://localhost:8000/health") 
    print("   • API Docs: http://localhost:8000/docs")
    print("   • Interactive Docs: http://localhost:8000/redoc")
    
    print("\n🔗 CORS enabled for:")
    print("   • http://localhost:3000 (React dev)")
    print("   • http://localhost:3001 (React dev)")
    
    print("\n🎯 Starting server...")
    print("   Press Ctrl+C to stop")
    print("=" * 40)
    
    # Add api directory to path
    api_path = Path(__file__).parent / "api"
    sys.path.insert(0, str(api_path))
    
    # Start the server
    import uvicorn
    uvicorn.run(
        "api.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main() 