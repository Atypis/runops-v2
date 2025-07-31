import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface NodeLogEntry {
  timestamp: string;
  type: 'prompt' | 'accessibility_tree' | 'llm_response' | 'action' | 'screenshot' | 'error' | 'success';
  title: string;
  content: string;
  metadata?: {
    actionType?: string;
    duration?: number;
    url?: string;
    selector?: string;
    confidence?: number;
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { executionId: string; nodeId: string } }
) {
  try {
    const { executionId, nodeId } = params;

    if (!executionId || !nodeId) {
      return NextResponse.json(
        { error: 'executionId and nodeId are required' },
        { status: 400 }
      );
    }

    console.log(`🔍 [Node Logs API] Fetching logs for execution ${executionId}, node ${nodeId}`);

    // Get logs from the dedicated aef_node_logs table
    const { data: logs, error: logsError } = await supabase
      .from('aef_node_logs')
      .select('*')
      .eq('execution_id', executionId)
      .eq('node_id', nodeId)
      .order('timestamp', { ascending: true });

    if (logsError) {
      console.error(`[Node Logs API] Error fetching logs:`, logsError);
      return NextResponse.json(
        { error: 'Failed to fetch logs' },
        { status: 500 }
      );
    }

    // Transform database logs to match the expected format
    const transformedLogs: NodeLogEntry[] = (logs || []).map(log => ({
      timestamp: log.timestamp,
      type: log.type,
      title: log.title,
      content: log.content,
      metadata: log.metadata || {}
    }));

    console.log(`✅ [Node Logs API] Found ${transformedLogs.length} logs for node ${nodeId}`);

    return NextResponse.json({
      success: true,
      executionId,
      nodeId,
      logs: transformedLogs,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Node Logs API] Error fetching logs:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch node logs',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

 