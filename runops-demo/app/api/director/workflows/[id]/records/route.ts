import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id;
    if (!workflowId) return NextResponse.json({ success: false, error: 'workflowId required' }, { status: 400 });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const { VariableManagementService } = await import('@/lib/director/services/variableManagementService.js');
    const service = new VariableManagementService();
    const records = await service.queryRecords(workflowId, '*');
    return NextResponse.json({ success: true, records });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}


