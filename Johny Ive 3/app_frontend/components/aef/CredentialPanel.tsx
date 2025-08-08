'use client';

import React, { useState, useEffect } from 'react';
import { WorkflowCredential, CredentialGroup as CredentialGroupType, ServiceType, CredentialType } from '@/lib/types/aef';
import CredentialGroup from './CredentialGroup';
import { Button } from '@/components/ui/button';
import { CredentialStorage } from '@/lib/credentials/storage';
import { getAuthMethodsForService, getDefaultAuthMethod } from '@/lib/credentials/auth-methods';

interface CredentialPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  workflowTitle: string;
  requiredCredentials: WorkflowCredential[];
  onCredentialsUpdate: (isComplete: boolean, setCount: number, totalCount: number) => void;
}

const CredentialPanel: React.FC<CredentialPanelProps> = ({
  isOpen,
  onClose,
  workflowId,
  workflowTitle,
  requiredCredentials,
  onCredentialsUpdate
}) => {
  console.log('🔐 [CredentialPanel] Render - isOpen:', isOpen, 'requiredCredentials:', requiredCredentials?.length);
  const [credentialGroups, setCredentialGroups] = useState<CredentialGroupType[]>([]);
  const [groupValidations, setGroupValidations] = useState<Map<string, { isValid: boolean; setCount: number; totalCount: number }>>(new Map());

  useEffect(() => {
    if (isOpen) {
      initializeCredentialGroups();
    }
  }, [isOpen, requiredCredentials]);

  useEffect(() => {
    // Calculate overall validation state
    let totalSet = 0;
    let totalRequired = 0;
    let allValid = true;

    for (const validation of groupValidations.values()) {
      totalSet += validation.setCount;
      totalRequired += validation.totalCount;
      if (!validation.isValid) {
        allValid = false;
      }
    }

    onCredentialsUpdate(allValid && totalRequired > 0, totalSet, totalRequired);
  }, [groupValidations, onCredentialsUpdate]);

  const initializeCredentialGroups = () => {
    // Group credentials by service type
    const groupedCredentials = new Map<ServiceType, WorkflowCredential[]>();
    
    requiredCredentials.forEach(credential => {
      const existing = groupedCredentials.get(credential.serviceType) || [];
      groupedCredentials.set(credential.serviceType, [...existing, credential]);
    });

    // Create credential groups with metadata
    const groups: CredentialGroupType[] = [];
    
    for (const [serviceType, credentials] of groupedCredentials.entries()) {
      const group = createCredentialGroup(serviceType, credentials);
      groups.push(group);
    }

    // Sort groups by priority (required first, then alphabetically)
    groups.sort((a, b) => {
      if (a.requiredForExecution !== b.requiredForExecution) {
        return a.requiredForExecution ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    });

    setCredentialGroups(groups);
  };

  const createCredentialGroup = (serviceType: ServiceType, credentials: WorkflowCredential[]): CredentialGroupType => {
    const serviceMetadata = getServiceMetadata(serviceType);
    const hasRequiredCredentials = credentials.some(c => c.required);
    const supportedAuthMethods = getAuthMethodsForService(serviceType);
    const selectedAuthMethod = getDefaultAuthMethod(serviceType) || undefined;
    
    return {
      service: serviceType,
      icon: serviceMetadata.icon,
      title: serviceMetadata.title,
      description: serviceMetadata.description,
      credentials,
      allSet: false, // Will be calculated dynamically
      requiredForExecution: hasRequiredCredentials,
      supportedAuthMethods,
      selectedAuthMethod
    };
  };

  const getServiceMetadata = (serviceType: ServiceType) => {
    switch (serviceType) {
      case ServiceType.GMAIL:
        return {
          icon: '📧',
          title: 'Gmail Authentication',
          description: 'Access your Gmail inbox and email management'
        };
      case ServiceType.AIRTABLE:
        return {
          icon: '🗃️',
          title: 'Airtable CRM',
          description: 'Connect to your CRM database and tables'
        };
      case ServiceType.OAUTH:
        return {
          icon: '🔐',
          title: 'OAuth Services',
          description: 'Third-party service authentication'
        };
      case ServiceType.CUSTOM:
        return {
          icon: '⚙️',
          title: 'Custom Credentials',
          description: 'Application-specific authentication'
        };
      default:
        return {
          icon: '🔑',
          title: 'Authentication',
          description: 'Service authentication credentials'
        };
    }
  };

  const handleCredentialChange = (credentialId: string, value: string) => {
    // Credential changes are handled by individual fields and stored automatically
    console.log('Credential changed:', credentialId, value ? '[REDACTED]' : '[EMPTY]');
  };

  const handleGroupValidation = (groupService: string, isValid: boolean, setCount: number, totalCount: number) => {
    setGroupValidations(prev => new Map(prev.set(groupService, { isValid, setCount, totalCount })));
  };

  const handleClearAllCredentials = async () => {
    if (confirm('Are you sure you want to clear all credentials for this workflow? This action cannot be undone.')) {
      try {
        await CredentialStorage.clearCredentials(workflowId);
        // Refresh the panel
        initializeCredentialGroups();
      } catch (error) {
        console.error('Failed to clear credentials:', error);
      }
    }
  };

  const getTotalCredentialCount = () => {
    let totalSet = 0;
    let totalRequired = 0;

    for (const validation of groupValidations.values()) {
      totalSet += validation.setCount;
      totalRequired += validation.totalCount;
    }

    return { set: totalSet, total: totalRequired };
  };

  const credentialCount = getTotalCredentialCount();
  const isAllValid = Array.from(groupValidations.values()).every(v => v.isValid) && credentialCount.total > 0;

  if (!isOpen) {
    console.log('🔐 [CredentialPanel] Not rendering - isOpen is false');
    return null;
  }
  
  console.log('🔐 [CredentialPanel] RENDERING PANEL - isOpen:', isOpen);

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl border-l border-gray-200 z-50 flex flex-col">
        {/* Panel Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Workflow Credentials</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-2">
            <p className="text-sm text-gray-600 font-medium">{workflowTitle}</p>
            
            {/* Overall status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isAllValid ? 'bg-green-500' : credentialCount.set > 0 ? 'bg-amber-500' : 'bg-gray-400'}`}></div>
                <span className="text-sm text-gray-700">
                  {credentialCount.set}/{credentialCount.total} credentials configured
                </span>
              </div>
              
              {isAllValid && (
                <div className="text-xs text-green-600 font-medium bg-green-50 px-2 py-1 rounded">
                  Ready to Execute
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {credentialGroups.length > 0 ? (
            credentialGroups.map((group) => (
              <CredentialGroup
                key={group.service}
                group={group}
                workflowId={workflowId}
                onCredentialChange={handleCredentialChange}
                onGroupValidation={handleGroupValidation}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🔑</span>
              </div>
              <p className="text-sm">No credentials required for this workflow</p>
            </div>
          )}
        </div>
        
        {/* Panel Footer */}
        {credentialGroups.length > 0 && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllCredentials}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                Clear All
              </Button>
              
              <Button
                onClick={onClose}
                size="sm"
                className={isAllValid ? 'bg-green-600 hover:bg-green-700' : ''}
              >
                {isAllValid ? 'Ready to Execute' : 'Continue Setup'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default CredentialPanel; 