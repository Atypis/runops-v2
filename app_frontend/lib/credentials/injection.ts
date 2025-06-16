/**
 * Credential Injection Service
 * 
 * Handles secure credential injection into workflow execution actions.
 * Provides step-level credential access without exposing sensitive data to AI models.
 */

import { BrowserAction } from '@/lib/browser/types';
import { CredentialStorage } from './storage';
import { ServiceType, WorkflowCredential } from '@/lib/types/aef';
import { decrypt } from './encryption';

export interface ValidationResult {
  isValid: boolean;
  missingCredentials: string[];
  requiredCount: number;
  providedCount: number;
  errors: string[];
}

export interface ExecutionCredentials {
  [key: string]: string;
}

export class CredentialInjectionService {
  
  /**
   * Get credentials required for a specific workflow step
   */
  static async getCredentialsForStep(
    stepId: string, 
    userId: string, 
    workflowId: string,
    requiredCredentials?: string[]
  ): Promise<ExecutionCredentials> {
    try {
      console.log(`🔐 [CredentialInjection] Getting credentials for step ${stepId}`);
      console.log(`🔐 [CredentialInjection] Parameters: userId=${userId}, workflowId=${workflowId}`);
      
      // Get all workflow credentials
      console.log(`🔐 [CredentialInjection] Calling CredentialStorage.getCredentialsForExecution...`);
      const allCredentials = await CredentialStorage.getCredentialsForExecution(workflowId);
      console.log(`🔐 [CredentialInjection] Raw credentials from storage:`, allCredentials.size, 'entries');
      
      // Debug: Log all credential keys
      if (allCredentials.size > 0) {
        console.log(`🔐 [CredentialInjection] Available credential keys:`, Array.from(allCredentials.keys()));
      } else {
        console.log(`⚠️ [CredentialInjection] No credentials found in storage for workflow ${workflowId}`);
      }
      
      // If specific credentials are required for this step, filter to those
      if (requiredCredentials && requiredCredentials.length > 0) {
        const filteredCredentials: ExecutionCredentials = {};
        
        requiredCredentials.forEach(credId => {
          if (allCredentials.has(credId)) {
            filteredCredentials[credId] = allCredentials.get(credId)!;
          }
        });
        
        console.log(`🔐 [CredentialInjection] Retrieved ${Object.keys(filteredCredentials).length} credentials for step ${stepId}`);
        return filteredCredentials;
      }
      
      // Return all credentials if no specific filter
      const credentialsObject: ExecutionCredentials = {};
      allCredentials.forEach((value, key) => {
        credentialsObject[key] = value;
      });
      
      console.log(`🔐 [CredentialInjection] Retrieved all ${Object.keys(credentialsObject).length} credentials for step ${stepId}`);
      return credentialsObject;
      
    } catch (error) {
      console.error(`❌ [CredentialInjection] Failed to get credentials for step ${stepId}:`, error);
      return {};
    }
  }
  
