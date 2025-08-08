'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';

type Workflow = { id: string; title?: string };

export default function DirectorSelectPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // Prefer Supabase-backed list if available
        const supabaseList = await fetch('/api/director/workflows', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null);
        if (supabaseList?.success && Array.isArray(supabaseList.workflows) && supabaseList.workflows.length) {
          setWorkflows(supabaseList.workflows);
          setSelected(supabaseList.workflows[0].id);
          return;
        }
        // Fallback to local files
        const res = await fetch('/api/workflows', { cache: 'no-store' });
        const data = await res.json();
        if (data?.success && Array.isArray(data.workflows)) {
          setWorkflows(data.workflows);
          if (data.workflows.length > 0) setSelected(data.workflows[0].id);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const go = () => {
    if (!selected) return;
    router.push(`/director/${encodeURIComponent(selected)}`);
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="p-6">
          <h1 className="text-xl font-semibold mb-4">Director – Choose a Workflow</h1>
          {loading ? (
            <div className="text-sm text-gray-500">Loading workflows…</div>
          ) : (
            <div className="flex gap-3 items-center">
              <select
                className="border rounded px-2 py-1"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {workflows.map(w => (
                  <option key={w.id} value={w.id}>{w.title || w.id}</option>
                ))}
              </select>
              <button className="px-3 py-1 border rounded" onClick={go} disabled={!selected}>
                Open
              </button>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}


