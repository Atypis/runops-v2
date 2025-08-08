/**
 * Core AEF (Agentic Execution Framework) Types
 * 
 * These interfaces define the essential data structures for transforming
 * SOPs into executable automation workflows with human oversight.
 */

import { SOPDocument } from './sop';
import { CheckpointConfig } from './checkpoint';
import { BrowserSession } from './browser';
import { ExecutionContext, ExecutionState, ExecutionStatus } from './execution';

/**
 * Execution methods supported by the AEF system
 */
export enum ExecutionMethod {
  BROWSER_AUTOMATION = 'browser_automation',
  API_INTEGRATION = 'api_integration',      // Future enhancement
  MANUAL_STEP = 'manual_step',             // Future enhancement
  HYBRID = 'hybrid'                        // Future enhancement
}

/**
 * Credential types supported by the system
 */
export enum CredentialType {
  EMAIL = 'email',
  PASSWORD = 'password', 
  API_KEY = 'api_key',
  OAUTH_TOKEN = 'oauth_token',
  TEXT = 'text',
  URL = 'url'
}

/**
 * Authentication methods supported by services
 */
export enum AuthenticationMethod {
  EMAIL_PASSWORD = 'email_password',
  GOOGLE_SSO = 'google_sso',
  MICROSOFT_SSO = 'microsoft_sso',
  GITHUB_SSO = 'github_sso',
  OAUTH2 = 'oauth2',
  API_KEY = 'api_key',
  CUSTOM_TOKEN = 'custom_token',
  SAML_SSO = 'saml_sso'
}

/**
 * Service types for credential grouping
 */
export enum ServiceType {
  GMAIL = 'gmail',
  AIRTABLE = 'airtable', 
  OAUTH = 'oauth',
  CUSTOM = 'custom'
}

/**
 * SSO Provider types for shared authentication
 */
export enum SSOProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
  GITHUB = 'github',
  APPLE = 'apple'
}

/**
 * Authentication method configuration for a service
 */
export interface AuthMethodConfig {
  method: AuthenticationMethod;
  label: string;
  description: string;
  icon?: string;
  requiredFields: CredentialType[];
  isDefault?: boolean;
}

/**
 * Individual workflow credential definition
 */
export interface WorkflowCredential {
  id: string;
  serviceType: ServiceType;
  authMethod?: AuthenticationMethod; // NEW: Selected authentication method
  label: string;
  description?: string;
  type: CredentialType;
  required: boolean;
  requiredForSteps: string[];
  validationPattern?: string;
  placeholder?: string;
  helpText?: string;
  isSet?: boolean;
  lastUsed?: Date;
  masked?: boolean; // Whether to mask the value in UI
}

/**
 * Grouped credentials by service
 */
export interface CredentialGroup {
  service: ServiceType;
  icon: string;
  title: string;
  description: string;
  credentials: WorkflowCredential[];
  allSet: boolean;
  requiredForExecution: boolean;
  // NEW: Authentication method configuration
  supportedAuthMethods: AuthMethodConfig[];
  selectedAuthMethod?: AuthenticationMethod;
}

/**
 * Credential state management
 */
export interface CredentialState {
  workflowId: string;
  credentials: Map<string, string>;
  lastUpdated: Date;
  isComplete: boolean;
  missingRequired: string[];
}

// ExecutionStatus is imported from './execution' to avoid circular imports

/**
 * Configuration for secrets/credentials management
 */
export interface SecretConfig {
  id: string;
  name: string;
  description: string;
  type: 'password' | 'api_key' | 'oauth_token' | 'custom';
  required: boolean;
  stepIds?: string[];  // Which steps need this secret
}

/**
 * AEF execution configuration
 * Defines how a workflow should be executed
 */
export interface AEFExecutionConfig {
  // Checkpoint configuration
  checkpoints: CheckpointConfig[];
  
  // Global execution settings
  executionMethod: ExecutionMethod;
  
  // Security and access
  secrets: SecretConfig[];
  credentials: WorkflowCredential[];
  
  // Performance and timing
  estimatedDuration?: number;          // minutes
  stepTimeout?: number;                // seconds per step
  checkpointTimeout?: number;          // seconds to wait for checkpoint approval
  
  // Feature flags for MVP
  parallelismEnabled?: boolean;        // Future enhancement
  autoRetryEnabled?: boolean;          // Future enhancement
  
  // User preferences
  enableDetailedLogging?: boolean;
  pauseOnErrors?: boolean;
}

/**
 * Extended SOP document with AEF execution capabilities
 * This extends the existing SOPDocument without breaking compatibility
 */
export interface AEFDocument extends SOPDocument {
  aef?: {
    // Core execution configuration
    config: AEFExecutionConfig;
    
    // Execution state tracking
    lastExecution?: ExecutionState;
    
    // Learning and optimization (future enhancement)
    learnedPatterns?: Pattern[];
    
    // Transformation metadata
    transformedAt?: Date;
    transformedBy?: string;
    version?: string;
    automationEnhanced?: boolean;    // Whether AI enhanced the SOP
    atomicEnhanced?: boolean;        // Whether atomic workflow parser was used
    technicalTranslated?: boolean;   // Whether technical translator was used
  };
}

