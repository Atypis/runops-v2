import { EventEmitter } from 'events';
import { BrowserSessionConfig } from './types';
import { execSync, spawn, ChildProcess } from 'child_process';

/**
 * Docker Browser Container Interface
 * Represents a VNC-enabled browser container with automation capabilities
 */
export interface DockerBrowserContainer {
  id: string;              // Session ID
  port: number;           // Container HTTP port
  vncPort: number;        // VNC server port (5900)
  noVncPort: number;      // NoVNC web client port (6080)
  containerId?: string;   // Docker container ID
  executionId: string;    // Execution ID this container serves
  status: 'starting' | 'ready' | 'error' | 'stopped';
}

/**
 * Docker Browser Manager
 * 
 * Manages Docker containers for VNC-enabled browser automation.
 * Integrates with HybridBrowserManager to provide containerized browser sessions.
 * 
 * Features:
 * - VNC-enabled Chrome containers
 * - Consistent port mapping (5900=VNC, 6080=NoVNC)
 * - Container lifecycle management
 * - Integration with memory capture system
 */
export class DockerBrowserManager extends EventEmitter {
  private containers: Map<string, DockerBrowserContainer> = new Map();
  private readonly VNC_PORT = 5900;
  private readonly NO_VNC_PORT = 6080;
  private readonly CONTAINER_HTTP_PORT = 3000;
  private readonly CONTAINER_IMAGE = 'aef-browser:latest';

  constructor() {
    super();
    console.log('[DockerBrowserManager] Initialized with VNC support');
  }

