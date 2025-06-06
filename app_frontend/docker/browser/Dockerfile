# AEF Browser Container
# Isolated browser environment for AEF workflow automation
# Based on browser-use but optimized for Stagehand + AEF requirements

# Use debian bookworm for better compatibility
FROM debian:bookworm-slim

LABEL name="aef-browser" \
    maintainer="AEF Team" \
    description="Isolated browser environment for AEF workflow automation"

# Environment setup
ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC \
    DISPLAY=:1 \
    SCREEN_WIDTH=1280 \
    SCREEN_HEIGHT=720 \
    SCREEN_DEPTH=24 \
    XVFB_WHD=${SCREEN_WIDTH}x${SCREEN_HEIGHT}x${SCREEN_DEPTH}

# Install system dependencies including TigerVNC instead of x11vnc
RUN apt-get update && apt-get install -y \
    # TigerVNC server with dynamic resolution support
    tigervnc-standalone-server \
    tigervnc-tools \
    # X11 and window manager
    xfonts-base \
    xfonts-75dpi \
    xfonts-100dpi \
    x11-utils \
    fluxbox \
    # noVNC and websockify for web client
    novnc \
    python3-websockify \
    # Playwright browser dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxdamage1 \
    libasound2 \
    libxcomposite1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libgtk-3-0 \
    # Utilities and tools
    wget \
    curl \
    netcat-openbsd \
    supervisor \
    # Node.js for browser automation
    nodejs \
    npm \
    # Clean up
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create aefuser
RUN useradd -m -s /bin/bash aefuser \
    && mkdir -p /home/aefuser/.vnc \
    && mkdir -p /home/aefuser/.fluxbox \
    && chown -R aefuser:aefuser /home/aefuser

# Install Playwright and dependencies
USER aefuser
WORKDIR /home/aefuser

# Install Playwright
RUN npm init -y \
    && npm install playwright @browserbasehq/stagehand anthropic

# Install Playwright Chromium
RUN npx playwright install chromium

# Set up VNC password and permissions
USER root
RUN echo "aefuser" | vncpasswd -f > /home/aefuser/.vnc/passwd \
    && chmod 600 /home/aefuser/.vnc/passwd \
    && chown -R aefuser:aefuser /home/aefuser/.vnc \
    && touch /home/aefuser/.Xauthority \
    && chown aefuser:aefuser /home/aefuser/.Xauthority

# Configure TigerVNC for dynamic resolution
COPY --chown=aefuser:aefuser vnc-startup.sh /home/aefuser/.vnc/xstartup
RUN chmod +x /home/aefuser/.vnc/xstartup

# Configure fluxbox
COPY --chown=aefuser:aefuser fluxbox-init /home/aefuser/.fluxbox/init
COPY --chown=aefuser:aefuser fluxbox-apps /home/aefuser/.fluxbox/apps

# Copy application files
COPY --chown=aefuser:aefuser browser-server.js /home/aefuser/
COPY --chown=aefuser:aefuser package.json /home/aefuser/

# Install Node.js dependencies
USER aefuser
RUN npm install

# Copy supervisor configuration for TigerVNC
USER root
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Create websockify script for noVNC compatibility
COPY websockify-wrapper.sh /usr/local/bin/websockify-wrapper.sh
RUN chmod +x /usr/local/bin/websockify-wrapper.sh

# websockify already installed above

# Expose VNC port and WebSocket port
EXPOSE 5900 6080

# Set environment variables for TigerVNC
ENV DISPLAY=:1
ENV VNC_RESOLUTION=1280x720
ENV VNC_COL_DEPTH=24
ENV VNC_DPI=96

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"] 