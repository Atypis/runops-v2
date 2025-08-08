#!/bin/bash

# Simple Chrome test without Stagehand
# This will help us determine if the viewport issue is caused by Playwright/Stagehand

echo "🔍 Testing Chrome directly without Stagehand..."

# Kill any existing chrome processes
pkill -f chrome || true

# Wait a moment
sleep 2

# Launch Chrome directly with our flags
DISPLAY=:99 /home/aefuser/.cache/ms-playwright/chromium-1169/chrome-linux/chrome \
  --no-sandbox \
  --disable-setuid-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --disable-web-security \
  --no-first-run \
  --window-size=1280,720 \
  --window-position=0,0 \
  --start-maximized \
  --kiosk \
  --disable-background-mode \
  --force-device-scale-factor=1 \
  --disable-features=VizDisplayCompositor \
  "data:text/html,<html><head><style>body{margin:0;padding:40px;font-family:system-ui;background:linear-gradient(135deg,#ff6b6b,#4ecdc4);color:white;min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;}h1{font-size:4em;margin:0;text-shadow:3px 3px 6px rgba(0,0,0,0.5);}p{font-size:1.5em;margin:20px 0;opacity:0.9;}</style></head><body><h1>🎯 DIRECT CHROME TEST</h1><p>Resolution: 1280x720</p><p>This is Chrome launched directly</p><p>WITHOUT Stagehand/Playwright</p><p>Does this fill the screen properly?</p></body></html>" &

echo "✅ Direct Chrome launched! Check the VNC viewer now."
echo "Chrome PID: $!"

# Check window info after a delay
sleep 3
echo "📊 Window information:"
DISPLAY=:99 xwininfo -tree -root | grep -i chrome | head -5 