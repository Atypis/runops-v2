import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * GET /api/aef/discover-session
 * Discovers currently running VNC browser containers and returns active session info
 * This makes Docker the source of truth for active sessions
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`🔍 [Session Discovery] Discovering active VNC sessions for user ${user.id}`);

    // Query Docker for running VNC containers (both formats)
    try {
      const { stdout } = await execAsync('docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}" | grep "aef-browser"');
      
      if (!stdout.trim()) {
        console.log(`❌ [Session Discovery] No active VNC containers found`);
        return NextResponse.json({
          status: 'no_active_session',
          message: 'No active VNC browser sessions found',
          activeSession: null
        });
      }

      // Parse Docker output to extract session info
      const lines = stdout.trim().split('\n');
      const activeSessions = [];

      for (const line of lines) {
        const [containerName, status, ports] = line.split('\t');
        
        // Extract execution ID from container name
        // Handle both formats:
        // 1. aef-browser-vnc-env-{execution-id} (preferred format)
        // 2. aef-browser-{execution-id} (legacy format)
        let executionId = null;
        let vncPort = null;
        let apiPort = null;
        
        const vncEnvMatch = containerName.match(/aef-browser-vnc-env-(.+)$/);
        const legacyMatch = containerName.match(/aef-browser-(.+)$/);
        
        if (vncEnvMatch) {
          executionId = `vnc-env-${vncEnvMatch[1]}`;
        } else if (legacyMatch && !legacyMatch[1].startsWith('vnc-env-')) {
          executionId = `vnc-env-${legacyMatch[1]}`;
        }
        
        if (executionId) {
          // Parse ports to get VNC and API endpoints
          // Look for patterns like: 0.0.0.0:16080->6080/tcp, 0.0.0.0:13000->3000/tcp
          const vncPortMatch = ports.match(/0\.0\.0\.0:(\d+)->6080\/tcp/);
          const apiPortMatch = ports.match(/0\.0\.0\.0:(\d+)->3000\/tcp/);
          
          if (vncPortMatch) vncPort = vncPortMatch[1];
          if (apiPortMatch) apiPort = apiPortMatch[1];

          activeSessions.push({
            executionId,
            containerName,
            status,
            vncUrl: vncPort ? `http://localhost:${vncPort}/vnc.html` : null,
            apiUrl: apiPort ? `http://localhost:${apiPort}` : null,
            isHealthy: status.includes('Up'),
            apiHealthy: false // Initialize with default value
          });
        }
      }

      if (activeSessions.length === 0) {
        console.log(`❌ [Session Discovery] Found VNC containers but could not parse execution IDs`);
        return NextResponse.json({
          status: 'parsing_error',
          message: 'Found VNC containers but could not extract session information',
          activeSession: null
        });
      }

      // For now, return the first active session (in the future, we could filter by user)
      const activeSession = activeSessions[0];
      
      console.log(`✅ [Session Discovery] Found active session: ${activeSession.executionId}`);
      console.log(`🖥️ VNC URL: ${activeSession.vncUrl}`);
      console.log(`🔧 API URL: ${activeSession.apiUrl}`);

      // Try to verify the session is responsive
      try {
        const healthCheck = await fetch(`${activeSession.apiUrl}/health`, { 
          method: 'GET',
          signal: AbortSignal.timeout(2000) // 2 second timeout
        });
        activeSession.apiHealthy = healthCheck.ok;
      } catch (healthError) {
        console.log(`⚠️ [Session Discovery] API health check failed: ${healthError instanceof Error ? healthError.message : 'Unknown error'}`);
        activeSession.apiHealthy = false;
      }

      return NextResponse.json({
        status: 'active_session_found',
        message: `Found active VNC session: ${activeSession.executionId}`,
        activeSession,
        allSessions: activeSessions,
        discoveryTimestamp: new Date().toISOString()
      });

    } catch (dockerError) {
      console.error(`❌ [Session Discovery] Docker query failed:`, dockerError);
      return NextResponse.json({
        status: 'docker_error',
        message: 'Failed to query Docker for active sessions',
        error: dockerError instanceof Error ? dockerError.message : 'Unknown Docker error',
        activeSession: null
      });
    }

  } catch (error) {
    console.error('Error in session discovery:', error);
    return NextResponse.json(
      { 
        status: 'discovery_error',
        error: 'Failed to discover active sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 