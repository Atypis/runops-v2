import { NextResponse } from 'next/server';
import { ServerWorkflowLoader } from '@/lib/workflow/ServerWorkflowLoader';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params || {} as any;
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const workflow = await ServerWorkflowLoader.loadWorkflow(id);
    return NextResponse.json({ success: true, workflow });
  } catch (error: any) {
    console.error('[workflows/:id] Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}


