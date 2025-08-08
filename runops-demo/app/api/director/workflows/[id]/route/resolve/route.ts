import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRoute } from '@/lib/director/services/resolverService.js';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id;
    const body = await req.json();
    const routeRef = body?.routeRef;
    if (!workflowId || !routeRef) {
      return NextResponse.json({ success: false, error: 'workflowId and routeRef required' }, { status: 400 });
    }

    const mod: any = await import('@/lib/director/config/supabase.js');
    const sb = (mod.supabase ?? mod.default ?? mod) as unknown as SupabaseClient;

    let query = sb.from('nodes').select('*').eq('workflow_id', workflowId).eq('type', 'route');
    if (typeof routeRef === 'string') {
      if (/^\d+$/.test(routeRef)) query = query.eq('position', Number(routeRef));
      else query = query.eq('alias', routeRef);
    } else if (typeof routeRef === 'number') {
      query = query.eq('position', routeRef);
    } else if (routeRef?.uuid) {
      query = query.eq('uuid', routeRef.uuid);
    } else if (routeRef?.position) {
      query = query.eq('position', Number(routeRef.position));
    } else if (routeRef?.alias) {
      query = query.eq('alias', routeRef.alias);
    }
    const { data: node, error } = await query.single();
    if (error || !node) {
      return NextResponse.json({ success: false, error: 'route node not found' }, { status: 404 });
    }

    const { branches, report } = await resolveRoute(node, workflowId);

    // Persist branch_positions per branch (array form) or paths (object form)
    const paramsUpdate: any = Array.isArray(node.params) ? node.params.map((b: any) => ({ ...b })) : { ...(node.params || {}) };
    if (Array.isArray(paramsUpdate)) {
      for (const b of paramsUpdate) {
        const match = branches.find(x => x.name === b.name);
        if (match) b.branch_positions = match.positions;
      }
    } else if (paramsUpdate && typeof paramsUpdate === 'object') {
      paramsUpdate.paths = paramsUpdate.paths || {};
      for (const b of branches) paramsUpdate.paths[b.name] = b.positions;
    }

    // Attach report on container
    const { error: upErr } = await sb
      .from('nodes')
      .update({ params: paramsUpdate, result: node.result, status: node.status })
      .eq('id', node.id);
    if (upErr) throw upErr;

    // Set _parent_position on matched children (idempotent)
    const allPositions = branches.flatMap(b => Array.isArray(b.positions) ? b.positions : []);
    if (allPositions.length) {
      const { data: children } = await sb
        .from('nodes')
        .select('id, position, type, params')
        .eq('workflow_id', workflowId)
        .in('position', allPositions);
      for (const ch of children || []) {
        const chParams: any = { ...(ch.params || {}) };
        if (ch.type !== 'group' && chParams._parent_position !== node.position) {
          chParams._parent_position = node.position;
          await sb.from('nodes').update({ params: chParams }).eq('id', ch.id);
        }
      }
    }

    // Return simple shape
    return NextResponse.json({ success: true, branches, resolver_report: report });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}


