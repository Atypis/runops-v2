'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useReasoningStream } from '../../hooks/useReasoningStream';
import { ChevronDown, ChevronUp, Brain, Loader2, Wifi, WifiOff } from 'lucide-react';

interface ReasoningStreamProps {
  executionId: string;
  autoExpand?: boolean;
  className?: string;
}

export function ReasoningStream({ 
  executionId, 
  autoExpand = false, 
  className = '' 
}: ReasoningStreamProps) {
  const [isExpanded, setIsExpanded] = useState(autoExpand);
  const [autoScroll, setAutoScroll] = useState(true);
  
  const { 
    reasoningText, 
    isThinking, 
    isConnected, 
    subscribe, 
    unsubscribe, 
    clearReasoning 
  } = useReasoningStream(executionId);
  
  const contentRef = useRef<HTMLDivElement>(null);
  const isFirstThinkingRef = useRef(true);

  // Auto-expand on first thinking event
  useEffect(() => {
    if (isThinking && isFirstThinkingRef.current && !isExpanded) {
      setIsExpanded(true);
      isFirstThinkingRef.current = false;
    }
  }, [isThinking, isExpanded]);

  // Auto-scroll to bottom when new text arrives
  useEffect(() => {
    if (autoScroll && contentRef.current && reasoningText) {
      const element = contentRef.current;
      const shouldScroll = element.scrollHeight - element.scrollTop <= element.clientHeight + 50;
      
      if (shouldScroll) {
        setTimeout(() => {
          element.scrollTop = element.scrollHeight;
        }, 10);
      }
    }
  }, [reasoningText, autoScroll]);

  // Subscribe on mount
  useEffect(() => {
    subscribe();
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleClearReasoning = () => {
    clearReasoning();
  };

  const hasContent = reasoningText.length > 0 || isThinking;

  return (
    <div className={`border border-gray-200 rounded-lg bg-white shadow-sm ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={handleToggleExpanded}
      >
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-600" />
          <span className="font-medium text-gray-700">AI Reasoning</span>
          
          {/* Status indicators */}
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Wifi className="h-3 w-3 text-green-500" title="Connected" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" title="Disconnected" />
            )}
            
            {isThinking && (
              <div className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 text-purple-500 animate-spin" />
                <span className="text-xs text-purple-600 font-medium">Thinking...</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Character count */}
          {hasContent && (
            <span className="text-xs text-gray-500">
              {reasoningText.length} chars
            </span>
          )}
          
          {/* Clear button */}
          {hasContent && isExpanded && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClearReasoning();
              }}
              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
              title="Clear reasoning text"
            >
              Clear
            </button>
          )}
          
          {/* Expand/collapse icon */}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="border-t border-gray-200">
          {hasContent ? (
            <div
              ref={contentRef}
              className="p-4 max-h-64 overflow-y-auto bg-gray-50 text-sm font-mono leading-relaxed whitespace-pre-wrap"
              style={{ 
                scrollBehavior: autoScroll ? 'smooth' : 'auto'
              }}
            >
              {reasoningText}
              {isThinking && (
                <span className="inline-block w-2 h-4 bg-purple-500 animate-pulse ml-1" />
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Brain className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No reasoning available yet</p>
              <p className="text-xs text-gray-400 mt-1">
                AI reasoning will appear here during execution
              </p>
            </div>
          )}
          
          {/* Controls */}
          {hasContent && (
            <div className="px-4 py-2 bg-white border-t border-gray-200 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 text-gray-600">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Auto-scroll
              </label>
              
              <div className="flex items-center gap-2 text-gray-500">
                <span>
                  {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}