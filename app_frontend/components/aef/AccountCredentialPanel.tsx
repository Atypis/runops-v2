'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AccountAccess, ServiceSetting, EnhancedCredentialGroup, AccountProvider } from '@/lib/types/aef';
import { CredentialStorage } from '@/lib/credentials/storage';
import CredentialField from './CredentialField';

interface AccountCredentialPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string;
  workflowTitle: string;
  requiredAccounts: AccountAccess[];
  serviceGroups: EnhancedCredentialGroup[];
  onCredentialsUpdate: (isComplete: boolean, setCount: number, totalCount: number) => void;
}

const AccountCredentialPanel: React.FC<AccountCredentialPanelProps> = ({
  isOpen,
  onClose,
  workflowId,
  workflowTitle,
  requiredAccounts,
  serviceGroups,
  onCredentialsUpdate
}) => {
  if (!isOpen) return null;

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
            <h3 className="text-lg font-semibold text-gray-900">New Account-Based Auth</h3>
            <button 
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 hover:bg-gray-100 rounded"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
          
          <p className="text-sm text-gray-600">{workflowTitle}</p>
        </div>
        
        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Account Access Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              🔐 Account Access
            </h4>
            
            {requiredAccounts.map((account) => (
              <div key={account.id} className="border border-gray-200 rounded-lg p-4 mb-3">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xl">{account.icon}</span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">{account.label}</div>
                    <div className="text-xs text-gray-600">{account.description}</div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {account.credentialFields.map((field) => (
                    <div key={field.fieldType} className="space-y-1">
                      <label className="block text-xs font-medium text-gray-700">
                        {field.label}
                      </label>
                      <input
                        type={field.masked ? 'password' : 'text'}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500">{field.helpText}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Service Configuration Section */}
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              ⚙️ Service Configuration
            </h4>
            
            {serviceGroups.map((serviceGroup) => {
              const requiredAccount = requiredAccounts.find(acc => acc.provider === serviceGroup.requiredAccount);
              
              return (
                <div key={serviceGroup.service} className="border border-gray-200 rounded-lg p-4 mb-3">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{serviceGroup.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{serviceGroup.title}</div>
                      <div className="text-xs text-gray-600">{serviceGroup.description}</div>
                      {requiredAccount && (
                        <div className="text-xs text-blue-600 mt-1">
                          Uses {requiredAccount.label} for authentication
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {serviceGroup.serviceSettings.length > 0 ? (
                    <div className="space-y-3">
                      {serviceGroup.serviceSettings.map((setting) => (
                        <div key={setting.id} className="space-y-1">
                          <label className="block text-xs font-medium text-gray-700">
                            {setting.label} {setting.required && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type="text"
                            placeholder={setting.placeholder}
                            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          {setting.helpText && (
                            <p className="text-xs text-gray-500">{setting.helpText}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      ✓ No additional configuration required
                      {requiredAccount && (
                        <div className="text-xs text-blue-600 mt-1">
                          Uses your {requiredAccount.label} for authentication
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Panel Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <Button onClick={onClose} className="w-full">
            Continue with Current Setup
          </Button>
        </div>
      </div>
    </>
  );
};

export default AccountCredentialPanel; 