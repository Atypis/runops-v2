import { NextRequest, NextResponse } from 'next/server';
import { getDirectorForWorkflow } from '@/lib/director/instance';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflowId, message, conversationHistory = [], mockMode = false, isCompressionRequest = false, selectedModel } = body || {};

    if (!workflowId || !message) {
      return NextResponse.json({ error: 'workflowId and message are required' }, { status: 400 });
    }

    const director = getDirectorForWorkflow(workflowId);
    const result = await director.processMessage({
      message,
      workflowId,
      conversationHistory,
      mockMode,
      isCompressionRequest,
      selectedModel,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[director/process] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

