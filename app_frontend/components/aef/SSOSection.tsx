'use client';

import React, { useState } from 'react';
import { SSOCredential } from '@/lib/types/aef';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SSOSectionProps {
  providers: SSOCredential[];
  workflowId: string;
  onCredentialUpdate: () => void;
}

const SSOSection: React.FC<SSOSectionProps> = ({
  providers,
  workflowId,
  onCredentialUpdate
}) => {
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set());

  const toggleProvider = (providerId: string) => {
    const newExpanded = new Set(expandedProviders);
    if (newExpanded.has(providerId)) {
      newExpanded.delete(providerId);
    } else {
      newExpanded.add(providerId);
    }
    setExpandedProviders(newExpanded);
  };

  if (providers.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600 mb-4">
        Configure your SSO accounts that can be used across multiple applications.
      </p>
      
      {providers.map((provider) => (
        <div key={provider.provider} className="border border-gray-200 rounded-lg bg-white shadow-sm">
          {/* Provider Header */}
          <div 
            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
            onClick={() => toggleProvider(provider.provider)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{provider.icon}</span>
                <div>
                  <h6 className="font-medium text-gray-900">{provider.title}</h6>
                  <p className="text-sm text-gray-600">{provider.description}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Configuration Status */}
                <div className={`w-2 h-2 rounded-full ${
                  provider.isConfigured ? 'bg-green-500' : 'bg-gray-400'
                }`}></div>
                
                {/* Used By Badge */}
                {provider.usedByApplications.length > 0 && (
                  <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                    Used by {provider.usedByApplications.length} app{provider.usedByApplications.length !== 1 ? 's' : ''}
                  </span>
                )}
                
                {/* Expand/Collapse Icon */}
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 16 16" 
                  fill="currentColor"
                  className={`transform transition-transform ${
                    expandedProviders.has(provider.provider) ? 'rotate-180' : ''
                  }`}
                >
                  <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Provider Content - Expanded */}
          {expandedProviders.has(provider.provider) && (
            <div className="px-4 pb-4 border-t border-gray-100">
              <div className="pt-4 space-y-4">
                {/* Used By Applications */}
                {provider.usedByApplications.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-2 block">
                      Used by Applications
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {provider.usedByApplications.map((app) => (
                        <span 
                          key={app}
                          className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                        >
                          {app.charAt(0).toUpperCase() + app.slice(1)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Credential Fields */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-700">
                    Account Credentials
                  </Label>
                  
                  {provider.credentialFields.map((field) => (
                    <div key={field.id} className="space-y-1">
                      <Label htmlFor={field.id} className="text-sm text-gray-700">
                        {field.label}
                      </Label>
                      <Input
                        id={field.id}
                        type={field.masked ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        className="w-full"
                      />
                      {field.helpText && (
                        <p className="text-xs text-gray-500">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                  
                  <Button 
                    size="sm" 
                    className="w-full mt-3"
                    onClick={onCredentialUpdate}
                  >
                    Save {provider.title} Account
                  </Button>
                </div>
                
                {/* SSO Info */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500">ℹ️</span>
                    <span className="text-sm font-medium text-blue-900">
                      SSO Account
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    This account will be used for single sign-on authentication across 
                    multiple applications in your workflow.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default SSOSection; 