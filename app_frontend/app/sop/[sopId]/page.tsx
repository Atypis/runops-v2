'use client'; // Make this a Client Component
import React, { useState, useEffect, useRef } from 'react'; // Add useRef for polling interval
import SOPListView from '@/components/sop/SOPListView';
import SOPFlowView from '@/components/sop/SOPFlowView'; // Uncomment and import
import ElegantSOPView from '@/components/sop/ElegantSOPView';
import AEFControlCenter from '@/components/aef/AEFControlCenter';
import { Button } from "@/components/ui/button";
import { SOPDocument, SOPNode } from '@/lib/types/sop'; // Import types
import { processSopData, getRootNodes } from '@/lib/sop-utils'; // Import utils
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface SopPageProps {
  params: {
    sopId: string;
  };
}

type JobStatus = 'queued' | 'processing' | 'completed' | 'error' | 'unknown';

export default function SopPage({ params }: SopPageProps) {
  const [viewMode, setViewMode] = useState<'list' | 'flow' | 'aef'>('list');
  const [sopData, setSopData] = useState<SOPDocument | null>(null);
  const [processedSopData, setProcessedSopData] = useState<SOPDocument | null>(null);
  const [rootNodes, setRootNodes] = useState<SOPNode[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus>('unknown');
  const [processingStage, setProcessingStage] = useState<string>('');
  const [processingProgress, setProcessingProgress] = useState<number>(0);
  
  // Polling interval reference
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  // States for list view interactions (will be passed to SOPListView)
  // These were previously managed within SOPListView, lifting them up.
  const [listProcessedSopData, setListProcessedSopData] = useState<SOPDocument | null>(null);
  const [listRootNodes, setListRootNodes] = useState<SOPNode[]>([]);

  // Get user-friendly stage description
  const getStageDescription = (stage: string): string => {
    const stages: { [key: string]: string } = {
      'preparing_video': 'Preparing video...',
      'transcribing': 'Transcribing video content...',
      'parsing_sop': 'Generating your SOP...',
      'finalizing': 'Finishing up...',
      'completed': 'Complete!'
    };
    return stages[stage] || 'Processing...';
  };

  // Function to check job status
  const checkJobStatus = async () => {
    try {
      // Add cache-busting parameter to prevent caching
      const timestamp = new Date().getTime();
      const random = Math.random().toString(36).substring(2, 15);
      
      // Use the main endpoint
      const endpointPath = `/api/job-status/${params.sopId}?_=${timestamp}&r=${random}`;
      
      console.log('Checking job status');
      
      const response = await fetch(endpointPath, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch job status');
      }
      
      const data = await response.json();
      console.log('Job status response:', data); // Debug log
      setJobStatus(data.status || 'unknown');
      setProcessingStage(data.progressStage || '');
      setProcessingProgress(data.progressPercent || 0);
      
      // If job is complete, clear polling interval and load SOP data
      if (data.status === 'completed') {
        console.log('Job is completed, loading SOP data'); // Debug log
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
          pollingInterval.current = null;
        }
        fetchSopData();
      } else if (data.status === 'error') {
        // If job failed, clear polling interval and show error
        console.log('Job has error status:', data.error); // Debug log
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
      // Determine which endpoint to use
      const timestamp = new Date().getTime();
      const random = Math.random().toString(36).substring(2, 15);
      const endpointPath = `/api/sop/${params.sopId}?_=${timestamp}&r=${random}`;
      
      console.log('Fetching SOP data');
      
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
      console.log('Fetched SOP data:', sopResponse); // Debug log
      const combinedData: SOPDocument = sopResponse.data;
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
    // Start polling with the selected endpoint
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
        
        <div className="text-center space-y-3 mb-6">
          <p className="text-xl text-gray-700">AI magic in progress...</p>
          <p className="text-sm text-gray-500">
            {jobStatus === 'queued' 
              ? 'Your video is waiting to be processed' 
              : getStageDescription(processingStage)
            }
          </p>
        </div>
        
        {jobStatus === 'processing' && processingProgress > 0 && (
          <div className="w-full max-w-md space-y-2">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 transition-all duration-500 ease-in-out" 
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-400 text-center">
              {processingProgress}% complete
            </p>
          </div>
        )}
      </div>
    );
  }

  // Show general loading state
  if (isLoading) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">
                      RunOps
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Loading SOP...</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min flex items-center justify-center">
              <p>Loading SOP data...</p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // Show error state
  if (error) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">
                      RunOps
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Error</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-500 text-xl mb-4">Error</p>
                <p className="text-gray-700 mb-6">{error}</p>
                <Button onClick={() => window.location.href = '/'}>
                  Return to Upload Page
                </Button>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  // Show "no data" state
  if (!processedSopData || !listProcessedSopData) {
    return (
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="#">
                      RunOps
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>No Data</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </header>
          
          <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
            <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min flex items-center justify-center">
              <p>No SOP data available.</p>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    RunOps
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>
                    {sopData?.meta?.title || `SOP ${params.sopId}`}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <div className="flex gap-1">
              <Button 
                variant={viewMode === 'list' ? 'default' : 'ghost'} 
                onClick={() => setViewMode('list')} 
                size="sm"
                className="text-xs"
              >
                List
              </Button>
              <Button 
                variant={viewMode === 'flow' ? 'default' : 'ghost'} 
                onClick={() => setViewMode('flow')} 
                size="sm"
                className="text-xs"
              >
                Flow
              </Button>
              <Button 
                variant={viewMode === 'aef' ? 'default' : 'ghost'} 
                onClick={() => setViewMode('aef')} 
                size="sm"
                className="text-xs"
              >
                🤖 AEF
              </Button>
            </div>
          </div>
        </header>
        
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[100vh] flex-1 rounded-xl md:min-h-min overflow-hidden">
            {viewMode === 'list' ? (
              <ElegantSOPView 
                sopData={processedSopData} 
                rootNodes={listRootNodes}
              />
            ) : viewMode === 'flow' ? (
              <div className="bg-muted/50 h-full rounded-xl">
                <SOPFlowView sopData={processedSopData} />
              </div>
            ) : (
              <div className="h-full rounded-xl overflow-hidden">
                <AEFControlCenter 
                  sopData={processedSopData}
                  onTransformToAEF={() => {
                    // TODO: Implement AEF transformation
                    console.log('Transform to AEF clicked');
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
} 