'use client';

import React, { useEffect, useMemo, useState } from 'react';

type TreeNode = {
  id: number | string;
  workflow_id: string;
  position: number;
  type: string;
  description?: string | null;
  status?: string | null;
  children?: TreeNode[];
  paths?: Record<string, number[]>;
};

export function WorkflowCanvas({ workflowId }: { workflowId: string }) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/director/workflows/${encodeURIComponent(workflowId)}/nodes`, { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) {
          if (data?.success) {
            setTree(data.tree || []);
          } else {
            setError(data?.error || 'Failed to load nodes');
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load nodes');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [workflowId]);

  const renderNode = (node: TreeNode, depth: number) => {
    const isContainer = node.type === 'iterate' || node.type === 'route' || node.type === 'group';
    const indent = depth * 14;
    const statusColor = node.status === 'running' ? 'bg-amber-500' : node.status === 'success' ? 'bg-emerald-500' : node.status === 'error' ? 'bg-red-500' : 'bg-gray-300';

    return (
      <div key={`${node.position}-${node.id}`} className="relative pl-3">
        {/* Rails */}
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200" style={{ transform: `translateX(${indent}px)` }} />

        {/* Node card */}
        <div className="rounded-md border border-gray-200 bg-white shadow-sm px-2.5 py-2 mb-2" style={{ marginLeft: indent }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`inline-block w-2 h-2 rounded-full ${statusColor}`} />
              <span className="text-xs text-gray-500">#{node.position}</span>
              <span className="text-sm font-medium capitalize truncate">{node.type.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-[11px] px-1.5 py-0.5 border rounded hover:bg-gray-50"
                title="Run this node"
                onClick={async () => {
                  try {
                    await fetch('/api/nodes/execute', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ workflowId: node.workflow_id, nodeSelection: String(node.position) }),
                    });
                  } catch {}
                }}
              >Run</button>
            </div>
          </div>
          {node.description && (
            <div className="mt-1 text-xs text-gray-600 line-clamp-2">{node.description}</div>
          )}
        </div>

        {/* Children */}
        {isContainer && node.children && node.children.length > 0 && (
          <div className="pl-4">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (loading) return <div className="p-3 text-sm text-gray-500">Loading workflow…</div>;
  if (error) return <div className="p-3 text-sm text-red-600">{error}</div>;
  if (!tree.length) return <div className="p-3 text-sm text-gray-500">No nodes found</div>;

  return (
    <div className="h-full overflow-auto p-3 bg-gray-50 min-w-0">
      {tree.map(n => renderNode(n, 0))}
      <div className="h-10" />
    </div>
  );
}

export default WorkflowCanvas;


