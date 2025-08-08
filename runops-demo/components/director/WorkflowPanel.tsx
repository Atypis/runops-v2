'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { WorkflowCanvas } from './WorkflowCanvas';
import { BrowserPanel } from './BrowserPanel';

type TabKey = 'nodes' | 'browser' | 'plan' | 'description' | 'variables' | 'records';

export function WorkflowPanel({ workflowId }: { workflowId: string }) {
  const [tab, setTab] = useState<TabKey>('nodes');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (tab === 'nodes' || tab === 'browser') return; // Canvas/Browser handle their own data
      setLoading(true);
      setError(null);
      setPayload(null);
      try {
        const url = `/api/director/workflows/${encodeURIComponent(workflowId)}/${tab}`;
        const res = await fetch(url, { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) {
          if (data?.success) setPayload(data);
          else setError(data?.error || 'Failed to load');
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [tab, workflowId]);

  return (
    <div className="h-full flex flex-col min-w-0">
      <div className="flex items-center gap-2 p-2 border-b bg-white sticky top-0 z-10 overflow-x-auto whitespace-nowrap scrollbar-none">
        {(['nodes','browser','plan','description','variables','records'] as TabKey[]).map(k => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`text-[11px] px-2 py-1 rounded border mr-1 ${tab===k? 'bg-gray-900 text-white border-gray-900':'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
          >{k.charAt(0).toUpperCase()+k.slice(1)}</button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden min-w-0">
        {tab === 'nodes' && (
          <WorkflowCanvas workflowId={workflowId} />
        )}
        {tab === 'browser' && (
          <BrowserPanel workflowId={workflowId} />
        )}
        {tab !== 'nodes' && (
          <div className="h-full overflow-auto p-4 bg-gray-50">
            {loading && <div className="text-sm text-gray-500">Loading…</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}
            {!loading && !error && (
              <pre className="text-xs text-gray-800 whitespace-pre-wrap break-words">{JSON.stringify(payload, null, 2)}</pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkflowPanel;


