'use client'; // Make this a Client Component
import React, { useState, useEffect, useRef } from 'react'; // Add useRef for polling interval
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

type JobStatus = 'queued' | 'processing' | 'completed' | 'error' | 'unknown';

export default function SopPage({ params }: SopPageProps) {
  const [currentView, setCurrentView] = useState<'list' | 'flow'>('list');
  const [sopData, setSopData] = useState<SOPDocument | null>(null);
  const [processedSopData, setProcessedSopData] = useState<SOPDocument | null>(null);
  const [rootNodes, setRootNodes] = useState<SOPNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('unknown');
  
  // Polling interval reference
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // States for list view interactions (will be passed to SOPListView)
  // These were previously managed within SOPListView, lifting them up.
  const [listProcessedSopData, setListProcessedSopData] = useState<SOPDocument | null>(null);
  const [listRootNodes, setListRootNodes] = useState<SOPNode[]>([]);

  // Function to check job status
  const checkJobStatus = async () => {
    try {
      const response = await fetch(`/api/job-status/${params.sopId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch job status');
      }
      
      const data = await response.json();
      setJobStatus(data.status || 'unknown');
      
      // If job is complete, clear polling interval and load SOP data
      if (data.status === 'completed') {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        fetchSopData();
      } else if (data.status === 'error') {
        // If job failed, clear polling interval and show error
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        setError(data.error || 'An error occurred during video processing');
        setIsLoading(false);
      }
    } catch (e: any) {
      console.error('Error checking job status:', e);
      // Don't set error here - we want to keep polling even if a request fails
    }
  };
  
  // Function to start polling for job status
  const startStatusPolling = () => {
    // Clear any existing polling
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
    }
    
    // Start polling immediately
    checkJobStatus();
    
    // Then set up interval for every 3 seconds
    pollingInterval.current = setInterval(checkJobStatus, 3000);
  };

  // Fetch SOP data when available
  const fetchSopData = async () => {
    try {
      // Using the combined JSON file for both views
      const response = await fetch('/mocksop-original-structure.json');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const combinedData: SOPDocument = await response.json();
      setSopData(combinedData);
      
      const processed = processSopData(combinedData); // Process once for both views
      setProcessedSopData(processed);
      setListProcessedSopData(processed); // Initialize for list view

      const roots = getRootNodes(processed.public);
      setRootNodes(roots);
      setListRootNodes(roots); // Initialize for list view
      
      setIsLoading(false);
    } catch (e: any) {
      setError(e.message || 'Failed to load SOP data.');
      console.error(e);
      setIsLoading(false);
    }
  };

  // On mount, start polling for job status
  useEffect(() => {
    startStatusPolling();
    
    // Clean up on unmount
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [params.sopId]);

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

  // Show processing state
  if (isLoading && (jobStatus === 'queued' || jobStatus === 'processing')) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white">
        <div className="relative w-16 h-16 mb-6">
          <div className="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500 animate-spin"></div>
        </div>
        <p className="text-xl text-gray-700 mb-3">AI magic in progress...</p>
        <p className="text-sm text-gray-500">
          {jobStatus === 'queued' ? 'Your video is waiting to be processed' : 'Analyzing your workflow video'}
        </p>
      </div>
    );
  }

  // Show general loading state
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
              {sopData?.meta.title || 'SOP'}
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