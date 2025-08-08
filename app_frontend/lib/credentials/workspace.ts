/**
 * Credential Workspace Service
 * 
 * Builds the application-focused credential workspace from workflow node requirements
 */

import { 
  ServiceType, 
  SSOProvider,
  CredentialWorkspace,
  ApplicationCredential,
  SSOCredential,
  AuthenticationMethod
} from '@/lib/types/aef';
import { SOPDocument } from '@/lib/types/sop';
import { AEFDocument } from '@/lib/types/aef';
import { 
  getApplicationConfig, 
  getRequiredSSOProviders, 
  getApplicationsForSSO,
  SSO_PROVIDERS 
} from './application-config';
import { CredentialStorage } from './storage';

/**
 * Build credential workspace from workflow nodes
 */
export async function buildCredentialWorkspace(
  aefDocument: AEFDocument
): Promise<CredentialWorkspace> {
  const workflowId = aefDocument.meta.id;
  const workflowTitle = aefDocument.meta.title;
  
  // 1. Extract required services from workflow nodes
  const requiredServices = extractRequiredServices(aefDocument.public);
  
  // 2. Build application configurations
  const applications = await buildApplicationCredentials(workflowId, requiredServices);
  
  // 3. Build SSO provider configurations  
  const ssoProviders = await buildSSOCredentials(workflowId, requiredServices);
  
  // 4. Calculate overall completion status
  const { isComplete, configuredCount, totalRequired } = calculateCompletionStatus(
    applications, 
    ssoProviders
  );
  
  return {
    workflowId,
    workflowTitle,
    applications,
    ssoProviders,
    isComplete,
    configuredCount,
    totalRequired,
    lastUpdated: new Date()
  };
}

/**
 * Extract required services from workflow nodes
 */
function extractRequiredServices(publicData: { nodes: any[] }): Map<ServiceType, string[]> {
  const serviceSteps = new Map<ServiceType, string[]>();
  
  publicData.nodes.forEach((node: any) => {
    if (!node.credentialsRequired) return;
    
    Object.keys(node.credentialsRequired).forEach(serviceKey => {
      const service = serviceKey as ServiceType;
      const existingSteps = serviceSteps.get(service) || [];
      serviceSteps.set(service, [...existingSteps, node.id]);
    });
  });
  
  return serviceSteps;
}

/**
 * Build application credential configurations
 */
async function buildApplicationCredentials(
  workflowId: string,
  requiredServices: Map<ServiceType, string[]>
): Promise<ApplicationCredential[]> {
  const applications: ApplicationCredential[] = [];
  
  for (const [service, steps] of requiredServices.entries()) {
    const config = getApplicationConfig(service);
    
    // Check if application is already configured
    const isConfigured = await checkApplicationConfigured(workflowId, service);
    const selectedAuth = await getApplicationAuthMethod(workflowId, service);
    
    applications.push({
      ...config,
      requiredForSteps: steps,
      isConfigured,
      selectedAuthMethod: selectedAuth || undefined
    });
  }
  
  return applications;
}

/**
 * Build SSO credential configurations
 */
async function buildSSOCredentials(
  workflowId: string,
  requiredServices: Map<ServiceType, string[]>
): Promise<SSOCredential[]> {
  const services = Array.from(requiredServices.keys());
  
  // Get both static required providers AND dynamically selected ones
  const staticProviders = getRequiredSSOProviders(services);
  const dynamicProviders = new Set<SSOProvider>();
  
  // Check which SSO providers are required by selected auth methods
  for (const service of services) {
    const selectedAuth = await getApplicationAuthMethod(workflowId, service);
    if (selectedAuth) {
      const config = getApplicationConfig(service);
      const authMethod = config.supportedAuthMethods.find(m => m.method === selectedAuth);
      if (authMethod?.requiresSSO) {
        dynamicProviders.add(authMethod.requiresSSO);
      }
    }
  }
  
  // Combine static and dynamic providers
  const allProviders = new Set([...staticProviders, ...dynamicProviders]);
  const ssoCredentials: SSOCredential[] = [];
  
  for (const provider of allProviders) {
    const config = SSO_PROVIDERS[provider as keyof typeof SSO_PROVIDERS];
    if (!config) continue;
    
    const usedByApplications = getApplicationsForSSO(provider).filter(app => 
      services.includes(app)
    );
    
    // Check if SSO provider is configured
    const isConfigured = await checkSSOConfigured(workflowId, provider);
    
    ssoCredentials.push({
      ...config,
      usedByApplications,
      isConfigured
    });
  }
  
  return ssoCredentials;
}

/**
 * Check if application is configured
 */
async function checkApplicationConfigured(
  workflowId: string,
  service: ServiceType
): Promise<boolean> {
  try {
    // Check if auth method is selected (auth-method-only configuration)
    const savedAuthMethod = await CredentialStorage.getSavedAuthMethod(workflowId, service);
    if (savedAuthMethod) {
      return true; // Auth method selection counts as configuration
    }
    
    // Also check if any credentials exist for this service
    const credentials = await CredentialStorage.getCredentialsForService(workflowId, service);
    return Object.keys(credentials).length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Check if SSO provider is configured
 */
async function checkSSOConfigured(
  workflowId: string,
  provider: SSOProvider
): Promise<boolean> {
  try {
    // Query database directly for SSO provider by name
    const response = await fetch(`/api/credentials?workflowId=${workflowId}&services=${provider}`);
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    const ssoCredential = data.credentials.find((cred: any) => cred.service_type === provider);
    
    if (!ssoCredential) {
      return false;
    }
    
    // If any key/value pair exists in credential_data, treat as configured
    const credentialData = ssoCredential.credential_data || {};
    return Object.keys(credentialData).some((k) => credentialData[k]);
  } catch (error) {
    console.error(`checkSSOConfigured error for ${provider}:`, error);
    return false;
  }
}

/**
 * Calculate overall completion status
 */
function calculateCompletionStatus(
  applications: ApplicationCredential[],
  ssoProviders: SSOCredential[]
): { isComplete: boolean; configuredCount: number; totalRequired: number } {
  const requiredApplications = applications.filter(app => app.isRequired);
  const configuredApplications = requiredApplications.filter(app => app.isConfigured);
  
  // For SSO, count based on what's actually being used
  const usedSSOProviders = ssoProviders.filter(sso => sso.usedByApplications.length > 0);
  const configuredSSO = usedSSOProviders.filter(sso => sso.isConfigured);
  
  const totalRequired = requiredApplications.length + usedSSOProviders.length;
  const configuredCount = configuredApplications.length + configuredSSO.length;
  
  return {
    isComplete: totalRequired > 0 && configuredCount === totalRequired,
    configuredCount,
    totalRequired
  };
}

/**
 * Update application authentication method selection
 */
export async function updateApplicationAuthMethod(
  workflowId: string,
  service: ServiceType,
  authMethod: AuthenticationMethod
): Promise<void> {
  // Store the selected auth method for this application
  await CredentialStorage.saveAuthMethod(workflowId, service, authMethod);
}

/**
 * Get selected authentication method for application
 */
export async function getApplicationAuthMethod(
  workflowId: string,
  service: ServiceType
): Promise<AuthenticationMethod | null> {
  try {
    return await CredentialStorage.getSavedAuthMethod(workflowId, service) as AuthenticationMethod;
  } catch (error) {
    return null;
  }
} 