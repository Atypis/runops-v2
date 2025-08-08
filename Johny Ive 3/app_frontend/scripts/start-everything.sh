#!/bin/bash

# 🚀 BRAINDEAD SIMPLE STARTUP SCRIPT
# This script does EVERYTHING needed to get the VNC system running

set -e

echo "🎯 Starting EVERYTHING for VNC System..."
echo "=================================================="

# Step 1: Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this from the app_frontend directory"
    exit 1
fi

# Step 2: Ensure Docker Desktop is running
echo "🐳 Checking Docker..."
if ! docker ps >/dev/null 2>&1; then
    echo "🚀 Starting Docker Desktop..."
    open -a "Docker Desktop"
    echo "⏳ Waiting for Docker to start..."
    
    # Wait up to 60 seconds for Docker to be ready
    counter=0
    while ! docker ps >/dev/null 2>&1; do
        sleep 3
        counter=$((counter + 3))
        if [ $counter -gt 60 ]; then
            echo "❌ Docker failed to start within 60 seconds"
            echo "💡 Please start Docker Desktop manually and try again"
            exit 1
        fi
        echo "   ... still waiting ($counter/60 seconds)"
    done
fi
echo "✅ Docker is ready!"

# Step 3: Build browser image if it doesn't exist
echo "🏗️ Checking browser image..."
if ! docker image inspect aef-browser:latest >/dev/null 2>&1; then
    echo "📦 Building browser image (this takes a few minutes)..."
    if [ -f "scripts/build-browser-image.sh" ]; then
        ./scripts/build-browser-image.sh
    else
        echo "❌ Browser image build script not found"
        echo "💡 Please run: npm run build-browser-image"
        exit 1
    fi
else
    echo "✅ Browser image exists!"
fi

# Step 4: Clean up any orphaned VNC containers
echo "🧹 Cleaning up any old VNC containers..."
docker rm -f aef-vnc-single 2>/dev/null || echo "   No containers to clean"

# Step 5: Install npm dependencies if needed
echo "📦 Checking npm dependencies..."
if [ ! -d "node_modules" ]; then
    echo "📥 Installing npm dependencies..."
    npm install
fi
echo "✅ Dependencies ready!"

# Step 6: Start the development server
echo "🚀 Starting Next.js development server..."
echo "=================================================="
echo "✅ EVERYTHING IS READY!"
echo ""
echo "🎯 Your VNC system will be available at:"
echo "   🌐 Frontend: http://localhost:3000"
echo "   🖥️ VNC Desktop: http://localhost:16080/vnc.html (after starting a session)"
echo ""
echo "💡 How to use:"
echo "   1. Open http://localhost:3000 in your browser"
echo "   2. Go to AEF Control Center"
echo "   3. Click 'Start VNC Environment'"
echo "   4. Access remote desktop at http://localhost:16080/vnc.html"
echo ""
echo "🚀 Starting server now..."
echo "=================================================="

# Start Next.js (this will run in foreground)
npm run dev 