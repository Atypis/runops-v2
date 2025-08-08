// Minimal AEF type surface to keep credentials and workspace modules compiling

export enum ServiceType {
  GMAIL = 'gmail',
  AIRTABLE = 'airtable',
  OAUTH = 'oauth',
  CUSTOM = 'custom',
}

export enum CredentialType {
  EMAIL = 'email',
  PASSWORD = 'password',
  API_KEY = 'api_key',
  OAUTH_TOKEN = 'oauth_token',
  TEXT = 'text',
}

export enum AuthenticationMethod {
  EMAIL_PASSWORD = 'email_password',
  GOOGLE_SSO = 'google_sso',
  MICROSOFT_SSO = 'microsoft_sso',
  API_KEY = 'api_key',
  OAUTH2 = 'oauth2',
  CUSTOM_TOKEN = 'custom_token',
}

export enum AccountProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
}

export enum SSOProvider {
  GOOGLE = 'google',
  MICROSOFT = 'microsoft',
}

export interface WorkflowCredential {
  id: string;
  label?: string;
  required: boolean;
  service?: ServiceType;
  fieldType?: CredentialType;
}

export interface AuthMethodConfig {
  method: AuthenticationMethod;
  label: string;
  description?: string;
  icon?: string;
  requiredFields: CredentialType[];
  isDefault?: boolean;
}

export interface ApplicationCredentialField {
  id: string;
  type: CredentialType;
  label: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  masked?: boolean;
}

export interface ApplicationAuthMethod {
  method: AuthenticationMethod;
  label: string;
  description?: string;
  icon?: string;
  isDefault?: boolean;
  requiresSSO?: SSOProvider;
  requiredFields: ApplicationCredentialField[];
}

export interface ApplicationCredential {
  service: ServiceType;
  title: string;
  description?: string;
  icon?: string;
  isRequired: boolean;
  requiredForSteps: string[];
  isConfigured: boolean;
  supportedAuthMethods: ApplicationAuthMethod[];
  selectedAuthMethod?: AuthenticationMethod;
}

export interface ServiceSetting {
  id: string;
  serviceType: ServiceType;
  fieldType: CredentialType;
  label: string;
  description?: string;
  placeholder?: string;
  helpText?: string;
  required: boolean;
  requiredForSteps: string[];
  dependsOnAccount?: AccountProvider;
}

export interface AccountFieldSpec {
  fieldType: CredentialType;
  label: string;
  placeholder?: string;
  helpText?: string;
  masked?: boolean;
}

export interface AccountAccess {
  id: string;
  provider: AccountProvider;
  label: string;
  description?: string;
  icon?: string;
  supportedServices: ServiceType[];
  credentialFields: AccountFieldSpec[];
}

export interface CredentialState {
  workflowId: string;
  credentials: Map<string, string>;
  lastUpdated: Date;
  isComplete: boolean;
  missingRequired: string[];
}

export interface SSOCredential {
  provider: SSOProvider;
  title: string;
  description?: string;
  icon?: string;
  isConfigured: boolean;
  usedByApplications: ServiceType[];
  credentialFields: ApplicationCredentialField[];
}

export interface CredentialWorkspace {
  workflowId: string;
  workflowTitle?: string;
  applications: ApplicationCredential[];
  ssoProviders: SSOCredential[];
  isComplete: boolean;
  configuredCount: number;
  totalRequired: number;
  lastUpdated: Date;
}

// Minimal AEF document for credential workspace helpers
export interface AEFDocument {
  meta: { id: string; title?: string };
  public: { nodes: any[] };
}


