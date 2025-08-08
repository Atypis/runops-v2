import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveRoute, applyRouteSpecPatch } from '@/lib/director/services/resolverService.js';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id;
    const body = await req.json();
    const routeRef = body?.routeRef;
    const op = body?.op;
    const paths_spec = body?.paths_spec;
    if (!workflowId || !routeRef || !op) {
      return NextResponse.json({ success: false, error: 'workflowId, routeRef and op are required' }, { status: 400 });
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

    // Patch params with paths_spec
    const patchedParams = applyRouteSpecPatch(node.params, op, paths_spec);

    const { error: upErr1 } = await sb
      .from('nodes')
      .update({ params: patchedParams })
      .eq('id', node.id);
    if (upErr1) throw upErr1;

    // Resolve
    const { branches, report } = await resolveRoute({ ...node, params: patchedParams }, workflowId);

    // Persist resolved branch_positions or paths
    const finalParams: any = Array.isArray(patchedParams) ? patchedParams.map((b: any) => ({ ...b })) : { ...(patchedParams || {}) };
    if (Array.isArray(finalParams)) {
      for (const b of finalParams) {
        const match = branches.find(x => x.name === b.name);
        if (match) b.branch_positions = match.positions;
      }
    } else if (finalParams && typeof finalParams === 'object') {
      finalParams.paths = finalParams.paths || {};
      for (const b of branches) finalParams.paths[b.name] = b.positions;
    }

    const { error: upErr2 } = await sb
      .from('nodes')
      .update({ params: finalParams })
      .eq('id', node.id);
    if (upErr2) throw upErr2;

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

    return NextResponse.json({ success: true, branches, params: finalParams, resolver_report: report });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}


