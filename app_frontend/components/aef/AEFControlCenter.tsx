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
  sopId?: string;
}

const AEFControlCenter: React.FC<AEFControlCenterProps> = ({
  sopData,
  onTransformToAEF,
  isTransforming = false,
  transformError = null,
  onClearTransformError,
  executionId,
  isLoading = false,
  sopId
}) => {
  // Real execution state
  const [realExecutionId, setRealExecutionId] = useState<string | null>(executionId || null);
  const [realExecutionStatus, setRealExecutionStatus] = useState<'idle' | 'creating' | 'running' | 'error'>('idle');
  
  // VNC Environment state
  const [vncEnvironmentId, setVncEnvironmentId] = useState<string | null>(null);
  const [vncEnvironmentStatus, setVncEnvironmentStatus] = useState<'idle' | 'creating' | 'running' | 'error'>('idle');
  
  // Mock AEF state for demonstration
  const [mockExecutionState, setMockExecutionState] = useState<MockExecutionState | null>(null);
  const [showMockExecution, setShowMockExecution] = useState(false);
  
  // Check if this SOP has been transformed to AEF (using mock for demo)
  const shouldShowMock = shouldShowMockAEF(sopId || '');
  const isAEF = isAEFDocument(sopData) || shouldShowMock;
  
  // Create mock AEF document for demonstration
  const aefDocument = isAEFDocument(sopData) 
    ? (sopData as AEFDocument)
    : shouldShowMock 
      ? createMockAEFTransformation(sopData)
      : null;

  // Real execution handler
  const handleStartRealExecution = async () => {
    const documentId = sopId || aefDocument?.meta?.id;
    
    if (!documentId) {
      console.error('No SOP/AEF document ID available');
      setRealExecutionStatus('error');
      return;
    }

    setRealExecutionStatus('creating');
    
    try {
      console.log('Creating real AEF execution for document:', documentId);
      
      const response = await fetch('/api/aef/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          aefDocumentId: documentId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create execution');
      }
      
      const execution = await response.json();
      console.log('Real execution created:', execution.executionId);
      
      setRealExecutionId(execution.executionId);
      setRealExecutionStatus('running');
      
    } catch (error) {
      console.error('Failed to create real execution:', error);
      setRealExecutionStatus('error');
      // TODO: Show error message to user
    }
  };

  const handleStopRealExecution = async () => {
    if (!realExecutionId) return;
    
    try {
      console.log('Stopping real execution:', realExecutionId);
      
      const response = await fetch(`/api/aef/stop/${realExecutionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to stop execution');
      }
      
      setRealExecutionId(null);
      setRealExecutionStatus('idle');
      console.log('Real execution stopped');
      
    } catch (error) {
      console.error('Failed to stop real execution:', error);
      // Still reset state
      setRealExecutionId(null);
      setRealExecutionStatus('idle');
    }
  };

  // Demo execution handler (mock)
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

  // VNC Environment handlers
  const handleStartVncEnvironment = async () => {
    setVncEnvironmentStatus('creating');
    
    try {
      console.log('🖥️ Starting VNC execution environment...');
      
      // Generate a simple execution ID for VNC session
      const vncExecutionId = `vnc-env-${Date.now()}`;
      
      // Call our Docker container creation directly
      const response = await fetch('/api/aef/start-vnc-environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          executionId: vncExecutionId,
          userId: 'demo-user'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to start VNC environment');
      }
      
      const result = await response.json();
      console.log('🚀 VNC environment created:', result);
      
      setVncEnvironmentId(vncExecutionId);
      setVncEnvironmentStatus('running');
      
    } catch (error) {
      console.error('❌ Failed to start VNC environment:', error);
      setVncEnvironmentStatus('error');
    }
  };

  const handleStopVncEnvironment = async () => {
    if (!vncEnvironmentId) return;
    
    try {
      console.log('🛑 Stopping VNC environment:', vncEnvironmentId);
      
      // Call stop endpoint (we'll create this)
      const response = await fetch('/api/aef/stop-vnc-environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId: vncEnvironmentId })
      });
      
      if (!response.ok) {
        console.warn('Failed to stop VNC environment gracefully');
      }
      
      setVncEnvironmentId(null);
      setVncEnvironmentStatus('idle');
      console.log('✅ VNC environment stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop VNC environment:', error);
      // Still reset state
      setVncEnvironmentId(null);
      setVncEnvironmentStatus('idle');
    }
  };

  // Determine which execution to use (prioritize VNC environment)
  const activeExecutionId = vncEnvironmentId || realExecutionId || mockExecutionState?.executionId || executionId;
  const isExecutionActive = !!vncEnvironmentId || !!realExecutionId || showMockExecution || !!executionId;
  const currentMockState = (vncEnvironmentId || realExecutionId) ? null : mockExecutionState; // Don't use mock if real execution or VNC is active

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

  // CSS Grid layout for precise control
  return (
    <div className="aef-control-center h-screen bg-white overflow-hidden" 
         style={{
           display: 'grid',
           gridTemplateRows: 'auto 1fr',
           height: '100vh'
         }}>
      {/* Header - Auto height */}
      <div className="p-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
            <h2 className="text-sm font-semibold text-gray-900">AEF Control Center</h2>
            <div className="flex items-center gap-2 text-xs">
              {vncEnvironmentId && (
                <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                  VNC Remote Desktop
                </div>
              )}
              {realExecutionId && !vncEnvironmentId && (
                <div className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Live Browser Session
                </div>
              )}
              {mockExecutionState && !realExecutionId && !vncEnvironmentId && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Mock Demo Mode
                </div>
              )}
              {!realExecutionId && !mockExecutionState && !vncEnvironmentId && (
                <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  Ready to Execute
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* VNC Environment Controls - Primary Option */}
            {!vncEnvironmentId ? (
              <Button
                onClick={handleStartVncEnvironment}
                size="sm"
                disabled={vncEnvironmentStatus === 'creating'}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                {vncEnvironmentStatus === 'creating' ? (
                  <>
                    <div className="w-3 h-3 animate-spin border border-white border-t-transparent rounded-full mr-2"></div>
                    Starting...
                  </>
                ) : (
                  '🖥️ Start Remote Desktop'
                )}
              </Button>
            ) : (
              <Button
                onClick={handleStopVncEnvironment}
                size="sm"
                variant="destructive"
              >
                ⏹️ Stop Remote Desktop
              </Button>
            )}
            
            {/* Real Execution Controls - Secondary Option */}
            {!vncEnvironmentId && (
              <>
                {!realExecutionId ? (
                  <Button
                    onClick={handleStartRealExecution}
                    size="sm"
                    disabled={realExecutionStatus === 'creating'}
                    variant="outline"
                    className="border-green-200 text-green-700 hover:bg-green-50"
                  >
                    {realExecutionStatus === 'creating' ? (
                      <>
                        <div className="w-3 h-3 animate-spin border border-green-600 border-t-transparent rounded-full mr-2"></div>
                        Starting...
                      </>
                    ) : (
                      '🚀 Full Execution (Advanced)'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopRealExecution}
                    size="sm"
                    variant="destructive"
                  >
                    ⏹️ Stop Execution
                  </Button>
                )}
              </>
            )}
            
            {/* Mock Demo Controls */}
            {!showMockExecution && !realExecutionId ? (
              <Button
                onClick={handleStartMockExecution}
                size="sm"
                variant="outline"
              >
                🎭 Demo Mode
              </Button>
            ) : showMockExecution ? (
              <Button
                onClick={handleStopMockExecution}
                size="sm"
                variant="outline"
              >
                ⏹️ Stop Demo
              </Button>
            ) : null}
          </div>
        </div>
        
        {/* Status Information */}
        {vncEnvironmentStatus === 'error' && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            ⚠️ Failed to start VNC environment. Check console for details.
          </div>
        )}
        {realExecutionStatus === 'error' && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
            ⚠️ Failed to start real execution. Check console for details.
          </div>
        )}
      </div>
      
      {/* Main content area with CSS Grid */}
      <div className="overflow-hidden"
           style={{
             display: 'grid',
             gridTemplateRows: '70% 30%',
             height: '100%'
           }}>
        {/* Top area - 70% */}
        <div className="overflow-hidden"
             style={{
               display: 'grid',
               gridTemplateColumns: '35% 65%',
               height: '100%'
             }}>
          {/* Left panel - SOP */}
          <div className="border-r border-gray-200 overflow-hidden">
            <ExecutionPanel 
              aefDocument={aefDocument!}
              executionId={activeExecutionId}
              mockExecutionState={currentMockState}
              onStartMockExecution={handleStartMockExecution}
              onStopMockExecution={handleStopMockExecution}
            />
          </div>
          
          {/* Right panel - Browser */}
          <div className="bg-gray-50 overflow-hidden">
            <BrowserPanel 
              executionId={activeExecutionId}
              isActive={isExecutionActive}
              mockExecutionState={currentMockState}
            />
          </div>
        </div>
        
        {/* Bottom area - 30% */}
        <div className="border-t border-gray-200 overflow-hidden">
          <ExecutionLog 
            executionId={activeExecutionId}
            mockLogs={currentMockState?.logs}
          />
        </div>
      </div>
    </div>
  );
};

export default AEFControlCenter; 