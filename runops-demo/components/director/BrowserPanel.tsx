'use client';

import React from 'react';

type BrowserPanelProps = {
  workflowId: string;
  executionId?: string;
  onCollapse?: () => void;
  onOpenRightPanel?: () => void;
};

export function BrowserPanel({ workflowId, executionId, onCollapse, onOpenRightPanel }: BrowserPanelProps) {
  return (
    <div className="h-full w-full flex flex-col min-w-0">
      {/* Top toolbar */}
      <div className="h-8 shrink-0 border-b bg-white flex items-center gap-2 px-2">
        <div className="text-[11px] text-gray-500">Workflow</div>
        <div className="text-[11px] font-medium px-1 py-0.5 rounded bg-gray-100">{workflowId.slice(0,8)}…</div>
        {executionId ? (
          <div className="ml-2 text-[11px] text-green-600">Session: {String(executionId).slice(0,10)}…</div>
        ) : (
          <div className="ml-2 text-[11px] text-gray-400">No session</div>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button className="h-6 px-2 text-[11px] border rounded bg-white hover:bg-gray-50" onClick={onOpenRightPanel} title="Open Nodes">
            Nodes
          </button>
          <button className="h-6 w-6 text-xs border rounded bg-white hover:bg-gray-50" disabled title="URL">
            ⌗
          </button>
          <button className="h-6 w-6 text-xs border rounded bg-white hover:bg-gray-50" disabled title="Refresh">
            ↻
          </button>
          <button className="h-6 w-6 text-xs border rounded bg-white hover:bg-gray-50" disabled title="Screenshot">
            ⌁
          </button>
          <button className="h-6 px-2 text-[11px] border rounded bg-white hover:bg-gray-50" onClick={onCollapse} title="Hide Browser">
            Hide
          </button>
        </div>
      </div>

      {/* Live view placeholder */}
      <div className="flex-1 bg-gray-50 flex items-center justify-center p-2 min-w-0">
        <div className="text-center">
          <div className="w-[560px] h-[315px] max-w-[92%] max-h-[70%] border border-dashed border-gray-300 bg-white rounded-md flex items-center justify-center mx-auto transition-all">
            <div className="text-gray-400 text-sm">
              Live Browser View
              <div className="text-[11px] mt-1">(placeholder)</div>
            </div>
          </div>
          <div className="text-[11px] text-gray-400 mt-2">
            This panel will display the live Stagehand browser. Controls are disabled in placeholder mode.
          </div>
        </div>
      </div>
    </div>
  );
}

export default BrowserPanel;


