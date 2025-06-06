# AEF Browser Container
# Isolated browser environment for AEF workflow automation
# Based on browser-use but optimized for Stagehand + AEF requirements

FROM node:18-slim

LABEL name="aef-browser" \
    maintainer="AEF Team" \
    description="Isolated browser environment for AEF workflow automation"

# Environment setup
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    DISPLAY=:99 \
    SCREEN_WIDTH=1280 \
    SCREEN_HEIGHT=720 \
    SCREEN_DEPTH=24 \
    XVFB_WHD=${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH}

# Install system dependencies including xdpyinfo for X server checking
RUN apt-get update && apt-get install -y \
    # Browser dependencies
    wget gnupg ca-certificates \
    fonts-liberation libappindicator3-1 libasound2 libatk-bridge2.0-0 \
    libdrm2 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxss1 libgtk-3-0 \
    # Playwright dependencies (corrected package names for Debian Bookworm)
    libwoff1 libopus0 libwebp7 libwebpdemux2 libenchant-2-2 libgudev-1.0-0 \
    libsecret-1-0 libhyphen0 libgdk-pixbuf2.0-0 libegl1 libnotify4 \
    libxslt1.1 libevent-2.1-7 libgles2 libvpx7 \
    # System Chromium browser
    chromium \
    # Virtual display for headless operation
    xvfb \
    # X11 utilities for checking display readiness
    x11-utils \
    # VNC server for live streaming
    x11vnc \
    # noVNC for WebSocket-to-VNC bridge
    novnc websockify \
    # Process management
    supervisor \
    # Debugging tools
    curl procps \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r aefuser && useradd -r -g aefuser -G audio,video aefuser \
    && mkdir -p /home/aefuser/Downloads /app \
    && chown -R aefuser:aefuser /home/aefuser /app

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm install --omit=dev && npm cache clean --force

# Copy application code
COPY . .

# Change ownership before installing browsers
RUN chown -R aefuser:aefuser /app

# Install Playwright browsers as aefuser
USER aefuser

# Set HOME environment variable for aefuser
ENV HOME=/home/aefuser

# Install Playwright browsers with explicit home directory
RUN npx playwright install chromium

# Verify Playwright installation
RUN npx playwright --version && \
    ls -la ~/.cache/ms-playwright/

# Switch back to root for system dependencies and supervisor setup
USER root

# Install Playwright system dependencies as root
RUN npx playwright install-deps chromium

# Create supervisor configuration with environment variables support
RUN echo '[supervisord]' > /etc/supervisor/conf.d/supervisord.conf && \
    echo 'nodaemon=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'user=root' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:xvfb]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=Xvfb :99 -screen 0 %(ENV_SCREEN_WIDTH)sx%(ENV_SCREEN_HEIGHT)sx%(ENV_SCREEN_DEPTH)s -ac +extension GLX +render -noreset' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'user=root' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'priority=100' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/xvfb.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/xvfb.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:vnc]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=x11vnc -display :99 -nopw -listen 0.0.0.0 -xkb -ncache 10 -ncache_cr -forever -shared' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'user=root' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'priority=200' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/vnc.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/vnc.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:websockify]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=websockify --web=/usr/share/novnc/ 6080 localhost:5900' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'user=root' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'priority=300' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/websockify.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/websockify.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:aef-browser]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=node browser-server.js' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'user=aefuser' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'directory=/app' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'environment=HOME="/home/aefuser",DISPLAY=":99",ANTHROPIC_API_KEY="%(ENV_ANTHROPIC_API_KEY)s"' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'priority=400' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/aef-browser.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/aef-browser.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo '[program:auto-init]' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'command=sh -c "sleep 15 && curl -X POST http://localhost:3000/init -H \"Content-Type: application/json\" || true"' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'user=root' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autostart=true' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'autorestart=false' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'priority=500' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'startsecs=0' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stdout_logfile=/var/log/auto-init.log' >> /etc/supervisor/conf.d/supervisord.conf && \
    echo 'stderr_logfile=/var/log/auto-init.log' >> /etc/supervisor/conf.d/supervisord.conf

# Set ownership and create X11 socket directory
RUN chown -R aefuser:aefuser /app && \
    mkdir -p /tmp/.X11-unix && \
    chmod 1777 /tmp/.X11-unix

# Expose ports for browser communication and VNC
EXPOSE 3000 5900 6080

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
    CMD curl -f http://localhost:3000/health || exit 1

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"] 