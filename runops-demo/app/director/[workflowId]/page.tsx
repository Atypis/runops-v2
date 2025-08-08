'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { WorkflowPanel } from '@/components/director/WorkflowPanel';
import { BrowserPanel } from '@/components/director/BrowserPanel';
import { 
  ChevronLeft, 
  ChevronRight, 
  Maximize2, 
  Minimize2, 
  MessageSquare, 
  Workflow,
  Globe,
  Sparkles
} from 'lucide-react';

export default function DirectorPage({ params }: { params: { workflowId: string } }) {
  const { workflowId } = params;
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState('');
  const sseRef = useRef<EventSource | null>(null);
  
  // Layout states
  const [browserActive, setBrowserActive] = useState(false);
  const [chatCollapsed, setChatCollapsed] = useState(false);
  const [workflowCollapsed, setWorkflowCollapsed] = useState(false);
  const [browserMaximized, setBrowserMaximized] = useState(false);
  
  // Workflow detection
  const [workflowUsesBrowser, setWorkflowUsesBrowser] = useState(false);

  useEffect(() => {
    // Check workflow type on mount
    fetch(`/api/director/workflows/${workflowId}/nodes`)
      .then(res => res.json())
      .then(data => {
        // Check if workflow has browser nodes
        const hasBrowserNodes = data.nodes?.some((node: any) => 
          node.type?.includes('browser') || 
          node.type?.includes('dom') ||
          node.type?.includes('screenshot')
        );
        if (hasBrowserNodes) {
          setWorkflowUsesBrowser(true);
          setBrowserActive(true);
        }
      })
      .catch(() => {});
  }, [workflowId]);

  useEffect(() => {
    const es = new EventSource(`/api/director/tool-stream?workflowId=${encodeURIComponent(workflowId)}`);
    sseRef.current = es;
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        
        // Auto-detect browser actions and activate browser
        if (!browserActive && data.tool?.includes('browser')) {
          setBrowserActive(true);
          setWorkflowUsesBrowser(true);
        }
        
        setMessages((prev) => [...prev, { role: 'tool', content: JSON.stringify(data) }]);
      } catch {}
    };
    es.onerror = () => { /* ignore transient errors */ };
    return () => { es.close(); };
  }, [workflowId, browserActive]);

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // When browser is active, everything becomes overlays
  // When browser is not active, chat and workflow are columns
  const isOverlayMode = browserActive;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="relative flex h-screen bg-gradient-to-br from-gray-50 to-gray-100">
          
          {/* Non-Browser Mode: Side-by-side columns */}
          {!isOverlayMode && (
            <>
              {/* Chat Column - Left 40% */}
              <div className={`
                ${chatCollapsed ? 'w-12' : 'w-[40%]'} 
                transition-all duration-300 ease-in-out
                bg-white border-r border-gray-200 flex flex-col
              `}>
                {!chatCollapsed ? (
                  <>
                    {/* Chat Header */}
                    <div className="h-14 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-gray-800">Director Chat</span>
                        <span className="text-xs text-gray-500 bg-white/80 px-2 py-0.5 rounded-full">
                          {workflowUsesBrowser ? '🌐' : '⚡'} {workflowId}
                        </span>
                      </div>
                      <button
                        onClick={() => setChatCollapsed(true)}
                        className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                      {messages.map((m, i) => (
                        <div key={i} className={`
                          rounded-lg p-3 text-sm
                          ${m.role === 'user' ? 'bg-blue-50 ml-8' : 
                            m.role === 'assistant' ? 'bg-gray-50 mr-8' : 
                            'bg-yellow-50/50 text-xs font-mono'}
                        `}>
                          <div className="font-medium text-gray-700 mb-1 text-xs uppercase tracking-wide">
                            {m.role}
                          </div>
                          <div className="whitespace-pre-wrap break-words text-gray-800">
                            {m.content}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                      <div className="flex gap-2">
                        <input
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Type a message..."
                        />
                        <button
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          onClick={sendMessage}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <button
                      onClick={() => setChatCollapsed(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>

              {/* Workflow Column - Right 60% */}
              <div className={`
                ${workflowCollapsed ? 'w-12' : 'flex-1'} 
                transition-all duration-300 ease-in-out
                bg-white flex flex-col
              `}>
                {!workflowCollapsed ? (
                  <>
                    {/* Workflow Header */}
                    <div className="h-14 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                        <Workflow className="w-4 h-4 text-purple-600" />
                        <span className="font-semibold text-gray-800">Workflow Canvas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link 
                          href="/director" 
                          className="text-xs px-3 py-1.5 bg-white/80 hover:bg-white rounded-lg transition-colors text-gray-600"
                        >
                          Change Workflow
                        </Link>
                        <button
                          onClick={() => setWorkflowCollapsed(true)}
                          className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>

                    {/* Workflow Content */}
                    <div className="flex-1 overflow-hidden">
                      <WorkflowPanel workflowId={workflowId} />
                    </div>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <button
                      onClick={() => setWorkflowCollapsed(false)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors -rotate-180"
                    >
                      <ChevronRight className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Browser Mode: Browser center with overlays */}
          {isOverlayMode && (
            <>
              {/* Main Browser View */}
              <div className={`flex-1 transition-all duration-500 ${browserMaximized ? 'w-full' : ''}`}>
                <div className="h-full bg-white shadow-inner">
                  <BrowserPanel
                    workflowId={workflowId}
                    executionId="placeholder-session"
                    onCollapse={() => setBrowserActive(false)}
                    onOpenRightPanel={() => setWorkflowCollapsed(false)}
                  />
                </div>
              </div>

              {/* Chat Panel - Left Overlay */}
              <div className={`
                absolute left-0 top-0 h-full z-20
                transition-all duration-300 ease-in-out
                ${!chatCollapsed ? 'w-[420px]' : 'w-0'}
              `}>
                {!chatCollapsed && (
                  <div className="h-full bg-white shadow-2xl border-r border-gray-200 flex flex-col animate-in slide-in-from-left duration-200">
                    {/* Chat Header */}
                    <div className="h-14 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-gray-800">Director Chat</span>
                        <span className="text-xs text-gray-500 bg-white/80 px-2 py-0.5 rounded-full">
                          🌐 {workflowId}
                        </span>
                      </div>
                      <button
                        onClick={() => setChatCollapsed(true)}
                        className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                      {messages.map((m, i) => (
                        <div key={i} className={`
                          rounded-lg p-3 text-sm
                          ${m.role === 'user' ? 'bg-blue-50 ml-8' : 
                            m.role === 'assistant' ? 'bg-gray-50 mr-8' : 
                            'bg-yellow-50/50 text-xs font-mono'}
                        `}>
                          <div className="font-medium text-gray-700 mb-1 text-xs uppercase tracking-wide">
                            {m.role}
                          </div>
                          <div className="whitespace-pre-wrap break-words text-gray-800">
                            {m.content}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-gray-200 bg-gray-50">
                      <div className="flex gap-2">
                        <input
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyPress}
                          placeholder="Type a message..."
                        />
                        <button
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                          onClick={sendMessage}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Chat Toggle Button */}
                {chatCollapsed && (
                  <button
                    onClick={() => setChatCollapsed(false)}
                    className="absolute left-0 top-1/2 -translate-y-1/2 bg-white shadow-lg rounded-r-lg px-2 py-4 hover:bg-gray-50 transition-colors border-y border-r border-gray-200"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <MessageSquare className="w-4 h-4 text-gray-600" />
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                    </div>
                  </button>
                )}
              </div>

              {/* Workflow Panel - Right Overlay */}
              <div className={`
                absolute right-0 top-0 h-full z-20
                transition-all duration-300 ease-in-out
                ${!workflowCollapsed ? 'w-[480px]' : 'w-0'}
              `}>
                {!workflowCollapsed && (
                  <div className="h-full bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-200">
                    {/* Workflow Header */}
                    <div className="h-14 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                        <Workflow className="w-4 h-4 text-purple-600" />
                        <span className="font-semibold text-gray-800">Workflow Canvas</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link 
                          href="/director" 
                          className="text-xs px-3 py-1.5 bg-white/80 hover:bg-white rounded-lg transition-colors text-gray-600"
                        >
                          Change Workflow
                        </Link>
                        <button
                          onClick={() => setWorkflowCollapsed(true)}
                          className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                        >
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>

                    {/* Workflow Content */}
                    <div className="flex-1 overflow-hidden">
                      <WorkflowPanel workflowId={workflowId} />
                    </div>
                  </div>
                )}
                
                {/* Workflow Toggle Button */}
                {workflowCollapsed && (
                  <button
                    onClick={() => setWorkflowCollapsed(false)}
                    className="absolute right-0 top-1/2 -translate-y-1/2 bg-white shadow-lg rounded-l-lg px-2 py-4 hover:bg-gray-50 transition-colors border-y border-l border-gray-200"
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Workflow className="w-4 h-4 text-gray-600" />
                      <ChevronLeft className="w-3 h-3 text-gray-400" />
                    </div>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Quick Action Bar */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
            <div className="bg-white shadow-xl rounded-full px-4 py-2 flex items-center gap-3 border border-gray-200">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <Sparkles className="w-4 h-4 text-yellow-500" />
                <span className="font-medium">
                  {browserActive ? 'Browser Mode' : 'API Mode'}
                </span>
              </div>
              
              <div className="w-px h-6 bg-gray-300" />
              
              {/* Browser Toggle - Always available */}
              <button
                onClick={() => setBrowserActive(!browserActive)}
                className={`p-2 rounded-lg transition-colors ${
                  browserActive ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="Toggle Browser"
              >
                <Globe className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-gray-300" />
              
              <button
                onClick={() => setChatCollapsed(!chatCollapsed)}
                className={`p-2 rounded-lg transition-colors ${
                  !chatCollapsed ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="Toggle Chat"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              
              {browserActive && (
                <button
                  onClick={() => setBrowserMaximized(!browserMaximized)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
                  title={browserMaximized ? "Restore Browser" : "Maximize Browser"}
                >
                  {browserMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              )}
              
              <button
                onClick={() => setWorkflowCollapsed(!workflowCollapsed)}
                className={`p-2 rounded-lg transition-colors ${
                  !workflowCollapsed ? 'bg-purple-100 text-purple-600' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title="Toggle Workflow"
              >
                <Workflow className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}