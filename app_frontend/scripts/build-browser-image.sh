#!/bin/bash

# Build script for AEF Browser Docker Image
# This builds the containerized browser environment used by SingleVNCSessionManager

set -e

echo "🚀 Building AEF Browser Docker Image..."

# Check if Dockerfile exists
if [ ! -f "docker/browser/Dockerfile" ]; then
    echo "❌ Error: docker/browser/Dockerfile not found"
    echo "Please ensure you're running this from the app_frontend directory"
    exit 1
fi

# Build the image
echo "📦 Building Docker image 'aef-browser:latest'..."
docker build -t aef-browser:latest -f docker/browser/Dockerfile .

# Verify the image was built
if docker image inspect aef-browser:latest >/dev/null 2>&1; then
    echo "✅ AEF Browser image built successfully!"
    echo "📋 Image details:"
    docker image inspect aef-browser:latest --format="Created: {{.Created}}" 
    docker image inspect aef-browser:latest --format="Size: {{.Size}} bytes"
else
    echo "❌ Failed to build AEF Browser image"
    exit 1
fi

echo "🎉 Ready to use with SingleVNCSessionManager!"
echo "💡 You can now start VNC sessions using the simplified API" 