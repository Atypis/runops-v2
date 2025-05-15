import React from 'react';
import SOPListView from '@/components/sop/SOPListView';

interface SopPageProps {
  params: {
    sopId: string;
  };
}

export default function SopPage({ params }: SopPageProps) {
  return (
    <div className="flex flex-col h-screen bg-neutral-surface-2"> {/* Uses custom neutral surface from Tailwind config */}
      {/* Global Header Placeholder */}
      <header className="bg-neutral-surface-1 shadow-card-default sticky top-0 z-50"> {/* Uses custom shadow */}
        <div className="container mx-auto h-16 flex items-center justify-between px-4">
          <p className="text-lg font-semibold text-foreground">Runops SOP Viewer</p>
          {/* Placeholder for global navigation, logo, or view toggle */}
          <div className="text-sm text-muted-foreground">SOP ID: {params.sopId}</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden p-2 gap-2">
        {/* Left Pane (SOP Content) */}
        <div className="flex-grow-[2] bg-white shadow-lg rounded-card-radius overflow-hidden">
          {/* Replace placeholder with SOPListView */}
          <SOPListView />
        </div>

        {/* Right Pane (AI Assistant Chat) */}
        <div className="flex-grow-[1] p-4 bg-neutral-surface-1 shadow-lg rounded-card-radius overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4 text-primary sticky top-0 bg-neutral-surface-1 py-2 z-10">AI Assistant</h2>
          <div className="border-2 border-dashed border-neutral-surface-3 h-96 rounded-md flex items-center justify-center">
            <p className="text-neutral-surface-3 font-medium">Chat panel will be here.</p>
          </div>
          {/* More chat UI elements will go here */}
        </div>
      </main>
    </div>
  );
} 