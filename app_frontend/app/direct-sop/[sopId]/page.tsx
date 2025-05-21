'use client'; // Make this a Client Component
import React, { useState, useEffect } from 'react';
import SOPListView from '@/components/sop/SOPListView';
import SOPFlowView from '@/components/sop/SOPFlowView';
import { Button } from "@/components/ui/button";
import { SOPDocument, SOPNode } from '@/lib/types/sop';
import { processSopData, getRootNodes } from '@/lib/sop-utils';

interface SopPageProps {
  params: {
    sopId: string;
  };
}

export default function DirectSopPage({ params }: SopPageProps) {
  const [currentView, setCurrentView] = useState<'list' | 'flow'>('flow'); // Default to flow view
  const [sopData, setSopData] = useState<SOPDocument | null>(null);
  const [processedSopData, setProcessedSopData] = useState<SOPDocument | null>(null);
  const [rootNodes, setRootNodes] = useState<SOPNode[]>([]);
  const [listProcessedSopData, setListProcessedSopData] = useState<SOPDocument | null>(null);
  const [listRootNodes, setListRootNodes] = useState<SOPNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Function to handle updates from the list view
  const handleListUpdate = (newData: SOPDocument) => {
    setProcessedSopData(newData);
    const newRoots = getRootNodes(newData.public);
    setRootNodes(newRoots);
  };

  // Fetch SOP data on mount
  useEffect(() => {
    const fetchSopData = async () => {
      try {
        // Use the direct-sop API endpoint
        const timestamp = new Date().getTime();
        const random = Math.random().toString(36).substring(2, 15);
        const endpointPath = `/api/direct-sop/${params.sopId}?_=${timestamp}&r=${random}`;
        
        console.log('Fetching direct SOP data');
        
        const response = await fetch(endpointPath, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const sopResponse = await response.json();
        console.log('Fetched SOP data:', sopResponse);
        const combinedData: SOPDocument = sopResponse.data;
        setSopData(combinedData);
        
        const processed = processSopData(combinedData);
        setProcessedSopData(processed);
        setListProcessedSopData(processed);

        const roots = getRootNodes(processed.public);
        setRootNodes(roots);
        setListRootNodes(roots);
        
        setIsLoading(false);
      } catch (e: any) {
        setError(e.message || 'Failed to load SOP data.');
        console.error(e);
        setIsLoading(false);
      }
    };

    fetchSopData();
  }, [params.sopId]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>Loading SOP data...</p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-screen">
        <p className="text-red-500 text-xl mb-4">Error</p>
        <p className="text-gray-700">{error}</p>
        <Button className="mt-6" onClick={() => window.location.href = '/'}>
          Return to Upload Page
        </Button>
      </div>
    );
  }

  // Show "no data" state
  if (!processedSopData || !listProcessedSopData) {
    return (
      <div className="flex justify-center items-center h-screen">
        <p>No SOP data available.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-surface-2">
      {/* Header */}
      <header className="bg-neutral-surface-1 shadow-card-default sticky top-0 z-50">
        <div className="container mx-auto h-16 flex items-center justify-between px-4">
          <p className="text-lg font-semibold text-foreground">Runops SOP Viewer (Direct Mode)</p>
          <div className="text-sm text-muted-foreground">Viewing: {params.sopId}</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 overflow-hidden p-2 gap-2">
        <div className="flex-grow bg-white shadow-lg rounded-card-radius overflow-hidden flex flex-col">
          <div className="p-4 border-b border-neutral-surface-3 flex justify-between items-center">
            <h1 className="text-xl font-semibold text-foreground">
              {sopData?.meta?.title || 'SOP Visualization'}
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
              <SOPFlowView sopData={processedSopData} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 