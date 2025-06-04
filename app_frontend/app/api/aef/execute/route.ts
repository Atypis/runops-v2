import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { AEFDocument, isAEFDocument } from '@/lib/types/aef';
import { ExecutionStatus } from '@/lib/types/execution';
import { v4 as uuidv4 } from 'uuid';

/**
 * POST /api/aef/execute
 * Starts AEF execution for a transformed SOP document
 * Creates execution record and returns WebSocket URL
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
    const { aefDocumentId, stepIds } = body;

    if (!aefDocumentId) {
      return NextResponse.json(
        { error: 'aefDocumentId is required' },
        { status: 400 }
      );
    }

    console.log(`Starting AEF execution for document ${aefDocumentId}, user ${user.id}`);

    // Fetch the AEF document
    const { data: sopRecord, error: fetchError } = await supabase
      .from('sops')
      .select('*')
      .eq('job_id', aefDocumentId)
      .single();

    if (fetchError) {
      console.error('Error fetching AEF document:', fetchError);
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'AEF document not found or access denied' },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: 'Failed to fetch AEF document' },
        { status: 500 }
      );
    }

    const aefDocument: AEFDocument = sopRecord.data;
    
    // Verify this is an AEF-enabled document
    if (!isAEFDocument(aefDocument)) {
      return NextResponse.json(
        { error: 'Document is not AEF-enabled. Transform it first using /api/aef/transform' },
        { status: 400 }
      );
    }

    // Generate execution ID
    const executionId = uuidv4();
    
    // Create execution record in database
    const executionRecord = {
      id: executionId,
      sop_id: aefDocumentId,
      user_id: user.id,
      status: ExecutionStatus.IDLE,
      created_at: new Date().toISOString(),
      config: {
        stepIds: stepIds || null, // If provided, only execute specific steps
        checkpointsEnabled: true
      },
      execution_context: {
        variables: {},
        currentStepIndex: 0,
        totalSteps: aefDocument.public?.nodes?.filter(n => n.type === 'step').length || 0
      }
    };

    // For MVP: Store execution data in a simple table structure
    // We'll use the existing pattern of JSONB storage
    const { error: insertError } = await supabase
      .from('jobs') // Reuse existing jobs table for MVP
      .insert({
        job_id: executionId,
        status: 'aef_execution_queued',
        metadata: {
          type: 'aef_execution',
          user_id: user.id,
          sop_id: aefDocumentId,
          execution_record: executionRecord
        },
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error creating execution record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create execution record' },
        { status: 500 }
      );
    }

    // Generate WebSocket URL
    const protocol = request.headers.get('x-forwarded-proto') || 'http';
    const host = request.headers.get('host');
    const wsProtocol = protocol === 'https' ? 'wss' : 'ws';
    const websocketUrl = `${wsProtocol}://${host}/api/aef/live/${executionId}`;

    console.log(`AEF execution ${executionId} queued successfully`);
    
    return NextResponse.json({
      executionId,
      websocketUrl,
      status: 'queued',
      estimatedDuration: aefDocument.aef?.config.estimatedDuration || 5,
      stepCount: executionRecord.execution_context.totalSteps
    });

  } catch (error) {
    console.error('Error in AEF execute:', error);
    return NextResponse.json(
      { error: 'Failed to start AEF execution' },
      { status: 500 }
    );
  }
} 