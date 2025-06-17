import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface VNCSession {
  id: string;
  containerId: string;
  status: 'creating' | 'ready' | 'error';
  createdAt: Date;
  ports: {
    api: 13000;
    vnc: 15900;
    noVNC: 16080;
  };
}

export class SingleVNCSessionManager {
  private static instance: SingleVNCSessionManager;
  private currentSession: VNCSession | null = null;
  
  // FIXED PORTS - No dynamic allocation, no confusion
  private readonly FIXED_API_PORT = 13000;
  private readonly FIXED_VNC_PORT = 15900; 
  private readonly FIXED_NOVNC_PORT = 16080;
  
  // Single container name pattern - always the same
  private readonly CONTAINER_NAME = 'aef-vnc-single';
  private readonly IMAGE_NAME = 'aef-browser:latest';
  
  private constructor() {}
  
  static getInstance(): SingleVNCSessionManager {
    if (!this.instance) {
      this.instance = new SingleVNCSessionManager();
    }
    return this.instance;
  }
  
  /**
   * Get current session (if any)
   */
  getCurrentSession(): VNCSession | null {
    return this.currentSession;
  }
  
  /**
   * Create a new VNC session - ALWAYS destroys existing session first
   */
  async createSession(): Promise<VNCSession> {
    console.log('[SingleVNCSessionManager] Creating new VNC session...');
    
    try {
      // Step 1: FORCE CLEANUP (always, no exceptions)
      await this.forceDestroyCurrentSession();
      
      // Step 2: VERIFY CLEAN STATE
      await this.verifyNoOrphanedResources();
      
      // Step 3: CREATE ATOMICALLY
      const session = await this.atomicSessionCreation();
      
      // Step 4: VERIFY SUCCESS
      await this.verifySessionReady(session);
      
      this.currentSession = session;
      console.log(`[SingleVNCSessionManager] ✅ Session created: ${session.id}`);
      return session;
      
    } catch (error) {
      console.error('[SingleVNCSessionManager] ❌ Session creation failed:', error);
      throw new Error(`Failed to create VNC session: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Destroy current session completely
   */
  async destroySession(): Promise<void> {
    console.log('[SingleVNCSessionManager] Destroying current session...');
    await this.forceDestroyCurrentSession();
    console.log('[SingleVNCSessionManager] ✅ Session destroyed');
  }
  
  /**
   * Check if current session is healthy and ready - WITH AUTO-RECOVERY
   */
  async isSessionReady(): Promise<boolean> {
    console.log('[SingleVNCSessionManager] 🔍 Checking session health...');
    
    // If no tracked session, try to discover existing container
    if (!this.currentSession) {
      console.log('[SingleVNCSessionManager] No tracked session, checking for existing container...');
      await this.attemptSessionRecovery();
    }
    
    if (!this.currentSession) {
      console.log('[SingleVNCSessionManager] No session available');
      return false;
    }
    
    try {
      // Check container status
      const containerStatus = await this.getContainerStatus();
      console.log(`[SingleVNCSessionManager] Container status: ${containerStatus}`);
      
      if (containerStatus !== 'running') {
        console.log('[SingleVNCSessionManager] Container not running, attempting recovery...');
        await this.attemptSessionRecovery();
        return this.currentSession !== null;
      }
      
      // Check API endpoint health
      console.log('[SingleVNCSessionManager] Checking API health...');
      const response = await fetch(`http://localhost:${this.FIXED_API_PORT}/health`, {
        signal: AbortSignal.timeout(3000)
      });
      
      const isHealthy = response.ok;
      console.log(`[SingleVNCSessionManager] API health: ${isHealthy}`);
      
      if (!isHealthy) {
        console.log('[SingleVNCSessionManager] API unhealthy, session needs recovery');
        this.currentSession = null; // Mark for recovery
      }
      
      return isHealthy;
    } catch (error) {
      console.log(`[SingleVNCSessionManager] Health check failed: ${error}`);
      this.currentSession = null; // Mark for recovery
      return false;
    }
  }
  
  /**
   * Get VNC URL (always the same)
   */
  getVNCUrl(): string {
    return `http://localhost:${this.FIXED_NOVNC_PORT}/vnc.html`;
  }
  
  /**
   * Execute action in current session
   */
  async executeAction(action: any): Promise<any> {
    // Ensure we have an active (or recovered) session before executing the action
    if (!this.currentSession) {
      // Attempt auto-recovery (handles Next.js hot-reload module duplication)
      const recovered = await this.isSessionReady();
      if (!recovered || !this.currentSession) {
        throw new Error('No active VNC session');
      }
    }
    
    if (!(await this.isSessionReady())) {
      throw new Error('VNC session not ready');
    }
    
    const response = await fetch(`http://localhost:${this.FIXED_API_PORT}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Action execution failed');
    }
    
    return await response.json();
  }
  
  // PRIVATE IMPLEMENTATION METHODS
  
  /**
   * Attempt to recover/discover existing VNC session from running container
   */
  private async attemptSessionRecovery(): Promise<void> {
    console.log('[SingleVNCSessionManager] 🔄 Attempting session recovery...');
    
    try {
      // Check if our fixed container is already running
      const containerStatus = await this.getContainerStatus();
      
      if (containerStatus === 'running') {
        console.log('[SingleVNCSessionManager] Found running container, recovering session...');
        
        // Get container info including environment variables to extract original session ID
        const { stdout: containerInfo } = await execAsync(`docker inspect ${this.CONTAINER_NAME} --format '{{.Id}} {{.Created}} {{range .Config.Env}}{{.}} {{end}}'`);
        const parts = containerInfo.trim().split(' ');
        const containerId = parts[0];
        const createdAt = parts[1];
        
        // Extract original session ID from environment variables
        let originalSessionId = null;
        for (const envVar of parts.slice(2)) {
          if (envVar.startsWith('SESSION_ID=')) {
            originalSessionId = envVar.replace('SESSION_ID=', '');
            break;
          }
        }
        
        // Fallback to creation time if SESSION_ID not found (for older containers)
        if (!originalSessionId) {
          originalSessionId = `single-vnc-${Math.floor(new Date(createdAt).getTime())}`;
          console.log('[SingleVNCSessionManager] ⚠️ Using fallback session ID based on creation time');
        }
        
        this.currentSession = {
          id: originalSessionId, // Use the original session ID from container environment
          containerId: containerId.substring(0, 12), // Short container ID
          status: 'ready',
          createdAt: new Date(createdAt),
          ports: {
            api: this.FIXED_API_PORT,
            vnc: this.FIXED_VNC_PORT,
            noVNC: this.FIXED_NOVNC_PORT,
          }
        };
        
        // Verify it's actually working
        const response = await fetch(`http://localhost:${this.FIXED_API_PORT}/health`, {
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          console.log(`[SingleVNCSessionManager] ✅ Session recovered: ${this.currentSession.id}`);
        } else {
          console.log('[SingleVNCSessionManager] ❌ Container running but API not healthy');
          this.currentSession = null;
        }
      } else {
        console.log('[SingleVNCSessionManager] No running container found for recovery');
      }
    } catch (error) {
      console.log(`[SingleVNCSessionManager] Session recovery failed: ${error}`);
      this.currentSession = null;
    }
  }
  
  private async forceDestroyCurrentSession(): Promise<void> {
    console.log('[SingleVNCSessionManager] 🔥 Force destroying any existing session...');
    
    // Kill container with our fixed name (force remove)
    try {
      await execAsync(`docker rm -f ${this.CONTAINER_NAME} 2>/dev/null || true`);
      console.log('[SingleVNCSessionManager] ✅ Container force removed');
    } catch (error) {
      console.log('[SingleVNCSessionManager] ℹ️ No container to remove');
    }
    
    // Kill any processes on our fixed ports
    await this.killProcessesOnPorts([this.FIXED_API_PORT, this.FIXED_VNC_PORT, this.FIXED_NOVNC_PORT]);
    
    // Reset internal state
    this.currentSession = null;
    
    console.log('[SingleVNCSessionManager] ✅ Force cleanup completed');
  }
  
  private async verifyNoOrphanedResources(): Promise<void> {
    console.log('[SingleVNCSessionManager] 🔍 Verifying clean state...');
    
    // Verify container is gone
    const containerStatus = await this.getContainerStatus();
    if (containerStatus === 'running') {
      throw new Error('Container still running after cleanup');
    }
    
    // Verify ports are free
    for (const port of [this.FIXED_API_PORT, this.FIXED_VNC_PORT, this.FIXED_NOVNC_PORT]) {
      if (!(await this.isPortFree(port))) {
        throw new Error(`Port ${port} still in use after cleanup`);
      }
    }
    
    console.log('[SingleVNCSessionManager] ✅ Clean state verified');
  }
  
  private async atomicSessionCreation(): Promise<VNCSession> {
    console.log('[SingleVNCSessionManager] 🚀 Creating container atomically...');
    
    const sessionId = `single-vnc-${Date.now()}`;
    
    // Ensure Docker image exists
    await this.ensureBrowserImage();
    
    // Create container with EXACTLY the same configuration every time
    const dockerCommand = `docker run -d \\
      --name "${this.CONTAINER_NAME}" \\
      -p ${this.FIXED_API_PORT}:3000 \\
      -p ${this.FIXED_VNC_PORT}:5900 \\
      -p ${this.FIXED_NOVNC_PORT}:6080 \\
      --rm \\
      -e ANTHROPIC_API_KEY="${process.env.ANTHROPIC_API_KEY}" \\
      -e OPENAI_API_KEY="${process.env.OPENAI_API_KEY}" \\
      -e SESSION_ID="${sessionId}" \\
      -e EXECUTION_ID="${sessionId}" \\
      ${this.IMAGE_NAME}`;
    
    const { stdout: containerId } = await execAsync(dockerCommand);
    const cleanContainerId = containerId.trim();
    
    const session: VNCSession = {
      id: sessionId,
      containerId: cleanContainerId,
      status: 'creating',
      createdAt: new Date(),
      ports: {
        api: this.FIXED_API_PORT,
        vnc: this.FIXED_VNC_PORT,
        noVNC: this.FIXED_NOVNC_PORT
      }
    };
    
    console.log(`[SingleVNCSessionManager] ✅ Container created: ${cleanContainerId}`);
    return session;
  }
  
  private async verifySessionReady(session: VNCSession): Promise<void> {
    console.log('[SingleVNCSessionManager] ⏳ Waiting for session to be ready...');
    
    const maxWaitTime = 60000; // 60 seconds
    const checkInterval = 2000; // Check every 2 seconds
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Check container is running
        const containerStatus = await this.getContainerStatus();
        if (containerStatus !== 'running') {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          continue;
        }
        
        // Check API health endpoint
        const response = await fetch(`http://localhost:${this.FIXED_API_PORT}/health`, {
          signal: AbortSignal.timeout(5000)
        });
        
        if (response.ok) {
          session.status = 'ready';
          console.log('[SingleVNCSessionManager] ✅ Session ready and healthy');
          return;
        }
      } catch (error) {
        // Continue trying
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
    
    // If we get here, session failed to become ready
    session.status = 'error';
    throw new Error(`Session failed to become ready within ${maxWaitTime/1000} seconds`);
  }
  
  private async getContainerStatus(): Promise<'running' | 'stopped' | 'not_found'> {
    try {
      const { stdout } = await execAsync(`docker inspect ${this.CONTAINER_NAME} --format='{{.State.Status}}' 2>/dev/null`);
      const status = stdout.trim();
      return status === 'running' ? 'running' : 'stopped';
    } catch (error) {
      return 'not_found';
    }
  }
  
  private async killProcessesOnPorts(ports: number[]): Promise<void> {
    for (const port of ports) {
      try {
        // Kill any process using the port
        await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
      } catch (error) {
        // Port was already free
      }
    }
    
    // Small delay to let processes die
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  private async isPortFree(port: number): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`lsof -i:${port} 2>/dev/null || echo "free"`);
      return stdout.trim() === 'free' || stdout.trim() === '';
    } catch (error) {
      return true; // Assume free if we can't check
    }
  }
  
  private async ensureBrowserImage(): Promise<void> {
    try {
      // Check if image exists
      await execAsync(`docker image inspect ${this.IMAGE_NAME} >/dev/null 2>&1`);
    } catch (error) {
      throw new Error(`Docker image ${this.IMAGE_NAME} not found. Please run: npm run build-browser-image`);
    }
  }
}

// Export singleton instance
export const singleVNCSessionManager = SingleVNCSessionManager.getInstance(); 