  /**
   * Create a new VNC-enabled browser container
   */
  public async createContainer(config: BrowserSessionConfig): Promise<DockerBrowserContainer> {
    const { executionId, userId } = config;
    
    console.log(`[DockerBrowserManager] Creating container for execution ${executionId}`);

    // Clean up any existing container for this execution
    await this.destroyContainerByExecution(executionId);

    // Generate unique container name
    const containerName = `aef-vnc-${executionId.replace('vnc-env-', '')}`;
    
    try {
      // Check if Docker image exists
      await this.ensureDockerImage();

      // Create and start the container
      const containerId = await this.startDockerContainer(containerName, executionId);

      const container: DockerBrowserContainer = {
        id: containerName,
        port: this.CONTAINER_HTTP_PORT,
        vncPort: this.VNC_PORT,
        noVncPort: this.NO_VNC_PORT,
        containerId,
        executionId,
        status: 'starting'
      };

      this.containers.set(executionId, container);

      // Wait for container to be ready
      await this.waitForContainerReady(container);
      container.status = 'ready';

      console.log(`[DockerBrowserManager] Container ${containerName} ready for VNC connections`);
      this.emit('container_created', container);

      return container;

    } catch (error) {
      console.error(`[DockerBrowserManager] Failed to create container:`, error);
      throw new Error(`Failed to create VNC container: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get container by execution ID
   */
  public getContainerByExecution(executionId: string): DockerBrowserContainer | undefined {
    return this.containers.get(executionId);
  }

  /**
   * Destroy container by execution ID
   */
  public async destroyContainerByExecution(executionId: string): Promise<void> {
    const container = this.containers.get(executionId);
    if (!container) {
      console.log(`[DockerBrowserManager] No container found for execution ${executionId}`);
      return;
    }

    await this.destroyContainer(container);
  }

  /**
   * Destroy a specific container
   */
  private async destroyContainer(container: DockerBrowserContainer): Promise<void> {
    console.log(`[DockerBrowserManager] Destroying container ${container.id}`);

    try {
      if (container.containerId) {
        // Stop and remove the container
        execSync(`docker stop ${container.containerId}`, { stdio: 'ignore' });
        execSync(`docker rm ${container.containerId}`, { stdio: 'ignore' });
        console.log(`[DockerBrowserManager] Container ${container.id} destroyed`);
      }
    } catch (error) {
      console.warn(`[DockerBrowserManager] Error destroying container ${container.id}:`, error);
    }

    this.containers.delete(container.executionId);
    this.emit('container_destroyed', container.id);
  }

  /**
   * Force cleanup all containers (used by VNC environment API)
   */
  public async forceCleanupAll(): Promise<void> {
    console.log('[DockerBrowserManager] Force cleanup all VNC containers');

    try {
      // Get all running AEF containers
      const runningContainers = execSync(
        'docker ps --filter "name=aef-vnc" --format "{{.ID}} {{.Names}}"',
        { encoding: 'utf8' }
      ).trim();

      if (runningContainers) {
        const containerLines = runningContainers.split('\n');
        
        for (const line of containerLines) {
          const [containerId, containerName] = line.split(' ');
          if (containerId && containerName) {
            try {
              console.log(`[DockerBrowserManager] Cleaning up container ${containerName} (${containerId})`);
              execSync(`docker stop ${containerId}`, { stdio: 'ignore' });
              execSync(`docker rm ${containerId}`, { stdio: 'ignore' });
            } catch (error) {
              console.warn(`[DockerBrowserManager] Failed to cleanup ${containerName}:`, error);
            }
          }
        }
      }

      // Clear our internal state
      this.containers.clear();
      console.log('[DockerBrowserManager] All containers cleaned up');

    } catch (error) {
      console.warn('[DockerBrowserManager] Error during force cleanup:', error);
      // Continue anyway - this is a cleanup operation
    }
  }

  /**
   * Start a Docker container with VNC configuration
   */
  private async startDockerContainer(containerName: string, executionId: string): Promise<string> {
    const dockerArgs = [
      'run',
      '-d',
      '--name', containerName,
      '--rm', // Auto-remove when stopped
      '-p', `${this.VNC_PORT}:5900`,        // VNC server
      '-p', `${this.NO_VNC_PORT}:6080`,     // NoVNC web client  
      '-p', `${this.CONTAINER_HTTP_PORT}:3000`, // HTTP API
      '-e', `EXECUTION_ID=${executionId}`,
      '-e', 'DISPLAY=:1',
      '-e', 'VNC_RESOLUTION=1280x720',
      '--shm-size=2g', // Shared memory for Chrome
      this.CONTAINER_IMAGE
    ];

    return new Promise((resolve, reject) => {
      const docker = spawn('docker', dockerArgs);
      let containerId = '';
      let errorOutput = '';

      docker.stdout.on('data', (data) => {
        containerId += data.toString().trim();
      });

      docker.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      docker.on('close', (code) => {
        if (code === 0 && containerId) {
          resolve(containerId);
        } else {
          reject(new Error(`Docker container failed to start: ${errorOutput}`));
        }
      });

      docker.on('error', (error) => {
        reject(new Error(`Failed to start Docker: ${error.message}`));
      });
    });
  }

  /**
   * Wait for container to be ready for VNC connections
   */
  private async waitForContainerReady(container: DockerBrowserContainer): Promise<void> {
    const maxWaitTime = 30000; // 30 seconds
    const checkInterval = 1000; // 1 second
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        // Check if VNC port is responding
        const response = await fetch(`http://localhost:${container.noVncPort}/vnc.html`, {
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          console.log(`[DockerBrowserManager] Container ${container.id} VNC ready`);
          return;
        }
      } catch (error) {
        // VNC not ready yet, continue waiting
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Container ${container.id} failed to become ready within ${maxWaitTime}ms`);
  }

  /**
   * Ensure Docker image exists (fallback to browserless/chrome if custom image not found)
   */
  private async ensureDockerImage(): Promise<void> {
    try {
      // Check if our custom image exists
      execSync(`docker image inspect ${this.CONTAINER_IMAGE}`, { stdio: 'ignore' });
      console.log(`[DockerBrowserManager] Using custom image: ${this.CONTAINER_IMAGE}`);
    } catch (error) {
      console.warn(`[DockerBrowserManager] Custom image ${this.CONTAINER_IMAGE} not found`);
      
      // Fallback to a known working VNC Chrome image
      const fallbackImage = 'browserless/chrome:latest';
      try {
        console.log(`[DockerBrowserManager] Pulling fallback image: ${fallbackImage}`);
        execSync(`docker pull ${fallbackImage}`, { stdio: 'inherit' });
        // Update the image we'll use
        (this as any).CONTAINER_IMAGE = fallbackImage;
      } catch (pullError) {
        throw new Error('No suitable Docker image available for VNC browser automation');
      }
    }
  }

  /**
   * Get statistics about managed containers
   */
  public getStats() {
    return {
      activeContainers: this.containers.size,
      containerIds: Array.from(this.containers.keys()),
      vncPorts: {
        vnc: this.VNC_PORT,
        noVnc: this.NO_VNC_PORT
      }
    };
  }

  /**
   * Shutdown manager and cleanup all containers
   */
  public async shutdown(): Promise<void> {
    console.log('[DockerBrowserManager] Shutting down...');
    await this.forceCleanupAll();
  }
} 