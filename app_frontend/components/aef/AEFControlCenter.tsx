'use client';

import React, { useState, useEffect } from 'react';
import { SOPDocument } from '@/lib/types/sop';
import { AEFDocument, isAEFDocument, ExecutionMethod } from '@/lib/types/aef';
import { CheckpointType, CheckpointCondition } from '@/lib/types/checkpoint';
import { createMockAEFTransformation, createMockExecutionState, shouldShowMockAEF, MockExecutionState, MockLogEntry } from '@/lib/mock-aef-data';
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

// Hardcoded test workflow data - this will always be displayed for testing
const HARDCODED_TEST_WORKFLOW = {
  "meta": {
    "id": "test-investor-email-workflow",
    "title": "Investor Email CRM Workflow (TEST)",
    "version": "1.0",
    "goal": "Extract investor information from an email and add it to a CRM.",
    "purpose": "A test SOP for developing the execution engine.",
    "owner": ["aef-dev-team"]
  },
  "execution": {
    "environment": {
      "required_tabs": [
        { "name": "Gmail", "url": "https://mail.google.com/mail/u/0/#inbox" },
        { "name": "Airtable CRM", "url": "https://airtable.com/appXXX/tblYYY/viwZZZ" }
      ]
    },
    "workflow": {
      "nodes": [
        {
          "id": "start_workflow",
          "type": "task",
          "label": "Open Gmail",
          "intent": "Navigate to the Gmail inbox to begin email processing.",
          "context": "The first step is to open the Gmail interface. This provides access to the email list where we'll identify investor-related emails for processing.",
          "actions": [
            {
              "type": "navigate_or_switch_tab",
              "instruction": "Navigate to https://mail.google.com/mail/u/0/#inbox or switch to Gmail tab if already open",
              "target": { "url": "https://mail.google.com/mail/u/0/#inbox" }
            }
          ]
        },
        {
          "id": "scan_email_list",
          "type": "task", 
          "label": "Scan Email List",
          "intent": "Visually scan the email list to identify potential investor-related emails.",
          "context": "Look through the email list in the inbox to find emails that might contain investor information, inquiries, or business opportunities.",
          "actions": [
            {
              "type": "visual_scan",
              "instruction": "Scan the email list for subject lines and senders that might indicate investor-related content"
            }
          ]
        },
        {
          "id": "email_processing_loop",
          "type": "iterative_loop",
          "label": "Process Each Investor Email",
          "intent": "For each identified investor email, extract information and add to CRM.",
          "context": "This loop processes each investor-related email found in the inbox.",
          "children": [
            "select_email",
            "extract_investor_info", 
            "open_airtable",
            "add_to_crm",
            "mark_processed"
          ]
        },
        {
          "id": "select_email",
          "type": "task",
          "label": "Select Investor Email",
          "intent": "Click on an unprocessed investor email to open it.",
          "context": "Select and open the next investor email that needs to be processed.",
          "actions": [
            {
              "type": "click",
              "instruction": "Click on the first unprocessed investor email in the list",
              "target": { "selector": "[data-thread-id]:not([data-processed='true'])" }
            }
          ]
        },
        {
          "id": "extract_investor_info",
          "type": "task",
          "label": "Extract Investor Information", 
          "intent": "Read and extract key investor details from the email content.",
          "context": "Parse the email content to identify investor name, company, contact information, investment interests, and other relevant details.",
          "actions": [
            {
              "type": "visual_scan",
              "instruction": "Read email content and identify investor information including name, company, email, phone, investment focus"
            }
          ]
        },
        {
          "id": "open_airtable",
          "type": "task",
          "label": "Open Airtable CRM",
          "intent": "Navigate to or switch to the Airtable CRM tab.",
          "context": "Access the Airtable database where investor information is stored and managed.",
          "actions": [
            {
              "type": "navigate_or_switch_tab",
              "instruction": "Navigate to Airtable CRM or switch to existing Airtable tab",
              "target": { "url": "https://airtable.com/appXXX/tblYYY/viwZZZ" }
            }
          ]
        },
        {
          "id": "add_to_crm",
          "type": "task",
          "label": "Add Investor to CRM",
          "intent": "Create a new record in Airtable with the extracted investor information.",
          "context": "Fill out the investor information form in Airtable with the details extracted from the email.",
          "actions": [
            {
              "type": "click", 
              "instruction": "Click the 'Add Record' or '+' button to create a new investor entry",
              "target": { "selector": "[data-testid='add-record-button']" }
            }
          ]
        },
        {
          "id": "mark_processed",
          "type": "task",
          "label": "Mark Email as Processed",
          "intent": "Return to Gmail and mark the email as processed to avoid reprocessing.",
          "context": "Go back to Gmail and add a label or flag to indicate this email has been processed.",
          "actions": [
            {
              "type": "navigate_or_switch_tab",
              "instruction": "Switch back to Gmail tab",
              "target": { "url": "https://mail.google.com/mail/u/0/#inbox" }
            }
          ]
        }
      ],
      "flow": [
        { "from": "start_workflow", "to": "scan_email_list" },
        { "from": "scan_email_list", "to": "email_processing_loop" },
        { "from": "email_processing_loop", "to": "select_email" },
        { "from": "select_email", "to": "extract_investor_info" },
        { "from": "extract_investor_info", "to": "open_airtable" },
        { "from": "open_airtable", "to": "add_to_crm" },
        { "from": "add_to_crm", "to": "mark_processed" },
        { "from": "mark_processed", "to": "email_processing_loop", "condition": "more_emails_to_process" }
      ]
    }
  }
};

