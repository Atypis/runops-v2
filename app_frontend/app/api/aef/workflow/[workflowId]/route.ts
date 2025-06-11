import { NextRequest, NextResponse } from 'next/server';
import { ServerWorkflowLoader } from '@/lib/workflow/ServerWorkflowLoader';
import { WorkflowValidationError, WorkflowLoadError } from '@/lib/workflow/WorkflowLoader';

export async function GET(
  request: NextRequest,
  { params }: { params: { workflowId: string } }
) {
  try {
    const { workflowId } = params;
    
    if (!workflowId) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      );
    }

    console.log(`🔄 [Workflow API] Loading workflow: ${workflowId}`);

    const workflow = await ServerWorkflowLoader.loadWorkflow(workflowId);

    console.log(`✅ [Workflow API] Successfully loaded workflow: ${workflow.meta.title}`);

    return NextResponse.json({
      success: true,
      workflow: workflow
    });

  } catch (error) {
    console.error('❌ [Workflow API] Failed to load workflow:', error);
    
    if (error instanceof WorkflowLoadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.includes('not found') ? 404 : 400 }
      );
    }
    
    if (error instanceof WorkflowValidationError) {
      return NextResponse.json(
        { 
          error: error.message,
          validationErrors: error.validationErrors
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to load workflow' },
      { status: 500 }
    );
  }
}

// List all available workflows
export async function POST(request: NextRequest) {
  try {
    console.log('📋 [Workflow API] Listing available workflows');

    const workflows = await ServerWorkflowLoader.listWorkflows();

    console.log(`✅ [Workflow API] Found ${workflows.length} workflows`);

    return NextResponse.json({
      success: true,
      workflows: workflows
    });

  } catch (error) {
    console.error('❌ [Workflow API] Failed to list workflows:', error);
    return NextResponse.json(
      { error: 'Failed to list workflows' },
      { status: 500 }
    );
  }
} 