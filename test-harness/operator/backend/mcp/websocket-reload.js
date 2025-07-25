import WebSocket from 'ws';

export class WebSocketReloader {
  constructor(mcpServer, port = 8765) {
    this.mcpServer = mcpServer;
    this.ws = null;
    this.reconnectInterval = null;
    this.port = port;
  }

  connect() {
    try {
      this.ws = new WebSocket(`ws://localhost:${this.port}/mcp-reload`);

      this.ws.on('open', () => {
        console.error('[WS-RELOAD] Connected to reload server');
        if (this.reconnectInterval) {
          clearInterval(this.reconnectInterval);
          this.reconnectInterval = null;
        }
      });

      this.ws.on('message', async (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'reload') {
          console.error(`[WS-RELOAD] Reloading module: ${message.module}`);
          await this.mcpServer.reloadModule(message.module);
        } else if (message.type === 'restart-browser') {
          console.error('[WS-RELOAD] Restarting browser context');
          await this.mcpServer.restartBrowser();
        }
      });

      this.ws.on('close', () => {
        console.error('[WS-RELOAD] Disconnected from reload server');
        this.reconnect();
      });

      this.ws.on('error', (error) => {
        console.error('[WS-RELOAD] WebSocket error:', error.message);
      });
    } catch (error) {
      console.error('[WS-RELOAD] Failed to connect:', error);
      this.reconnect();
    }
  }

  reconnect() {
    if (!this.reconnectInterval) {
      this.reconnectInterval = setInterval(() => {
        console.error('[WS-RELOAD] Attempting to reconnect...');
        this.connect();
      }, 5000);
    }
  }

  close() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
}