import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ExecutionEngine } from '@/aef/execution_engine/engine';
import { ServerWorkflowLoader } from '@/lib/workflow/ServerWorkflowLoader';
import { createSupabaseServerClient } from '@/lib/supabase-server';

const serviceRoleSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { nodeIds, executionId, workflowId = 'gmail-investor-crm-v2' } = await request.json();

    if (!nodeIds || !Array.isArray(nodeIds) || nodeIds.length === 0) {
      return NextResponse.json(
        { error: 'nodeIds array is required' },
        { status: 400 }
      );
    }

    if (!executionId) {
      return NextResponse.json(
        { error: 'executionId is required' },
        { status: 400 }
      );
    }

    // Get authenticated user from session using the same pattern as other routes
    const supabase = createSupabaseServerClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('❌ [Execute Nodes API] Authentication failed:', authError);
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`🎯 [Execute Nodes API] Executing ${nodeIds.length} nodes for user ${user.id}:`, nodeIds);
    console.log(`🔐 [Execute Nodes API] User authenticated successfully: ${user.email}`);

    // Load the workflow
    const workflow = await ServerWorkflowLoader.loadWorkflow(workflowId);
    
    // Transform to AEF document format (simplified for node execution)
    const aefDocument = {
      id: workflow.meta.id,
      title: workflow.meta.title,
      public: {
        nodes: workflow.execution.workflow.nodes,
        flow: workflow.execution.workflow.flow
      },
      aef: {
        config: {
          executionMethod: 'browser_automation' as const,
          pauseOnErrors: false,
          retryAttempts: 1
        }
      },
      execution: {
        environment: {
          required_tabs: workflow.execution.environment?.required_tabs || []
        },
        workflow: workflow.execution.workflow
      }
    };

    // Create execution engine using the workflow directly with authenticated user
    const engine = new ExecutionEngine(workflow as any, user.id, workflowId);
    
    // Pass the service role supabase client to the engine for credential access
    engine.setSupabaseClient(serviceRoleSupabase);
    
    // Execute nodes consecutively
    const results = await engine.executeNodesConsecutively(executionId, nodeIds);
    
    // Convert Map to object for JSON response
    const resultsObject: Record<string, { success: boolean; message: string; nextNodeId?: string }> = {};
    results.forEach((value, key) => {
      resultsObject[key] = value;
    });

    console.log(`✅ [Execute Nodes API] Completed execution of ${nodeIds.length} nodes`);

    return NextResponse.json({
      success: true,
      executedNodes: nodeIds.length,
      results: resultsObject
    });

  } catch (error) {
    console.error('❌ [Execute Nodes API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to execute nodes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 