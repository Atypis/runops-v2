import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { AEFDocument, DEFAULT_AEF_CONFIG, AEFTransformResult } from '@/lib/types/aef';
import { SOPDocument } from '@/lib/types/sop';
import { CheckpointConfig, CheckpointType, CheckpointCondition, CheckpointAction } from '@/lib/types/checkpoint';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/aef/transform
 * Transforms an existing SOP into an AEF-enabled document
 * Creates default checkpoint configuration for all steps
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

    const body = await request.json();
    const { sopId, config } = body;

    if (!sopId) {
      return NextResponse.json(
        { error: 'sopId is required' },
        { status: 400 }
      );
    }

    console.log(`Transforming SOP ${sopId} to AEF for user ${user.id}`);

    // Fetch the original SOP document
    const { data: sopRecord, error: fetchError } = await supabase
      .from('sops')
      .select('*')
      .eq('job_id', sopId)
      .single();

    if (fetchError) {
      console.error('Error fetching SOP:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'SOP not found or access denied' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch SOP' },
        { status: 500 }
      );
    }

    const originalSop: SOPDocument = sopRecord.data;
    
    // Generate checkpoints for all automatable steps
    const checkpoints = generateDefaultCheckpoints(originalSop);
    
    // Create AEF configuration
    const aefConfig = {
      ...DEFAULT_AEF_CONFIG,
      checkpoints,
      estimatedDuration: estimateExecutionDuration(originalSop),
      ...config // Override with any provided config
    };

    // Create AEF document
    const aefDocument: AEFDocument = {
      ...originalSop,
      aef: {
        config: aefConfig,
        transformedAt: new Date(),
        transformedBy: user.id,
        version: '1.0.0'
      }
    };

    // Update the SOP record with AEF configuration
    const { error: updateError } = await supabase
      .from('sops')
      .update({ 
        data: aefDocument,
        updated_at: new Date().toISOString()
      })
      .eq('job_id', sopId);

    if (updateError) {
      console.error('Error updating SOP with AEF config:', updateError);
      return NextResponse.json(
        { error: 'Failed to save AEF configuration' },
        { status: 500 }
      );
    }

    const result: AEFTransformResult = {
      success: true,
      aefDocument,
      estimatedStepCount: checkpoints.length,
      estimatedDuration: aefConfig.estimatedDuration
    };

    console.log(`AEF transformation completed for SOP ${sopId}`);
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('Error in AEF transform:', error);
    return NextResponse.json(
      { error: 'Failed to transform SOP to AEF' },
      { status: 500 }
    );
  }
}

/**
 * Generate default checkpoint configuration for all SOP steps
 */
function generateDefaultCheckpoints(sop: SOPDocument): CheckpointConfig[] {
  const checkpoints: CheckpointConfig[] = [];
  
  if (!sop.public?.nodes) {
    return checkpoints;
  }

  // Create "before execution" checkpoint for each step node
  sop.public.nodes.forEach(node => {
    if (node.type === 'step') {
      checkpoints.push({
        id: `checkpoint_${node.id}`,
        stepId: node.id,
        type: CheckpointType.BEFORE_EXECUTION,
        condition: CheckpointCondition.ALWAYS,
        required: true,
        description: `About to execute: ${node.label || node.intent || 'Step'}`,
        timeout: 300, // 5 minutes for approval
        defaultAction: CheckpointAction.REJECT
      });
    }
  });

  return checkpoints;
}

/**
 * Estimate execution duration based on number of steps
 */
function estimateExecutionDuration(sop: SOPDocument): number {
  if (!sop.public?.nodes) {
    return 5; // Default 5 minutes
  }

  const stepCount = sop.public.nodes.filter(node => node.type === 'step').length;
  
  // Rough estimate: 2 minutes per step (including checkpoints)
  return Math.max(stepCount * 2, 5);
} 