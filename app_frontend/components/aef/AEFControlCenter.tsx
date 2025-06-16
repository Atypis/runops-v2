'use client';

import React, { useState, useEffect } from 'react';
import { SOPDocument } from '@/lib/types/sop';
import { AEFDocument, isAEFDocument, ExecutionMethod, WorkflowCredential, ServiceType, CredentialType, AuthenticationMethod, AccountProvider, AccountAccess, ServiceSetting, EnhancedCredentialGroup } from '@/lib/types/aef';
import { CheckpointType, CheckpointCondition } from '@/lib/types/checkpoint';
import { createMockAEFTransformation, createMockExecutionState, shouldShowMockAEF, MockExecutionState, MockLogEntry } from '@/lib/mock-aef-data';
import ExecutionPanel from './ExecutionPanel';
import BrowserPanel from './BrowserPanel';
import ExecutionLog from './ExecutionLog';
import TransformLoading from './TransformLoading';
import CredentialPanel from './CredentialPanel';
import AccountCredentialPanel from './AccountCredentialPanel';
import EnhancedCredentialPanel from './EnhancedCredentialPanel';
import { Button } from '@/components/ui/button';
import { CredentialStorage } from '@/lib/credentials/storage';
import { getAuthMethodsForService, getSharedOAuthCredentialId } from '@/lib/credentials/auth-methods';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Clock, Settings, Key, Play, Pause, RotateCcw } from 'lucide-react';
import { getAllAccountProviders, getAccountProvidersForService } from '@/lib/credentials/account-config';
import { getServiceSettings, getServiceSettingsForAccount } from '@/lib/credentials/service-config';
import { workflowLoader, AEFWorkflow, WorkflowLoadError, WorkflowValidationError } from '@/lib/workflow/WorkflowLoader';
import { buildCredentialWorkspace } from '@/lib/credentials/workspace';


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

// ✅ CREDENTIAL & AUTH METHOD INTEGRATION: Workflow credential requirements are now
// dynamically loaded from JSON files using the WorkflowLoader system.
// The system automatically detects credential requirements from node declarations
// and provides appropriate auth method selection in the UI, then substitutes 
// credential placeholders during execution.

// Helper functions
function getServiceIcon(serviceType: ServiceType): string {
  switch (serviceType) {
    case ServiceType.GMAIL: return '📧';
    case ServiceType.AIRTABLE: return '🗃️';
    default: return '⚙️';
  }
}

function getServiceTitle(serviceType: ServiceType): string {
  switch (serviceType) {
    case ServiceType.GMAIL: return 'Gmail';
    case ServiceType.AIRTABLE: return 'Airtable';
    default: return serviceType;
  }
}

function getServiceDescription(serviceType: ServiceType, requiredAccount?: AccountProvider): string {
  switch (serviceType) {
    case ServiceType.GMAIL:
      return requiredAccount === AccountProvider.GOOGLE 
        ? 'Email access via your Google account'
        : 'Email inbox and management';
    case ServiceType.AIRTABLE:
      return requiredAccount === AccountProvider.GOOGLE
        ? 'Database access via your Google account' 
        : 'CRM database and tables';
    default:
      return 'Service access';
  }
}

