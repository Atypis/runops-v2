'use client';

import React, { useState, useEffect } from 'react';
import { MockExecutionState, getMockScreenshotUrl } from '@/lib/mock-aef-data';
import { Button } from '@/components/ui/button';
import { RefreshCw, Maximize2, Camera, ExternalLink, Loader2 } from 'lucide-react';

interface BrowserPanelProps {
  executionId?: string;
  isActive?: boolean;
  mockExecutionState?: MockExecutionState | null;
}

const BrowserPanel: React.FC<BrowserPanelProps> = ({
  executionId,
  isActive = false,
  mockExecutionState
}) => {
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Use mock data when available
  useEffect(() => {
    if (mockExecutionState && isActive) {
      setCurrentUrl(mockExecutionState.browserUrl);
      setLastUpdated(mockExecutionState.lastActivity);
      setScreenshot(getMockScreenshotUrl(mockExecutionState.browserUrl));
    } else if (isActive && executionId) {
      // TODO: Replace with actual API call to get browser state
      setCurrentUrl('https://gmail.com');
      setLastUpdated(new Date());
      // TODO: Start polling for screenshot updates
    } else {
      setScreenshot(null);
      setCurrentUrl('');
      setLastUpdated(null);
    }
  }, [isActive, executionId, mockExecutionState]);

  const handleRefresh = () => {
    if (!executionId) return;
    
    setIsLoading(true);
    // TODO: Implement actual screenshot refresh
    setTimeout(() => {
      setLastUpdated(new Date());
      setIsLoading(false);
    }, 1000);
  };

  const handleFullscreen = () => {
    // TODO: Implement fullscreen browser view
    console.log('Opening fullscreen browser view...');
  };

  const handleTakeScreenshot = () => {
    // TODO: Implement manual screenshot capture
    console.log('Taking screenshot...');
  };

  // Show inactive state when no execution is running
  if (!isActive || !executionId) {
    return (
      <div className="browser-panel h-full flex flex-col bg-gray-50">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">Browser View</h2>
        </div>
        
        {/* Inactive Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-lg flex items-center justify-center">
              <ExternalLink className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Active Session
            </h3>
            <p className="text-gray-600 max-w-sm">
              Start a workflow execution to see live browser automation in action.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="browser-panel h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              Browser View
            </h2>
            {currentUrl && (
              <div className="flex items-center text-sm text-gray-600">
                <span className="truncate">{currentUrl}</span>
                <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
              </div>
            )}
          </div>
          
          <div className="flex gap-2 ml-4">
            <Button
              onClick={handleTakeScreenshot}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              <Camera className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            
            <Button
              onClick={handleFullscreen}
              variant="outline"
              size="sm"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Browser Ready
          </div>
          {lastUpdated && (
            <div>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Browser Content Area */}
      <div className="flex-1 bg-gray-100 relative overflow-hidden">
        {screenshot ? (
          <img
            src={screenshot}
            alt="Browser screenshot"
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-white rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                {isLoading ? (
                  <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                ) : (
                  <Camera className="w-8 h-8 text-gray-400" />
                )}
              </div>
              <p className="text-gray-600 font-medium">
                {isLoading ? 'Loading browser view...' : 'Waiting for browser activity...'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Screenshots will appear here during automation
              </p>
            </div>
          </div>
        )}
        
        {/* Screenshot overlay with action indicators */}
        {screenshot && (
          <div className="absolute top-4 left-4 right-4">
            <div className="bg-black/50 text-white px-3 py-1 rounded text-sm font-medium">
              Live Browser Session
            </div>
          </div>
        )}
      </div>
      
      {/* Footer with browser controls */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <div>Session: {executionId?.slice(-8) || 'Unknown'}</div>
            <div>Auto-refresh: Every 3s</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span>Recording</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowserPanel; 