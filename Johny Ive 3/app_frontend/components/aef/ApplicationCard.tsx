'use client';

import React, { useState } from 'react';
import { 
  ApplicationCredential, 
  AuthenticationMethod,
  ApplicationAuthMethod 
} from '@/lib/types/aef';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ApplicationCardProps {
  application: ApplicationCredential;
  isExpanded: boolean;
  onToggle: () => void;
  onAuthMethodChange: (method: AuthenticationMethod) => void;
  onConfirmAuthMethod?: () => void;
  onCredentialUpdate: () => void;
  workflowId: string;
}

const ApplicationCard: React.FC<ApplicationCardProps> = ({
  application,
  isExpanded,
  onToggle,
  onAuthMethodChange,
  onConfirmAuthMethod,
  onCredentialUpdate,
  workflowId
}) => {
  const [selectedMethod, setSelectedMethod] = useState<AuthenticationMethod | null>(
    application.selectedAuthMethod || null
  );

  const handleMethodSelect = (method: AuthenticationMethod) => {
    setSelectedMethod(method);
    onAuthMethodChange(method);
  };

  const getSelectedAuthMethod = (): ApplicationAuthMethod | null => {
    if (!selectedMethod) return null;
    return application.supportedAuthMethods.find(m => m.method === selectedMethod) || null;
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white shadow-sm">
      {/* Card Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">{application.icon}</span>
            <div>
              <h5 className="font-medium text-gray-900">{application.title}</h5>
              <p className="text-sm text-gray-600">{application.description}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Configuration Status */}
            <div className={`w-2 h-2 rounded-full ${
              application.isConfigured ? 'bg-green-500' : 'bg-gray-400'
            }`}></div>
            
            {/* Required Badge */}
            {application.isRequired && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Required
              </span>
            )}
            
            {/* Expand/Collapse Icon */}
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 16 16" 
              fill="currentColor"
              className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            >
              <path d="M4.427 7.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 7H4.604a.25.25 0 00-.177.427z"/>
            </svg>
          </div>
        </div>
      </div>
      
      {/* Card Content - Expanded */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="pt-4 space-y-4">
            {/* Authentication Method Selection */}
            <div>
              <Label className="text-sm font-medium text-gray-700 mb-2 block">
                Authentication Method
              </Label>
              <div className="space-y-2">
                {application.supportedAuthMethods.map((method) => (
                  <div key={method.method} className="flex items-center gap-3">
                    <input
                      type="radio"
                      id={`${application.service}-${method.method}`}
                      name={`${application.service}-auth-method`}
                      checked={selectedMethod === method.method}
                      onChange={() => handleMethodSelect(method.method)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <label 
                      htmlFor={`${application.service}-${method.method}`}
                      className="flex-1 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span>{method.icon}</span>
                        <span className="text-sm font-medium text-gray-900">
                          {method.label}
                        </span>
                        {method.isDefault && (
                          <span className="text-xs bg-green-100 text-green-800 px-1 py-0.5 rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {method.description}
                      </p>
                    </label>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Auth Method Configuration Button */}
            {selectedMethod && selectedMethod !== application.selectedAuthMethod && (
              <div className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-500">ℹ️</span>
                    <span className="text-sm font-medium text-blue-900">
                      Authentication method selected
                    </span>
                  </div>
                  <p className="text-xs text-blue-700 mt-1">
                    Click "Configure {getSelectedAuthMethod()?.label}" to apply this authentication method.
                    {getSelectedAuthMethod()?.requiresSSO && (
                      <span className="block mt-1 font-medium">
                        This will also add {getSelectedAuthMethod()?.requiresSSO} to the SSO section.
                      </span>
                    )}
                  </p>
                </div>
                
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={onConfirmAuthMethod}
                >
                  Configure {getSelectedAuthMethod()?.label}
                </Button>
              </div>
            )}

            {/* Credential Fields for Selected Method */}
            {selectedMethod && selectedMethod === application.selectedAuthMethod && getSelectedAuthMethod() && (
              <div className="space-y-3">
                <Label className="text-sm font-medium text-gray-700">
                  Credential Information
                </Label>
                
                {getSelectedAuthMethod()?.requiredFields.map((field) => (
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
                  Save Credentials
                </Button>
              </div>
            )}
            
            {/* SSO Notice */}
            {selectedMethod && getSelectedAuthMethod()?.requiresSSO && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <span className="text-purple-500">🔐</span>
                  <span className="text-sm font-medium text-purple-900">
                    SSO Authentication Required
                  </span>
                </div>
                <p className="text-xs text-purple-700 mt-1">
                  This method requires {getSelectedAuthMethod()?.requiresSSO} account credentials 
                  in the Single Sign-On section below.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationCard; 