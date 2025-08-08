import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id;
    if (!workflowId) return NextResponse.json({ success: false, error: 'workflowId required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { WorkflowDescriptionService } = await import('@/lib/director/services/workflowDescriptionService.js');
    const service = new WorkflowDescriptionService();
    const description = await service.getCurrentDescription(workflowId);
    return NextResponse.json({ success: true, description });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}