// Load workflow from JSON
async function loadWorkflowAsAEFDocument(): Promise<AEFDocument> {
  try {
    console.log('🔄 [AEF Control Center] Loading JSON workflow...');
    
    // Load the JSON workflow
    const workflow = await workflowLoader.loadWorkflow('gmail-investor-crm-v2');
    console.log(`✅ [AEF Control Center] Successfully loaded workflow: ${workflow.meta.title}`);
    
    // Convert workflow nodes to AEF format
    const sopNodes = workflow.execution.workflow.nodes.map(node => ({
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
      // Add credentialsRequired property
      ...(node.credentialsRequired ? { credentialsRequired: node.credentialsRequired } : {}),
      // Add actions array
      actions: node.actions || []
    }));

    const mockSOP: SOPDocument = {
              meta: {
          ...workflow.meta,
          goal: workflow.meta.goal || 'Default goal',
          purpose: workflow.meta.purpose || 'Default purpose',
          owner: workflow.meta.owner || ['default-owner']
        },
      public: {
        nodes: sopNodes.map(node => ({
          ...node,
          context: node.context || 'Default context'
        })),
        edges: workflow.execution.workflow.flow.map(flow => ({
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

    // Create AEF document with the JSON workflow data
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
              stepIds: ['gmail_login_flow', 'scan_email_list', 'select_email', 'mark_processed']
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
          credentials: [], // Will be dynamically generated from node credentialsRequired properties
          estimatedDuration: workflow.config?.executionTimeout || 1800,
          stepTimeout: 60,
          checkpointTimeout: 300,
          enableDetailedLogging: true,
          pauseOnErrors: workflow.config?.pauseOnErrors ?? true
        },
        transformedAt: new Date(),
        transformedBy: 'json-workflow',
        version: workflow.meta.version,
        automationEnhanced: true
      }
    };

    // Store the original workflow structure as a property for the execution engine to access
    (aefDocument as any).execution = workflow.execution;

    return aefDocument;
  } catch (error) {
    console.error('❌ [AEF Control Center] Failed to load JSON workflow:', error);
    
    // Re-throw the error since we're now 100% JSON-driven
    if (error instanceof WorkflowValidationError) {
      throw new Error(`Workflow validation failed: ${error.message}`);
    }
    
    if (error instanceof WorkflowLoadError) {
      throw new Error(`Failed to load workflow: ${error.message}`);
    }
    
    throw new Error(`Failed to load JSON workflow: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
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
  
  // Enhanced credential panel state (Advanced UI) - ONLY UI WE USE
  const [enhancedCredentialPanelOpen, setEnhancedCredentialPanelOpen] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState<{
    isComplete: boolean;
    setCount: number;
    totalCount: number;
  }>({ isComplete: false, setCount: 0, totalCount: 0 });

  // Discovery session on component mount
  useEffect(() => {
    const discoverActiveSession = async () => {
      try {
        console.log('🔍 [AEF Control Center] Checking single VNC session status...');
        setSessionDiscoveryStatus('discovering');
        
        const response = await fetch('/api/vnc/status');
        const data = await response.json();
        
        console.log('🔍 [AEF Control Center] VNC status result:', data);
        
        if (data.status === 'ready' && data.session) {
          console.log(`✅ [AEF Control Center] Found active VNC session: ${data.session.id}`);
          setDiscoveredSession({
            executionId: data.session.id,
            containerName: 'aef-vnc-single', // Always the same
            status: 'running',
            vncUrl: data.vncUrl, // Always http://localhost:16080/vnc.html
            apiUrl: 'http://localhost:13000', // Always port 13000
            isHealthy: true,
            apiHealthy: true
          });
          setCurrentExecutionId(data.session.id);
          setSessionDiscoveryStatus('found');
          setVncEnvironmentId(data.session.id);
          setVncEnvironmentStatus('running');
        } else if (data.status === 'starting') {
          console.log('⏳ [AEF Control Center] VNC session is starting...');
          setSessionDiscoveryStatus('discovering');
          setVncEnvironmentStatus('creating');
          // Retry in a moment
          setTimeout(() => discoverActiveSession(), 2000);
        } else {
          console.log(`❌ [AEF Control Center] No active VNC session: ${data.message}`);
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
        const response = await fetch('/api/vnc/status');
        const data = await response.json();
        
        if (data.status === 'ready' && data.session) {
          // Session still healthy - no need to update since it's always the same config
          console.log('💓 [AEF Control Center] VNC session heartbeat - healthy');
        } else {
          // Session lost
          console.log('⚠️ [AEF Control Center] VNC session lost during heartbeat');
          setSessionDiscoveryStatus('not_found');
          setDiscoveredSession(null);
          setVncEnvironmentId(null);
          setVncEnvironmentStatus('idle');
        }
      } catch (error) {
        console.error('❌ [AEF Control Center] Heartbeat failed:', error);
      }
    }, 15000); // Every 15 seconds (faster since it's simpler)

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
  const [topPanelHeight, setTopPanelHeight] = useState(70); // Top area height percentage
  const [isVerticalResizing, setIsVerticalResizing] = useState(false);
  
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
  
  // Horizontal resizing functionality
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

  // Vertical resizing functionality
  const handleVerticalMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsVerticalResizing(true);
  };
  
  const handleVerticalMouseMove = (e: MouseEvent) => {
    if (!isVerticalResizing) return;
    
    const container = document.querySelector('.aef-control-center');
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const headerHeight = 120; // Approximate header height
    const availableHeight = containerRect.height - headerHeight;
    const newTopHeight = ((e.clientY - containerRect.top - headerHeight) / availableHeight) * 100;
    
    // Constrain the height between 30% and 90%
    const constrainedHeight = Math.max(30, Math.min(90, newTopHeight));
    setTopPanelHeight(constrainedHeight);
  };
  
  const handleVerticalMouseUp = () => {
    setIsVerticalResizing(false);
  };
  
  // Add global mouse event listeners for resizing
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else if (isVerticalResizing) {
      document.addEventListener('mousemove', handleVerticalMouseMove);
      document.addEventListener('mouseup', handleVerticalMouseUp);
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleVerticalMouseMove);
      document.removeEventListener('mouseup', handleVerticalMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleVerticalMouseMove);
      document.removeEventListener('mouseup', handleVerticalMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, isVerticalResizing]);
  
  // Load workflow from JSON
  const [aefDocument, setAefDocument] = useState<AEFDocument | null>(null);
  const [workflowLoadError, setWorkflowLoadError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        setWorkflowLoadError(null);
        const doc = await loadWorkflowAsAEFDocument();
        console.log('🔍 [AEF] Loaded AEF Document:', doc);
        console.log('🔍 [AEF] AEF Config:', doc.aef?.config);
        console.log('🔍 [AEF] Credentials Array:', doc.aef?.config?.credentials);
        console.log('🔍 [AEF] Credentials Length:', doc.aef?.config?.credentials?.length);
        setAefDocument(doc);
      } catch (error) {
        console.error('❌ Failed to load JSON workflow:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error loading workflow';
        setWorkflowLoadError(errorMessage);
      }
    };
    
    loadWorkflow();
  }, []);
  const isAEF = true; // Always true since we're using JSON-driven AEF workflow
  
  // Check if this SOP has been transformed to AEF (using mock for demo)
  const shouldShowMock = shouldShowMockAEF(sopId || '');

  // Simple credential extraction and validation effect
  useEffect(() => {
    // Skip if aefDocument is not loaded yet
    if (!aefDocument) {
      return;
    }
    
    const extractAndValidateCredentials = async () => {
      console.log('🔐 [AEF] Initial credential extraction for workflow:', aefDocument.meta.id);
      await refreshCredentialsFromSupabase();
    };

    extractAndValidateCredentials();
  }, [aefDocument?.meta?.id]); // Remove enhancedCredentialPanelOpen dependency since we handle close explicitly

  // Credential handlers
  const handleCredentialsUpdate = (isComplete: boolean, setCount: number, totalCount: number) => {
    setCredentialStatus({ isComplete, setCount, totalCount });
  };

  const handleOpenCredentialPanel = () => {
    console.log('🔐 [AEF] Opening Enhanced credential panel...');
    setEnhancedCredentialPanelOpen(true);
    console.log('🔐 [AEF] Enhanced credential panel state set to true');
  };

  const handleCloseCredentialPanel = () => {
    console.log('🔐 [AEF] Enhanced credential panel closing, refreshing credentials...');
    setEnhancedCredentialPanelOpen(false);
    
    // Trigger credential refresh after panel closes
    setTimeout(async () => {
      if (aefDocument) {
        console.log('🔐 [AEF] Re-extracting credentials after panel close...');
        await refreshCredentialsFromSupabase();
      }
    }, 300); // Small delay to ensure panel state is updated
  };

  // SINGLE SOURCE OF TRUTH: Use the same buildCredentialWorkspace that Enhanced Panel uses
  const refreshCredentialsFromSupabase = async () => {
    if (!aefDocument) return;

    try {
      console.log('🔐 [AEF] Using SINGLE SOURCE OF TRUTH: buildCredentialWorkspace');
      
      // Use the exact same function that Enhanced Panel uses
      const workspace = await buildCredentialWorkspace(aefDocument);
      
      console.log('🔐 [AEF] Workspace result:', {
        workflowId: workspace.workflowId,
        applications: workspace.applications.length,
        ssoProviders: workspace.ssoProviders.length,
        configuredCount: workspace.configuredCount,
        totalRequired: workspace.totalRequired,
        isComplete: workspace.isComplete
      });
      
      console.log('🔐 [AEF] Applications:', workspace.applications.map(app => ({
        service: app.service,
        title: app.title,
        isConfigured: app.isConfigured,
        selectedAuthMethod: app.selectedAuthMethod
      })));
      
      console.log('🔐 [AEF] SSO Providers:', workspace.ssoProviders.map(sso => ({
        provider: sso.provider,
        title: sso.title,
        isConfigured: sso.isConfigured,
        usedByApplications: sso.usedByApplications
      })));
      
      // Use the exact same calculation that Enhanced Panel uses
      setCredentialStatus({
        isComplete: workspace.isComplete,
        setCount: workspace.configuredCount,
        totalCount: workspace.totalRequired
      });
      
    } catch (error) {
      console.error('❌ [AEF] Failed to build credential workspace:', error);
      setCredentialStatus({ isComplete: false, setCount: 0, totalCount: 0 });
    }
  };

  // Real execution handler - simplified for single VNC session
  const handleStartRealExecution = async () => {
    addLog('info', 'system', 'Starting real execution...', 'Sending workflow to single VNC session');
    setRealExecutionStatus('creating');
    
    try {
      // Ensure VNC session is ready
      const statusResponse = await fetch('/api/vnc/status');
      const statusData = await statusResponse.json();
      
      if (statusData.status !== 'ready') {
        throw new Error('VNC session not ready. Please start a VNC environment first.');
      }

      // Validate credentials
      if (!credentialStatus.isComplete) {
        throw new Error('Please complete all credential requirements before starting execution');
      }
      
      console.log('Starting real execution in single VNC session');
      
      // Send workflow to VNC session
      const response = await fetch('/api/vnc/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'execute_workflow',
          workflow: aefDocument,
          executionMethod: 'real'
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMsg = errorData.error || 'Failed to start execution';
        addLog('error', 'system', 'Failed to start execution', errorMsg);
        throw new Error(errorMsg);
      }
      
      const result = await response.json();
      console.log('Real execution started:', result);
      
      setRealExecutionId(statusData.session.id);
      setRealExecutionStatus('running');
      
      addLog('success', 'system', 'Real execution started!', `Session ID: ${statusData.session.id}\nWorkflow is now running in the single VNC browser`);
      
    } catch (error) {
      console.error('Failed to start real execution:', error);
      setRealExecutionStatus('error');
      addLog('error', 'system', 'Failed to start real execution', error instanceof Error ? error.message : 'Unknown error');
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
      console.log('🚀 [AEF Control Center] Starting VNC environment (Single Session Mode)...');
      setVncEnvironmentStatus('creating');
      addLog('info', 'system', 'Starting fresh VNC session...', '🔥 Killing any existing sessions for clean start');

      // Call the simplified VNC start endpoint
      const response = await fetch('/api/vnc/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to start VNC environment: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [AEF Control Center] VNC environment started:', result);

      if (result.success) {
        const sessionId = result.session.id;
        setVncEnvironmentId(sessionId);
        setVncEnvironmentStatus('running');
        
        // Update discovered session state with fixed ports (always the same!)
        setDiscoveredSession({
          executionId: sessionId,
          containerName: 'aef-vnc-single', // Fixed container name
          status: result.status,
          vncUrl: result.vncUrl, // Always http://localhost:16080/vnc.html
          apiUrl: 'http://localhost:13000', // Always port 13000
          isHealthy: true,
          apiHealthy: true
        });
        setCurrentExecutionId(sessionId);
        setSessionDiscoveryStatus('found');

        addLog('success', 'system', '✅ Single VNC session ready!', 
          `🖥️ VNC Desktop: ${result.vncUrl} (ALWAYS THE SAME URL)\n🔧 Action API: http://localhost:13000 (ALWAYS THE SAME PORT)\n📝 Session ID: ${sessionId}`);
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
      console.log('🛑 [AEF Control Center] Stopping single VNC session...');
      addLog('info', 'system', '🔥 Stopping VNC session...', 'Destroying the single remote desktop session');

      // Call the simplified VNC stop endpoint
      const response = await fetch('/api/vnc/stop', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to stop VNC environment: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ [AEF Control Center] VNC session stopped:', result);

      // Clear all session state
      setVncEnvironmentId(null);
      setVncEnvironmentStatus('idle');
      setDiscoveredSession(null);
      setSessionDiscoveryStatus('not_found');
      setCurrentExecutionId('discovering...');

      addLog('success', 'system', '✅ Single VNC session stopped', 
        '🔥 Remote desktop completely destroyed - next start will be 100% fresh');

    } catch (error) {
      console.error('❌ [AEF Control Center] Failed to stop VNC environment:', error);
      addLog('error', 'system', '❌ Failed to stop VNC environment', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // 💥 NUCLEAR OPTION: KILL EVERYTHING - ALL BROWSERS, ALL DOCKER, ALL STATE
  const handleNuclearKillEverything = async () => {
    try {
      console.log('💥 [AEF Control Center] 💀 NUCLEAR KILL EVERYTHING INITIATED...');
      addLog('error', 'system', '💥💀 NUCLEAR KILL EVERYTHING', 'DESTROYING ALL BROWSERS, ALL DOCKER CONTAINERS, ALL STATE');

      // Call the nuclear kill endpoint
      const response = await fetch('/api/aef/nuclear-kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000) // 30 second timeout for nuclear operation
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Nuclear kill failed: ${response.status}`);
      }

      const result = await response.json();
      console.log('💀 [AEF Control Center] NUCLEAR KILL COMPLETED:', result);

      // Clear ALL session state
      setVncEnvironmentId(null);
      setVncEnvironmentStatus('idle');
      setDiscoveredSession(null);
      setSessionDiscoveryStatus('not_found');
      setCurrentExecutionId('discovering...');

      addLog('success', 'system', '💀 NUCLEAR KILL COMPLETED', 
        '💥 ALL DOCKER CONTAINERS DESTROYED, ALL BROWSERS KILLED, ALL STATE WIPED - EVERYTHING IS GONE');

    } catch (error) {
      console.error('💀 [AEF Control Center] NUCLEAR KILL FAILED:', error);
      addLog('error', 'system', '💀 NUCLEAR KILL FAILED', 
        error instanceof Error ? error.message : 'Unknown error');
    }
  };

  // Initialize logs on component mount
  useEffect(() => {
    addLog('info', 'system', 'AEF Control Center initialized', 'JSON workflow loaded and ready for execution');
  }, []);

  // Prefer the explicitly set currentExecutionId (frozen for this execution) before falling back to discovered sessions.
  const activeExecutionId = currentExecutionId || discoveredSession?.executionId || vncEnvironmentId || realExecutionId || mockExecutionState?.executionId;
  
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

  // Show loading or error state if aefDocument is not loaded yet
  if (!aefDocument) {
    if (workflowLoadError) {
      return (
        <div className="h-full flex items-center justify-center bg-muted/30">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">❌</span>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Failed to Load Workflow
            </h3>
            <p className="text-gray-600 mb-4">
              The JSON workflow could not be loaded. Please check the workflow file and schema validation.
            </p>
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 text-left">
              <p className="text-red-600 text-sm font-mono">{workflowLoadError}</p>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Retry Loading
            </button>
          </div>
        </div>
      );
    }
    
    return (
      <div className="h-full flex items-center justify-center bg-muted/30">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading JSON workflow...</p>
        </div>
      </div>
    );
  }

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
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 tracking-tight">AEF Control Center</h1>
              <p className="text-sm text-gray-600 mt-0.5">{aefDocument.meta.title}</p>
            </div>
            <div className="flex items-center gap-3">
              {/* System Status Indicators */}
              {sessionDiscoveryStatus === 'discovering' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium">Discovering Session</span>
                </div>
              )}
              {sessionDiscoveryStatus === 'found' && discoveredSession && (
                <div className="flex items-center gap-3 px-3 py-1.5 bg-green-50 text-green-700 rounded-md border border-green-100">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-medium">
                      Session {discoveredSession.executionId.replace('vnc-env-', '').substring(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleRestartBrowser(discoveredSession.executionId)}
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2 border-green-200 text-green-700 hover:bg-green-100"
                    >
                      Restart
                    </Button>
                    <Button
                      onClick={handleStopVncEnvironment}
                      size="sm"
                      variant="outline"
                      className="h-6 text-xs px-2 border-red-200 text-red-700 hover:bg-red-50"
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              )}
              {/* Execution Environment Status */}
              {vncEnvironmentId && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 rounded-md border border-purple-100">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                  <span className="text-xs font-medium">Remote Desktop Active</span>
                </div>
              )}
              {realExecutionId && !vncEnvironmentId && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md border border-green-100">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs font-medium">Browser Session Live</span>
                </div>
              )}
              {mockExecutionState && !realExecutionId && !vncEnvironmentId && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md border border-blue-100">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-xs font-medium">Demo Mode</span>
                </div>
              )}
              {!realExecutionId && !mockExecutionState && !vncEnvironmentId && sessionDiscoveryStatus !== 'discovering' && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 text-gray-600 rounded-md border border-gray-200">
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  <span className="text-xs font-medium">Ready</span>
                </div>
              )}
              
              {/* Credential Status Indicator */}
              {(() => {
                console.log('🔐 [AEF] Rendering credential badge - Status:', credentialStatus);
                return credentialStatus.totalCount > 0 && (
                  <div 
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md border cursor-pointer hover:shadow-sm transition-all ${
                      credentialStatus.isComplete 
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' 
                        : credentialStatus.setCount > 0 
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' 
                          : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                    }`}
                    onClick={handleOpenCredentialPanel}
                    title="Click to configure workflow credentials"
                  >
                    <span className="text-sm">🔐</span>
                    <span className="text-xs font-medium">
                      {credentialStatus.setCount}/{credentialStatus.totalCount} Credentials
                    </span>
                    {credentialStatus.isComplete && (
                      <span className="text-green-600">✓</span>
                    )}
                  </div>
                );
              })()}
              
              {/* Debug: Always show if totalCount is 0 - MAKE IT CLICKABLE */}
              {credentialStatus.totalCount === 0 && (
                <div 
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md border bg-yellow-50 text-yellow-700 border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-all"
                  onClick={handleOpenCredentialPanel}
                  title="Click to configure workflow credentials"
                >
                  <span className="text-sm">⚠️</span>
                  <span className="text-xs font-medium">No Credentials Defined</span>
                  <span className="text-xs opacity-70">(Click to setup)</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Primary Environment Controls */}
            {!vncEnvironmentId ? (
              <Button
                onClick={handleStartVncEnvironment}
                size="sm"
                disabled={vncEnvironmentStatus === 'creating'}
                className="bg-slate-700 hover:bg-slate-800 text-white font-medium shadow-sm"
              >
                {vncEnvironmentStatus === 'creating' ? (
                  <>
                    <div className="w-3 h-3 animate-spin border border-white border-t-transparent rounded-full mr-2"></div>
                    Starting Environment...
                  </>
                ) : (
                  '🖥️ Start Remote Desktop'
                )}
              </Button>
            ) : (
              <Button
                onClick={handleStopVncEnvironment}
                size="sm"
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-50"
              >
                ⏹️ Stop Environment
              </Button>
            )}
            
            {/* Advanced Execution Controls */}
            {!vncEnvironmentId && (
              <>
                {!realExecutionId ? (
                  <Button
                    onClick={handleStartRealExecution}
                    size="sm"
                    disabled={realExecutionStatus === 'creating'}
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50 font-medium"
                  >
                    {realExecutionStatus === 'creating' ? (
                      <>
                        <div className="w-3 h-3 animate-spin border border-slate-600 border-t-transparent rounded-full mr-2"></div>
                        Starting...
                      </>
                    ) : (
                      '🚀 Advanced Mode'
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleStopRealExecution}
                    size="sm"
                    variant="outline"
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    ⏹️ Stop Advanced
                  </Button>
                )}
              </>
            )}
            
            {/* Demo Controls */}
            {!showMockExecution && !realExecutionId && !vncEnvironmentId ? (
              <Button
                onClick={handleStartMockExecution}
                size="sm"
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50 font-medium"
              >
                🎭 Demo Mode
              </Button>
            ) : showMockExecution ? (
              <Button
                onClick={handleStopMockExecution}
                size="sm"
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-50"
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
        {/* Top area - Resizable height with horizontal panels */}
        <div className="flex overflow-hidden" style={{ height: `${topPanelHeight}%` }}>
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
          
          {/* Horizontal Resizable Divider */}
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
              vncUrl={discoveredSession?.vncUrl}
              vncSupported={!!discoveredSession?.vncUrl}
            />
          </div>
        </div>
        
        {/* Vertical Resizable Divider */}
        <div
          className={`
            h-1 bg-gray-300 hover:bg-blue-400 cursor-row-resize flex-shrink-0
            transition-colors duration-200 relative group
            ${isVerticalResizing ? 'bg-blue-500' : ''}
          `}
          onMouseDown={handleVerticalMouseDown}
        >
          {/* Drag Handle Visual Indicator */}
          <div className="absolute inset-x-0 top-1/2 transform -translate-y-1/2 h-1 bg-gray-400 group-hover:bg-blue-500 transition-colors duration-200"></div>
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-8 h-3 bg-gray-400 group-hover:bg-blue-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <div className="w-4 h-0.5 bg-white rounded"></div>
          </div>
        </div>
        
        {/* Bottom area - Resizable height */}
        <div className="border-t border-gray-200 overflow-hidden flex-1" style={{ height: `${100 - topPanelHeight}%` }}>
          <ExecutionLog 
            executionId={activeExecutionId}
            mockLogs={combinedLogs}
          />
        </div>
      </div>
      
      {/* Credential Management Panel */}
      <div className="space-y-6">
        {/* Only Enhanced Credentials UI */}
        <EnhancedCredentialPanel
          isOpen={enhancedCredentialPanelOpen}
          onClose={handleCloseCredentialPanel}
          aefDocument={aefDocument}
          onCredentialsUpdate={handleCredentialsUpdate}
        />
      </div>
    </div>
  );
};

export default AEFControlCenter; 