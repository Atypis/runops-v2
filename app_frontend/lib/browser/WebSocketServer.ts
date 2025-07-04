import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { parse } from 'url';
import { hybridBrowserManager } from './HybridBrowserManager';
import net from 'net';

export class AEFWebSocketServer {
  private wss: WebSocketServer;
  private server: any;
  private port: number;
  
  constructor(port: number = 3004) {
    this.port = port;
    
    // Create HTTP server for WebSocket upgrades
    this.server = createServer();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });
    
    this.setupWebSocketHandling();
  }
  
  private setupWebSocketHandling() {
    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const { pathname, query } = parse(req.url, true);
      
      console.log(`[WebSocketServer] New connection to ${pathname}`);
      
      // Extract execution ID from URL path
      // Expected format: /ws?executionId=uuid
      const executionId = query.executionId as string;
      
      if (!executionId) {
        console.error('[WebSocketServer] No execution ID provided');
        ws.close(1008, 'Execution ID required');
        return;
      }
      
      // TODO: Add authentication validation here
      // For now, we'll skip auth validation in MVP
      
      // Register the WebSocket connection with browser manager
      hybridBrowserManager.addWebSocketConnection(executionId, ws);
      
      // Handle incoming WebSocket messages
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(ws, executionId, message);
        } catch (error) {
          console.error('[WebSocketServer] Invalid message format:', error);
          ws.send(JSON.stringify({
            type: 'error',
            timestamp: Date.now(),
            data: { error: 'Invalid message format' }
          }));
        }
      });
      
      ws.on('close', () => {
        console.log(`[WebSocketServer] Connection closed for execution ${executionId}`);
        hybridBrowserManager.removeWebSocketConnection(executionId, ws);
      });
      
      ws.on('error', (error) => {
        console.error(`[WebSocketServer] WebSocket error for execution ${executionId}:`, error);
        hybridBrowserManager.removeWebSocketConnection(executionId, ws);
      });
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connection_established',
        timestamp: Date.now(),
        data: { executionId, message: 'WebSocket connected successfully' }
      }));
    });
  }
  
  private handleWebSocketMessage(ws: WebSocket, executionId: string, message: any) {
    console.log(`[WebSocketServer] Received message for ${executionId}:`, message.type);
    
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: Date.now(),
          data: { originalTimestamp: message.timestamp }
        }));
        break;
        
      case 'request_screenshot':
        this.handleScreenshotRequest(ws, executionId);
        break;
        
      case 'request_status':
        this.handleStatusRequest(ws, executionId);
        break;
        
      case 'user_interaction':
        this.handleUserInteraction(ws, executionId, message.data);
        break;
        
      case 'vnc_connect':
        this.handleVncConnection(ws, executionId);
        break;
        
      case 'vnc_disconnect':
        this.handleVncDisconnection(ws, executionId);
        break;
        
      case 'reasoning_subscribe':
        this.handleReasoningSubscription(ws, executionId);
        break;
        
      case 'reasoning_unsubscribe':
        this.handleReasoningUnsubscription(ws, executionId);
        break;
        
      default:
        console.warn(`[WebSocketServer] Unknown message type: ${message.type}`);
        break;
    }
  }
  
  private async handleScreenshotRequest(ws: WebSocket, executionId: string) {
    try {
      const session = hybridBrowserManager.getSessionByExecution(executionId);
      if (!session) {
        ws.send(JSON.stringify({
          type: 'error',
          timestamp: Date.now(),
          data: { error: 'No browser session found' }
        }));
        return;
      }
      
      // Handle different session types
      let screenshot: string;
      let state: any;
      
      if ('takeScreenshot' in session && 'getState' in session) {
        // Local BrowserSession
        const screenshotResult = await session.takeScreenshot();
        screenshot = screenshotResult || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
        state = session.getState();
      } else {
        // Docker container or unknown session type - use placeholder
        screenshot = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
        state = { status: (session as any).status || 'unknown' };
      }
      
      ws.send(JSON.stringify({
        type: 'browser_update',
        timestamp: Date.now(),
        data: { 
          screenshot,
          state
        }
      }));
      
    } catch (error) {
      ws.send(JSON.stringify({
        type: 'error',
        timestamp: Date.now(),
        data: { error: 'Failed to capture screenshot' }
      }));
    }
  }
  
  private handleStatusRequest(ws: WebSocket, executionId: string) {
    const session = hybridBrowserManager.getSessionByExecution(executionId);
    
    let browserState = null;
    if (session && 'getState' in session) {
      browserState = session.getState();
    }
    
    ws.send(JSON.stringify({
      type: 'execution_status',
      timestamp: Date.now(),
      data: {
        executionId,
        sessionExists: !!session,
        sessionStatus: session?.status || 'not_found',
        browserState
      }
    }));
  }

  private async handleUserInteraction(ws: WebSocket, executionId: string, interactionData: any) {
    try {
      console.log(`[WebSocketServer] User interaction for ${executionId}:`, interactionData.type);
      
      const result = await hybridBrowserManager.executeAction(executionId, {
        type: 'act', // Use Stagehand's act method for advanced interactions
        data: interactionData
      });

      ws.send(JSON.stringify({
        type: 'interaction_complete',
        timestamp: Date.now(),
        data: { 
          success: true,
          result,
          interaction: interactionData
        }
      }));

    } catch (error: any) {
      console.error(`[WebSocketServer] User interaction failed:`, error);
      ws.send(JSON.stringify({
        type: 'interaction_error',
        timestamp: Date.now(),
        data: { 
          error: error.message || 'Unknown error',
          interaction: interactionData
        }
      }));
    }
  }

  private async handleVncConnection(ws: WebSocket, executionId: string) {
    console.log(`[WebSocketServer] VNC connection requested for ${executionId}`);
    
    // First try: HybridBrowserManager lookup (for sessions created via start-vnc-environment)
    try {
      const session = hybridBrowserManager.getSessionByExecution(executionId);
      
      console.log(`[WebSocketServer] HybridBrowserManager lookup:`, session ? {
        id: session.id,
        executionId: session.executionId,
        hasVncPort: 'vncPort' in session,
        hasNoVncPort: 'noVncPort' in session,
        vncPort: (session as any).vncPort || 'undefined',
        noVncPort: (session as any).noVncPort || 'undefined'
      } : 'null');
      
      if (session && 'vncPort' in session && 'noVncPort' in session) {
        console.log(`[WebSocketServer] Found session via HybridBrowserManager`);
        const vncUrl = `http://localhost:${(session as any).noVncPort}/vnc.html`;
        
        ws.send(JSON.stringify({
          type: 'vnc_ready',
          timestamp: Date.now(),
          data: { 
            vncUrl: vncUrl,
            vncPort: (session as any).vncPort,
            noVncPort: (session as any).noVncPort,
            message: 'Live VNC connection to browser automation'
          }
        }));
        return;
      }
    } catch (error) {
      console.warn(`[WebSocketServer] HybridBrowserManager lookup failed:`, (error as Error).message);
    }
    
    // Second try: Check Supabase database for sessions created via /api/aef/session
    console.log(`[WebSocketServer] Checking Supabase for session: ${executionId}`);
    try {
      const response = await fetch('http://localhost:3000/api/aef/session', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        const sessionData = await response.json();
        
        if (sessionData.status === 'active_session' && sessionData.session) {
          const dbSession = sessionData.session;
          console.log(`[WebSocketServer] Found session in database:`, {
            executionId: dbSession.executionId,
            vncUrl: dbSession.vncUrl,
            apiUrl: dbSession.apiUrl
          });
          
          // Extract port from VNC URL (e.g., "http://localhost:16080" -> 16080)
          const vncPortMatch = dbSession.vncUrl?.match(/localhost:(\d+)/);
          const vncPort = vncPortMatch ? parseInt(vncPortMatch[1]) : null;
          
          if (vncPort) {
            const vncUrl = `http://localhost:${vncPort}/vnc.html`;
            console.log(`[WebSocketServer] Sending database VNC URL: ${vncUrl}`);
            
            ws.send(JSON.stringify({
              type: 'vnc_ready',
              timestamp: Date.now(),
              data: { 
                vncUrl: vncUrl,
                vncPort: vncPort - 1000, // VNC protocol port (noVNC port - 1000)
                noVncPort: vncPort,
                message: 'Live VNC connection from database session'
              }
            }));
            return;
          }
        }
      }
    } catch (dbError) {
      console.warn(`[WebSocketServer] Database session lookup failed:`, (dbError as Error).message);
    }
    
    // Third try: Enhanced fallback - check all running containers for VNC ports
    console.log(`[WebSocketServer] Session not found via browserManager or database, checking Docker containers directly...`);
    
    // Try common VNC ports based on our allocation scheme
    const testPorts = [16080, 16081, 16082, 16083, 16084];
    
    // Test each port to see if it's responding
    Promise.all(testPorts.map(async (port) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1000);
        
        const response = await fetch(`http://localhost:${port}/vnc.html`, { 
          method: 'HEAD',
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        return response.ok ? port : null;
      } catch {
        return null;
      }
    })).then(results => {
      const workingPort = results.find(port => port !== null);
      
      if (workingPort) {
        console.log(`[WebSocketServer] Found working VNC port: ${workingPort}`);
        ws.send(JSON.stringify({
          type: 'vnc_ready',
          timestamp: Date.now(),
          data: { 
            vncUrl: `http://localhost:${workingPort}/vnc.html`,
            vncPort: workingPort - 180, // Estimate VNC port (noVNC port - 180)
            noVncPort: workingPort,
            message: 'VNC connection to available container'
          }
        }));
      } else {
        console.log(`[WebSocketServer] No working VNC ports found`);
        ws.send(JSON.stringify({
          type: 'vnc_fallback',
          timestamp: Date.now(),
          data: { 
            message: 'No VNC containers available'
          }
        }));
      }
    }).catch(error => {
      console.error(`[WebSocketServer] Error testing VNC ports:`, error);
      ws.send(JSON.stringify({
        type: 'vnc_error',
        timestamp: Date.now(),
        data: { 
          error: 'Failed to find VNC connection'
        }
      }));
    });
  }

  private handleVncDisconnection(ws: WebSocket, executionId: string) {
    console.log(`[WebSocketServer] VNC disconnection requested for ${executionId}`);
    
    ws.send(JSON.stringify({
      type: 'vnc_disconnected',
      timestamp: Date.now(),
      data: { 
        executionId,
        message: 'VNC connection closed'
      }
    }));
  }
  
  private handleReasoningSubscription(ws: WebSocket, executionId: string) {
    console.log(`[WebSocketServer] Reasoning subscription for execution ${executionId}`);
    
    ws.send(JSON.stringify({
      type: 'reasoning_subscribed',
      timestamp: Date.now(),
      data: { 
        executionId,
        message: 'Subscribed to reasoning updates'
      }
    }));
  }
  
  private handleReasoningUnsubscription(ws: WebSocket, executionId: string) {
    console.log(`[WebSocketServer] Reasoning unsubscription for execution ${executionId}`);
    
    ws.send(JSON.stringify({
      type: 'reasoning_unsubscribed',
      timestamp: Date.now(),
      data: { 
        executionId,
        message: 'Unsubscribed from reasoning updates'
      }
    }));
  }
  
  // Public method to broadcast reasoning updates
  public broadcastReasoningUpdate(executionId: string, data: {
    type: 'reasoning_start' | 'reasoning_delta' | 'reasoning_complete';
    text?: string;
    nodeId?: string;
    stage?: string;
  }) {
    console.log(`[WebSocketServer] Broadcasting reasoning update for ${executionId}: ${data.type}`);
    
    hybridBrowserManager.broadcastToExecution(executionId, {
      type: 'reasoning_update',
      timestamp: Date.now(),
      data
    });
  }

  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, (error: any) => {
        if (error) {
          reject(error);
        } else {
          console.log(`[WebSocketServer] Started on ws://localhost:${this.port}/ws`);
          resolve();
        }
      });
    });
  }
  
  public stop(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => {
          console.log('[WebSocketServer] Stopped');
          resolve();
        });
      });
    });
  }
  
  public getStats() {
    return {
      port: this.port,
      connections: this.wss.clients.size,
      browserManagerStats: hybridBrowserManager.getStats()
    };
  }
}

// Export singleton instance
export const wsServer = new AEFWebSocketServer(); 