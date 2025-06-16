/**
 * Secure Credential Storage
 * 
 * Handles encrypted storage and retrieval of workflow credentials
 * using Supabase backend with proper authentication and encryption.
 */

import { CredentialState, WorkflowCredential, ServiceType } from '@/lib/types/aef';
import { SimpleEncryption } from './encryption';

/**
 * Enhanced credential storage manager using Supabase backend
 */
export class CredentialStorage {
  private static getStorageKey(workflowId: string): string {
    return `aef_credentials_${workflowId}`;
  }
  
  /**
   * Store credentials for a service using Supabase API
   */
  static async storeServiceCredentials(
    workflowId: string, 
    serviceType: ServiceType, 
    credentials: Record<string, string>
  ): Promise<void> {
    try {
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType,
          authMethod: 'email_password', // Default for now
          credentials,
          workflowId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to store credentials');
      }
    } catch (error) {
      console.error('Failed to store service credentials:', error);
      throw new Error('Failed to store credentials securely');
    }
  }
  
  /**
   * Store a single credential value (legacy compatibility)
   */
  static async store(workflowId: string, credentialId: string, value: string): Promise<void> {
    try {
      // For backward compatibility, try to map credential ID to service
      const serviceType = this.getServiceTypeFromCredentialId(credentialId);
      const existingCredentials = await this.getCredentialsForService(workflowId, serviceType);
      
      // Update the specific credential field
      const updatedCredentials = {
        ...existingCredentials,
        [credentialId]: value
      };
      
      await this.storeServiceCredentials(workflowId, serviceType, updatedCredentials);
    } catch (error) {
      console.error('Failed to store credential:', error);
      // Fallback to sessionStorage for development
      const existingState = await this.getCredentialStateFromStorage(workflowId);
      const newCredentials = new Map(existingState?.credentials || []);
      
      const encryptedValue = SimpleEncryption.encrypt(value);
      newCredentials.set(credentialId, encryptedValue);
      
      const credentialState: CredentialState = {
        workflowId,
        credentials: newCredentials,
        lastUpdated: new Date(),
        isComplete: false,
        missingRequired: []
      };
      
      const storageKey = this.getStorageKey(workflowId);
      const serialized = JSON.stringify({
        ...credentialState,
        credentials: Array.from(newCredentials.entries())
      });
      
      sessionStorage.setItem(storageKey, serialized);
    }
  }
  
  /**
   * Get credentials for a specific service from Supabase
   */
  static async getCredentialsForService(workflowId: string, serviceType: ServiceType): Promise<Record<string, string>> {
    try {
      // ✅ FIXED: Use absolute URL for server-side fetch  
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/credentials?workflowId=${workflowId}&services=${serviceType}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch credentials');
      }
      
      const data = await response.json();
      const serviceCredential = data.credentials.find((cred: any) => cred.service_type === serviceType);
      
      return serviceCredential?.credential_data || {};
    } catch (error) {
      console.error('Failed to get service credentials:', error);
      return {};
    }
  }
  
  /**
   * Retrieve a single credential value (legacy compatibility)
   */
  static async retrieve(workflowId: string, credentialId: string): Promise<string | null> {
    try {
      const serviceType = this.getServiceTypeFromCredentialId(credentialId);
      const credentials = await this.getCredentialsForService(workflowId, serviceType);
      return credentials[credentialId] || null;
    } catch (error) {
      console.error('Failed to retrieve credential:', error);
      // Fallback to sessionStorage
      const state = await this.getCredentialStateFromStorage(workflowId);
      if (!state || !state.credentials.has(credentialId)) {
        return null;
      }
      
      const encryptedValue = state.credentials.get(credentialId)!;
      return SimpleEncryption.decrypt(encryptedValue);
    }
  }
  
  /**
   * Get complete credential state for a workflow from Supabase
   */
  static async getCredentialState(workflowId: string): Promise<CredentialState | null> {
    try {
      // ✅ FIXED: Use absolute URL for server-side fetch
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const fetchUrl = `${baseUrl}/api/credentials?workflowId=${workflowId}`;
      console.log(`🔐 [CredentialStorage] Fetching credentials from: ${fetchUrl}`);
      
      const response = await fetch(fetchUrl);
      console.log(`🔐 [CredentialStorage] Response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        console.log(`⚠️ [CredentialStorage] API response not OK, falling back to sessionStorage`);
        return this.getCredentialStateFromStorage(workflowId);
      }
      
      const data = await response.json();
      console.log(`🔐 [CredentialStorage] API response data:`, {
        credentialsCount: data.credentials?.length || 0,
        services: data.credentials?.map((c: any) => c.service_type) || []
      });
      
      const credentials = new Map<string, string>();
      
      // Convert Supabase credentials to Map format
      data.credentials.forEach((cred: any) => {
        const serviceCredentials = cred.credential_data;
        const serviceType = cred.service_type;
        
        // Skip settings records - they're just auth method preferences
        if (serviceType.endsWith('_settings')) {
          return;
        }
        
        // Map service credentials to the expected credential IDs
        Object.entries(serviceCredentials).forEach(([key, value]) => {
          // Set the original credential key
          credentials.set(key, value as string);
          
          // ✅ SMART MAPPING: Google OAuth credentials work for Gmail workflows
          if (serviceType === 'google') {
            // Map Google OAuth fields to expected Gmail credential IDs
            if (key === 'email') {
              credentials.set('gmail_email', value as string);
            }
            if (key === 'password') {
              credentials.set('gmail_password', value as string);
            }
            // Map any other google_* fields to gmail_* equivalents
            if (key.startsWith('google_')) {
              const gmailKey = key.replace('google_', 'gmail_');
              credentials.set(gmailKey, value as string);
            }
          }
          
          // Also create service-prefixed versions for compatibility
          if (!key.includes('_')) {
            credentials.set(`${serviceType}_${key}`, value as string);
          }
        });
      });
      
      return {
        workflowId,
        credentials,
        lastUpdated: new Date(),
        isComplete: false, // Will be calculated when validating
        missingRequired: []
      };
    } catch (error) {
      console.error('Failed to get credential state:', error);
      return this.getCredentialStateFromStorage(workflowId);
    }
  }
  
  /**
   * Legacy sessionStorage getter for fallback (CLIENT-SIDE ONLY)
   */
  private static async getCredentialStateFromStorage(workflowId: string): Promise<CredentialState | null> {
    try {
      // ✅ FIXED: Check if we're on the server side
      if (typeof window === 'undefined') {
        console.warn('Attempted to access sessionStorage on server side');
        return null;
      }
      
      const storageKey = this.getStorageKey(workflowId);
      const stored = sessionStorage.getItem(storageKey);
      
      if (!stored) {
        return null;
      }
      
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        credentials: new Map(parsed.credentials || []),
        lastUpdated: new Date(parsed.lastUpdated)
      };
    } catch (error) {
      console.error('Failed to get credential state from storage:', error);
      return null;
    }
  }
  
  /**
   * Check if all required credentials are set
   */
  static async validateCredentials(workflowId: string, requiredCredentials: WorkflowCredential[]): Promise<{
    isComplete: boolean;
    missingRequired: string[];
    setCount: number;
    totalRequired: number;
  }> {
    try {
      const state = await this.getCredentialState(workflowId);
      const requiredIds = requiredCredentials.filter(c => c.required).map(c => c.id);
      const setCredentials = state?.credentials || new Map();
      
      const missingRequired = requiredIds.filter(id => !setCredentials.has(id) || !setCredentials.get(id));
      const setCount = requiredIds.filter(id => setCredentials.has(id) && setCredentials.get(id)).length;
      
      return {
        isComplete: missingRequired.length === 0,
        missingRequired,
        setCount,
        totalRequired: requiredIds.length
      };
    } catch (error) {
      console.error('Failed to validate credentials:', error);
      return {
        isComplete: false,
        missingRequired: requiredCredentials.filter(c => c.required).map(c => c.id),
        setCount: 0,
        totalRequired: requiredCredentials.filter(c => c.required).length
      };
    }
  }
  
  /**
   * Clear all credentials for a workflow
   */
  static async clearCredentials(workflowId: string): Promise<void> {
    try {
      // Get all credentials for the workflow first
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/credentials?workflowId=${workflowId}`);
      if (response.ok) {
        const data = await response.json();
        
        // Delete each credential
        for (const credential of data.credentials) {
          await fetch(`${baseUrl}/api/credentials?id=${credential.id}`, {
            method: 'DELETE'
          });
        }
      }
    } catch (error) {
      console.error('Failed to clear credentials from Supabase:', error);
    }
    
    // Also clear from sessionStorage as fallback
    try {
      const storageKey = this.getStorageKey(workflowId);
      sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear credentials from storage:', error);
    }
  }
  
  /**
   * Get credentials formatted for action injection
   */
  static async getCredentialsForExecution(workflowId: string): Promise<Map<string, string>> {
    try {
      const state = await this.getCredentialState(workflowId);
      return state?.credentials || new Map();
    } catch (error) {
      console.error('Failed to get credentials for execution:', error);
      return new Map();
    }
  }
  
  /**
   * Map credential ID to service type (for backward compatibility)
   */
  private static getServiceTypeFromCredentialId(credentialId: string): ServiceType {
    if (credentialId.includes('gmail')) return ServiceType.GMAIL;
    if (credentialId.includes('airtable')) return ServiceType.AIRTABLE;
    return ServiceType.CUSTOM;
  }

  static async listAccounts(serviceType: ServiceType): Promise<Array<{id: string; display: string; credential_data: Record<string,string>}>> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/credentials?services=${serviceType}`);
      if (!response.ok) {
        return [];
      }
      const data = await response.json();
      const accounts = (data.credentials || []).map((cred: any) => {
        const cd = cred.credential_data || {};
        
        // Debug logging to see what data we actually have
        console.log('Account credential data for', serviceType, ':', cd);
        
        // Try multiple possible field names for email
        const display = 
          cd.email || 
          cd.gmail_email || 
          cd.google_email || 
          cd.airtable_email ||
          cd[`${serviceType}_email`] || // Dynamic field name
          cd.user_email ||
          cd.account_email ||
          cd.username ||
          Object.values(cd).find((value: any) => 
            typeof value === 'string' && value.includes('@')
          ) || // Any field that looks like an email
          `${serviceType} account (${cred.id.slice(-8)})`; // Fallback with service and partial ID
        
        return {
          id: cred.id,
          display,
          credential_data: cd
        };
      });
      return accounts;
    } catch (error) {
      console.error('Failed to list accounts:', error);
      return [];
    }
  }

  /** Save selected authentication method with robust error handling */
  static async saveAuthMethod(workflowId: string, serviceType: ServiceType, method: string): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;
    
    while (attempt < maxRetries) {
      try {
        const response = await fetch('/api/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflowId,
            serviceType: `${serviceType}_settings`,
            authMethod: 'preference',
            credentials: { selected_auth_method: method }
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || 'Failed to save auth method');
        }
        
        // Success - break out of retry loop
        return;
      } catch (error) {
        attempt++;
        console.error(`Failed to save auth method (attempt ${attempt}):`, error);
        
        if (attempt >= maxRetries) {
          // Final attempt failed - fallback to sessionStorage
          try {
            const fallbackKey = `auth_method_${workflowId}_${serviceType}`;
            sessionStorage.setItem(fallbackKey, method);
            console.log('Auth method saved to sessionStorage as fallback');
          } catch (fallbackError) {
            console.error('Failed to save to sessionStorage fallback:', fallbackError);
            throw error;
          }
          return;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
      }
    }
  }

  /** Retrieve selected authentication method if saved */
  static async getSavedAuthMethod(workflowId: string, serviceType: ServiceType): Promise<string | null> {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const resp = await fetch(`${baseUrl}/api/credentials?workflowId=${workflowId}&services=${serviceType}_settings`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.credentials?.length) {
          return data.credentials[0].credential_data?.selected_auth_method || null;
        }
      }
      
      // Fallback to sessionStorage
      const fallbackKey = `auth_method_${workflowId}_${serviceType}`;
      return sessionStorage.getItem(fallbackKey);
    } catch (error) {
      console.error('Failed to get saved auth method:', error);
      
      // Fallback to sessionStorage
      try {
        const fallbackKey = `auth_method_${workflowId}_${serviceType}`;
        return sessionStorage.getItem(fallbackKey);
      } catch (fallbackError) {
        console.error('Failed to get auth method from sessionStorage:', fallbackError);
        return null;
      }
    }
  }
} 