  /**
   * Server-side version: Get credentials using authenticated Supabase client
   */
  static async getCredentialsForStepWithSupabase(
    stepId: string,
    userId: string, 
    workflowId: string,
    supabaseClient: any,
    requiredCredentials?: string[]
  ): Promise<ExecutionCredentials> {
    try {
      console.log(`🔐 [CredentialInjection] Getting credentials for step ${stepId} via Supabase`);
      console.log(`🔐 [CredentialInjection] Parameters: userId=${userId}, workflowId=${workflowId}`);
      
      // Get credentials directly from Supabase
      const { data: credentials, error } = await supabaseClient
        .from('user_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('workflow_id', workflowId);

      if (error) {
        console.error(`❌ [CredentialInjection] Supabase query failed:`, error);
        return {};
      }

      console.log(`🔐 [CredentialInjection] Found ${credentials?.length || 0} credential records`);
      
      // Build credentials map with smart mapping
      const allCredentials = new Map<string, string>();
      
      credentials?.forEach((cred: any) => {
        const serviceCredentials = cred.credential_data;
        const serviceType = cred.service_type;
        
        console.log(`🔐 [CredentialInjection] Processing ${serviceType} credentials`);
        
        // Skip settings records - they're just auth method preferences
        if (serviceType.endsWith('_settings')) {
          return;
        }
        
        // Decrypt credentials
        const decryptedCredentials = decrypt(serviceCredentials);
        
        // Map service credentials to the expected credential IDs
        Object.entries(decryptedCredentials).forEach(([key, value]) => {
          // Set the original credential key
          allCredentials.set(key, value as string);
          
          // ✅ SMART MAPPING: Google OAuth credentials work for Gmail workflows
          if (serviceType === 'google') {
            // Map Google OAuth fields to expected Gmail credential IDs
            if (key === 'email') {
              allCredentials.set('gmail_email', value as string);
              console.log(`✅ [CredentialInjection] Mapped google.email → gmail_email`);
            }
            if (key === 'password') {
              allCredentials.set('gmail_password', value as string);
              console.log(`✅ [CredentialInjection] Mapped google.password → gmail_password`);
            }
            // Map any other google_* fields to gmail_* equivalents
            if (key.startsWith('google_')) {
              const gmailKey = key.replace('google_', 'gmail_');
              allCredentials.set(gmailKey, value as string);
              console.log(`✅ [CredentialInjection] Mapped ${key} → ${gmailKey}`);
            }
          }
          
          // Also create service-prefixed versions for compatibility
          if (!key.includes('_')) {
            allCredentials.set(`${serviceType}_${key}`, value as string);
          }
        });
      });

      console.log(`🔐 [CredentialInjection] Built credential map with ${allCredentials.size} entries`);
      console.log(`🔐 [CredentialInjection] Available credential keys:`, Array.from(allCredentials.keys()));
      
      // If specific credentials are required for this step, filter to those
      if (requiredCredentials && requiredCredentials.length > 0) {
        console.log(`🔐 [CredentialInjection] Filtering for required credentials:`, requiredCredentials);
        const filteredCredentials: ExecutionCredentials = {};
        
        requiredCredentials.forEach(credId => {
          if (allCredentials.has(credId)) {
            filteredCredentials[credId] = allCredentials.get(credId)!;
            console.log(`✅ [CredentialInjection] Found required credential: ${credId}`);
          } else {
            console.log(`❌ [CredentialInjection] Missing required credential: ${credId}`);
          }
        });
        
        console.log(`🔐 [CredentialInjection] Retrieved ${Object.keys(filteredCredentials).length} credentials for step ${stepId}`);
        return filteredCredentials;
      }
      
      // Return all credentials if no specific filter
      const credentialsObject: ExecutionCredentials = {};
      allCredentials.forEach((value, key) => {
        credentialsObject[key] = value;
      });
      
      console.log(`🔐 [CredentialInjection] Retrieved all ${Object.keys(credentialsObject).length} credentials for step ${stepId}`);
      return credentialsObject;
      
    } catch (error) {
      console.error(`❌ [CredentialInjection] Failed to get credentials for step ${stepId}:`, error);
      return {};
    }
  }
  
  /**
   * Inject credentials into a browser action by replacing placeholder tokens
   */
  static injectCredentialsIntoAction(
    action: BrowserAction, 
    credentials: ExecutionCredentials
  ): BrowserAction {
    try {
      console.log(`🔄 [CredentialInjection] Injecting credentials into ${action.type} action`);
      
      // Deep clone the action to avoid modifying the original
      const injectedAction = JSON.parse(JSON.stringify(action));
      
      // Replace credential tokens in the action data
      injectedAction.data = this.replaceCredentialTokens(injectedAction.data, credentials);
      
      // ✅ FIXED: Handle both top-level instruction AND data.instruction for act actions
      if (injectedAction.instruction) {
        injectedAction.instruction = this.replaceCredentialTokens(injectedAction.instruction, credentials);
      }
      
      // ✅ NEW: Also check if there's an instruction inside data (for act actions)
      if (injectedAction.data && injectedAction.data.instruction) {
        injectedAction.data.instruction = this.replaceCredentialTokens(injectedAction.data.instruction, credentials);
      }
      
      console.log(`✅ [CredentialInjection] Credential injection completed for ${action.type} action`);
      return injectedAction;
      
    } catch (error) {
      console.error(`❌ [CredentialInjection] Failed to inject credentials into action:`, error);
      return action; // Return original action if injection fails
    }
  }
  
  /**
   * Replace credential placeholder tokens with actual values
   */
  private static replaceCredentialTokens(data: any, credentials: ExecutionCredentials): any {
    if (typeof data === 'string') {
      let replacedString = data;
      
      // Replace {{credential_name}} tokens
      Object.entries(credentials).forEach(([key, value]) => {
        const tokenPattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        replacedString = replacedString.replace(tokenPattern, value);
      });
      
      return replacedString;
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.replaceCredentialTokens(item, credentials));
    }
    
    if (typeof data === 'object' && data !== null) {
      const replacedObject: any = {};
      
      Object.entries(data).forEach(([key, value]) => {
        replacedObject[key] = this.replaceCredentialTokens(value, credentials);
      });
      
      return replacedObject;
    }
    
    return data;
  }
  
