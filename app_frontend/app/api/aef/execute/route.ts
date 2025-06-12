import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { AEFDocument, isAEFDocument, ExecutionMethod } from '@/lib/types/aef';
import { ExecutionStatus } from '@/lib/types/execution';
import { hybridBrowserManager } from '@/lib/browser/HybridBrowserManager';
import { v4 as uuidv4 } from 'uuid';
import { ExecutionEngine } from '@/aef/execution_engine/engine';
import { ServerWorkflowLoader } from '@/lib/workflow/ServerWorkflowLoader';
import { WorkflowLoadError, WorkflowValidationError } from '@/lib/workflow/WorkflowLoader';

/**
 * POST /api/aef/execute
 * Starts AEF execution for a transformed SOP document
 * Creates execution record and returns WebSocket URL
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
    const { aefDocumentId, stepIds } = body;

    if (!aefDocumentId) {
      return NextResponse.json(
        { error: 'aefDocumentId is required' },
        { status: 400 }
      );
    }

    console.log(`Starting AEF execution for document ${aefDocumentId}, user ${user.id}`);

    // Fetch the AEF document - NEW JSON WORKFLOW APPROACH
    let aefDocument: any;
    
    // First try to load as a JSON workflow
    if (aefDocumentId === 'gmail-investor-crm-v2' || aefDocumentId === 'test-investor-email-workflow' || aefDocumentId === '51e93cf8-074a-48c3-8678-39c3076dd5fa') {
      try {
        console.log(`🔄 Loading JSON workflow: ${aefDocumentId}`);
        const workflowId = aefDocumentId === 'test-investor-email-workflow' || aefDocumentId === '51e93cf8-074a-48c3-8678-39c3076dd5fa' ? 'gmail-investor-crm-v2' : aefDocumentId;
        
        const workflow = await ServerWorkflowLoader.loadWorkflow(workflowId);
        
        // Transform JSON workflow to AEF document format
        aefDocument = {
          id: workflow.meta.id,
          title: workflow.meta.title,
          goal: workflow.meta.goal,
          purpose: workflow.meta.purpose,
          
          // Transform workflow nodes to AEF format
          public: {
            nodes: workflow.execution.workflow.nodes.map(node => ({
              id: node.id,
              type: node.type,
              label: node.label,
              intent: node.intent,
              context: node.context,
              parent_id: node.parentId,
              children: node.children || [],
              can_execute_as_group: node.canExecuteAsGroup,
              credentials_required: node.credentialsRequired,
              preferred_auth_methods: node.preferredAuthMethods,
              actions: node.actions
            })),
            flow: workflow.execution.workflow.flow
          },
          
          // AEF configuration
          aef: {
            config: {
              checkpoints: [],
              executionMethod: ExecutionMethod.BROWSER_AUTOMATION,
              secrets: [],
              estimatedDuration: workflow.config?.executionTimeout || 1800,
              stepTimeout: 30,
              checkpointTimeout: 300,
              enableDetailedLogging: true,
              pauseOnErrors: workflow.config?.pauseOnErrors ?? true,
              retryAttempts: workflow.config?.retryAttempts || 3,
              hybridMode: workflow.config?.hybridMode ?? true
            },
            transformedAt: new Date(),
            transformedBy: user.id,
            version: workflow.meta.version,
            automationEnhanced: true
          }
        };
        
        console.log(`✅ Successfully loaded JSON workflow: ${workflow.meta.title}`);
      } catch (error) {
        console.error('❌ Failed to load JSON workflow:', error);
        
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
    } else {
      // Original database fetch for other documents
      const { data: sopRecord, error: fetchError } = await supabase
        .from('sops')
        .select('*')
        .eq('job_id', aefDocumentId)
        .single();

      if (fetchError) {
        console.error('Error fetching AEF document:', fetchError);
        if (fetchError.code === 'PGRST116') {
          return NextResponse.json(
            { error: 'AEF document not found or access denied' },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: 'Failed to fetch AEF document' },
          { status: 500 }
        );
      }

      aefDocument = sopRecord.data;
    }
    
    // Verify this is an AEF-enabled document
    if (!isAEFDocument(aefDocument) && aefDocumentId !== 'test-investor-email-workflow') {
      return NextResponse.json(
        { error: 'Document is not AEF-enabled. Transform it first using /api/aef/transform' },
        { status: 400 }
      );
    }

    // Generate execution ID
    const executionId = uuidv4();
    
    // Create browser session
    console.log(`Creating browser session for execution ${executionId}`);
    try {
      const browserSession = await hybridBrowserManager.createSession({
        executionId,
        userId: user.id,
        headless: false, // For now, keep visible for debugging
        viewport: { width: 1280, height: 720 },
        mode: 'docker' // Force Docker mode for embedded browser view
      });
      
      console.log(`Browser session created: ${browserSession.id}`);
    } catch (error) {
      console.error('Failed to create browser session:', error);
      return NextResponse.json(
        { error: 'Failed to initialize browser session' },
        { status: 500 }
      );
    }
    
    // --- Start Execution Engine ---
    console.log(`Starting Execution Engine for ${executionId}`);
    // The AEFDocument is now directly compatible with what the engine expects
    const engine = new ExecutionEngine(aefDocument, user.id, aefDocumentId);
    
    // Start the engine but don't wait for it to finish
    engine.start(executionId).catch((err: Error) => {
      console.error(`Execution engine failed for ${executionId}:`, err);
      // Here you might want to update the job status to 'failed' in the database
    });

    // Create execution record in database
    const executionRecord = {
      id: executionId,
      sop_id: aefDocumentId,
      user_id: user.id,
      status: ExecutionStatus.RUNNING, // Set status to running
      created_at: new Date().toISOString(),
      config: {
        stepIds: stepIds || null, // If provided, only execute specific steps
        checkpointsEnabled: true
      },
      execution_context: {
        variables: {},
        currentStepIndex: 0,
        totalSteps: aefDocument.public?.nodes?.filter((n: any) => n.type === 'step').length || 0
      }
    };

    // For MVP: Store execution data in a simple table structure
    // We'll use the existing pattern of JSONB storage
    const { error: insertError } = await supabase
      .from('jobs') // Reuse existing jobs table for MVP
      .insert({
        job_id: executionId,
        status: 'aef_execution_running', // Update status string
        metadata: {
          type: 'aef_execution',
          user_id: user.id,
          sop_id: aefDocumentId,
          execution_record: executionRecord
        },
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error creating execution record:', insertError);
      return NextResponse.json(
        { error: 'Failed to create execution record' },
        { status: 500 }
      );
    }

    // Generate WebSocket URL - pointing to our VNC-enabled WebSocket server
    const websocketUrl = `ws://localhost:3004/ws?executionId=${executionId}`;

    console.log(`AEF execution ${executionId} queued successfully`);
    
    return NextResponse.json({
      executionId,
      websocketUrl,
      status: 'running', // Update status string
      estimatedDuration: aefDocument.aef?.config.estimatedDuration || 5,
      stepCount: executionRecord.execution_context.totalSteps
    });

  } catch (error) {
    console.error('Error in AEF execute:', error);
    return NextResponse.json(
      { error: 'Failed to start AEF execution' },
      { status: 500 }
    );
  }
} 