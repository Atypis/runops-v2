import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createClient } from '@supabase/supabase-js';
import { ExecutionEngine } from '@/aef/execution_engine/engine';
import { ServerWorkflowLoader } from '@/lib/workflow/ServerWorkflowLoader';
import { singleVNCSessionManager } from '@/lib/vnc/SingleVNCSessionManager';

const serviceRoleSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { workflowId, executionId } = await request.json();

    if (!workflowId || !executionId) {
      return NextResponse.json(
        { error: 'workflowId and executionId are required' },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`🚀 [Execute Nodes API] Starting execution: ${executionId}`);
    console.log(`📋 [Execute Nodes API] Workflow: ${workflowId}`);

    /*
     * -----------------------------------------------------------------------------------
     * Execution Validation
     * -----------------------------------------------------------------------------------
     * 1. Standard executions are persisted in the "executions" table with a UUID primary key.
     * 2. "single-vnc-*" executions are ephemeral and exist only in-memory / Docker, so there
     *    is *no* corresponding database record. Attempting a normal Supabase query will cause
     *    Postgres to choke on the non-UUID string ("invalid input syntax for type uuid").
     *
     *    To avoid that, we bypass the DB check entirely for these IDs and continue straight
     *    to VNC session handling. This mirrors the logic already present in /api/aef/action
     *    which treats "single-vnc-*" IDs specially.
     */
    const isSingleVncExecution = executionId.startsWith('single-vnc-');

    if (!isSingleVncExecution) {
      // 👉 Standard persisted execution – validate ownership in database
      const { data: execution, error: execError } = await serviceRoleSupabase
        .from('executions')
        .select('id, user_id, workflow_id, status')
        .eq('id', executionId)
        .eq('user_id', user.id)
        .single();

      if (execError || !execution) {
        console.error('❌ [Execute Nodes API] Execution not found or access denied:', execError);
        return NextResponse.json(
          { error: 'Execution not found or access denied' },
          { status: 404 }
        );
      }

      console.log(`✅ [Execute Nodes API] Execution validated: ${executionId}`);
    } else {
      console.log('ℹ️  [Execute Nodes API] Detected single-VNC execution – skipping DB validation');
    }

    // 🔥 SIMPLIFIED: Use SingleVNCSessionManager only
    console.log('🖥️ [Execute Nodes API] Ensuring VNC session is ready...');
    
    const vncManager = singleVNCSessionManager;
    let isVncReady = await vncManager.isSessionReady();
    
    if (!isVncReady) {
      console.log('🚀 [Execute Nodes API] Creating new VNC session...');
      await vncManager.createSession();
      isVncReady = await vncManager.isSessionReady();
    }
    
    if (!isVncReady) {
      console.error('❌ [Execute Nodes API] Failed to create VNC session');
      return NextResponse.json(
        { error: 'Failed to create browser session' },
        { status: 500 }
      );
    }
    
    const vncSession = vncManager.getCurrentSession();
    console.log(`✅ [Execute Nodes API] VNC session ready: ${vncSession?.id}`);
    console.log(`🔧 [Execute Nodes API] VNC URL: ${vncManager.getVNCUrl()}`);

    // Load the workflow
    const workflow = await ServerWorkflowLoader.loadWorkflow(workflowId);
    
    // Create execution engine using the workflow directly with authenticated user
    const engine = new ExecutionEngine(workflow as any, user.id, executionId, workflowId);
    
    // Pass the service role supabase client to the engine for credential access
    engine.setSupabaseClient(serviceRoleSupabase);

    // 🔥 SIMPLIFIED: Execute workflow using VNC session
    console.log('⚡ [Execute Nodes API] Starting workflow execution...');
    
    // Start the workflow execution (this will execute all nodes in sequence)
    await engine.start();

    console.log('✅ [Execute Nodes API] Workflow execution completed');

    return NextResponse.json({
      success: true,
      executionId,
      message: 'Workflow executed successfully using VNC session'
    });

  } catch (error) {
    console.error('❌ [Execute Nodes API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 