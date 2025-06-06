'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MockExecutionState, getMockScreenshotUrl } from '@/lib/mock-aef-data';
import { Button } from '@/components/ui/button';
import { RefreshCw, Maximize2, Camera, ExternalLink, Loader2, Monitor, Image } from 'lucide-react';
import ResponsiveVNCFrame from './ResponsiveVNCFrame';
import VNCDebugPanel from './VNCDebugPanel';

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
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const [vncMode, setVncMode] = useState<boolean>(false);
  const [vncSupported, setVncSupported] = useState<boolean>(false);
  const [optimalResolution, setOptimalResolution] = useState<{width: number, height: number} | null>(null);
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection management
  useEffect(() => {
    if (isActive && executionId && !mockExecutionState) {
      console.log('🖥️ BrowserPanel: Starting WebSocket connection for execution:', executionId);
      connectToWebSocket();
    } else if (mockExecutionState && isActive) {
      // Use mock data when available
      setCurrentUrl(mockExecutionState.browserUrl);
      setLastUpdated(mockExecutionState.lastActivity);
      setScreenshot(getMockScreenshotUrl(mockExecutionState.browserUrl));
      setConnectionStatus('connected');
    } else {
      disconnectWebSocket();
      resetState();
    }

    return () => {
      disconnectWebSocket();
    };
  }, [isActive, executionId, mockExecutionState]);

  const connectToWebSocket = () => {
    if (!executionId) return;

    setConnectionStatus('connecting');
    setIsLoading(true);

    try {
      // Connect to WebSocket server - try port 3004 first, fallback to 3003
      const wsUrl = `ws://localhost:3004/ws?executionId=${executionId}`;
      console.log('🔗 Connecting to WebSocket:', wsUrl);
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('✅ Browser WebSocket connected for execution:', executionId);
        setConnectionStatus('connected');
        setIsLoading(false);
        
        // Send connection established message
        wsRef.current?.send(JSON.stringify({
          type: 'connection_established',
          executionId: executionId,
          timestamp: Date.now()
        }));
        
        // Check if this is a VNC environment execution (starts with 'vnc-env-')
        if (executionId.startsWith('vnc-env-')) {
          console.log('🖥️ VNC environment detected, requesting VNC connection...');
          // Request VNC connection for VNC environments
          wsRef.current?.send(JSON.stringify({
            type: 'vnc_connect',
            timestamp: Date.now()
          }));
        } else {
          // Request screenshot for regular executions
          wsRef.current?.send(JSON.stringify({
            type: 'request_screenshot',
            timestamp: Date.now()
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('🔌 Browser WebSocket disconnected');
        setConnectionStatus('disconnected');
        setIsLoading(false);
        
        // Try to reconnect after 3 seconds if execution is still active
        if (isActive && executionId) {
          console.log('🔄 Attempting to reconnect in 3 seconds...');
          setTimeout(() => {
            if (isActive && executionId) {
              connectToWebSocket();
            }
          }, 3000);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ Browser WebSocket error:', error);
        setConnectionStatus('disconnected');
        setIsLoading(false);
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setConnectionStatus('disconnected');
      setIsLoading(false);
    }
  };

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  const resetState = () => {
    setScreenshot(null);
    setCurrentUrl('');
    setLastUpdated(null);
    setConnectionStatus('disconnected');
    setVncUrl(null);
    setVncMode(false);
    setVncSupported(false);
  };

  const handleWebSocketMessage = (message: any) => {
    console.log('📨 Browser WebSocket message:', message.type, message);
    
    switch (message.type) {
      case 'connection_established':
        console.log('🔗 WebSocket connection confirmed');
        break;
        
      case 'vnc_ready':
        console.log('🖥️ VNC connection ready!', message.data);
        if (message.data && message.data.vncUrl) {
          setVncUrl(message.data.vncUrl);
          setVncSupported(true);
          setVncMode(true);
          setCurrentUrl('VNC Remote Desktop Session');
          setLastUpdated(new Date(message.timestamp));
          console.log('✅ VNC URL set:', message.data.vncUrl);
        } else {
          console.warn('⚠️ VNC ready but no URL provided');
        }
        break;
        
      case 'vnc_fallback':
        console.log('⚠️ VNC not available, falling back to screenshots');
        setVncSupported(false);
        setVncMode(false);
        // Request screenshot as fallback
        wsRef.current?.send(JSON.stringify({
          type: 'request_screenshot',
          timestamp: Date.now()
        }));
        break;
        
      case 'vnc_error':
        console.error('❌ VNC error:', message.data?.error);
        setVncSupported(false);
        setVncMode(false);
        // Fallback to screenshot mode
        wsRef.current?.send(JSON.stringify({
          type: 'request_screenshot',
          timestamp: Date.now()
        }));
        break;
        
      case 'browser_update':
        if (!vncMode) { // Only handle screenshots if not in VNC mode
          if (message.data.screenshot) {
            const screenshotData = message.data.screenshot.startsWith('data:') 
              ? message.data.screenshot 
              : `data:image/png;base64,${message.data.screenshot}`;
            setScreenshot(screenshotData);
          }
          if (message.data.state?.currentUrl) {
            setCurrentUrl(message.data.state.currentUrl);
          }
          setLastUpdated(new Date(message.timestamp));
        }
        break;
        
      case 'action_complete':
        if (!vncMode && message.data.screenshot) {
          const screenshotData = message.data.screenshot.startsWith('data:') 
            ? message.data.screenshot 
            : `data:image/png;base64,${message.data.screenshot}`;
          setScreenshot(screenshotData);
          setLastUpdated(new Date(message.timestamp));
        }
        break;
        
      case 'error':
        console.error('🚨 Browser error:', message.data.error);
        break;
        
      default:
        console.log('❓ Unknown browser WebSocket message type:', message.type);
    }
  };

  const handleRefresh = async () => {
    if (!executionId || !wsRef.current) return;
    
    setIsLoading(true);
    try {
      if (vncMode) {
        // For VNC mode, just refresh the iframe
        const iframe = document.querySelector('iframe[title="Live Browser VNC"]') as HTMLIFrameElement;
        if (iframe) {
          iframe.src = iframe.src; // This forces a reload
        }
      } else {
        // Request fresh screenshot via WebSocket
        wsRef.current.send(JSON.stringify({
          type: 'request_screenshot',
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Failed to refresh browser state:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFullscreen = () => {
    console.log('🔍 Opening fullscreen browser view...');
    
    if (vncMode && vncUrl) {
      // Open VNC in new window
      const newWindow = window.open(vncUrl, '_blank', 'width=1280,height=720');
      if (newWindow) {
        newWindow.focus();
      }
    } else if (screenshot) {
      // Open screenshot in new window
      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>Browser View - ${currentUrl}</title></head>
            <body style="margin:0; background:#000; display:flex; justify-content:center; align-items:center; height:100vh;">
              <img src="${screenshot}" style="max-width:100%; max-height:100%; object-fit:contain;" />
            </body>
          </html>
        `);
      }
    }
  };

  const handleTakeScreenshot = () => {
    if (!executionId || !wsRef.current || vncMode) return;
    
    console.log('📸 Requesting manual screenshot...');
    wsRef.current.send(JSON.stringify({
      type: 'manual_screenshot',
      timestamp: Date.now()
    }));
  };

  const handleToggleVncMode = (useVnc: boolean) => {
    if (useVnc && vncSupported && vncUrl) {
      setVncMode(true);
    } else {
      setVncMode(false);
      // Request screenshot when switching back
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'request_screenshot',
          timestamp: Date.now()
        }));
      }
    }
  };

  const handleRestartBrowser = async () => {
    if (!executionId || !executionId.startsWith('vnc-env-')) return;
    
    setIsLoading(true);
    try {
      console.log('🔄 Restarting browser window...');
      
      // Call the restart browser endpoint on the container
      // We need to determine the container port first, but for now we'll use the API
      const response = await fetch('/api/aef/restart-browser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ executionId })
      });
      
      if (!response.ok) {
        throw new Error('Failed to restart browser');
      }
      
      const result = await response.json();
      console.log('✅ Browser restarted:', result);
      
      // Refresh the VNC connection after restart
      if (vncMode && vncUrl) {
        const iframe = document.querySelector('iframe[title="Live Browser VNC"]') as HTMLIFrameElement;
        if (iframe) {
          setTimeout(() => {
            iframe.src = iframe.src; // Force reload
          }, 2000); // Wait 2 seconds for browser to be ready
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to restart browser:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDimensionsChange = async (dimensions: {width: number, height: number}) => {
    console.log('📐 BrowserPanel: Optimal dimensions calculated:', dimensions);
    
    if (!optimalResolution || 
        optimalResolution.width !== dimensions.width || 
        optimalResolution.height !== dimensions.height) {
      
      setOptimalResolution(dimensions);
      
      // TODO: Update Docker container resolution if supported
      // This would require enhancing the Docker container API
      if (executionId?.startsWith('vnc-env-') && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'update_resolution',
          data: dimensions,
          timestamp: Date.now()
        }));
      }
    }
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
            {/* VNC/Screenshot Toggle */}
            {vncSupported && (
              <div className="flex border border-gray-200 rounded">
                <Button
                  onClick={() => handleToggleVncMode(false)}
                  variant={vncMode ? "outline" : "default"}
                  size="sm"
                  className="rounded-r-none"
                  title="Screenshot Mode"
                >
                  <Image className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => handleToggleVncMode(true)}
                  variant={vncMode ? "default" : "outline"}
                  size="sm"
                  className="rounded-l-none border-l-0"
                  title="Live VNC Mode"
                >
                  <Monitor className="w-4 h-4" />
                </Button>
              </div>
            )}
            
            <Button
              onClick={handleTakeScreenshot}
              variant="outline"
              size="sm"
              disabled={isLoading || connectionStatus !== 'connected' || vncMode}
              title="Take Screenshot"
            >
              <Camera className="w-4 h-4" />
            </Button>
            
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={isLoading}
              title="Refresh"
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
              disabled={vncMode ? !vncUrl : !screenshot}
              title="Open Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            
            {/* Restart Browser button for VNC environments */}
            {executionId?.startsWith('vnc-env-') && (
              <>
                <Button
                  onClick={handleRestartBrowser}
                  variant="outline"
                  size="sm"
                  disabled={isLoading}
                  title="Restart Browser Window"
                  className="text-orange-600 border-orange-300 hover:bg-orange-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <span className="text-sm">🔄</span>
                  )}
                </Button>
                
                <Button
                  onClick={() => setDebugMode(!debugMode)}
                  variant={debugMode ? "default" : "outline"}
                  size="sm"
                  title="Debug VNC Connection"
                  className={debugMode ? "bg-purple-600 text-white" : "text-purple-600 border-purple-300 hover:bg-purple-50"}
                >
                  <span className="text-sm">🔍</span>
                </Button>
              </>
            )}
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connectionStatus === 'connected' ? 'bg-green-500' :
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              'bg-red-500'
            }`}></div>
            {connectionStatus === 'connected' ? 'Browser Ready' :
             connectionStatus === 'connecting' ? 'Connecting...' :
             'Disconnected'}
          </div>
          {lastUpdated && (
            <div>
              Last updated: {lastUpdated.toLocaleTimeString()}
            </div>
          )}
          {executionId?.startsWith('vnc-env-') && (
            <div className="text-purple-600 font-medium">
              🖥️ VNC Environment
            </div>
          )}
          {mockExecutionState && (
            <div className="text-blue-600">
              Mock Mode
            </div>
          )}
        </div>
      </div>

      {/* Browser Content Area */}
      <div className="flex-1 bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden p-6 flex items-center justify-center">
        {vncMode && vncUrl ? (
          // VNC Mode - Show live browser in properly sized viewport
          <div className="relative w-full max-w-5xl mx-auto">
            {/* Browser Window Frame */}
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-300">
              {/* Browser Title Bar */}
              <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 text-center">
                  <div className="bg-white rounded px-3 py-1 text-sm text-gray-600 border max-w-md mx-auto">
                    {currentUrl || 'VNC Remote Desktop Session'}
                  </div>
                </div>
                <div className="w-6"></div> {/* Balance the layout */}
              </div>
              
              {/* Responsive VNC Browser Viewport */}
              <div className="relative w-full bg-white aspect-[16/9]">
                <ResponsiveVNCFrame
                  vncUrl={vncUrl}
                  currentUrl={currentUrl}
                  onDimensionsChange={handleDimensionsChange}
                  onFullscreen={handleFullscreen}
                  showControls={true}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        ) : screenshot ? (
          // Screenshot Mode - Show in browser frame
          <div className="relative w-full max-w-5xl mx-auto">
            <div className="bg-white rounded-lg shadow-2xl overflow-hidden border border-gray-300">
              {/* Browser Title Bar */}
              <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                </div>
                <div className="flex-1 text-center">
                  <div className="bg-white rounded px-3 py-1 text-sm text-gray-600 border max-w-md mx-auto">
                    {currentUrl || 'Screenshot Mode'}
                  </div>
                </div>
                <div className="w-6"></div>
              </div>
              
              {/* Screenshot Viewport */}
              <div className="relative bg-white aspect-[16/9]">
                <img
                  src={screenshot}
                  alt="Browser screenshot"
                  className="w-full h-full object-contain bg-gray-50"
                />
                
                {/* Screenshot Status Overlay */}
                <div className="absolute top-3 left-3 right-3">
                  <div className="bg-blue-600/95 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-lg backdrop-blur-sm">
                    <div className="w-2 h-2 bg-white rounded-full mr-3"></div>
                    {mockExecutionState ? '🎭 Mock Browser Session' : '📸 Screenshot Mode'}
                    {vncSupported && (
                      <span className="ml-2 text-xs opacity-75">
                        (Switch to VNC for live interaction)
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Loading/Empty State - Centered with browser frame
          <div className="relative w-full max-w-5xl mx-auto">
            <div className="bg-white rounded-lg shadow-xl overflow-hidden border border-gray-300">
              {/* Browser Title Bar */}
              <div className="bg-gray-100 border-b border-gray-300 px-4 py-2 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                  <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                </div>
                <div className="flex-1 text-center">
                  <div className="bg-gray-50 rounded px-3 py-1 text-sm text-gray-500 border max-w-md mx-auto">
                    Waiting for browser session...
                  </div>
                </div>
                <div className="w-6"></div>
              </div>
              
              {/* Empty State Viewport */}
              <div className="relative bg-gray-50 aspect-[16/9]">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-20 h-20 mx-auto mb-6 bg-white rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                      {isLoading ? (
                        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                      ) : vncMode ? (
                        <Monitor className="w-8 h-8 text-gray-400" />
                      ) : (
                        <Camera className="w-8 h-8 text-gray-400" />
                      )}
                    </div>
                    <p className="text-gray-600 font-medium text-lg mb-2">
                      {isLoading ? 'Initializing browser...' : 
                       connectionStatus === 'connecting' ? 'Connecting to browser...' :
                       connectionStatus === 'disconnected' ? 'Browser offline' :
                       vncMode ? 'Setting up live VNC connection...' :
                       'Ready for browser automation'}
                    </p>
                    <p className="text-sm text-gray-500">
                      {connectionStatus === 'connected' ? 
                        vncMode ? 'Live browser will appear here' : 'Screenshots will appear here during automation' :
                        'Browser session will connect automatically'
                      }
                    </p>
                    {executionId?.startsWith('vnc-env-') && connectionStatus === 'connected' && (
                      <div className="mt-6 space-y-3">
                        <p className="text-sm text-purple-600 font-medium">
                          🖥️ VNC environment is ready
                        </p>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-700">
                          <p className="font-medium mb-2">Browser window not visible?</p>
                          <p className="mb-3">The browser window might be minimized or closed. Click the button below to open it:</p>
                          <Button
                            onClick={handleRestartBrowser}
                            disabled={isLoading}
                            size="sm"
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            {isLoading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                Opening Browser...
                              </>
                            ) : (
                              <>
                                🔄 Open Browser Window
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Footer with browser controls */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <div>Session: {executionId?.slice(-8) || 'Unknown'}</div>
            <div>
              {connectionStatus === 'connected' ? 
                vncMode ? 'Live VNC Stream' : 'Screenshot Mode' : 
               connectionStatus === 'connecting' ? 'Connecting...' : 
               'Offline'}
            </div>
            {vncSupported && (
              <div className="text-green-600 font-medium">
                🖥️ VNC Ready
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 
                vncMode ? 'bg-green-500 animate-pulse' : 'bg-blue-500 animate-pulse' :
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              'bg-gray-400'
            }`}></div>
            <span>
              {connectionStatus === 'connected' ? 
                vncMode ? 'Live Streaming' : 'Recording' :
               connectionStatus === 'connecting' ? 'Connecting' :
               'Stopped'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowserPanel; 