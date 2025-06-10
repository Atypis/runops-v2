import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

interface SessionRecord {
  id: string;
  user_id: string;
  session_id: string;
  container_name: string;
  container_id?: string;
  status: 'creating' | 'active' | 'idle' | 'cleanup' | 'error';
  vnc_port?: number;
  api_port?: number;
  vnc_url?: string;
  api_url?: string;
  created_at: string;
  last_activity: string;
  heartbeat_at: string;
  metadata: any;
}

/**
 * GET /api/aef/session
 * Discovers the user's active VNC session or returns null if none exists
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

    console.log(`🔍 [Session Manager] Finding active session for user ${user.id}`);

    // Query database for user's active session
    const { data: sessions, error: dbError } = await supabase
      .from('session_registry')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['creating', 'active', 'idle'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (dbError) {
      console.error('❌ [Session Manager] Database query failed:', dbError);
      return NextResponse.json(
        { error: 'Failed to query session registry' },
        { status: 500 }
      );
    }

    if (!sessions || sessions.length === 0) {
      console.log(`ℹ️ [Session Manager] No active session found for user ${user.id}`);
      return NextResponse.json({
        status: 'no_session',
        message: 'No active session found',
        session: null
      });
    }

    const session = sessions[0] as SessionRecord;
    console.log(`✅ [Session Manager] Found session: ${session.session_id} (${session.status})`);

    // Verify the container is actually running
    try {
      const { stdout } = await execAsync(`docker ps --format "{{.Names}}\t{{.Status}}" | grep "${session.container_name}"`);
      
      if (!stdout.trim()) {
        // Container not running - mark session as error
        console.log(`⚠️ [Session Manager] Container ${session.container_name} not running - marking as error`);
        
        await supabase
          .from('session_registry')
          .update({ status: 'error' })
          .eq('id', session.id);
          
        return NextResponse.json({
          status: 'session_error',
          message: 'Session container not running',
          session: null
        });
      }

      // Container is running - update heartbeat
      await supabase
        .from('session_registry')
        .update({ 
          heartbeat_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          status: session.status === 'idle' ? 'active' : session.status
        })
        .eq('id', session.id);

      console.log(`💓 [Session Manager] Updated heartbeat for session ${session.session_id}`);

    } catch (dockerError) {
      console.error(`❌ [Session Manager] Docker check failed:`, dockerError);
      // Continue anyway - may be a temporary Docker issue
    }

    return NextResponse.json({
      status: 'session_found',
      message: `Active session found: ${session.session_id}`,
      session: {
        executionId: session.session_id,
        containerName: session.container_name,
        status: session.status,
        vncUrl: session.vnc_url,
        apiUrl: session.api_url,
        vncPort: session.vnc_port,
        apiPort: session.api_port,
        createdAt: session.created_at,
        lastActivity: session.last_activity
      }
    });

  } catch (error) {
    console.error('❌ [Session Manager] Error:', error);
    return NextResponse.json(
      { 
        error: 'Session discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/aef/session
 * Creates a new VNC session for the user (atomic - ensures only one per user)
 */
