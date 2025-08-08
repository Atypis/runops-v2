import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';

const serviceRoleSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/aef/executions
 * Creates a new execution record - SINGLE SOURCE OF TRUTH for execution IDs
 * This is the ONLY endpoint that can mint new execution IDs
 */
export async function POST(request: NextRequest) {
  try {
    const { workflowId = 'gmail-investor-crm-v2', workflowDefinition } = await request.json();

    // Get authenticated user
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`🎯 [Executions API] Creating new execution for user ${user.email}`);
    console.log(`📋 [Executions API] Workflow: ${workflowId}`);

    // Create execution record in database (single source of truth)
    const { data: execution, error } = await serviceRoleSupabase
      .from('executions')
      .insert({
        workflow_id: workflowId,
        user_id: user.id,
        status: 'pending',
        workflow_definition: workflowDefinition || {},
        execution_state: {},
        total_nodes: 0,
        completed_nodes: 0,
        failed_nodes: 0
      })
      .select()
      .single();

    if (error) {
      console.error('❌ [Executions API] Failed to create execution:', error);
      return NextResponse.json(
        { error: 'Failed to create execution', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ [Executions API] Execution created: ${execution.id}`);

    return NextResponse.json({
      success: true,
      executionId: execution.id,
      execution: {
        id: execution.id,
        workflowId: execution.workflow_id,
        userId: execution.user_id,
        status: execution.status,
        createdAt: execution.created_at
      },
      message: 'Execution created successfully'
    });

  } catch (error) {
    console.error('❌ [Executions API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/aef/executions
 * Lists executions for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workflowId = searchParams.get('workflowId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '10');

    // Get authenticated user
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`🔍 [Executions API] Listing executions for user ${user.email}`);

    // Build query
    let query = serviceRoleSupabase
      .from('executions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data: executions, error } = await query;

    if (error) {
      console.error('❌ [Executions API] Failed to list executions:', error);
      return NextResponse.json(
        { error: 'Failed to list executions', details: error.message },
        { status: 500 }
      );
    }

    console.log(`✅ [Executions API] Found ${executions.length} executions`);

    return NextResponse.json({
      success: true,
      executions: executions.map(exec => ({
        id: exec.id,
        workflowId: exec.workflow_id,
        status: exec.status,
        createdAt: exec.created_at,
        updatedAt: exec.updated_at,
        startedAt: exec.started_at,
        completedAt: exec.completed_at,
        currentNodeId: exec.current_node_id,
        totalNodes: exec.total_nodes,
        completedNodes: exec.completed_nodes,
        failedNodes: exec.failed_nodes
      }))
    });

  } catch (error) {
    console.error('❌ [Executions API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 