import { EventEmitter } from 'events';
import { BrowserManager } from './BrowserManager';
import { BrowserSession } from './BrowserSession';
import { BrowserSessionConfig, BrowserAction } from './types';
import { StagehandMemoryHooks } from '../memory/StagehandMemoryHooks';
import { BrowserStateCapture } from '../memory/BrowserStateCapture';
import { MemoryManager } from '../memory/MemoryManager';
import { createSupabaseServerClient } from '../supabase-server';

/**
 * HybridBrowserManager extends BrowserManager with memory capture capabilities
 * Integrates browser actions with the memory system for complete execution visibility
 */
export class HybridBrowserManager extends EventEmitter {
  private browserManager: BrowserManager;
  private stagehandMemoryHooks: StagehandMemoryHooks;
  private memoryManager?: MemoryManager;

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
    try {
      // Initialize memory manager with Supabase client
      const supabaseClient = createSupabaseServerClient();
      this.memoryManager = new MemoryManager(supabaseClient);
      console.log('[HybridBrowserManager] Memory manager initialized');
    } catch (error) {
      console.warn('[HybridBrowserManager] Failed to initialize memory manager:', error);
      // Continue without memory manager - graceful degradation
    }
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
   * Execute a browser action with complete memory capture
   */
  public async executeAction(executionId: string, action: BrowserAction): Promise<any> {
    const actionId = `${action.type}_${Date.now()}`;
    const isInternalMemoryCapture = action.stepId?.startsWith('memory-');
    
    // Memory Hook: Action start
    this.stagehandMemoryHooks.onActionStart(
      executionId,
      actionId,
      action.type,
      action.instruction || `${action.type} action`
    );

    try {
      let browserStateBefore: any = undefined;
      let browserStateAfter: any = undefined;
      
      if (!isInternalMemoryCapture) {
        // Capture browser state before action
        browserStateBefore = await this.captureBrowserState(executionId);
      }
      
      // Execute the action
      const result = await this.browserManager.executeAction(executionId, action);
      
      if (!isInternalMemoryCapture) {
        // Capture browser state after action
        browserStateAfter = await this.captureBrowserState(executionId);
      }

      // Memory Hook: Action complete with state capture
      this.stagehandMemoryHooks.onActionComplete(
        executionId,
        actionId,
        {
          action: action,
          result: result,
          browserStateBefore,
          browserStateAfter,
          success: true
        }
      );

      /* ------------------------------------------------------------------
       * Persist memory: Store a minimal MemoryArtifact so that the UI can
       * retrieve something via /api/aef/memory/… endpoints even for the
       * "single-vnc-*" executions that never go through the full
       * ExecutionEngine.
       * ------------------------------------------------------------------ */
      try {
        if (!isInternalMemoryCapture) {
          console.log(`[HybridBrowserManager] Attempting to persist memory for ${executionId}:${action.stepId}`);
          const { createClient } = await import('@supabase/supabase-js');
          
          if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('Missing Supabase environment variables');
          }
          
          const serviceRoleClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          const tempMemoryManager = new MemoryManager(serviceRoleClient);
          
          console.log(`[HybridBrowserManager] Created MemoryManager, calling captureNodeMemory...`);
          // Get current user ID from session
          let userId = 'e68b0753-328b-40f5-adab-92095f359120'; // Fallback to known user
          
          try {
            // Get current user from session
            const supabase = createSupabaseServerClient();
            const { data: { user } } = await supabase.auth.getUser();
            
            if (user?.id) {
              userId = user.id;
              console.log(`[HybridBrowserManager] Using current session user ID: ${userId}`);
            } else {
              console.log(`[HybridBrowserManager] No session user found, using fallback user ID`);
            }
          } catch (err) {
            console.log(`[HybridBrowserManager] Failed to get session user, using fallback:`, err);
          }
          
          await tempMemoryManager.captureNodeMemory(
            executionId,
            action.stepId || 'unknown_step',
            userId,
            {} as any,
            {} as any,
            {
              primaryData: result,
              stateChanges: {},
              executionMetadata: {
                status: 'success',
                duration: 0
              }
            } as any,
            { forwardToNext: [] },
            undefined
          );
          console.log(`[HybridBrowserManager] ✅ Memory artifact persisted successfully for ${executionId}:${action.stepId}`);
        }
      } catch (persistErr) {
        console.error('[HybridBrowserManager] ❌ Failed to persist memory artifact:', persistErr);
        console.error('[HybridBrowserManager] Error details:', {
          executionId,
          stepId: action.stepId,
          error: persistErr instanceof Error ? persistErr.message : 'Unknown error',
          stack: persistErr instanceof Error ? persistErr.stack : undefined
        });
      }

      return result;
    } catch (error) {
      // Memory Hook: Action error
      this.stagehandMemoryHooks.onActionError(
        executionId,
        actionId,
        error instanceof Error ? error.message : 'Unknown action error'
      );
      throw error;
    }
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
        enabled: !!this.memoryManager,
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