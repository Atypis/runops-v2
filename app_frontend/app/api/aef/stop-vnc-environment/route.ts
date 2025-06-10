import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createDirectSupabaseClient } from '@/lib/supabase-server';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';

/**
 * POST /api/aef/stop-vnc-environment
 * Stops VNC environment and cleans up all associated resources
 * Removes both Docker containers and database records
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id || 'anonymous';

    const { executionId } = await request.json();
    
    console.log(`🛑 Stopping VNC environment: ${executionId || 'ALL'} for user ${userId}`);
    
    // If specific executionId provided, clean up that session
    if (executionId && executionId !== 'cleanup-all') {
      try {
        await hybridBrowserManager.destroySessionByExecution(executionId);
        console.log(`✅ Docker session ${executionId} destroyed`);
      } catch (error) {
        console.warn(`⚠️ Failed to destroy Docker session ${executionId}:`, error);
      }
    } else {
      // Clean up ALL Docker containers for this user (or all if cleanup-all)
      try {
        const { DockerBrowserManager } = await import('@/lib/browser/DockerBrowserManager');
        const dockerManager = new DockerBrowserManager();
        await dockerManager.forceCleanupAll();
        console.log('✅ All Docker containers cleaned up');
      } catch (error) {
        console.warn('⚠️ Failed to cleanup Docker containers:', error);
      }
    }
    
    // Clean up database records
    if (userId !== 'anonymous') {
      try {
        // 1. Clean up session_registry records
        const { error: sessionError } = await supabase
          .from('session_registry')
          .delete()
          .eq('user_id', userId);
        
        if (sessionError) {
          console.warn('⚠️ Failed to cleanup session_registry:', sessionError);
        } else {
          console.log('✅ Session registry records cleaned up');
        }
        
        // 2. Clean up jobs records for VNC environments
        const directSupabase = createDirectSupabaseClient();
        let jobsQuery = directSupabase
          .from('jobs')
          .delete()
          .eq('metadata->>user_id', userId);
        
        // If specific execution ID, clean up only that job
        if (executionId && executionId !== 'cleanup-all') {
          const databaseUuid = executionId.replace('vnc-env-', '');
          jobsQuery = jobsQuery.eq('job_id', databaseUuid);
        } else {
          // Clean up all VNC-related jobs for this user
          jobsQuery = jobsQuery.like('job_id', '%vnc-env%');
        }
        
        const { error: jobsError } = await jobsQuery;
        
        if (jobsError) {
          console.warn('⚠️ Failed to cleanup jobs records:', jobsError);
        } else {
          console.log('✅ Jobs records cleaned up');
        }
        
      } catch (dbError) {
        console.warn('⚠️ Database cleanup failed:', dbError);
        // Don't fail the entire operation for database issues
      }
    }
    
    console.log(`✅ VNC environment cleanup completed for ${executionId || 'ALL'}`);
    
    return NextResponse.json({
      success: true,
      executionId: executionId || 'ALL',
      message: 'VNC environment stopped and cleaned up successfully'
    });
    
  } catch (error) {
    console.error('❌ VNC environment stop error:', error);
    return NextResponse.json(
      { error: 'Failed to stop VNC environment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 