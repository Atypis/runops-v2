import { NextRequest, NextResponse } from 'next/server';
import { browserManager } from '@/lib/browser/BrowserManager';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workflowId, userId = 'default-user', executionId: providedExecutionId, headless = false, viewport } = body || {};

    if (!workflowId) {
      return NextResponse.json({ error: 'workflowId is required' }, { status: 400 });
    }

    const executionId = providedExecutionId || `${workflowId}-${Date.now()}`;

    const session = await browserManager.createSession({
      executionId,
      userId,
      headless,
      viewport,
    });

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      executionId,
      status: 'created',
    });
  } catch (error: any) {
    console.error('[execution/start] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}


