import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/aef/stop-vnc-environment
 * Stops a VNC-enabled Docker container and cleans up resources
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId } = body;

    if (!executionId) {
      return NextResponse.json(
        { error: 'executionId is required' },
        { status: 400 }
      );
    }

    console.log(`🛑 Stopping VNC environment for execution ${executionId}`);

    // Import HybridBrowserManager
    const { hybridBrowserManager } = require('@/lib/browser/HybridBrowserManager');
    
    try {
      // Find and destroy the session by execution ID
      await hybridBrowserManager.destroySessionByExecution(executionId);
      console.log(`✅ VNC environment stopped for execution: ${executionId}`);
      
      return NextResponse.json({
        success: true,
        executionId,
        message: 'VNC environment stopped successfully'
      });
      
    } catch (error: any) {
      console.error('❌ Failed to stop VNC environment:', error);
      return NextResponse.json(
        { error: `Failed to stop VNC environment: ${error.message}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('❌ VNC stop API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 