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

// Hardcoded test workflow data with credential requirements
// ✅ CREDENTIAL & AUTH METHOD INTEGRATION: This workflow demonstrates how nodes can declare
// required credentials and preferred authentication methods. The credential management
// system will automatically detect these requirements and provide appropriate auth method
// selection in the UI, then substitute credential placeholders during execution.
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
          "intent": "Complete Gmail authentication process using stored credentials for email and password entry, including navigation and login confirmation.",
          "context": "This compound task handles the complete Gmail login workflow using credentials from the credential management system. The system will automatically substitute {{gmail_email}} and {{gmail_password}} placeholders with the user's stored credentials.",
          "children": ["navigate_to_gmail", "enter_email", "enter_password", "complete_login"],
          "canExecuteAsGroup": true,
          "credentialsRequired": {
            "gmail": ["email", "password"] as ('email' | 'password')[]
          },
          "preferredAuthMethods": {
            "gmail": ["email_password", "google_sso"] as ('email_password' | 'google_sso')[]
          },
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
              "type": "act",
              "instruction": "Enter the email address michaelburner595@gmail.com in the email field and click Next to proceed"
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
              "instruction": "Enter password in the password field using stored credential", 
              "target": { "selector": "input[type='password']" },
              "data": { "text": "{{gmail_password}}" }, // ✅ Uses credential from storage
              "credentialField": "gmail_password" // ✅ Links to credential ID
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
          "intent": "Navigate to the Airtable CRM using stored base ID and authenticate with API key if needed.",
          "context": "Access the Airtable database where investor information is stored and managed. Uses {{airtable_base_id}} from credentials to construct the correct URL and {{airtable_api_key}} for authentication if prompted.",
          "parentId": "email_processing_loop",
          "credentialsRequired": {
            "airtable": ["api_key", "base_id"] as ('api_key' | 'base_id')[]
          },
          "preferredAuthMethods": {
            "airtable": ["google_sso", "api_key"] as ('email_password' | 'google_sso' | 'microsoft_sso' | 'api_key')[]
          },
          "actions": [
            {
              "type": "navigate_or_switch_tab",
              "instruction": "Navigate to Airtable CRM using stored base ID",
              "target": { "url": "https://airtable.com/{{airtable_base_id}}" },
              "credentialField": "airtable_base_id" // ✅ Links to credential ID
            },
            {
              "type": "wait",
              "instruction": "Wait for Airtable base to load",
              "timeout": 5000
            },
            {
              "type": "conditional_auth",
              "instruction": "If prompted for API authentication, use stored API key",
              "data": { "api_key": "{{airtable_api_key}}" },
              "credentialField": "airtable_api_key" // ✅ Links to credential ID
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

function extractAccountAndServiceRequirements(aefDocument: AEFDocument): {
  requiredAccounts: AccountAccess[];
  serviceGroups: EnhancedCredentialGroup[];
} {
  const nodes = aefDocument.public?.nodes || [];
  
  // Collect services that need authentication
  const requiredServices = new Set<ServiceType>();
  const serviceStepsMap = new Map<ServiceType, Set<string>>();
  
  for (const node of nodes) {
    if (!node.credentialsRequired) continue;
    
    Object.entries(node.credentialsRequired).forEach(([service, fields]) => {
      const serviceEnum = service.toUpperCase() as keyof typeof ServiceType;
      if (ServiceType[serviceEnum]) {
        const serviceType = ServiceType[serviceEnum];
        requiredServices.add(serviceType);
        
        const existingSteps = serviceStepsMap.get(serviceType) || new Set();
        existingSteps.add(node.id);
        serviceStepsMap.set(serviceType, existingSteps);
      }
    });
  }
  
  // Determine required account providers
  const requiredAccountProviders = new Set<AccountProvider>();
  const accountServiceMap = new Map<AccountProvider, Set<ServiceType>>();
  
  for (const serviceType of requiredServices) {
    const supportedAccounts = getAccountProvidersForService(serviceType);
    
    // For now, choose the first (primary) account provider for each service
    // In the future, this could be user-configurable
    if (supportedAccounts.length > 0) {
      const primaryAccount = supportedAccounts[0]; // Google for Gmail/Airtable
      requiredAccountProviders.add(primaryAccount.provider);
      
      const existingServices = accountServiceMap.get(primaryAccount.provider) || new Set();
      existingServices.add(serviceType);
      accountServiceMap.set(primaryAccount.provider, existingServices);
    }
  }
  
  // Build required accounts list
  const requiredAccounts = Array.from(requiredAccountProviders).map(provider => {
    const account = getAllAccountProviders().find(acc => acc.provider === provider);
    if (account) {
      const supportedServices = Array.from(accountServiceMap.get(provider) || []);
      return {
        ...account,
        supportedServices // Override with actually required services
      };
    }
    return null;
  }).filter(Boolean) as AccountAccess[];
  
  // Build service groups
  const serviceGroups: EnhancedCredentialGroup[] = [];
  
  for (const serviceType of requiredServices) {
    const supportedAccounts = getAccountProvidersForService(serviceType);
    const requiredAccount = supportedAccounts.length > 0 ? supportedAccounts[0].provider : undefined;
    
    // Get service-specific settings
    const serviceSettings = getServiceSettings(serviceType);
    const steps = Array.from(serviceStepsMap.get(serviceType) || []);
    
    // Update service settings with step requirements
    const enhancedSettings = serviceSettings.map(setting => ({
      ...setting,
      requiredForSteps: steps
    }));
    
    const serviceGroup: EnhancedCredentialGroup = {
      service: serviceType,
      icon: getServiceIcon(serviceType),
      title: getServiceTitle(serviceType),
      description: getServiceDescription(serviceType, requiredAccount),
      requiredAccount,
      serviceSettings: enhancedSettings,
      allSet: false, // Will be calculated dynamically
      requiredForExecution: true
    };
    
    serviceGroups.push(serviceGroup);
  }
  
  return {
    requiredAccounts,
    serviceGroups
  };
}

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

// Temporary bridge function to convert new account system to legacy format
function convertToLegacyCredentials(
  requiredAccounts: AccountAccess[],
  serviceGroups: EnhancedCredentialGroup[]
): WorkflowCredential[] {
  const credentials: WorkflowCredential[] = [];
  
  // Convert account access to credentials
  for (const account of requiredAccounts) {
    for (const field of account.credentialFields) {
      // Map credential fields to supported auth methods
      const authMethod = field.fieldType === CredentialType.EMAIL || field.fieldType === CredentialType.PASSWORD 
        ? AuthenticationMethod.EMAIL_PASSWORD
        : field.fieldType === CredentialType.OAUTH_TOKEN
        ? AuthenticationMethod.GOOGLE_SSO
        : AuthenticationMethod.EMAIL_PASSWORD; // Default fallback
      
      credentials.push({
        id: `${account.id}_${field.fieldType}`,
        serviceType: account.supportedServices[0] || ServiceType.CUSTOM, // Use first supported service
        authMethod: authMethod, // ✅ SET AUTH METHOD
        label: field.label,
        description: `${field.label} for ${account.label}`,
        type: field.fieldType,
        required: true,
        requiredForSteps: [], // Will be populated by service groups
        placeholder: field.placeholder,
        helpText: field.helpText,
        masked: field.masked
      });
    }
  }
  
  // Convert service settings to credentials
  for (const serviceGroup of serviceGroups) {
    for (const setting of serviceGroup.serviceSettings) {
      if (setting.required) {
        // Determine auth method for service settings
        const authMethod = setting.fieldType === CredentialType.API_KEY
          ? AuthenticationMethod.API_KEY
          : setting.fieldType === CredentialType.TEXT
          ? AuthenticationMethod.EMAIL_PASSWORD // For Base IDs, etc.
          : AuthenticationMethod.EMAIL_PASSWORD; // Default fallback
        
        credentials.push({
          id: setting.id,
          serviceType: setting.serviceType,
          authMethod: authMethod, // ✅ SET AUTH METHOD
          label: setting.label,
          description: setting.description,
          type: setting.fieldType,
          required: setting.required,
          requiredForSteps: setting.requiredForSteps,
          placeholder: setting.placeholder,
          helpText: setting.helpText,
          masked: setting.fieldType === CredentialType.API_KEY
        });
      }
    }
  }
  
  return credentials;
}

// Load workflow from JSON or fall back to hardcoded
async function loadWorkflowAsAEFDocument(): Promise<AEFDocument> {
  try {
    console.log('🔄 [AEF Control Center] Loading JSON workflow...');
    
    // Load the JSON workflow
    const workflow = await workflowLoader.loadWorkflow('gmail-investor-crm');
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
    
    // Re-throw the error instead of falling back to hardcoded data
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
  
  // Credential management state
  const [credentialPanelOpen, setCredentialPanelOpen] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState<{
    isComplete: boolean;
    setCount: number;
    totalCount: number;
  }>({ isComplete: false, setCount: 0, totalCount: 0 });

  // New credential panel state
  const [newCredentialPanelOpen, setNewCredentialPanelOpen] = useState(false);

  // Enhanced credential panel state (Advanced UI)
  const [enhancedCredentialPanelOpen, setEnhancedCredentialPanelOpen] = useState(false);

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
  
  // Load workflow from JSON - no fallback anymore
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
  const isAEF = true; // Always true since we're using hardcoded AEF data
  
  // Check if this SOP has been transformed to AEF (using mock for demo)
  const shouldShowMock = shouldShowMockAEF(sopId || '');

  // Simple credential extraction and validation effect
  useEffect(() => {
    // Skip if aefDocument is not loaded yet
    if (!aefDocument) {
      return;
    }
    
    // Skip old system when Enhanced panel is open (it has its own counting)
    if (enhancedCredentialPanelOpen) {
      return;
    }
    
    const extractAndValidateCredentials = async () => {
      console.log('🔍 [AEF] Starting credential extraction for:', aefDocument.meta.id);
      
      try {
        // First, extract credentials from node declarations if none exist in config
        let credentialsToValidate = aefDocument?.aef?.config?.credentials || [];
        
        if (credentialsToValidate.length === 0) {
          console.log('🔍 [AEF] No static credentials found, extracting from node declarations...');
          
          // Use new account-based extraction
          const { requiredAccounts, serviceGroups } = extractAccountAndServiceRequirements(aefDocument);
          
          // Convert to legacy WorkflowCredential format for compatibility
          credentialsToValidate = convertToLegacyCredentials(requiredAccounts, serviceGroups);
          
          console.log('🔍 [AEF] Extracted', credentialsToValidate.length, 'credentials from nodes');
          
          // Update the workflow configuration with dynamic credentials
          if (credentialsToValidate.length > 0 && aefDocument.aef?.config) {
            aefDocument.aef.config.credentials = credentialsToValidate;
          }
        } else {
          console.log('🔐 [AEF] Using existing static credentials:', credentialsToValidate.length);
        }
        
        if (credentialsToValidate.length === 0) {
          console.log('🔐 [AEF] No credentials required for this workflow');
          setCredentialStatus({ isComplete: true, setCount: 0, totalCount: 0 });
          return;
        }

        // Validate the credentials (static or dynamic)
        const validation = await CredentialStorage.validateCredentials(
          aefDocument.meta.id,
          credentialsToValidate
        );
        
        console.log('🔐 [AEF] Validation result:', validation);
        
        setCredentialStatus({
          isComplete: validation.isComplete,
          setCount: validation.setCount,
          totalCount: validation.totalRequired
        });
        
      } catch (error) {
        console.error('Failed to analyze or validate credentials:', error);
        setCredentialStatus({ isComplete: false, setCount: 0, totalCount: 0 });
      }
    };

    extractAndValidateCredentials();
  }, [aefDocument?.meta?.id, credentialPanelOpen, newCredentialPanelOpen, enhancedCredentialPanelOpen]); // Include enhanced panel state

  // Credential handlers
  const handleCredentialsUpdate = (isComplete: boolean, setCount: number, totalCount: number) => {
    setCredentialStatus({ isComplete, setCount, totalCount });
  };

  const handleOpenCredentialPanel = () => {
    console.log('🔐 [AEF] Opening credential panel...');
    setCredentialPanelOpen(true);
    console.log('🔐 [AEF] Credential panel state set to true');
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
              The JSON workflow could not be loaded. The fallback mechanism has been removed to ensure we're testing the pure JSON implementation.
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
              vncUrl={discoveredSession?.vncUrl}
              vncSupported={!!discoveredSession?.vncUrl}
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
      
      {/* Credential Management Panel */}
      <div className="space-y-6">
        {/* Comparison: Old vs New Auth Systems */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setCredentialPanelOpen(true)}
            className="flex items-center gap-2"
          >
            🔐 Old Auth System
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setNewCredentialPanelOpen(true)}
            className="flex items-center gap-2"
          >
            🔐 New Account-Based Auth
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setEnhancedCredentialPanelOpen(true)}
            className="flex items-center gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            ✨ Advanced Credentials UI
          </Button>
        </div>

        <CredentialPanel
          isOpen={credentialPanelOpen}
          onClose={() => setCredentialPanelOpen(false)}
          workflowId={aefDocument.meta.id}
          workflowTitle={aefDocument.meta.title}
          requiredCredentials={aefDocument.aef?.config?.credentials || []}
          onCredentialsUpdate={handleCredentialsUpdate}
        />

                 <AccountCredentialPanel
           isOpen={newCredentialPanelOpen}
           onClose={() => setNewCredentialPanelOpen(false)}
           workflowId={aefDocument.meta.id}
           workflowTitle={aefDocument.meta.title}
           requiredAccounts={[
             {
               id: 'google_account',
               provider: AccountProvider.GOOGLE,
               label: 'Google Account',
               description: 'Your Google account for Gmail and Airtable access',
               icon: '🔵',
               supportedServices: [ServiceType.GMAIL, ServiceType.AIRTABLE],
               credentialFields: [
                 {
                   fieldType: CredentialType.EMAIL,
                   label: 'Email Address',
                   placeholder: 'your-email@gmail.com',
                   helpText: 'Your Google account email address',
                   masked: false
                 },
                 {
                   fieldType: CredentialType.PASSWORD,
                   label: 'Password',
                   placeholder: 'Enter your password',
                   helpText: 'Your Google account password (or App Password if 2FA enabled)',
                   masked: true
                 }
               ]
             }
           ]}
           serviceGroups={[
             {
               service: ServiceType.GMAIL,
               title: 'Gmail',
               description: 'Email automation via Google Account',
               icon: '📧',
               requiredAccount: AccountProvider.GOOGLE,
               serviceSettings: [],
               allSet: false,
               requiredForExecution: true
             },
             {
               service: ServiceType.AIRTABLE,
               title: 'Airtable CRM',
               description: 'Database management via Google Account + Base ID',
               icon: '🗃️',
               requiredAccount: AccountProvider.GOOGLE,
               serviceSettings: [
                 {
                   id: 'airtable_base_id',
                   serviceType: ServiceType.AIRTABLE,
                   fieldType: CredentialType.TEXT,
                   label: 'Airtable Base ID',
                   description: 'Your Airtable base identifier (required for database access)',
                   placeholder: 'appXXXXXXXXXXXXXX',
                   helpText: 'Found in your Airtable base URL after connecting Google Account',
                   required: true,
                   requiredForSteps: []
                 }
               ],
               allSet: false,
               requiredForExecution: true
             }
           ]}
           onCredentialsUpdate={handleCredentialsUpdate}
         />
         
         <EnhancedCredentialPanel
           isOpen={enhancedCredentialPanelOpen}
           onClose={() => setEnhancedCredentialPanelOpen(false)}
           aefDocument={aefDocument}
           onCredentialsUpdate={handleCredentialsUpdate}
         />
      </div>
    </div>
  );
};

export default AEFControlCenter; 