'use client'; // Make this a Client Component
import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import SOPFlowView from '@/components/sop/SOPFlowView';
import { Button } from "@/components/ui/button";
import { SOPDocument } from '@/lib/types/sop'; // Import types
import { processSopData } from '@/lib/sop-utils'; // Import utils

export default function TestCompoundSopPage() {
  const [sopData, setSopData] = useState<SOPDocument | null>(null);
  const [processedSopData, setProcessedSopData] = useState<SOPDocument | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  useEffect(() => {
    const fetchSopData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        // Use test-compound.json instead of mocksop.json
        const response = await fetch('/test-compound.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: SOPDocument = await response.json();
        setSopData(data);
        
        const processed = processSopData(data); // Process once
        setProcessedSopData(processed);

        // Debug information
        const parentNodes = processed.public.nodes.filter(n => n.children && n.children.length > 0);
        const childNodes = processed.public.nodes.filter(n => n.parentId);
        
        const debugText = `
            Total nodes: ${processed.public.nodes.length}
            Potential parents: ${parentNodes.length}
            Parent IDs: ${parentNodes.map(n => n.id).join(', ')}
            Child nodes: ${childNodes.length}
            Child Node Details: ${childNodes.map(n => `${n.id} (parent: ${n.parentId})`).join(', ')}
          `;
          
        setDebugInfo(debugText);
      } catch (e: any) {
        setError(e.message || 'Failed to load SOP data.');
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSopData();
  }, []);

  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><p>Loading SOP data...</p></div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen"><p className="text-red-500">Error: {error}</p></div>;
  }

  if (!processedSopData) {
    return <div className="flex justify-center items-center h-screen"><p>No SOP data available.</p></div>;
  }

  return (
    <div className="flex flex-col h-screen bg-neutral-surface-2">
      <header className="bg-neutral-surface-1 shadow-card-default sticky top-0 z-50">
        <div className="container mx-auto h-16 flex items-center justify-between px-4">
          <p className="text-lg font-semibold text-foreground">SOP Viewer - Test Compound</p>
          <div className="text-sm text-muted-foreground">SOP ID: test-compound</div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden p-2">
        <div className="flex-grow bg-white shadow-lg rounded-card-radius overflow-hidden flex flex-col">
          <div className="p-4 border-b border-neutral-surface-3">
            <h1 className="text-xl font-semibold text-foreground">
              {sopData?.meta.title || 'Test SOP'}
            </h1>
            
            {debugInfo && (
              <div className="text-xs font-mono mt-2 p-2 bg-gray-100 rounded overflow-auto max-h-40">
                <pre>{debugInfo}</pre>
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {processedSopData && <SOPFlowView sopData={processedSopData} />}
          </div>
        </div>
      </main>
    </div>
  );
} 