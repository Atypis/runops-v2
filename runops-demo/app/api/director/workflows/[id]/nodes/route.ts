import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

type NodeRecord = {
  id: number | string;
  workflow_id: string;
  position: number;
  type: string;
  description?: string | null;
  params?: any;
  status?: string | null;
  result?: any;
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const workflowId = params.id;
    if (!workflowId) {
      return NextResponse.json({ success: false, error: 'workflowId required' }, { status: 400 });
    }

    // Lazy-import Supabase client configured for Operator DB
    const mod: any = await import('@/lib/director/config/supabase.js');
    const sb = (mod.supabase ?? mod.default ?? mod) as unknown as SupabaseClient;

    const { data, error } = await sb
      .from('nodes')
      .select('id, workflow_id, position, type, description, params, status, result')
      .eq('workflow_id', workflowId)
      .order('position', { ascending: true });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const nodes = (data || []) as NodeRecord[];

    // Build basic index by position for quick lookup
    const positionToNode: Record<number, NodeRecord> = {};
    nodes.forEach(n => { positionToNode[n.position] = n; });

    // Tree node type
    type TreeNode = NodeRecord & { children?: TreeNode[]; paths?: Record<string, number[]> };
    const allTreeNodes: Record<number, TreeNode> = {};
    nodes.forEach(n => { allTreeNodes[n.position] = { ...n }; });

    // Track which positions are referenced by containers (iterate body, route paths)
    const referencedPositions = new Set<number>();

    // Helper to safely coerce to positions array
    const toPositionsArray = (val: unknown): number[] => {
      if (Array.isArray(val)) {
        if (val.length === 0) return [];
        if (typeof val[0] === 'number') return val as number[];
        if (typeof val[0] === 'string') return (val as string[]).map(v => Number(v)).filter(v => !Number.isNaN(v));
      }
      return [];
    };

    // First pass: annotate route containers with paths and collect referenced children
    for (const n of nodes) {
      if (n.type !== 'route') continue;
      const params = (n.params || {}) as any;

      const routeNode = allTreeNodes[n.position];
      routeNode.paths = {} as Record<string, number[]>;

      // New format: array of branches with branch_positions/branch
      if (Array.isArray(params)) {
        for (const branch of params as any[]) {
          const branchName = branch?.name || 'branch';
          let positions: number[] = [];
          if (Array.isArray(branch?.branch_positions)) {
            positions = toPositionsArray(branch.branch_positions);
          } else if (branch?.branch !== undefined) {
            positions = toPositionsArray(branch.branch);
          }
          if (positions.length) {
            routeNode.paths[branchName] = positions;
            positions.forEach(p => referencedPositions.add(p));
          }
        }
      }

      // Legacy format: params.paths object
      const paths = params.paths && typeof params.paths === 'object' ? params.paths as Record<string, unknown> : undefined;
      if (paths) {
        for (const [branch, content] of Object.entries(paths)) {
          const positions = toPositionsArray(content);
          if (positions.length) {
            routeNode.paths[branch] = positions;
            positions.forEach(p => referencedPositions.add(p));
          }
        }
      }
    }

    // Second pass: annotate iterate containers and collect referenced children
    for (const n of nodes) {
      if (n.type === 'iterate') {
        const params = (n.params || {}) as any;
        let positions: number[] = [];
        if (Array.isArray(params.body_positions)) {
          positions = toPositionsArray(params.body_positions);
        } else if (Array.isArray(params.body)) {
          positions = toPositionsArray(params.body);
        } else if (params.body && typeof params.body === 'object') {
          // Possible range or object references (start/end); try naive resolution
          const start = Number((params.body as any).start);
          const end = Number((params.body as any).end);
          if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
            positions = Array.from({ length: end - start + 1 }, (_, i) => start + i);
          }
        }
        if (positions.length) {
          positions.forEach(p => referencedPositions.add(p));
          // Store as synthetic child list in children array for rendering
          const container = allTreeNodes[n.position];
          container.children = (container.children || []).concat(
            positions
              .map(p => allTreeNodes[p])
              .filter(Boolean)
          );
        }
      }
    }

    // Third pass: attach children using explicit _parent_position if present
    for (const n of nodes) {
      const params = (n.params || {}) as any;
      if (params._parent_position != null) {
        const parentPos = Number(params._parent_position);
        const parent = allTreeNodes[parentPos];
        const child = allTreeNodes[n.position];
        if (parent && child) {
          parent.children = parent.children || [];
          // Avoid duplicates if already added by container logic
          if (!parent.children.some(ch => ch.position === child.position)) {
            parent.children.push(child);
          }
          referencedPositions.add(n.position);
        }
      }
    }

    // Sort children arrays by position
    Object.values(allTreeNodes).forEach(tn => {
      if (tn.children && tn.children.length) {
        tn.children.sort((a, b) => a.position - b.position);
      }
    });

    // Roots are nodes not referenced as children and without _parent_position
    const roots: TreeNode[] = [];
    for (const n of nodes) {
      const params = (n.params || {}) as any;
      const hasParent = params._parent_position != null;
      if (!hasParent && !referencedPositions.has(n.position)) {
        roots.push(allTreeNodes[n.position]);
      }
    }

    // Fallback: if no roots detected, use all nodes as a flat list
    const topLevel = roots.length ? roots : nodes.map(n => allTreeNodes[n.position]);

    return NextResponse.json({
      success: true,
      nodes,
      tree: topLevel,
      meta: {
        count: nodes.length,
        workflowId,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Internal server error' }, { status: 500 });
  }
}


