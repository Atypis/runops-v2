import { useState, useEffect, useMemo } from 'react';
import { createSupabaseClient } from '@/lib/supabase-browser';
import { ServiceType } from '@/lib/types/aef';

export interface NodeCredentialStatus {
  nodeId: string;
  status: 'none' | 'missing' | 'partial' | 'complete';
  requiredCredentials: string[];
  configuredCredentials: string[];
  missingCredentials: string[];
}

export interface CredentialStatusHook {
  nodeStatuses: Map<string, NodeCredentialStatus>;
  overallStatus: 'none' | 'missing' | 'partial' | 'complete';
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  totalRequired: number;
  totalConfigured: number;
}

/**
 * Hook to track credential status for workflow nodes
 */
export const useCredentialStatus = (
  workflowId: string,
  nodeCredentialRequirements: Map<string, string[]> // nodeId -> required credential IDs
): CredentialStatusHook => {
  const [userCredentials, setUserCredentials] = useState<Map<string, any>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user credentials from Supabase
  const fetchCredentials = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Fetch all credentials for this user and workflow
      const { data: credentials, error: fetchError } = await supabase
        .from('user_credentials')
        .select('*')
        .eq('user_id', user.id)
        .or(`workflow_id.eq.${workflowId},workflow_id.is.null`); // Workflow-specific or global

      if (fetchError) {
        throw fetchError;
      }

      // Process credentials into a map
      const credMap = new Map();
      credentials?.forEach(cred => {
        const serviceType = cred.service_type;
        const credentialData = cred.credential_data;
        
        // Map service credentials to expected credential IDs
        Object.entries(credentialData).forEach(([key, value]) => {
          let credentialId = key;
          // Add service prefix if not already present
          if (!key.includes('_') && serviceType !== 'custom') {
            credentialId = `${serviceType}_${key}`;
          }
          
          credMap.set(credentialId, {
            value,
            serviceType,
            authMethod: cred.auth_method,
            isSet: Boolean(value)
          });
        });
      });

      setUserCredentials(credMap);
      
    } catch (err) {
      console.error('Error fetching credentials:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch credentials');
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate node credential statuses
  const nodeStatuses = useMemo(() => {
    const statusMap = new Map<string, NodeCredentialStatus>();
    
    nodeCredentialRequirements.forEach((requiredCreds, nodeId) => {
      if (requiredCreds.length === 0) {
        statusMap.set(nodeId, {
          nodeId,
          status: 'none',
          requiredCredentials: [],
          configuredCredentials: [],
          missingCredentials: []
        });
        return;
      }

      const configuredCreds = requiredCreds.filter(credId => 
        userCredentials.has(credId) && userCredentials.get(credId)?.isSet
      );
      
      const missingCreds = requiredCreds.filter(credId =>
        !userCredentials.has(credId) || !userCredentials.get(credId)?.isSet
      );

      let status: NodeCredentialStatus['status'];
      if (configuredCreds.length === 0) {
        status = 'missing';
      } else if (missingCreds.length === 0) {
        status = 'complete';
      } else {
        status = 'partial';
      }

      statusMap.set(nodeId, {
        nodeId,
        status,
        requiredCredentials: requiredCreds,
        configuredCredentials: configuredCreds,
        missingCredentials: missingCreds
      });
    });

    return statusMap;
  }, [nodeCredentialRequirements, userCredentials]);

  // Calculate overall status
  const overallStatus = useMemo(() => {
    const statuses = Array.from(nodeStatuses.values());
    const withCredentials = statuses.filter(s => s.status !== 'none');
    
    if (withCredentials.length === 0) return 'none';
    
    const allComplete = withCredentials.every(s => s.status === 'complete');
    if (allComplete) return 'complete';
    
    const anyConfigured = withCredentials.some(s => s.status === 'complete' || s.status === 'partial');
    if (anyConfigured) return 'partial';
    
    return 'missing';
  }, [nodeStatuses]);

  // Calculate totals
  const { totalRequired, totalConfigured } = useMemo(() => {
    let required = 0;
    let configured = 0;
    
    nodeStatuses.forEach(status => {
      required += status.requiredCredentials.length;
      configured += status.configuredCredentials.length;
    });
    
    return { totalRequired: required, totalConfigured: configured };
  }, [nodeStatuses]);

  // Fetch on mount and when workflowId changes
  useEffect(() => {
    if (workflowId) {
      fetchCredentials();
    }
  }, [workflowId]);

  return {
    nodeStatuses,
    overallStatus,
    isLoading,
    error,
    refetch: fetchCredentials,
    totalRequired,
    totalConfigured
  };
}; 