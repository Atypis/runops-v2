import { EventEmitter } from 'events';
import { BrowserManager } from './BrowserManager';
import { BrowserSession } from './BrowserSession';
import { BrowserSessionConfig, BrowserAction } from './types';
import { StagehandMemoryHooks } from '../memory/StagehandMemoryHooks';
import { BrowserStateCapture } from '../memory/BrowserStateCapture';

/**
 * HybridBrowserManager extends BrowserManager with memory capture capabilities
 * Integrates browser actions with the memory system for complete execution visibility
 */
export class HybridBrowserManager extends EventEmitter {
  private browserManager: BrowserManager;
  private stagehandMemoryHooks: StagehandMemoryHooks;

  constructor() {
    super();
    this.browserManager = new BrowserManager();
    this.stagehandMemoryHooks = new StagehandMemoryHooks();
    this.initializeMemoryManager();

    // Forward events from the underlying browser manager
    this.browserManager.on('session_created', (session) => {
      this.emit('session_created', session);
    });

    this.browserManager.on('session_destroyed', (sessionId) => {
      this.emit('session_destroyed', sessionId);
    });
  }

  private async initializeMemoryManager(): Promise<void> {
    // Memory management is now handled by ExecutionEngine
    console.log('[HybridBrowserManager] Memory management delegated to ExecutionEngine');
  }

  /**
   * Create a new browser session with memory tracking
   */
  public async createSession(config: BrowserSessionConfig): Promise<BrowserSession> {
    console.log(`[HybridBrowserManager] Creating session for execution ${config.executionId}`);
    
    // Memory Hook: Session creation start
    this.stagehandMemoryHooks.onActionStart(
      config.executionId,
      'session_create',
      'create_session',
      `Creating browser session for execution ${config.executionId}`
    );

    try {
      const session = await this.browserManager.createSession(config);
      
      // Memory Hook: Session creation complete
      this.stagehandMemoryHooks.onActionComplete(
        config.executionId,
        'session_create',
        {
          sessionId: session.id,
          executionId: config.executionId,
          success: true
        }
      );

      console.log(`[HybridBrowserManager] Session ${session.id} created with memory tracking`);
      return session;
    } catch (error) {
      // Memory Hook: Session creation error
      this.stagehandMemoryHooks.onActionError(
        config.executionId,
        'session_create',
        error instanceof Error ? error.message : 'Unknown session creation error'
      );
      throw error;
    }
  }

  /**
   * Execute a browser action (DEPRECATED - use ExecutionEngine instead)
   * This method is kept for backward compatibility but should not be used for new code
   */
  public async executeAction(executionId: string, action: BrowserAction): Promise<any> {
    console.warn('[HybridBrowserManager] executeAction is deprecated - use ExecutionEngine instead');
    
    // Simple passthrough to BrowserManager without memory capture
    // Memory capture is now handled by ExecutionEngine
    return await this.browserManager.executeAction(executionId, action);
  }

  /**
   * Get browser session by execution ID
   */
  public getSessionByExecution(executionId: string): BrowserSession | undefined {
    return this.browserManager.getSessionByExecution(executionId);
  }

  /**
   * Get browser session by session ID
   */
  public getSession(sessionId: string): BrowserSession | undefined {
    return this.browserManager.getSession(sessionId);
  }

  /**
   * Destroy session by execution ID with memory tracking
   */
  public async destroySessionByExecution(executionId: string): Promise<void> {
    console.log(`[HybridBrowserManager] Destroying session for execution ${executionId}`);
    
    const session = this.getSessionByExecution(executionId);
    if (!session) {
      console.log(`[HybridBrowserManager] No session found for execution ${executionId}`);
      return;
    }

    // Memory Hook: Session destruction start
    this.stagehandMemoryHooks.onActionStart(
      executionId,
      'session_destroy',
      'destroy_session',
      `Destroying browser session ${session.id}`
    );

    try {
      await this.browserManager.destroySession(session.id);
      
      // Memory Hook: Session destruction complete
      this.stagehandMemoryHooks.onActionComplete(
        executionId,
        'session_destroy',
        {
          sessionId: session.id,
          executionId,
          success: true
        }
      );

      console.log(`[HybridBrowserManager] Session destroyed for execution ${executionId}`);
    } catch (error) {
      // Memory Hook: Session destruction error
      this.stagehandMemoryHooks.onActionError(
        executionId,
        'session_destroy',
        error instanceof Error ? error.message : 'Unknown session destruction error'
      );
      throw error;
    }
  }

  /**
   * Destroy session by session ID
   */
  public async destroySession(sessionId: string): Promise<void> {
    await this.browserManager.destroySession(sessionId);
  }

  /**
   * Add WebSocket connection for real-time updates
   */
  public addWebSocketConnection(executionId: string, ws: any): void {
    this.browserManager.addWebSocketConnection(executionId, ws);
  }

  /**
   * Remove WebSocket connection
   */
  public removeWebSocketConnection(executionId: string, ws: any): void {
    this.browserManager.removeWebSocketConnection(executionId, ws);
  }

  /**
   * Get browser manager statistics
   */
  public getStats() {
    const baseStats = this.browserManager.getStats();
    return {
      ...baseStats,
      memoryTracking: {
        enabled: false, // Memory tracking now handled by ExecutionEngine
        stagehandHooksActive: true
      }
    };
  }

     /**
    * Get execution trace from memory hooks
    */
   public getExecutionTrace(executionId: string) {
     return this.stagehandMemoryHooks.getExecutionTrace(executionId);
   }

   /**
    * Capture current browser state for memory tracking
    */
   private async captureBrowserState(executionId: string): Promise<any> {
     try {
       const [domSnapshot, currentUrl, sessionState] = await Promise.all([
         BrowserStateCapture.getDOMSnapshot(executionId),
         BrowserStateCapture.getCurrentUrl(executionId),
         BrowserStateCapture.getSessionState(executionId)
       ]);

       return {
         domSnapshot,
         currentUrl,
         sessionState,
         timestamp: Date.now()
       };
     } catch (error) {
       console.warn('[HybridBrowserManager] Failed to capture browser state:', error);
       return {
         error: error instanceof Error ? error.message : 'Unknown error',
         timestamp: Date.now()
       };
     }
   }

  /**
   * Shutdown the hybrid browser manager
   */
  public async shutdown(): Promise<void> {
    console.log('[HybridBrowserManager] Shutting down...');
    await this.browserManager.shutdown();
  }
}

// Export singleton instance
export const hybridBrowserManager = new HybridBrowserManager(); 