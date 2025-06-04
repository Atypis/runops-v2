'use client';

import React from 'react';
import { SOPDocument } from '@/lib/types/sop';
import { AEFDocument, isAEFDocument } from '@/lib/types/aef';
import ExecutionPanel from './ExecutionPanel';
import BrowserPanel from './BrowserPanel';
import ExecutionLog from './ExecutionLog';

interface AEFControlCenterProps {
  sopData: SOPDocument;
  onTransformToAEF?: () => void;
  executionId?: string;
  isLoading?: boolean;
}

const AEFControlCenter: React.FC<AEFControlCenterProps> = ({
  sopData,
  onTransformToAEF,
  executionId,
  isLoading = false
}) => {
  // Check if this SOP has been transformed to AEF
  const isAEF = isAEFDocument(sopData);
  const aefDocument = isAEF ? (sopData as AEFDocument) : null;

  // Show transform needed state if not yet transformed
  if (!isAEF) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">🤖</span>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Transform to AEF
          </h3>
          <p className="text-gray-600 mb-6">
            Convert this workflow into an executable automation framework to run it with AI assistance.
          </p>
          <button
            onClick={onTransformToAEF}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            🚀 Transform to AEF
          </button>
        </div>
      </div>
    );
  }

  // Show loading state during operations
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading AEF Control Center...</p>
        </div>
      </div>
    );
  }

  // Main tri-panel layout
  return (
    <div className="aef-control-center h-full flex flex-col bg-white">
      {/* Top panels - 80% height */}
      <div className="top-panels flex-1 flex min-h-0">
        {/* Left panel - Execution Control (40% width) */}
        <div className="w-2/5 border-r border-gray-200 flex flex-col">
          <ExecutionPanel 
            aefDocument={aefDocument!}
            executionId={executionId}
          />
        </div>
        
        {/* Right panel - Browser View (60% width) */}
        <div className="w-3/5 flex flex-col">
          <BrowserPanel 
            executionId={executionId}
            isActive={!!executionId}
          />
        </div>
      </div>
      
      {/* Bottom panel - Execution Log (20% height) */}
      <div className="h-1/5 border-t border-gray-200 flex flex-col min-h-0">
        <ExecutionLog 
          executionId={executionId}
        />
      </div>
    </div>
  );
};

export default AEFControlCenter; 