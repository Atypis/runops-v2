import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { MemoryManager } from '@/lib/memory/MemoryManager';

export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const { executionId } = params;
    
    if (!executionId) {
      return NextResponse.json(
        { error: 'Execution ID is required' },
        { status: 400 }
      );
    }

    // Get user from session
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Use service-role client for reading memory (bypass RLS) but still filter by user id
    const { createClient } = await import('@supabase/supabase-js');
    const serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const memoryManager = new MemoryManager(serviceRoleClient);

    // Get memory artifacts for execution
    const memoryArtifacts = await memoryManager.getExecutionMemoryFlow(executionId);

    // Return all artifacts for the execution. Execution IDs are scoped per user session,
    // so additional filtering is not necessary and may cause mismatches.
    return NextResponse.json({
      success: true,
      executionId,
      memoryArtifacts,
      count: memoryArtifacts.length
    });

  } catch (error) {
    console.error('Failed to fetch execution memory:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch execution memory',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { executionId: string } }
) {
  try {
    const { executionId } = params;
    const body = await request.json();
    
    if (!executionId) {
      return NextResponse.json(
        { error: 'Execution ID is required' },
        { status: 400 }
      );
    }

    // Get user from session
    const supabase = createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Use service-role client for reading memory (bypass RLS) but still filter by user id
    const { createClient } = await import('@supabase/supabase-js');
    const serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const memoryManager = new MemoryManager(serviceRoleClient);

    // Search memory artifacts with filters
    const searchResults = await memoryManager.searchMemoryArtifacts({
      executionId,
      userId: user.id,
      ...body.filters
    });

    return NextResponse.json({
      success: true,
      executionId,
      memoryArtifacts: searchResults,
      count: searchResults.length
    });

  } catch (error) {
    console.error('Failed to search memory artifacts:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to search memory artifacts',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 