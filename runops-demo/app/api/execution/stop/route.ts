import { NextRequest, NextResponse } from 'next/server';
import { browserManager } from '@/lib/browser/BrowserManager';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, executionId } = body || {};

    if (!sessionId && !executionId) {
      return NextResponse.json({ error: 'sessionId or executionId is required' }, { status: 400 });
    }

    let targetSessionId = sessionId as string | undefined;
    if (!targetSessionId && executionId) {
      const session = browserManager.getSessionByExecution(executionId);
      targetSessionId = session?.id;
    }

    if (!targetSessionId) {
      return NextResponse.json({ error: 'No session found to stop' }, { status: 404 });
    }

    await browserManager.destroySession(targetSessionId);
    return NextResponse.json({ success: true, sessionId: targetSessionId, status: 'stopped' });
  } catch (error: any) {
    console.error('[execution/stop] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}


