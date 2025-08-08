import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { singleVNCSessionManager } from './SingleVNCSessionManager';

export class SimpleVNCWebSocket {
  private wss: WebSocketServer;
  private server: any;
  private port: number = 3004;
  private connections: Set<WebSocket> = new Set();
  
  constructor(port: number = 3004) {
    this.port = port;
    this.server = createServer();
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });
    
    this.setupWebSocketHandling();
  }
  
  private setupWebSocketHandling(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[SimpleVNCWebSocket] New WebSocket connection');
      
      this.connections.add(ws);
      
      // Send current VNC status immediately
      this.sendVNCStatus(ws);
      
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, message);
        } catch (error) {
          console.error('[SimpleVNCWebSocket] Message parse error:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });
      
      ws.on('close', () => {
        console.log('[SimpleVNCWebSocket] WebSocket connection closed');
        this.connections.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error('[SimpleVNCWebSocket] WebSocket error:', error);
        this.connections.delete(ws);
      });
    });
  }
  
  private async handleMessage(ws: WebSocket, message: any): Promise<void> {
    console.log('[SimpleVNCWebSocket] Received message:', message.type);
    
    switch (message.type) {
      case 'vnc_connect':
        await this.handleVNCConnect(ws);
        break;
        
      case 'ping':
        this.sendMessage(ws, { type: 'pong', timestamp: Date.now() });
        break;
        
      default:
        console.warn('[SimpleVNCWebSocket] Unknown message type:', message.type);
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }
  
  private async handleVNCConnect(ws: WebSocket): Promise<void> {
    console.log('[SimpleVNCWebSocket] VNC connection requested');
    
    const session = singleVNCSessionManager.getCurrentSession();
    
    if (!session) {
      console.log('[SimpleVNCWebSocket] No VNC session active');
      this.sendMessage(ws, {
        type: 'vnc_error',
        timestamp: Date.now(),
        data: { 
          error: 'No VNC session active',
          message: 'Please start a VNC session first'
        }
      });
      return;
    }
    
    const isReady = await singleVNCSessionManager.isSessionReady();
    
    if (!isReady) {
      console.log('[SimpleVNCWebSocket] VNC session not ready yet');
      this.sendMessage(ws, {
        type: 'vnc_starting',
        timestamp: Date.now(),
        data: { 
          message: 'VNC session is starting...',
          sessionId: session.id
        }
      });
      return;
    }
    
    // Session is ready - send VNC URL
    const vncUrl = singleVNCSessionManager.getVNCUrl();
    console.log(`[SimpleVNCWebSocket] Sending VNC URL: ${vncUrl}`);
    
    this.sendMessage(ws, {
      type: 'vnc_ready',
      timestamp: Date.now(),
      data: { 
        vncUrl: vncUrl,
        sessionId: session.id,
        ports: session.ports,
        message: 'VNC connection ready'
      }
    });
  }
  
  private async sendVNCStatus(ws: WebSocket): Promise<void> {
    const session = singleVNCSessionManager.getCurrentSession();
    
    if (!session) {
      this.sendMessage(ws, {
        type: 'vnc_status',
        timestamp: Date.now(),
        data: { 
          status: 'no_session',
          message: 'No VNC session active'
        }
      });
      return;
    }
    
    const isReady = await singleVNCSessionManager.isSessionReady();
    
    this.sendMessage(ws, {
      type: 'vnc_status',
      timestamp: Date.now(),
      data: { 
        status: isReady ? 'ready' : 'starting',
        sessionId: session.id,
        vncUrl: isReady ? singleVNCSessionManager.getVNCUrl() : null,
        ports: session.ports,
        message: isReady ? 'VNC session ready' : 'VNC session starting...'
      }
    });
  }
  
  private sendMessage(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[SimpleVNCWebSocket] Send error:', error);
      }
    }
  }
  
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      timestamp: Date.now(),
      data: { error }
    });
  }
  
  /**
   * Broadcast message to all connected clients
   */
  public broadcast(message: any): void {
    console.log(`[SimpleVNCWebSocket] Broadcasting to ${this.connections.size} connections`);
    
    for (const ws of this.connections) {
      this.sendMessage(ws, message);
    }
  }
  
  /**
   * Start the WebSocket server
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error?: Error) => {
        if (error) {
          reject(error);
        } else {
          console.log(`[SimpleVNCWebSocket] ✅ Server listening on port ${this.port}`);
          resolve();
        }
      });
    });
  }
  
  /**
   * Stop the WebSocket server
   */
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all connections
      for (const ws of this.connections) {
        ws.close();
      }
      this.connections.clear();
      
      // Close server
      this.wss.close(() => {
        this.server.close(() => {
          console.log('[SimpleVNCWebSocket] ✅ Server stopped');
          resolve();
        });
      });
    });
  }
  
  /**
   * Get connection count
   */
  public getConnectionCount(): number {
    return this.connections.size;
  }
}

// Export singleton instance
export const simpleVNCWebSocket = new SimpleVNCWebSocket(); 