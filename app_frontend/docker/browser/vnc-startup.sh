#!/bin/bash

# TigerVNC xstartup script with dynamic resolution support
# This script is executed when TigerVNC starts

# Set environment variables
export DISPLAY=:1
export HOME=/home/aefuser

# Wait for X server to be ready
echo "Waiting for X server on display :1..."
while ! xdpyinfo -display :1 >/dev/null 2>&1; do
    sleep 1
done
echo "X server ready!"

# Start window manager (fluxbox)
fluxbox &

# Wait a bit for the window manager to initialize
sleep 3

# Launch the browser automation server
echo "Starting browser automation server..."
cd /home/aefuser
DISPLAY=:1 node browser-server.js &

# Wait for browser server to be ready
echo "Waiting for browser server to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        echo "Browser server is ready!"
        break
    fi
    sleep 1
done

# Auto-initialize Stagehand and Chrome browser
echo "Auto-initializing Chrome browser in VNC environment..."
curl -X POST http://localhost:3000/init \
  -H "Content-Type: application/json" \
  --max-time 30 \
  --silent \
  --show-error \
  && echo "✅ Chrome browser auto-initialized successfully!" \
  || echo "⚠️ Chrome browser auto-initialization failed (can be started manually)"

# Keep the session alive
wait 