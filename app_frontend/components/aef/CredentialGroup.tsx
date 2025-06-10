'use client';

import React, { useState, useEffect } from 'react';
import { CredentialGroup as CredentialGroupType, WorkflowCredential, AuthenticationMethod } from '@/lib/types/aef';
import CredentialField from './CredentialField';
import AuthMethodSelector from './AuthMethodSelector';
import { CredentialStorage } from '@/lib/credentials/storage';
import { getDefaultAuthMethod, getRequiredFieldsForAuthMethod, getPotentialCredentialSources, getSharedOAuthCredentialId, canShareOAuthCredentials } from '@/lib/credentials/auth-methods';

interface CredentialGroupProps {
  group: CredentialGroupType;
  workflowId: string;
  onCredentialChange: (credentialId: string, value: string) => void;
  onGroupValidation: (groupService: string, isValid: boolean, setCount: number, totalCount: number) => void;
}

const CredentialGroup: React.FC<CredentialGroupProps> = ({
  group,
  workflowId,
  onCredentialChange,
  onGroupValidation
}) => {
  const [credentialValues, setCredentialValues] = useState<Map<string, string>>(new Map());
  const [validationStates, setValidationStates] = useState<Map<string, boolean>>(new Map());
  const [isExpanded, setIsExpanded] = useState(!group.allSet);
  const [selectedAuthMethod, setSelectedAuthMethod] = useState<AuthenticationMethod | undefined>(undefined);
  const [sharedCredentialSources, setSharedCredentialSources] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const defaultMethod = getDefaultAuthMethod(group.service);
    if (defaultMethod && !selectedAuthMethod) {
      setSelectedAuthMethod(defaultMethod);
    }
    loadCredentialValues();
    checkForSharedCredentials();
  }, [group.credentials, workflowId, group.service, selectedAuthMethod]);

  useEffect(() => {
    const visibleCredentials = getVisibleCredentials();
    const requiredCredentials = visibleCredentials.filter(c => c.required);
    const validCredentials = requiredCredentials.filter(c => 
      validationStates.get(c.id) && credentialValues.get(c.id)?.trim()
    );
    
    const isGroupValid = validCredentials.length === requiredCredentials.length;
    onGroupValidation(group.service, isGroupValid, validCredentials.length, requiredCredentials.length);
  }, [validationStates, credentialValues, group.credentials, group.service, onGroupValidation, selectedAuthMethod]);

  const checkForSharedCredentials = async () => {
    if (!selectedAuthMethod) return;
    
    const sources = new Map<string, string>();
    const potentialSources = getPotentialCredentialSources(group.service, selectedAuthMethod);
    
    for (const sourceService of potentialSources) {
      const sharedCredentialId = getSharedOAuthCredentialId(selectedAuthMethod);
      try {
        const existingValue = await CredentialStorage.retrieve(workflowId, sharedCredentialId);
        if (existingValue) {
          sources.set(sharedCredentialId, `${sourceService} (already configured)`);
        }
      } catch (error) {
        // Credential doesn't exist, which is fine
      }
    }
    
    setSharedCredentialSources(sources);
  };

  const getVisibleCredentials = (): WorkflowCredential[] => {
    if (!selectedAuthMethod) return group.credentials;
    
    const requiredFields = getRequiredFieldsForAuthMethod(group.service, selectedAuthMethod);
    if (requiredFields.length === 0) return group.credentials;
    
    return group.credentials.filter(credential => 
      credential.authMethod === selectedAuthMethod ||
      requiredFields.includes(credential.type)
    );
  };

  const loadCredentialValues = async () => {
    const values = new Map<string, string>();
    const validations = new Map<string, boolean>();
    
    for (const credential of group.credentials) {
      try {
        const value = await CredentialStorage.retrieve(workflowId, credential.id);
        if (value) {
          values.set(credential.id, value);
          validations.set(credential.id, true);
        } else {
          validations.set(credential.id, !credential.required);
        }
      } catch (error) {
        console.error(`Failed to load credential ${credential.id}:`, error);
        validations.set(credential.id, !credential.required);
      }
    }
    
    setCredentialValues(values);
    setValidationStates(validations);
  };

  const handleCredentialChange = (credentialId: string, value: string) => {
    setCredentialValues(prev => new Map(prev.set(credentialId, value)));
    onCredentialChange(credentialId, value);
  };

  const handleCredentialValidation = (credentialId: string, isValid: boolean) => {
    setValidationStates(prev => new Map(prev.set(credentialId, isValid)));
  };

  const handleAuthMethodChange = (method: AuthenticationMethod) => {
    setSelectedAuthMethod(method);
    checkForSharedCredentials();
    
    const requiredFields = getRequiredFieldsForAuthMethod(group.service, method);
    if (requiredFields.length > 0) {
      const newCredentialValues = new Map(credentialValues);
      const newValidationStates = new Map(validationStates);
      
      group.credentials.forEach(credential => {
        if (credential.authMethod !== method && !requiredFields.includes(credential.type)) {
          newCredentialValues.delete(credential.id);
          newValidationStates.set(credential.id, true);
        }
      });
      
      setCredentialValues(newCredentialValues);
      setValidationStates(newValidationStates);
    }
  };

  const getGroupStatusColor = (): string => {
    if (group.allSet) return 'text-green-600';
    
    const visibleCredentials = getVisibleCredentials();
    const requiredCredentials = visibleCredentials.filter(c => c.required);
    const setCredentials = requiredCredentials.filter(c => 
      validationStates.get(c.id) && credentialValues.get(c.id)?.trim()
    );
    
    if (setCredentials.length === 0) return 'text-gray-500';
    if (setCredentials.length < requiredCredentials.length) return 'text-amber-600';
    return 'text-green-600';
  };

  const getGroupStatusIcon = (): string => {
    if (group.allSet) return '✓';
    
    const visibleCredentials = getVisibleCredentials();
    const requiredCredentials = visibleCredentials.filter(c => c.required);
    const setCredentials = requiredCredentials.filter(c => 
      validationStates.get(c.id) && credentialValues.get(c.id)?.trim()
    );
    
    if (setCredentials.length === 0) return '○';
    if (setCredentials.length < requiredCredentials.length) return '◐';
    return '✓';
  };

  const getCredentialCount = (): { set: number; total: number } => {
    const visibleCredentials = getVisibleCredentials();
    const requiredCredentials = visibleCredentials.filter(c => c.required);
    const setCredentials = requiredCredentials.filter(c => 
      validationStates.get(c.id) && credentialValues.get(c.id)?.trim()
    );
    
    return {
      set: setCredentials.length,
      total: requiredCredentials.length
    };
  };

  const credentialCount = getCredentialCount();
  const visibleCredentials = getVisibleCredentials();

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div 
        className="p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg">{group.icon}</span>
            <div>
              <h4 className="text-sm font-semibold text-gray-900">{group.title}</h4>
              <p className="text-xs text-gray-600">{group.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 text-sm ${getGroupStatusColor()}`}>
              <span className="font-mono text-xs">{getGroupStatusIcon()}</span>
              <span className="font-medium">
                {credentialCount.set}/{credentialCount.total}
              </span>
            </div>
            
            <div className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 6l4 4 4-4H4z"/>
              </svg>
            </div>
          </div>
        </div>
        
        {group.requiredForExecution && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded inline-block">
            Required for execution
          </div>
        )}
        
        {sharedCredentialSources.size > 0 && selectedAuthMethod && (
          <div className="mt-2 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded inline-block">
            🔗 Can reuse credentials from other services
          </div>
        )}
      </div>
      
      {isExpanded && (
        <div className="p-4 space-y-4 bg-white">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Authentication Method
            </label>
            <AuthMethodSelector
              serviceType={group.service}
              selectedMethod={selectedAuthMethod}
              onMethodChange={handleAuthMethodChange}
            />
            
            {sharedCredentialSources.size > 0 && selectedAuthMethod && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-start gap-2">
                  <div className="text-blue-500 mt-0.5">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0a8 8 0 100 16A8 8 0 008 0zM7 4a1 1 0 112 0v4a1 1 0 11-2 0V4zm1 8a1 1 0 100-2 1 1 0 000 2z"/>
                    </svg>
                  </div>
                  <div className="text-sm">
                    <div className="font-medium text-blue-700">Existing credentials detected</div>
                    <div className="text-blue-600 mt-1">
                      Your Google credentials from Gmail can be reused for Airtable authentication. 
                      No additional setup required!
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {visibleCredentials.map((credential) => (
            <CredentialField
              key={credential.id}
              credential={{
                ...credential,
                isSet: !!credentialValues.get(credential.id)?.trim()
              }}
              workflowId={workflowId}
              value={credentialValues.get(credential.id) || ''}
              onChange={handleCredentialChange}
              onValidation={handleCredentialValidation}
            />
          ))}
          
          {visibleCredentials.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No credentials required for this authentication method
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CredentialGroup; 