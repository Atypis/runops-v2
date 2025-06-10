import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';
import { DockerBrowserContainer } from '@/lib/browser/DockerBrowserManager';
import { createSupabaseServerClient, createDirectSupabaseClient } from '@/lib/supabase-server';

/**
 * POST /api/aef/start-vnc-environment
 * Starts a VNC-enabled Docker container for browser automation
 * Also creates a database execution record for step tracking
 * 
 * For simplicity, we now use only ONE container at a time with consistent ports
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get authenticated user (simplified for demo)
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    // Generate a proper UUID with VNC prefix for frontend detection
    const executionId = `vnc-env-${uuidv4()}`;
    
    console.log(`🖥️ Creating VNC environment: ${executionId}`);
    
    // ENHANCED CLEANUP: Clean up both Docker containers AND database records
    console.log('🧹 Cleaning up any existing VNC containers and database records...');
    try {
      // 1. Clean up Docker containers through hybridBrowserManager
      await hybridBrowserManager.destroySessionByExecution(executionId);
      
      const { DockerBrowserManager } = await import('@/lib/browser/DockerBrowserManager');
      const dockerManager = new DockerBrowserManager();
      await dockerManager.forceCleanupAll();
      console.log('✅ Docker containers cleaned up');
      
      // 2. Clean up database session_registry records that might cause unique constraint violation
      if (userId !== 'anonymous') {
        const { error: deleteError } = await supabase
          .from('session_registry')
          .delete()
          .eq('user_id', userId);
        
        if (deleteError) {
          console.warn('⚠️ Failed to cleanup session_registry records:', deleteError);
          // Don't fail - this might just mean no records exist
        } else {
          console.log('✅ Session registry records cleaned up');
        }
      }
      
      // 3. Clean up any orphaned jobs records for this user's VNC environments
      if (userId !== 'anonymous') {
        const directSupabase = createDirectSupabaseClient();
        const { error: jobsCleanupError } = await directSupabase
          .from('jobs')
          .delete()
          .eq('metadata->>user_id', userId)
          .like('job_id', '%vnc-env%');
        
        if (jobsCleanupError) {
          console.warn('⚠️ Failed to cleanup jobs records:', jobsCleanupError);
          // Don't fail - this is just cleanup
        } else {
          console.log('✅ Orphaned jobs records cleaned up');
        }
      }
      
    } catch (cleanupError) {
      console.log('ℹ️ No existing containers/records to cleanup (this is normal)');
    }

    // Create the VNC environment with CONSISTENT PORTS
    const session = await hybridBrowserManager.createSession({
      executionId,
      userId,
      mode: 'docker',
      headless: false,
      viewport: { width: 1280, height: 720 }
    }) as DockerBrowserContainer;

    if (!session) {
      throw new Error('Failed to create VNC session');
    }

    console.log(`✅ VNC environment created: ${session.id}`);
    
    // 🌐 AUTOMATICALLY INITIALIZE BROWSER IN CONTAINER
    console.log('🚀 Auto-initializing browser in VNC environment...');
    try {
      // Call the container's init endpoint to start the browser
      const initResponse = await fetch(`http://localhost:${session.port}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000) // 15 second timeout for browser init
      });
      
      if (initResponse.ok) {
        const initResult = await initResponse.json();
        console.log('✅ Browser auto-initialized in VNC container:', initResult.message);
      } else {
        const errorText = await initResponse.text();
        console.warn('⚠️ Browser auto-init failed, but VNC is still available:', errorText);
      }
    } catch (initError) {
      console.warn('⚠️ Browser auto-init failed, but VNC is still available:', initError instanceof Error ? initError.message : 'Unknown error');
    }
    
    // Create database execution record so action API can find it
    // Extract UUID part for database (remove vnc-env- prefix)
    const databaseUuid = executionId.replace('vnc-env-', '');
    
    console.log(`🗃️ Creating database record:`);
    console.log(`  - Execution ID: ${executionId}`);
    console.log(`  - Database UUID: ${databaseUuid}`);
    console.log(`  - Session ID: ${session.id}`);
    
    const executionRecord = {
      execution_id: executionId, // Keep full prefixed ID in metadata
      user_id: userId,
      document_id: 'test-investor-email-workflow', // Using our hardcoded test workflow
      status: 'vnc_ready',
      created_at: new Date().toISOString(),
      execution_context: {
        variables: {},
        currentStepIndex: 0,
        totalSteps: 8, // Our hardcoded workflow has 8 steps
        sessionType: 'vnc_environment'
      },
      step_actions: [] // Initialize empty action queue
    };

    // Create job record in database using direct client to avoid auth issues
    const directSupabase = createDirectSupabaseClient();
    const { error: jobError } = await directSupabase
      .from('jobs')
      .insert({
        job_id: databaseUuid, // Pure UUID for database
        status: 'aef_vnc_ready',
        metadata: {
          execution_record: executionRecord,
          user_id: userId, // Store user_id in metadata since jobs table doesn't have it
          vnc_session: {
            sessionId: session.id,
            vncPort: session.vncPort,
            noVncPort: session.noVncPort,
            containerId: (session as any).containerId
          }
        },
        progress_stage: 'vnc_environment_ready',
        progress_percent: 0
      });

    if (jobError) {
      console.error('❌ Failed to create database execution record:', jobError);
      // CRITICAL: If database record creation fails, we must destroy the VNC session
      // to avoid orphaned sessions that can't be controlled
      try {
        await hybridBrowserManager.destroySessionByExecution(executionId);
      } catch (cleanupError) {
        console.error('Failed to cleanup VNC session after database error:', cleanupError);
      }
      return NextResponse.json(
        { error: 'Failed to create execution record in database', details: jobError },
        { status: 500 }
      );
    } else {
      console.log(`✅ Database execution record created for VNC session: ${databaseUuid}`);
    }
    
    // Wait a moment for container to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return NextResponse.json({
      success: true,
      executionId,
      sessionId: session.id,
      vncPorts: {
        vnc: session.vncPort,
        noVnc: session.noVncPort
      },
      websocketUrl: `ws://localhost:3004/ws?executionId=${executionId}`,
      message: 'VNC environment ready for connection and step execution'
    });
    
  } catch (error) {
    console.error('❌ VNC environment API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 