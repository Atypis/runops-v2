import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id;
    if (!workflowId) return NextResponse.json({ success: false, error: 'workflowId required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { PlanService } = await import('@/lib/director/services/planService.js');
    const service = new PlanService();
    const plan = await service.getCurrentPlan(workflowId);
    return NextResponse.json({ success: true, plan });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}


