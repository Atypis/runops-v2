import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';
import { BrowserAction } from '@/lib/browser/types';
import { ExecutionEngine } from '@/aef/execution_engine/engine';
import fs from 'fs';
import path from 'path';

/**
 * POST /api/aef/action/[id]
 * Executes an individual step within an AEF workflow
 * Allows granular control over step execution
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

    const { id: executionId } = params;
    const body = await request.json();
    const { stepId, action, browserAction } = body;

    if (!executionId || !stepId) {
      return NextResponse.json(
        { error: 'Execution ID and Step ID are required' },
        { status: 400 }
      );
    }

    const validActions = ['execute', 'skip', 'retry', 'pause'];
    if (!action || !validActions.includes(action)) {
      return NextResponse.json(
        { error: `Valid action is required: ${validActions.join(', ')}` },
        { status: 400 }
      );
    }

    console.log(`Executing action '${action}' on step ${stepId} for execution ${executionId}, user ${user.id}`);

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
        { error: 'Access denied: You can only control your own executions' },
        { status: 403 }
      );
    }

    const executionRecord = metadata.execution_record;

    // Execute individual node with ExecutionEngine if no specific browserAction is provided
    let engineResult = null;
    let browserResult = null;

    if (action === 'execute') {
      if (browserAction) {
        // Execute browser action directly
        try {
          console.log(`Executing browser action for step ${stepId}:`, browserAction);
          
          const browserActionData: BrowserAction = {
            type: browserAction.type,
            data: browserAction.data,
            stepId
          };
          
          browserResult = await hybridBrowserManager.executeAction(executionId, browserActionData);
          console.log(`Browser action completed for step ${stepId}`);
          
        } catch (error) {
          console.error(`Browser action failed for step ${stepId}:`, error);
          return NextResponse.json(
            { 
              error: 'Browser action failed', 
              details: error instanceof Error ? error.message : 'Unknown error',
              stepId 
            },
            { status: 500 }
          );
        }
      } else {
        // Execute node with ExecutionEngine (for hardcoded test workflow)
        try {
          console.log(`Executing individual node ${stepId} with ExecutionEngine`);
          
          // Load the hardcoded test workflow
          const testDocPath = path.join(process.cwd(), 'stagehand-test', 'downloads', 'investor_email_crm_workflow.json');
          
          if (fs.existsSync(testDocPath)) {
            const testDocContent = fs.readFileSync(testDocPath, 'utf8');
            const testDoc = JSON.parse(testDocContent);
            
            const engine = new ExecutionEngine(testDoc);
            engineResult = await engine.executeNodeById(executionId, stepId);
            
            console.log(`ExecutionEngine result:`, engineResult);
          } else {
            console.warn('Test workflow file not found, falling back to browser action');
          }
        } catch (error) {
          console.error(`ExecutionEngine failed for step ${stepId}:`, error);
          return NextResponse.json(
            { 
              error: 'ExecutionEngine failed', 
              details: error instanceof Error ? error.message : 'Unknown error',
              stepId 
            },
            { status: 500 }
          );
        }
      }
    }
    
    // Update execution record with step action
    const stepAction = {
      stepId,
      action,
      timestamp: new Date().toISOString(),
      userId: user.id,
      browserResult: browserResult || undefined,
      engineResult: engineResult || undefined
    };

    // Add to action queue
    if (!executionRecord.step_actions) {
      executionRecord.step_actions = [];
    }
    executionRecord.step_actions.push(stepAction);

    // Update current step if executing
    if (action === 'execute') {
      executionRecord.current_step = stepId;
      if (engineResult) {
        executionRecord.last_action = `ExecutionEngine: ${engineResult.message}`;
        // Set next suggested step if available
        if (engineResult.nextNodeId) {
          executionRecord.next_suggested_step = engineResult.nextNodeId;
        }
      } else {
        executionRecord.last_action = `Executing step ${stepId}`;
      }
    } else if (action === 'skip') {
      executionRecord.last_action = `Skipped step ${stepId}`;
    } else if (action === 'pause') {
      executionRecord.status = 'paused';
      executionRecord.last_action = `Paused at step ${stepId}`;
    }

    // Update job status
    let newStatus = job.status;
    if (action === 'pause') {
      newStatus = 'aef_execution_paused';
    } else if (job.status === 'aef_execution_paused') {
      newStatus = 'aef_execution_running'; // Resume if was paused
    }

    // Save updated execution state
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
      .eq('job_id', executionId);

    if (updateError) {
      console.error('Error updating step action:', updateError);
      return NextResponse.json(
        { error: 'Failed to execute step action' },
        { status: 500 }
      );
    }

    // Generate response with next suggested action
    let nextSuggestedAction = null;
    if (action === 'execute') {
      if (engineResult && engineResult.nextNodeId) {
        nextSuggestedAction = `continue_to_${engineResult.nextNodeId}`;
      } else {
        nextSuggestedAction = 'wait_for_completion';
      }
    } else if (action === 'skip') {
      nextSuggestedAction = 'continue_to_next_step';
    } else if (action === 'pause') {
      nextSuggestedAction = 'execution_paused';
    }

    console.log(`Step action '${action}' on step ${stepId} completed successfully`);
    
    return NextResponse.json({
      status: 'success',
      executionId,
      stepId,
      action,
      executionStatus: newStatus,
      nextSuggestedAction,
      timestamp: stepAction.timestamp,
      browserResult: browserResult || undefined,
      engineResult: engineResult || undefined
    });

  } catch (error) {
    console.error('Error executing step action:', error);
    return NextResponse.json(
      { error: 'Failed to execute step action' },
      { status: 500 }
    );
  }
} 