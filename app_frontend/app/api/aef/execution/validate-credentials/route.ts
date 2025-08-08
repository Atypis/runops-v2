import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { CredentialInjectionService } from '@/lib/credentials/injection';
import { WorkflowCredential } from '@/lib/types/aef';

/**
 * POST /api/aef/execution/validate-credentials
 * Validates that all required credentials are available before execution
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
    const { workflowId, requiredCredentials } = body;

    if (!workflowId || !requiredCredentials) {
      return NextResponse.json(
        { error: 'workflowId and requiredCredentials are required' },
        { status: 400 }
      );
    }

    console.log(`Validating credentials for workflow ${workflowId}, user ${user.id}`);

    // Validate credentials using the injection service
    const validation = await CredentialInjectionService.validateExecutionCredentials(
      workflowId,
      requiredCredentials as WorkflowCredential[]
    );

    if (validation.isValid) {
      console.log(`✅ All credentials validated for workflow ${workflowId}`);
    } else {
      console.warn(`⚠️ Missing credentials for workflow ${workflowId}:`, validation.missingCredentials);
    }

    return NextResponse.json({
      success: true,
      validation: {
        isValid: validation.isValid,
        missingCredentials: validation.missingCredentials,
        requiredCount: validation.requiredCount,
        providedCount: validation.providedCount,
        errors: validation.errors
      }
    });

  } catch (error) {
    console.error('Credential validation API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to validate credentials',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 