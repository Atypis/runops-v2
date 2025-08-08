import { NextRequest, NextResponse } from 'next/server';
import { getDirectorForWorkflow } from '@/lib/director/instance';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflowId } = body || {};

    if (!workflowId) {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
    }

    const director = getDirectorForWorkflow(workflowId);
    const ok = director.cancelExecution(workflowId);
    return NextResponse.json({ success: ok });
  } catch (error: any) {
    console.error('[director/cancel] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}


