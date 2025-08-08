/**
 * Application Authentication Configuration
 * 
 * Defines supported authentication methods for each application/service
 * and their credential requirements.
 */

import { 
  ServiceType, 
  AuthenticationMethod, 
  CredentialType, 
  SSOProvider,
  ApplicationCredential,
  ApplicationAuthMethod,
  ApplicationCredentialField
} from '@/lib/types/aef';

/**
 * Gmail application configuration
 */
const GMAIL_CONFIG: ApplicationCredential = {
  service: ServiceType.GMAIL,
  title: 'Gmail',
  description: 'Google Mail service for email management',
  icon: '📧',
  isRequired: true,
  requiredForSteps: [],
  isConfigured: false,
  supportedAuthMethods: [
    {
      method: AuthenticationMethod.EMAIL_PASSWORD,
      label: 'Email & Password',
      description: 'Direct Gmail login with email and password',
      icon: '🔑',
      isDefault: true,
      requiredFields: [
        {
          id: 'gmail_email',
          type: CredentialType.EMAIL,
          label: 'Gmail Address',
          placeholder: 'your-email@gmail.com',
          helpText: 'Your Gmail email address',
          required: true,
          masked: false
        },
        {
          id: 'gmail_password',
          type: CredentialType.PASSWORD,
          label: 'Password',
          placeholder: 'Enter your Gmail password',
          helpText: 'Your Gmail account password',
          required: true,
          masked: true
        }
      ]
    },
    {
      method: AuthenticationMethod.GOOGLE_SSO,
      label: 'Sign in with Google',
      description: 'Use your Google account to access Gmail',
      icon: '🔐',
      requiresSSO: SSOProvider.GOOGLE,
      requiredFields: [] // SSO handles authentication
    }
  ]
};

/**
 * Airtable application configuration
 */
const AIRTABLE_CONFIG: ApplicationCredential = {
  service: ServiceType.AIRTABLE,
  title: 'Airtable',
  description: 'Cloud-based database and collaboration platform',
  icon: '📋',
  isRequired: true,
  requiredForSteps: [],
  isConfigured: false,
  supportedAuthMethods: [
    {
      method: AuthenticationMethod.EMAIL_PASSWORD,
      label: 'Email & Password',
      description: 'Direct Airtable login with email and password',
      icon: '🔑',
      requiredFields: [
        {
          id: 'airtable_email',
          type: CredentialType.EMAIL,
          label: 'Airtable Email',
          placeholder: 'your-email@example.com',
          helpText: 'Your Airtable account email',
          required: true,
          masked: false
        },
        {
          id: 'airtable_password',
          type: CredentialType.PASSWORD,
          label: 'Password',
          placeholder: 'Enter your Airtable password',
          helpText: 'Your Airtable account password',
          required: true,
          masked: true
        }
      ]
    },
    {
      method: AuthenticationMethod.GOOGLE_SSO,
      label: 'Sign in with Google',
      description: 'Use your Google account to access Airtable',
      icon: '🔐',
      requiresSSO: SSOProvider.GOOGLE,
      requiredFields: []
    },
    {
      method: AuthenticationMethod.API_KEY,
      label: 'API Key',
      description: 'Use Airtable API key for programmatic access',
      icon: '🗝️',
      isDefault: true,
      requiredFields: [
        {
          id: 'airtable_api_key',
          type: CredentialType.API_KEY,
          label: 'API Key',
          placeholder: 'key••••••••••••••••••••••••••••••••',
          helpText: 'Your Airtable API key from airtable.com/create/tokens',
          required: true,
          masked: true
        },
        {
          id: 'airtable_base_id',
          type: CredentialType.TEXT,
          label: 'Base ID',
          placeholder: 'app••••••••••••••',
          helpText: 'The ID of your Airtable base',
          required: true,
          masked: false
        }
      ]
    }
  ]
};

/**
 * Application configuration registry
 */
const APPLICATION_CONFIGS: Record<ServiceType, ApplicationCredential> = {
  [ServiceType.GMAIL]: GMAIL_CONFIG,
  [ServiceType.AIRTABLE]: AIRTABLE_CONFIG,
  [ServiceType.OAUTH]: {
    service: ServiceType.OAUTH,
    title: 'OAuth Service',
    description: 'Generic OAuth authentication',
    icon: '🔗',
    isRequired: false,
    requiredForSteps: [],
    isConfigured: false,
    supportedAuthMethods: []
  },
  [ServiceType.CUSTOM]: {
    service: ServiceType.CUSTOM,
    title: 'Custom Service',
    description: 'Custom authentication service',
    icon: '⚙️',
    isRequired: false,
    requiredForSteps: [],
    isConfigured: false,
    supportedAuthMethods: []
  }
};

/**
 * SSO provider configurations
 */
export const SSO_PROVIDERS = {
  [SSOProvider.GOOGLE]: {
    provider: SSOProvider.GOOGLE,
    title: 'Google Account',
    description: 'Your Google account for SSO authentication',
    icon: '🔐',
    isConfigured: false,
    usedByApplications: [],
    credentialFields: [
      {
        id: 'google_email',
        type: CredentialType.EMAIL,
        label: 'Google Email',
        placeholder: 'your-email@gmail.com',
        helpText: 'Your Google account email address',
        required: true,
        masked: false
      },
      {
        id: 'google_password',
        type: CredentialType.PASSWORD,
        label: 'Google Password',
        placeholder: 'Enter your Google password',
        helpText: 'Your Google account password',
        required: true,
        masked: true
      }
    ]
  },
  [SSOProvider.MICROSOFT]: {
    provider: SSOProvider.MICROSOFT,
    title: 'Microsoft Account',
    description: 'Your Microsoft account for SSO authentication',
    icon: '🟦',
    isConfigured: false,
    usedByApplications: [],
    credentialFields: [
      {
        id: 'microsoft_email',
        type: CredentialType.EMAIL,
        label: 'Microsoft Email',
        placeholder: 'your-email@outlook.com',
        helpText: 'Your Microsoft account email address',
        required: true,
        masked: false
      },
      {
        id: 'microsoft_password',
        type: CredentialType.PASSWORD,
        label: 'Microsoft Password',
        placeholder: 'Enter your Microsoft password',
        helpText: 'Your Microsoft account password',
        required: true,
        masked: true
      }
    ]
  }
};

/**
 * Get application configuration by service type
 */
export function getApplicationConfig(service: ServiceType): ApplicationCredential {
  return { ...APPLICATION_CONFIGS[service] }; // Return copy to avoid mutations
}

/**
 * Get all supported applications
 */
export function getAllApplicationConfigs(): ApplicationCredential[] {
  return Object.values(APPLICATION_CONFIGS).map(config => ({ ...config }));
}

/**
 * Get applications that support a specific SSO provider
 */
export function getApplicationsForSSO(provider: SSOProvider): ServiceType[] {
  const applications: ServiceType[] = [];
  
  Object.values(APPLICATION_CONFIGS).forEach(config => {
    const hasSSO = config.supportedAuthMethods.some(method => 
      method.requiresSSO === provider
    );
    if (hasSSO) {
      applications.push(config.service);
    }
  });
  
  return applications;
}

/**
 * Get all SSO providers used by a set of applications
 */
export function getRequiredSSOProviders(services: ServiceType[]): SSOProvider[] {
  const providers = new Set<SSOProvider>();
  
  services.forEach(service => {
    const config = APPLICATION_CONFIGS[service];
    config.supportedAuthMethods.forEach(method => {
      if (method.requiresSSO) {
        providers.add(method.requiresSSO);
      }
    });
  });
  
  return Array.from(providers);
} 