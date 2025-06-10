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
          "id": "gmail_login_flow",
          "type": "compound_task",
          "label": "Navigate and Log in to Gmail",
          "intent": "Complete Gmail authentication process including navigation, email entry, password entry, and login confirmation.",
          "context": "This compound task handles the complete Gmail login workflow. It can be executed as a single unit or broken down into individual steps for granular control.",
          "children": ["navigate_to_gmail", "enter_email", "enter_password", "complete_login"],
          "canExecuteAsGroup": true,
          "actions": [] // Parent nodes don't have direct actions
        },
        {
          "id": "navigate_to_gmail",
          "type": "atomic_task",
          "label": "Navigate to Gmail",
          "intent": "Navigate to the Gmail login page to begin authentication.",
          "context": "Open Gmail in the browser. If user is already logged in, this will go to inbox. If not, it will show the login page.",
          "parentId": "gmail_login_flow",
          "actions": [
            {
              "type": "navigate",
              "instruction": "Navigate to Gmail login page",
              "target": { "url": "https://accounts.google.com/signin/v2/identifier?service=mail&continue=https://mail.google.com" }
            }
          ]
        },
        {
          "id": "enter_email",
          "type": "atomic_task", 
          "label": "Enter Email Address",
          "intent": "Input the Gmail email address in the login form.",
          "context": "Locate the email input field and enter the Gmail address. This step assumes we're on the Gmail login page.",
          "parentId": "gmail_login_flow",
          "actions": [
            {
              "type": "type",
              "instruction": "Enter email address in the email field",
              "target": { "selector": "input[type='email']" },
              "data": { "text": "your.email@gmail.com" } // This would be dynamic in real implementation
            },
            {
              "type": "click",
              "instruction": "Click Next button after entering email",
              "target": { "selector": "#identifierNext" }
            }
          ]
        },
        {
          "id": "enter_password",
          "type": "atomic_task",
          "label": "Enter Password", 
          "intent": "Input the Gmail password in the password field.",
          "context": "After email verification, enter the password. Wait for password field to appear after email step.",
          "parentId": "gmail_login_flow",
          "actions": [
            {
              "type": "wait",
              "instruction": "Wait for password field to appear",
              "target": { "selector": "input[type='password']" },
              "timeout": 5000
            },
            {
              "type": "type",
              "instruction": "Enter password in the password field", 
              "target": { "selector": "input[type='password']" },
              "data": { "text": "your_password_here" } // This would be secure/dynamic in real implementation
            }
          ]
        },
        {
          "id": "complete_login",
          "type": "atomic_task",
          "label": "Complete Login",
          "intent": "Click the sign in button and wait for login completion.",
          "context": "Final step of login process - submit the login form and wait for redirect to Gmail inbox.",
          "parentId": "gmail_login_flow", 
          "actions": [
            {
              "type": "click",
              "instruction": "Click the password Next/Sign in button",
              "target": { "selector": "#passwordNext" }
            },
            {
              "type": "wait_for_navigation",
              "instruction": "Wait for successful login and redirect to Gmail inbox",
              "target": { "url_contains": "mail.google.com/mail" },
              "timeout": 10000
            }
          ]
        },
        {
          "id": "scan_email_list",
          "type": "atomic_task", 
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
          "type": "atomic_task",
          "label": "Select Investor Email",
          "intent": "Click on an unprocessed investor email to open it.",
          "context": "Select and open the next investor email that needs to be processed.",
          "parentId": "email_processing_loop",
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
          "type": "atomic_task",
          "label": "Extract Investor Information", 
          "intent": "Read and extract key investor details from the email content.",
          "context": "Parse the email content to identify investor name, company, contact information, investment interests, and other relevant details.",
          "parentId": "email_processing_loop",
          "actions": [
            {
              "type": "extract",
              "instruction": "Extract investor information from email content",
              "schema": {
                "name": "string",
                "company": "string", 
                "email": "string",
                "phone": "string",
                "investment_focus": "string",
                "message_summary": "string"
              }
            }
          ]
        },
        {
          "id": "open_airtable",
          "type": "atomic_task",
          "label": "Open Airtable CRM",
          "intent": "Navigate to or switch to the Airtable CRM tab.",
          "context": "Access the Airtable database where investor information is stored and managed.",
          "parentId": "email_processing_loop",
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
          "type": "atomic_task",
          "label": "Add Investor to CRM",
          "intent": "Create a new record in Airtable with the extracted investor information.",
          "context": "Fill out the investor information form in Airtable with the details extracted from the email.",
          "parentId": "email_processing_loop",
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
          "type": "atomic_task",
          "label": "Mark Email as Processed",
          "intent": "Return to Gmail and mark the email as processed to avoid reprocessing.",
          "context": "Go back to Gmail and add a label or flag to indicate this email has been processed.",
          "parentId": "email_processing_loop",
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
        { "from": "gmail_login_flow", "to": "scan_email_list" },
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
  // Convert ALL hardcoded workflow nodes to SOPDocument format
  // This includes both parent nodes and child nodes with parentId
  const sopNodes = HARDCODED_TEST_WORKFLOW.execution.workflow.nodes.map(node => ({
    id: node.id,
    type: node.type,
    label: node.label,
    intent: node.intent,
    context: node.context,
    position: { x: 0, y: 0 }, // Default positions
    // Add parentId if it exists
    ...(node.parentId ? { parentId: node.parentId } : {}),
    // Add children array if it exists  
    ...(node.children ? { children: node.children } : {}),
    // Add canExecuteAsGroup for compound tasks
    ...(node.canExecuteAsGroup !== undefined ? { canExecuteAsGroup: node.canExecuteAsGroup } : {}),
    // Add actions array
    actions: node.actions || []
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

// Add interface for discovered session
interface DiscoveredSession {
  executionId: string;
  containerName: string;
  status: string;
  vncUrl: string | null;
  apiUrl: string | null;
  isHealthy: boolean;
  apiHealthy: boolean;
}

interface SessionDiscoveryResponse {
  status: string;
  message: string;
  activeSession: DiscoveredSession | null;
  allSessions?: DiscoveredSession[];
  discoveryTimestamp?: string;
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
  const [workflow, setWorkflow] = useState<AEFDocument | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [expandedParentIds, setExpandedParentIds] = useState<Set<string>>(new Set());
  const [discoveredSession, setDiscoveredSession] = useState<DiscoveredSession | null>(null);
  const [sessionDiscoveryStatus, setSessionDiscoveryStatus] = useState<'discovering' | 'found' | 'not_found' | 'error'>('discovering');
  const [currentExecutionId, setCurrentExecutionId] = useState<string>(executionId || 'discovering...');

  // Discovery session on component mount
  useEffect(() => {
    const discoverActiveSession = async () => {
      try {
        console.log('🔍 [AEF Control Center] Discovering active VNC session...');
        setSessionDiscoveryStatus('discovering');
        
        const response = await fetch('/api/aef/discover-session');
        const data: SessionDiscoveryResponse = await response.json();
        
        console.log('🔍 [AEF Control Center] Session discovery result:', data);
        
        if (data.status === 'active_session_found' && data.activeSession) {
          console.log(`✅ [AEF Control Center] Found active session: ${data.activeSession.executionId}`);
          setDiscoveredSession({
            executionId: data.activeSession.executionId,
            containerName: data.activeSession.containerName,
            status: data.activeSession.status,
            vncUrl: data.activeSession.vncUrl,
            apiUrl: data.activeSession.apiUrl,
            isHealthy: data.activeSession.isHealthy,
            apiHealthy: data.activeSession.apiHealthy
          });
          setCurrentExecutionId(data.activeSession.executionId);
          setSessionDiscoveryStatus('found');
        } else {
          console.log(`❌ [AEF Control Center] No active session found: ${data.message}`);
          setSessionDiscoveryStatus('not_found');
        }
      } catch (error) {
        console.error('❌ [AEF Control Center] Session discovery failed:', error);
        setSessionDiscoveryStatus('error');
      }
    };

    discoverActiveSession();
  }, []);

  // Session heartbeat - keep session alive and refresh status
  useEffect(() => {
    if (sessionDiscoveryStatus !== 'found' || !discoveredSession) {
      return;
    }

    const heartbeatInterval = setInterval(async () => {
      try {
        const response = await fetch('/api/aef/discover-session');
        const data: SessionDiscoveryResponse = await response.json();
        
        if (data.status === 'active_session_found' && data.activeSession) {
          // Update session status
          setDiscoveredSession(prev => prev ? {
            ...prev,
            status: data.activeSession!.status,
            isHealthy: data.activeSession!.isHealthy
          } : null);
        } else {
          // Session lost
          console.log('⚠️ [AEF Control Center] Session lost during heartbeat');
          setSessionDiscoveryStatus('not_found');
          setDiscoveredSession(null);
        }
      } catch (error) {
        console.error('❌ [AEF Control Center] Heartbeat failed:', error);
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(heartbeatInterval);
  }, [sessionDiscoveryStatus, discoveredSession]);

  // Real execution state
  const [realExecutionId, setRealExecutionId] = useState<string | null>(null);
  const [realExecutionStatus, setRealExecutionStatus] = useState<'idle' | 'creating' | 'running' | 'error'>('idle');

  // VNC Environment state
  const [vncEnvironmentId, setVncEnvironmentId] = useState<string | null>(null);
  const [vncEnvironmentStatus, setVncEnvironmentStatus] = useState<'idle' | 'creating' | 'running' | 'error'>('idle');
  
  // Mock AEF state for demonstration
  const [mockExecutionState, setMockExecutionState] = useState<MockExecutionState | null>(null);
  const [showMockExecution, setShowMockExecution] = useState(false);
  
  // Real-time execution logs for debugging
  const [executionLogs, setExecutionLogs] = useState<MockLogEntry[]>([]);
  
  // Resizable panel state
  const [leftPanelWidth, setLeftPanelWidth] = useState(35); // percentage
  const [isResizing, setIsResizing] = useState(false);
  
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
  
  // Resizing functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const container = document.querySelector('.aef-control-center');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Constrain the width between 20% and 80%
    const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
    setLeftPanelWidth(constrainedWidth);
  };
  
  const handleMouseUp = () => {
    setIsResizing(false);
  };
  
  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);
  
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
    try {
      console.log('🚀 [AEF Control Center] Starting VNC environment...');
      setVncEnvironmentStatus('creating');
      addLog('info', 'system', 'Starting VNC environment...', 'Creating remote desktop session');

      const response = await fetch('/api/aef/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to start VNC environment: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [AEF Control Center] VNC environment started:', result);

      if (result.status === 'session_created' && result.session) {
        setVncEnvironmentId(result.session.executionId);
        setVncEnvironmentStatus('running');
        
        // Update discovered session state
        setDiscoveredSession({
          executionId: result.session.executionId,
          containerName: result.session.containerName,
          status: result.session.status,
          vncUrl: result.session.vncUrl,
          apiUrl: result.session.apiUrl,
          isHealthy: true,
          apiHealthy: true
        });
        setCurrentExecutionId(result.session.executionId);
        setSessionDiscoveryStatus('found');

        addLog('success', 'system', 'VNC environment ready!', 
          `🖥️ VNC Desktop: ${result.session.vncUrl}\n🔧 Action API: ${result.session.apiUrl}\n📝 Execution ID: ${result.session.executionId}`);
      } else if (result.status === 'session_exists' && result.session) {
        // User already has a session
        setVncEnvironmentId(result.session.executionId);
        setVncEnvironmentStatus('running');
        
        // Update discovered session state
        setDiscoveredSession({
          executionId: result.session.executionId,
          containerName: result.session.containerName,
          status: result.session.status,
          vncUrl: result.session.vncUrl,
          apiUrl: result.session.apiUrl,
          isHealthy: true,
          apiHealthy: true
        });
        setCurrentExecutionId(result.session.executionId);
        setSessionDiscoveryStatus('found');

        addLog('info', 'system', 'Using existing VNC session', 
          `Found active session: ${result.session.executionId}`);
      }

    } catch (error) {
      console.error('❌ [AEF Control Center] Failed to start VNC environment:', error);
      setVncEnvironmentStatus('error');
      addLog('error', 'system', 'Failed to start VNC environment', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleRestartBrowser = async (executionId: string) => {
    try {
      console.log('🔄 [AEF Control Center] Restarting browser for execution:', executionId);
      addLog('info', 'system', 'Restarting browser...', 'Refreshing browser in remote desktop');

      const response = await fetch('/api/aef/restart-browser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ executionId })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ [AEF Control Center] Browser restarted:', result);
        addLog('success', 'system', 'Browser restarted successfully', 
                          'Chromium browser is now running in the remote desktop');
      } else {
        console.error('❌ [AEF Control Center] Failed to restart browser:', result);
        addLog('error', 'system', 'Failed to restart browser', 
          result.error || 'Unknown error occurred while restarting browser');
      }
    } catch (error) {
      console.error('❌ [AEF Control Center] Error restarting browser:', error);
      addLog('error', 'system', 'Browser restart error', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const handleStopVncEnvironment = async () => {
    try {
      console.log('🛑 [AEF Control Center] Stopping VNC environment...');
      addLog('info', 'system', 'Stopping VNC environment...', 'Terminating remote desktop session');

      const response = await fetch('/api/aef/session', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to stop VNC environment: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [AEF Control Center] VNC environment stopped:', result);

      // Clear all session state
      setVncEnvironmentId(null);
      setVncEnvironmentStatus('idle');
      setDiscoveredSession(null);
      setSessionDiscoveryStatus('not_found');
      setCurrentExecutionId('discovering...');

      addLog('success', 'system', 'VNC environment stopped', 
        'Remote desktop session terminated successfully');

    } catch (error) {
      console.error('❌ [AEF Control Center] Failed to stop VNC environment:', error);
      addLog('error', 'system', 'Failed to stop VNC environment', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Initialize logs on component mount
  useEffect(() => {
    addLog('info', 'system', 'AEF Control Center initialized', 'Hardcoded test workflow loaded and ready for execution');
  }, []);

  // Determine the active execution ID based on priority: 
  // 1. Discovered VNC session (highest priority - what's actually running)
  // 2. VNC environment ID 
  // 3. Real execution ID
  // 4. Mock execution ID  
  // 5. Prop execution ID (fallback)
  const activeExecutionId = discoveredSession?.executionId || vncEnvironmentId || realExecutionId || mockExecutionState?.executionId || currentExecutionId;
  
  // Debug logging for activeExecutionId
  console.log('🔍 [AEF Control Center] Active execution ID calculation:', {
    discoveredSession: discoveredSession?.executionId,
    vncEnvironmentId,
    realExecutionId,
    mockExecutionId: mockExecutionState?.executionId,
    currentExecutionId,
    finalActiveExecutionId: activeExecutionId
  });
  
  // Determine if any execution is currently active
  const isExecutionActive = !!(discoveredSession || vncEnvironmentId || realExecutionId || mockExecutionState);
  
  // Debug logging for execution active state
  console.log('🔍 [AEF Control Center] Execution active calculation:', {
    discoveredSession: !!discoveredSession,
    vncEnvironmentId: !!vncEnvironmentId,
    realExecutionId: !!realExecutionId,
    mockExecutionState: !!mockExecutionState,
    finalIsExecutionActive: isExecutionActive
  });
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
              {/* Session Discovery Status */}
              {sessionDiscoveryStatus === 'discovering' && (
                <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  Discovering Session...
                </div>
              )}
              {sessionDiscoveryStatus === 'found' && discoveredSession && (
                <div className="flex items-center gap-2 px-2 py-1 bg-green-100 text-green-700 rounded">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Active Session Found: {discoveredSession.executionId.replace('vnc-env-', '').substring(0, 8)}...
                  <Button
                    onClick={() => handleRestartBrowser(discoveredSession.executionId)}
                    size="sm"
                    variant="outline"
                    className="ml-2 h-6 text-xs px-2"
                  >
                    Restart Browser
                  </Button>
                  <Button
                    onClick={handleStopVncEnvironment}
                    size="sm"
                    variant="destructive"
                    className="ml-1 h-6 text-xs px-2"
                  >
                    Kill
                  </Button>
                </div>
              )}
              {sessionDiscoveryStatus === 'not_found' && (
                <div className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded">
                  <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                  No Active Session
                </div>
              )}
              {sessionDiscoveryStatus === 'error' && (
                <div className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded">
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  Discovery Failed
                </div>
              )}
              {/* Existing status indicators */}
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
      
      {/* Main content area with Resizable Layout */}
      <div className="flex flex-col overflow-hidden h-full">
        {/* Top area - 70% with resizable panels */}
        <div className="flex-1 flex overflow-hidden" style={{ height: '70%' }}>
          {/* Left panel - Resizable */}
          <div 
            className="overflow-hidden border-r border-gray-200"
            style={{ width: `${leftPanelWidth}%` }}
          >
            <ExecutionPanel 
              aefDocument={aefDocument!}
              executionId={activeExecutionId}
              mockExecutionState={currentMockState}
              onStartMockExecution={handleStartMockExecution}
              onStopMockExecution={handleStopMockExecution}
            />
          </div>
          
          {/* Resizable Divider */}
          <div
            className={`
              w-1 bg-gray-300 hover:bg-blue-400 cursor-col-resize flex-shrink-0
              transition-colors duration-200 relative group
              ${isResizing ? 'bg-blue-500' : ''}
            `}
            onMouseDown={handleMouseDown}
          >
            {/* Drag Handle Visual Indicator */}
            <div className="absolute inset-y-0 left-1/2 transform -translate-x-1/2 w-1 bg-gray-400 group-hover:bg-blue-500 transition-colors duration-200"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-8 bg-gray-400 group-hover:bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <div className="w-0.5 h-4 bg-white rounded"></div>
            </div>
          </div>
          
          {/* Right panel - Browser */}
          <div 
            className="bg-gray-50 overflow-hidden flex-1"
            style={{ width: `${100 - leftPanelWidth}%` }}
          >
            <BrowserPanel 
              executionId={activeExecutionId}
              isActive={isExecutionActive}
              mockExecutionState={currentMockState}
            />
          </div>
        </div>
        
        {/* Bottom area - 30% */}
        <div className="border-t border-gray-200 overflow-hidden" style={{ height: '30%' }}>
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