import { NextRequest, NextResponse } from 'next/server';
import { singleVNCSessionManager } from '@/lib/vnc/SingleVNCSessionManager';

export async function POST(request: NextRequest) {
  try {
    const action = await request.json();
    
    console.log('[VNC Action API] Executing action:', action.type);
    
    // Execute action in the single VNC session
    const result = await singleVNCSessionManager.executeAction(action);
    
    return NextResponse.json({
      success: true,
      result: result,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('[VNC Action API] Error:', error);
    
    let errorMessage = 'Action execution failed';
    let statusCode = 500;
    
    if (error instanceof Error) {
      if (error.message.includes('No active VNC session')) {
        errorMessage = 'No VNC session active. Please start a session first.';
        statusCode = 400;
      } else if (error.message.includes('not ready')) {
        errorMessage = 'VNC session not ready. Please wait for session to initialize.';
        statusCode = 400;
      } else {
        errorMessage = error.message;
      }
    }
    
    return NextResponse.json({
      success: false,
      error: errorMessage
    }, { status: statusCode });
  }
} 