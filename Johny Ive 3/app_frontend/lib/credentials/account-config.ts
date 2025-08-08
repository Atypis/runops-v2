import { AccountAccess, AccountProvider, ServiceType, CredentialType } from '@/lib/types/aef';

/**
 * Account Access Configurations
 * 
 * Defines available account providers and which services they support.
 * This separates account-level authentication from service-specific settings.
 */

export const GOOGLE_ACCOUNT: AccountAccess = {
  id: 'google_account',
  provider: AccountProvider.GOOGLE,
  label: 'Google Account',
  description: 'Access Gmail, Airtable, and other Google-integrated services',
  icon: '🔵',
  supportedServices: [ServiceType.GMAIL, ServiceType.AIRTABLE],
  credentialFields: [
    {
      fieldType: CredentialType.EMAIL,
      label: 'Google Email',
      placeholder: 'your-email@gmail.com',
      helpText: 'Your Google account email address',
      masked: false
    },
    {
      fieldType: CredentialType.OAUTH_TOKEN,
      label: 'OAuth Token',
      placeholder: 'OAuth token (will be generated)',
      helpText: 'OAuth token for Google services. In production, this would be generated through OAuth flow.',
      masked: true
    }
  ]
};

export const MICROSOFT_ACCOUNT: AccountAccess = {
  id: 'microsoft_account',
  provider: AccountProvider.MICROSOFT,
  label: 'Microsoft Account',
  description: 'Access Airtable and other Microsoft-integrated services',
  icon: '🔷',
  supportedServices: [ServiceType.AIRTABLE],
  credentialFields: [
    {
      fieldType: CredentialType.EMAIL,
      label: 'Microsoft Email',
      placeholder: 'your-email@outlook.com',
      helpText: 'Your Microsoft account email address',
      masked: false
    },
    {
      fieldType: CredentialType.OAUTH_TOKEN,
      label: 'OAuth Token',
      placeholder: 'OAuth token (will be generated)',
      helpText: 'OAuth token for Microsoft services. In production, this would be generated through OAuth flow.',
      masked: true
    }
  ]
};

/**
 * Get all available account providers
 */
export function getAllAccountProviders(): AccountAccess[] {
  return [
    GOOGLE_ACCOUNT,
    MICROSOFT_ACCOUNT
  ];
}

/**
 * Get account provider by ID
 */
export function getAccountProvider(providerId: AccountProvider): AccountAccess | null {
  switch (providerId) {
    case AccountProvider.GOOGLE:
      return GOOGLE_ACCOUNT;
    case AccountProvider.MICROSOFT:
      return MICROSOFT_ACCOUNT;
    default:
      return null;
  }
}

/**
 * Get account providers that support a specific service
 */
export function getAccountProvidersForService(serviceType: ServiceType): AccountAccess[] {
  return getAllAccountProviders().filter(account => 
    account.supportedServices.includes(serviceType)
  );
}

/**
 * Get services supported by an account provider
 */
export function getServicesForAccountProvider(provider: AccountProvider): ServiceType[] {
  const account = getAccountProvider(provider);
  return account?.supportedServices || [];
}

/**
 * Check if an account provider supports a service
 */
export function accountSupportsService(provider: AccountProvider, service: ServiceType): boolean {
  const supportedServices = getServicesForAccountProvider(provider);
  return supportedServices.includes(service);
} 