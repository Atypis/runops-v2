'use client';

import React, { useState, useEffect } from 'react';
import { CredentialGroup as CredentialGroupType, WorkflowCredential } from '@/lib/types/aef';
import CredentialField from './CredentialField';
import { CredentialStorage } from '@/lib/credentials/storage';

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

  useEffect(() => {
    loadCredentialValues();
  }, [group.credentials, workflowId]);

  useEffect(() => {
    // Calculate group validation state
    const requiredCredentials = group.credentials.filter(c => c.required);
    const validCredentials = requiredCredentials.filter(c => 
      validationStates.get(c.id) && credentialValues.get(c.id)?.trim()
    );
    
    const isGroupValid = validCredentials.length === requiredCredentials.length;
    onGroupValidation(group.service, isGroupValid, validCredentials.length, requiredCredentials.length);
  }, [validationStates, credentialValues, group.credentials, group.service, onGroupValidation]);

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

  const getGroupStatusColor = (): string => {
    if (group.allSet) return 'text-green-600';
    
    const requiredCredentials = group.credentials.filter(c => c.required);
    const setCredentials = requiredCredentials.filter(c => 
      validationStates.get(c.id) && credentialValues.get(c.id)?.trim()
    );
    
    if (setCredentials.length === 0) return 'text-gray-500';
    if (setCredentials.length < requiredCredentials.length) return 'text-amber-600';
    return 'text-green-600';
  };

  const getGroupStatusIcon = (): string => {
    if (group.allSet) return '✓';
    
    const requiredCredentials = group.credentials.filter(c => c.required);
    const setCredentials = requiredCredentials.filter(c => 
      validationStates.get(c.id) && credentialValues.get(c.id)?.trim()
    );
    
    if (setCredentials.length === 0) return '○';
    if (setCredentials.length < requiredCredentials.length) return '◐';
    return '✓';
  };

  const getCredentialCount = (): { set: number; total: number } => {
    const requiredCredentials = group.credentials.filter(c => c.required);
    const setCredentials = requiredCredentials.filter(c => 
      validationStates.get(c.id) && credentialValues.get(c.id)?.trim()
    );
    
    return {
      set: setCredentials.length,
      total: requiredCredentials.length
    };
  };

  const credentialCount = getCredentialCount();

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Group Header */}
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
            {/* Status indicator */}
            <div className={`flex items-center gap-2 text-sm ${getGroupStatusColor()}`}>
              <span className="font-mono text-xs">{getGroupStatusIcon()}</span>
              <span className="font-medium">
                {credentialCount.set}/{credentialCount.total}
              </span>
            </div>
            
            {/* Expand/collapse arrow */}
            <div className={`text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 6l4 4 4-4H4z"/>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Required for execution indicator */}
        {group.requiredForExecution && (
          <div className="mt-2 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded inline-block">
            Required for execution
          </div>
        )}
      </div>
      
      {/* Group Content */}
      {isExpanded && (
        <div className="p-4 space-y-4 bg-white">
          {group.credentials.map((credential) => (
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
          
          {group.credentials.length === 0 && (
            <div className="text-center py-4 text-gray-500 text-sm">
              No credentials required for this service
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CredentialGroup; 