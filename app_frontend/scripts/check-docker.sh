#!/bin/bash

# Simple Docker health check
if docker ps >/dev/null 2>&1; then
    echo "✅ Docker is running"
    exit 0
else
    echo "❌ Docker is not running"
    echo "💡 Starting Docker Desktop..."
    open -a "Docker Desktop"
    exit 1
fi 