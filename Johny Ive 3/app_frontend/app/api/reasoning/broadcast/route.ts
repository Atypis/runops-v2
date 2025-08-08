import { NextRequest, NextResponse } from 'next/server';
import { wsServer } from '../../../../lib/browser/WebSocketServer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId, data } = body;

    if (!executionId || !data) {
      return NextResponse.json(
        { error: 'Missing executionId or data' },
        { status: 400 }
      );
    }

    // Broadcast the reasoning update via WebSocket
    wsServer.broadcastReasoningUpdate(executionId, data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Error broadcasting reasoning update:', error);
    return NextResponse.json(
      { error: 'Failed to broadcast reasoning update' },
      { status: 500 }
    );
  }
}