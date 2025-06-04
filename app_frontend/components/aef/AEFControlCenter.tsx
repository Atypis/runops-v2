'use client';

import React, { useState, useEffect } from 'react';
import { SOPDocument } from '@/lib/types/sop';
import { AEFDocument, isAEFDocument } from '@/lib/types/aef';
import { createMockAEFTransformation, createMockExecutionState, shouldShowMockAEF, MockExecutionState } from '@/lib/mock-aef-data';
import ExecutionPanel from './ExecutionPanel';
import BrowserPanel from './BrowserPanel';
import ExecutionLog from './ExecutionLog';
import TransformLoading from './TransformLoading';
import { Button } from '@/components/ui/button';

interface AEFControlCenterProps {
  sopData: SOPDocument;
  onTransformToAEF?: (isAtomic: boolean) => void;
  isTransforming?: boolean;
  transformError?: string | null;
  onClearTransformError?: () => void;
  executionId?: string;
  isLoading?: boolean;
}

const AEFControlCenter: React.FC<AEFControlCenterProps> = ({
  sopData,
  onTransformToAEF,
  isTransforming = false,
  transformError = null,
  onClearTransformError,
  executionId,
  isLoading = false
}) => {
  // Mock AEF state for demonstration
  const [mockExecutionState, setMockExecutionState] = useState<MockExecutionState | null>(null);
  const [showMockExecution, setShowMockExecution] = useState(false);
  
  // Check if this SOP has been transformed to AEF (using mock for demo)
  const shouldShowMock = shouldShowMockAEF(sopData.meta?.id || '');
  const isAEF = isAEFDocument(sopData) || shouldShowMock;
  
  // Create mock AEF document for demonstration
  const aefDocument = isAEFDocument(sopData) 
    ? (sopData as AEFDocument)
    : shouldShowMock 
      ? createMockAEFTransformation(sopData)
      : null;

  // Demo execution handler
  const handleStartMockExecution = () => {
    if (aefDocument) {
      const mockState = createMockExecutionState(aefDocument);
      setMockExecutionState(mockState);
      setShowMockExecution(true);
    }
  };

  const handleStopMockExecution = () => {
    setMockExecutionState(null);
    setShowMockExecution(false);
  };

  // Show transformation loading state
  if (isTransforming) {
    return <TransformLoading />;
  }

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
            Convert this atomic workflow into executable browser automation instructions with AI assistance.
          </p>
          
          {/* Error message */}
          {transformError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm mb-3">{transformError}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onClearTransformError}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Try Again
              </Button>
            </div>
          )}
          
          {/* Single Transform Button */}
          <button
            onClick={() => onTransformToAEF?.(true)}
            disabled={isTransforming}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🚀 Generate Browser Automation
          </button>
          
          <p className="text-xs text-gray-500 mt-4">
            Convert atomic workflow steps into executable Stagehand instructions
          </p>
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
            executionId={mockExecutionState?.executionId || executionId}
            mockExecutionState={mockExecutionState}
            onStartMockExecution={handleStartMockExecution}
            onStopMockExecution={handleStopMockExecution}
          />
        </div>
        
        {/* Right panel - Browser View (60% width) */}
        <div className="w-3/5 flex flex-col">
          <BrowserPanel 
            executionId={mockExecutionState?.executionId || executionId}
            isActive={showMockExecution || !!executionId}
            mockExecutionState={mockExecutionState}
          />
        </div>
      </div>
      
      {/* Bottom panel - Execution Log (20% height) */}
      <div className="h-1/5 border-t border-gray-200 flex flex-col min-h-0">
        <ExecutionLog 
          executionId={mockExecutionState?.executionId || executionId}
          mockLogs={mockExecutionState?.logs}
        />
      </div>
    </div>
  );
};

export default AEFControlCenter; 