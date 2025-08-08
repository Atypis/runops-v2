import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DirectorService } from '@/lib/director/services/directorService.js';

type NodeRecord = {
  id: number | string;
  workflow_id: string;
  position: number;
  type: string;
  description?: string | null;
  params?: any;
  status?: string | null;
  result?: any;
  alias?: string | null;
};

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id;
    if (!workflowId) {
      return NextResponse.json({ success: false, error: 'workflowId required' }, { status: 400 });
    }

    const mod: any = await import('@/lib/director/config/supabase.js');
    const sb = (mod.supabase ?? mod.default ?? mod) as unknown as SupabaseClient;

    // Load nodes
    const { data, error } = await sb
      .from('nodes')
      .select('id, workflow_id, position, type, description, params, status, result, alias')
      .eq('workflow_id', workflowId)
      .order('position', { ascending: true });
    if (error) throw error;

    const nodes = (data || []) as NodeRecord[];
    if (!nodes.length) {
      return NextResponse.json({ success: true, message: 'No nodes to renumber', positionUpdates: [] });
    }

    const byPosition: Record<number, NodeRecord> = {};
    nodes.forEach(n => { byPosition[n.position] = n; });

    // Build child references
    const referenced = new Set<number>();
    const childrenMap: Record<number, number[]> = {};

    const toPositionsArray = (val: unknown): number[] => {
      if (Array.isArray(val)) {
        if (val.length === 0) return [];
        if (typeof val[0] === 'number') return val as number[];
        if (typeof val[0] === 'string') return (val as string[]).map(v => Number(v)).filter(v => !Number.isNaN(v));
      }
      return [];
    };

    for (const n of nodes) {
      const params: any = n.params || {};
      // Route: array-of-branches
      if (n.type === 'route' && Array.isArray(params)) {
        for (const b of params) {
          const pos = Array.isArray(b?.branch_positions) ? toPositionsArray(b.branch_positions) : toPositionsArray(b?.branch);
          if (pos.length) {
            childrenMap[n.position] = (childrenMap[n.position] || []).concat(pos);
            pos.forEach(p => referenced.add(p));
          }
        }
      }
      // Route: legacy paths
      if (n.type === 'route' && params.paths && typeof params.paths === 'object') {
        for (const content of Object.values(params.paths)) {
          const pos = toPositionsArray(content);
          if (pos.length) {
            childrenMap[n.position] = (childrenMap[n.position] || []).concat(pos);
            pos.forEach(p => referenced.add(p));
          }
        }
      }
      // Iterate
      if (n.type === 'iterate') {
        let pos: number[] = [];
        if (Array.isArray(params.body_positions)) pos = toPositionsArray(params.body_positions);
        else if (Array.isArray(params.body)) pos = toPositionsArray(params.body);
        else if (params.body && typeof params.body === 'object') {
          const s = Number(params.body.start); const e = Number(params.body.end);
          if (!Number.isNaN(s) && !Number.isNaN(e)) {
            const [lo, hi] = s <= e ? [s, e] : [e, s];
            pos = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
          }
        }
        if (pos.length) {
          childrenMap[n.position] = (childrenMap[n.position] || []).concat(pos);
          pos.forEach(p => referenced.add(p));
        }
      }
      // Explicit parent pointer
      if (params._parent_position != null) {
        const parent = Number(params._parent_position);
        childrenMap[parent] = (childrenMap[parent] || []).concat([n.position]);
        referenced.add(n.position);
      }
    }

    // Roots: nodes not referenced and without _parent_position
    const roots: number[] = [];
    for (const n of nodes) {
      const hasParent = (n.params || {})?._parent_position != null;
      if (!hasParent && !referenced.has(n.position)) roots.push(n.position);
    }
    const startNodes = roots.length ? roots : nodes.map(n => n.position);

    // Pre-order traversal
    const visited = new Set<number>();
    const order: number[] = [];
    const dfs = (pos: number) => {
      if (visited.has(pos)) return;
      visited.add(pos);
      order.push(pos);
      const kids = (childrenMap[pos] || [])
        .map(p => byPosition[p])
        .filter(Boolean)
        .sort((a, b) => a.position - b.position)
        .map(n => n.position);
      for (const k of kids) dfs(k);
    };
    for (const r of startNodes) dfs(r);

    // Build mapping old->new
    const positionUpdates: { id: number|string, oldPosition: number, newPosition: number }[] = [];
    let newPos = 1;
    for (const oldPos of order) {
      const node = byPosition[oldPos];
      if (!node) continue;
      if (node.position !== newPos) {
        positionUpdates.push({ id: node.id, oldPosition: node.position, newPosition: newPos });
      }
      newPos += 1;
    }

    // Apply updates one by one
    for (const upd of positionUpdates) {
      const { error: upErr } = await sb
        .from('nodes')
        .update({ position: upd.newPosition })
        .eq('id', upd.id);
      if (upErr) throw upErr;
    }

    // Update control-flow references to new positions
    const ds = new DirectorService();
    await ds.updateControlFlowPositions(workflowId, positionUpdates);
    await ds.updateAffectedNodeReferences(workflowId, 'renumber', positionUpdates.map(u => u.oldPosition));

    return NextResponse.json({ success: true, positionUpdates, count: positionUpdates.length });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'Internal error' }, { status: 500 });
  }
}


