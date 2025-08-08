import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { executionId } = await request.json();
    
    if (!executionId || !executionId.startsWith('vnc-env-')) {
      return NextResponse.json({ 
        error: 'Invalid execution ID. Must be a VNC environment execution ID.' 
      }, { status: 400 });
    }

    // Extract container name from execution ID
    const containerName = `aef-browser-${executionId.replace('vnc-env-', '')}`;
    
    console.log(`[Restart Browser] Starting/restarting browser in container: ${containerName}`);

    // Restart Stagehand browser automation
    try {
      console.log(`[Restart Browser] Reinitializing Stagehand browser...`);
      
      // Get the container's API port
      const { stdout } = await execAsync(`docker port ${containerName} 3000`);
      
      const portMatch = stdout.match(/:(\d+)/);
      if (!portMatch) {
        throw new Error('Could not determine container API port');
      }
      
      const apiPort = parseInt(portMatch[1]);
      console.log(`[Restart Browser] Found API port: ${apiPort}`);
      
      // Reinitialize Stagehand
      const response = await fetch(`http://localhost:${apiPort}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Stagehand initialization failed: ${response.status}`);
      }
      
      console.log(`[Restart Browser] Stagehand browser reinitialized successfully`);
      
    } catch (error) {
      console.error(`[Restart Browser] Failed to restart Stagehand:`, error);
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Browser restarted successfully',
      executionId,
      containerName 
    });

  } catch (error) {
    console.error('[Restart Browser] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to restart browser',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 