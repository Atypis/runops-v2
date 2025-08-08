'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { WorkflowPanel } from '@/components/director/WorkflowPanel';
import { BrowserPanel } from '@/components/director/BrowserPanel';

export default function DirectorPage({ params }: { params: { workflowId: string } }) {
  const { workflowId } = params;
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const sseRef = useRef<EventSource | null>(null);
  const [chatWide, setChatWide] = useState(false);
  const [showBrowser, setShowBrowser] = useState(true);
  const [showRight, setShowRight] = useState(true);
  const [overlayRight, setOverlayRight] = useState(false);
  const [overlayLeft, setOverlayLeft] = useState(false);

  useEffect(() => {
    const es = new EventSource(`/api/director/tool-stream?workflowId=${encodeURIComponent(workflowId)}`);
    sseRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        // naive append; in real UI you'd route to a sidebar/log pane
        setMessages((prev) => [...prev, { role: 'tool', content: JSON.stringify(data) }]);
      } catch {}
    };
    es.onerror = () => { /* ignore transient errors */ };
    return () => { es.close(); };
  }, [workflowId]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content) return;
    setMessages((prev) => [...prev, { role: 'user', content }]);
    setInput('');
    const res = await fetch('/api/director/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflowId, message: content }),
    });
    if (res.ok) {
      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'assistant', content: data?.message || '(no message)' }]);
    } else {
      const err = await res.json().catch(() => ({}));
      setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err.error || res.statusText}` }]);
    }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
          <div className="flex h-[calc(100vh-64px)]">
          {/* Left: Chat */}
          <div className={`${chatWide ? 'w-1/3' : 'w-1/4'} border-r flex flex-col min-w-[300px] shrink-0`}>
            <div className="p-3 border-b font-medium flex items-center justify-between">
              <span>Director Chat – Workflow {workflowId}</span>
              <Link href="/director" className="text-xs px-2 py-1 border rounded hover:bg-gray-50">Change Workflow</Link>
            </div>
            <div className="flex-1 overflow-auto p-3 space-y-2">
              {messages.map((m, i) => (
                <div key={i} className="text-sm">
                  <span className="font-semibold mr-2">{m.role}:</span>
                  <span className="whitespace-pre-wrap break-words">{m.content}</span>
                </div>
              ))}
            </div>
            <div className="p-3 border-t flex gap-2">
              <input className="flex-1 border rounded px-2 py-1" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..." />
              <button className="px-3 py-1 border rounded" onClick={sendMessage}>Send</button>
              <button className="px-2 py-1 border rounded text-xs" onClick={() => setChatWide(v => !v)}>{chatWide ? 'Narrow' : 'Widen'}</button>
            </div>
          </div>

          {/* Center: Browser (collapsible) */}
          {showBrowser && (
            <div className="relative border-r basis-[42%] max-w-[55%] min-w-0 overflow-hidden">
              <BrowserPanel
                workflowId={workflowId}
                executionId="placeholder-session"
                onCollapse={() => setShowBrowser(false)}
                onOpenRightPanel={() => {
                  setShowRight(true);
                  setOverlayRight(false); // open as fixed sidebar by default
                }}
              />
              {/* Right overlay drawer */}
              {showRight && overlayRight && (
                <div className="absolute top-0 right-0 h-full w-[380px] bg-white border-l shadow-xl animate-in fade-in zoom-in duration-150">
                  <div className="h-8 border-b flex items-center justify-between px-2 text-xs">
                    <span>Workflow</span>
                    <div className="flex items-center gap-1">
                      <button className="px-2 py-1 border rounded" onClick={() => setOverlayRight(false)}>Dock</button>
                      <button className="px-2 py-1 border rounded" onClick={() => setShowRight(false)}>Close</button>
                    </div>
                  </div>
                  <div className="h-[calc(100%-2rem)] overflow-hidden">
                    <WorkflowPanel workflowId={workflowId} />
                  </div>
                </div>
              )}
            </div>
          )}
          {!showBrowser && (
            <div className="border-r basis-[8%] max-w-[120px] min-w-[72px] flex items-center justify-center">
              <button className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-50" onClick={() => setShowBrowser(true)}>Show Browser</button>
            </div>
          )}

          {/* Right: Workflow (auto-collapse on small screens) */}
          {showRight && !overlayRight && (
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="h-8 border-b flex items-center justify-between px-2 text-xs bg-white">
                <span>Workflow</span>
                <button className="px-2 py-1 border rounded" onClick={() => setShowRight(false)}>Hide</button>
              </div>
              <div className="h-[calc(100%-2rem)] overflow-hidden">
                <WorkflowPanel workflowId={workflowId} />
              </div>
            </div>
          )}
          {!showRight && (
            <div className="w-6 flex items-center justify-center">
              <button className="rotate-180 text-xs px-1 py-6 border rounded-l bg-white hover:bg-gray-50" onClick={() => setShowRight(true)} title="Show Nodes">›</button>
            </div>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}


