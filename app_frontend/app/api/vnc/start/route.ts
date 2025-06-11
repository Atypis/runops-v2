import { NextResponse } from 'next/server';
import { singleVNCSessionManager } from '@/lib/vnc/SingleVNCSessionManager';

export async function POST() {
  try {
    console.log('[VNC Start API] Starting fresh VNC session...');
    
    // Create session (this automatically kills any existing session)
    const session = await singleVNCSessionManager.createSession();
    
    // Wait a moment for container to fully initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify it's ready
    const isReady = await singleVNCSessionManager.isSessionReady();
    
    return NextResponse.json({
      success: true,
      status: isReady ? 'ready' : 'starting',
      vncUrl: singleVNCSessionManager.getVNCUrl(), // Always the same URL
      session: {
        id: session.id,
        createdAt: session.createdAt,
        ports: session.ports
      },
      message: `VNC session created: ${session.id}`,
      executionId: 'single-vnc-session' // Fixed execution ID for simplicity
    });
    
  } catch (error) {
    console.error('[VNC Start API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to start VNC session'
    }, { status: 500 });
  }
} 