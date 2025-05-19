'use client'; // Make this a Client Component
import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import SOPListView from '@/components/sop/SOPListView';
import SOPFlowView from '@/components/sop/SOPFlowView'; // Uncomment and import
import { Button } from "@/components/ui/button";
import { SOPDocument, SOPNode } from '@/lib/types/sop'; // Import types
import { processSopData, getRootNodes } from '@/lib/sop-utils'; // Import utils

interface SopPageProps {
  params: {
    sopId: string;
  };
}

export default function SopPage({ params }: SopPageProps) {
  const [currentView, setCurrentView] = useState<'list' | 'flow'>('list');
  const [sopData, setSopData] = useState<SOPDocument | null>(null);
  const [processedSopData, setProcessedSopData] = useState<SOPDocument | null>(null);
  const [rootNodes, setRootNodes] = useState<SOPNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // States for list view interactions (will be passed to SOPListView)
  // These were previously managed within SOPListView, lifting them up.
  const [listProcessedSopData, setListProcessedSopData] = useState<SOPDocument | null>(null);
  const [listRootNodes, setListRootNodes] = useState<SOPNode[]>([]);

  // Flow view specific data (using original-structure)
  const [flowSopData, setFlowSopData] = useState<SOPDocument | null>(null);
  const [flowProcessedSopData, setFlowProcessedSopData] = useState<SOPDocument | null>(null);

  useEffect(() => {
    const fetchSopData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // For list view - fetch the standard mocksop.json
        const listResponse = await fetch('/mocksop.json');
        if (!listResponse.ok) {
          throw new Error(`HTTP error! status: ${listResponse.status}`);
        }
        const listData: SOPDocument = await listResponse.json();
        setSopData(listData);
        
        const processed = processSopData(listData); // Process once for list view
        setProcessedSopData(processed);
        setListProcessedSopData(processed); // Initialize for list view

        const roots = getRootNodes(processed.public);
        setRootNodes(roots);
        setListRootNodes(roots); // Initialize for list view

        // For flow view - fetch the original-structure version
        const flowResponse = await fetch('/mocksop-original-structure.json');
        if (!flowResponse.ok) {
          throw new Error(`HTTP error! status: ${flowResponse.status}`);
        }
        const flowData: SOPDocument = await flowResponse.json();
        setFlowSopData(flowData);
        
        const flowProcessed = processSopData(flowData); // Process separately for flow view
        setFlowProcessedSopData(flowProcessed);

      } catch (e: any) {
        setError(e.message || 'Failed to load SOP data.');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSopData();
  }, [params.sopId]); // Reload if sopId changes, though mocksop is static for now

  // Handler for updates from SOPListView (editing/deleting nodes)
  // This will update listProcessedSopData and listRootNodes
  const handleListUpdate = (updatedProcessedData: SOPDocument) => {
    setListProcessedSopData(updatedProcessedData);
    const newRoots = getRootNodes(updatedProcessedData.public);
    setListRootNodes(newRoots);
    // Also update the main processedSopData if list view changes should reflect in flow view immediately
    setProcessedSopData(updatedProcessedData); 
    setRootNodes(newRoots);
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><p>Loading SOP data...</p></div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen"><p className="text-red-500">Error: {error}</p></div>;
  }

  if (!processedSopData || !listProcessedSopData || !flowProcessedSopData) {
    return <div className="flex justify-center items-center h-screen"><p>No SOP data available.</p></div>;
  }

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
        <div className="flex-grow-[2] bg-white shadow-lg rounded-card-radius overflow-hidden flex flex-col">
          <div className="p-4 border-b border-neutral-surface-3 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-foreground">
              {currentView === 'list' ? sopData?.meta.title || 'SOP' : flowSopData?.meta.title || 'SOP'}
            </h1>
            <div className="flex gap-2">
              <Button variant={currentView === 'list' ? 'default' : 'outline'} onClick={() => setCurrentView('list')} size="sm">List View</Button>
              <Button variant={currentView === 'flow' ? 'default' : 'outline'} onClick={() => setCurrentView('flow')} size="sm">Flow View</Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {currentView === 'list' ? (
              <SOPListView
                initialProcessedSopData={listProcessedSopData}
                initialRootNodes={listRootNodes}
                onUpdate={handleListUpdate} 
              />
            ) : (
              <SOPFlowView sopData={flowProcessedSopData} />
            )}
          </div>
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