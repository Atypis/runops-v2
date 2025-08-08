'use client';

import React from 'react';
import { Lock, Unlock, Shield, Key, AlertCircle } from 'lucide-react';

export interface CredentialIndicatorProps {
  status: 'none' | 'missing' | 'partial' | 'complete';
  requiredCount: number;
  configuredCount: number;
  onClick?: () => void;
  className?: string;
}

/**
 * Visual indicator for credential status on workflow nodes
 */
export const CredentialIndicator: React.FC<CredentialIndicatorProps> = ({
  status,
  requiredCount,
  configuredCount,
  onClick,
  className = ''
}) => {
  if (status === 'none') {
    return null; // Don't render anything if no credentials required
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'missing':
        return {
          icon: Lock,
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300',
          textColor: 'text-red-700',
          iconColor: 'text-red-600',
          label: 'Missing credentials'
        };
      case 'partial':
        return {
          icon: Key,
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-300',
          textColor: 'text-yellow-700',
          iconColor: 'text-yellow-600',
          label: 'Partial credentials'
        };
      case 'complete':
        return {
          icon: Shield,
          bgColor: 'bg-green-100',
          borderColor: 'border-green-300',
          textColor: 'text-green-700',
          iconColor: 'text-green-600',
          label: 'All credentials configured'
        };
      default:
        return {
          icon: AlertCircle,
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-700',
          iconColor: 'text-gray-600',
          label: 'Unknown status'
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div
      className={`
        absolute -top-2 -right-2 flex items-center gap-1 px-2 py-1 
        rounded-full border-2 text-xs font-medium cursor-pointer
        transition-all duration-200 hover:scale-105 shadow-sm
        ${config.bgColor} ${config.borderColor} ${config.textColor}
        ${className}
      `}
      onClick={onClick}
      title={`${config.label}: ${configuredCount}/${requiredCount} configured`}
    >
      <IconComponent className={`w-3 h-3 ${config.iconColor}`} />
      <span className="font-semibold">
        {configuredCount}/{requiredCount}
      </span>
    </div>
  );
};

/**
 * Compact credential indicator for smaller nodes
 */
export const CompactCredentialIndicator: React.FC<CredentialIndicatorProps> = ({
  status,
  requiredCount,
  configuredCount,
  onClick,
  className = ''
}) => {
  if (status === 'none') {
    return null;
  }

  const getStatusConfig = () => {
    switch (status) {
      case 'missing':
        return {
          color: 'bg-red-500',
          pulse: 'animate-pulse'
        };
      case 'partial':
        return {
          color: 'bg-yellow-500',
          pulse: ''
        };
      case 'complete':
        return {
          color: 'bg-green-500',
          pulse: ''
        };
      default:
        return {
          color: 'bg-gray-500',
          pulse: ''
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`
        absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white
        cursor-pointer transition-all duration-200 hover:scale-110 shadow-sm
        ${config.color} ${config.pulse} ${className}
      `}
      onClick={onClick}
      title={`Credentials: ${configuredCount}/${requiredCount} configured`}
    />
  );
};

/**
 * Tooltip component for credential details
 */
export const CredentialTooltip: React.FC<{
  status: CredentialIndicatorProps['status'];
  requiredCredentials: string[];
  configuredCredentials: string[];
  missingCredentials: string[];
}> = ({ status, requiredCredentials, configuredCredentials, missingCredentials }) => {
  if (status === 'none') return null;

  return (
    <div className="bg-white border rounded-lg shadow-lg p-3 max-w-xs">
      <div className="mb-2">
        <span className="font-medium text-gray-900">Credential Status</span>
      </div>
      
      {configuredCredentials.length > 0 && (
        <div className="mb-2">
          <div className="text-sm font-medium text-green-700 mb-1">✅ Configured:</div>
          <ul className="text-xs text-green-600 pl-2">
            {configuredCredentials.map(cred => (
              <li key={cred}>• {cred.replace(/_/g, ' ')}</li>
            ))}
          </ul>
        </div>
      )}
      
      {missingCredentials.length > 0 && (
        <div className="mb-2">
          <div className="text-sm font-medium text-red-700 mb-1">❌ Missing:</div>
          <ul className="text-xs text-red-600 pl-2">
            {missingCredentials.map(cred => (
              <li key={cred}>• {cred.replace(/_/g, ' ')}</li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="text-xs text-gray-500 pt-2 border-t">
        Click to configure credentials
      </div>
    </div>
  );
}; 