import { ServiceSetting, ServiceType, CredentialType, AccountProvider } from '@/lib/types/aef';

/**
 * Service-Specific Settings Configuration
 * 
 * Defines additional settings each service needs beyond account access.
 * These are service-specific configurations like API keys, base IDs, etc.
 */

/**
 * Gmail service settings (minimal - mostly uses Google account)
 */
export const GMAIL_SETTINGS: ServiceSetting[] = [
  // Gmail primarily uses Google account access, minimal additional settings needed
];

/**
 * Airtable service settings
 */
export const AIRTABLE_SETTINGS: ServiceSetting[] = [
  {
    id: 'airtable_base_id',
    serviceType: ServiceType.AIRTABLE,
    fieldType: CredentialType.TEXT,
    label: 'Base ID',
    description: 'Your Airtable base identifier',
    placeholder: 'appXXXXXXXXXXXXXX',
    helpText: 'Find this in your Airtable base URL (starts with "app")',
    required: true,
    requiredForSteps: [], // Will be populated by workflow analysis
    dependsOnAccount: AccountProvider.GOOGLE // Requires Google account to be connected
  },
  {
    id: 'airtable_api_key_fallback',
    serviceType: ServiceType.AIRTABLE,
    fieldType: CredentialType.API_KEY,
    label: 'API Key (Alternative)',
    description: 'Direct API access (alternative to account-based access)',
    placeholder: 'keyXXXXXXXXXXXXXX',
    helpText: 'Use this if you prefer API key access instead of account authentication. Find in Airtable Account Settings > API.',
    required: false,
    requiredForSteps: []
    // No dependsOnAccount - this is the alternative to account access
  }
];

/**
 * Get service settings for a specific service type
 */
export function getServiceSettings(serviceType: ServiceType): ServiceSetting[] {
  switch (serviceType) {
    case ServiceType.GMAIL:
      return GMAIL_SETTINGS;
    case ServiceType.AIRTABLE:
      return AIRTABLE_SETTINGS;
    default:
      return [];
  }
}

/**
 * Get required service settings (excluding optional ones)
 */
export function getRequiredServiceSettings(serviceType: ServiceType): ServiceSetting[] {
  return getServiceSettings(serviceType).filter(setting => setting.required);
}

/**
 * Get service settings that depend on a specific account provider
 */
export function getServiceSettingsForAccount(
  serviceType: ServiceType, 
  accountProvider: AccountProvider
): ServiceSetting[] {
  return getServiceSettings(serviceType).filter(setting => 
    setting.dependsOnAccount === accountProvider
  );
}

/**
 * Get alternative service settings (those that don't depend on account access)
 */
export function getAlternativeServiceSettings(serviceType: ServiceType): ServiceSetting[] {
  return getServiceSettings(serviceType).filter(setting => 
    !setting.dependsOnAccount
  );
}

/**
 * Check if a service has any required settings beyond account access
 */
export function serviceHasAdditionalSettings(serviceType: ServiceType): boolean {
  return getRequiredServiceSettings(serviceType).length > 0;
} 