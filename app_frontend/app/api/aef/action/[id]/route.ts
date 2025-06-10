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
        // Execute actions directly on existing VNC environment
        try {
          console.log(`🎯 [AEF API] Executing individual node ${stepId} with direct browser actions`);
          console.log(`🎯 [AEF API] Using existing VNC executionId: ${executionId}`);
          
          // Find the node in the hardcoded workflow to get its actions
          const HARDCODED_TEST_WORKFLOW = {
            "meta": {
              "version": "1.0",
              "title": "Gmail to Airtable Investor Processing",
              "description": "Automatically process investor emails from Gmail and add them to Airtable CRM"
            },
            "sop": {
              "id": "gmail_airtable_processor_v3",
              "name": "Gmail to Airtable Processor v3",
              "nodes": [
                {
                  "id": "gmail_login_flow",
                  "type": "compound_task",
                  "label": "Navigate and Log in to Gmail",
                  "intent": "Complete the entire Gmail login process from navigation to accessing inbox.",
                  "context": "This is a compound task that handles the complete Gmail authentication flow including navigation, email entry, password entry, and login completion.",
                  "canExecuteAsGroup": true,
                  "children": ["navigate_to_gmail", "enter_email", "enter_password", "complete_login"],
                  "actions": []
                },
                {
                  "id": "navigate_to_gmail",
                  "type": "atomic_task",
                  "label": "Navigate to Gmail",
                  "intent": "Navigate to the Gmail login page to begin authentication.",
                  "context": "Open Gmail in the browser. If user is already logged in, it will go to inbox. If not, it will show the login page.",
                  "parentId": "gmail_login_flow",
                  "actions": [
                    {
                      "type": "navigate",
                      "instruction": "Navigate to Gmail login page",
                      "target": { "url": "https://accounts.google.com/signin/v2/identifier?service=mail&continue=https://mail.google.com/mail/" }
                    }
                  ]
                },
                {
                  "id": "enter_email",
                  "type": "atomic_task", 
                  "label": "Enter Email",
                  "intent": "Enter the email address in the login form and proceed to password step.",
                  "context": "Type the email address and click Next to proceed to password entry.",
                  "parentId": "gmail_login_flow",
                  "actions": [
                    {
                      "type": "type",
                      "instruction": "Enter email address in the email field",
                      "target": { "selector": "input[type='email']" },
                      "text": "your.email@gmail.com"
                    },
                    {
                      "type": "click",
                      "instruction": "Click Next button to proceed to password",
                      "target": { "selector": "#identifierNext" }
                    }
                  ]
                },
                {
                  "id": "enter_password",
                  "type": "atomic_task",
                  "label": "Enter Password", 
                  "intent": "Wait for password field to appear, then enter password.",
                  "context": "After clicking Next on email, wait for the password field to load and then enter the password.",
                  "parentId": "gmail_login_flow",
                  "actions": [
                    {
                      "type": "wait",
                      "instruction": "Wait for password field to appear",
                      "duration": 2000
                    },
                    {
                      "type": "type",
                      "instruction": "Enter password in the password field", 
                      "target": { "selector": "input[type='password']" },
                      "text": "your_password_here"
                    }
                  ]
                },
                {
                  "id": "complete_login",
                  "type": "atomic_task",
                  "label": "Complete Login",
                  "intent": "Click sign in button and wait for redirect to Gmail inbox.",
                  "context": "Complete the login process by clicking the sign in button and waiting for Gmail to load.",
                  "parentId": "gmail_login_flow", 
                  "actions": [
                    {
                      "type": "click",
                      "instruction": "Click Sign In button to complete login",
                      "target": { "selector": "#passwordNext" }
                    },
                    {
                      "type": "wait_for_navigation",
                      "instruction": "Wait for redirect to Gmail inbox",
                      "target": { "url": "https://mail.google.com/mail/u/0/#inbox" }
                    }
                  ]
                },
                {
                  "id": "scan_email_list",
                  "type": "atomic_task",
                  "label": "Scan Email List",
                  "intent": "Look through the Gmail inbox to identify investor-related emails.",
                  "context": "Review the email list in the inbox to find emails that contain investor inquiries, partnership requests, or business opportunities.",
                  "actions": [
                    {
                      "type": "navigate_or_switch_tab",
                      "instruction": "Ensure we're on the Gmail inbox page",
                      "target": { "url": "https://mail.google.com/mail/u/0/#inbox" }
                    }
                  ]
                },
                {
                  "id": "email_processing_loop",
                  "type": "compound_task",
                  "label": "Process Email Loop",
                  "intent": "Iteratively process each investor email found in the inbox.",
                  "context": "This loop will continue processing emails until all investor-related emails have been handled.",
                  "canExecuteAsGroup": true,
                  "children": ["select_email", "extract_investor_info", "open_airtable", "add_to_crm", "mark_processed"],
                  "actions": []
                },
                {
                  "id": "select_email",
                  "type": "atomic_task",
                  "label": "Select Investor Email",
                  "intent": "Click on an unprocessed investor email to open it.",
                  "context": "Identify and click on an email that appears to be from an investor or contains investment-related content.",
                  "parentId": "email_processing_loop",
                  "actions": [
                    {
                      "type": "click",
                      "instruction": "Click on the first unread investor email in the list",
                      "target": { "selector": ".zA:first-child" }
                    }
                  ]
                },
                {
                  "id": "extract_investor_info",
                  "type": "atomic_task",
                  "label": "Extract Investor Information", 
                  "intent": "Read and extract key investor details from the email content.",
                  "context": "Parse the email content to identify investor name, company, contact information, investment interests, and other relevant details.",
                  "parentId": "email_processing_loop",
                  "actions": [
                    {
                      "type": "extract",
                      "instruction": "Extract investor information from email content",
                      "schema": {
                        "name": "string",
                        "company": "string", 
                        "email": "string",
                        "phone": "string",
                        "investment_focus": "string",
                        "message_summary": "string"
                      }
                    }
                  ]
                },
                {
                  "id": "open_airtable",
                  "type": "atomic_task",
                  "label": "Open Airtable CRM",
                  "intent": "Navigate to or switch to the Airtable CRM tab.",
                  "context": "Access the Airtable database where investor information is stored and managed.",
                  "parentId": "email_processing_loop",
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
                  "type": "atomic_task",
                  "label": "Add Investor to CRM",
                  "intent": "Create a new record in Airtable with the extracted investor information.",
                  "context": "Fill out the investor information form in Airtable with the details extracted from the email.",
                  "parentId": "email_processing_loop",
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
                  "type": "atomic_task",
                  "label": "Mark Email as Processed",
                  "intent": "Return to Gmail and mark the email as processed to avoid reprocessing.",
                  "context": "Go back to Gmail and add a label or flag to indicate this email has been processed.",
                  "parentId": "email_processing_loop",
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
                { "from": "gmail_login_flow", "to": "scan_email_list" },
                { "from": "scan_email_list", "to": "email_processing_loop" },
                { "from": "email_processing_loop", "to": "select_email" },
                { "from": "select_email", "to": "extract_investor_info" },
                { "from": "extract_investor_info", "to": "open_airtable" },
                { "from": "open_airtable", "to": "add_to_crm" },
                { "from": "add_to_crm", "to": "mark_processed" },
                { "from": "mark_processed", "to": "email_processing_loop", "condition": "more_emails_to_process" }
              ]
            }
          };
          
          // Find the specific node to execute
          const targetNode = HARDCODED_TEST_WORKFLOW.sop.nodes.find(node => node.id === stepId);
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