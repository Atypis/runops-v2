import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { CheckpointAction } from '@/lib/types/checkpoint';

/**
 * POST /api/aef/checkpoint/[id]
 * Handles user responses to checkpoint approvals
 * Updates execution state and triggers continuation
 */
export async function POST(
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

    const { id: checkpointId } = params;
    const body = await request.json();
    const { response, data } = body;

    if (!checkpointId) {
      return NextResponse.json(
        { error: 'Checkpoint ID is required' },
        { status: 400 }
      );
    }

    if (!response || !Object.values(CheckpointAction).includes(response)) {
      return NextResponse.json(
        { error: 'Valid response is required (approve, reject, skip, pause)' },
        { status: 400 }
      );
    }

    console.log(`Processing checkpoint ${checkpointId} response: ${response} from user ${user.id}`);

    // For MVP: Store checkpoint response in execution metadata
    // In a full implementation, this would update a dedicated checkpoints table
    
    // First, find the execution that contains this checkpoint
    const { data: jobs, error: findError } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'aef_execution_running')
      .contains('metadata', { type: 'aef_execution' });

    if (findError) {
      console.error('Error finding execution for checkpoint:', findError);
      return NextResponse.json(
        { error: 'Failed to find execution' },
        { status: 500 }
      );
    }

    // Find the specific execution that has this checkpoint
    let targetJob = null;
    for (const job of jobs || []) {
      const metadata = job.metadata as any;
      if (metadata?.execution_record?.user_id === user.id) {
        // Check if this execution has the checkpoint
        const checkpoints = metadata.execution_record?.pending_checkpoints || [];
        if (checkpoints.find((cp: any) => cp.id === checkpointId)) {
          targetJob = job;
          break;
        }
      }
    }

    if (!targetJob) {
      return NextResponse.json(
        { error: 'Checkpoint not found or already responded' },
        { status: 404 }
      );
    }

    // Update the execution metadata with checkpoint response
    const metadata = targetJob.metadata as any;
    const executionRecord = metadata.execution_record;
    
    // Mark checkpoint as responded
    const checkpoints = executionRecord.pending_checkpoints || [];
    const checkpointIndex = checkpoints.findIndex((cp: any) => cp.id === checkpointId);
    
    if (checkpointIndex === -1) {
      return NextResponse.json(
        { error: 'Checkpoint not found in execution' },
        { status: 404 }
      );
    }

    // Update checkpoint with response
    checkpoints[checkpointIndex] = {
      ...checkpoints[checkpointIndex],
      status: 'responded',
      response,
      responseData: data,
      respondedAt: new Date().toISOString(),
      respondedBy: user.id
    };

    // Update execution record
    executionRecord.pending_checkpoints = checkpoints;
    executionRecord.last_checkpoint_response = {
      checkpointId,
      response,
      timestamp: new Date().toISOString()
    };

    // Update job status based on response
    let newStatus = targetJob.status;
    if (response === CheckpointAction.REJECT) {
      newStatus = 'aef_execution_stopped';
    } else if (response === CheckpointAction.PAUSE) {
      newStatus = 'aef_execution_paused';
    } else {
      newStatus = 'aef_execution_running'; // Continue execution
    }

    // Save updated metadata
    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        status: newStatus,
        metadata: {
          ...metadata,
          execution_record: executionRecord
        },
        updated_at: new Date().toISOString()
      })
      .eq('job_id', targetJob.job_id);

    if (updateError) {
      console.error('Error updating checkpoint response:', updateError);
      return NextResponse.json(
        { error: 'Failed to save checkpoint response' },
        { status: 500 }
      );
    }

    // Determine next action based on response
    let nextAction = 'continue';
    if (response === CheckpointAction.REJECT) {
      nextAction = 'stop_execution';
    } else if (response === CheckpointAction.PAUSE) {
      nextAction = 'pause_execution';
    } else if (response === CheckpointAction.SKIP) {
      nextAction = 'skip_step';
    }

    console.log(`Checkpoint ${checkpointId} processed successfully: ${response} -> ${nextAction}`);
    
    return NextResponse.json({
      status: 'success',
      checkpointId,
      response,
      nextAction,
      executionStatus: newStatus
    });

  } catch (error) {
    console.error('Error in checkpoint response:', error);
    return NextResponse.json(
      { error: 'Failed to process checkpoint response' },
      { status: 500 }
    );
  }
} 