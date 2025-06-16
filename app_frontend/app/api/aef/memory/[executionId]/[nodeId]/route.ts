import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { MemoryManager } from '@/lib/memory/MemoryManager';

export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string; nodeId: string } }
) {
  try {
    const { executionId, nodeId } = params;
    
    if (!executionId || !nodeId) {
      return NextResponse.json(
        { error: 'Execution ID and Node ID are required' },
        { status: 400 }
      );
    }

    // Get user from session
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Use service-role client for memory lookup (bypass RLS) but still enforce user ownership manually
    const { createClient } = await import('@supabase/supabase-js');
    const serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const memoryManager = new MemoryManager(serviceRoleClient);

    // Get memory artifact for specific node
    const memoryArtifacts = await memoryManager.getExecutionMemoryFlow(executionId);
    
    // For single-vnc executions, don't filter by user ID since they're ephemeral
    // and may not have proper user context during Docker execution
    const isSingleVncExecution = executionId.startsWith('single-vnc-');
    
    let nodeMemoryArtifact;
    if (isSingleVncExecution) {
      // For single-vnc executions, just match by nodeId (no user filtering)
      nodeMemoryArtifact = memoryArtifacts.find(
        artifact => artifact.nodeId === nodeId
      );
      console.log(`[Memory API] Single-VNC execution detected, bypassing user filtering for ${executionId}`);
    } else {
      // For regular executions, ensure user owns the execution
      nodeMemoryArtifact = memoryArtifacts.find(
        artifact => artifact.nodeId === nodeId && artifact.userId === user.id
      );
    }

    if (!nodeMemoryArtifact) {
      return NextResponse.json(
        { error: 'Memory artifact not found for this node' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      executionId,
      nodeId,
      memoryArtifact: nodeMemoryArtifact
    });

  } catch (error) {
    console.error('Failed to fetch node memory:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch node memory',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { executionId: string; nodeId: string } }
) {
  try {
    const { executionId, nodeId } = params;
    const body = await request.json();
    
    if (!executionId || !nodeId) {
      return NextResponse.json(
        { error: 'Execution ID and Node ID are required' },
        { status: 400 }
      );
    }

    // Get user from session
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Use service-role client for memory lookup (bypass RLS) but still enforce user ownership manually
    const { createClient } = await import('@supabase/supabase-js');
    const serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const memoryManager = new MemoryManager(serviceRoleClient);

    // Create or update memory artifact
    const memoryArtifact = await memoryManager.captureNodeMemory(
      executionId,
      nodeId,
      user.id,
      body.inputs,
      body.processing,
      body.outputs,
      body.forwardingRules
    );

    return NextResponse.json({
      success: true,
      executionId,
      nodeId,
      memoryArtifact
    });

  } catch (error) {
    console.error('Failed to save node memory:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to save node memory',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 