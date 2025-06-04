'use client';

import React, { useState } from 'react';
import { AEFDocument } from '@/lib/types/aef';
import { ExecutionStatus } from '@/lib/types/execution';
import { Button } from '@/components/ui/button';
import { Play, Square, Pause, RotateCcw, Settings, ChevronRight, ChevronDown } from 'lucide-react';

interface ExecutionPanelProps {
  aefDocument: AEFDocument;
  executionId?: string;
}

const ExecutionPanel: React.FC<ExecutionPanelProps> = ({
  aefDocument,
  executionId
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());

  // Mock execution status for now - will be replaced with real data
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>(ExecutionStatus.IDLE);
  
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

  const handleRunAll = () => {
    setIsRunning(true);
    setExecutionStatus(ExecutionStatus.RUNNING);
    // TODO: Implement actual execution start
    console.log('Starting workflow execution...');
  };

  const handleStop = () => {
    setIsRunning(false);
    setExecutionStatus(ExecutionStatus.IDLE);
    // TODO: Implement actual execution stop
    console.log('Stopping workflow execution...');
  };

  const handleRunStep = (stepId: string) => {
    // TODO: Implement individual step execution
    console.log(`Running step: ${stepId}`);
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