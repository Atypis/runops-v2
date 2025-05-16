'use client';
import React, { useState, useEffect } from 'react';
import SOPFlowView from '@/components/sop/SOPFlowView';
import { SOPDocument } from '@/lib/types/sop';
import { processSopData, transformSopToFlowData } from '@/lib/sop-utils';

export default function SimpleTestPage() {
  const [sopData, setSopData] = useState<SOPDocument | null>(null);
  const [processedSopData, setProcessedSopData] = useState<SOPDocument | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSopData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/simple-test.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data: SOPDocument = await response.json();
        setSopData(data);
        
        const processed = processSopData(data);
        setProcessedSopData(processed);

        // Debug data flow
        const { flowNodes, flowEdges } = transformSopToFlowData(processed);
        console.log("Simple test flow nodes:", flowNodes);
        console.log("Simple test parent nodes:", flowNodes.filter(n => n.type === 'loop'));
        console.log("Simple test child nodes:", flowNodes.filter(n => n.parentNode));

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
    return <div className="flex justify-center items-center h-screen"><p>Loading test data...</p></div>;
  }

  if (error) {
    return <div className="flex justify-center items-center h-screen"><p className="text-red-500">Error: {error}</p></div>;
  }

  if (!processedSopData) {
    return <div className="flex justify-center items-center h-screen"><p>No SOP data available.</p></div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="bg-gray-100 p-4">
        <h1 className="text-lg font-bold">Simple Parent-Child Test</h1>
        <p className="text-sm text-gray-500">Testing basic ReactFlow compound nodes</p>
      </header>
      
      <div className="flex-1 p-4">
        {processedSopData && <SOPFlowView sopData={processedSopData} />}
      </div>
    </div>
  );
} 