import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';

/**
 * GET /api/aef/logs/[executionId]
 * Retrieves historical execution logs for an AEF execution
 * Supports pagination and filtering
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string } }
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

    const { executionId } = params;
    const url = new URL(request.url);
    
    // Parse query parameters
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const level = url.searchParams.get('level'); // debug, info, warn, error
    const stepId = url.searchParams.get('stepId');
    const since = url.searchParams.get('since'); // ISO timestamp

    if (!executionId) {
      return NextResponse.json(
        { error: 'Execution ID is required' },
        { status: 400 }
      );
    }

    console.log(`Fetching logs for execution ${executionId}, user ${user.id}`);

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
        { error: 'Access denied: You can only view logs for your own executions' },
        { status: 403 }
      );
    }

    // Get logs from the dedicated aef_node_logs table
    const { data: dbLogs, error: logsError } = await supabase
      .from('aef_node_logs')
      .select('*')
      .eq('execution_id', executionId)
      .order('timestamp', { ascending: false });

    if (logsError) {
      console.error(`Error fetching logs:`, logsError);
      return NextResponse.json(
        { error: 'Failed to fetch logs' },
        { status: 500 }
      );
    }

    // Transform database logs to match the expected format
    let logs = (dbLogs || []).map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      level: log.type === 'error' ? 'error' : 'info',
      message: log.title,
      stepId: log.node_id,
      data: {
        type: log.type,
        content: log.content,
        metadata: log.metadata || {}
      }
    }));

    // Apply filters
    if (level) {
      logs = logs.filter((log: any) => log.level === level);
    }
    
    if (stepId) {
      logs = logs.filter((log: any) => log.stepId === stepId);
    }
    
    if (since) {
      const sinceDate = new Date(since);
      logs = logs.filter((log: any) => new Date(log.timestamp) >= sinceDate);
    }

    // Sort by timestamp (newest first)
    logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const offset = (page - 1) * limit;
    const paginatedLogs = logs.slice(offset, offset + limit);
    const totalCount = logs.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Add execution metadata for context
    const response = {
      executionId,
      logs: paginatedLogs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      },
      filters: {
        level: level || null,
        stepId: stepId || null,
        since: since || null
      },
      execution: {
        status: metadata?.execution_record?.status || 'unknown',
        startedAt: metadata?.execution_record?.created_at || job.created_at,
        currentStep: metadata?.execution_record?.current_step || null,
        progress: metadata?.execution_record?.progress || 0
      }
    };

    console.log(`Retrieved ${paginatedLogs.length} logs for execution ${executionId}`);
    
    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Error fetching execution logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch execution logs' },
      { status: 500 }
    );
  }
}

 