  /**
   * Validate that all required credentials are available before execution
   */
  static async validateExecutionCredentials(
    workflowId: string, 
    requiredCredentials: WorkflowCredential[]
  ): Promise<ValidationResult> {
    try {
      console.log(`🔍 [CredentialInjection] Validating credentials for workflow ${workflowId}`);
      
      const validation = await CredentialStorage.validateCredentials(workflowId, requiredCredentials);
      
      const result: ValidationResult = {
        isValid: validation.isComplete,
        missingCredentials: validation.missingRequired,
        requiredCount: validation.totalRequired,
        providedCount: validation.setCount,
        errors: validation.missingRequired.map(id => `Missing credential: ${id}`)
      };
      
      if (result.isValid) {
        console.log(`✅ [CredentialInjection] All credentials validated for workflow ${workflowId}`);
      } else {
        console.warn(`⚠️ [CredentialInjection] Missing ${result.missingCredentials.length} credentials for workflow ${workflowId}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`❌ [CredentialInjection] Failed to validate credentials:`, error);
      return {
        isValid: false,
        missingCredentials: requiredCredentials.filter(c => c.required).map(c => c.id),
        requiredCount: requiredCredentials.filter(c => c.required).length,
        providedCount: 0,
        errors: ['Failed to validate credentials: ' + (error instanceof Error ? error.message : 'Unknown error')]
      };
    }
  }
  
  /**
   * Extract credential requirements from workflow nodes
   */
  static extractRequiredCredentialsFromStep(
    stepId: string,
    workflowNodes: any[]
  ): string[] {
    const step = workflowNodes.find(node => node.id === stepId);
    if (!step || !step.credentialsRequired) {
      return [];
    }
    
    const requiredCreds: string[] = [];
    
    // Extract from credential requirements
    Object.entries(step.credentialsRequired).forEach(([service, fields]) => {
      if (Array.isArray(fields)) {
        fields.forEach(field => {
          requiredCreds.push(`${service}_${field}`);
        });
      }
    });
    
    return requiredCreds;
  }
  
  /**
   * Check if an action contains credential placeholders
   */
  static actionRequiresCredentials(action: BrowserAction): boolean {
    const actionString = JSON.stringify(action);
    return /\{\{[^}]+\}\}/.test(actionString);
  }
  
  /**
   * Securely clear credentials from memory (for security)
   */
  static clearCredentialsFromMemory(credentials: ExecutionCredentials): void {
    // Overwrite credential values with empty strings
    Object.keys(credentials).forEach(key => {
      credentials[key] = '';
      delete credentials[key];
    });
  }
} 