import { BrowserSession } from './BrowserSession';
import { BrowserSessionConfig, BrowserAction, WebSocketMessage } from './types';
import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';

export class BrowserManager extends EventEmitter {
  private sessions: Map<string, BrowserSession> = new Map();
  private wsConnections: Map<string, Set<WebSocket>> = new Map();
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    super();
    
    // Cleanup idle sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleSessions();
    }, 5 * 60 * 1000);
  }
  
  public async createSession(config: BrowserSessionConfig): Promise<BrowserSession> {
    console.log(`[BrowserManager] Creating session for execution ${config.executionId}`);
    
    // Close any existing session for this execution
    const existingSessionId = this.findSessionByExecution(config.executionId);
    if (existingSessionId) {
      await this.destroySession(existingSessionId);
    }
    
    const session = new BrowserSession(config);
    this.sessions.set(session.id, session);
    
    // Setup event handlers
    session.on('ready', (state) => {
      this.broadcastToExecution(config.executionId, {
        type: 'browser_update',
        timestamp: Date.now(),
        data: { status: 'ready', state }
      });
    });
    
    session.on('screenshot', (data) => {
      this.broadcastToExecution(config.executionId, {
        type: 'browser_update',
        timestamp: Date.now(),
        data: { screenshot: data.screenshot, timestamp: data.timestamp }
      });
    });
    
    session.on('action_complete', (result) => {
      this.broadcastToExecution(config.executionId, {
        type: 'action_complete',
        timestamp: Date.now(),
        data: result
      });
    });
    
    session.on('action_error', (data) => {
      this.broadcastToExecution(config.executionId, {
        type: 'error',
        timestamp: Date.now(),
        data: { action: data.action, error: data.error.message }
      });
    });
    
    session.on('error', (error) => {
      this.broadcastToExecution(config.executionId, {
        type: 'error',
        timestamp: Date.now(),
        data: { error: error.message }
      });
    });
    
    session.on('closed', () => {
      this.sessions.delete(session.id);
      this.broadcastToExecution(config.executionId, {
        type: 'execution_status',
        timestamp: Date.now(),
        data: { status: 'session_closed' }
      });
    });
    
    console.log(`[BrowserManager] Session ${session.id} created successfully`);
    return session;
  }
  
  public getSession(sessionId: string): BrowserSession | undefined {
    return this.sessions.get(sessionId);
  }
  
  public getSessionByExecution(executionId: string): BrowserSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.executionId === executionId) {
        return session;
      }
    }
    return undefined;
  }
  
  private findSessionByExecution(executionId: string): string | undefined {
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.executionId === executionId) {
        return sessionId;
      }
    }
    return undefined;
  }
  
  public async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    console.log(`[BrowserManager] Destroying session ${sessionId}`);
    await session.close();
    this.sessions.delete(sessionId);
  }
  
  public async executeAction(executionId: string, action: BrowserAction): Promise<any> {
    const session = this.getSessionByExecution(executionId);
    if (!session) {
      // Fallback: Use SingleVNCSessionManager for Docker-based single VNC sessions
      if (executionId.startsWith('single-vnc-')) {
        try {
          const { singleVNCSessionManager } = await import('../vnc/SingleVNCSessionManager');
          // Ensure session is ready
          const isReady = await singleVNCSessionManager.isSessionReady();
          if (!isReady) {
            throw new Error('Single VNC session not ready');
          }
          // Execute action via SingleVNCSessionManager API proxy
          const result = await singleVNCSessionManager.executeAction(action);
          return result;
        } catch (fallbackError) {
          throw new Error(`No browser session found for execution ${executionId} and fallback failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
        }
      }
      throw new Error(`No browser session found for execution ${executionId}`);
    }
    
    return await session.executeAction(action);
  }
  
  public addWebSocketConnection(executionId: string, ws: WebSocket): void {
    if (!this.wsConnections.has(executionId)) {
      this.wsConnections.set(executionId, new Set());
    }
    
    this.wsConnections.get(executionId)!.add(ws);
    
    ws.on('close', () => {
      this.removeWebSocketConnection(executionId, ws);
    });
    
    // Send current state immediately
    const session = this.getSessionByExecution(executionId);
    if (session) {
      const message: WebSocketMessage = {
        type: 'browser_update',
        timestamp: Date.now(),
        data: { state: session.getState(), status: session.status }
      };
      
      this.sendToWebSocket(ws, message);
    }
    
    console.log(`[BrowserManager] WebSocket connected for execution ${executionId}`);
  }
  
  public removeWebSocketConnection(executionId: string, ws: WebSocket): void {
    const connections = this.wsConnections.get(executionId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.wsConnections.delete(executionId);
      }
    }
  }
  
  private broadcastToExecution(executionId: string, message: WebSocketMessage): void {
    const connections = this.wsConnections.get(executionId);
    if (!connections) return;
    
    for (const ws of connections) {
      this.sendToWebSocket(ws, message);
    }
  }
  
  private sendToWebSocket(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[BrowserManager] WebSocket send error:', error);
      }
    }
  }
  
  private cleanupIdleSessions(): void {
    const idleSessions: string[] = [];
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.isIdle()) {
        idleSessions.push(sessionId);
      }
    }
    
    if (idleSessions.length > 0) {
      console.log(`[BrowserManager] Cleaning up ${idleSessions.length} idle sessions`);
      idleSessions.forEach(sessionId => {
        this.destroySession(sessionId);
      });
    }
  }
  
  public getStats() {
    return {
      activeSessions: this.sessions.size,
      activeConnections: Array.from(this.wsConnections.values())
        .reduce((total, connections) => total + connections.size, 0),
      sessions: Array.from(this.sessions.values()).map(session => ({
        id: session.id,
        executionId: session.executionId,
        status: session.status,
        userId: session.userId
      }))
    };
  }
  
  public async shutdown(): Promise<void> {
    console.log('[BrowserManager] Shutting down...');
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    // Close all sessions
    const closePromises = Array.from(this.sessions.keys()).map(sessionId => 
      this.destroySession(sessionId)
    );
    
    await Promise.all(closePromises);
    
    // Close all WebSocket connections
    for (const connections of this.wsConnections.values()) {
      for (const ws of connections) {
        ws.close();
      }
    }
    
    this.wsConnections.clear();
    console.log('[BrowserManager] Shutdown complete');
  }
}

// Singleton instance
export const browserManager = new BrowserManager(); 