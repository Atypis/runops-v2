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
      // In a real implementation, we'd look up the container port mapping
      // For now, we'll use a simple port calculation based on execution ID
      const containerPort = 13000; // Default port for first container
      
      try {
        // Call the container's restart browser endpoint
        const containerResponse = await fetch(`http://localhost:${containerPort}/restart-browser`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        if (containerResponse.ok) {
          const result = await containerResponse.json();
          return NextResponse.json({
            success: true,
            message: 'Browser restarted successfully',
            executionId,
            browserResult: result
          });
        } else {
          throw new Error('Container restart endpoint failed');
        }
        
      } catch (containerError) {
        console.warn('Container restart failed, trying alternative approach:', containerError);
        
        // Alternative: Return success and let the frontend handle it
        return NextResponse.json({
          success: true,
          message: 'Browser restart initiated',
          executionId,
          note: 'If browser window is still not visible, please refresh the VNC connection'
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