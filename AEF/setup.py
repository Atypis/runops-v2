#!/usr/bin/env python3
"""
AEF Setup Script

Installs dependencies and configures the AI-powered Agentic Execution Framework
"""

import os
import sys
import subprocess
from pathlib import Path

def run_command(cmd, cwd=None):
    """Run a shell command and return success status"""
    try:
        result = subprocess.run(cmd, shell=True, cwd=cwd, check=True, capture_output=True, text=True)
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        return False, e.stderr

def main():
    """Setup the AEF system"""
    
    print("🚀 AEF Setup - AI-Powered Agentic Execution Framework")
    print("=" * 60)
    
    aef_dir = Path(__file__).parent
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ required")
        return False
    
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
    
    # Install backend dependencies
    print("\n📦 Installing backend dependencies...")
    
    core_requirements = aef_dir / "core" / "requirements.txt"
    if core_requirements.exists():
        success, output = run_command(f"pip install -r {core_requirements}")
        if success:
            print("✅ Core dependencies installed")
        else:
            print(f"❌ Failed to install core dependencies: {output}")
            return False
    
    api_requirements = aef_dir / "api" / "requirements.txt"
    if api_requirements.exists():
        success, output = run_command(f"pip install -r {api_requirements}")
        if success:
            print("✅ API dependencies installed")
        else:
            print(f"❌ Failed to install API dependencies: {output}")
            return False
    
    # Install frontend dependencies
    print("\n🎨 Installing frontend dependencies...")
    cockpit_dir = aef_dir / "cockpit"
    
    if cockpit_dir.exists():
        success, output = run_command("npm install", cwd=cockpit_dir)
        if success:
            print("✅ Frontend dependencies installed")
        else:
            print(f"❌ Failed to install frontend dependencies: {output}")
            return False
    
    # Check for .env file
    print("\n🔧 Checking environment configuration...")
    env_file = aef_dir / ".env"
    
    if not env_file.exists():
        print("⚠️  .env file not found")
        print("📝 Creating .env template...")
        
        env_template = """# AEF Configuration
# Add your Claude API key here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Supabase Configuration (optional)
SUPABASE_URL=https://ypnnoivcybufgsrbzqkt.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Development Settings
DEBUG=true
LOG_LEVEL=INFO
"""
        
        with open(env_file, 'w') as f:
            f.write(env_template)
        
        print(f"✅ Created .env template at {env_file}")
        print("🔑 Please add your ANTHROPIC_API_KEY to the .env file")
    else:
        print("✅ .env file found")
        
        # Check if API key is configured
        with open(env_file, 'r') as f:
            env_content = f.read()
            if "your_anthropic_api_key_here" in env_content:
                print("⚠️  Please update ANTHROPIC_API_KEY in .env file")
            else:
                print("✅ API key appears to be configured")
    
    # Test imports
    print("\n🧪 Testing imports...")
    
    try:
        import anthropic
        print("✅ Anthropic library imported successfully")
    except ImportError:
        print("❌ Failed to import anthropic library")
        return False
    
    try:
        import fastapi
        print("✅ FastAPI imported successfully")
    except ImportError:
        print("❌ Failed to import FastAPI")
        return False
    
    # Success message
    print("\n🎉 AEF Setup Complete!")
    print("=" * 60)
    print("Next steps:")
    print("1. Add your Claude API key to .env file")
    print("2. Test the AI orchestrator: python test_ai_orchestrator.py")
    print("3. Start the API server: python start_api.py")
    print("4. Start the frontend: cd cockpit && npm start")
    print("\n📚 See AI_ORCHESTRATOR_README.md for detailed instructions")
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1) 