import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId } = body;
    
    if (!executionId) {
      return NextResponse.json(
        { error: 'Execution ID is required' },
        { status: 400 }
      );
    }
    
    console.log('🔄 Restarting browser for execution:', executionId);
    
    // For VNC environments, we need to find the container and call its restart endpoint
    if (executionId.startsWith('vnc-env-')) {
      // Import browser manager to get the actual container port
      const { hybridBrowserManager } = await import('@/lib/browser/HybridBrowserManager');
      
      try {
        // Find the container session to get the correct port
        const targetSession = hybridBrowserManager.getSessionByExecution(executionId);
        
        if (!targetSession || !('port' in targetSession)) {
          throw new Error('VNC container session not found');
        }
        
        const containerPort = (targetSession as any).port;
        console.log(`🔄 Restarting browser in container on port ${containerPort}`);
        
        // Try restart browser endpoint first
        try {
          const restartResponse = await fetch(`http://localhost:${containerPort}/restart-browser`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(10000) // 10 second timeout
          });
          
          if (restartResponse.ok) {
            const result = await restartResponse.json();
            return NextResponse.json({
              success: true,
              message: 'Browser restarted successfully',
              executionId,
              browserResult: result
            });
          }
        } catch (restartError) {
          console.log('Restart endpoint failed, trying init endpoint...');
        }
        
        // Fallback: Try init endpoint (will auto-detect if browser is already running)
        const initResponse = await fetch(`http://localhost:${containerPort}/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(15000) // 15 second timeout
        });
        
        if (initResponse.ok) {
          const result = await initResponse.json();
          return NextResponse.json({
            success: true,
            message: 'Browser initialized successfully',
            executionId,
            browserResult: result
          });
        } else {
          throw new Error('Both restart and init endpoints failed');
        }
        
      } catch (containerError) {
        console.warn('Container restart failed:', containerError);
        
        // Alternative: Return success and let the frontend handle it
        return NextResponse.json({
          success: false,
          message: 'Failed to restart browser in container',
          executionId,
          error: containerError instanceof Error ? containerError.message : 'Unknown error',
          note: 'Try refreshing the VNC connection or restarting the VNC environment'
        });
      }
    }
    
    // For regular executions, restart is not applicable
    return NextResponse.json({
      success: false,
      error: 'Browser restart is only available for VNC environments'
    }, { status: 400 });
    
  } catch (error: any) {
    console.error('❌ Failed to restart browser:', error);
    return NextResponse.json(
      { 
        error: 'Failed to restart browser',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 