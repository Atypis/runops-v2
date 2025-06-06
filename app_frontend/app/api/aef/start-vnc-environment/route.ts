import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';
import { DockerBrowserContainer } from '@/lib/browser/DockerBrowserManager';

/**
 * POST /api/aef/start-vnc-environment
 * Starts a VNC-enabled Docker container for browser automation
 * Simplified version without full authentication for demo purposes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, userId = 'demo-user', forceCleanup = true } = body;

    if (!executionId) {
      return NextResponse.json(
        { error: 'executionId is required' },
        { status: 400 }
      );
    }

    console.log(`🖥️ Starting VNC environment for execution ${executionId}`);
    
    try {
      // Always perform cleanup for the specific execution ID first
      console.log(`🧹 Cleaning up any existing session for execution ${executionId}`);
      await hybridBrowserManager.destroySessionByExecution(executionId);
      
      // Create Docker container with VNC
      const session = await hybridBrowserManager.createSession({
        executionId,
        userId,
        headless: false,
        viewport: { width: 1280, height: 720 },
        mode: 'docker' // Force Docker mode for VNC
      });
      
      // Type guard to ensure we have a Docker container with VNC ports
      if (!('containerId' in session && session.vncPort && session.noVncPort)) {
        throw new Error('Failed to create a Docker session with VNC ports.');
      }

      console.log(`✅ VNC environment created: ${session.id}`);
      
      // Wait a moment for container to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return NextResponse.json({
        success: true,
        executionId,
        sessionId: session.id,
        vncPorts: {
          vnc: session.vncPort,
          noVnc: session.noVncPort
        },
        websocketUrl: `ws://localhost:3004/ws?executionId=${executionId}`,
        message: 'VNC environment ready for connection'
      });
      
    } catch (error: any) {
      console.error('❌ Failed to create VNC environment:', error);
      return NextResponse.json(
        { error: `Failed to create VNC environment: ${error.message}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ VNC environment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 