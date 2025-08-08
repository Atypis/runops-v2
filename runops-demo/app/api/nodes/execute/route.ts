import { NextRequest, NextResponse } from 'next/server';
import { getDirectorForWorkflow } from '@/lib/director/instance';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflowId, nodeSelection, resetBrowserFirst = false, mode = 'isolated', recordContext = null } = body || {};

    if (!workflowId) {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
    }

    const director = getDirectorForWorkflow(workflowId);

    const args = {
      nodeSelection: nodeSelection ?? null,
      resetBrowserFirst,
      mode,
      recordContext,
    };

    const result = await director.executeNodes(args, workflowId);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('[nodes/execute] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}


