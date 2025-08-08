'use client';

import React, { useState, useEffect } from 'react';
import { WorkflowCredential, CredentialType } from '@/lib/types/aef';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CredentialStorage } from '@/lib/credentials/storage';

interface CredentialFieldProps {
  credential: WorkflowCredential;
  workflowId: string;
  value?: string;
  onChange: (credentialId: string, value: string) => void;
  onValidation: (credentialId: string, isValid: boolean) => void;
}

const CredentialField: React.FC<CredentialFieldProps> = ({
  credential,
  workflowId,
  value = '',
  onChange,
  onValidation
}) => {
  const [inputValue, setInputValue] = useState(value);
  const [showPassword, setShowPassword] = useState(false);
  const [isValid, setIsValid] = useState(true);
  const [validationMessage, setValidationMessage] = useState('');

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const validateInput = (val: string): boolean => {
    if (credential.required && !val.trim()) {
      setValidationMessage('This field is required');
      return false;
    }

    if (credential.validationPattern && val.trim()) {
      const regex = new RegExp(credential.validationPattern);
      if (!regex.test(val)) {
        setValidationMessage('Invalid format');
        return false;
      }
    }

    // Type-specific validation
    if (credential.type === CredentialType.EMAIL && val.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        setValidationMessage('Please enter a valid email address');
        return false;
      }
    }

    setValidationMessage('');
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    const valid = validateInput(newValue);
    setIsValid(valid);
    onValidation(credential.id, valid);
    onChange(credential.id, newValue);
  };

  const handleBlur = async () => {
    if (inputValue.trim() && isValid) {
      try {
        await CredentialStorage.store(workflowId, credential.id, inputValue);
      } catch (error) {
        console.error('Failed to store credential:', error);
      }
    }
  };

  const getInputType = (): string => {
    switch (credential.type) {
      case CredentialType.PASSWORD:
        return showPassword ? 'text' : 'password';
      case CredentialType.EMAIL:
        return 'email';
      case CredentialType.URL:
        return 'url';
      default:
        return 'text';
    }
  };

  const getPlaceholder = (): string => {
    if (credential.placeholder) return credential.placeholder;
    
    switch (credential.type) {
      case CredentialType.EMAIL:
        return 'your.email@example.com';
      case CredentialType.API_KEY:
        return 'Enter your API key';
      case CredentialType.PASSWORD:
        return 'Enter your password';
      case CredentialType.URL:
        return 'https://example.com';
      default:
        return `Enter ${credential.label.toLowerCase()}`;
    }
  };

  const shouldShowValue = (): boolean => {
    if (credential.type === CredentialType.PASSWORD) {
      return showPassword;
    }
    return !credential.masked;
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={credential.id} className="text-sm font-medium text-gray-700">
          {credential.label}
          {credential.required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        {credential.type === CredentialType.PASSWORD && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? 'Hide' : 'Show'}
          </Button>
        )}
      </div>
      
      <div className="relative">
        <Input
          id={credential.id}
          type={getInputType()}
          value={shouldShowValue() ? inputValue : '••••••••'}
          onChange={handleInputChange}
          onBlur={handleBlur}
          placeholder={getPlaceholder()}
          className={`
            ${!isValid ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300'}
            ${credential.isSet ? 'bg-green-50 border-green-300' : ''}
            transition-colors duration-200
          `}
          readOnly={credential.masked && !shouldShowValue()}
          onFocus={() => {
            if (credential.masked && credential.type === CredentialType.PASSWORD) {
              setShowPassword(true);
            }
          }}
        />
        
        {credential.isSet && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        )}
      </div>
      
      {/* Validation message */}
      {!isValid && validationMessage && (
        <p className="text-xs text-red-600">{validationMessage}</p>
      )}
      
      {/* Help text */}
      {credential.helpText && (
        <p className="text-xs text-gray-500">{credential.helpText}</p>
      )}
      
      {/* Required steps indicator */}
      {credential.requiredForSteps.length > 0 && (
        <div className="text-xs text-gray-500">
          Required for: {credential.requiredForSteps.slice(0, 2).join(', ')}
          {credential.requiredForSteps.length > 2 && ` +${credential.requiredForSteps.length - 2} more`}
        </div>
      )}
    </div>
  );
};

export default CredentialField; 