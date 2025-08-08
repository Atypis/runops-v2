import { SOPNode } from '@/lib/types/sop';

/**
 * Extract credential requirements from a single workflow node
 */
export const extractNodeCredentialRequirements = (node: SOPNode): string[] => {
  const credentials: string[] = [];
  
  // Method 1: Extract from node-level credentialsRequired
  if (node.credentialsRequired) {
    Object.entries(node.credentialsRequired).forEach(([service, creds]) => {
      if (Array.isArray(creds)) {
        creds.forEach(cred => {
          // Create credential ID: service_credentialType
          credentials.push(`${service}_${cred}`);
        });
      }
    });
  }
  
  // Method 2: Extract from action-level credentialField
  if (node.actions) {
    node.actions.forEach(action => {
      if (action.credentialField) {
        credentials.push(action.credentialField);
      }
    });
  }
  
  // Method 3: Extract from action data that contains credential placeholders
  if (node.actions) {
    node.actions.forEach(action => {
      if (action.data && typeof action.data === 'object') {
        Object.values(action.data).forEach(value => {
          if (typeof value === 'string') {
            // Look for {{credential_name}} patterns
            const matches = value.match(/\{\{([^}]+)\}\}/g);
            if (matches) {
              matches.forEach((match: string) => {
                const credentialId = match.replace(/[{}]/g, '');
                credentials.push(credentialId);
              });
            }
          }
        });
      }
      
      // Also check instruction text for credential placeholders
              if (action.instruction && typeof action.instruction === 'string') {
          const matches = action.instruction.match(/\{\{([^}]+)\}\}/g);
          if (matches) {
            matches.forEach((match: string) => {
              const credentialId = match.replace(/[{}]/g, '');
              credentials.push(credentialId);
            });
          }
        }
    });
  }
  
  // Remove duplicates and return
  return [...new Set(credentials)];
};

/**
 * Extract credential requirements from all nodes in a workflow
 */
export const extractWorkflowCredentialRequirements = (
  nodes: SOPNode[]
): Map<string, string[]> => {
  const requirementsMap = new Map<string, string[]>();
  
  nodes.forEach(node => {
    const nodeCredentials = extractNodeCredentialRequirements(node);
    if (nodeCredentials.length > 0) {
      requirementsMap.set(node.id, nodeCredentials);
    }
  });
  
  return requirementsMap;
};

/**
 * Get all unique credential IDs required by the entire workflow
 */
export const getAllWorkflowCredentials = (nodes: SOPNode[]): string[] => {
  const allCredentials: string[] = [];
  
  nodes.forEach(node => {
    const nodeCredentials = extractNodeCredentialRequirements(node);
    allCredentials.push(...nodeCredentials);
  });
  
  return [...new Set(allCredentials)];
};

/**
 * Group credentials by service type
 */
export const groupCredentialsByService = (credentialIds: string[]): Map<string, string[]> => {
  const serviceMap = new Map<string, string[]>();
  
  credentialIds.forEach(credId => {
    // Extract service from credential ID (e.g., 'gmail_email' -> 'gmail')
    const parts = credId.split('_');
    const service = parts[0];
    
    if (!serviceMap.has(service)) {
      serviceMap.set(service, []);
    }
    serviceMap.get(service)!.push(credId);
  });
  
  return serviceMap;
};

/**
 * Check if a credential ID matches expected patterns
 */
export const isValidCredentialId = (credentialId: string): boolean => {
  // Valid patterns: service_field, or standalone field names
  const validPatterns = [
    /^[a-z]+_[a-z_]+$/, // service_field (e.g., gmail_email)
    /^[a-z_]+$/, // standalone field (e.g., api_key)
  ];
  
  return validPatterns.some(pattern => pattern.test(credentialId));
};

/**
 * Normalize credential ID to standard format
 */
export const normalizeCredentialId = (credentialId: string, defaultService?: string): string => {
  // If already contains service prefix, return as-is
  if (credentialId.includes('_')) {
    return credentialId;
  }
  
  // If we have a default service, prefix it
  if (defaultService) {
    return `${defaultService}_${credentialId}`;
  }
  
  // Otherwise return as-is
  return credentialId;
}; 