/**
 * Pattern learning for future AI optimization (placeholder for future)
 */
export interface Pattern {
  id: string;
  type: 'successful_sequence' | 'error_recovery' | 'user_preference';
  stepIds: string[];
  frequency: number;
  lastUsed: Date;
  confidence: number;  // 0-1 confidence score
}

/**
 * AEF transformation result
 * Returned when an SOP is successfully transformed into an AEF
 */
export interface AEFTransformResult {
  success: boolean;
  aefDocument?: AEFDocument;
  error?: string;
  warnings?: string[];
  estimatedStepCount?: number;
  estimatedDuration?: number;
  automationInstructionsGenerated?: boolean; // Whether AI enhanced the SOP with browser automation
  enhancementMethod?: 'two-step-atomic' | 'legacy-single-step'; // Which enhancement method was used
}

/**
 * Type guards for AEF documents
 */
export function isAEFDocument(document: SOPDocument | AEFDocument): document is AEFDocument {
  return 'aef' in document && document.aef !== undefined;
}

export function hasExecutionConfig(document: AEFDocument): boolean {
  return document.aef?.config !== undefined;
}

/**
 * Default AEF configuration for new transformations
 */
export const DEFAULT_AEF_CONFIG: AEFExecutionConfig = {
  checkpoints: [], // Will be populated during transformation
  executionMethod: ExecutionMethod.BROWSER_AUTOMATION,
  secrets: [],
  credentials: [],
  stepTimeout: 30,           // 30 seconds per step
  checkpointTimeout: 300,    // 5 minutes for checkpoint approval
  parallelismEnabled: false,  // MVP: sequential only
  autoRetryEnabled: false,    // MVP: manual retry
  enableDetailedLogging: true,
  pauseOnErrors: true
};

/**
 * Account providers for centralized authentication
 */
export enum AccountProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
  GITHUB = 'github',
  CUSTOM = 'custom'
}

/**
 * Account access configuration
 */
export interface AccountAccess {
  id: string;
  provider: AccountProvider;
  label: string;
  description: string;
  icon: string;
  supportedServices: ServiceType[];
  credentialFields: {
    fieldType: CredentialType;
    label: string;
    placeholder: string;
    helpText: string;
    masked: boolean;
  }[];
  isConnected?: boolean;
  lastUsed?: Date;
}

/**
 * Service-specific settings (separate from account access)
 */
export interface ServiceSetting {
  id: string;
  serviceType: ServiceType;
  fieldType: CredentialType;
  label: string;
  description: string;
  placeholder: string;
  helpText?: string;
  required: boolean;
  requiredForSteps: string[];
  dependsOnAccount?: AccountProvider; // Which account this service needs
}

/**
 * Enhanced credential group with account separation
 */
export interface EnhancedCredentialGroup {
  service: ServiceType;
  icon: string;
  title: string;
  description: string;
  requiredAccount?: AccountProvider; // Which account this service needs
  serviceSettings: ServiceSetting[]; // Service-specific configs
  allSet: boolean;
  requiredForExecution: boolean;
}

/**
 * Account and service credential state
 */
export interface AccountCredentialState {
  workflowId: string;
  accountAccess: Map<string, string>; // Account-level credentials
  serviceSettings: Map<string, string>; // Service-specific settings
  lastUpdated: Date;
  isComplete: boolean;
  missingAccounts: AccountProvider[];
  missingSettings: string[];
}

/**
 * Application-specific credential configuration
 */
export interface ApplicationCredential {
  service: ServiceType;
  title: string;
  description: string;
  icon: string;
  supportedAuthMethods: ApplicationAuthMethod[];
  selectedAuthMethod?: AuthenticationMethod;
  isRequired: boolean;
  requiredForSteps: string[];
  isConfigured: boolean;
}

/**
 * Authentication method for a specific application
 */
export interface ApplicationAuthMethod {
  method: AuthenticationMethod;
  label: string;
  description: string;
  icon: string;
  requiresSSO?: SSOProvider; // If this method needs SSO credentials
  requiredFields: ApplicationCredentialField[];
  isDefault?: boolean;
}

/**
 * Individual field required for application authentication
 */
export interface ApplicationCredentialField {
  id: string;
  type: CredentialType;
  label: string;
  placeholder: string;
  helpText?: string;
  required: boolean;
  masked?: boolean;
  validationPattern?: string;
}

/**
 * SSO credential configuration for shared authentication
 */
export interface SSOCredential {
  provider: SSOProvider;
  title: string;
  description: string;
  icon: string;
  isConfigured: boolean;
  usedByApplications: ServiceType[]; // Which apps use this SSO
  credentialFields: ApplicationCredentialField[];
  lastUsed?: Date;
}

/**
 * Complete credential workspace for the new UI
 */
export interface CredentialWorkspace {
  workflowId: string;
  workflowTitle: string;
  // Applications section
  applications: ApplicationCredential[];
  // SSO section  
  ssoProviders: SSOCredential[];
  // Overall status
  isComplete: boolean;
  totalRequired: number;
  configuredCount: number;
  lastUpdated?: Date;
} 