// Convert the hardcoded workflow to AEF format
function createHardcodedAEFDocument(): AEFDocument {
  // Convert the hardcoded workflow nodes to SOPDocument format first
  const sopNodes = HARDCODED_TEST_WORKFLOW.execution.workflow.nodes.map(node => ({
    id: node.id,
    type: node.type,
    label: node.label,
    intent: node.intent,
    context: node.context,
    position: { x: 0, y: 0 }, // Default positions
    // Fix: Only include childNodes if children exist, and create proper SOPNode structure
    ...(node.children ? {
      children: node.children,
      childNodes: node.children.map(childId => {
        // Find the actual child node from the workflow
        const childNode = HARDCODED_TEST_WORKFLOW.execution.workflow.nodes.find(n => n.id === childId);
        return {
          id: childId,
          type: childNode?.type || 'task',
          label: childNode?.label || childId,
          intent: childNode?.intent || '',
          context: childNode?.context || '',
          position: { x: 0, y: 0 }
        };
      })
    } : {})
  }));

  const mockSOP: SOPDocument = {
    meta: HARDCODED_TEST_WORKFLOW.meta,
    public: {
      nodes: sopNodes,
      edges: HARDCODED_TEST_WORKFLOW.execution.workflow.flow.map(flow => ({
        id: `${flow.from}-${flow.to}`,
        source: flow.from,
        target: flow.to,
        type: 'default'
      })),
      variables: {},
      triggers: [],
      clarification_requests: []
    },
    private: {
      skills: [],
      steps: [],
      artifacts: []
    }
  };

  // Create AEF document with the specific workflow data
  const aefDocument: AEFDocument = {
    ...mockSOP,
    aef: {
      config: {
        checkpoints: sopNodes.map(node => ({
          id: `checkpoint-${node.id}`,
          stepId: node.id,
          type: CheckpointType.BEFORE_EXECUTION,
          condition: CheckpointCondition.ALWAYS,
          required: true,
          title: `Approve: ${node.label}`,
          description: `About to execute: ${node.intent || node.label}`,
          timeout: 300,
          showContext: true,
          showPreview: true
        })),
        executionMethod: ExecutionMethod.BROWSER_AUTOMATION,
        secrets: [
          {
            id: 'gmail_credentials',
            name: 'Gmail Access',
            description: 'Gmail account credentials for email automation',
            type: 'oauth_token' as const,
            required: true,
            stepIds: ['start_workflow', 'scan_email_list', 'select_email', 'mark_processed']
          },
          {
            id: 'airtable_api',
            name: 'Airtable API Key', 
            description: 'Airtable API access for CRM operations',
            type: 'api_key' as const,
            required: true,
            stepIds: ['open_airtable', 'add_to_crm']
          }
        ],
        estimatedDuration: 30,
        stepTimeout: 60,
        checkpointTimeout: 300,
        enableDetailedLogging: true,
        pauseOnErrors: true
      },
      transformedAt: new Date(),
      transformedBy: 'hardcoded-test',
      version: '1.0.0',
      automationEnhanced: true
    }
  };

  // Store the original workflow structure as a property for the execution engine to access
  (aefDocument as any).execution = HARDCODED_TEST_WORKFLOW.execution;

  return aefDocument;
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
  
  // Real-time execution logs for debugging
  const [executionLogs, setExecutionLogs] = useState<MockLogEntry[]>([]);
  
  // Helper function to add logs
  const addLog = (level: 'info' | 'warning' | 'error' | 'success', category: 'system' | 'step' | 'browser' | 'checkpoint', message: string, details?: string, stepName?: string) => {
    const newLog: MockLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      category,
      message,
      details,
      stepName
    };
    
    console.log(`📝 [AEFControlCenter] Adding log:`, newLog);
    setExecutionLogs(prev => [...prev, newLog]);
  };
  
  // ALWAYS use the hardcoded test workflow for testing purposes
  const aefDocument = createHardcodedAEFDocument();
  const isAEF = true; // Always true since we're using hardcoded AEF data
  
  // Check if this SOP has been transformed to AEF (using mock for demo)
  const shouldShowMock = shouldShowMockAEF(sopId || '');

  // Real execution handler
  const handleStartRealExecution = async () => {
    // Always use the hardcoded test workflow for execution
    const documentId = 'test-investor-email-workflow';
    
    addLog('info', 'system', 'Starting real execution session...', `Document ID: ${documentId}`);
    
    setRealExecutionStatus('creating');
    
    try {
      console.log('Creating real AEF execution for hardcoded test workflow:', documentId);
      
      const response = await fetch('/api/aef/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          aefDocumentId: documentId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.error || 'Failed to create execution';
        addLog('error', 'system', 'Failed to create execution session', errorMsg);
        throw new Error(errorMsg);
      }
      
      const execution = await response.json();
      console.log('Real execution created:', execution.executionId);
      
      setRealExecutionId(execution.executionId);
      setRealExecutionStatus('running');
      
      addLog('success', 'system', 'Execution session created successfully', `Execution ID: ${execution.executionId}`);
      addLog('info', 'system', 'Ready for step execution', 'You can now click "Run" on individual workflow steps');
      
    } catch (error) {
      console.error('Failed to create real execution:', error);
      setRealExecutionStatus('error');
      addLog('error', 'system', 'Failed to create execution session', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleStopRealExecution = async () => {
    if (!realExecutionId) return;
    
    addLog('info', 'system', 'Stopping execution session...', `Execution ID: ${realExecutionId}`);
    
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
      addLog('success', 'system', 'Execution session stopped successfully');
      console.log('Real execution stopped');
      
    } catch (error) {
      console.error('Failed to stop real execution:', error);
      addLog('error', 'system', 'Failed to stop execution session cleanly', error instanceof Error ? error.message : 'Unknown error');
      // Still reset state
      setRealExecutionId(null);
      setRealExecutionStatus('idle');
    }
  };

  // Demo execution handler (mock)
  const handleStartMockExecution = () => {
    addLog('info', 'system', 'Starting mock execution demo...');
    
    if (aefDocument) {
      const mockState = createMockExecutionState(aefDocument);
      setMockExecutionState(mockState);
      setShowMockExecution(true);
      addLog('success', 'system', 'Mock execution demo started', 'This is a simulated execution for demonstration purposes');
    }
  };

  const handleStopMockExecution = () => {
    addLog('info', 'system', 'Stopping mock execution demo...');
    setMockExecutionState(null);
    setShowMockExecution(false);
    addLog('success', 'system', 'Mock execution demo stopped');
  };

  // VNC Environment handlers
  const handleStartVncEnvironment = async () => {
    addLog('info', 'system', 'Starting VNC remote desktop environment...');
    setVncEnvironmentStatus('creating');
    
    try {
      console.log('🖥️ Starting VNC execution environment...');
      
      // Generate a proper UUID with VNC prefix for frontend detection
      const vncExecutionId = `vnc-env-${crypto.randomUUID()}`;
      addLog('info', 'system', 'Generated VNC execution ID', `ID: ${vncExecutionId}`);
      
      // Call our Docker container creation directly
      const response = await fetch('/api/aef/start-vnc-environment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          executionId: vncExecutionId,
          userId: 'demo-user'
        })
      });
      
      addLog('info', 'system', 'VNC API call completed', `Status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        addLog('error', 'system', 'VNC API call failed', errorText);
        throw new Error('Failed to start VNC environment');
      }
      
      const responseData = await response.json();
      console.log('✅ VNC environment creation response:', responseData);
      
      if (responseData.success) {
        setVncEnvironmentId(vncExecutionId);
        setVncEnvironmentStatus('running');
        addLog('success', 'system', 'VNC environment ready!', 
          `🖥️ VNC Desktop: http://localhost:16080\n` +
          `🔧 Action API: http://localhost:13000\n` +
          `📝 Execution ID: ${vncExecutionId}`
        );
        
        // Show user exactly how to access VNC
        alert(`✅ VNC Environment Ready!\n\n` +
          `🖥️ Open VNC Desktop: http://localhost:16080\n` +
          `📝 Execution ID: ${vncExecutionId}\n\n` +
          `The browser automation will appear in the VNC viewer.`);
      } else {
        throw new Error(responseData.error || 'Unknown error');
      }
      
    } catch (error) {
      console.error('❌ Failed to start VNC environment:', error);
      setVncEnvironmentStatus('error');
      addLog('error', 'system', 'Failed to start VNC environment', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleStopVncEnvironment = async () => {
    if (!vncEnvironmentId) return;
    
    addLog('info', 'system', 'Stopping VNC remote desktop...', `Environment ID: ${vncEnvironmentId}`);
    
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
        addLog('warning', 'system', 'VNC environment may not have stopped cleanly');
      }
      
      setVncEnvironmentId(null);
      setVncEnvironmentStatus('idle');
      addLog('success', 'system', 'VNC remote desktop stopped');
      console.log('✅ VNC environment stopped');
      
    } catch (error) {
      console.error('❌ Failed to stop VNC environment:', error);
      addLog('error', 'system', 'Failed to stop VNC environment', error instanceof Error ? error.message : 'Unknown error');
      // Still reset state
      setVncEnvironmentId(null);
      setVncEnvironmentStatus('idle');
    }
  };

  // Initialize logs on component mount
  useEffect(() => {
    addLog('info', 'system', 'AEF Control Center initialized', 'Hardcoded test workflow loaded and ready for execution');
  }, []);

  // Determine which execution to use (prioritize VNC environment)
  const activeExecutionId = vncEnvironmentId || realExecutionId || mockExecutionState?.executionId || executionId;
  const isExecutionActive = !!vncEnvironmentId || !!realExecutionId || showMockExecution || !!executionId;
  const currentMockState = (vncEnvironmentId || realExecutionId) ? null : mockExecutionState; // Don't use mock if real execution or VNC is active

  // Combine mock logs with real execution logs
  const combinedLogs = currentMockState?.logs ? [...executionLogs, ...currentMockState.logs] : executionLogs;

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
            mockLogs={combinedLogs}
          />
        </div>
      </div>
    </div>
  );
};

export default AEFControlCenter; 