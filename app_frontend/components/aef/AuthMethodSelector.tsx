'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AuthMethodConfig, AuthenticationMethod, ServiceType } from '@/lib/types/aef';
import { getAuthMethodsForService, getDefaultAuthMethod, getAuthMethodLabel } from '@/lib/credentials/auth-methods';
import { Button } from '@/components/ui/button';

interface AuthMethodSelectorProps {
  serviceType: ServiceType;
  selectedMethod?: AuthenticationMethod;
  onMethodChange: (method: AuthenticationMethod) => void;
  className?: string;
}

const AuthMethodSelector: React.FC<AuthMethodSelectorProps> = ({
  serviceType,
  selectedMethod,
  onMethodChange,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<AuthenticationMethod | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);

  const authMethods = getAuthMethodsForService(serviceType);
  const defaultMethod = getDefaultAuthMethod(serviceType);

  useEffect(() => {
    // Set initial method
    const initialMethod = selectedMethod || defaultMethod;
    if (initialMethod && initialMethod !== currentMethod) {
      setCurrentMethod(initialMethod);
      onMethodChange(initialMethod);
    }
  }, [selectedMethod, defaultMethod, currentMethod, onMethodChange]);

  useEffect(() => {
    // Calculate dropdown position when opened
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  }, [isOpen]);

  useEffect(() => {
    // Close dropdown on scroll or resize
    const handleScrollOrResize = () => {
      if (isOpen) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  const handleMethodSelect = (method: AuthenticationMethod) => {
    setCurrentMethod(method);
    onMethodChange(method);
    setIsOpen(false);
  };

  const currentMethodConfig = authMethods.find(m => m.method === currentMethod);

  if (authMethods.length === 0) {
    // Only hide if no methods available at all
    return null;
  }

  const dropdownContent = isOpen ? (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={() => setIsOpen(false)}
      />
      
      {/* Menu */}
      <div 
        className="fixed bg-white border border-gray-200 rounded-md shadow-xl z-50 max-h-64 overflow-y-auto"
        style={{
          top: dropdownPosition.top,
          left: dropdownPosition.left,
          width: dropdownPosition.width
        }}
      >
        <div className="py-1">
          {authMethods.map((methodConfig) => (
            <button
              key={methodConfig.method}
              onClick={() => handleMethodSelect(methodConfig.method)}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                currentMethod === methodConfig.method ? 'bg-blue-50 text-blue-700' : 'text-gray-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5 flex-shrink-0">{methodConfig.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{methodConfig.label}</div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{methodConfig.description}</div>
                  {methodConfig.isDefault && (
                    <div className="text-xs text-blue-600 mt-1 font-medium">Recommended</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  ) : null;

  return (
    <div className={`relative ${className}`}>
      {/* Current Method Display */}
      <Button
        ref={buttonRef}
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between text-left bg-gray-50 hover:bg-gray-100 border-gray-200"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{currentMethodConfig?.icon || '🔐'}</span>
          <span className="text-sm font-medium">
            {currentMethodConfig?.label || 'Select Method'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>

      {/* Portal the dropdown to document.body to avoid clipping */}
      {typeof window !== 'undefined' && dropdownContent && createPortal(
        dropdownContent,
        document.body
      )}
    </div>
  );
};

export default AuthMethodSelector; 