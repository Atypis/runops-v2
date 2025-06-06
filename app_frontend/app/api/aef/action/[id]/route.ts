import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';
import { BrowserAction } from '@/lib/browser/types';
import { ExecutionEngine } from '@/aef/execution_engine/engine';

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

    let { id: executionId } = params;
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
    // For VNC environments, extract UUID part for database lookup
    const databaseId = executionId.startsWith('vnc-env-') 
      ? executionId.replace('vnc-env-', '') 
      : executionId;
      
    console.log(`🔍 Looking for execution in database:`);
    console.log(`  - Full execution ID: ${executionId}`);
    console.log(`  - Database lookup ID: ${databaseId}`);
      
    let { data: job, error: findError } = await supabase
      .from('jobs')
      .select('*')
      .eq('job_id', databaseId)
      .single();

    // WORKAROUND: If exact match fails for VNC environments, try to find the most recent VNC job
    if (findError && executionId.startsWith('vnc-env-')) {
      console.log(`⚠️ Exact match failed, trying to find most recent VNC job for user ${user.id}`);
      
      const { data: recentJobs, error: recentError } = await supabase
        .from('jobs')
        .select('*')
        .eq('status', 'aef_vnc_ready')
        .order('created_at', { ascending: false })
        .limit(3);
        
      if (!recentError && recentJobs && recentJobs.length > 0) {
        // Find the most recent job for this user (created in the last 10 minutes)
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const userJob = recentJobs.find(j => {
          const metadata = j.metadata as any;
          const isForUser = metadata?.user_id === user.id || metadata?.execution_record?.user_id === user.id;
          const isRecent = j.created_at > tenMinutesAgo;
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
          console.log(`❌ No recent VNC jobs found for user ${user.id} in the last 10 minutes`);
        }
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
          
          // Use the same hardcoded test workflow as AEFControlCenter
          const HARDCODED_TEST_WORKFLOW = {
            "meta": {
              "id": "test-investor-email-workflow",
              "title": "Investor Email CRM Workflow (TEST)",
              "version": "1.0",
              "goal": "Extract investor information from an email and add it to a CRM.",
              "purpose": "A test SOP for developing the execution engine.",
              "owner": ["aef-dev-team"]
            },
            "execution": {
              "environment": {
                "required_tabs": [
                  { "name": "Gmail", "url": "https://mail.google.com/mail/u/0/#inbox" },
                  { "name": "Airtable CRM", "url": "https://airtable.com/appXXX/tblYYY/viwZZZ" }
                ]
              },
              "workflow": {
                "nodes": [
                  {
                    "id": "start_workflow",
                    "type": "task",
                    "label": "Open Gmail",
                    "intent": "Navigate to the Gmail inbox to begin email processing.",
                    "context": "The first step is to open the Gmail interface. This provides access to the email list where we'll identify investor-related emails for processing.",
                    "actions": [
                      {
                        "type": "navigate_or_switch_tab",
                        "instruction": "Navigate to https://mail.google.com/mail/u/0/#inbox or switch to Gmail tab if already open",
                        "target": { "url": "https://mail.google.com/mail/u/0/#inbox" }
                      }
                    ]
                  },
                  {
                    "id": "scan_email_list",
                    "type": "task", 
                    "label": "Scan Email List",
                    "intent": "Visually scan the email list to identify potential investor-related emails.",
                    "context": "Look through the email list in the inbox to find emails that might contain investor information, inquiries, or business opportunities.",
                    "actions": [
                      {
                        "type": "visual_scan",
                        "instruction": "Scan the email list for subject lines and senders that might indicate investor-related content"
                      }
                    ]
                  },
                  {
                    "id": "email_processing_loop",
                    "type": "iterative_loop",
                    "label": "Process Each Investor Email",
                    "intent": "For each identified investor email, extract information and add to CRM.",
                    "context": "This loop processes each investor-related email found in the inbox.",
                    "children": [
                      "select_email",
                      "extract_investor_info", 
                      "open_airtable",
                      "add_to_crm",
                      "mark_processed"
                    ]
                  },
                  {
                    "id": "select_email",
                    "type": "task",
                    "label": "Select Investor Email",
                    "intent": "Click on an unprocessed investor email to open it.",
                    "context": "Select and open the next investor email that needs to be processed.",
                    "actions": [
                      {
                        "type": "click",
                        "instruction": "Click on the first unprocessed investor email in the list",
                        "target": { "selector": "[data-thread-id]:not([data-processed='true'])" }
                      }
                    ]
                  },
                  {
                    "id": "extract_investor_info",
                    "type": "task",
                    "label": "Extract Investor Information", 
                    "intent": "Read and extract key investor details from the email content.",
                    "context": "Parse the email content to identify investor name, company, contact information, investment interests, and other relevant details.",
                    "actions": [
                      {
                        "type": "visual_scan",
                        "instruction": "Read email content and identify investor information including name, company, email, phone, investment focus"
                      }
                    ]
                  },
                  {
                    "id": "open_airtable",
                    "type": "task",
                    "label": "Open Airtable CRM",
                    "intent": "Navigate to or switch to the Airtable CRM tab.",
                    "context": "Access the Airtable database where investor information is stored and managed.",
                    "actions": [
                      {
                        "type": "navigate_or_switch_tab",
                        "instruction": "Navigate to Airtable CRM or switch to existing Airtable tab",
                        "target": { "url": "https://airtable.com/appXXX/tblYYY/viwZZZ" }
                      }
                    ]
                  },
                  {
                    "id": "add_to_crm",
                    "type": "task",
                    "label": "Add Investor to CRM",
                    "intent": "Create a new record in Airtable with the extracted investor information.",
                    "context": "Fill out the investor information form in Airtable with the details extracted from the email.",
                    "actions": [
                      {
                        "type": "click", 
                        "instruction": "Click the 'Add Record' or '+' button to create a new investor entry",
                        "target": { "selector": "[data-testid='add-record-button']" }
                      }
                    ]
                  },
                  {
                    "id": "mark_processed",
                    "type": "task",
                    "label": "Mark Email as Processed",
                    "intent": "Return to Gmail and mark the email as processed to avoid reprocessing.",
                    "context": "Go back to Gmail and add a label or flag to indicate this email has been processed.",
                    "actions": [
                      {
                        "type": "navigate_or_switch_tab",
                        "instruction": "Switch back to Gmail tab",
                        "target": { "url": "https://mail.google.com/mail/u/0/#inbox" }
                      }
                    ]
                  }
                ],
                "flow": [
                  { "from": "start_workflow", "to": "scan_email_list" },
                  { "from": "scan_email_list", "to": "email_processing_loop" },
                  { "from": "email_processing_loop", "to": "select_email" },
                  { "from": "select_email", "to": "extract_investor_info" },
                  { "from": "extract_investor_info", "to": "open_airtable" },
                  { "from": "open_airtable", "to": "add_to_crm" },
                  { "from": "add_to_crm", "to": "mark_processed" },
                  { "from": "mark_processed", "to": "email_processing_loop", "condition": "more_emails_to_process" }
                ]
              }
            }
          };
          
          const engine = new ExecutionEngine(HARDCODED_TEST_WORKFLOW);
          engineResult = await engine.executeNodeById(executionId, stepId);
          
          console.log(`ExecutionEngine result:`, engineResult);
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
      .eq('job_id', databaseId);

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