export async function POST(request: NextRequest) {
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

    console.log(`🚀 [Session Manager] Creating new session for user ${user.id}`);

    // CLEANUP STEP: Force cleanup any existing sessions for this user first
    console.log(`🧹 [Session Manager] Cleaning up any existing sessions for user ${user.id}...`);
    
    const { data: existingSessions } = await supabase
      .from('session_registry')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['creating', 'active', 'idle']);

    if (existingSessions && existingSessions.length > 0) {
      console.log(`🗑️ [Session Manager] Found ${existingSessions.length} existing sessions to cleanup`);
      
      for (const existing of existingSessions) {
        console.log(`🛑 [Session Manager] Cleaning up session: ${existing.session_id}`);
        
        // 🔥 FORCE KILL: Try to call kill-session endpoint first, then destroy container
        if (existing.container_name) {
          try {
            // Try to call kill-session endpoint for complete cleanup
            if (existing.api_port) {
              try {
                const killResponse = await fetch(`http://localhost:${existing.api_port}/kill-session`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  signal: AbortSignal.timeout(3000) // 3 second timeout
                });
                if (killResponse.ok) {
                  console.log(`✅ [Session Manager] Browser state killed via API`);
                }
                             } catch (killError) {
                 console.warn(`⚠️ [Session Manager] Kill-session call failed:`, killError instanceof Error ? killError.message : killError);
              }
            }
            
            // Force stop and remove container
            await execAsync(`docker stop ${existing.container_name} 2>/dev/null || true`);
            await execAsync(`docker rm -f ${existing.container_name} 2>/dev/null || true`);
            console.log(`✅ [Session Manager] Removed container: ${existing.container_name}`);
          } catch (dockerError) {
            console.warn(`⚠️ [Session Manager] Container cleanup failed: ${dockerError}`);
          }
        }
        
        // Remove from database
        await supabase
          .from('session_registry')
          .delete()
          .eq('id', existing.id);
        
        console.log(`✅ [Session Manager] Removed database record: ${existing.id}`);
      }
      
      console.log(`🎉 [Session Manager] Cleanup completed. Creating fresh session...`);
    }

    // Generate unique session ID with user prefix
    const sessionUuid = uuidv4();
    const sessionId = `vnc-env-${sessionUuid}`;
    const containerName = `aef-browser-${user.id.substring(0, 8)}-${sessionUuid}`;

    console.log(`🎯 [Session Manager] Generated session ID: ${sessionId}`);
    console.log(`🐳 [Session Manager] Container name: ${containerName}`);

    // Find available ports
    const vncPort = await findAvailablePort(16080);
    const apiPort = await findAvailablePort(13000);
    
    const vncUrl = `http://localhost:${vncPort}`;
    const apiUrl = `http://localhost:${apiPort}`;

    // Create session record in database first
    const { data: sessionRecord, error: insertError } = await supabase
      .from('session_registry')
      .insert({
        user_id: user.id,
        session_id: sessionId,
        container_name: containerName,
        status: 'creating',
        vnc_port: vncPort,
        api_port: apiPort,
        vnc_url: vncUrl,
        api_url: apiUrl,
        metadata: {
          created_by: 'session_manager_api',
          user_agent: request.headers.get('user-agent')
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ [Session Manager] Failed to create session record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create session record' },
        { status: 500 }
      );
    }

    console.log(`📝 [Session Manager] Created session record: ${sessionRecord.id}`);

    // Start Docker container
    try {
      const dockerCommand = `docker run -d \\
        --name "${containerName}" \\
        -p ${vncPort}:6080 \\
        -p ${apiPort}:3000 \\
        -p ${vncPort - 1000}:5900 \\
        -e ANTHROPIC_API_KEY="${process.env.ANTHROPIC_API_KEY}" \\
        -e GOOGLE_API_KEY="${process.env.GOOGLE_API_KEY}" \\
        -e OPENAI_API_KEY="${process.env.OPENAI_API_KEY}" \\
        aef-browser:latest`;

      console.log(`🐳 [Session Manager] Starting container with command: ${dockerCommand}`);
      
      const { stdout: containerId } = await execAsync(dockerCommand);
      const cleanContainerId = containerId.trim();

      console.log(`✅ [Session Manager] Container started: ${cleanContainerId}`);

      // Update session record with container ID
      await supabase
        .from('session_registry')
        .update({ 
          container_id: cleanContainerId,
          status: 'active'
        })
        .eq('id', sessionRecord.id);

      // Wait for container to be ready, then start browser
      console.log(`⏳ [Session Manager] Waiting for container to initialize...`);
      await new Promise(resolve => setTimeout(resolve, 8000)); // Wait 8 seconds for full startup

      try {
        // Initialize Stagehand browser automation
        console.log(`🚀 [Session Manager] Initializing Stagehand browser automation...`);
        
        // Initialize the browser server inside the container
        const response = await fetch(`http://localhost:${apiPort}/init`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          console.log(`✅ [Session Manager] Stagehand browser initialized successfully`);
        } else {
          console.warn(`⚠️ [Session Manager] Stagehand initialization returned:`, response.status);
        }
      } catch (browserError) {
        console.warn(`⚠️ [Session Manager] Failed to initialize Stagehand automatically:`, browserError);
        // Don't fail the session creation - browser can be initialized later via API
      }

      console.log(`🎉 [Session Manager] Session ${sessionId} ready!`);

      return NextResponse.json({
        status: 'session_created',
        message: `Session created successfully: ${sessionId}`,
        session: {
          executionId: sessionId,
          containerName: containerName,
          containerId: cleanContainerId,
          status: 'active',
          vncUrl: vncUrl,
          apiUrl: apiUrl,
          vncPort: vncPort,
          apiPort: apiPort
        }
      });

    } catch (dockerError) {
      console.error('❌ [Session Manager] Docker container creation failed:', dockerError);
      
      // Mark session as error in database
      await supabase
        .from('session_registry')
        .update({ status: 'error' })
        .eq('id', sessionRecord.id);

      return NextResponse.json(
        { 
          error: 'Failed to start container',
          details: dockerError instanceof Error ? dockerError.message : 'Unknown Docker error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ [Session Manager] Error:', error);
    return NextResponse.json(
      { 
        error: 'Session creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/aef/session
 * Terminates the user's active session
 */
export async function DELETE(request: NextRequest) {
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

    console.log(`🛑 [Session Manager] Terminating session for user ${user.id}`);

    // Find user's active session
    const { data: sessions } = await supabase
      .from('session_registry')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['creating', 'active', 'idle']);

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({
        status: 'no_session',
        message: 'No active session to terminate'
      });
    }

    const session = sessions[0] as SessionRecord;
    console.log(`🎯 [Session Manager] Terminating session: ${session.session_id}`);

    // 🔥 FORCE KILL SESSION: Call the container's kill-session endpoint first
    try {
      console.log(`🔥 [Session Manager] Calling kill-session endpoint for thorough cleanup...`);
      
      // Extract API port from the session record
      const apiPort = session.api_port || 13000; // Default fallback
      
      // Call the kill-session endpoint inside the container
      const killResponse = await fetch(`http://localhost:${apiPort}/kill-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      if (killResponse.ok) {
        console.log(`✅ [Session Manager] Browser state killed successfully via API`);
      } else {
        console.warn(`⚠️ [Session Manager] Kill-session endpoint returned: ${killResponse.status}`);
      }
         } catch (killError) {
       console.warn(`⚠️ [Session Manager] Failed to call kill-session endpoint:`, killError instanceof Error ? killError.message : killError);
      // Continue with container termination anyway
    }

    // Stop and remove Docker container (with force flags for complete cleanup)
    try {
      await execAsync(`docker stop ${session.container_name} || true`);
      await execAsync(`docker rm -f ${session.container_name} || true`);
      console.log(`🐳 [Session Manager] Container ${session.container_name} terminated and removed`);
    } catch (dockerError) {
      console.error('⚠️ [Session Manager] Container cleanup failed:', dockerError);
      // Continue anyway to clean up database record
    }

    // Remove session from database
    await supabase
      .from('session_registry')
      .delete()
      .eq('id', session.id);

    console.log(`✅ [Session Manager] Session ${session.session_id} terminated successfully`);

    return NextResponse.json({
      status: 'session_terminated',
      message: `Session terminated: ${session.session_id}`
    });

  } catch (error) {
    console.error('❌ [Session Manager] Error:', error);
    return NextResponse.json(
      { 
        error: 'Session termination failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to find available ports
async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      const { stdout } = await execAsync(`lsof -i :${port} || echo "available"`);
      if (stdout.includes('available')) {
        return port;
      }
    } catch {
      return port; // If lsof fails, assume port is available
    }
  }
  throw new Error(`No available ports found starting from ${startPort}`);
} 