import { AuthMethodConfig, AuthenticationMethod, CredentialType, ServiceType } from '@/lib/types/aef';

/**
 * Authentication Method Configurations by Service
 * 
 * Defines which authentication methods are supported by each service
 * and what credential fields are required for each method.
 */

export const GMAIL_AUTH_METHODS: AuthMethodConfig[] = [
  {
    method: AuthenticationMethod.EMAIL_PASSWORD,
    label: 'Email & Password',
    description: 'Sign in with your Gmail email and password (or App Password if 2FA enabled)',
    icon: '🔐',
    requiredFields: [CredentialType.EMAIL, CredentialType.PASSWORD],
    isDefault: true
  }
];

export const AIRTABLE_AUTH_METHODS: AuthMethodConfig[] = [
  {
    method: AuthenticationMethod.EMAIL_PASSWORD,
    label: 'Email & Password',
    description: 'Sign in with your email and password, then provide Base ID',
    icon: '🔐',
    requiredFields: [CredentialType.EMAIL, CredentialType.PASSWORD],
    isDefault: true
  },
  {
    method: AuthenticationMethod.GOOGLE_SSO,
    label: 'Sign in with Google',
    description: 'Use your Google account to access Airtable (requires Base ID)',
    icon: '🔵',
    requiredFields: [CredentialType.EMAIL, CredentialType.PASSWORD] // Use same Google creds, not OAuth token
  },
  {
    method: AuthenticationMethod.API_KEY,
    label: 'API Key Access',
    description: 'Use Airtable API key for programmatic access (requires Base ID)',
    icon: '🔑',
    requiredFields: [CredentialType.API_KEY, CredentialType.TEXT] // API key + base ID
  }
];

export const OAUTH_AUTH_METHODS: AuthMethodConfig[] = [
  {
    method: AuthenticationMethod.OAUTH2,
    label: 'OAuth 2.0',
    description: 'Standard OAuth 2.0 authentication flow',
    icon: '🔄',
    requiredFields: [CredentialType.OAUTH_TOKEN],
    isDefault: true
  }
];

export const CUSTOM_AUTH_METHODS: AuthMethodConfig[] = [
  {
    method: AuthenticationMethod.CUSTOM_TOKEN,
    label: 'Custom Token',
    description: 'Custom authentication token or API key',
    icon: '⚙️',
    requiredFields: [CredentialType.TEXT],
    isDefault: true
  }
];

/**
 * Get authentication methods for a specific service
 */
export function getAuthMethodsForService(serviceType: ServiceType): AuthMethodConfig[] {
  switch (serviceType) {
    case ServiceType.GMAIL:
      return GMAIL_AUTH_METHODS;
    case ServiceType.AIRTABLE:
      return AIRTABLE_AUTH_METHODS;
    case ServiceType.OAUTH:
      return OAUTH_AUTH_METHODS;
    case ServiceType.CUSTOM:
      return CUSTOM_AUTH_METHODS;
    default:
      return [];
  }
}

/**
 * Get the default authentication method for a service
 */
export function getDefaultAuthMethod(serviceType: ServiceType): AuthenticationMethod | null {
  const methods = getAuthMethodsForService(serviceType);
  const defaultMethod = methods.find(m => m.isDefault);
  return defaultMethod?.method || methods[0]?.method || null;
}

/**
 * Get required credential fields for a specific auth method
 */
export function getRequiredFieldsForAuthMethod(
  serviceType: ServiceType, 
  authMethod: AuthenticationMethod
): CredentialType[] {
  const methods = getAuthMethodsForService(serviceType);
  const method = methods.find(m => m.method === authMethod);
  return method?.requiredFields || [];
}

/**
 * Get user-friendly label for an authentication method
 */
export function getAuthMethodLabel(
  serviceType: ServiceType,
  authMethod: AuthenticationMethod
): string {
  const methods = getAuthMethodsForService(serviceType);
  const method = methods.find(m => m.method === authMethod);
  return method?.label || authMethod;
}

/**
 * Cross-Service Credential Sharing Logic
 */

/**
 * Check if two services can share OAuth credentials
 */
export function canShareOAuthCredentials(
  sourceService: ServiceType,
  targetService: ServiceType,
  authMethod: AuthenticationMethod
): boolean {
  // Google OAuth can be shared between Gmail and Airtable
  if (authMethod === AuthenticationMethod.GOOGLE_SSO) {
    const googleCompatibleServices = [ServiceType.GMAIL, ServiceType.AIRTABLE];
    return googleCompatibleServices.includes(sourceService) && 
           googleCompatibleServices.includes(targetService);
  }
  
  // Microsoft OAuth can be shared between certain services
  if (authMethod === AuthenticationMethod.MICROSOFT_SSO) {
    const microsoftCompatibleServices = [ServiceType.AIRTABLE]; // Add more as needed
    return microsoftCompatibleServices.includes(sourceService) && 
           microsoftCompatibleServices.includes(targetService);
  }
  
  return false;
}

/**
 * Get potential credential sources for a service/auth method combination
 */
export function getPotentialCredentialSources(
  targetService: ServiceType,
  authMethod: AuthenticationMethod
): ServiceType[] {
  const sources: ServiceType[] = [];
  
  // Check all service types for compatibility
  Object.values(ServiceType).forEach(sourceService => {
    if (sourceService !== targetService && 
        canShareOAuthCredentials(sourceService, targetService, authMethod)) {
      sources.push(sourceService);
    }
  });
  
  return sources;
}

/**
 * Generate credential ID for shared OAuth tokens
 */
export function getSharedOAuthCredentialId(authMethod: AuthenticationMethod): string {
  switch (authMethod) {
    case AuthenticationMethod.GOOGLE_SSO:
      return 'shared_google_oauth_token';
    case AuthenticationMethod.MICROSOFT_SSO:
      return 'shared_microsoft_oauth_token';
    default:
      return `shared_${authMethod}_token`;
  }
}

/**
 * Get all services that could use a shared credential
 */
export function getServicesUsingSharedCredential(authMethod: AuthenticationMethod): ServiceType[] {
  switch (authMethod) {
    case AuthenticationMethod.GOOGLE_SSO:
      return [ServiceType.GMAIL, ServiceType.AIRTABLE];
    case AuthenticationMethod.MICROSOFT_SSO:
      return [ServiceType.AIRTABLE];
    default:
      return [];
  }
} 