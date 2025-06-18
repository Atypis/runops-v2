import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { ExecutionEngine } from '@/aef/execution_engine/engine';
import { ServerWorkflowLoader } from '@/lib/workflow/ServerWorkflowLoader';
import { WorkflowLoadError, WorkflowValidationError } from '@/lib/workflow/WorkflowLoader';
import { v4 as uuidv4 } from 'uuid';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';

/**
 * POST /api/aef/execute-nodes
 * Executes selected nodes sequentially in workflow order
 * Stops on first failure (unlike executeNodesConsecutively which continues)
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
    const { executionId, workflowId, nodeIds } = body;

    if (!workflowId || !nodeIds || !Array.isArray(nodeIds)) {
      return NextResponse.json(
        { error: 'workflowId and nodeIds array are required' },
        { status: 400 }
      );
    }

    if (nodeIds.length === 0) {
      return NextResponse.json(
        { error: 'At least one nodeId must be provided' },
        { status: 400 }
      );
    }

    if (nodeIds.length > 25) {
      return NextResponse.json(
        { error: 'Maximum 25 nodes can be executed at once' },
        { status: 400 }
      );
    }

    console.log(`🎯 [execute-nodes] Starting execution of ${nodeIds.length} nodes for workflow ${workflowId}`);

    // Load the workflow
    let workflow;
    try {
      workflow = await ServerWorkflowLoader.loadWorkflow(workflowId);
    } catch (error) {
      console.error('❌ Failed to load workflow:', error);
      
      if (error instanceof WorkflowValidationError) {
        return NextResponse.json(
          { error: `Workflow validation failed: ${error.message}` },
          { status: 400 }
        );
      }
      
      if (error instanceof WorkflowLoadError) {
        return NextResponse.json(
          { error: `Failed to load workflow: ${error.message}` },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to load workflow document' },
        { status: 500 }
      );
    }

    // Validate all nodeIds exist in workflow
    const workflowNodeIds = new Set(workflow.execution.workflow.nodes.map(n => n.id));
    const invalidNodes = nodeIds.filter(id => !workflowNodeIds.has(id));
    if (invalidNodes.length > 0) {
      return NextResponse.json(
        { error: `Invalid node IDs: ${invalidNodes.join(', ')}` },
        { status: 400 }
      );
    }

    // Sort nodeIds by their position in the workflow to maintain execution order
    const nodeIndexMap = new Map();
    workflow.execution.workflow.nodes.forEach((node, index) => {
      nodeIndexMap.set(node.id, index);
    });
    
    const sortedNodeIds = [...nodeIds].sort((a, b) => {
      return nodeIndexMap.get(a) - nodeIndexMap.get(b);
    });

    console.log(`📋 [execute-nodes] Execution order: ${sortedNodeIds.join(' → ')}`);

    // Use existing executionId or generate new one
    const finalExecutionId = executionId || uuidv4();

    // Ensure browser session exists for this execution
    if (!executionId) {
      console.log(`🌐 [execute-nodes] Creating new browser session for execution ${finalExecutionId}`);
      try {
        const browserSession = await hybridBrowserManager.createSession({
          executionId: finalExecutionId,
          userId: user.id,
          headless: false,
          viewport: { width: 1280, height: 720 },
          mode: 'docker'
        });
        console.log(`✅ [execute-nodes] Browser session created: ${browserSession.id}`);
      } catch (error) {
        console.error('❌ [execute-nodes] Failed to create browser session:', error);
        return NextResponse.json(
          { error: 'Failed to initialize browser session' },
          { status: 500 }
        );
      }
    }

    // Create ExecutionEngine instance
    const engine = new ExecutionEngine(workflow as any, user.id, finalExecutionId, workflowId);
    
    // Set supabase client for credential access
    const { createClient } = await import('@supabase/supabase-js');
    const serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    engine.setSupabaseClient(serviceRoleClient);

    // Execute nodes sequentially with failure stopping
    const results = new Map<string, { success: boolean; message: string; nextNodeId?: string }>();
    let failedNodeId: string | null = null;

    for (let i = 0; i < sortedNodeIds.length; i++) {
      const nodeId = sortedNodeIds[i];
      const node = workflow.execution.workflow.nodes.find(n => n.id === nodeId);
      
      console.log(`⚡ [execute-nodes] Executing node ${i + 1}/${sortedNodeIds.length}: ${nodeId} (${node?.label})`);
      
      try {
        const result = await engine.executeNodeById(nodeId);
        results.set(nodeId, result);
        
        if (!result.success) {
          console.error(`❌ [execute-nodes] Node ${nodeId} failed: ${result.message}`);
          failedNodeId = nodeId;
          break; // Stop on failure
        }
        
        console.log(`✅ [execute-nodes] Node ${nodeId} completed successfully`);
        
        // Add delay between nodes for better observability
        if (i < sortedNodeIds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`❌ [execute-nodes] Node ${nodeId} threw exception:`, error);
        
        results.set(nodeId, {
          success: false,
          message: `Execution failed: ${errorMessage}`
        });
        
        failedNodeId = nodeId;
        break; // Stop on exception
      }
    }

    // Create execution record for tracking
    const executionRecord = {
      id: finalExecutionId,
      sop_id: workflowId,
      user_id: user.id,
      status: failedNodeId ? 'partial_execution_failed' : 'partial_execution_completed',
      created_at: new Date().toISOString(),
      config: {
        nodeIds: sortedNodeIds,
        executionType: 'selected_nodes'
      },
      execution_context: {
        selectedNodes: sortedNodeIds,
        completedNodes: Array.from(results.keys()).filter(id => results.get(id)?.success),
        failedNodeId,
        totalSelected: sortedNodeIds.length,
        totalCompleted: Array.from(results.values()).filter(r => r.success).length
      }
    };

    // Store execution record
    const { error: insertError } = await supabase
      .from('jobs')
      .insert({
        job_id: finalExecutionId,
        status: failedNodeId ? 'partial_execution_failed' : 'partial_execution_completed',
        metadata: {
          type: 'aef_partial_execution',
          user_id: user.id,
          workflow_id: workflowId,
          execution_record: executionRecord
        },
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.warn('⚠️ [execute-nodes] Failed to store execution record:', insertError);
      // Continue anyway - execution results are more important
    }

    const completedCount = Array.from(results.values()).filter(r => r.success).length;
    
    console.log(`🎉 [execute-nodes] Execution completed: ${completedCount}/${sortedNodeIds.length} nodes successful`);
    
    if (failedNodeId) {
      console.log(`💥 [execute-nodes] Execution stopped at failed node: ${failedNodeId}`);
    }

    return NextResponse.json({
      success: !failedNodeId,
      executionId: finalExecutionId,
      results: Object.fromEntries(results),
      summary: {
        totalSelected: sortedNodeIds.length,
        totalCompleted: completedCount,
        failedNodeId,
        executionOrder: sortedNodeIds
      }
    });

  } catch (error) {
    console.error('❌ [execute-nodes] API error:', error);
    return NextResponse.json(
      { error: 'Failed to execute selected nodes' },
      { status: 500 }
    );
  }
} 