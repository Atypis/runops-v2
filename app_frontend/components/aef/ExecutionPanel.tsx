'use client';

import React, { useState, useEffect } from 'react';
import { AEFDocument } from '@/lib/types/aef';
import { ExecutionStatus } from '@/lib/types/execution';
import { MockExecutionState } from '@/lib/mock-aef-data';
import { Button } from '@/components/ui/button';
import { 
  Play, 
  Square, 
  Pause, 
  RotateCcw, 
  Settings, 
  ChevronRight, 
  ChevronDown,
  Terminal,
  Code,
  Zap,
  Globe,
  MousePointer,
  Eye,
  Copy,
  Bug,
  Clock,
  Target,
  ArrowRight
} from 'lucide-react';

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
  
  // Extract workflow steps from SOP data and get actions from hardcoded data
  const workflowSteps = aefDocument?.public?.nodes || [];

  // Get the hardcoded workflow data to access actions
  const getStepActions = (stepId: string) => {
    // This is a temporary solution to get the actions from the hardcoded data
    // In a real implementation, actions would be part of the SOPNode structure
    const hardcodedActions: { [key: string]: any[] } = {
      'start_workflow': [
        {
          type: 'navigate_or_switch_tab',
          instruction: 'Navigate to https://mail.google.com/mail/u/0/#inbox or switch to Gmail tab if already open',
          target: { url: 'https://mail.google.com/mail/u/0/#inbox' }
        }
      ],
      'scan_email_list': [
        {
          type: 'visual_scan',
          instruction: 'Scan the email list for subject lines and senders that might indicate investor-related content'
        }
      ],
      'select_email': [
        {
          type: 'click',
          instruction: 'Click on the first unprocessed investor email in the list',
          target: { selector: '[data-thread-id]:not([data-processed="true"])' }
        }
      ],
      'extract_investor_info': [
        {
          type: 'visual_scan',
          instruction: 'Read email content and identify investor information including name, company, email, phone, investment focus'
        }
      ],
      'open_airtable': [
        {
          type: 'navigate_or_switch_tab',
          instruction: 'Navigate to Airtable CRM or switch to existing Airtable tab',
          target: { url: 'https://airtable.com/appXXX/tblYYY/viwZZZ' }
        }
      ],
      'add_to_crm': [
        {
          type: 'click',
          instruction: 'Click the "Add Record" or "+" button to create a new investor entry',
          target: { selector: '[data-testid="add-record-button"]' }
        }
      ],
      'mark_processed': [
        {
          type: 'navigate_or_switch_tab',
          instruction: 'Switch back to Gmail tab',
          target: { url: 'https://mail.google.com/mail/u/0/#inbox' }
        }
      ]
    };
    
    return hardcodedActions[stepId] || [];
  };

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
      onStartMockExecution();
      return;
    }

    setIsRunning(true);
    setExecutionStatus(ExecutionStatus.RUNNING);
    
    try {
      console.log('Starting real workflow execution...');
      
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
      } else {
        console.log('Using existing execution:', executionId);
      }
      
    } catch (error) {
      console.error('Failed to start execution:', error);
      setIsRunning(false);
      setExecutionStatus(ExecutionStatus.IDLE);
    }
  };

  const handleStop = async () => {
    if (onStopMockExecution && !executionId) {
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
      
      alert(`❌ Failed to execute step "${stepName}": ${errorMsg}`);
    }
  };

  const getActionIcon = (actionType: string) => {
    switch (actionType) {
      case 'navigate_or_switch_tab': return <Globe className="w-4 h-4" />;
      case 'click': return <MousePointer className="w-4 h-4" />;
      case 'visual_scan': return <Eye className="w-4 h-4" />;
      default: return <Code className="w-4 h-4" />;
    }
  };

  const getActionColor = (actionType: string) => {
    switch (actionType) {
      case 'navigate_or_switch_tab': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'click': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'visual_scan': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="execution-panel h-full flex flex-col bg-gray-900 text-gray-100 font-mono">
      {/* Terminal-style Header */}
      <div className="p-4 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2 mb-3">
          <Terminal className="w-5 h-5 text-green-400" />
          <h2 className="text-lg font-bold text-green-400">
            AEF.EXECUTION_ENGINE
          </h2>
          <div className="flex gap-1 ml-auto">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
        </div>
        
        <div className="text-sm text-gray-400 mb-3">
          <span className="text-cyan-400">~/workflows/</span>
          {aefDocument.meta?.title?.toLowerCase().replace(/\s+/g, '-') || 'unnamed-workflow'}
          <span className="text-gray-500">.aef</span>
        </div>
        
        {/* Command Line Controls */}
        <div className="flex gap-2">
          {(executionStatus === ExecutionStatus.IDLE || executionStatus === ExecutionStatus.COMPLETED) ? (
            <Button 
              onClick={handleRunAll}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white border-0 font-mono"
              size="sm"
            >
              <Play className="w-4 h-4 mr-2" />
              $ ./run_all.sh
            </Button>
          ) : (
            <Button 
              onClick={handleStop}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white border-0 font-mono"
              size="sm"
            >
              <Square className="w-4 h-4 mr-2" />
              $ kill -9
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm"
            className="border-gray-600 text-gray-300 hover:bg-gray-700 font-mono"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {/* Terminal Status */}
        {executionStatus !== ExecutionStatus.IDLE && (
          <div className="mt-3 p-3 bg-gray-800 rounded border border-gray-600">
            <div className="flex items-center justify-between text-sm">
              <span className="text-cyan-400 font-medium">
                STATUS: <span className="text-yellow-400">{executionStatus.toUpperCase()}</span>
              </span>
              {currentStep && (
                <span className="text-green-400">
                  EXEC: <span className="text-white">{currentStep}</span>
                </span>
              )}
            </div>
            {mockExecutionState && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>PROGRESS: {mockExecutionState.currentStep}/{mockExecutionState.totalSteps}</span>
                  <span>{mockExecutionState.progress}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-cyan-500 transition-all duration-500"
                    style={{ width: `${mockExecutionState.progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Code-style Steps List */}
      <div className="flex-1 overflow-y-auto">
        {workflowSteps.length === 0 ? (
          <div className="p-4 text-center text-gray-500 font-mono">
            <Terminal className="w-8 h-8 mx-auto mb-2 text-gray-600" />
            <div>No workflow steps found</div>
            <div className="text-xs text-gray-600">workflow.aef is empty</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {workflowSteps.map((step, index) => {
              const isExpanded = expandedSteps.has(step.id);
              const isCurrentStep = currentStep === step.id;
              const actions = getStepActions(step.id);
              
              return (
                <div key={step.id} className={`p-4 ${isCurrentStep ? 'bg-gray-800 border-l-4 border-cyan-400' : ''}`}>
                  {/* Function Declaration Style Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1 min-w-0">
                      <button
                        onClick={() => toggleStepExpansion(step.id)}
                        className="mr-3 p-1 hover:bg-gray-700 rounded text-gray-400"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      
                      <div className="flex items-center mr-3">
                        <span className="w-8 h-8 bg-gray-700 border border-gray-600 rounded flex items-center justify-center text-xs font-bold text-cyan-400">
                          {(index + 1).toString().padStart(2, '0')}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400 font-bold">function</span>
                          <span className="text-yellow-400 font-bold">{step.id}</span>
                          <span className="text-gray-400">()</span>
                          <span className="text-gray-500">{"{}"}</span>
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          <span className="text-gray-500">//</span> {step.label}
                        </div>
                        {step.intent && (
                          <div className="text-xs text-gray-500 mt-1">
                            <span className="text-gray-600">/**</span> {step.intent} <span className="text-gray-600">*/</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleRunStep(step.id)}
                      variant="outline"
                      size="sm"
                      disabled={isRunning}
                      className="bg-green-600 hover:bg-green-700 border-green-500 text-white font-mono text-xs"
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      EXEC
                    </Button>
                  </div>

                  {/* Expanded Code Block */}
                  {isExpanded && (
                    <div className="mt-4 ml-12 space-y-4">
                      {/* Context as Comment Block */}
                      {step.context && (
                        <div className="p-3 bg-gray-800 rounded border border-gray-600">
                          <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                            <Bug className="w-3 h-3" />
                            CONTEXT
                          </div>
                          <div className="text-sm text-gray-300 leading-relaxed">
                            <span className="text-gray-600">/*</span>
                            <div className="ml-2 text-gray-400 italic">{step.context}</div>
                            <span className="text-gray-600">*/</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Stagehand Actions as Code */}
                      {actions.length > 0 && (
                        <div className="space-y-3">
                          <div className="text-xs text-cyan-400 font-bold flex items-center gap-2">
                            <Code className="w-3 h-3" />
                            STAGEHAND_COMMANDS
                          </div>
                          
                          {actions.map((action, actionIndex) => (
                            <div key={actionIndex} className="bg-gray-800 rounded border border-gray-600 overflow-hidden">
                              {/* Action Header */}
                              <div className={`px-3 py-2 border-b border-gray-600 flex items-center justify-between ${getActionColor(action.type)}`}>
                                <div className="flex items-center gap-2">
                                  {getActionIcon(action.type)}
                                  <span className="font-bold text-sm">{action.type.toUpperCase()}</span>
                                </div>
                                <Button
                                  onClick={() => copyToClipboard(JSON.stringify(action, null, 2))}
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 text-current hover:bg-black/10"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              
                              {/* Action Details */}
                              <div className="p-3 font-mono text-sm">
                                <div className="space-y-2">
                                  <div>
                                    <span className="text-gray-500">instruction:</span>
                                    <div className="ml-4 text-gray-300 italic break-words">
                                      "{action.instruction}"
                                    </div>
                                  </div>
                                  
                                  {action.target && (
                                    <div>
                                      <span className="text-gray-500">target:</span>
                                      <div className="ml-4 space-y-1">
                                        {action.target.url && (
                                          <div className="flex items-center gap-2">
                                            <Globe className="w-3 h-3 text-blue-400" />
                                            <span className="text-blue-400">url:</span>
                                            <span className="text-green-400 break-all">"{action.target.url}"</span>
                                          </div>
                                        )}
                                        {action.target.selector && (
                                          <div className="flex items-center gap-2">
                                            <Target className="w-3 h-3 text-purple-400" />
                                            <span className="text-purple-400">selector:</span>
                                            <span className="text-yellow-400 break-all">"{action.target.selector}"</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Checkpoint Configuration */}
                      <div className="p-3 bg-yellow-900/20 rounded border border-yellow-600/50">
                        <div className="text-xs text-yellow-400 font-bold mb-2 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          CHECKPOINT_CONFIG
                        </div>
                        <div className="font-mono text-xs space-y-1">
                          <div><span className="text-gray-500">type:</span> <span className="text-cyan-400">BEFORE_EXECUTION</span></div>
                          <div><span className="text-gray-500">required:</span> <span className="text-green-400">true</span></div>
                          <div><span className="text-gray-500">timeout:</span> <span className="text-yellow-400">300s</span></div>
                          <div><span className="text-gray-500">method:</span> <span className="text-purple-400">BROWSER_AUTOMATION</span></div>
                        </div>
                      </div>

                      {/* Sub-steps as Nested Functions */}
                      {step.childNodes && step.childNodes.length > 0 && (
                        <div className="border border-gray-600 rounded bg-gray-800">
                          <div className="px-3 py-2 bg-gray-700 border-b border-gray-600 flex items-center gap-2">
                            <Code className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm font-bold text-cyan-400">
                              NESTED_FUNCTIONS ({step.childNodes.length})
                            </span>
                          </div>
                          <div className="divide-y divide-gray-600">
                            {step.childNodes.map((subStep, subIndex) => (
                              <div key={subStep.id} className="p-3 flex items-center justify-between">
                                <div className="flex items-center space-x-3 font-mono">
                                  <span className="w-6 h-6 bg-gray-600 rounded text-xs flex items-center justify-center text-cyan-400">
                                    {subIndex + 1}
                                  </span>
                                  <span className="text-yellow-400">{subStep.id}</span>
                                  <span className="text-gray-400">()</span>
                                  <ArrowRight className="w-3 h-3 text-gray-500" />
                                  <span className="text-gray-300 text-sm">{subStep.label}</span>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-green-400 hover:bg-gray-700"
                                >
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