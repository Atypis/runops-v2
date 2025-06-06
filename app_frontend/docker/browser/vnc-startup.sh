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

# Keep the session alive
wait 