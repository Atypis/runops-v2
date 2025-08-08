import { NextRequest } from 'next/server';
import { getDirectorForWorkflow } from '@/lib/director/instance';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get('workflowId');
  if (!workflowId) {
    return new Response('workflowId is required', { status: 400 });
  }

  const director = getDirectorForWorkflow(workflowId);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      // Minimal heartbeat to keep connection alive
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      const resLike = {
        write: (chunk: string) => controller.enqueue(encoder.encode(chunk)),
        end: () => controller.close(),
      } as any;

      director.addToolCallSSEConnection(workflowId, resLike);

      // On cancel/close
      (req as any).signal?.addEventListener('abort', () => {
        clearInterval(interval);
        try { director.removeToolCallSSEConnection(workflowId, resLike); } catch {}
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}

