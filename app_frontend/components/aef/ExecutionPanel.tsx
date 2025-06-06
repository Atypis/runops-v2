'use client';

import React, { useState, useEffect } from 'react';
import { AEFDocument } from '@/lib/types/aef';
import { ExecutionStatus } from '@/lib/types/execution';
import { MockExecutionState } from '@/lib/mock-aef-data';
import { Button } from '@/components/ui/button';
import { Play, Square, Pause, RotateCcw, Settings, ChevronRight, ChevronDown } from 'lucide-react';

interface ExecutionPanelProps {
  aefDocument: AEFDocument;
  executionId?: string;
  mockExecutionState?: MockExecutionState | null;
  onStartMockExecution?: () => void;
  onStopMockExecution?: () => void;
}

const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  aefDocument,
  executionId,
  mockExecutionState,
  onStartMockExecution,
  onStopMockExecution
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Use mock execution state when available
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>(ExecutionStatus.IDLE);
  
  // Update state based on mock execution
  useEffect(() => {
    if (mockExecutionState) {
      setIsRunning(mockExecutionState.isRunning);
      setExecutionStatus(mockExecutionState.isRunning ? ExecutionStatus.RUNNING : ExecutionStatus.IDLE);
      setCurrentStep(mockExecutionState.currentStepName);
    } else {
      setIsRunning(false);
      setExecutionStatus(ExecutionStatus.IDLE);
      setCurrentStep(null);
    }
  }, [mockExecutionState]);
  
  // Extract workflow steps from SOP data
  const workflowSteps = aefDocument?.public?.nodes || [];

  const toggleStepExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedSteps(newExpanded);
  };

  const handleRunAll = async () => {
    if (onStartMockExecution && !executionId) {
      // Use mock execution if no real executionId is provided
      onStartMockExecution();
      return;
    }

    // Start real execution
    setIsRunning(true);
    setExecutionStatus(ExecutionStatus.RUNNING);
    
    try {
      console.log('Starting real workflow execution...');
      
      // If we don't have an executionId yet, create a new execution
      if (!executionId) {
                 const response = await fetch('/api/aef/execute', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ 
             aefDocumentId: aefDocument.meta?.id 
           })
         });
        
        if (!response.ok) {
          throw new Error('Failed to create execution');
        }
        
        const execution = await response.json();
        console.log('Execution created:', execution.executionId);
        
        // Note: The parent component should handle setting the executionId
        // For now we'll just log it
      } else {
        console.log('Using existing execution:', executionId);
      }
      
    } catch (error) {
      console.error('Failed to start execution:', error);
      setIsRunning(false);
      setExecutionStatus(ExecutionStatus.IDLE);
      // TODO: Show error message to user
    }
  };

  const handleStop = async () => {
    if (onStopMockExecution && !executionId) {
      // Use mock execution stop if no real executionId
      onStopMockExecution();
      return;
    }

    if (!executionId) {
      setIsRunning(false);
      setExecutionStatus(ExecutionStatus.IDLE);
      return;
    }

    try {
      console.log('Stopping real workflow execution...');
      
      const response = await fetch(`/api/aef/stop/${executionId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to stop execution');
      }
      
      setIsRunning(false);
      setExecutionStatus(ExecutionStatus.IDLE);
      console.log('Execution stopped successfully');
      
    } catch (error) {
      console.error('Failed to stop execution:', error);
      // Still update UI to stopped state even if API call failed
      setIsRunning(false);
      setExecutionStatus(ExecutionStatus.IDLE);
    }
  };

  const handleRunStep = async (stepId: string) => {
    const stepNode = workflowSteps.find(step => step.id === stepId);
    const stepName = stepNode?.label || stepId;
    
    console.log(`🎯 [ExecutionPanel] Starting execution of step: ${stepId} (${stepName})`);
    console.log(`🎯 [ExecutionPanel] ExecutionId: ${executionId}`);
    console.log(`🎯 [ExecutionPanel] Step details:`, stepNode);

    if (!executionId) {
      const errorMsg = 'Cannot run step without executionId - please start an execution session first';
      console.error(`❌ [ExecutionPanel] ${errorMsg}`);
      alert(`❌ Error: ${errorMsg}`);
      return;
    }

    try {
      console.log(`🚀 [ExecutionPanel] Making API call to /api/aef/action/${executionId}`);
      
      const requestBody = {
        stepId,
        action: 'execute'
      };
      
      console.log(`📤 [ExecutionPanel] Request body:`, requestBody);
      
      const response = await fetch(`/api/aef/action/${executionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log(`📡 [ExecutionPanel] Response status: ${response.status}`);
      console.log(`📡 [ExecutionPanel] Response ok: ${response.ok}`);
      
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`❌ [ExecutionPanel] Response error data:`, errorData);
        throw new Error(`Failed to execute step (${response.status}): ${errorData}`);
      }
      
      const result = await response.json();
      console.log(`✅ [ExecutionPanel] Step execution result:`, result);
      
      // Show success message with details
      if (result.engineResult) {
        console.log(`🔧 [ExecutionPanel] ExecutionEngine result:`, result.engineResult);
        alert(`✅ ${result.engineResult.message}`);
        
        if (result.engineResult.nextNodeId) {
          console.log(`➡️  [ExecutionPanel] Next suggested node: ${result.engineResult.nextNodeId}`);
        }
      } else if (result.browserResult) {
        console.log(`🌐 [ExecutionPanel] Browser result:`, result.browserResult);
        alert(`✅ Browser action completed for step: ${stepName}`);
      } else {
        console.log(`✅ [ExecutionPanel] Step executed successfully`);
        alert(`✅ Step executed: ${stepName}`);
      }
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error(`❌ [ExecutionPanel] Failed to run step ${stepId}:`, error);
      console.error(`❌ [ExecutionPanel] Error details:`, {
        stepId,
        stepName,
        executionId,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      // Show detailed error to user
      alert(`❌ Failed to execute step "${stepName}": ${errorMsg}`);
    }
  };

  return (
    <div className="execution-panel h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          {aefDocument.meta?.title || 'Workflow Execution'}
        </h2>
        
        {/* Global Controls */}
        <div className="flex gap-2">
          {(executionStatus === ExecutionStatus.IDLE || executionStatus === ExecutionStatus.COMPLETED) ? (
            <Button 
              onClick={handleRunAll}
              className="flex-1"
              size="sm"
            >
              <Play className="w-4 h-4 mr-2" />
              Run All
            </Button>
          ) : (
            <Button 
              onClick={handleStop}
              variant="destructive"
              className="flex-1"
              size="sm"
            >
              <Square className="w-4 h-4 mr-2" />
              Stop
            </Button>
          )}
          
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Execution Status */}
        {executionStatus !== ExecutionStatus.IDLE && (
          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
            <div className="flex items-center justify-between text-sm">
              <span className="text-blue-700 font-medium">
                Status: {executionStatus}
              </span>
              {currentStep && (
                <span className="text-blue-600">
                  Step: {currentStep}
                </span>
              )}
            </div>
            {mockExecutionState && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-blue-600 mb-1">
                  <span>Progress: {mockExecutionState.currentStep}/{mockExecutionState.totalSteps}</span>
                  <span>{mockExecutionState.progress}%</span>
                </div>
                <div className="h-1 bg-blue-200 rounded overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${mockExecutionState.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto">
        {workflowSteps.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No workflow steps found
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {workflowSteps.map((step, index) => {
              const isExpanded = expandedSteps.has(step.id);
              const isCurrentStep = currentStep === step.id;
              
              return (
                <div key={step.id} className="p-4">
                  {/* Step Header */}
                  <div className={`flex items-center justify-between ${isCurrentStep ? 'bg-blue-50 -mx-4 px-4 py-2 rounded' : ''}`}>
                    <div className="flex items-center flex-1 min-w-0">
                      <button
                        onClick={() => toggleStepExpansion(step.id)}
                        className="mr-2 p-0.5 hover:bg-gray-100 rounded"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                      
                      <div className="flex items-center mr-3">
                        <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-mono text-gray-600">
                          {index + 1}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {step.label}
                        </h3>
                        {step.intent && (
                          <p className="text-sm text-gray-600 truncate">
                            {step.intent}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleRunStep(step.id)}
                      variant="outline"
                      size="sm"
                      disabled={isRunning}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Run
                    </Button>
                  </div>

                  {/* Step Details */}
                  {isExpanded && (
                    <div className="mt-3 ml-12 space-y-3">
                      {step.context && (
                        <div className="text-sm text-gray-600 p-3 bg-gray-50 rounded border">
                          <div dangerouslySetInnerHTML={{ __html: step.context }} />
                        </div>
                      )}
                      
                      {/* Checkpoint Configuration */}
                      <div className="text-xs text-gray-500 p-2 bg-yellow-50 rounded border border-yellow-200">
                        ✅ Checkpoint: Before execution
                        <br />
                        🔐 Execution method: Browser automation
                      </div>

                      {/* Sub-steps if any */}
                      {step.childNodes && step.childNodes.length > 0 && (
                        <div className="border border-gray-200 rounded">
                          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                            <span className="text-sm font-medium text-gray-700">
                              Sub-steps ({step.childNodes.length})
                            </span>
                          </div>
                          <div className="divide-y divide-gray-200">
                            {step.childNodes.map((subStep, subIndex) => (
                              <div key={subStep.id} className="p-3 flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <span className="w-5 h-5 bg-gray-100 rounded text-xs flex items-center justify-center text-gray-600">
                                    {subIndex + 1}
                                  </span>
                                  <span className="text-sm text-gray-900">
                                    {subStep.label}
                                  </span>
                                </div>
                                <Button variant="ghost" size="sm">
                                  <Play className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutionPanel; 