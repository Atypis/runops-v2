'use client';

import React, { useState, useEffect } from 'react';
import SOPListView from '@/components/sop/SOPListView';
import { Button } from "@/components/ui/button";
import { SOPDocument, SOPNode } from '@/lib/types/sop';
import { processSopData, getRootNodes } from '@/lib/sop-utils';
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

interface DirectSopPageProps {
  params: {
    sopId: string;
  };
}

export default function DirectSopPage({ params }: DirectSopPageProps) {
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
        </header>
        
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="min-h-[100vh] flex-1 rounded-xl bg-muted/50 md:min-h-min overflow-hidden">
            <SOPListView
              initialProcessedSopData={listProcessedSopData}
              initialRootNodes={listRootNodes}
              onUpdate={handleListUpdate} 
            />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
} 