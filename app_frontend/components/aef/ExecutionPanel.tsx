'use client';

import React, { useState, useEffect } from 'react';
import { AEFDocument } from '@/lib/types/aef';
import { ExecutionStatus } from '@/lib/types/execution';
import { MockExecutionState } from '@/lib/mock-aef-data';
import { Button } from '@/components/ui/button';
import { CredentialIndicator } from '@/components/sop/CredentialIndicator';
import { OverallCredentialStatus } from '@/components/sop/OverallCredentialStatus';
import { useCredentialStatus } from '@/lib/hooks/useCredentialStatus';
import { extractNodeCredentialRequirements, extractWorkflowCredentialRequirements } from '@/lib/utils/credentialExtractor';
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
import NodeSelector from './NodeSelector';
import NodeLogViewer from './NodeLogViewer';

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
  const [showNodeSelector, setShowNodeSelector] = useState(false);
  const [nodeExecutionResults, setNodeExecutionResults] = useState<Map<string, { success: boolean; message: string; nextNodeId?: string }>>(new Map());
  const [isExecutingNodes, setIsExecutingNodes] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Use mock execution state when available
  const [executionStatus, setExecutionStatus] = useState<ExecutionStatus>(ExecutionStatus.IDLE);
  
  // Credential status tracking
  const workflowSteps = aefDocument?.public?.nodes || [];
  const credentialRequirements = extractWorkflowCredentialRequirements(workflowSteps);
  const { nodeStatuses, overallStatus, isLoading: credentialLoading, totalRequired, totalConfigured } = useCredentialStatus(
    aefDocument?.meta?.id || 'unknown',
    credentialRequirements
  );
  
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
  
  // Get step actions directly from the node data (loaded from JSON)
  const getStepActions = (stepId: string) => {
    const stepNode = workflowSteps.find(step => step.id === stepId);
    return stepNode?.actions || [];
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

  const toggleLogExpansion = (stepId: string) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(stepId)) {
      newExpanded.delete(stepId);
    } else {
      newExpanded.add(stepId);
    }
    setExpandedLogs(newExpanded);
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
      
    } catch (error) {
      console.error(`❌ [ExecutionPanel] Step execution failed:`, error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`❌ Failed to execute step: ${errorMessage}`);
    }
  };

  const handleRunCompoundTask = async (compoundTaskId: string) => {
    const compoundTask = workflowSteps.find(step => step.id === compoundTaskId);
    
    if (!compoundTask || compoundTask.type !== 'compound_task') {
      console.error(`❌ [ExecutionPanel] Compound task ${compoundTaskId} not found or not a compound task`);
      return;
    }

    console.log(`🎯 [ExecutionPanel] Starting compound task execution: ${compoundTaskId} (${compoundTask.label})`);
    console.log(`🔍 [ExecutionPanel] All workflow steps:`, workflowSteps.map(s => ({ id: s.id, type: s.type, parentId: s.parentId })));
    
    // Find all child steps
    const childSteps = workflowSteps.filter(step => step.parentId === compoundTaskId);
    console.log(`🔍 [ExecutionPanel] Child steps found for ${compoundTaskId}:`, childSteps.map(s => ({ id: s.id, label: s.label })));
    
    if (childSteps.length === 0) {
      console.warn(`⚠️ [ExecutionPanel] No child steps found for compound task ${compoundTaskId}`);
      console.warn(`⚠️ [ExecutionPanel] Expected children based on compound task definition:`, compoundTask.children);
      return;
    }

    console.log(`📋 [ExecutionPanel] Found ${childSteps.length} child steps to execute`);

    // Execute each child step sequentially
    for (let i = 0; i < childSteps.length; i++) {
      const childStep = childSteps[i];
      console.log(`▶️ [ExecutionPanel] Executing child step ${i + 1}/${childSteps.length}: ${childStep.id}`);
      
      try {
        await handleRunStep(childStep.id);
        console.log(`✅ [ExecutionPanel] Child step ${childStep.id} completed`);
        
        // Add delay between steps
        if (i < childSteps.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ [ExecutionPanel] Child step ${childStep.id} failed:`, error);
        const shouldContinue = confirm(`Step "${childStep.label}" failed. Continue with remaining steps?`);
        if (!shouldContinue) {
          break;
        }
      }
    }

    console.log(`🎉 [ExecutionPanel] Compound task ${compoundTaskId} execution completed`);
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

  const handleExecuteSelectedNodes = async (nodeIds: string[]): Promise<void> => {
    if (!executionId) {
      alert('❌ Error: Cannot execute nodes without an active execution session. Please start an execution first.');
      return;
    }

    setIsExecutingNodes(true);
    setNodeExecutionResults(new Map());

    try {
      console.log(`🎯 [ExecutionPanel] Executing ${nodeIds.length} selected nodes:`, nodeIds);

      const response = await fetch('/api/aef/execute-nodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeIds,
          executionId,
          workflowId: aefDocument.meta?.id
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to execute nodes: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ [ExecutionPanel] Node execution completed:`, result);

      // Convert results object back to Map
      const resultsMap = new Map();
      Object.entries(result.results).forEach(([nodeId, nodeResult]) => {
        resultsMap.set(nodeId, nodeResult);
      });
      
      setNodeExecutionResults(resultsMap);

    } catch (error) {
      console.error('❌ [ExecutionPanel] Failed to execute selected nodes:', error);
      alert(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExecutingNodes(false);
    }
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
        
        {/* Overall Credential Status - REMOVED per user request */}
        {/* {totalRequired > 0 && (
          <div className="mb-3">
            <OverallCredentialStatus
              status={overallStatus}
              totalRequired={totalRequired}
              totalConfigured={totalConfigured}
              isLoading={credentialLoading}
            />
          </div>
        )} */}
        
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
            onClick={() => setShowNodeSelector(!showNodeSelector)}
            variant="outline" 
            size="sm"
            className={`border-gray-600 text-gray-300 hover:bg-gray-700 font-mono ${showNodeSelector ? 'bg-gray-700' : ''}`}
          >
            <Target className="w-4 h-4 mr-1" />
            Select
          </Button>
          
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

      {/* Node Selector or Code-style Steps List */}
      <div className="flex-1 overflow-y-auto">
        {showNodeSelector ? (
          <div className="h-full bg-white">
            <NodeSelector
              aefDocument={aefDocument}
              onExecuteSelectedNodes={handleExecuteSelectedNodes}
              isExecuting={isExecutingNodes}
              executionResults={nodeExecutionResults}
            />
          </div>
        ) : workflowSteps.length === 0 ? (
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
              const isCompoundTask = step.type === 'compound_task';
              const childSteps = isCompoundTask ? workflowSteps.filter(s => s.parentId === step.id) : [];
              
              // Get credential status for this step
              const stepCredentialStatus = nodeStatuses.get(step.id);
              const stepRequiredCredentials = extractNodeCredentialRequirements(step);
              
              // Debug logging
              if (step.id === 'gmail_login_flow' || step.id === 'enter_email' || step.id === 'open_airtable') {
                console.log(`[DEBUG] Step ${step.id}:`, {
                  step,
                  stepRequiredCredentials,
                  stepCredentialStatus,
                  credentialsRequired: step.credentialsRequired,
                  actions: step.actions
                });
              }

              return (
                <div key={step.id} className={`p-2 ${isCurrentStep ? 'bg-gray-800 border-l-2 border-cyan-400' : ''}`}>
                  {/* Function Declaration Style Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center flex-1 min-w-0">
                      <button
                        onClick={() => toggleStepExpansion(step.id)}
                        className="mr-2 p-0.5 hover:bg-gray-700 rounded text-gray-400"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                      
                      <div className="flex items-center mr-2">
                        <span className={`w-6 h-6 border rounded flex items-center justify-center text-xs font-bold ${
                          isCompoundTask 
                            ? 'bg-purple-800 border-purple-600 text-purple-200' 
                            : 'bg-gray-700 border-gray-600 text-cyan-400'
                        }`}>
                          {isCompoundTask ? '📦' : (index + 1).toString()}
                        </span>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-purple-400 font-bold text-xs">
                            {isCompoundTask ? 'compound' : 'function'}
                          </span>
                          <span className="text-yellow-400 font-bold text-sm">{step.id}</span>
                          <span className="text-gray-400 text-xs">()</span>
                          {isCompoundTask && (
                            <span className="text-purple-300 text-xs">
                              [{childSteps.length}]
                            </span>
                          )}
                          <span className="text-gray-500 text-xs">{"{}"}</span>
                          
                          {/* Credential Indicator */}
                          {stepRequiredCredentials.length > 0 && (
                            <div className="ml-2">
                              <CredentialIndicator
                                status={stepCredentialStatus?.status || 'missing'}
                                requiredCount={stepRequiredCredentials.length}
                                configuredCount={stepCredentialStatus?.configuredCredentials.length || 0}
                              />
                            </div>
                          )}
                          
                          {/* Temporary Test Indicator - Show for specific steps */}
                          {(step.id === 'gmail_login_flow' || step.id === 'enter_email' || step.id === 'open_airtable') && (
                            <div className="ml-2">
                              <span className="px-2 py-1 bg-red-500 text-white text-xs rounded">🔒 TEST</span>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          <span className="text-gray-500">//</span> {step.label}
                        </div>
                        {step.intent && (
                          <div className="text-xs text-gray-500 mt-0.5 truncate">
                            <span className="text-gray-600">/**</span> {step.intent} <span className="text-gray-600">*/</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {isCompoundTask && (
                        <Button
                          onClick={() => handleRunCompoundTask(step.id)}
                          variant="outline"
                          size="sm"
                          disabled={isRunning}
                          className="bg-purple-600 hover:bg-purple-700 border-purple-500 text-white font-mono text-xs h-6 px-2"
                        >
                          <Zap className="w-3 h-3 mr-1" />
                          ALL
                        </Button>
                      )}
                      <Button
                        onClick={() => handleRunStep(step.id)}
                        variant="outline"
                        size="sm"
                        disabled={isRunning}
                        className={`font-mono text-xs h-6 px-2 ${
                          isCompoundTask 
                            ? 'bg-gray-600 hover:bg-gray-700 border-gray-500 text-gray-300' 
                            : 'bg-green-600 hover:bg-green-700 border-green-500 text-white'
                        }`}
                      >
                        <Zap className="w-3 h-3 mr-1" />
                        {isCompoundTask ? 'STEP' : 'RUN'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Code Block */}
                  {isExpanded && (
                    <div className="mt-2 ml-8 space-y-2">
                      {/* Context as Comment Block */}
                      {step.context && (
                        <div className="p-2 bg-gray-800 rounded border border-gray-600">
                          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                            <Bug className="w-3 h-3" />
                            CONTEXT
                          </div>
                          <div className="text-xs text-gray-300 leading-relaxed">
                            <span className="text-gray-600">/*</span>
                            <div className="ml-2 text-gray-400 italic">{step.context}</div>
                            <span className="text-gray-600">*/</span>
                          </div>
                        </div>
                      )}

                      {/* Compound Task Children */}
                      {isCompoundTask && childSteps.length > 0 && (
                        <div className="border border-purple-600/50 rounded bg-purple-900/10">
                          <div className="px-2 py-1 bg-purple-800/20 border-b border-purple-600/50 flex items-center gap-1">
                            <Code className="w-3 h-3 text-purple-400" />
                            <span className="text-xs font-bold text-purple-400">
                              CHILD_STEPS ({childSteps.length})
                            </span>
                          </div>
                          <div className="divide-y divide-purple-600/30">
                            {childSteps.map((childStep, childIndex) => (
                              <div key={childStep.id} className="p-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2 font-mono">
                                    <span className="w-4 h-4 bg-purple-700 rounded text-xs flex items-center justify-center text-purple-200">
                                      {childIndex + 1}
                                    </span>
                                    <span className="text-yellow-400 text-xs">{childStep.id}</span>
                                    <span className="text-gray-400 text-xs">()</span>
                                    <ArrowRight className="w-3 h-3 text-gray-500" />
                                    <span className="text-gray-300 text-xs">{childStep.label}</span>
                                  </div>
                                  <Button 
                                    onClick={() => handleRunStep(childStep.id)}
                                    variant="ghost" 
                                    size="sm"
                                    className="text-green-400 hover:bg-gray-700 text-xs h-5 px-1"
                                    disabled={isRunning}
                                  >
                                    <Play className="w-3 h-3 mr-0.5" />
                                    RUN
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Stagehand Actions as Code (for atomic tasks) */}
                      {!isCompoundTask && actions.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs text-cyan-400 font-bold flex items-center gap-1">
                            <Code className="w-3 h-3" />
                            STAGEHAND_COMMANDS
                          </div>
                          
                          {actions.map((action, actionIndex) => (
                            <div key={actionIndex} className="bg-gray-800 rounded border border-gray-600 overflow-hidden">
                              {/* Action Header */}
                              <div className={`px-2 py-1 border-b border-gray-600 flex items-center justify-between ${getActionColor(action.type)}`}>
                                <div className="flex items-center gap-1">
                                  {getActionIcon(action.type)}
                                  <span className="font-bold text-xs">{action.type.toUpperCase()}</span>
                                </div>
                                <Button
                                  onClick={() => copyToClipboard(JSON.stringify(action, null, 2))}
                                  variant="ghost"
                                  size="sm"
                                  className="h-4 w-4 p-0 text-current hover:bg-black/10"
                                >
                                  <Copy className="w-3 h-3" />
                                </Button>
                              </div>
                              
                              {/* Action Details */}
                              <div className="p-2 font-mono text-xs">
                                <div className="space-y-1">
                                  <div>
                                    <span className="text-gray-500">instruction:</span>
                                    <div className="ml-2 text-gray-300 italic break-words">
                                      "{action.instruction}"
                                    </div>
                                  </div>
                                  
                                  {action.target && (
                                    <div>
                                      <span className="text-gray-500">target:</span>
                                      <div className="ml-2 space-y-1">
                                        {action.target.url && (
                                          <div className="flex items-center gap-1">
                                            <Globe className="w-3 h-3 text-blue-400" />
                                            <span className="text-blue-400">url:</span>
                                            <span className="text-green-400 break-all">"{action.target.url}"</span>
                                          </div>
                                        )}
                                        {action.target.selector && (
                                          <div className="flex items-center gap-1">
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
                      <div className="p-2 bg-yellow-900/20 rounded border border-yellow-600/50">
                        <div className="text-xs text-yellow-400 font-bold mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          CHECKPOINT_CONFIG
                        </div>
                        <div className="font-mono text-xs space-y-0.5">
                          <div><span className="text-gray-500">type:</span> <span className="text-cyan-400">BEFORE_EXECUTION</span></div>
                          <div><span className="text-gray-500">required:</span> <span className="text-green-400">true</span></div>
                          <div><span className="text-gray-500">timeout:</span> <span className="text-yellow-400">300s</span></div>
                          <div><span className="text-gray-500">method:</span> <span className="text-purple-400">BROWSER_AUTOMATION</span></div>
                        </div>
                      </div>

                      {/* Sub-steps as Nested Functions (legacy support) */}
                      {step.childNodes && step.childNodes.length > 0 && (
                        <div className="border border-gray-600 rounded bg-gray-800">
                          <div className="px-2 py-1 bg-gray-700 border-b border-gray-600 flex items-center gap-1">
                            <Code className="w-3 h-3 text-cyan-400" />
                            <span className="text-xs font-bold text-cyan-400">
                              NESTED_FUNCTIONS ({step.childNodes.length})
                            </span>
                          </div>
                          <div className="divide-y divide-gray-600">
                            {step.childNodes.map((subStep, subIndex) => (
                              <div key={subStep.id} className="p-2 flex items-center justify-between">
                                <div className="flex items-center space-x-2 font-mono">
                                  <span className="w-4 h-4 bg-gray-600 rounded text-xs flex items-center justify-center text-cyan-400">
                                    {subIndex + 1}
                                  </span>
                                  <span className="text-yellow-400 text-xs">{subStep.id}</span>
                                  <span className="text-gray-400 text-xs">()</span>
                                  <ArrowRight className="w-3 h-3 text-gray-500" />
                                  <span className="text-gray-300 text-xs">{subStep.label}</span>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-green-400 hover:bg-gray-700 text-xs h-4 px-1"
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

                  {/* Node Debug Logs */}
                  <NodeLogViewer
                    nodeId={step.id}
                    nodeName={step.label}
                    executionId={executionId}
                    isExpanded={expandedLogs.has(step.id)}
                    onToggleExpanded={() => toggleLogExpansion(step.id)}
                  />
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