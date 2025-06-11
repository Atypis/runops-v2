import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';
import { BrowserAction } from '@/lib/browser/types';
import { ExecutionEngine } from '@/aef/execution_engine/engine';
import { CredentialInjectionService } from '@/lib/credentials/injection';
import { ServerWorkflowLoader } from '@/lib/workflow/ServerWorkflowLoader';
import { WorkflowLoadError, WorkflowValidationError } from '@/lib/workflow/WorkflowLoader';
import { HybridActionMapper } from '@/lib/workflow/HybridActionMapper';

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

    let executionId = params.id;
    console.log(`🎯 [AEF API] Received request for execution: ${executionId}`);
    const body = await request.json();
    console.log(`🎯 [AEF API] Request body:`, body);
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
    // For VNC environments, extract UUID part for database lookup
    let databaseId = executionId.startsWith('vnc-env-') 
      ? executionId.replace('vnc-env-', '') 
      : executionId;
    
    // SAFETY CHECK: Validate UUID format to prevent PostgreSQL errors
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUuid = uuidRegex.test(databaseId);
    
    console.log(`🔍 Looking for execution in database:`);
    console.log(`  - Full execution ID: ${executionId}`);
    console.log(`  - Database lookup ID: ${databaseId}`);
    console.log(`  - UUID valid: ${isValidUuid}`);
    
    let job = null;
    let findError = null;
    
    // Only attempt database lookup if we have a valid UUID
    if (isValidUuid) {
      const { data, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('job_id', databaseId)
        .single();
      
      job = data;
      findError = error;
    } else {
      console.warn(`⚠️ Invalid UUID format detected: ${databaseId}`);
      findError = { code: 'INVALID_UUID', message: 'Invalid UUID format' };
    }

    // ENHANCED WORKAROUND: If exact match fails for VNC environments, try to find the most recent VNC job
    if (findError && executionId.startsWith('vnc-env-')) {
      console.log(`⚠️ Exact match failed (${findError.code}), trying to find most recent VNC job for user ${user.id}`);
      
      const { data: recentJobs, error: recentError } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'aef_vnc_ready')
        .order('created_at', { ascending: false })
        .limit(5); // Increased limit to 5 for better coverage
        
      if (!recentError && recentJobs && recentJobs.length > 0) {
        // Find the most recent job for this user (created in the last 15 minutes)
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
        const userJob = recentJobs.find(j => {
          const metadata = j.metadata as any;
          const isForUser = metadata?.user_id === user.id || metadata?.execution_record?.user_id === user.id;
          const isRecent = j.created_at > fifteenMinutesAgo;
          return isForUser && isRecent;
        });
        
        if (userJob) {
          console.log(`✅ Found recent VNC job: ${userJob.job_id} (created: ${userJob.created_at})`);
          console.log(`📧 Using this job for execution instead of ${executionId}`);
          job = userJob;
          findError = null;
          
          // CRITICAL FIX: Update executionId to the correct one from the found job
          const correctExecutionId = (userJob.metadata as any)?.execution_record?.execution_id;
          if (correctExecutionId) {
            console.log(`🔄 Correcting execution ID from ${executionId} to ${correctExecutionId}`);
            executionId = correctExecutionId;
          }
        } else {
          console.log(`❌ No recent VNC jobs found for user ${user.id} in the last 15 minutes`);
        }
      }
    }

    // ULTIMATE FALLBACK: If still no database record found, check Docker directly for running container
    if (findError && (executionId.startsWith('vnc-env-') || executionId.startsWith('single-vnc-'))) {
      console.log(`🐳 Ultimate fallback: Checking Docker for running containers...`);
      
      try {
        const { execSync } = require('child_process');
        
        // Check for containers with patterns that might match this execution
        const dockerOutput = execSync('docker ps --format "{{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(aef-browser|aef-vnc-single)"', { encoding: 'utf8' });
        
        if (dockerOutput.trim()) {
          console.log(`🎯 Found running Docker containers: ${dockerOutput.trim()}`);
          
          // For single VNC sessions, use the execution ID as-is for the database ID
          // This creates a mock execution record that bypasses the UUID requirement
          const mockDatabaseId = executionId.startsWith('single-vnc-') ? executionId : databaseId;
          
          // Create a minimal execution record for Docker-only execution
          const mockJob = {
            job_id: mockDatabaseId,
            status: 'aef_vnc_ready',
            metadata: {
              execution_record: {
                execution_id: executionId,
                user_id: user.id,
                document_id: 'test-investor-email-workflow',
                status: 'vnc_ready',
                created_at: new Date().toISOString(),
                execution_context: {
                  variables: {},
                  currentStepIndex: 0,
                  totalSteps: 8,
                  sessionType: executionId.startsWith('single-vnc-') ? 'single_vnc_session' : 'vnc_environment'
                },
                step_actions: []
              },
              user_id: user.id
            },
            progress_stage: 'vnc_environment_ready',
            progress_percent: 0,
            created_at: new Date().toISOString()
          };
          
          console.log(`✅ Created mock execution record for Docker-only execution (single VNC: ${executionId.startsWith('single-vnc-')})`);
          job = mockJob;
          findError = null;
        }
      } catch (dockerError) {
        console.warn(`⚠️ Docker fallback check failed:`, dockerError instanceof Error ? dockerError.message : 'Unknown error');
      }
    }

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
          
          let browserActionData: BrowserAction = {
            type: browserAction.type,
            data: browserAction.data,
            stepId
          };
          
          // ✅ NEW: Inject credentials if needed
          if (CredentialInjectionService.actionRequiresCredentials(browserActionData)) {
            console.log(`🔐 [AEF Action] Action requires credential injection for step ${stepId}`);
            
            // Get credentials for this step
            const credentials = await CredentialInjectionService.getCredentialsForStep(
              stepId,
              user.id,
              'test-investor-email-workflow' // Use test workflow ID
            );
            
            // Inject credentials into action
            browserActionData = CredentialInjectionService.injectCredentialsIntoAction(
              browserActionData,
              credentials
            );
            
            // Clear credentials from memory for security
            CredentialInjectionService.clearCredentialsFromMemory(credentials);
            
            console.log(`✅ [AEF Action] Credentials injected for step ${stepId}`);
          }
          
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
        // Execute actions directly on existing VNC environment
        try {
          console.log(`🎯 [AEF API] Executing individual node ${stepId} with direct browser actions`);
          console.log(`🎯 [AEF API] Using existing VNC executionId: ${executionId}`);
          
          // Load workflow from JSON - NEW APPROACH
          let workflow;
          try {
            console.log(`🔄 [AEF API] Loading JSON workflow for execution...`);
            workflow = await ServerWorkflowLoader.loadWorkflow('gmail-investor-crm');
            console.log(`✅ [AEF API] Successfully loaded workflow: ${workflow.meta.title}`);
          } catch (error) {
            console.error('❌ [AEF API] Failed to load JSON workflow:', error);
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
              { error: 'Failed to load workflow' },
              { status: 500 }
            );
          }
          
          // Find the specific node to execute
          const targetNode = workflow.execution.workflow.nodes.find((node: any) => node.id === stepId);
          if (!targetNode) {
            console.error(`❌ [AEF API] Node ${stepId} not found in workflow`);
            return NextResponse.json(
              { error: 'Node not found', stepId },
              { status: 404 }
            );
          }
          
          console.log(`🎯 [AEF API] Found target node:`, targetNode);
          
          // Execute the node's actions directly using HybridBrowserManager
          if (targetNode.actions && targetNode.actions.length > 0) {
            
            console.log(`🎯 [AEF API] Executing ${targetNode.actions.length} actions for node ${stepId}`);
            
            for (const action of targetNode.actions) {
              console.log(`🎯 [AEF API] Executing action:`, action);
              
              try {
                // Convert action to BrowserAction format
                const browserAction: BrowserAction = {
                  type: action.type as any,
                  data: {
                    instruction: action.instruction,
                    target: (action as any).target,
                    text: (action as any).text,
                    duration: (action as any).duration,
                    url: (action as any).target?.url,
                    schema: (action as any).schema
                  },
                  stepId: stepId
                };
                
                await hybridBrowserManager.executeAction(executionId, browserAction);
                console.log(`✅ [AEF API] Action executed successfully`);
              } catch (actionError) {
                console.error(`❌ [AEF API] Action failed:`, actionError);
                throw actionError;
              }
            }
            
            engineResult = {
              success: true,
              message: `Successfully executed ${targetNode.actions.length} actions for ${stepId}`,
              executionId: executionId, // Use the same executionId
              nodeId: stepId
            };
          } else {
            console.log(`🎯 [AEF API] Node ${stepId} has no actions to execute`);
            engineResult = {
              success: true,
              message: `Node ${stepId} has no actions to execute`,
              executionId: executionId,
              nodeId: stepId
            };
          }
          
          console.log(`🎯 [AEF API] Direct action execution result:`, engineResult);
        } catch (error) {
          console.error(`❌ [AEF API] Direct action execution failed for step ${stepId}:`, error);
          return NextResponse.json(
            { 
              error: 'Direct action execution failed', 
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
        executionRecord.last_action = `DirectExecution: ${engineResult.message}`;
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

    // Save updated execution state (skip for VNC-only executions without real database records)
    const isVncOnlyExecution = executionId.startsWith('single-vnc-') && !isValidUuid;
    
    if (!isVncOnlyExecution) {
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
        .eq('job_id', databaseId);

      if (updateError) {
        console.error('Error updating step action:', updateError);
        return NextResponse.json(
          { error: 'Failed to execute step action' },
          { status: 500 }
        );
      }
    } else {
      console.log(`🔄 [AEF API] Skipping database update for VNC-only execution: ${executionId}`);
    }

    // Generate response with next suggested action
    let nextSuggestedAction = null;
    if (action === 'execute') {
      nextSuggestedAction = 'wait_for_completion';
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