import { NextResponse } from 'next/server';
import { singleVNCSessionManager } from '@/lib/vnc/SingleVNCSessionManager';

export async function GET() {
  try {
    // ALWAYS check if session is ready (this triggers auto-recovery if needed)
    const isReady = await singleVNCSessionManager.isSessionReady();
    const session = singleVNCSessionManager.getCurrentSession();
    
    if (!session) {
      return NextResponse.json({
        status: 'no_session',
        vncUrl: null,
        ready: false,
        message: 'No VNC session active'
      });
    }
    
    return NextResponse.json({
      status: isReady ? 'ready' : 'starting',
      vncUrl: isReady ? singleVNCSessionManager.getVNCUrl() : null,
      ready: isReady,
      session: {
        id: session.id,
        createdAt: session.createdAt,
        ports: session.ports
      },
      message: isReady ? 'VNC session ready' : 'VNC session starting...'
    });
    
  } catch (error) {
    console.error('[VNC Status API] Error:', error);
    return NextResponse.json({
      status: 'error',
      vncUrl: null,
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 