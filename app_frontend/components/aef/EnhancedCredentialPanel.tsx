'use client';

import React, { useState, useEffect } from 'react';
import { 
  CredentialWorkspace, 
  ApplicationCredential, 
  SSOCredential,
  AuthenticationMethod,
  ServiceType,
  SSOProvider
} from '@/lib/types/aef';
import { Button } from '@/components/ui/button';
import { buildCredentialWorkspace, updateApplicationAuthMethod } from '@/lib/credentials/workspace';
import { AEFDocument } from '@/lib/types/aef';
import { CredentialStorage } from '@/lib/credentials/storage';

// Enhanced ApplicationCard component with clean, minimal design
const ApplicationCard = ({ application, isExpanded, onToggle, onAuthMethodChange, onConfirmAuthMethod, onCredentialUpdate, workflowId, ssoCredentialStatus }: any) => {
  const [localSelectedMethod, setLocalSelectedMethod] = React.useState(application.selectedAuthMethod || null);
  const [isAuthProvided, setIsAuthProvided] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  
  // Auto-save auth method selection immediately on change
  const handleMethodChange = async (method: any) => {
    setLocalSelectedMethod(method);
    setIsSaving(true);
    
    try {
      // Immediately save the auth method selection
      await CredentialStorage.saveAuthMethod(workflowId, application.service, method);
      onAuthMethodChange(method);
    } catch (error) {
      console.error('Failed to save auth method:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  const getSelectedAuthMethodDetails = () => {
    if (!localSelectedMethod) return null;
    return application.supportedAuthMethods.find((m: any) => m.method === localSelectedMethod);
  };
  
  const needsConfiguration = localSelectedMethod && localSelectedMethod !== application.selectedAuthMethod;
  const isConfigured = localSelectedMethod === application.selectedAuthMethod;
  const selectedMethodDetails = getSelectedAuthMethodDetails();
  
  // Enhanced status logic: gray -> yellow -> green
  const isGoogleAuth = selectedMethodDetails?.requiresSSO === 'google';
  const googleAuthProvided = isGoogleAuth && ssoCredentialStatus && ssoCredentialStatus['google'];
  const hasDirectCredentials = !isGoogleAuth && (application.isConfigured || isAuthProvided);
  
  // Status determination:
  // Gray: Not configured at all
  // Yellow: Configured but missing dependencies (SSO not provided)
  // Green: Fully ready (configured + all dependencies met)
  let statusColor = 'bg-gray-300'; // Not configured
  if (isConfigured) {
    if (isGoogleAuth) {
      statusColor = googleAuthProvided ? 'bg-green-500' : 'bg-yellow-500'; // Green if Google auth provided, yellow if missing
    } else {
      statusColor = hasDirectCredentials ? 'bg-green-500' : 'bg-yellow-500'; // Green if credentials provided, yellow if missing
    }
  }
  
  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      {/* Card Header */}
      <div className="p-6 cursor-pointer hover:bg-gray-50 transition-colors" onClick={onToggle}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-2xl">{application.icon}</span>
            <div>
              <h5 className="font-medium text-gray-900">{application.title}</h5>
              <p className="text-sm text-gray-500 mt-1">{application.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isSaving && <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
            <div className={`w-3 h-3 rounded-full ${statusColor}`}></div>
            <span className="text-gray-400">{isExpanded ? '−' : '+'}</span>
          </div>
        </div>
      </div>
      
      {/* Card Content */}
      {isExpanded && (
        <div className="px-6 pb-6 border-t border-gray-100">
          <div className="pt-6 space-y-6">
            
            {/* Method Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {application.service === 'airtable' ? 'How do you sign in?' : 'Authentication'}
              </label>
              
              {application.service === 'airtable' && application.supportedAuthMethods.length > 1 ? (
                <select
                  value={localSelectedMethod || ''}
                  onChange={(e) => handleMethodChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isSaving}
                >
                  <option value="">Choose method...</option>
                  {application.supportedAuthMethods.map((method: any) => (
                    <option key={method.method} value={method.method}>
                      {method.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="space-y-3">
                  {application.supportedAuthMethods.map((method: any) => (
                    <label key={method.method} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name={`${application.service}-auth`}
                        checked={localSelectedMethod === method.method}
                        onChange={() => handleMethodChange(method.method)}
                        disabled={isSaving}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{method.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            
            {/* Configuration Button */}
            {needsConfiguration && (
              <button 
                type="button"
                onClick={onConfirmAuthMethod}
                disabled={isSaving}
                className="w-full bg-blue-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                Configure {selectedMethodDetails?.label}
              </button>
            )}
            
            {/* Missing Google Auth Notice */}
            {isConfigured && isGoogleAuth && !googleAuthProvided && (
              <div className="bg-yellow-50 rounded-lg p-4 text-center">
                <p className="text-sm text-yellow-700">⚠️ Complete setup in Single Sign-On section</p>
              </div>
            )}
            
            {/* Credential Fields */}
            {isConfigured && selectedMethodDetails && !selectedMethodDetails.requiresSSO && (
              <div className="space-y-4">
                {selectedMethodDetails.requiredFields.map((field: any) => (
                  <div key={field.id}>
                    <label className="block text-sm text-gray-700 mb-2">{field.label}</label>
                    <input
                      type={field.masked ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onChange={(e) => {
                        if (e.target.value.trim()) {
                          setIsAuthProvided(true);
                        }
                      }}
                    />
                  </div>
                ))}
                <button 
                  type="button"
                  onClick={() => {
                    setIsAuthProvided(true);
                    onCredentialUpdate();
                  }}
                  className="w-full bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                >
                  Save
                </button>
              </div>
            )}
            
            {/* Success State */}
            {isConfigured && selectedMethodDetails?.requiresSSO && googleAuthProvided && (
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-sm text-green-700">✓ Ready</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SSOSection = ({ providers, workflowId, onCredentialUpdate, onSSOCredentialUpdate, ssoCredentialStatus }: any) => {
  const [saveStatus, setSaveStatus] = React.useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const [credentialData, setCredentialData] = React.useState<Record<string, Record<string, string>>>({});
  const [accountsMap, setAccountsMap] = React.useState<Record<string, Array<{id:string;display:string;credential_data:any}>>>({});
  const [accountSelectionStatus, setAccountSelectionStatus] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    // fetch existing accounts per provider
    providers.forEach(async (provider: any) => {
      const { CredentialStorage } = await import('@/lib/credentials/storage');
      const accounts = await CredentialStorage.listAccounts(provider.provider as any);
      setAccountsMap(prev => ({ ...prev, [provider.provider]: accounts }));
    });
  }, [providers]);

  if (!providers || providers.length === 0) {
    return null;
  }

  const handleSSOSave = async (providerKey: string) => {
    setSaveStatus(prev => ({ ...prev, [providerKey]: 'saving' }));
    
    try {
      const credentials = credentialData[providerKey] || {};
      
      // Save to Supabase via API
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType: providerKey, // Save as the provider key (e.g., 'google')
          authMethod: 'oauth',
          credentials,
          workflowId
        })
      });

      if (response.ok) {
        setSaveStatus(prev => ({ ...prev, [providerKey]: 'saved' }));
        onSSOCredentialUpdate(providerKey, true);
        
        // Trigger credential update
        onCredentialUpdate();
        
        // Reset to idle after 2 seconds
        setTimeout(() => {
          setSaveStatus(prev => ({ ...prev, [providerKey]: 'idle' }));
        }, 2000);
      } else {
        throw new Error('Failed to save credentials');
      }
    } catch (error) {
      console.error('Failed to save SSO credentials:', error);
      setSaveStatus(prev => ({ ...prev, [providerKey]: 'error' }));
      
      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveStatus(prev => ({ ...prev, [providerKey]: 'idle' }));
      }, 3000);
    }
  };

  const handleAccountSelection = async (providerKey: string, selectedAccount: any) => {
    if (!selectedAccount) return;
    
    try {
      // Show loading state
      setAccountSelectionStatus(prev => ({ ...prev, [providerKey]: true }));
      console.log('Selecting account:', selectedAccount.display, 'for', providerKey);
      
      // Set local state immediately for responsive UI
      setCredentialData(prev => ({
        ...prev,
        [providerKey]: selectedAccount.credential_data
      }));
      // Update parent status instead of local state
      onSSOCredentialUpdate(providerKey, true);
      
      // Save the selected account credentials to workflow-specific record
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serviceType: providerKey, // Save as the provider key (e.g., 'google')
          authMethod: 'oauth',
          credentials: selectedAccount.credential_data,
          workflowId
        })
      });

      if (response.ok) {
        console.log('Account selection saved successfully');
        onSSOCredentialUpdate(providerKey, true);
        
        // Wait a moment before refreshing workspace to ensure DB save is committed
        setTimeout(() => {
          onCredentialUpdate();
        }, 100);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Failed to save account selection:', errorData.error);
        throw new Error(errorData.error || 'Failed to save account selection');
      }
    } catch (error) {
      console.error('Error selecting account:', error);
      // Reset local state on error
      setCredentialData(prev => ({
        ...prev,
        [providerKey]: {}
      }));
      onSSOCredentialUpdate(providerKey, false);
    } finally {
      // Clear loading state
      setAccountSelectionStatus(prev => ({ ...prev, [providerKey]: false }));
    }
  };

  const handleInputChange = (providerKey: string, fieldId: string, value: string) => {
    setCredentialData(prev => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        [fieldId]: value
      }
    }));
  };

  return (
    <div className="space-y-4">
      {providers.map((provider: any) => {
        const providerKey = provider.provider;
        const status = saveStatus[providerKey] || 'idle';
        const isConfigured = provider.isConfigured || ssoCredentialStatus[providerKey];
        const accounts = accountsMap[providerKey] || [];
        const isSelectingAccount = accountSelectionStatus[providerKey] || false;
        
        return (
          <div key={providerKey} className="border border-gray-200 rounded-xl bg-white p-6">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-2xl">{provider.icon}</span>
              <div className="flex-1">
                <h5 className="font-medium text-gray-900">{provider.title}</h5>
                <p className="text-sm text-gray-500">{provider.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {isSelectingAccount && <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin"></div>}
                <div className={`w-3 h-3 rounded-full ${
                  isConfigured ? 'bg-green-500' : 'bg-gray-300'
                }`}></div>
              </div>
            </div>

            {/* Account reuse section */}
            {accounts.length > 0 && !isConfigured && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Use existing account
                </label>
                <select
                  onChange={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const selectedId = e.target.value;
                    const selectedAccount = accounts.find(acc => acc.id === selectedId);
                    await handleAccountSelection(providerKey, selectedAccount);
                  }}
                  disabled={isSelectingAccount}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                  <option value="">Choose existing account...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.display}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!isConfigured && (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-3">Or add new account:</div>
                {provider.credentialFields.map((field: any) => (
                  <div key={field.id}>
                    <label className="block text-sm text-gray-700 mb-2">{field.label}</label>
                    <input
                      type={field.masked ? 'password' : field.type || 'text'}
                      placeholder={field.placeholder}
                      value={credentialData[providerKey]?.[field.id] || ''}
                      onChange={(e) => handleInputChange(providerKey, field.id, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                ))}
                
                <button
                  type="button"
                  onClick={() => handleSSOSave(providerKey)}
                  disabled={status === 'saving'}
                  className={`w-full py-3 rounded-lg text-sm font-medium transition-colors ${
                    status === 'saving'
                      ? 'bg-blue-400 text-white cursor-not-allowed'
                      : status === 'saved'
                      ? 'bg-green-600 text-white'
                      : status === 'error'
                      ? 'bg-red-600 text-white'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {status === 'saving' ? 'Saving...' : 
                   status === 'saved' ? 'Saved!' :
                   status === 'error' ? 'Error - Try Again' : 'Save'}
                </button>
              </div>
            )}

            {isConfigured && (
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-sm text-green-700">✓ Configured</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface EnhancedCredentialPanelProps {
  isOpen: boolean;
  onClose: () => void;
  aefDocument: AEFDocument;
  onCredentialsUpdate: (isComplete: boolean, setCount: number, totalCount: number) => void;
}

const EnhancedCredentialPanel: React.FC<EnhancedCredentialPanelProps> = ({
  isOpen,
  onClose,
  aefDocument,
  onCredentialsUpdate
}) => {
  const [workspace, setWorkspace] = useState<CredentialWorkspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedApplications, setExpandedApplications] = useState(new Set<ServiceType>());
  const [ssoCredentialStatus, setSSOCredentialStatus] = useState<Record<string, boolean>>({});

  // Cache Supabase session for immediate availability
  const [sessionCache, setSessionCache] = React.useState<any>(null);
  
  React.useEffect(() => {
    // Cache session immediately on panel open
    if (isOpen) {
      import('@/lib/supabase-browser').then(({ createSupabaseClient }) => {
        const supabase = createSupabaseClient();
        supabase.auth.getSession().then(({ data: { session } }: { data: { session: any } }) => {
          setSessionCache(session);
        });
      }).catch(() => {
        // Fallback if supabase-browser module doesn't exist
        console.log('Supabase client not available for session caching');
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      initializeWorkspace();
    }
  }, [isOpen, aefDocument.meta.id]);

  const initializeWorkspace = async () => {
    setIsLoading(true);
    try {
      const credentialWorkspace = await buildCredentialWorkspace(aefDocument);
      
      // Debug: Log the workspace contents
      console.log('🔍 Workspace Debug:', {
        applications: credentialWorkspace.applications.map(app => ({
          service: app.service,
          title: app.title,
          isConfigured: app.isConfigured,
          selectedAuthMethod: app.selectedAuthMethod
        })),
        ssoProviders: credentialWorkspace.ssoProviders.map(sso => ({
          provider: sso.provider,
          title: sso.title,
          isConfigured: sso.isConfigured,
          usedByApplications: sso.usedByApplications
        })),
        totalRequired: credentialWorkspace.totalRequired,
        configuredCount: credentialWorkspace.configuredCount
      });
      
      setWorkspace(credentialWorkspace);
      
      // Calculate accurate completion status including local SSO state
      updateParentCompletionStatus(credentialWorkspace);
    } catch (error) {
      console.error('Failed to initialize workspace:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to calculate and update parent completion status
  const updateParentCompletionStatus = (
    currentWorkspace: CredentialWorkspace,
    localStatusOverride?: Record<string, boolean>
  ) => {
    const applications = currentWorkspace.applications;
    const ssoProviders = currentWorkspace.ssoProviders;

    // Source of truth for SSO status: override -> local state -> workspace state
    const effectiveStatus = localStatusOverride || ssoCredentialStatus;
    
    // Count configured applications (auth method selected = configured)
    const configuredApplications = applications.filter(app =>
      app.selectedAuthMethod || app.isConfigured
    ).length;

    // Count configured SSO providers (include all displayed providers)
    const usedSSOProviders = ssoProviders;
    const configuredSSO = usedSSOProviders.filter(sso => {
      const local = effectiveStatus[sso.provider];
      return local !== undefined ? local : sso.isConfigured;
    }).length;

    const totalRequired = applications.length + usedSSOProviders.length;
    const configuredCount = configuredApplications + configuredSSO;
    const isComplete = totalRequired > 0 && configuredCount === totalRequired;

    // Debug logging
    console.log('🔢 Parent Count Update:', {
      applications: applications.length,
      configuredApplications,
      ssoProviders: ssoProviders.length,
      configuredSSO,
      effectiveStatus,
      totalRequired,
      configuredCount,
      isComplete
    });

    // Update parent component with accurate completion status
    onCredentialsUpdate(isComplete, configuredCount, totalRequired);
  };

  const handleApplicationToggle = (service: ServiceType) => {
    const newExpanded = new Set(expandedApplications);
    if (newExpanded.has(service)) {
      newExpanded.delete(service);
    } else {
      newExpanded.add(service);
    }
    setExpandedApplications(newExpanded);
  };

  const handleAuthMethodChange = async (
    service: ServiceType,
    authMethod: AuthenticationMethod
  ) => {
    if (!workspace) return;

    // Update local state immediately for responsive UI
    const updatedApplications = workspace.applications.map(app => 
      app.service === service 
        ? { ...app, selectedAuthMethod: authMethod }
        : app
    );
    
    setWorkspace({
      ...workspace,
      applications: updatedApplications
    });

    // Immediately update parent count, then refresh workspace
    setTimeout(() => {
      updateParentCompletionStatus({
        ...workspace,
        applications: updatedApplications
      });
    }, 0);
    
    // Refresh workspace after a short delay to get updated configuration status
    setTimeout(() => {
      initializeWorkspace();
    }, 500);
  };

  const handleConfirmAuthMethod = async (service: ServiceType) => {
    if (!workspace) return;

    const application = workspace.applications.find(app => app.service === service);
    if (!application?.selectedAuthMethod) return;

    try {
      // Save the auth method selection (already done in auto-save, but ensure it's confirmed)
      await updateApplicationAuthMethod(workspace.workflowId, service, application.selectedAuthMethod);
      
      // Check if this auth method requires SSO and add the provider if needed
      const authMethod = application.supportedAuthMethods.find(m => m.method === application.selectedAuthMethod);
      if (authMethod?.requiresSSO) {
        const ssoProvider = authMethod.requiresSSO;
        
        // Check if SSO provider already exists
        const existingSSOProvider = workspace.ssoProviders.find(p => p.provider === ssoProvider);
        if (!existingSSOProvider) {
          // Add the new SSO provider
          const { SSO_PROVIDERS } = await import('@/lib/credentials/application-config');
          const newSSOConfig = SSO_PROVIDERS[ssoProvider as keyof typeof SSO_PROVIDERS];
          
          if (newSSOConfig) {
            const newSSOProvider = {
              ...newSSOConfig,
              usedByApplications: [service],
              isConfigured: false
            };
            
            setWorkspace({
              ...workspace,
              ssoProviders: [...workspace.ssoProviders, newSSOProvider]
            });
          }
        } else {
          // Update existing SSO provider to include this service
          const updatedSSOProviders = workspace.ssoProviders.map(provider =>
            provider.provider === ssoProvider
              ? {
                  ...provider,
                  usedByApplications: [...new Set([...provider.usedByApplications, service])]
                }
              : provider
          );
          
          setWorkspace({
            ...workspace,
            ssoProviders: updatedSSOProviders
          });
        }
      }
      
      // Refresh the workspace to get updated status
      await initializeWorkspace();
    } catch (error) {
      console.error('Failed to confirm auth method:', error);
    }
  };

  const handleCredentialUpdate = async () => {
    // Refresh workspace to get latest configuration status without unmounting
    setIsRefreshing(true);
    try {
      await initializeWorkspace();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSSOCredentialUpdate = (providerKey: string, isConfigured: boolean) => {
    setSSOCredentialStatus(prev => {
      const newStatus = { ...prev, [providerKey]: isConfigured };

      if (workspace) {
        const tempWorkspace = {
          ...workspace,
          ssoProviders: workspace.ssoProviders.map(sso =>
            sso.provider === providerKey ? { ...sso, isConfigured } : sso
          )
        };

        // Use override with freshest status to avoid state lag
        setTimeout(() => updateParentCompletionStatus(tempWorkspace, newStatus), 0);
      }

      return newStatus;
    });
  };

  const handleClearAll = async () => {
    if (!workspace) return;
    
    const confirmed = window.confirm(
      'Are you sure you want to clear all credentials? This action cannot be undone.'
    );
    
    if (confirmed) {
      // TODO: Implement clear all functionality
      console.log('Clear all credentials - TODO');
      await initializeWorkspace();
    }
  };

  // Prevent any form submission from causing page reload
  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-25 z-40"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-[500px] bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
        {/* Prevent any form submissions within this panel */}
        <form onSubmit={handleFormSubmit} className="flex flex-col h-full">
          {/* Panel Header */}
          <div className="p-8 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-light text-gray-900">Credentials</h3>
              <button 
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>
            
            {workspace && (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{workspace.workflowTitle}</p>
                
                {/* Overall status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      workspace.isComplete 
                        ? 'bg-green-500' 
                        : workspace.configuredCount > 0 
                          ? 'bg-yellow-500' 
                          : 'bg-gray-300'
                    }`}></div>
                    <span className="text-sm text-gray-700">
                      {workspace.configuredCount} of {workspace.totalRequired} configured
                    </span>
                  </div>
                  
                  {workspace.isComplete && (
                    <span className="text-xs text-green-600 font-medium">Ready</span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto relative">
            {/* Refresh overlay */}
            {isRefreshing && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-xs text-gray-600">Updating...</p>
                </div>
              </div>
            )}
            
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-center">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading...</p>
                </div>
              </div>
            ) : workspace ? (
              <div className="p-8 space-y-8">
                {/* Applications Section */}
                {workspace.applications.length > 0 && (
                  <div className="space-y-4">
                    {workspace.applications.map((app) => (
                      <ApplicationCard
                        key={app.service}
                        application={app}
                        isExpanded={expandedApplications.has(app.service)}
                        onToggle={() => handleApplicationToggle(app.service)}
                        onAuthMethodChange={(method: AuthenticationMethod) => handleAuthMethodChange(app.service, method)}
                        onConfirmAuthMethod={() => handleConfirmAuthMethod(app.service)}
                        onCredentialUpdate={handleCredentialUpdate}
                        workflowId={workspace.workflowId}
                        ssoCredentialStatus={ssoCredentialStatus}
                      />
                    ))}
                  </div>
                )}
                
                {/* SSO Section */}
                {workspace.ssoProviders.length > 0 && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Single Sign-On</h4>
                    <SSOSection
                      providers={workspace.ssoProviders}
                      workflowId={workspace.workflowId}
                      onCredentialUpdate={handleCredentialUpdate}
                      onSSOCredentialUpdate={handleSSOCredentialUpdate}
                      ssoCredentialStatus={ssoCredentialStatus}
                    />
                  </div>
                )}
                
                {/* Empty State */}
                {workspace.applications.length === 0 && workspace.ssoProviders.length === 0 && (
                  <div className="text-center py-16 text-gray-500">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🔑</span>
                    </div>
                    <p className="text-sm">No credentials required</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-gray-500">
                <p className="text-sm">Failed to load credentials</p>
              </div>
            )}
          </div>
          
          {/* Panel Footer */}
          {workspace && workspace.totalRequired > 0 && (
            <div className="p-8 border-t border-gray-200 flex-shrink-0">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="text-gray-600 border-gray-200 hover:bg-gray-50"
                >
                  Clear All
                </Button>
                
                <Button
                  type="button"
                  onClick={onClose}
                  size="sm"
                  className={workspace.isComplete ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'}
                >
                  {workspace.isComplete ? 'Ready' : 'Continue'}
                </Button>
              </div>
            </div>
          )}
        </form>
      </div>
    </>
  );
};

export default EnhancedCredentialPanel; 