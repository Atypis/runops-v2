import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveIterate } from '@/lib/director/services/resolverService.js';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id;
    const body = await req.json();
    const iterateRef = body?.iterateRef;
    if (!workflowId || !iterateRef) {
      return NextResponse.json({ success: false, error: 'workflowId and iterateRef required' }, { status: 400 });
    }

    const mod: any = await import('@/lib/director/config/supabase.js');
    const sb = (mod.supabase ?? mod.default ?? mod) as unknown as SupabaseClient;

    // Lookup iterate node by alias/position/id/uuid (uuid optional)
    let query = sb.from('nodes').select('*').eq('workflow_id', workflowId).eq('type', 'iterate');
    if (typeof iterateRef === 'string') {
      if (/^\d+$/.test(iterateRef)) query = query.eq('position', Number(iterateRef));
      else query = query.eq('alias', iterateRef);
    } else if (typeof iterateRef === 'number') {
      query = query.eq('position', iterateRef);
    } else if (iterateRef?.uuid) {
      query = query.eq('uuid', iterateRef.uuid);
    } else if (iterateRef?.position) {
      query = query.eq('position', Number(iterateRef.position));
    } else if (iterateRef?.alias) {
      query = query.eq('alias', iterateRef.alias);
    }
    const { data: node, error } = await query.single();
    if (error || !node) {
      return NextResponse.json({ success: false, error: 'iterate node not found' }, { status: 404 });
    }

    const { body_positions, report } = await resolveIterate(node, workflowId);

    // Persist resolved positions and optional report
    const paramsUpdate = { ...(node.params || {}) };
    paramsUpdate.body_positions = body_positions;
    paramsUpdate.body_type = Array.isArray((node.params || {}).body) ? 'positions' : ((node.params || {}).body_type || 'positions');
    paramsUpdate.resolver_report = report;

    const { error: upErr } = await sb
      .from('nodes')
      .update({ params: paramsUpdate })
      .eq('id', node.id);
    if (upErr) throw upErr;

    // Set _parent_position on matched children (idempotent)
    if (Array.isArray(body_positions) && body_positions.length) {
      const { data: children } = await sb
        .from('nodes')
        .select('id, position, type, params')
        .eq('workflow_id', workflowId)
        .in('position', body_positions);
      for (const ch of children || []) {
        const chParams: any = { ...(ch.params || {}) };
        if (ch.type !== 'group' && chParams._parent_position !== node.position) {
          chParams._parent_position = node.position;
          await sb.from('nodes').update({ params: chParams }).eq('id', ch.id);
        }
      }
    }

    return NextResponse.json({ success: true, body_positions, body_spec: paramsUpdate.body_spec, resolver_report: report });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}


