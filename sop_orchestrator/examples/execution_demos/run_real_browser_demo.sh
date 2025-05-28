#!/bin/bash

echo "🎥 Real Browser-Use Visual Monitoring Demo"
echo "=========================================="

# Check if we're in the right directory
if [ ! -d "sop_orchestrator" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Check if browser-use is installed
python3 -c "import browser_use" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "❌ browser-use not found. Installing..."
    pip install browser-use
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Creating a basic one..."
    echo "# Add your API keys here if needed for AI agents" > .env
    echo "# ANTHROPIC_API_KEY=your_key_here" >> .env
    echo "# OPENAI_API_KEY=your_key_here" >> .env
    echo "# GOOGLE_API_KEY=your_key_here" >> .env
fi

echo ""
echo "🧪 Running integration test first..."
python3 test_real_browser_integration.py

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Integration test passed!"
    echo ""
    echo "🚀 Starting real browser demo..."
    echo "   A Chrome browser window will open"
    echo "   Then a web dashboard will start at http://localhost:8081"
    echo ""
    read -p "Press Enter to continue..."
    
    cd sop_orchestrator
    python3 real_browser_demo.py
else
    echo ""
    echo "❌ Integration test failed. Please check the errors above."
    exit 1
fi 