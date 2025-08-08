#!/bin/bash

# Websockify wrapper for noVNC compatibility with TigerVNC
# Serves noVNC client and proxies WebSocket connections to VNC

# Wait for VNC server to be ready
echo "Waiting for VNC server..."
while ! nc -z localhost 5900; do
  sleep 1
done

echo "VNC server ready, starting websockify..."

# Start websockify with noVNC web files
exec python3 -m websockify --web /usr/share/novnc 6080 localhost:5900 