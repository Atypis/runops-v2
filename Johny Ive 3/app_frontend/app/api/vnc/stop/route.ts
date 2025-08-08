import { NextResponse } from 'next/server';
import { singleVNCSessionManager } from '@/lib/vnc/SingleVNCSessionManager';

export async function DELETE() {
  try {
    console.log('[VNC Stop API] Stopping VNC session...');
    
    const session = singleVNCSessionManager.getCurrentSession();
    
    if (!session) {
      return NextResponse.json({
        success: true,
        message: 'No VNC session was active',
        status: 'no_session'
      });
    }
    
    // Destroy the session completely
    await singleVNCSessionManager.destroySession();
    
    return NextResponse.json({
      success: true,
      message: `VNC session ${session.id} stopped successfully`,
      status: 'stopped'
    });
    
  } catch (error) {
    console.error('[VNC Stop API] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Failed to stop VNC session'
    }, { status: 500 });
  }
} 