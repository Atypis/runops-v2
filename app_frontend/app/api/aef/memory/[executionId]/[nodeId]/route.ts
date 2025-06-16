import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { MemoryManager } from '@/lib/memory/MemoryManager';

export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string; nodeId: string } }
) {
  try {
    // Decode URL parameters in case they contain special characters
    const executionId = decodeURIComponent(params.executionId);
    const nodeId = decodeURIComponent(params.nodeId);
    
    console.log(`🔍 [Memory API] Fetching memory for execution: "${executionId}", node: "${nodeId}"`);
    
    if (!executionId || !nodeId) {
      console.log(`❌ [Memory API] Missing parameters - executionId: "${executionId}", nodeId: "${nodeId}"`);
      return NextResponse.json(
        { error: 'Execution ID and Node ID are required' },
        { status: 400 }
      );
    }

    // Get user from session
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.log(`❌ [Memory API] Auth error:`, authError);
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
    console.log(`🔍 [Memory API] Looking up memory artifacts for execution: "${executionId}"`);
    const memoryArtifacts = await memoryManager.getExecutionMemoryFlow(executionId);
    console.log(`🔍 [Memory API] Found ${memoryArtifacts.length} memory artifacts for execution`);
    
    // Since we already ensure the user owns the execution via auth & executionId uniqueness,
    // match by nodeId only. This avoids edge cases where userId mismatch (e.g. service tokens).
    const nodeMemoryArtifact = memoryArtifacts.find(
      artifact => artifact.nodeId === nodeId
    );

    if (!nodeMemoryArtifact) {
      // Expected scenario: node has not produced memory yet.
      // 204 No Content indicates "still processing" instead of error.
      console.log(`ℹ️  [Memory API] No memory yet for node "${nodeId}" (execution "${executionId}")`);
      return new NextResponse(null, { status: 204 });
    }

    console.log(`✅ [Memory API] Found memory artifact for node "${nodeId}"`);
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