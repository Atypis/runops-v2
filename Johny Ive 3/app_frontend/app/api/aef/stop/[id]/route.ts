import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';

/**
 * DELETE /api/aef/stop/[id]
 * Stops AEF execution and cleans up browser sessions
 * Updates execution status to stopped
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id: executionId } = params;

    if (!executionId) {
      return NextResponse.json(
        { error: 'Execution ID is required' },
        { status: 400 }
      );
    }

    console.log(`Stopping AEF execution ${executionId} for user ${user.id}`);

    // Find the execution job
    const { data: job, error: findError } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', executionId)
      .single();

    if (findError) {
      console.error('Error finding execution:', findError);
      if (findError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Execution not found' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to find execution' },
        { status: 500 }
      );
    }

    // Verify user owns this execution
    const metadata = job.metadata as any;
    if (metadata?.execution_record?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied: You can only stop your own executions' },
        { status: 403 }
      );
    }

    // Check if execution is already stopped
    if (job.status === 'aef_execution_stopped' || job.status === 'aef_execution_completed') {
      return NextResponse.json({
        status: 'already_stopped',
        executionId,
        message: 'Execution was already stopped or completed'
      });
    }

    // Update execution status to stopped
    const executionRecord = metadata.execution_record;
    executionRecord.status = 'stopped';
    executionRecord.stopped_at = new Date().toISOString();
    executionRecord.stopped_by = user.id;
    
    // Clear any pending checkpoints
    executionRecord.pending_checkpoints = [];

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: 'aef_execution_stopped',
        metadata: {
          ...metadata,
          execution_record: executionRecord
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('job_id', executionId);

    if (updateError) {
      console.error('Error updating execution status:', updateError);
      return NextResponse.json(
        { error: 'Failed to stop execution' },
        { status: 500 }
      );
    }

    // Clean up browser session (Docker container or local session)
    try {
      await hybridBrowserManager.destroySessionByExecution(executionId);
      console.log(`Browser session cleaned up for execution ${executionId}`);
    } catch (cleanupError) {
      console.warn(`Failed to cleanup browser session for ${executionId}:`, cleanupError);
      // Don't fail the stop operation if cleanup fails
    }

    console.log(`AEF execution ${executionId} stopped successfully`);
    
    return NextResponse.json({
      status: 'stopped',
      executionId,
      cleanup: 'completed',
      stoppedAt: executionRecord.stopped_at
    });

  } catch (error) {
    console.error('Error stopping AEF execution:', error);
    return NextResponse.json(
      { error: 'Failed to stop execution' },
      { status: 500 }
    );
  }
} 