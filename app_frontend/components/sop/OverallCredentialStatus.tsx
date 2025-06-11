'use client';

import React from 'react';
import { Shield, AlertTriangle, Lock, CheckCircle } from 'lucide-react';

interface OverallCredentialStatusProps {
  status: 'none' | 'missing' | 'partial' | 'complete';
  totalRequired: number;
  totalConfigured: number;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onClick?: () => void;
}

export const OverallCredentialStatus: React.FC<OverallCredentialStatusProps> = ({
  status,
  totalRequired,
  totalConfigured,
  isLoading = false,
  error = null,
  onRefresh,
  onClick
}) => {
  const getStatusConfig = () => {
    if (error) {
      return {
        icon: AlertTriangle,
        bgColor: 'bg-red-100',
        borderColor: 'border-red-300',
        textColor: 'text-red-700',
        iconColor: 'text-red-600',
        title: 'Credential Error',
        message: 'Failed to load credentials'
      };
    }

    if (isLoading) {
      return {
        icon: Shield,
        bgColor: 'bg-gray-100',
        borderColor: 'border-gray-300',
        textColor: 'text-gray-700',
        iconColor: 'text-gray-600',
        title: 'Loading...',
        message: 'Checking credentials'
      };
    }

    switch (status) {
      case 'none':
        return {
          icon: Shield,
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-700',
          iconColor: 'text-gray-600',
          title: 'No Credentials Required',
          message: 'This workflow runs without authentication'
        };
      case 'missing':
        return {
          icon: Lock,
          bgColor: 'bg-red-100',
          borderColor: 'border-red-300',
          textColor: 'text-red-700',
          iconColor: 'text-red-600',
          title: 'Credentials Required',
          message: 'Setup required before execution'
        };
      case 'partial':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-yellow-100',
          borderColor: 'border-yellow-300',
          textColor: 'text-yellow-700',
          iconColor: 'text-yellow-600',
          title: 'Partial Setup',
          message: 'Some credentials still needed'
        };
      case 'complete':
        return {
          icon: CheckCircle,
          bgColor: 'bg-green-100',
          borderColor: 'border-green-300',
          textColor: 'text-green-700',
          iconColor: 'text-green-600',
          title: 'Ready to Execute',
          message: 'All credentials configured'
        };
      default:
        return {
          icon: Shield,
          bgColor: 'bg-gray-100',
          borderColor: 'border-gray-300',
          textColor: 'text-gray-700',
          iconColor: 'text-gray-600',
          title: 'Unknown Status',
          message: 'Credential status unknown'
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-3 rounded-lg border-2 cursor-pointer
        transition-all duration-200 hover:shadow-md
        ${config.bgColor} ${config.borderColor} ${config.textColor}
      `}
      onClick={onClick}
      title={error ? `Error: ${error}` : `${config.title}: ${totalConfigured}/${totalRequired} configured`}
    >
      <IconComponent className={`w-5 h-5 ${config.iconColor} ${isLoading ? 'animate-spin' : ''}`} />
      
      <div className="flex-1">
        <div className="font-semibold text-sm">
          {config.title}
        </div>
        <div className="text-xs opacity-90">
          {config.message}
        </div>
      </div>
      
      {totalRequired > 0 && (
        <div className="text-right">
          <div className="font-bold text-lg">
            {totalConfigured}/{totalRequired}
          </div>
          <div className="text-xs opacity-75">
            credentials
          </div>
        </div>
      )}
      
      {error && onRefresh && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRefresh();
          }}
          className="px-2 py-1 text-xs bg-white bg-opacity-50 rounded hover:bg-opacity-75 transition-all"
        >
          Retry
        </button>
      )}
    </div>
  );
}; 